import type {DslBlock, DslProject} from '../../src/validation/projectValidator.ts';

/**
 * Builds a valid DSL project exercising the Phase 2 runtime primitives:
 * - stage script: green flag -> set 'counter' to 0 -> forever { change
 *   counter by 1; wait 1s } (forever/wait/data_changevariableby coverage).
 * - stage script: a `control_repeat` script incrementing 'repeats' 3 times,
 *   guarded by `control_if`/`control_if_else` using a boolean reporter
 *   (`data_listcontainsitem`) so the validator's BOOLEAN-kind input check
 *   passes without needing operator_* opcodes.
 * - stage broadcast sender/receiver pair for event_broadcast and
 *   event_broadcastandwait coverage.
 * - sprite script: control_stop coverage.
 *
 * Each independent behavior lives in its own top-level script so tests can
 * green-flag the whole project and assert on the specific variable/list
 * each script affects, without scripts interfering with each other.
 */
export const createRuntimeProject = (): DslProject => {
    const textShadow = (id: string, parent: string, value: string | number): DslBlock => ({
        id,
        opcode: 'text',
        next: null,
        parent,
        inputs: {},
        fields: {TEXT: {value}},
        shadow: true,
        topLevel: false
    });

    const numberShadow = (id: string, parent: string, value: number): DslBlock => ({
        id,
        opcode: 'math_number',
        next: null,
        parent,
        inputs: {},
        fields: {NUM: {value}},
        shadow: true,
        topLevel: false
    });

    const blocks: Record<string, DslBlock> = {};
    const add = (block: DslBlock): DslBlock => {
        blocks[block.id] = block;
        return block;
    };

    // --- Script A: forever + wait + change-variable-by ---------------------
    add({
        id: 'flag-a',
        opcode: 'event_whenflagclicked',
        next: 'set-counter-zero',
        parent: null,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: true
    });
    add({
        id: 'set-counter-zero',
        opcode: 'data_setvariableto',
        next: 'forever-tick',
        parent: 'flag-a',
        inputs: {VALUE: {block: 'shadow-zero', shadow: 'shadow-zero'}},
        fields: {VARIABLE: {value: 'counter', id: 'var-counter'}},
        shadow: false,
        topLevel: false
    });
    add(textShadow('shadow-zero', 'set-counter-zero', '0'));
    add({
        id: 'forever-tick',
        opcode: 'control_forever',
        next: null,
        parent: 'set-counter-zero',
        inputs: {SUBSTACK: {block: 'change-counter', shadow: null}},
        fields: {},
        shadow: false,
        topLevel: false
    });
    add({
        id: 'change-counter',
        opcode: 'data_changevariableby',
        next: 'wait-1s',
        parent: 'forever-tick',
        inputs: {VALUE: {block: 'shadow-one', shadow: 'shadow-one'}},
        fields: {VARIABLE: {value: 'counter', id: 'var-counter'}},
        shadow: false,
        topLevel: false
    });
    add(numberShadow('shadow-one', 'change-counter', 1));
    add({
        id: 'wait-1s',
        opcode: 'control_wait',
        next: null,
        parent: 'change-counter',
        inputs: {DURATION: {block: 'shadow-wait-duration', shadow: 'shadow-wait-duration'}},
        fields: {},
        shadow: false,
        topLevel: false
    });
    add({
        id: 'shadow-wait-duration',
        opcode: 'math_positive_number',
        next: null,
        parent: 'wait-1s',
        inputs: {},
        fields: {NUM: {value: 1}},
        shadow: true,
        topLevel: false
    });

    // --- Script B: repeat 3 times, incrementing 'repeats' -------------------
    add({
        id: 'flag-b',
        opcode: 'event_whenflagclicked',
        next: 'repeat-three',
        parent: null,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: true
    });
    add({
        id: 'repeat-three',
        opcode: 'control_repeat',
        next: null,
        parent: 'flag-b',
        inputs: {
            TIMES: {block: 'shadow-repeat-times', shadow: 'shadow-repeat-times'},
            SUBSTACK: {block: 'change-repeats', shadow: null}
        },
        fields: {},
        shadow: false,
        topLevel: false
    });
    add({
        id: 'shadow-repeat-times',
        opcode: 'math_whole_number',
        next: null,
        parent: 'repeat-three',
        inputs: {},
        fields: {NUM: {value: 3}},
        shadow: true,
        topLevel: false
    });
    add({
        id: 'change-repeats',
        opcode: 'data_changevariableby',
        next: null,
        parent: 'repeat-three',
        inputs: {VALUE: {block: 'shadow-repeats-one', shadow: 'shadow-repeats-one'}},
        fields: {VARIABLE: {value: 'repeats', id: 'var-repeats'}},
        shadow: false,
        topLevel: false
    });
    add(numberShadow('shadow-repeats-one', 'change-repeats', 1));

    // --- Script C: if / if-else using a boolean reporter --------------------
    // 'flagItems' list contains 'yes'; data_listcontainsitem('yes') => true,
    // data_listcontainsitem('no') => false. Drives if/if-else coverage.
    add({
        id: 'flag-c',
        opcode: 'event_whenflagclicked',
        next: 'if-true',
        parent: null,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: true
    });
    add({
        id: 'if-true',
        opcode: 'control_if',
        next: 'if-else-false',
        parent: 'flag-c',
        inputs: {
            CONDITION: {block: 'contains-yes', shadow: null},
            SUBSTACK: {block: 'set-if-flag', shadow: null}
        },
        fields: {},
        shadow: false,
        topLevel: false
    });
    add({
        id: 'contains-yes',
        opcode: 'data_listcontainsitem',
        next: null,
        parent: 'if-true',
        inputs: {ITEM: {block: 'shadow-yes', shadow: 'shadow-yes'}},
        fields: {LIST: {value: 'flagItems', id: 'list-flag-items'}},
        shadow: false,
        topLevel: false
    });
    add(textShadow('shadow-yes', 'contains-yes', 'yes'));
    add({
        id: 'set-if-flag',
        opcode: 'data_setvariableto',
        next: null,
        parent: 'if-true',
        inputs: {VALUE: {block: 'shadow-if-true', shadow: 'shadow-if-true'}},
        fields: {VARIABLE: {value: 'ifBranch', id: 'var-if-branch'}},
        shadow: false,
        topLevel: false
    });
    add(textShadow('shadow-if-true', 'set-if-flag', 'if-taken'));
    add({
        id: 'if-else-false',
        opcode: 'control_if_else',
        next: null,
        parent: 'if-true',
        inputs: {
            CONDITION: {block: 'contains-no', shadow: null},
            SUBSTACK: {block: 'set-else-then', shadow: null},
            SUBSTACK2: {block: 'set-else-else', shadow: null}
        },
        fields: {},
        shadow: false,
        topLevel: false
    });
    add({
        id: 'contains-no',
        opcode: 'data_listcontainsitem',
        next: null,
        parent: 'if-else-false',
        inputs: {ITEM: {block: 'shadow-no', shadow: 'shadow-no'}},
        fields: {LIST: {value: 'flagItems', id: 'list-flag-items'}},
        shadow: false,
        topLevel: false
    });
    add(textShadow('shadow-no', 'contains-no', 'no'));
    add({
        id: 'set-else-then',
        opcode: 'data_setvariableto',
        next: null,
        parent: 'if-else-false',
        inputs: {VALUE: {block: 'shadow-else-then', shadow: 'shadow-else-then'}},
        fields: {VARIABLE: {value: 'elseBranch', id: 'var-else-branch'}},
        shadow: false,
        topLevel: false
    });
    add(textShadow('shadow-else-then', 'set-else-then', 'then-taken'));
    add({
        id: 'set-else-else',
        opcode: 'data_setvariableto',
        next: null,
        parent: 'if-else-false',
        inputs: {VALUE: {block: 'shadow-else-else', shadow: 'shadow-else-else'}},
        fields: {VARIABLE: {value: 'elseBranch', id: 'var-else-branch'}},
        shadow: false,
        topLevel: false
    });
    add(textShadow('shadow-else-else', 'set-else-else', 'else-taken'));

    // --- Script D: broadcast sender ('ping') ---------------------------------
    add({
        id: 'flag-d',
        opcode: 'event_whenflagclicked',
        next: 'broadcast-ping-block',
        parent: null,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: true
    });
    add({
        id: 'broadcast-ping-block',
        opcode: 'event_broadcast',
        next: null,
        parent: 'flag-d',
        inputs: {BROADCAST_INPUT: {block: 'broadcast-menu-ping', shadow: 'broadcast-menu-ping'}},
        fields: {},
        shadow: false,
        topLevel: false
    });
    add({
        id: 'broadcast-menu-ping',
        opcode: 'event_broadcast_menu',
        next: null,
        parent: 'broadcast-ping-block',
        inputs: {},
        fields: {BROADCAST_OPTION: {value: 'ping', id: 'broadcast-ping'}},
        shadow: true,
        topLevel: false
    });

    // --- Script E: broadcast receiver for 'ping' -----------------------------
    add({
        id: 'receive-ping',
        opcode: 'event_whenbroadcastreceived',
        next: 'set-received',
        parent: null,
        inputs: {},
        fields: {BROADCAST_OPTION: {value: 'ping', id: 'broadcast-ping'}},
        shadow: false,
        topLevel: true
    });
    add({
        id: 'set-received',
        opcode: 'data_setvariableto',
        next: null,
        parent: 'receive-ping',
        inputs: {VALUE: {block: 'shadow-received', shadow: 'shadow-received'}},
        fields: {VARIABLE: {value: 'received', id: 'var-received'}},
        shadow: false,
        topLevel: false
    });
    add(textShadow('shadow-received', 'set-received', 'pong'));

    // --- Script F: broadcast-and-wait against a receiver that waits ---------
    add({
        id: 'flag-f',
        opcode: 'event_whenflagclicked',
        next: 'broadcast-wait',
        parent: null,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: true
    });
    add({
        id: 'broadcast-wait',
        opcode: 'event_broadcastandwait',
        next: 'set-after-wait',
        parent: 'flag-f',
        inputs: {BROADCAST_INPUT: {block: 'broadcast-menu-slow', shadow: 'broadcast-menu-slow'}},
        fields: {},
        shadow: false,
        topLevel: false
    });
    add({
        id: 'broadcast-menu-slow',
        opcode: 'event_broadcast_menu',
        next: null,
        parent: 'broadcast-wait',
        inputs: {},
        fields: {BROADCAST_OPTION: {value: 'slow', id: 'broadcast-slow'}},
        shadow: true,
        topLevel: false
    });
    add({
        id: 'set-after-wait',
        opcode: 'data_setvariableto',
        next: null,
        parent: 'broadcast-wait',
        inputs: {VALUE: {block: 'shadow-after-wait', shadow: 'shadow-after-wait'}},
        fields: {VARIABLE: {value: 'afterWait', id: 'var-after-wait'}},
        shadow: false,
        topLevel: false
    });
    add(textShadow('shadow-after-wait', 'set-after-wait', 'done'));

    add({
        id: 'receive-slow',
        opcode: 'event_whenbroadcastreceived',
        next: 'slow-wait',
        parent: null,
        inputs: {},
        fields: {BROADCAST_OPTION: {value: 'slow', id: 'broadcast-slow'}},
        shadow: false,
        topLevel: true
    });
    add({
        id: 'slow-wait',
        opcode: 'control_wait',
        next: null,
        parent: 'receive-slow',
        inputs: {DURATION: {block: 'shadow-slow-duration', shadow: 'shadow-slow-duration'}},
        fields: {},
        shadow: false,
        topLevel: false
    });
    add({
        id: 'shadow-slow-duration',
        opcode: 'math_positive_number',
        next: null,
        parent: 'slow-wait',
        inputs: {},
        fields: {NUM: {value: 2}},
        shadow: true,
        topLevel: false
    });

    const scripts = [
        'flag-a',
        'flag-b',
        'flag-c',
        'flag-d',
        'receive-ping',
        'flag-f',
        'receive-slow'
    ];

    return {
        schemaVersion: '1.0.0',
        project: {
            id: 'runtime-project',
            name: 'Runtime fixture project'
        },
        stage: {
            id: 'target-stage',
            isStage: true,
            name: 'Stage',
            variables: [
                {id: 'var-counter', name: 'counter', value: 0, isCloud: false},
                {id: 'var-repeats', name: 'repeats', value: 0, isCloud: false},
                {id: 'var-if-branch', name: 'ifBranch', value: '', isCloud: false},
                {id: 'var-else-branch', name: 'elseBranch', value: '', isCloud: false},
                {id: 'var-received', name: 'received', value: '', isCloud: false},
                {id: 'var-after-wait', name: 'afterWait', value: '', isCloud: false}
            ],
            lists: [
                {id: 'list-flag-items', name: 'flagItems', values: ['yes']}
            ],
            broadcasts: [
                {id: 'broadcast-ping', name: 'ping'},
                {id: 'broadcast-slow', name: 'slow'}
            ],
            blocks,
            scripts,
            comments: [],
            currentCostume: 0,
            costumes: [],
            sounds: [],
            volume: 100,
            layerOrder: 0,
            tempo: 60,
            videoTransparency: 50,
            videoState: 'on',
            textToSpeechLanguage: null
        },
        sprites: [],
        assets: [],
        monitors: [],
        extensions: [],
        meta: {source: 'phase-2-runtime-test'}
    };
};

