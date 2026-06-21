import type {DslProject, DslTarget} from '../validation/projectValidator.ts';

/**
 * Phase 6-3 (extensions): collects the extension ids used by a project from
 * its block opcodes. An opcode's category is the segment before the first
 * underscore; only ids that are known non-core extensions (e.g. `pen`) are
 * emitted, preserving first-seen order. Core categories
 * (motion/looks/sound/event/control/sensing/operator/data/procedures/argument)
 * are never extensions.
 */

/** Built-in VM extension ids (the official set; only `pen` is in current scope). */
export const KNOWN_EXTENSIONS = new Set<string>([
    'pen',
    'music',
    'videoSensing',
    'text2speech',
    'translate',
    'makeymakey',
    'microbit',
    'ev3',
    'boost',
    'wedo2',
    'gdxfor',
    'faceSensing'
]);

const extensionIdForOpcode = (opcode: string): string | null => {
    const category = opcode.split('_', 1)[0];
    return KNOWN_EXTENSIONS.has(category) ? category : null;
};

const targets = (project: DslProject): DslTarget[] => [project.stage, ...project.sprites];

export const collectExtensions = (project: DslProject): string[] => {
    const found: string[] = [...project.extensions];
    const seen = new Set(project.extensions);
    for (const target of targets(project)) {
        for (const block of Object.values(target.blocks)) {
            const extensionId = extensionIdForOpcode(block.opcode);
            if (extensionId && !seen.has(extensionId)) {
                seen.add(extensionId);
                found.push(extensionId);
            }
        }
    }
    return found;
};
