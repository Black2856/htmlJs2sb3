/**
 * main.js
 * Scratch互換ランタイムの Web デモ・エントリポイント。
 * DSL を fetch → Runtime を構築 → 緑の旗で実行（startTick で毎フレーム描画）。
 * window.__runtime と window.__runtimeState() を検証用に公開する。
 */

import { Runtime } from '../engine/index.js';

const canvas   = document.getElementById('stage');
const btnFlag  = document.getElementById('btn-flag');
const btnStop  = document.getElementById('btn-stop');

const stClones = document.getElementById('st-clones');
const stScore  = document.getElementById('st-score');
const stCombo  = document.getElementById('st-combo');
const stTimer  = document.getElementById('st-timer');

let runtime = null;
let dsl = null;

/** DSL を読み込み Runtime を構築する（描画開始はしない）。 */
async function initRuntime() {
  const res = await fetch('../spec/scratch-rhythm.dsl.json');
  if (!res.ok) throw new Error(`DSL fetch failed: ${res.status}`);
  dsl = await res.json();

  runtime = new Runtime({ canvas });
  runtime.loadProject(dsl);

  // 検証・デバッグ用グローバル
  window.__runtime = runtime;
  window.__runtimeState = () => {
    const v = runtime.stage && runtime.stage.variables;
    const num = (name) => (v && v.has(name) ? v.get(name) : null);
    return {
      clones: runtime.clones.total(),
      targets: runtime.targets.length,
      score: num('score'),
      combo: num('combo'),
      timer: runtime.getTimer(),
    };
  };

  console.log('[main] Runtime initialized:', dsl.meta && dsl.meta.name);
}

/** HUD（ステータス行）を毎フレーム更新する。 */
function updateStatus() {
  if (!runtime) return;
  const s = window.__runtimeState();
  stClones.textContent = s.clones;
  stScore.textContent  = s.score ?? '-';
  stCombo.textContent  = s.combo ?? '-';
  stTimer.textContent  = s.timer.toFixed(1);
  requestAnimationFrame(updateStatus);
}

btnFlag.addEventListener('click', async () => {
  if (!runtime) {
    btnFlag.disabled = true;
    btnFlag.textContent = '⌛ Loading...';
    try {
      await initRuntime();
    } catch (e) {
      console.error('[main] init failed:', e);
      btnFlag.textContent = '⚑ 緑の旗';
      btnFlag.disabled = false;
      return;
    }
    btnFlag.disabled = false;
  }
  runtime.greenFlag();   // 緑の旗ハットを起動
  runtime.startTick();   // rAF ループ開始（毎フレーム stepFrame + render）
  btnFlag.textContent = '↺ もう一度';
  updateStatus();
});

btnStop.addEventListener('click', () => {
  if (runtime) runtime.stop();
});

// Scratch のキー入力デモ（key_pressed ハット用）。物理キー名をそのまま渡す。
document.addEventListener('keydown', (e) => {
  if (!runtime || e.repeat) return;
  const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
  runtime.pressKey(key);
});
