/**
 * Browser-only rendering surface for a single costume. Mirrors the official
 * scratch-render Skin contract in minimal form: a drawable image plus the
 * rotation center used to align the sprite's "hot spot" with its
 * Scratch-space position. No asset decoding/caching lives here (no
 * AssetManager) — concrete Skin implementations accept already-decoded
 * image sources directly, per Phase 3 scope.
 */
export interface Skin {
    readonly rotationCenterX: number;
    readonly rotationCenterY: number;

    /** Returns the current drawable image source, or null if not yet ready. */
    getImage(): CanvasImageSource | null;
}
