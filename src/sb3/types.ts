/**
 * Scratch 3.0 `project.json` output shapes. These mirror the official
 * serializer's structure (targets-first, Stage at index 0, compact primitive
 * inputs) closely enough for the official parser/VM to re-load the result.
 * The serializer takes a *validated DSL document* as input and never touches
 * Runtime state, so clones — which only exist at runtime — are never emitted.
 */

export type Sb3PrimitiveValue = string | number | boolean;

/**
 * Compact input primitive: `[type, value]` for literals/colours, or
 * `[type, name, id]` for broadcast/variable/list references. Types follow the
 * official compact codes (4=number … 13=list).
 */
export type Sb3Primitive =
    | [number, Sb3PrimitiveValue]
    | [number, string, string]
    | [number, string, string, number, number];

/** An input value is either a block id (string) or an inlined primitive. */
export type Sb3InputValue = string | Sb3Primitive;

/**
 * Input descriptor: `[1, shadow]` (shadow only), `[2, block]` (block, no
 * shadow), or `[3, block, shadow]` (block obscuring a shadow).
 */
export type Sb3Input =
    | [1, Sb3InputValue]
    | [2, Sb3InputValue]
    | [3, Sb3InputValue, Sb3InputValue];

/** Field descriptor: `[value]` or `[value, id]`. */
export type Sb3Field = [Sb3PrimitiveValue] | [Sb3PrimitiveValue, string | null];

export interface Sb3Block {
    opcode: string;
    next: string | null;
    parent: string | null;
    inputs: Record<string, Sb3Input>;
    fields: Record<string, Sb3Field>;
    shadow: boolean;
    topLevel: boolean;
    x?: number;
    y?: number;
    mutation?: Record<string, unknown>;
    comment?: string;
}

export interface Sb3Comment {
    blockId: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    minimized: boolean;
    text: string;
}

export interface Sb3Costume {
    assetId: string;
    name: string;
    bitmapResolution: number;
    md5ext: string;
    dataFormat: string;
    rotationCenterX: number;
    rotationCenterY: number;
}

export interface Sb3Sound {
    assetId: string;
    name: string;
    dataFormat: string;
    format: string;
    rate: number;
    sampleCount: number;
    md5ext: string;
}

export interface Sb3Target {
    isStage: boolean;
    name: string;
    variables: Record<string, [string, Sb3PrimitiveValue] | [string, Sb3PrimitiveValue, boolean]>;
    lists: Record<string, [string, Sb3PrimitiveValue[]]>;
    broadcasts: Record<string, string>;
    blocks: Record<string, Sb3Block>;
    comments: Record<string, Sb3Comment>;
    currentCostume: number;
    costumes: Sb3Costume[];
    sounds: Sb3Sound[];
    volume: number;
    layerOrder: number;
    // Stage-only
    tempo?: number;
    videoTransparency?: number;
    videoState?: string;
    textToSpeechLanguage?: string | null;
    // Sprite-only
    visible?: boolean;
    x?: number;
    y?: number;
    size?: number;
    direction?: number;
    draggable?: boolean;
    rotationStyle?: string;
}

export interface Sb3Monitor {
    id: string;
    mode: string;
    opcode: string;
    params: Record<string, unknown>;
    spriteName: string | null;
    value: Sb3PrimitiveValue | Sb3PrimitiveValue[];
    width: number;
    height: number;
    x: number;
    y: number;
    visible: boolean;
    sliderMin?: number;
    sliderMax?: number;
    isDiscrete?: boolean;
}

export interface Sb3Meta {
    semver: string;
    vm: string;
    agent: string;
}

export interface Sb3Project {
    targets: Sb3Target[];
    monitors: Sb3Monitor[];
    extensions: string[];
    meta: Sb3Meta;
}
