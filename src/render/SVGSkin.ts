import type {Skin} from './Skin.ts';

/**
 * Minimal SVG Skin: rasterizes an SVG markup string into an HTMLImageElement
 * via a `data:` URL. No sanitization/caching layer (that belongs to a future
 * AssetManager) — this is the smallest implementation that lets tests assign
 * a vector image as a costume image source, per Phase 3 scope.
 */
export class SVGSkin implements Skin {
    readonly rotationCenterX: number;
    readonly rotationCenterY: number;
    private image: HTMLImageElement | null = null;
    private ready = false;

    constructor(svgMarkup: string, rotationCenterX: number, rotationCenterY: number) {
        this.rotationCenterX = rotationCenterX;
        this.rotationCenterY = rotationCenterY;
        const image = new Image();
        image.onload = () => {
            this.ready = true;
        };
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
        this.image = image;
    }

    getImage(): CanvasImageSource | null {
        return this.ready ? this.image : null;
    }
}
