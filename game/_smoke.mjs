/**
 * game/_smoke.mjs
 * game/ 層の純ロジックを Node.js でテストするスモークテスト。
 * DOM・AudioContext は不要。
 * 実行: node game/_smoke.mjs
 * 成功時: "GAME SMOKE OK" を出力して exit 0
 */

import assert from 'node:assert/strict';
import { ChartLoader } from './ChartLoader.js';
import { JudgeSystem }  from './JudgeSystem.js';

// ─── ヘッドレス Runtime スタブ ─────────────────────────────────────────
// NoteSpawner は engine の CloneManager を必要とするため、
// ヘッドレス環境向けのスタブ Runtime を用意する。

class StubCloneManager {
  constructor() {
    this._clones = [];
    this._nextId = 1;
  }
  createClone(source) {
    const clone = {
      _id: this._nextId++,
      name: source.name,
      x: source.x ?? 0,
      y: source.y ?? 0,
      visible: source.visible ?? false,
      isClone: true,
      isOriginal: false,
      _threads: [],
      setX(v) { this.x = Number(v); },
      setY(v) { this.y = Number(v); },
      show()  { this.visible = true; },
      hide()  { this.visible = false; },
    };
    this._clones.push(clone);
    return clone;
  }
  deleteClone(clone) {
    const i = this._clones.indexOf(clone);
    if (i >= 0) this._clones.splice(i, 1);
  }
  total() { return this._clones.length; }
}

class StubThreadRunner {
  threadsForTarget(_target) { return []; }
  stopThread(_t) {}
}

class StubRuntime {
  constructor() {
    this.clones  = new StubCloneManager();
    this.threads = new StubThreadRunner();
    this.targets = [];
    this._noteSprite = null;
    this.sound = null;
  }
  getTargetByName(name) {
    if (name === 'Note' && this._noteSprite) return this._noteSprite;
    return null;
  }
}

// NoteSpawner は engine をimport するので動的importでロード
const { NoteSpawner } = await import('./NoteSpawner.js');

// ─── 1. ChartLoader.normalize のソートテスト ─────────────────────────

console.log('Test 1: ChartLoader.normalize sorts notes by timeMs...');

const unsortedChart = {
  version: '1.0',
  meta: { title: 'Test', bpm: 120, offsetMs: 0, lanes: 4 },
  audio: { file: 'test.wav' },
  timing: {},
  notes: [
    { id: 'c', timeMs: 3000, lane: 0, type: 'tap' },
    { id: 'a', timeMs: 1000, lane: 1, type: 'tap' },
    { id: 'b', timeMs: 2000, lane: 2, type: 'tap' },
    { id: 'd', timeMs: 1000, lane: 3, type: 'tap' }, // 同時刻 a の後に来る
  ],
};

const normalized = ChartLoader.normalize(unsortedChart);

// timeMs 昇順になっていること
const times = normalized.notes.map(n => n.timeMs);
assert.deepEqual(times, [1000, 1000, 2000, 3000], 'notes should be sorted by timeMs');

// 安定ソート: timeMs=1000 の 'a' (index 1) が 'd' (index 3) より先
const idx1000 = normalized.notes.filter(n => n.timeMs === 1000).map(n => n.id);
assert.deepEqual(idx1000, ['a', 'd'], 'stable sort: original order preserved for equal timeMs');

// 既定値補完
assert.equal(normalized.timing.perfectMs, 40, 'perfectMs default 40');
assert.equal(normalized.timing.greatMs,   80, 'greatMs default 80');
assert.equal(normalized.timing.goodMs,   120, 'goodMs default 120');

console.log('  PASS: ChartLoader.normalize');

// ─── 2. ChartLoader.validate ─────────────────────────────────────────

console.log('Test 2: ChartLoader.validate...');

const { ok: okGood } = ChartLoader.validate(unsortedChart);
assert.equal(okGood, true, 'valid chart should pass');

const { ok: okBad, errors } = ChartLoader.validate({ version: '2.0', notes: [] });
assert.equal(okBad, false, 'invalid chart should fail');
assert.ok(errors.length > 0, 'should have errors');

console.log('  PASS: ChartLoader.validate');

// ─── 3. JudgeSystem.judge の閾値テスト ──────────────────────────────

console.log('Test 3: JudgeSystem.judge thresholds...');

const judge = new JudgeSystem({ perfectMs: 40, greatMs: 80, goodMs: 120 });

// ±0ms → perfect
{
  const { result, hitErrorMs } = judge.judge(1000, 1000);
  assert.equal(result, 'perfect', '0ms error = perfect');
  assert.equal(hitErrorMs, 0);
}

// ±40ms → perfect (境界)
{
  const { result } = judge.judge(1000, 1040);
  assert.equal(result, 'perfect', '+40ms = perfect');
}
{
  const { result } = judge.judge(1000, 960);
  assert.equal(result, 'perfect', '-40ms = perfect');
}

// ±41ms → great
{
  const { result } = judge.judge(1000, 1041);
  assert.equal(result, 'great', '+41ms = great');
}

// ±80ms → great (境界)
{
  const { result } = judge.judge(1000, 1080);
  assert.equal(result, 'great', '+80ms = great');
}

// ±100ms → good (仕様の代表値 ±100ms)
{
  const { result } = judge.judge(1000, 1100);
  assert.equal(result, 'good', '+100ms = good');
}
{
  const { result } = judge.judge(1000, 900);
  assert.equal(result, 'good', '-100ms = good');
}

// ±120ms → good (境界)
{
  const { result } = judge.judge(1000, 1120);
  assert.equal(result, 'good', '+120ms = good');
}

