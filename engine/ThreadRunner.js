/**
 * ThreadRunner.js
 * Cooperative multitasking for Scratch-style threads.
 *
 * Yield Protocol (matches Interpreter.js):
 * { type: 'frame' }                     - Pause until next frame
 * { type: 'waitSeconds', secs: N }      - Wait N seconds
 * { type: 'waitUntil', fn: () => bool } - Wait until condition is true
 * { type: 'waitThreads', threads: [] }  - Wait until all listed threads complete
 * { type: 'waitPromise', promise: P }   - Wait until Promise resolves
 */
import { runSteps } from './Interpreter.js';

export class Thread {
  /**
   * @param {SpriteRuntime} target
   * @param {Generator} generator
   * @param {object} opts - { topScript? }
   */
  constructor(target, generator, opts = {}) {
    this.target = target;
    this._gen = generator;
    this.topScript = opts.topScript ?? null;
    this.status = 'running'; // 'running' | 'done' | 'yielded'

    // Wait states (only one active at a time)
    this._waitUntil    = null; // () => bool
    this._waitSeconds  = null; // { until: number (ms timestamp) }
    this._waitThreads  = null; // Thread[]
    this._waitPromise  = null; // Promise
    this._promiseDone  = false;
  }
}

export class ThreadRunner {
  constructor(runtime) {
    this._runtime = runtime;
    this._threads = [];
  }

  /** Start a script (hat + steps) as a new thread. */
  startScript(target, script) {
    const gen = runSteps(script.steps, target, { args: {} }, this._runtime);
    const thread = new Thread(target, gen, { topScript: script });
    this._threads.push(thread);
    return thread;
  }

  /** Start a procedure call as a new thread (for async dispatch). */
  startProcedure(target, proc, args) {
    const ctx = { args: args ?? {} };
    const gen = runSteps(proc.steps, target, ctx, this._runtime);
    const thread = new Thread(target, gen);
    this._threads.push(thread);
    return thread;
  }

  /** Start arbitrary steps as a new thread. */
  startSteps(target, steps, ctx) {
    const gen = runSteps(steps, target, ctx ?? { args: {} }, this._runtime);
    const thread = new Thread(target, gen);
    this._threads.push(thread);
    return thread;
  }

  /**
   * Advance all threads by one frame.
   * Each thread runs until it yields or completes.
   */
  stepThreads() {
    const now = this._runtime._now();
    const threads = this._threads.slice(); // snapshot to avoid mutation issues

    for (const thread of threads) {
      if (thread.status === 'done') continue;

      // ── Check wait states ─────────────────────────────────────────
      if (thread._waitSeconds) {
        if (now < thread._waitSeconds.until) continue; // still waiting
        thread._waitSeconds = null;
      }

      if (thread._waitUntil) {
        try {
          if (!thread._waitUntil()) continue; // condition not met
        } catch (_) {}
        thread._waitUntil = null;
      }

      if (thread._waitThreads) {
        const allDone = thread._waitThreads.every(t => t.status === 'done');
        if (!allDone) continue;
        thread._waitThreads = null;
      }

      if (thread._waitPromise) {
        if (!thread._promiseDone) continue;
        thread._waitPromise = null;
        thread._promiseDone = false;
      }

      // ── Advance the generator ─────────────────────────────────────
      this._advanceThread(thread);
    }

    // Remove done threads
    this._threads = this._threads.filter(t => t.status !== 'done');
  }

  _advanceThread(thread) {
    try {
      const result = thread._gen.next();

      if (result.done) {
        thread.status = 'done';
        return;
      }

      const yv = result.value;

      if (!yv || typeof yv !== 'object') {
        // No meaningful yield value; treat as frame yield
        thread.status = 'yielded';
        return;
      }

      switch (yv.type) {
        case 'frame':
          thread.status = 'yielded';
          break;

        case 'waitSeconds':
          thread._waitSeconds = { until: this._runtime._now() + yv.secs * 1000 };
          thread.status = 'yielded';
          break;

        case 'waitUntil':
          thread._waitUntil = yv.fn;
          thread.status = 'yielded';
          break;

        case 'waitThreads':
          thread._waitThreads = yv.threads;
          thread.status = 'yielded';
          break;

        case 'waitPromise':
          thread._waitPromise = yv.promise;
          thread._promiseDone = false;
          thread.status = 'yielded';
          if (yv.promise && typeof yv.promise.then === 'function') {
            yv.promise.then(() => {
              thread._promiseDone = true;
            }).catch(() => {
              thread._promiseDone = true;
            });
          } else {
            // Not a real promise — resolve immediately
            thread._promiseDone = true;
          }
          break;

        default:
          thread.status = 'yielded';
          break;
      }
    } catch (e) {
      // Runtime error in thread — mark done and log
      thread.status = 'done';
      if (typeof console !== 'undefined') {
        console.error('[ThreadRunner] Thread error:', e);
      }
    }
  }

  stopAll() {
    for (const thread of this._threads) {
      thread.status = 'done';
    }
    this._threads = [];
  }

  stopThread(thread) {
    thread.status = 'done';
    const idx = this._threads.indexOf(thread);
    if (idx >= 0) this._threads.splice(idx, 1);
  }

  /**
   * Stop all threads for a target, except one specific thread.
   * @param {SpriteRuntime} target
   * @param {Thread|null} exceptThread
   */
  stopOtherScriptsOf(target, exceptThread) {
    const toRemove = this._threads.filter(t => t.target === target && t !== exceptThread);
    for (const t of toRemove) {
      t.status = 'done';
    }
    this._threads = this._threads.filter(t => t.status !== 'done');
  }

  threadsForTarget(target) {
    return this._threads.filter(t => t.target === target);
  }

  hasThreadsForBroadcast(name) {
    // Check if any target has a receive hat for this broadcast name
    for (const target of this._runtime.targets) {
      for (const script of (target._def.scripts ?? [])) {
        if (script.event.type === 'receive' && script.event.name === name) {
          return true;
        }
      }
    }
    return false;
  }

  isEmpty() {
    return this._threads.length === 0;
  }

  get threads() {
    return this._threads;
  }
}
