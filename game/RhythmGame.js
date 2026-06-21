/**
 * RhythmGame.js
 * 音ゲーのメインコントローラ。
 * engine の Runtime を使い、NoteSpawner・JudgeSystem・DebugOverlay を統合する。
 */

import { Runtime }     from '../engine/Runtime.js';
import { SoundBridge } from '../engine/SoundBridge.js';
import { ChartLoader } from './ChartLoader.js';
import { JudgeSystem } from './JudgeSystem.js';
import { NoteSpawner } from './NoteSpawner.js';
import { DebugOverlay } from './DebugOverlay.js';

// スコア配点
const SCORE_TABLE = {
  perfect: 300,
  great:   200,
  good:    100,
  miss:    0,
};

// レーン既定キー
const DEFAULT_LANE_KEYS = ['d', 'f', 'j', 'k'];

export class RhythmGame {
  /**
   * @param {{
   *   canvas: HTMLCanvasElement,
   *   dsl: object,
   *   chart: object,
   *   config?: object,
   * }} opts
   */
  constructor({ canvas, dsl, chart, config = {} }) {
    this._canvas = canvas;
    this._dsl = dsl;
    this._chart = chart;
    this._config = config;

    // ゲーム状態
    this.state = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    };

    // Autoモード
    this._auto = config.auto ?? false;

    // BGM タイミング管理
    this._bgmStartContextTime = null;  // AudioContext時刻（秒）
    this._startPerfNow = null;         // performance.now() 時刻（ms）

    // サブシステム（init()後に有効）
    this._runtime  = null;
    this._judge    = null;
    this._spawner  = null;
    this._overlay  = null;

    // ヒットエフェクト表示リスト
    // [{ x, y, result, timeMs, born }]
    this._effects = [];

