/**
 * AssetLoader.js
 * Browser-only costume image loader. No-op (resolves immediately) in Node.
 *
 * Scratch costumes carry a `file` URL but the engine core never loads them
 * (so it stays DOM-free for headless tests). This helper populates each
 * target's `_images` map (costume name -> HTMLImageElement) so the Renderer
 * can draw real images instead of placeholder rectangles.
 *
 * Clones share the original sprite's `_images` map (see SpriteRuntime), so
 * loading the originals' images is enough for clone-based glyph rendering.
 */

/**
 * Load all costume images referenced by the runtime's targets.
 * @param {Runtime} runtime
 * @param {object}  [opts]
 * @param {string}  [opts.basePath=''] - prepended to each costume.file URL
 * @returns {Promise<void>} resolves when every image has loaded (or failed)
 */
export function loadCostumeImages(runtime, { basePath = '' } = {}) {
  if (typeof Image === 'undefined') return Promise.resolve(); // headless / Node

  const jobs = [];
  for (const target of runtime.targets) {
    for (const costume of target.costumes) {
      if (!costume || !costume.file) continue;
      if (target._images.has(costume.name)) continue; // already loaded
      jobs.push(loadOne(target, costume, basePath));
    }
  }
  return Promise.all(jobs).then(() => undefined);
}

function loadOne(target, costume, basePath) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { target._images.set(costume.name, img); resolve(); };
    img.onerror = () => resolve(); // missing asset → keep placeholder, don't reject
    img.src = basePath + costume.file;
  });
}
