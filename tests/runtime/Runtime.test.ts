import assert from 'node:assert/strict';
import test from 'node:test';

import {createRuntimeProject, createStopAllProject, createStopThisScriptProject} from '../fixtures/runtimeProject.ts';
import {createProject} from '../../src/model/ProjectFactory.ts';
import {Runtime} from '../../src/runtime/Runtime.ts';
import type {ClockPort, RandomPort} from '../../src/runtime/ports.ts';

/** Deterministic fake clock: starts at 0, advances only when told to. */
class FakeClock implements ClockPort {
    private current = 0;

    now(): number {
        return this.current;
    }

    advance(ms: number): void {
        this.current += ms;
    }
}

/** Deterministic fake random: always returns a fixed value. */
class FakeRandom implements RandomPort {
    private readonly value: number;

    constructor(value: number = 0) {
        this.value = value;
    }

    random(): number {
        return this.value;
    }
}

const buildRuntime = (clock = new FakeClock(), random = new FakeRandom()) => {
    const project = createProject(createRuntimeProject());
    const runtime = new Runtime({clock, random});
    runtime.load(project);
    runtime.start();
    return {runtime, project, clock};
};

const buildStopAllRuntime = (clock = new FakeClock(), random = new FakeRandom()) => {
    const project = createProject(createStopAllProject());
    const runtime = new Runtime({clock, random});
    runtime.load(project);
    runtime.start();
    return {runtime, project, clock};
};

test('green flag starts whenflagclicked scripts and executes their body', () => {
    const {runtime} = buildRuntime();
    runtime.greenFlag();
    runtime.tick();

    // A single tick is enough to observe the body of a script with no
    // internal loop/wait (e.g. the counter being initialized to 0, then
    // incremented once by the forever loop's first pass).
    assert.equal(runtime.project.stage.variables.get('var-counter'), 1);
});

test('control_wait does not busy-loop and only completes once the clock advances', () => {
    const clock = new FakeClock();
    const {runtime} = buildRuntime(clock);
    runtime.greenFlag();

    runtime.tick();
    // counter script: set 0 -> forever { change by 1; wait 1s }.
    // After the first tick, the forever body should have run once and be
    // sitting inside control_wait (deadline = currentMSecs + 1000).
    assert.equal(runtime.project.stage.variables.get('var-counter'), 1);

    // Ticking again without advancing the clock must not let `wait` complete.
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-counter'), 1);
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-counter'), 1);

    // Advance the clock past the 1000ms deadline; the wait completes and the
    // loop frame pops (YIELD_TICK at the loop boundary), but the forever
    // body itself only re-runs on the *following* tick (tick-boundary yield
    // semantics from SCRATCH_THREAD_SPEC: forever guarantees a yield at the
    // tick boundary, it does not resume the body within the same tick).
    clock.advance(1000);
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-counter'), 1);
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-counter'), 2);
});

test('control_forever runs its body exactly once per loop re-arm (tick-boundary yield)', () => {
    const clock = new FakeClock();
    const {runtime} = buildRuntime(clock);
    runtime.greenFlag();

    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-counter'), 1);

    clock.advance(1000);
    runtime.tick(); // wait completes, loop frame pops -> YIELD_TICK
    assert.equal(runtime.project.stage.variables.get('var-counter'), 1);
    runtime.tick(); // loop re-armed, body runs again
    assert.equal(runtime.project.stage.variables.get('var-counter'), 2);

    clock.advance(1000);
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-counter'), 2);
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-counter'), 3);
});

test('control_repeat stops after the specified number of iterations', () => {
    const {runtime} = buildRuntime();
    runtime.greenFlag();

    // repeat-three's body has no wait, so each tick performs exactly one
    // iteration (tick-boundary yield after each loop pass per spec).
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-repeats'), 1);
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-repeats'), 2);
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-repeats'), 3);

    // The repeat-three thread should have completed (DONE) and been removed.
    const stillRunning = runtime.threads.some(t => t.topBlockId === 'repeat-three');
    assert.equal(stillRunning, false);

    // Ticking again must not increment further (thread is gone).
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-repeats'), 3);
});

test('control_if / control_if_else branch on a boolean reporter condition', () => {
    const {runtime} = buildRuntime();
    runtime.greenFlag();
    runtime.tick();

    // flagItems contains 'yes' but not 'no':
    // if-true (contains 'yes') => true => ifBranch = 'if-taken'
    // if-else-false (contains 'no') => false => elseBranch = 'else-taken'
    assert.equal(runtime.project.stage.variables.get('var-if-branch'), 'if-taken');
    assert.equal(runtime.project.stage.variables.get('var-else-branch'), 'else-taken');
});

