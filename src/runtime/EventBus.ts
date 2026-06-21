import type {Runtime} from './Runtime.ts';
import {Thread} from './Thread.ts';

/** Optional match constraints for startHats; currently only broadcast id is needed by P0 primitives. */
export interface HatMatch {
    broadcastId?: string;
}

const hatMatches = (block: {opcode: string; fields: Record<string, {id?: string | null}>}, match?: HatMatch): boolean => {
    if (!match || match.broadcastId === undefined) return true;
    const field = block.fields.BROADCAST_OPTION;
    return Boolean(field && field.id === match.broadcastId);
};

/**
 * Finds all hat blocks of `opcode` across the project's targets (Stage then
 * Sprites, in array order; each target's scripts in declaration order) that
 * satisfy `match`, and starts (or, if `restartExisting` and one is already
 * running for that target/topBlock, restarts) a Thread for each. Returns the
 * threads that were started/restarted, in the same deterministic order, so
 * callers like broadcast-and-wait can track completion.
 */
export const startHats = (
    runtime: Runtime,
    opcode: string,
    match: HatMatch | undefined,
    restartExisting: boolean
): Thread[] => {
    const started: Thread[] = [];
    const targets = [runtime.project.stage, ...runtime.project.sprites];

    for (const target of targets) {
        for (const scriptId of target.blocks.getScripts()) {
            const block = target.blocks.getBlock(scriptId);
            if (!block || block.opcode !== opcode) continue;
            if (!hatMatches(block, match)) continue;

            const existing = restartExisting ?
                runtime.threads.find(t => t.target === target && t.topBlockId === scriptId) :
                undefined;

            if (existing) {
                existing.restart();
                started.push(existing);
            } else {
                const thread = runtime.createThread(scriptId, target);
                started.push(thread);
            }
        }
    }

    return started;
};
