/**
 * main.js
 * Webデモのエントリポイント。
 * DSL と chart を fetch し、RhythmGame を初期化・開始する。
 * D/F/J/K キーを onLaneHit に接続。
 * window.__game と window.__rhythmState() を公開（Playwright検証用）。
 */

import { RhythmGame } from '../game/RhythmGame.js';

// ─── キー → レーン対応 ────────────────────────────────────────────────
const KEY_TO_LANE = {
  'd': 0,
  'f': 1,
  'j': 2,
  'k': 3,
};

// ─── DOM 要素 ─────────────────────────────────────────────────────────
const canvas   = document.getElementById('game-canvas');
const btnStart = document.getElementById('btn-start');
const btnAuto  = document.getElementById('btn-auto');
const btnDebug = document.getElementById('btn-debug');

const dispScore   = document.getElementById('disp-score');
const dispCombo   = document.getElementById('disp-combo');
const dispPerfect = document.getElementById('disp-perfect');
const dispGreat   = document.getElementById('disp-great');
const dispGood    = document.getElementById('disp-good');
const dispMiss    = document.getElementById('disp-miss');

// ─── ゲーム状態 ───────────────────────────────────────────────────────
let game = null;
let autoMode  = false;
let debugMode = false;

// ─── 初期化 ───────────────────────────────────────────────────────────

async function initGame() {
  // DSL と chart を並列 fetch
  const [dslRes, chartRes] = await Promise.all([
    fetch('../spec/scratch-rhythm.dsl.json'),
    fetch('../spec/sample-chart.json'),
  ]);

  if (!dslRes.ok)   throw new Error(`DSL fetch failed: ${dslRes.status}`);
  if (!chartRes.ok) throw new Error(`chart fetch failed: ${chartRes.status}`);

  const [dsl, chartRaw] = await Promise.all([dslRes.json(), chartRes.json()]);

  // ChartLoader は RhythmGame.init() 内部で normalize される想定だが、
  // ここでも normalize を通して最終オブジェクトを確認できるようにする。
  // RhythmGame は渡された chart を使うので、事前 normalize しておく。
  const { ChartLoader } = await import('../game/ChartLoader.js');
  const chart = ChartLoader.normalize(chartRaw);

  game = new RhythmGame({
    canvas,
    dsl,
    chart,
    config: {
      auto: autoMode,
    },
  });

  await game.init();

  // Playwright 検証用グローバル公開
  window.__game = game;
  window.__rhythmState = () => ({
    score:        game.state.score,
    combo:        game.state.combo,
    counts:       { ...game.state.counts },
    songTimeMs:   game.songTimeMs(),
    activeNotes:  game._spawner ? game._spawner.activeNotes.length : 0,
  });

  console.log('[main] RhythmGame initialized');
}

// ─── ボタン配線 ───────────────────────────────────────────────────────

btnStart.addEventListener('click', async () => {
  // AudioContext は user gesture 後に resume できる
  if (!game) {
    btnStart.textContent = '⌛ Loading...';
    btnStart.disabled = true;
    try {
      await initGame();
    } catch (e) {
      console.error('[main] init failed:', e);
      btnStart.textContent = '▶ Start';
      btnStart.disabled = false;
      return;
    }
  }

  game.setAuto(autoMode);
  game.start();
  btnStart.textContent = '↺ Restart';
  btnStart.disabled = false;

  // スコア表示更新ループ
  startScoreUpdater();
});

btnAuto.addEventListener('click', () => {
  autoMode = !autoMode;
  btnAuto.textContent = autoMode ? 'Auto ON' : 'Auto OFF';
  btnAuto.classList.toggle('active', autoMode);
  if (game) game.setAuto(autoMode);
});

btnDebug.addEventListener('click', () => {
  debugMode = !debugMode;
  btnDebug.textContent = debugMode ? 'Debug ON' : 'Debug OFF';
  btnDebug.classList.toggle('active', debugMode);
  if (game && game.debugOverlay) game.debugOverlay.toggle();
});

// ─── キーボード入力 ───────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (!game) return;
  // リピートは無視
  if (e.repeat) return;

  const key = e.key.toLowerCase();
  const lane = KEY_TO_LANE[key];
  if (lane !== undefined) {
    // ヒット時刻は曲時間（songTime）ms 基準。onLaneHit が note.timeMs と
    // 直接比較するため、Auto パスと同じ曲時間基準に揃える。
    const hitSongMs = game.songTimeMs();
    game.onLaneHit(lane, hitSongMs);
  }
});

// ─── スコア表示更新 ───────────────────────────────────────────────────

let _scoreInterval = null;

function startScoreUpdater() {
  if (_scoreInterval) clearInterval(_scoreInterval);
  _scoreInterval = setInterval(() => {
    if (!game) return;
    const s = game.state;
    dispScore.textContent   = `SCORE: ${s.score}`;
    dispCombo.textContent   = `COMBO: ${s.combo}`;
    dispPerfect.textContent = `P: ${s.counts.perfect}`;
    dispGreat.textContent   = `Gr: ${s.counts.great}`;
    dispGood.textContent    = `Go: ${s.counts.good}`;
    dispMiss.textContent    = `Ms: ${s.counts.miss}`;
  }, 100);
}