/**
 * Minimal fixture for `control_stop "this script"` coverage: green flag ->
 * repeat 5 { change stopCounter by 1; stop this script }. Without the stop the
 * repeat would run 5 times over 5 ticks (stopCounter=5); the stop ends the
 * thread on the first iteration, so stopCounter stays 1 and the thread is
 * removed. `control_stop` is a cap block (no next), so it sits at the end of
 * the loop body.
 */
export const createStopThisScriptProject = (): DslProject => {
    const blocks: Record<string, DslBlock> = {
        'flag-this': {
            id: 'flag-this',
            opcode: 'event_whenflagclicked',
            next: 'repeat-this',
            parent: null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: true
        },
        'repeat-this': {
            id: 'repeat-this',
            opcode: 'control_repeat',
            next: null,
            parent: 'flag-this',
            inputs: {
                TIMES: {block: 'shadow-this-times', shadow: 'shadow-this-times'},
                SUBSTACK: {block: 'change-this', shadow: null}
            },
            fields: {},
            shadow: false,
            topLevel: false
        },
        'shadow-this-times': {
            id: 'shadow-this-times',
            opcode: 'math_whole_number',
            next: null,
            parent: 'repeat-this',
            inputs: {},
            fields: {NUM: {value: 5}},
            shadow: true,
            topLevel: false
        },
        'change-this': {
            id: 'change-this',
            opcode: 'data_changevariableby',
            next: 'stop-this',
            parent: 'repeat-this',
            inputs: {VALUE: {block: 'shadow-this-one', shadow: 'shadow-this-one'}},
            fields: {VARIABLE: {value: 'stopCounter', id: 'var-stop-counter'}},
            shadow: false,
            topLevel: false
        },
        'shadow-this-one': {
            id: 'shadow-this-one',
            opcode: 'math_number',
            next: null,
            parent: 'change-this',
            inputs: {},
            fields: {NUM: {value: 1}},
            shadow: true,
            topLevel: false
        },
        'stop-this': {
            id: 'stop-this',
            opcode: 'control_stop',
            next: null,
            parent: 'change-this',
            inputs: {},
            fields: {STOP_OPTION: {value: 'this script'}},
            shadow: false,
            topLevel: false
        }
    };

    return {
        schemaVersion: '1.0.0',
        project: {
            id: 'stop-this-project',
            name: 'Stop-this-script fixture project'
        },
        stage: {
            id: 'target-stage',
            isStage: true,
            name: 'Stage',
            variables: [
                {id: 'var-stop-counter', name: 'stopCounter', value: 0, isCloud: false}
            ],
            lists: [],
            broadcasts: [],
            blocks,
            scripts: ['flag-this'],
            comments: [],
            currentCostume: 0,
            costumes: [],
            sounds: [],
            volume: 100,
            layerOrder: 0,
            tempo: 60,
            videoTransparency: 50,
            videoState: 'on',
            textToSpeechLanguage: null
        },
        sprites: [],
        assets: [],
        monitors: [],
        extensions: [],
        meta: {source: 'phase-2-runtime-test'}
    };
};

