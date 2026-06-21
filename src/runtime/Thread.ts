import type {Stage} from '../model/Stage.ts';
import type {Sprite} from '../model/Sprite.ts';

export type ThreadStatus = 'RUNNING' | 'YIELD' | 'YIELD_TICK' | 'PROMISE_WAIT' | 'DONE';

/**
 * One level of the thread's call stack. `blockId` is the block currently
 * being executed at this level (null once the level has been exhausted and
 * is waiting to be popped). `isLoop` marks frames pushed for repeat/forever
 * *bodies* (via `BlockUtil.startBranch(name, true)`): when such a frame is
 * exhausted and popped, the Sequencer yields at the tick boundary instead of
 * advancing the parent frame past the loop block, so the loop primitive
 * re-evaluates (and re-pushes the body) on the next tick. `executionContext`
 * is per-block scratch space (loop counters, wait deadlines,
 * broadcast-and-wait handles) that is reset whenever the frame's current
 * block changes.
 */
export interface StackFrame {
    blockId: string | null;
    isLoop: boolean;
    executionContext: Record<string, unknown>;
}

let nextThreadSeq = 0;

/**
 * A single script execution context: a topBlock, the target it runs on, a
 * stack of frames (last element = innermost/topmost), and a status the
 * Sequencer/Runtime use to decide whether to step it further this tick.
 */
export class Thread {
    readonly topBlockId: string;
    readonly target: Stage | Sprite;
    readonly stackFrames: StackFrame[];
    status: ThreadStatus;
    /** Stable creation-order sequence number, used to keep tick order deterministic. */
    readonly seq: number;

    constructor(topBlockId: string, target: Stage | Sprite) {
        this.topBlockId = topBlockId;
        this.target = target;
        this.stackFrames = [{blockId: topBlockId, isLoop: false, executionContext: {}}];
        this.status = 'RUNNING';
        this.seq = nextThreadSeq++;
    }

    pushFrame(blockId: string | null, isLoop: boolean): void {
        this.stackFrames.push({blockId, isLoop, executionContext: {}});
    }

    popFrame(): StackFrame | undefined {
        return this.stackFrames.pop();
    }

    peekFrame(): StackFrame | undefined {
        return this.stackFrames[this.stackFrames.length - 1];
    }

    peekBlockId(): string | null {
        const frame = this.peekFrame();
        return frame ? frame.blockId : null;
    }

    /** Replaces the top frame's current block and resets its scratch context. */
    setCurrentBlock(blockId: string | null): void {
        const frame = this.peekFrame();
        if (!frame) return;
        frame.blockId = blockId;
        frame.executionContext = {};
    }

    /** Resets this thread back to its top block, RUNNING, with a clean stack. */
    restart(): void {
        this.stackFrames.length = 0;
        this.stackFrames.push({blockId: this.topBlockId, isLoop: false, executionContext: {}});
        this.status = 'RUNNING';
    }
}
