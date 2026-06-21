import type {DrawableState} from './RendererPort.ts';
import type {Skin} from './Skin.ts';

/**
 * Lightweight internal representation combining a target's latest
 * DrawableState snapshot with its assigned Skin (if any). Owned by
 * CanvasRenderer; never exposed across the RendererPort boundary.
 */
export class Drawable {
    state: DrawableState;
    skin: Skin | null;

    constructor(state: DrawableState, skin: Skin | null = null) {
        this.state = state;
        this.skin = skin;
    }
}