// ±121ms → miss
{
  const { result } = judge.judge(1000, 1121);
  assert.equal(result, 'miss', '+121ms = miss');
}

// ±200ms → miss (指定代表値)
{
  const { result } = judge.judge(1000, 1200);
  assert.equal(result, 'miss', '+200ms = miss');
}
{
  const { result } = judge.judge(1000, 800);
  assert.equal(result, 'miss', '-200ms = miss');
}

console.log('  PASS: JudgeSystem.judge');

// ─── 4. JudgeSystem.setOffsets / effectiveOffsetMs ───────────────────

console.log('Test 4: JudgeSystem.setOffsets...');

const judge2 = new JudgeSystem();
judge2.setOffsets({ chartOffsetMs: 10, userOffsetMs: -5, deviceCalibMs: 2 });
assert.equal(judge2.effectiveOffsetMs(), 7, 'effectiveOffsetMs = 10-5+2 = 7');

console.log('  PASS: JudgeSystem.setOffsets');

// ─── 5. NoteSpawner ヘッドレステスト ─────────────────────────────────

console.log('Test 5: NoteSpawner headless (clone 生成・y更新・consume)...');

const testChart = {
  version: '1.0',
  meta: { title: 'Test', bpm: 120, offsetMs: 0, lanes: 4 },
  audio: { file: 'test.wav' },
  timing: {},
  notes: [
    { id: 'n1', timeMs: 2000, lane: 0, type: 'tap' },
    { id: 'n2', timeMs: 3000, lane: 1, type: 'tap' },
    { id: 'n3', timeMs: 4000, lane: 2, type: 'tap' },
  ],
};
const normalizedChart = ChartLoader.normalize(testChart);

const stubRuntime = new StubRuntime();

// Note スプライトスタブ
const noteSprite = {
  name: 'Note',
  x: 0,
  y: 180,
  visible: false,
  isClone: false,
  isOriginal: true,
};
stubRuntime._noteSprite = noteSprite;
stubRuntime.targets.push(noteSprite);

const spawner = new NoteSpawner(stubRuntime, normalizedChart, {
  judgeY: -120,
  spawnY:  180,
  laneX: [-90, -30, 30, 90],
  leadTimeMs: 1500,
});
spawner.init();

// songTime=0: まだ何も出現しない (spawnTime = 2000 - 1500 = 500ms)
spawner.update(0);
assert.equal(spawner.activeNotes.length, 0, 'no notes at t=0');
assert.equal(stubRuntime.clones.total(), 0, 'no clones at t=0');

// songTime=500: n1 が出現するはず (spawnTime=500)
spawner.update(500);
assert.equal(spawner.activeNotes.length, 1, 'n1 spawns at t=500');
assert.equal(stubRuntime.clones.total(), 1, '1 clone at t=500');
assert.equal(spawner.activeNotes[0].id, 'n1');

// n1 の y座標確認: t=500, note.timeMs=2000, leadTimeMs=1500
// y = judgeY + (2000-500)/1500 * (180-(-120)) = -120 + 1.0 * 300 = 180 (spawnY)
const yAt500 = spawner.activeNotes[0].clone.y;
assert.ok(Math.abs(yAt500 - 180) < 1, `y at spawn time should be ~180, got ${yAt500}`);

// songTime=1250: n1 は中間地点にいるはず
// y = -120 + (2000-1250)/1500 * 300 = -120 + 0.5 * 300 = 30
spawner.update(1250);
const yAt1250 = spawner.activeNotes[0].clone.y;
assert.ok(Math.abs(yAt1250 - 30) < 1, `y at midpoint should be ~30, got ${yAt1250}`);

// songTime=2000: n1 は判定Y(-120)にいるはず
spawner.update(2000);
const yAt2000 = spawner.activeNotes[0].clone.y;
assert.ok(Math.abs(yAt2000 - (-120)) < 1, `y at judgeY should be ~-120, got ${yAt2000}`);

// n1 を consume
// t=2000 の時点では n2 も出現済み (spawnTime=1500) のため activeNotes.length=2
const n1entry = spawner.activeNotes.find(e => e.id === 'n1');
assert.ok(n1entry, 'n1 entry should exist');
const beforeConsumeLen = spawner.activeNotes.length; // 2 (n1 + n2)
spawner.consume(n1entry);
// n1 が消費されたので activeNotes は n2 だけになる
assert.equal(spawner.activeNotes.length, beforeConsumeLen - 1, 'n1 consumed: length decreases by 1');
assert.ok(!spawner.activeNotes.find(e => e.id === 'n1'), 'n1 not in activeNotes after consume');
// clones 総数は n2 の 1 つだけ
assert.equal(stubRuntime.clones.total(), 1, '1 clone remains (n2) after consuming n1');

// songTime=2500: n2 が出現 (spawnTime = 3000-1500 = 1500)
// n2 は t=1500 に出現するので t=2500 では既に出現済み
// update(2500) を呼ぶ
spawner.update(2500);
const active2500 = spawner.activeNotes;
assert.ok(active2500.some(e => e.id === 'n2'), 'n2 should be active at t=2500');

// songTime=2000 + 300 = 2300ms 以上経過したノーツは自動消費される
// n2.timeMs=3000, at t=3300 はtimeDelta=-300, consume対象
// まずn2を手動consumeせずに通過させる
// t=3301: n2 は timeDelta=3000-3301=-301 < -300 なので自動消費
spawner.update(3301);
assert.equal(spawner.activeNotes.filter(e => e.id === 'n2').length, 0, 'n2 auto-consumed at t=3301');

console.log('  PASS: NoteSpawner');

// ─── 完了 ──────────────────────────────────────────────────────────────

console.log('');
console.log('GAME SMOKE OK');
process.exit(0);
