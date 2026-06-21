import {validateProject, type DslProject} from '../validation/projectValidator.ts';
import {computeMd5} from '../assets/md5.ts';
import {serializeBlocks} from './blockSerializer.ts';
import {collectExtensions} from './extensionCollector.ts';
import type {
    Sb3Comment,
    Sb3Costume,
    Sb3Monitor,
    Sb3Project,
    Sb3Sound,
    Sb3Target
} from './types.ts';

/**
 * Phase 6-1: DSL → Scratch `project.json` serializer. Emits Stage first then
 * sprites (original targets only — clones live solely in Runtime state and are
 * never part of the DSL), with variables/lists/broadcasts/costumes/sounds in
 * the official map/array forms. Block normalization (6-2) and extension
 * collection (6-3) are delegated. No ID (block/variable/list/broadcast) is
 * re-numbered; costume/sound DSL ids are dropped since SB3 keys assets by
 * assetId/md5ext.
 */

type DslStage = DslProject['stage'];
type DslSprite = DslProject['sprites'][number];

const META: Sb3Project['meta'] = {
    semver: '3.0.0',
    // The official SB3 schema requires `meta.vm` to start with a bare
    // `major.minor.patch` semver (optionally followed by `-`); it is not a
    // free-form "name version" string. Mirror the scratch-vm version format.
    vm: '0.2.0',
    agent: ''
};

const serializeVariables = (
    variables: DslStage['variables']
): Sb3Target['variables'] => {
    const out: Sb3Target['variables'] = {};
    for (const variable of variables) {
        out[variable.id] = variable.isCloud
            ? [variable.name, variable.value, true]
            : [variable.name, variable.value];
    }
    return out;
};

const serializeLists = (lists: DslStage['lists']): Sb3Target['lists'] => {
    const out: Sb3Target['lists'] = {};
    for (const list of lists) {
        out[list.id] = [list.name, list.values];
    }
    return out;
};

const serializeBroadcasts = (broadcasts: DslStage['broadcasts']): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const broadcast of broadcasts) {
        out[broadcast.id] = broadcast.name;
    }
    return out;
};

const serializeComments = (comments: DslStage['comments']): Record<string, Sb3Comment> => {
    const out: Record<string, Sb3Comment> = {};
    for (const comment of comments) {
        out[comment.id] = {
            blockId: comment.blockId ?? null,
            x: comment.x,
            y: comment.y,
            width: comment.width,
            height: comment.height,
            minimized: comment.minimized,
            text: comment.text
        };
    }
    return out;
};

// The official SB3 schema requires every target to carry at least one costume
// (`minItems: 1`); a costume-less target is not a state the real Scratch
// GUI/VM can represent (the Stage always has a backdrop). The DSL still allows
// an empty costume list (handy for script-only fixtures), so the serializer
// fills the gap with a single 1x1 SVG placeholder backdrop. Its assetId is the
// real MD5 of the SVG bytes, and the packager always includes those bytes, so
// the archive stays self-consistent (every referenced md5ext is a zip entry).
export const PLACEHOLDER_COSTUME_SVG: Uint8Array = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="2" height="2" viewBox="0 0 2 2"></svg>'
);
const PLACEHOLDER_ASSET_ID = computeMd5(PLACEHOLDER_COSTUME_SVG);
export const PLACEHOLDER_COSTUME_MD5EXT = `${PLACEHOLDER_ASSET_ID}.svg`;

const PLACEHOLDER_COSTUME: Sb3Costume = {
    assetId: PLACEHOLDER_ASSET_ID,
    name: 'costume1',
    bitmapResolution: 1,
    md5ext: PLACEHOLDER_COSTUME_MD5EXT,
    dataFormat: 'svg',
    rotationCenterX: 0,
    rotationCenterY: 0
};

const serializeCostumes = (costumes: DslStage['costumes']): Sb3Costume[] => {
    if (costumes.length === 0) {
        return [PLACEHOLDER_COSTUME];
    }
    return costumes.map(costume => ({
        assetId: costume.assetId,
        name: costume.name,
        bitmapResolution: costume.bitmapResolution,
        md5ext: costume.md5ext,
        dataFormat: costume.dataFormat,
        rotationCenterX: costume.rotationCenterX,
        rotationCenterY: costume.rotationCenterY
    }));
};

