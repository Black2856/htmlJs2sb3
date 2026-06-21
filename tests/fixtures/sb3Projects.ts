import type {DslBlock, DslProject} from '../../src/validation/projectValidator.ts';
import {computeMd5} from '../../src/assets/md5.ts';

/**
 * Phase 6 fixtures for the SB3 serializer/packager and the official-parser
 * compatibility test. Asset ids are 32-char hex (the form the official SB3
 * schema expects), and monitor ids are kept distinct from variable ids (the
 * DSL validator treats all ids in one namespace, unlike SB3 where a variable
 * monitor's id equals the variable id).
 */

const COSTUME_BYTES = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'
);
const SOUND_BYTES = new Uint8Array(44);
const COSTUME_ASSET_ID = computeMd5(COSTUME_BYTES);
const SOUND_ASSET_ID = computeMd5(SOUND_BYTES);

const textShadow = (id: string, parent: string, value: string): DslBlock => ({
    id, opcode: 'text', next: null, parent, inputs: {},
    fields: {TEXT: {value}}, shadow: true, topLevel: false
});

const numberShadow = (id: string, parent: string, value: number): DslBlock => ({
    id, opcode: 'math_number', next: null, parent, inputs: {},
    fields: {NUM: {value}}, shadow: true, topLevel: false
});

const costume = () => ({
    id: 'costume-cat',
    name: 'cat',
    assetId: COSTUME_ASSET_ID,
    dataFormat: 'svg',
    md5ext: `${COSTUME_ASSET_ID}.svg`,
    bitmapResolution: 1,
    rotationCenterX: 0,
    rotationCenterY: 0
});

const sound = () => ({
    id: 'sound-pop',
    name: 'pop',
    assetId: SOUND_ASSET_ID,
    dataFormat: 'wav',
    md5ext: `${SOUND_ASSET_ID}.wav`,
    format: '',
    rate: 48000,
    sampleCount: 1024
});

const projectAssets = () => [
    {id: COSTUME_ASSET_ID, kind: 'costume' as const, dataFormat: 'svg', md5ext: `${COSTUME_ASSET_ID}.svg`},
    {id: SOUND_ASSET_ID, kind: 'sound' as const, dataFormat: 'wav', md5ext: `${SOUND_ASSET_ID}.wav`}
];

/** Dummy file bytes (keyed by md5ext) for every asset the project references. */
export const assetBytesFor = (project: DslProject): Map<string, Uint8Array> => {
    const bytes = new Map<string, Uint8Array>();
    for (const asset of project.assets) {
        if (asset.dataFormat === 'svg') {
            bytes.set(asset.md5ext, COSTUME_BYTES);
        } else {
            // Minimal 44-byte WAV header placeholder.
            bytes.set(asset.md5ext, SOUND_BYTES);
        }
    }
    return bytes;
};

/** Minimal sprite bearing one costume + one sound asset (no scripts). */
export const createAssetProject = (): DslProject => ({
    schemaVersion: '1.0.0',
    project: {id: 'sb3-asset-project', name: 'SB3 asset fixture'},
    stage: {
        id: 'target-stage', isStage: true, name: 'Stage',
        variables: [], lists: [], broadcasts: [], blocks: {}, scripts: [],
        comments: [], currentCostume: 0, costumes: [], sounds: [],
        volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50,
        videoState: 'on', textToSpeechLanguage: null
    },
    sprites: [{
        id: 'sprite-cat', isStage: false, name: 'Cat',
        variables: [], lists: [], broadcasts: [], blocks: {}, scripts: [],
        comments: [], currentCostume: 0, costumes: [costume()], sounds: [sound()],
        volume: 100, layerOrder: 1, visible: true, x: 0, y: 0, size: 100,
        direction: 90, draggable: false, rotationStyle: 'all around'
    }],
    assets: projectAssets(),
    monitors: [],
    extensions: [],
    meta: {source: 'phase-6-test'}
});

/**
 * Full-feature project: variable + list + broadcast + custom procedure +
 * monitor on the Stage, plus a pen-using sprite carrying a costume and sound
 * asset. Exercises every facet the SB3 compatibility test must cover.
 */
