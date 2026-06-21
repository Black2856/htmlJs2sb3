/**
 * SoundBridge.js
 * Web Audio bridge. Only touches AudioContext / browser audio APIs.
 * Falls back silently when AudioContext is unavailable (Node environment).
 */
export class SoundBridge {
  constructor() {
    this._ctx = null;
    this._buffers = new Map(); // name -> AudioBuffer
    this._masterGain = null;
    this._activeNodes = [];

    if (typeof AudioContext !== 'undefined') {
      try {
        this._ctx = new AudioContext();
        this._masterGain = this._ctx.createGain();
        this._masterGain.connect(this._ctx.destination);
      } catch (e) {
        this._ctx = null;
      }
    } else if (typeof webkitAudioContext !== 'undefined') {
      try {
        // eslint-disable-next-line no-undef
        this._ctx = new webkitAudioContext();
        this._masterGain = this._ctx.createGain();
        this._masterGain.connect(this._ctx.destination);
      } catch (e) {
        this._ctx = null;
      }
    }
  }

  get audioContext() {
    return this._ctx;
  }

  now() {
    if (this._ctx) return this._ctx.currentTime;
    if (typeof performance !== 'undefined') return performance.now() / 1000;
    return Date.now() / 1000;
  }

  /**
   * Load and decode an audio file.
   * @param {string} name - identifier
   * @param {string} url - fetch URL
   * @returns {Promise<AudioBuffer|null>}
   */
  async loadSound(name, url) {
    if (!this._ctx) return null;
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const decoded = await this._ctx.decodeAudioData(buf);
      this._buffers.set(name, decoded);
      return decoded;
    } catch (e) {
      // Silently fail — asset may not exist in test environments
      return null;
    }
  }

  /**
   * Load multiple sounds.
   * @param {Array<{name:string,url:string}>} list
   */
  async loadAll(list) {
    await Promise.all(list.map(({ name, url }) => this.loadSound(name, url)));
  }

  /**
   * Play a sound asynchronously.
   * @param {string} name
   * @param {{volume?:number, when?:number, rate?:number, onended?:Function}} opts
   * @returns {object} handle with stop()
   */
  play(name, opts = {}) {
    if (!this._ctx) return { stop: () => {} };

    const buf = this._buffers.get(name);
    if (!buf) return { stop: () => {} };

    const src = this._ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;

    const gainNode = this._ctx.createGain();
    const vol = opts.volume != null ? opts.volume / 100 : 1;
    gainNode.gain.value = vol;

    src.connect(gainNode);
    gainNode.connect(this._masterGain ?? this._ctx.destination);

    if (opts.onended) src.onended = opts.onended;

    const when = opts.when ?? 0;
    src.start(when);

    const handle = {
      stop: () => { try { src.stop(); } catch (_) {} },
      source: src,
    };
    this._activeNodes.push(handle);
    src.onended = () => {
      const idx = this._activeNodes.indexOf(handle);
      if (idx >= 0) this._activeNodes.splice(idx, 1);
      if (opts.onended) opts.onended();
    };

    return handle;
  }

  /**
   * Play a sound and return a Promise that resolves when playback ends.
   */
  playUntilDone(name, opts = {}) {
    if (!this._ctx) return Promise.resolve();

    return new Promise((resolve) => {
      this.play(name, { ...opts, onended: resolve });
    });
  }

  stopAll() {
    for (const handle of this._activeNodes) {
      handle.stop();
    }
    this._activeNodes = [];
  }

  /** Set master volume (0-1). */
  setMasterVolume(v) {
    if (this._masterGain) {
      this._masterGain.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  /**
   * Schedule BGM to start at a precise audio context time.
   * @param {string} name
   * @param {number} whenAtContextTime
   * @returns {{ startContextTime: number }}
   */
  scheduleBgm(name, whenAtContextTime) {
    this.play(name, { when: whenAtContextTime });
    return { startContextTime: whenAtContextTime };
  }

  getOutputTimestamp() {
    if (this._ctx && this._ctx.getOutputTimestamp) {
      return this._ctx.getOutputTimestamp();
    }
    return {
      contextTime: this.now(),
      performanceTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
  }

  audioTimeToPerf(audioTime) {
    const ts = this.getOutputTimestamp();
    const diffSecs = audioTime - ts.contextTime;
    return ts.performanceTime + diffSecs * 1000;
  }
}
