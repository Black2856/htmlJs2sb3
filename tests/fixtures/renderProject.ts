import type {DslProject} from '../../src/validation/projectValidator.ts';

/**
 * Minimal project for Phase 3 render-wiring tests: a green-flag-only stage
 * (no body needed — the render test only needs threads to start/finish
 * cleanly) plus two sprites with distinct layerOrder, used to verify that
 * Runtime.tick() forwards stage + sprite DrawableState to a RendererPort in
 * layer order and reflects each sprite's model state (x/y/size/direction/
 * visible/rotationStyle/currentCostume).
 */
export const createRenderProject = (): DslProject => ({
    schemaVersion: '1.0.0',
    project: {
        id: 'render-project',
        name: 'Render fixture project'
    },
    stage: {
        id: 'target-stage',
        isStage: true,
        name: 'Stage',
        variables: [],
        lists: [],
        broadcasts: [],
        blocks: {
            'flag-noop': {
                id: 'flag-noop',
                opcode: 'event_whenflagclicked',
                next: null,
                parent: null,
                inputs: {},
                fields: {},
                shadow: false,
                topLevel: true
            }
        },
        scripts: ['flag-noop'],
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
    sprites: [
        {
            id: 'sprite-back',
            isStage: false,
            name: 'Back',
            variables: [],
            lists: [],
            broadcasts: [],
            blocks: {},
            scripts: [],
            comments: [],
            currentCostume: 0,
            costumes: [],
            sounds: [],
            volume: 100,
            layerOrder: 1,
            visible: true,
            x: -50,
            y: 25,
            size: 80,
            direction: 90,
            draggable: false,
            rotationStyle: 'all around'
        },
        {
            id: 'sprite-front',
            isStage: false,
            name: 'Front',
            variables: [],
            lists: [],
            broadcasts: [],
            blocks: {},
            scripts: [],
            comments: [],
            currentCostume: 0,
            costumes: [],
            sounds: [],
            volume: 100,
            layerOrder: 2,
            visible: true,
            x: 100,
            y: -40,
            size: 100,
            direction: 0,
            draggable: false,
            rotationStyle: "don't rotate"
        }
    ],
    assets: [],
    monitors: [],
    extensions: [],
    meta: {source: 'phase-3-render-test'}
});
