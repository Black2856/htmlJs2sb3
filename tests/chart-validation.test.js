/**
 * chart-validation.test.js
 * ChartLoader.validate と tools validateChart が正常/異常chartを正しく検証することを確認。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ChartLoader } from '../game/ChartLoader.js';
import { validateChart } from '../tools/validate-chart.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 正常なサンプルチャート
const validChart = {
  version: '1.0',
  meta: {
    title: 'Test Song',
    bpm: 160,
    offsetMs: 0,
    lanes: 4,
  },
  audio: { file: 'assets/audio/test.wav' },
  timing: { perfectMs: 40, greatMs: 80, goodMs: 120 },
  notes: [
    { id: 'n001', timeMs: 1000, lane: 0, type: 'tap' },
    { id: 'n002', timeMs: 2000, lane: 1, type: 'tap' },
  ],
};

// ─── ChartLoader.validate ──────────────────────────────────────────────────

test('ChartLoader.validate: valid chart returns ok=true', () => {
  const result = ChartLoader.validate(validChart);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('ChartLoader.validate: missing version returns error', () => {
  const bad = { ...validChart };
  delete bad.version;
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0, 'errors should not be empty');
});

test('ChartLoader.validate: missing meta returns error', () => {
  const bad = { ...validChart };
  delete bad.meta;
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('ChartLoader.validate: missing audio returns error', () => {
  const bad = { ...validChart };
  delete bad.audio;
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('ChartLoader.validate: missing notes returns error', () => {
  const bad = { ...validChart };
  delete bad.notes;
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('ChartLoader.validate: wrong version string returns error', () => {
  const bad = { ...validChart, version: '2.0' };
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('version') || e.includes('1.0')));
});

test('ChartLoader.validate: negative bpm returns error', () => {
  const bad = {
    ...validChart,
    meta: { ...validChart.meta, bpm: -1 },
  };
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('ChartLoader.validate: lanes out of range (0) returns error', () => {
  const bad = {
    ...validChart,
    meta: { ...validChart.meta, lanes: 0 },
  };
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
});

test('ChartLoader.validate: lanes out of range (9) returns error', () => {
  const bad = {
    ...validChart,
    meta: { ...validChart.meta, lanes: 9 },
  };
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
});

test('ChartLoader.validate: note missing id returns error', () => {
  const bad = {
    ...validChart,
    notes: [{ timeMs: 1000, lane: 0, type: 'tap' }],
  };
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('id') || e.includes('missing')));
});

test('ChartLoader.validate: invalid note type returns error', () => {
  const bad = {
    ...validChart,
    notes: [{ id: 'n001', timeMs: 1000, lane: 0, type: 'unknown_type' }],
  };
  const result = ChartLoader.validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('type') || e.includes('unknown_type') || e.includes('enum')));
});

// ─── validateChart (tools/validate-chart.js) ──────────────────────────────

test('tools/validateChart: valid chart returns ok=true', () => {
  const result = validateChart(validChart);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('tools/validateChart: missing required property returns error', () => {
  const bad = { ...validChart };
  delete bad.timing;
  const result = validateChart(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('tools/validateChart: wrong version returns error', () => {
  const bad = { ...validChart, version: '9.9' };
  const result = validateChart(bad);
  assert.equal(result.ok, false);
});

test('tools/validateChart: negative timeMs in note returns error', () => {
  const bad = {
    ...validChart,
    notes: [{ id: 'n001', timeMs: -100, lane: 0, type: 'tap' }],
  };
  const result = validateChart(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('timeMs') || e.includes('minimum')));
});

test('tools/validateChart: negative lane returns error', () => {
  const bad = {
    ...validChart,
    notes: [{ id: 'n001', timeMs: 1000, lane: -1, type: 'tap' }],
  };
  const result = validateChart(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('lane') || e.includes('minimum')));
});

// ─── spec/sample-chart.json も検証 ────────────────────────────────────────

test('spec/sample-chart.json is valid', () => {
  const chartPath = resolve(__dirname, '../spec/sample-chart.json');
  const chart = JSON.parse(readFileSync(chartPath, 'utf8'));

  // ChartLoader.validate
  const r1 = ChartLoader.validate(chart);
  assert.equal(r1.ok, true, `ChartLoader errors: ${r1.errors.join(', ')}`);

  // tools validateChart
  const r2 = validateChart(chart);
  assert.equal(r2.ok, true, `validateChart errors: ${r2.errors.join(', ')}`);
});

// ─── ChartLoader.normalize ─────────────────────────────────────────────────

test('ChartLoader.normalize sorts notes by timeMs', () => {
  const chart = {
    ...validChart,
    notes: [
      { id: 'n003', timeMs: 3000, lane: 0, type: 'tap' },
      { id: 'n001', timeMs: 1000, lane: 1, type: 'tap' },
      { id: 'n002', timeMs: 2000, lane: 2, type: 'tap' },
    ],
  };
  const normalized = ChartLoader.normalize(chart);
  assert.equal(normalized.notes[0].id, 'n001');
  assert.equal(normalized.notes[1].id, 'n002');
  assert.equal(normalized.notes[2].id, 'n003');
});

test('ChartLoader.normalize fills default timing values', () => {
  const chart = {
    ...validChart,
    timing: {},
  };
  const normalized = ChartLoader.normalize(chart);
  assert.equal(normalized.timing.perfectMs, 40);
  assert.equal(normalized.timing.greatMs, 80);
  assert.equal(normalized.timing.goodMs, 120);
});

test('ChartLoader.normalize stable sort for same timeMs', () => {
  const chart = {
    ...validChart,
    notes: [
      { id: 'n1', timeMs: 1000, lane: 0, type: 'tap' },
      { id: 'n2', timeMs: 1000, lane: 1, type: 'tap' },
      { id: 'n3', timeMs: 1000, lane: 2, type: 'tap' },
    ],
  };
  const normalized = ChartLoader.normalize(chart);
  // 安定ソートなのでオリジナルの順序が保たれる
  assert.equal(normalized.notes[0].id, 'n1');
  assert.equal(normalized.notes[1].id, 'n2');
  assert.equal(normalized.notes[2].id, 'n3');
});
