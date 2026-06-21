/**
 * PenCompat.js
 * Pen layer compatibility for Scratch-style drawing.
 * Uses OffscreenCanvas when available; otherwise a fallback canvas.
 */
export class PenCompat {
  constructor() {
    this._penStates = new Map(); // target -> { down, color, size }

    // Create an off-screen canvas for the pen layer
    if (typeof OffscreenCanvas !== 'undefined') {
      this._offscreen = new OffscreenCanvas(480, 360);
    } else if (typeof document !== 'undefined') {
      this._offscreen = document.createElement('canvas');
      this._offscreen.width  = 480;
      this._offscreen.height = 360;
    } else {
      // Headless / Node — null
      this._offscreen = null;
    }

    this._offCtx = this._offscreen
      ? this._offscreen.getContext('2d')
      : null;
  }

  _getState(target) {
    if (!this._penStates.has(target)) {
      this._penStates.set(target, { down: false, color: '#000000', size: 1 });
    }
    return this._penStates.get(target);
  }

  penDown(target) {
    this._getState(target).down = true;
  }

  penUp(target) {
    this._getState(target).down = false;
  }

  setColor(target, color) {
    this._getState(target).color = color;
  }

  setSize(target, n) {
    this._getState(target).size = Math.max(1, Number(n));
  }

  clear() {
    if (this._offCtx) {
      this._offCtx.clearRect(0, 0, 480, 360);
    }
  }

  stamp(target) {
    if (!this._offCtx) return;
    const cx = target.x + 240;
    const cy = 180 - target.y;
    const w = 48 * (target.size / 100);
    const h = 48 * (target.size / 100);
    this._offCtx.fillStyle = '#888';
    this._offCtx.fillRect(cx - w / 2, cy - h / 2, w, h);
  }

  /** Called when a target moves while pen is down. */
  moveTo(target, fromX, fromY, toX, toY) {
    if (!this._offCtx) return;
    const state = this._getState(target);
    if (!state.down) return;

    const ctx = this._offCtx;
    ctx.save();
    ctx.strokeStyle = state.color;
    ctx.lineWidth   = state.size;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(fromX + 240, 180 - fromY);
    ctx.lineTo(toX  + 240, 180 - toY);
    ctx.stroke();
    ctx.restore();
  }

  getLayerCanvas() {
    return this._offscreen;
  }
}