const serializeSounds = (sounds: DslStage['sounds']): Sb3Sound[] =>
    sounds.map(sound => ({
        assetId: sound.assetId,
        name: sound.name,
        dataFormat: sound.dataFormat,
        format: sound.format,
        rate: sound.rate,
        sampleCount: sound.sampleCount,
        md5ext: sound.md5ext
    }));

const serializeStage = (stage: DslStage): Sb3Target => ({
    isStage: true,
    name: 'Stage',
    variables: serializeVariables(stage.variables),
    lists: serializeLists(stage.lists),
    broadcasts: serializeBroadcasts(stage.broadcasts),
    blocks: serializeBlocks(stage.blocks),
    comments: serializeComments(stage.comments),
    currentCostume: stage.currentCostume,
    costumes: serializeCostumes(stage.costumes),
    sounds: serializeSounds(stage.sounds),
    volume: stage.volume,
    layerOrder: 0,
    tempo: stage.tempo,
    videoTransparency: stage.videoTransparency,
    videoState: stage.videoState,
    textToSpeechLanguage: stage.textToSpeechLanguage
});

const serializeSprite = (sprite: DslSprite): Sb3Target => ({
    isStage: false,
    name: sprite.name,
    variables: serializeVariables(sprite.variables),
    lists: serializeLists(sprite.lists),
    // Broadcasts are stage-owned in the DSL; sprites always serialize empty.
    broadcasts: {},
    blocks: serializeBlocks(sprite.blocks),
    comments: serializeComments(sprite.comments),
    currentCostume: sprite.currentCostume,
    costumes: serializeCostumes(sprite.costumes),
    sounds: serializeSounds(sprite.sounds),
    volume: sprite.volume,
    layerOrder: sprite.layerOrder,
    visible: sprite.visible,
    x: sprite.x,
    y: sprite.y,
    size: sprite.size,
    direction: sprite.direction,
    draggable: sprite.draggable,
    rotationStyle: sprite.rotationStyle
});

const resolveDataMonitorId = (
    project: DslProject,
    monitor: DslProject['monitors'][number]
): string => {
    const spriteName = monitor.spriteName;
    const target = typeof spriteName === 'string'
        ? project.sprites.find(sprite => sprite.name === spriteName)
        : project.stage;
    const variableName = monitor.params && typeof monitor.params === 'object'
        ? (monitor.params as Record<string, unknown>).VARIABLE
        : undefined;
    const listName = monitor.params && typeof monitor.params === 'object'
        ? (monitor.params as Record<string, unknown>).LIST
        : undefined;

    if (monitor.opcode === 'data_variable' && typeof variableName === 'string') {
        return target?.variables.find(variable => variable.name === variableName)?.id
            ?? project.stage.variables.find(variable => variable.name === variableName)?.id
            ?? monitor.id;
    }
    if (monitor.opcode === 'data_listcontents' && typeof listName === 'string') {
        return target?.lists.find(list => list.name === listName)?.id
            ?? project.stage.lists.find(list => list.name === listName)?.id
            ?? monitor.id;
    }
    return monitor.id;
};

const serializeMonitor = (
    project: DslProject,
    monitor: DslProject['monitors'][number]
): Sb3Monitor => {
    const read = <T>(key: string, fallback: T): T =>
        (monitor[key] === undefined ? fallback : (monitor[key] as T));
    return {
        id: resolveDataMonitorId(project, monitor),
        mode: read('mode', 'default'),
        opcode: monitor.opcode,
        params: read('params', {} as Record<string, unknown>),
        spriteName: read('spriteName', null),
        value: read('value', 0),
        width: read('width', 0),
        height: read('height', 0),
        x: read('x', 0),
        y: read('y', 0),
        visible: monitor.visible,
        sliderMin: read('sliderMin', 0),
        sliderMax: read('sliderMax', 100),
        isDiscrete: read('isDiscrete', true)
    };
};

export const serializeProject = (project: DslProject): Sb3Project => {
    const validation = validateProject(project);
    if (!validation.valid) {
        const errors = validation.diagnostics
            .filter(diagnostic => diagnostic.severity === 'error')
            .map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`);
        throw new Error(`Cannot serialize invalid DSL project:\n${errors.join('\n')}`);
    }
    return {
        targets: [serializeStage(project.stage), ...project.sprites.map(serializeSprite)],
        monitors: project.monitors.map(monitor => serializeMonitor(project, monitor)),
        extensions: collectExtensions(project),
        meta: META
    };
};
