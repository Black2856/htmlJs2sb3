import type {DrawableState, RendererPort} from './RendererPort.ts';
import {Drawable} from './Drawable.ts';
import type {Skin} from './Skin.ts';
import {STAGE_WIDTH, STAGE_HEIGHT, scratchToCanvas, directionToRadians} from './coordinates.ts';

const FALLBACK_SIZE = 40;
const FALLBACK_COLORS = ['#6cc04a', '#ff8c1a', '#4a90d9', '#d94a4a', '#a64ad9'];

const fallbackColorFor = (targetId: string): string => {
    let hash = 0;
    for (let i = 0; i < targetId.length; i++) {
        hash = (hash * 31 + targetId.charCodeAt(i)) >>> 0;
    }
    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
};

/** Returns true when `direction` faces left, per SCRATCH_RENDER_SPEC's left-right rotation style (90 < direction < 270 mod 360 faces left of "up"). */
const facesLeft = (direction: number): boolean => {
    const normalized = ((direction % 360) + 360) % 360;
    return normalized > 180;
};

/**
 * Canvas 2D implementation of RendererPort, per SCRATCH_RENDER_SPEC.md.
 * Internal canvas size is fixed at 480x360 regardless of CSS display size
 * (CSS-only zoom; pointer coordinates are normalized back via
 * coordinates.clientToScratch by the input layer, not here).
 */
export class CanvasRenderer implements RendererPort {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly skins = new Map<string, Skin>();
    private readonly lastStates = new Map<string, DrawableState>();
    private lastDrawOrder: string[] = [];

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.canvas.width = STAGE_WIDTH;
        this.canvas.height = STAGE_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('CanvasRenderer requires a 2D rendering context.');
        }
        this.ctx = ctx;
    }

    /** Assigns (or replaces) the Skin used to paint `targetId`'s drawable. */
    registerSkin(targetId: string, skin: Skin): void {
        this.skins.set(targetId, skin);
    }

    renderDrawables(states: DrawableState[]): void {
        this.ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

        const sorted = [...states].sort((a, b) => a.layerOrder - b.layerOrder);
        this.lastDrawOrder = [];
        this.lastStates.clear();

        for (const state of sorted) {
            this.lastStates.set(state.targetId, state);
            if (!state.visible) continue;
            this.lastDrawOrder.push(state.targetId);
            this.drawOne(state);
        }
    }

    /** Introspection: target IDs in the order they were actually painted in the last renderDrawables() call (visible-only). */
    getDrawOrder(): string[] {
        return [...this.lastDrawOrder];
    }

    /** Introspection: the DrawableState last received for `targetId` (including invisible ones), or undefined if never seen. */
    getRenderedState(targetId: string): DrawableState | undefined {
        return this.lastStates.get(targetId);
    }

    private drawOne(state: DrawableState): void {
        const drawable = new Drawable(state, this.skins.get(state.targetId) ?? null);
        const {x: cx, y: cy} = scratchToCanvas(state.x, state.y);
        const scale = state.size / 100;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        let flip = false;
        let rotation = 0;
        if (state.rotationStyle === 'all around') {
            rotation = directionToRadians(state.direction);
        } else if (state.rotationStyle === 'left-right') {
            flip = facesLeft(state.direction);
        }
        // "don't rotate": no rotation, no flip.

        if (flip) this.ctx.scale(-1, 1);
        if (rotation) this.ctx.rotate(rotation);
        this.ctx.scale(scale, scale);

        const image = drawable.skin?.getImage() ?? null;
        if (image) {
            const rcx = drawable.skin!.rotationCenterX;
            const rcy = drawable.skin!.rotationCenterY;
            this.ctx.drawImage(image, -rcx, -rcy);
        } else {
            this.ctx.fillStyle = fallbackColorFor(state.targetId);
            this.ctx.fillRect(-FALLBACK_SIZE / 2, -FALLBACK_SIZE / 2, FALLBACK_SIZE, FALLBACK_SIZE);
        }

        this.ctx.restore();
    }
}