test('event_broadcast starts the matching whenbroadcastreceived hat', () => {
    const {runtime} = buildRuntime();
    runtime.greenFlag();
    runtime.tick();

    assert.equal(runtime.project.stage.variables.get('var-received'), 'pong');
});

test('event_broadcastandwait blocks the sender until the receiver thread finishes', () => {
    const clock = new FakeClock();
    const {runtime} = buildRuntime(clock);
    runtime.greenFlag();

    runtime.tick();
    // Receiver ('receive-slow') is in a 2s control_wait; sender must still be
    // waiting and must NOT have run 'set-after-wait' yet.
    assert.equal(runtime.project.stage.variables.get('var-after-wait'), '');

    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-after-wait'), '');

    clock.advance(2000);
    runtime.tick();
    // The receiver's wait deadline has passed: its control_wait completes
    // and the receiver thread finishes (removed from runtime.threads) this
    // tick, but the sender's broadcast-and-wait poll only observes that on
    // the *following* tick (it already yielded for this tick before the
    // receiver thread was removed).
    assert.equal(runtime.project.stage.variables.get('var-after-wait'), '');
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-after-wait'), 'done');
});

test('control_stop "all" halts every thread immediately, including unrelated scripts', () => {
    const {runtime} = buildStopAllRuntime();
    runtime.greenFlag();

    // Before the tick: both 'flag-stop' and the unrelated 'flag-other'
    // forever loop were started by green flag.
    assert.deepEqual(runtime.threads.map(t => t.topBlockId), ['flag-stop', 'flag-other']);

    runtime.tick();

    assert.equal(runtime.project.stage.variables.get('var-before-stop'), 'reached');
    assert.equal(runtime.threads.length, 0, 'stopAll must clear every thread, including unrelated scripts');

    // The unrelated forever loop must not have been able to increment after
    // the stop-all (it never even got an iteration in, since stop-all runs
    // before flag-other's first pass completes within the same tick pass
    // ordering — but regardless, it must be gone afterwards).
    runtime.tick();
    assert.equal(runtime.threads.length, 0);
});

test('control_stop "this script" ends only the current thread mid-loop', () => {
    const project = createProject(createStopThisScriptProject());
    const runtime = new Runtime({clock: new FakeClock(), random: new FakeRandom()});
    runtime.load(project);
    runtime.start();
    runtime.greenFlag();

    runtime.tick();
    // First repeat iteration ran once (stopCounter=1), then `stop this script`
    // ended the thread before the remaining 4 iterations could run.
    assert.equal(runtime.project.stage.variables.get('var-stop-counter'), 1);
    assert.equal(runtime.threads.length, 0, 'stop this script must remove the running thread');

    // Subsequent ticks must not resume the now-stopped repeat loop.
    runtime.tick();
    runtime.tick();
    assert.equal(runtime.project.stage.variables.get('var-stop-counter'), 1);
});

test('tick executes threads in stable creation order (deterministic)', () => {
    const {runtime} = buildRuntime();
    runtime.greenFlag();

    // Threads are created in target/script order: stage scripts in the
    // order declared by `scripts`. Only event_whenflagclicked hats are
    // started by greenFlag; event_whenbroadcastreceived hats (receive-ping,
    // receive-slow) only start once their broadcast fires.
    const order = runtime.threads.map(t => t.topBlockId);
    assert.deepEqual(order, [
        'flag-a',
        'flag-b',
        'flag-c',
        'flag-d',
        'flag-f'
    ]);

    const seqOrder = [...runtime.threads].sort((a, b) => a.seq - b.seq).map(t => t.topBlockId);
    assert.deepEqual(seqOrder, order, 'creation order (seq) must match thread list order before any tick removes/adds threads');
});

test('re-running greenFlag is deterministic: repeated runs produce the same per-run increment', () => {
    // Variables are not reset by greenFlag (only thread state is), so a
    // counter that accumulates across runs should advance by the same
    // amount (+3) each time repeat-three completes, run after run.
    const {runtime} = buildRuntime();
    runtime.greenFlag();
    runtime.tick();
    runtime.tick();
    runtime.tick();
    const firstRunRepeats = runtime.project.stage.variables.get('var-repeats');
    assert.equal(firstRunRepeats, 3);

    runtime.greenFlag();
    runtime.tick();
    runtime.tick();
    runtime.tick();
    const secondRunRepeats = runtime.project.stage.variables.get('var-repeats');
    assert.equal(secondRunRepeats, 6, 'second green-flag run should add another +3 on top of the first run');
});
