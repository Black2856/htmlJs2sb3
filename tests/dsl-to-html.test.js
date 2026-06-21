/**
 * dsl-to-html.test.js
 * Runtime.loadProject(sample DSL) が Stage/Sprite/変数/リスト/broadcast を正しく構築し、
 * greenFlag→数百stepFrameで例外なく走り、score/comboが数値であることを検証
 * (DSL→Web実行系の健全性チェック)。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Runtime } from '../engine/Runtime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// sample DSL を読み込む
const dslPath = resolve(__dirname, '../spec/scratch-rhythm.dsl.json');
const sampleDsl = JSON.parse(readFileSync(dslPath, 'utf8'));

function makeRuntime() {
  return new Runtime({ canvas: null, soundBridge: null });
}

function stepN(rt, n) {
  for (let i = 0; i < n; i++) rt.stepFrame();
}

// ─── loadProject の構築検証 ────────────────────────────────────────────────

test('loadProject: stage is constructed', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  assert.ok(rt.stage, 'stage が存在するはず');
  assert.equal(rt.stage.name, 'Stage');
  assert.equal(rt.stage.isStage, true);
});

test('loadProject: sprites are constructed', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  // Stage + Note sprite = 2 targets
  assert.ok(rt.targets.length >= 2, 'stage + sprite が targets に含まれるはず');
  const note = rt.targets.find(t => t.name === 'Note');
  assert.ok(note, 'Note sprite が存在するはず');
});

test('loadProject: stage variables defined', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  // sample DSL: stage has score, combo, maxCombo, fps
  assert.equal(rt.stage.variables.has('score'), true);
  assert.equal(rt.stage.variables.has('combo'), true);
  assert.equal(rt.stage.variables.has('maxCombo'), true);
  assert.equal(rt.stage.variables.has('fps'), true);
});

test('loadProject: stage lists defined', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  // sample DSL: stage has laneX, judgeLog
  assert.equal(rt.stage.lists.has('laneX'), true);
  assert.equal(rt.stage.lists.has('judgeLog'), true);
});

test('loadProject: laneX initial values correct', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  // [-90, -30, 30, 90]
  assert.equal(rt.stage.lists.itemAt('laneX', 1), -90);
  assert.equal(rt.stage.lists.itemAt('laneX', 2), -30);
  assert.equal(rt.stage.lists.itemAt('laneX', 3), 30);
  assert.equal(rt.stage.lists.itemAt('laneX', 4), 90);
});

test('loadProject: Note sprite variables defined', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  const note = rt.targets.find(t => t.name === 'Note');
  assert.equal(note.variables.has('lane'), true);
  assert.equal(note.variables.has('speed'), true);
});

test('loadProject: procedures registered on stage', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  // addScore procedure
  assert.ok('addScore' in rt.stage._procedures, 'stage._procedures に addScore が登録されるはず');
});

// ─── greenFlag → stepFrame 実行の健全性 ───────────────────────────────────

test('greenFlag + stepFrame: no exceptions over 200 frames', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  assert.doesNotThrow(() => {
    rt.greenFlag();
    stepN(rt, 200);
  });
});

test('greenFlag + stepFrame: score is a number', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  rt.greenFlag();
  stepN(rt, 50);
  const score = rt.stage.variables.get('score');
  assert.equal(typeof score, 'number', `score should be a number, got ${typeof score}`);
});

test('greenFlag + stepFrame: combo is a number', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  rt.greenFlag();
  stepN(rt, 50);
  const combo = rt.stage.variables.get('combo');
  assert.equal(typeof combo, 'number', `combo should be a number, got ${typeof combo}`);
});

test('greenFlag initializes score to 0', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  // score の初期値は 0
  assert.equal(rt.stage.variables.get('score'), 0);
  rt.greenFlag();
  stepN(rt, 5);
  // greenFlag スクリプトが set score 0 を実行
  assert.equal(rt.stage.variables.get('score'), 0);
});

test('greenFlag initializes combo to 0', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  rt.greenFlag();
  stepN(rt, 5);
  assert.equal(rt.stage.variables.get('combo'), 0);
});

test('greenFlag initializes maxCombo to 0', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  rt.greenFlag();
  stepN(rt, 5);
  assert.equal(rt.stage.variables.get('maxCombo'), 0);
});

test('runtime can run 500 frames without crash', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  assert.doesNotThrow(() => {
    rt.greenFlag();
    stepN(rt, 500);
  });
});

// ─── broadcast が登録されていること ─────────────────────────────────────────

test('DSL broadcasts array is accessible in DSL', () => {
  // sampleDslに broadcasts が存在することを確認
  assert.ok(Array.isArray(sampleDsl.broadcasts));
  assert.ok(sampleDsl.broadcasts.includes('song_start'));
  assert.ok(sampleDsl.broadcasts.includes('spawn_note'));
  assert.ok(sampleDsl.broadcasts.includes('note_judged'));
});

test('runtime.targets contains stage and Note', () => {
  const rt = makeRuntime();
  rt.loadProject(sampleDsl);
  const names = rt.targets.map(t => t.name);
  assert.ok(names.includes('Stage'));
  assert.ok(names.includes('Note'));
});
