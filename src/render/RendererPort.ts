/**
 * DOM-independent snapshot of one drawable target's render-relevant state,
 * as collected by Runtime.tick() from the Project model. No Skin/asset data
 * lives here — only the per-target placement state a RendererPort needs to
 * paint a frame.
 */
export interface DrawableState {
    targetId: string;
    isStage: boolean;
    x: number;
    y: number;
    size: number;
    direction: number;
    visible: boolean;
    rotationStyle: 'all around' | 'left-right' | "don't rotate";
    layerOrder: number;
    costumeIndex: number;
}

/**
 * Rendering seam between the headless Runtime and a concrete renderer
 * (e.g. CanvasRenderer). Runtime depends only on this interface, never on
 * any DOM/Canvas implementation, per Phase 3's architecture constraint.
 */
export interface RendererPort {
    renderDrawables(states: DrawableState[]): void;
}
