/**
 * Normalizes a DOM `KeyboardEvent.key` value to the Scratch key-name
 * convention used by `event_whenkeypressed` and sensing `key pressed?`.
 * Pure function, no DOM dependency (per SCRATCH_EVENT_SPEC.md "Key / mouse").
 */
export const normalizeKey = (domKey: string): string => {
    switch (domKey) {
        case ' ':
            return 'space';
        case 'ArrowUp':
            return 'up arrow';
        case 'ArrowDown':
            return 'down arrow';
        case 'ArrowLeft':
            return 'left arrow';
        case 'ArrowRight':
            return 'right arrow';
        case 'Enter':
            return 'enter';
        default:
            break;
    }

    if (domKey.length === 1 && /[a-zA-Z]/.test(domKey)) {
        return domKey.toLowerCase();
    }

    if (domKey.length === 1 && /[0-9]/.test(domKey)) {
        return domKey;
    }

    return domKey.toLowerCase();
};