/**
 * Separate, minimal fixture for `control_stop "all"` coverage. Kept apart
 * from createRuntimeProject() because stopping "all" threads would otherwise
 * wipe out every other script's in-flight forever/wait loops when green-flag
 * runs every top-level script in the same project.
 */
export const createStopAllProject = (): DslProject => {
    const blocks: Record<string, DslBlock> = {
        'flag-stop': {
            id: 'flag-stop',
            opcode: 'event_whenflagclicked',
            next: 'set-before-stop',
            parent: null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: true
        },
        'set-before-stop': {
            id: 'set-before-stop',
            opcode: 'data_setvariableto',
            next: 'stop-all',
            parent: 'flag-stop',
            inputs: {VALUE: {block: 'shadow-before-stop', shadow: 'shadow-before-stop'}},
            fields: {VARIABLE: {value: 'beforeStop', id: 'var-before-stop'}},
            shadow: false,
            topLevel: false
        },
        'shadow-before-stop': {
            id: 'shadow-before-stop',
            opcode: 'text',
            next: null,
            parent: 'set-before-stop',
            inputs: {},
            fields: {TEXT: {value: 'reached'}},
            shadow: true,
            topLevel: false
        },
        'stop-all': {
            id: 'stop-all',
            opcode: 'control_stop',
            next: null,
            parent: 'set-before-stop',
            inputs: {},
            fields: {STOP_OPTION: {value: 'all'}},
            shadow: false,
            topLevel: false
        },
        'flag-other': {
            id: 'flag-other',
            opcode: 'event_whenflagclicked',
            next: 'forever-other',
            parent: null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: true
        },
        'forever-other': {
            id: 'forever-other',
            opcode: 'control_forever',
            next: null,
            parent: 'flag-other',
            inputs: {SUBSTACK: {block: 'change-other', shadow: null}},
            fields: {},
            shadow: false,
            topLevel: false
        },
        'change-other': {
            id: 'change-other',
            opcode: 'data_changevariableby',
            next: null,
            parent: 'forever-other',
            inputs: {VALUE: {block: 'shadow-other-one', shadow: 'shadow-other-one'}},
            fields: {VARIABLE: {value: 'otherCounter', id: 'var-other-counter'}},
            shadow: false,
            topLevel: false
        },
        'shadow-other-one': {
            id: 'shadow-other-one',
            opcode: 'math_number',
            next: null,
            parent: 'change-other',
            inputs: {},
            fields: {NUM: {value: 1}},
            shadow: true,
            topLevel: false
        }
    };

    return {
        schemaVersion: '1.0.0',
        project: {
            id: 'stop-all-project',
            name: 'Stop-all fixture project'
        },
        stage: {
            id: 'target-stage',
            isStage: true,
            name: 'Stage',
            variables: [
                {id: 'var-before-stop', name: 'beforeStop', value: '', isCloud: false},
                {id: 'var-other-counter', name: 'otherCounter', value: 0, isCloud: false}
            ],
            lists: [],
            broadcasts: [],
            blocks,
            scripts: ['flag-stop', 'flag-other'],
            comments: [],
            currentCostume: 0,
            costumes: [],
            sounds: [],
            volume: 100,
            layerOrder: 0,
            tempo: 60,
            videoTransparency: 50,
            videoState: 'on',
            textToSpeechLanguage: null
        },
        sprites: [],
        assets: [],
        monitors: [],
        extensions: [],
        meta: {source: 'phase-2-runtime-test'}
    };
};
