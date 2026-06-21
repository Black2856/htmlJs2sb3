/**
 * Runtime.js
 * Central orchestrator for the Scratch-compatible engine.
 * Coordinates: ThreadRunner, Renderer, Input, SoundBridge, CloneManager, EventBus.
 */
import { StageRuntime }  from './StageRuntime.js';
import { SpriteRuntime } from './SpriteRuntime.js';
import { ThreadRunner }  from './ThreadRunner.js';
import { Renderer }      from './Renderer.js';
import { Input }         from './Input.js';
import { SoundBridge }   from './SoundBridge.js';
import { CloneManager }  from './CloneManager.js';
import { EventBus }      from './EventBus.js';
import { PenCompat }     from './PenCompat.js';

export class Runtime {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement|null} opts.canvas
   * @param {SoundBridge|null}      opts.soundBridge - optional custom sound bridge
   */
  constructor({ canvas = null, soundBridge = null } = {}) {
    this._canvas = canvas;

    // Core subsystems
    this.events   = new EventBus();
    this.sound    = soundBridge ?? new SoundBridge();
    this.input    = new Input(canvas, this);
    this.renderer = new Renderer(canvas);
    this.pen      = new PenCompat();

    // Will be populated by loadProject
    this.targets = []; // [stage, ...sprites, ...clones]
    this.stage   = null;

    this.threads = new ThreadRunner(this);
    this.clones  = new CloneManager(this);

    // Timer
    this.timerStart = this._now();

    // ask/answer
    this._answer = '';

    // RAF loop
    this._rafId = null;
    this._running = false;
  }

  // ─── Time helpers ────────────────────────────────────────────────────

  _now() {
    if (typeof performance !== 'undefined') return performance.now();
    return Date.now();
  }

  getTimer() {
    return (this._now() - this.timerStart) / 1000;
  }

  // ─── Project loading ──────────────────────────────────────────────────

  loadProject(dsl) {
    this.targets = [];

    // Build Stage
    const stageDef = dsl.stage ?? {};
    this.stage = new StageRuntime(stageDef, this);
    this.stage.layerOrder = 0;
    this.targets.push(this.stage);

    // Build sprites
    let layerIdx = 1;
    for (const spriteDef of (dsl.sprites ?? [])) {
      const sprite = new SpriteRuntime(spriteDef, this);
      sprite.layerOrder = layerIdx++;
      this.targets.push(sprite);
    }
  }

  // ─── Broadcast helpers ────────────────────────────────────────────────

  /**
   * Start all receive-hat threads for a broadcast name.
   * Returns the started Thread objects (used by broadcastAndWait).
   */
  _startBroadcastThreads(name) {
    const started = [];
    for (const target of this.targets) {
      for (const script of (target._def.scripts ?? [])) {
        if (script.event && script.event.type === 'receive' && script.event.name === name) {
          const thread = this.threads.startScript(target, script);
          started.push(thread);
        }
      }
    }
    return started;
  }

  // ─── Public control API ───────────────────────────────────────────────

  greenFlag() {
    // Stop everything
    this.threads.stopAll();
    this.clones.deleteAll();

    // Reset timer
    this.timerStart = this._now();

    // Start all green_flag hat scripts
    for (const target of this.targets) {
      for (const script of (target._def.scripts ?? [])) {
        if (script.event && script.event.type === 'green_flag') {
          this.threads.startScript(target, script);
        }
      }
    }
  }

  /** Fire broadcast (non-waiting). */
  broadcast(name) {
    this._startBroadcastThreads(name);
  }

  /** Fire backdrop_switches event and start matching hats. */
  switchBackdropNotify(name) {
    this.events.emit('backdrop_switches', { name });
    for (const target of this.targets) {
      for (const script of (target._def.scripts ?? [])) {
        if (script.event && script.event.type === 'backdrop_switches' && script.event.name === name) {
          this.threads.startScript(target, script);
        }
      }
    }
  }

  /** Fire key_pressed event and start matching hats. */
  pressKey(key) {
    this.events.emit('key_pressed', { key });
    for (const target of this.targets) {
      for (const script of (target._def.scripts ?? [])) {
        if (script.event && script.event.type === 'key_pressed' && script.event.key === key) {
          this.threads.startScript(target, script);
        }
      }
    }
  }

  /** Fire sprite_clicked event. */
  clickSprite(target) {
    this.events.emit('sprite_clicked', { target });
    for (const script of (target._def.scripts ?? [])) {
      if (script.event && script.event.type === 'sprite_clicked') {
        this.threads.startScript(target, script);
      }
    }
  }

  // ─── Tick loop ────────────────────────────────────────────────────────

  startTick() {
    if (this._running) return;
    this._running = true;
    this._tick();
  }

  _tick() {
    if (!this._running) return;

    this.stepFrame();

    if (typeof requestAnimationFrame !== 'undefined') {
      this._rafId = requestAnimationFrame(() => this._tick());
    }
  }

  stop() {
    this._running = false;
    if (typeof cancelAnimationFrame !== 'undefined' && this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Advance simulation by one frame.
   * Safe to call from Node (no RAF dependency).
   */
  stepFrame() {
    this._timerNow = this._now();
    this.threads.stepThreads();

    // Render if we have a canvas
    if (this._canvas) {
      this.renderer.render(this);
    }
  }

  // ─── Lookup ──────────────────────────────────────────────────────────

  getTargetByName(name) {
    // Search originals first, then clones
    return this.targets.find(t => t.name === name) ?? null;
  }

  answer(str) {
    this._answer = str;
  }
}
