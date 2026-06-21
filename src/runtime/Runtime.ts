import type {Project} from '../model/Project.ts';
import type {Stage} from '../model/Stage.ts';
import type {Sprite} from '../model/Sprite.ts';
import type {ClockPort, RandomPort} from './ports.ts';
import {SystemClockPort, SystemRandomPort} from './ports.ts';
import {Thread} from './Thread.ts';
import {stepThread} from './Sequencer.ts';
import {BlockRunner} from './BlockRunner.ts';
import {startHats, type HatMatch} from './EventBus.ts';

/** Safety valve against pathological cross-thread cascades within one tick. */
export const MAX_TICK_PASSES = 1000;

export interface RuntimeOptions {
    clock?: ClockPort;
    random?: RandomPort;
}

/**
 * Headless execution engine: owns the live thread list and drives them
 * through Sequencer.stepThread once per Runtime.tick(). No rendering, audio,
 * or DOM I/O — purely project model + thread scheduling, per Phase 2 scope.
 */
export class Runtime {
    project!: Project;
    readonly clock: ClockPort;
    readonly random: RandomPort;
    readonly blockRunner: BlockRunner;
    threads: Thread[] = [];
    currentMSecs = 0;

    constructor(options: RuntimeOptions = {}) {
        this.clock = options.clock ?? new SystemClockPort();
        this.random = options.random ?? new SystemRandomPort();
        this.blockRunner = new BlockRunner(this);
    }

    /** Attaches the project model. Block indices already live on BlockContainer, so this is a direct assignment. */
    load(project: Project): void {
        this.project = project;
    }

    /** Initializes the scheduler clock. Headless: no input/audio devices to start. */
    start(): void {
        this.currentMSecs = this.clock.now();
    }

    createThread(topBlockId: string, target: Stage | Sprite): Thread {
        const thread = new Thread(topBlockId, target);
        this.threads.push(thread);
        return thread;
    }

    removeThread(thread: Thread): void {
        const index = this.threads.indexOf(thread);
        if (index !== -1) this.threads.splice(index, 1);
    }

    /** Stops every thread immediately and clears the thread list. */
    stopAll(): void {
        for (const thread of this.threads) {
            thread.stackFrames.length = 0;
            thread.status = 'DONE';
        }
        this.threads = [];
    }

    /** Stops existing execution and starts all `event_whenflagclicked` hats. */
    greenFlag(): void {
        this.stopAll();
        this.startHats('event_whenflagclicked', undefined, true);
    }

    /**
     * Starts (or restarts) hat threads for `opcode` matching `match`. See
     * EventBus.startHats for ordering/restart semantics.
     */
    startHats(opcode: string, match: HatMatch | undefined, restartExisting: boolean): Thread[] {
        return startHats(this, opcode, match, restartExisting);
    }

    /**
     * Runs one deterministic scheduling tick: re-arms threads that yielded
     * at the previous tick boundary, then repeatedly walks all RUNNING/
     * YIELD threads (in stable creation order) until a full pass makes no
     * progress, removing DONE threads as they finish. A bounded number of
     * passes guards against pathological cross-thread cascades (e.g. a
     * broadcast chain that keeps spawning runnable work in the same tick).
     */
    tick(): void {
        this.currentMSecs = this.clock.now();

        for (const thread of this.threads) {
            if (thread.status === 'YIELD_TICK') {
                thread.status = 'RUNNING';
            }
        }

        let passes = 0;
        let stepped = true;
        while (stepped && passes++ < MAX_TICK_PASSES) {
            stepped = false;
            for (const thread of this.threads.slice()) {
                if (thread.status === 'RUNNING' || thread.status === 'YIELD') {
                    thread.status = 'RUNNING';
                    stepThread(this, thread);
                    stepped = true;
                }
            }
            this.threads = this.threads.filter(thread => thread.status !== 'DONE');
        }
    }
}
