/**
 * StageRuntime.js
 * Extends SpriteRuntime for the Stage target.
 * Adds backdrop switching with event emission.
 */
import { SpriteRuntime } from './SpriteRuntime.js';

export class StageRuntime extends SpriteRuntime {
  constructor(def, runtime) {
    super(def, runtime);

    this.tempo = def.tempo ?? 60;
    this.videoTransparency = def.videoTransparency ?? 50;
    this.videoState = def.videoState ?? 'on';
    this.textToSpeechLanguage = def.textToSpeechLanguage ?? null;
  }

  /**
   * Switch the current backdrop (by name or 1-based number).
   * Fires 'backdrop_switches' on the EventBus so backdrop_switches hats can react.
   */
  switchBackdrop(nameOrNum) {
    const oldIdx = this.currentCostume;

    if (typeof nameOrNum === 'number') {
      const idx = Math.round(nameOrNum) - 1;
      if (idx >= 0 && idx < this.costumes.length) {
        this.currentCostume = idx;
      }
    } else {
      const idx = this.costumes.findIndex(c => c.name === nameOrNum);
      if (idx >= 0) this.currentCostume = idx;
    }

    if (this.currentCostume !== oldIdx) {
      const name = this.getBackdropName();
      this._runtime.switchBackdropNotify(name);
    }
  }

  getBackdropName() {
    const c = this.costumes[this.currentCostume];
    return c ? c.name : '';
  }
}
