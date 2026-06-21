/**
 * Input.js
 * Browser input handler. Only touches DOM/browser APIs.
 * When canvas is null (headless/Node), operates in no-op mode.
 */

// Physical key -> Scratch key name mapping
const KEY_MAP = {
  ' ': 'space',
  'ArrowUp': 'up arrow',
  'ArrowDown': 'down arrow',
  'ArrowLeft': 'left arrow',
  'ArrowRight': 'right arrow',
  'Enter': 'enter',
  'Escape': 'escape',
  'Backspace': 'backspace',
  'Delete': 'delete',
  'Tab': 'tab',
};

function toScratchKey(e) {
  if (KEY_MAP[e.key]) return KEY_MAP[e.key];
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key.toLowerCase();
}

export class Input {
  /**
   * @param {HTMLCanvasElement|null} canvas
   * @param {object} runtime
   */
  constructor(canvas, runtime) {
    this._canvas = canvas;
    this._runtime = runtime;

    this._keysDown = new Set();
    this._mouseDown = false;
    this._mx = 0; // Scratch coordinates
    this._my = 0;

    this._keyDownCbs = [];
    this._mouseDownCbs = [];

    if (typeof document !== 'undefined' && canvas) {
      this._bindEvents(canvas);
    }
  }

  _bindEvents(canvas) {
    // Keyboard
    document.addEventListener('keydown', (e) => {
      const key = toScratchKey(e);
      this._keysDown.add(key);
      for (const cb of this._keyDownCbs) cb(key);
      // Fire runtime key_pressed hats
      if (this._runtime && typeof this._runtime.pressKey === 'function') {
        this._runtime.pressKey(key);
      }
    });

    document.addEventListener('keyup', (e) => {
      this._keysDown.delete(toScratchKey(e));
    });

    // Mouse
    canvas.addEventListener('mousedown', (e) => {
      this._mouseDown = true;
      this._updateMouse(e, canvas);
      for (const cb of this._mouseDownCbs) cb({ x: this._mx, y: this._my });
    });

    canvas.addEventListener('mouseup', () => {
      this._mouseDown = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      this._updateMouse(e, canvas);
    });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      this._mouseDown = true;
      if (e.touches.length > 0) this._updateTouch(e.touches[0], canvas);
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      this._mouseDown = false;
    });
  }

  _updateMouse(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 480 / rect.width;
    const scaleY = 360 / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    // Convert canvas coords (0..480, 0..360) to Scratch coords (-240..240, -180..180)
    this._mx = cx - 240;
    this._my = 180 - cy;
  }

  _updateTouch(touch, canvas) {
    this._updateMouse(touch, canvas);
  }

  isKeyDown(key) {
    return this._keysDown.has(key);
  }

  isMouseDown() {
    return this._mouseDown;
  }

  mouseX() { return this._mx; }
  mouseY() { return this._my; }

  onKeyDown(cb) { this._keyDownCbs.push(cb); }
  onMouseDown(cb) { this._mouseDownCbs.push(cb); }
}