    // オートプレイ用：次に自動ヒットするノーツindex
    this._autoScheduled = new Set();
  }

  // ── 初期化 ────────────────────────────────────────────────────────────

  /**
   * Runtime・SoundBridge・ChartLoader・JudgeSystem・NoteSpawner を構築。
   */
  async init() {
    const soundBridge = new SoundBridge();
    this._runtime = new Runtime({ canvas: this._canvas, soundBridge });

    // DSL読み込み（Note スプライトを含む）
    this._runtime.loadProject(this._dsl);

    // 譜面のlane検証
    const chart = this._chart;

    // JudgeSystem
    const timing = chart.timing ?? {};
    this._judge = new JudgeSystem({
      perfectMs: timing.perfectMs ?? 40,
      greatMs:   timing.greatMs   ?? 80,
      goodMs:    timing.goodMs    ?? 120,
    });

    // offsetMs を chart から設定
    const chartOffsetMs = (chart.meta && chart.meta.offsetMs) ? chart.meta.offsetMs : 0;
    this._judge.setOffsets({ chartOffsetMs });

    // NoteSpawner
    const laneX = [
      this._config.laneX0 ?? -90,
      this._config.laneX1 ?? -30,
      this._config.laneX2 ??  30,
      this._config.laneX3 ??  90,
    ];
    this._spawner = new NoteSpawner(this._runtime, chart, {
      judgeY:     this._config.judgeY     ?? -120,
      spawnY:     this._config.spawnY     ??  180,
      laneX,
      leadTimeMs: this._config.leadTimeMs ?? 1500,
    });
    this._spawner.init();

    // DebugOverlay
    this._overlay = new DebugOverlay(this._runtime, this);

    // BGM 音源をプリロード（失敗しても無視）
    if (chart.audio && chart.audio.file) {
      try {
        await soundBridge.loadSound('bgm', chart.audio.file);
      } catch (e) {
        // アセット無しでも動作する
      }
    }
  }

  // ── ゲーム開始 ────────────────────────────────────────────────────────

  /**
   * ゲームを開始する。greenFlag に相当。
   */
  start() {
    if (!this._runtime) {
      console.error('[RhythmGame] init() before start()');
      return;
    }

    // 状態リセット
    this.state = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    };
    this._effects = [];
    this._autoScheduled = new Set();
    this._spawner.reset();
    this._spawner.init();

    // BGM 開始時刻を記録
    const sound = this._runtime.sound;
    if (sound && sound.audioContext) {
      // AudioContext が suspended の場合 resume
      const ac = sound.audioContext;
      if (ac.state === 'suspended') {
        ac.resume().catch(() => {});
      }
      this._bgmStartContextTime = ac.currentTime;
    } else {
      this._bgmStartContextTime = null;
    }
    this._startPerfNow = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    // BGM 再生（失敗しても無視）
    try {
      sound.play('bgm', { when: 0 });
    } catch (e) {}

    // Runtime の greenFlag
    this._runtime.greenFlag();

    // カスタムゲームループ（runtime.startTick の代わりに独自RAFで制御）
    this._running = true;
    this._scheduleFrame();
  }

  /**
   * ゲームを停止する。
   */
  stop() {
    this._running = false;
    if (this._rafId != null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this._rafId);
      }
      this._rafId = null;
    }
    if (this._runtime) {
      this._runtime.threads.stopAll();
    }
  }

  // ── メインループ ──────────────────────────────────────────────────────

  _scheduleFrame() {
    if (!this._running) return;
    if (typeof requestAnimationFrame !== 'undefined') {
      this._rafId = requestAnimationFrame((ts) => this._frame(ts));
    }
  }

  _frame(ts) {
    if (!this._running) return;

    const songMs = this.songTimeMs();

    // Auto モード: 判定窓内のノーツを自動ヒット
    if (this._auto) {
      this._doAutoPlay(songMs);
    }

    // NoteSpawner 更新（clone生成 + y計算）
    this._spawner.update(songMs);

    // エンジンスレッドを1フレーム進める
    this._runtime.threads.stepThreads();

    // 描画
    this._draw();

    this._scheduleFrame();
  }

  /**
   * autoモード: songMs に近づいたノーツを自動ヒット（Perfect）。
   */
  _doAutoPlay(songMs) {
    for (const entry of this._spawner.activeNotes) {
      if (this._autoScheduled.has(entry.id)) continue;
      // ノーツ時刻を過ぎたら即ヒット
      if (songMs >= entry.timeMs) {
        this._autoScheduled.add(entry.id);
        const hitAudioMs = entry.timeMs; // Perfect ヒット時刻
        this.onLaneHit(entry.lane, hitAudioMs);
      }
    }
  }

  // ── 描画 ──────────────────────────────────────────────────────────────

  _draw() {
    if (!this._canvas) return;
    const ctx = this._canvas.getContext('2d');
    if (!ctx) return;

    // 1. engine renderer（背景 + ノーツclone + モニタ）
    this._runtime.renderer.render(this._runtime);

    // 2. ゲーム演出（判定ライン・レーン・HUD）をその上に描く
    this._drawLanes(ctx);
    this._drawHUD(ctx);
    this._drawEffects(ctx);

    // 3. DebugOverlay（最前面）
    if (this._overlay && this._overlay.visible) {
      this._overlay.render(ctx);
    }
  }

  _drawLanes(ctx) {
    const judgeY = this._spawner ? this._spawner._judgeY : -120;
    // Scratch y → Canvas y
    const canvasJudgeY = 180 - judgeY;

    const laneX = this._spawner ? this._spawner._laneX : [-90, -30, 30, 90];

    ctx.save();
    // 薄いレーン縦線
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (const lx of laneX) {
      const cx = lx + 240;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, 360);
      ctx.stroke();
    }

    // 判定ライン
    ctx.strokeStyle = 'rgba(255,255,100,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvasJudgeY);
    ctx.lineTo(480, canvasJudgeY);
    ctx.stroke();

    // レーンヒット領域（半透明円）
    for (const lx of laneX) {
      const cx = lx + 240;
      ctx.beginPath();
      ctx.arc(cx, canvasJudgeY, 20, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawHUD(ctx) {
    ctx.save();
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`SCORE: ${this.state.score}`, 240, 24);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ff0';
    ctx.fillText(`COMBO: ${this.state.combo}`, 240, 44);

    // 判定カウント
    const { perfect, great, good, miss } = this.state.counts;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`P:${perfect}`, 4, 340);
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(`Gr:${great}`, 44, 340);
    ctx.fillStyle = '#69ff47';
    ctx.fillText(`Go:${good}`, 84, 340);
    ctx.fillStyle = '#ff5252';
    ctx.fillText(`Ms:${miss}`, 124, 340);

    // Auto モード表示
    if (this._auto) {
      ctx.fillStyle = '#ff8c00';
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('[AUTO]', 476, 14);
    }

    ctx.restore();
  }

  _drawEffects(ctx) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const judgeY = this._spawner ? this._spawner._judgeY : -120;
    const canvasJudgeY = 180 - judgeY;

    const COLOR_MAP = {
      perfect: '#ffd700',
      great:   '#00e5ff',
      good:    '#69ff47',
      miss:    '#ff5252',
    };

    ctx.save();
    this._effects = this._effects.filter(e => {
      const age = now - e.born;
      if (age > 600) return false;

      const alpha = 1 - age / 600;
      const cx = e.x + 240;
      const cy = canvasJudgeY - age * 0.05;

      ctx.globalAlpha = alpha;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = COLOR_MAP[e.result] ?? '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(e.result.toUpperCase(), cx, cy - 10);
      ctx.globalAlpha = 1;
      return true;
    });
    ctx.restore();
  }

  // ── 入力処理 ──────────────────────────────────────────────────────────

  /**
   * レーンがヒットされたとき呼ぶ。
   * @param {number} lane - 0..3
   * @param {number} hitAudioMs - ヒット時刻（曲時間 songTime ms 基準。note.timeMs と直接比較する）
   */
  onLaneHit(lane, hitAudioMs) {
    // 該当レーンの最も判定窓に近い未判定ノーツを探す
    const candidates = this._spawner.activeNotes
      .filter(e => e.lane === lane && !e.consumed);

    if (candidates.length === 0) return;

    // hitErrorMs の絶対値が最小のものを選ぶ（最も近い）
    let best = null;
    let bestAbs = Infinity;
    for (const entry of candidates) {
      const err = Math.abs(hitAudioMs - entry.timeMs);
      if (err < bestAbs) {
        bestAbs = err;
        best = entry;
      }
    }

    if (!best) return;

    // goodMs を超えていれば miss 扱い（窓外）
    const { result, hitErrorMs } = this._judge.judge(best.timeMs, hitAudioMs);

    // スコア・コンボ更新
    this._applyJudge(best, result, hitErrorMs);
  }

  /**
   * 判定結果をゲーム状態に反映する。
   * @param {object} entry - activeNotes エントリ
   * @param {string} result
   * @param {number} hitErrorMs
   */
  _applyJudge(entry, result, hitErrorMs) {
    this.state.counts[result]++;

    if (result !== 'miss') {
      this.state.score += SCORE_TABLE[result];
      this.state.combo++;
      if (this.state.combo > this.state.maxCombo) {
        this.state.maxCombo = this.state.combo;
      }
    } else {
      this.state.combo = 0;
    }

    // ヒットエフェクト
    const laneX = this._spawner.laneXFor(entry.lane);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._effects.push({ x: laneX, result, born: now });

    // DebugOverlay に記録
    if (this._overlay) {
      this._overlay.logHitError(hitErrorMs, result);
      this._overlay.logEvent(`lane${entry.lane} ${result} ${hitErrorMs >= 0 ? '+' : ''}${hitErrorMs.toFixed(0)}ms`);
    }

    // SEを鳴らす（失敗しても無視）
    try {
      const noteSprite = this._runtime.getTargetByName('Note');
      if (noteSprite && result !== 'miss') {
        this._runtime.sound.play('hit', { volume: 80 });
      }
    } catch (e) {}

    // note_judged ブロードキャスト
    this._runtime.broadcast('note_judged');

    // ノーツを消費
    this._spawner.consume(entry);
  }

  // ── 時刻管理 ──────────────────────────────────────────────────────────

  /**
   * 現在の曲時刻（ms）。
   * AudioContext が使えない場合は performance.now ベースにフォールバック。
   * @returns {number}
   */
  songTimeMs() {
    const sound = this._runtime ? this._runtime.sound : null;
    const effectiveOffset = this._judge ? this._judge.effectiveOffsetMs() : 0;

    if (sound && sound.audioContext && this._bgmStartContextTime !== null) {
      return (sound.audioContext.currentTime - this._bgmStartContextTime) * 1000 - effectiveOffset;
    }

    // フォールバック: performance.now ベース
    if (this._startPerfNow !== null) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return (now - this._startPerfNow) - effectiveOffset;
    }

    return 0;
  }

  /**
   * 現在の AudioContext 時刻（ms）。入力時刻算出に使う。
   * @returns {number}
   */
  nowAudioMs() {
    const sound = this._runtime ? this._runtime.sound : null;
    if (sound) return sound.now() * 1000;
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  // ── アクセサ ─────────────────────────────────────────────────────────

  get debugOverlay() { return this._overlay; }

  setAuto(val) {
    this._auto = !!val;
  }
}
