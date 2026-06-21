import type {Skin} from './Skin.ts';

/**
 * Minimal bitmap Skin: wraps an already-decoded HTMLImageElement or
 * ImageBitmap plus a rotation center. No asset fetching/decoding —
 * callers (tests, future AssetManager) supply the decoded image directly.
 */
export class BitmapSkin implements Skin {
    readonly rotationCenterX: number;
    readonly rotationCenterY: number;
    private readonly image: HTMLImageElement | ImageBitmap;

    constructor(image: HTMLImageElement | ImageBitmap, rotationCenterX: number, rotationCenterY: number) {
        this.image = image;
        this.rotationCenterX = rotationCenterX;
        this.rotationCenterY = rotationCenterY;
    }

    getImage(): CanvasImageSource | null {
        return this.image;
    }
}