export const createFullFeatureProject = (): DslProject => {
    const stageBlocks: Record<string, DslBlock> = {};
    const add = (block: DslBlock) => { stageBlocks[block.id] = block; };

    add({
        id: 'flag-main', opcode: 'event_whenflagclicked', next: 'set-score',
        parent: null, inputs: {}, fields: {}, shadow: false, topLevel: true, x: 0, y: 0
    });
    add({
        id: 'set-score', opcode: 'data_setvariableto', next: 'add-item', parent: 'flag-main',
        inputs: {VALUE: {block: 'score-text', shadow: 'score-text'}},
        fields: {VARIABLE: {value: 'score', id: 'var-score'}}, shadow: false, topLevel: false
    });
    add(textShadow('score-text', 'set-score', '5'));
    add({
        id: 'add-item', opcode: 'data_addtolist', next: 'show-score', parent: 'set-score',
        inputs: {ITEM: {block: 'item-text', shadow: 'item-text'}},
        fields: {LIST: {value: 'items', id: 'list-items'}}, shadow: false, topLevel: false
    });
    add(textShadow('item-text', 'add-item', 'x'));
    add({
        id: 'show-score', opcode: 'data_showvariable', next: 'broadcast-go', parent: 'add-item',
        inputs: {}, fields: {VARIABLE: {value: 'score', id: 'var-score'}}, shadow: false, topLevel: false
    });
    add({
        id: 'broadcast-go', opcode: 'event_broadcast', next: 'pen-clear-main', parent: 'show-score',
        inputs: {BROADCAST_INPUT: {block: 'bcast-menu', shadow: 'bcast-menu'}},
        fields: {}, shadow: false, topLevel: false
    });
    add({
        id: 'bcast-menu', opcode: 'event_broadcast_menu', next: null, parent: 'broadcast-go',
        inputs: {}, fields: {BROADCAST_OPTION: {value: 'go', id: 'bcast-go'}}, shadow: true, topLevel: false
    });
    add({
        id: 'pen-clear-main', opcode: 'pen_clear', next: null, parent: 'broadcast-go',
        inputs: {}, fields: {}, shadow: false, topLevel: false
    });

    add({
        id: 'recv-go', opcode: 'event_whenbroadcastreceived', next: 'change-score', parent: null,
        inputs: {}, fields: {BROADCAST_OPTION: {value: 'go', id: 'bcast-go'}},
        shadow: false, topLevel: true, x: 0, y: 200
    });
    add({
        id: 'change-score', opcode: 'data_changevariableby', next: null, parent: 'recv-go',
        inputs: {VALUE: {block: 'change-one', shadow: 'change-one'}},
        fields: {VARIABLE: {value: 'score', id: 'var-score'}}, shadow: false, topLevel: false
    });
    add(numberShadow('change-one', 'change-score', 1));

    add({
        id: 'proc-def', opcode: 'procedures_definition', next: 'proc-body', parent: null,
        inputs: {custom_block: {block: 'proc-proto', shadow: 'proc-proto'}},
        fields: {}, shadow: false, topLevel: true, x: 0, y: 400
    });
    add({
        id: 'proc-proto', opcode: 'procedures_prototype', next: null, parent: 'proc-def',
        inputs: {}, fields: {}, shadow: true, topLevel: false,
        mutation: {
            tagName: 'mutation', children: [], proccode: 'log %s',
            argumentids: JSON.stringify(['arg-msg']),
            argumentnames: JSON.stringify(['msg']),
            argumentdefaults: JSON.stringify(['']),
            warp: 'false'
        }
    });
    add({
        id: 'proc-body', opcode: 'data_setvariableto', next: null, parent: 'proc-def',
        inputs: {VALUE: {block: 'read-msg', shadow: null}},
        fields: {VARIABLE: {value: 'score', id: 'var-score'}}, shadow: false, topLevel: false
    });
    add({
        id: 'read-msg', opcode: 'argument_reporter_string_number', next: null, parent: 'proc-body',
        inputs: {}, fields: {VALUE: {value: 'msg'}}, shadow: false, topLevel: false
    });

    add({
        id: 'flag-call', opcode: 'event_whenflagclicked', next: 'call-proc', parent: null,
        inputs: {}, fields: {}, shadow: false, topLevel: true, x: 0, y: 600
    });
    add({
        id: 'call-proc', opcode: 'procedures_call', next: null, parent: 'flag-call',
        inputs: {'arg-msg': {block: 'call-text', shadow: 'call-text'}}, fields: {},
        shadow: false, topLevel: false,
        mutation: {
            tagName: 'mutation', children: [], proccode: 'log %s',
            argumentids: JSON.stringify(['arg-msg']), warp: 'false'
        }
    });
    add(textShadow('call-text', 'call-proc', 'hello'));

    const catBlocks: Record<string, DslBlock> = {
        'flag-cat': {
            id: 'flag-cat', opcode: 'event_whenflagclicked', next: 'pen-down-cat', parent: null,
            inputs: {}, fields: {}, shadow: false, topLevel: true, x: 0, y: 0
        },
        'pen-down-cat': {
            id: 'pen-down-cat', opcode: 'pen_penDown', next: null, parent: 'flag-cat',
            inputs: {}, fields: {}, shadow: false, topLevel: false
        }
    };

    return {
        schemaVersion: '1.0.0',
        project: {id: 'sb3-full-project', name: 'SB3 full-feature fixture'},
        stage: {
            id: 'target-stage', isStage: true, name: 'Stage',
            variables: [{id: 'var-score', name: 'score', value: 0, isCloud: false}],
            lists: [{id: 'list-items', name: 'items', values: []}],
            broadcasts: [{id: 'bcast-go', name: 'go'}],
            blocks: stageBlocks,
            scripts: ['flag-main', 'recv-go', 'proc-def', 'flag-call'],
            comments: [], currentCostume: 0, costumes: [], sounds: [],
            volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50,
            videoState: 'on', textToSpeechLanguage: null
        },
        sprites: [{
            id: 'sprite-cat', isStage: false, name: 'Cat',
            variables: [], lists: [], broadcasts: [], blocks: catBlocks, scripts: ['flag-cat'],
            comments: [], currentCostume: 0, costumes: [costume()], sounds: [sound()],
            volume: 100, layerOrder: 1, visible: true, x: 0, y: 0, size: 100,
            direction: 90, draggable: false, rotationStyle: 'all around'
        }],
        assets: projectAssets(),
        monitors: [{
            id: 'monitor-score', opcode: 'data_variable', visible: true,
            mode: 'default', params: {VARIABLE: 'score'}, spriteName: null,
            value: 0, width: 0, height: 0, x: 5, y: 5,
            sliderMin: 0, sliderMax: 100, isDiscrete: true
        }],
        extensions: ['pen'],
        meta: {source: 'phase-6-test'}
    };
};
