/**
 * CloneManager.js
 * Creates and destroys Scratch-style sprite clones.
 */
import { SpriteRuntime } from './SpriteRuntime.js';

const MAX_CLONES = 300; // Scratch limit

export class CloneManager {
  constructor(runtime) {
    this._runtime = runtime;
    this._clones = []; // All active clones (across all sprites)
  }

  /**
   * Create a clone of sourceTarget.
   * @param {SpriteRuntime} sourceTarget
   * @returns {SpriteRuntime} the new clone
   */
  createClone(sourceTarget) {
    if (this._clones.length >= MAX_CLONES) return null;

    const def = sourceTarget.createCloneData();
    const clone = new SpriteRuntime(def, this._runtime);

    clone.isClone = true;
    clone.isOriginal = false;

    // Inherit layer order just above source
    clone.layerOrder = sourceTarget.layerOrder + 0.5;

    // Register in runtime targets
    this._runtime.targets.push(clone);
    this._clones.push(clone);

    // Start clone_start scripts
    for (const script of (def.scripts ?? [])) {
      if (script.event && script.event.type === 'clone_start') {
        this._runtime.threads.startScript(clone, script);
      }
    }

    return clone;
  }

  /**
   * Delete a clone and stop all its threads.
   * @param {SpriteRuntime} cloneTarget
   */
  deleteClone(cloneTarget) {
    if (!cloneTarget.isClone) return;

    // Stop all threads for this clone
    const threads = this._runtime.threads.threadsForTarget(cloneTarget);
    for (const t of threads) {
      this._runtime.threads.stopThread(t);
    }

    // Remove from runtime.targets
    const tIdx = this._runtime.targets.indexOf(cloneTarget);
    if (tIdx >= 0) this._runtime.targets.splice(tIdx, 1);

    // Remove from internal list
    const cIdx = this._clones.indexOf(cloneTarget);
    if (cIdx >= 0) this._clones.splice(cIdx, 1);
  }

  /** Delete all clones for a given sprite name. */
  deleteAllClonesFor(name) {
    const toDelete = this._clones.filter(c => c.name === name);
    for (const c of toDelete) this.deleteClone(c);
  }

  /** Delete all clones (used on greenFlag). */
  deleteAll() {
    const all = this._clones.slice();
    for (const c of all) this.deleteClone(c);
  }

  countFor(name) {
    return this._clones.filter(c => c.name === name).length;
  }

  total() {
    return this._clones.length;
  }
}
