/**
 * DebugOverlay.js
 * デバッグ情報をcanvas上にオーバーレイ描画する。
 */

const MAX_EVENTS = 20;
const MAX_ERRORS = 100;

export class DebugOverlay {
  /**
   * @param {import('../engine/Runtime.js').Runtime} runtime
   * @param {object} game - RhythmGame インスタンス
   */
  constructor(runtime, game) {
    this._runtime = runtime;
    this._game = game;
    this._visible = false;

    this._eventLog = [];   // 直近イベントログ文字列
    this._hitErrors = [];  // { ms: number, result: string }[]

    // FPS計測
    this._frameTimes = [];
    this._lastFrameTime = null;
  }

  /** オーバーレイ表示をトグル。 */
  toggle() {
    this._visible = !this._visible;
  }

  get visible() { return this._visible; }

  /**
   * イベントをログに追加。
   * @param {string} text
   */
  logEvent(text) {
    this._eventLog.unshift(`${this._timeStamp()} ${text}`);
    if (this._eventLog.length > MAX_EVENTS) {
      this._eventLog.length = MAX_EVENTS;
    }
  }

  /**
   * ヒットエラーを記録（散布図用）。
   * @param {number} ms - hitErrorMs
   * @param {string} result - 'perfect'|'great'|'good'|'miss'
   */
  logHitError(ms, result) {
    this._hitErrors.push({ ms, result });
    if (this._hitErrors.length > MAX_ERRORS) {
      this._hitErrors.shift();
    }
  }

  /**
   * FPS更新。
   * @param {number} now - performance.now()
   */
  _updateFps(now) {
    if (this._lastFrameTime != null) {
      this._frameTimes.push(now - this._lastFrameTime);
      if (this._frameTimes.length > 60) this._frameTimes.shift();
    }
    this._lastFrameTime = now;
  }

  _getFps() {
    if (this._frameTimes.length === 0) return 0;
    const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
    return avg > 0 ? Math.round(1000 / avg) : 0;
  }

  _timeStamp() {
    const t = this._game ? this._game.songTimeMs() : 0;
    return `[${(t / 1000).toFixed(2)}s]`;
  }

  /**
   * デバッグオーバーレイを描画する。
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (!this._visible) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._updateFps(now);

    const runtime = this._runtime;
    const sound = runtime ? runtime.sound : null;

    // AudioContext vs performance.now のズレ
    let audioDriftMs = 0;
    if (sound) {
      const ts = sound.getOutputTimestamp();
      audioDriftMs = Math.round(ts.performanceTime - now);
    }

    // Clone数
    const totalClones = runtime ? runtime.clones.total() : 0;
    const activeClones = this._game && this._game._spawner
      ? this._game._spawner.activeNotes.length
      : totalClones;

    ctx.save();

    // 半透明背景
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 480, 360);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#0f0';
    ctx.textAlign = 'left';

    let y = 14;
    const line = (text) => {
      ctx.fillText(text, 4, y);
      y += 12;
    };

    line(`FPS: ${this._getFps()}`);
    line(`Clones total: ${totalClones}  active: ${activeClones}`);
    line(`Audio drift: ${audioDriftMs}ms`);
    if (this._game) {
      const st = this._game.state;
      line(`Score: ${st.score}  Combo: ${st.combo}/${st.maxCombo}`);
      line(`P:${st.counts.perfect} Gr:${st.counts.great} Go:${st.counts.good} Ms:${st.counts.miss}`);
      line(`SongTime: ${(this._game.songTimeMs() / 1000).toFixed(3)}s`);
    }

    // hitError 散布図
    y += 4;
    line('--- HitError Scatter ---');
    const scatterX = 4;
    const scatterY = y;
    const scatterW = 200;
    const scatterH = 30;
    ctx.strokeStyle = '#444';
    ctx.strokeRect(scatterX, scatterY, scatterW, scatterH);

    // 中央線（±0ms）
    ctx.strokeStyle = '#666';
    ctx.beginPath();
    ctx.moveTo(scatterX + scatterW / 2, scatterY);
    ctx.lineTo(scatterX + scatterW / 2, scatterY + scatterH);
    ctx.stroke();

    const COLOR_MAP = {
      perfect: '#ff0',
      great:   '#0ff',
      good:    '#0f0',
      miss:    '#f00',
    };

    for (const { ms, result } of this._hitErrors) {
      // ±200ms をスケール
      const norm = Math.max(-1, Math.min(1, ms / 200));
      const px = scatterX + (norm + 1) / 2 * scatterW;
      const py = scatterY + scatterH / 2 + (Math.random() - 0.5) * (scatterH - 6);
      ctx.fillStyle = COLOR_MAP[result] ?? '#fff';
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }

    y += scatterH + 6;

    // 直近イベントログ
    line('--- Event Log ---');
    ctx.fillStyle = '#aaa';
    for (const ev of this._eventLog.slice(0, 8)) {
      line(ev);
    }

    // リストダンプ（Stage の judgeLog など）
    if (runtime && runtime.stage) {
      ctx.fillStyle = '#8af';
      y += 4;
      line('--- Stage Lists ---');
      for (const name of runtime.stage.lists.names()) {
        const arr = runtime.stage.lists.get(name);
        line(`${name}[${arr.length}]: ${JSON.stringify(arr.slice(0, 4))}${arr.length > 4 ? '...' : ''}`);
      }
    }

    ctx.restore();
  }
}
