/**
 * hit-window.test.js
 * JudgeSystem.classify/judge が境界値(±40, ±80, ±120 と その外) で
 * perfect/great/good/miss を正しく分類することを検証。
 * 境界の内外を明示的に検証する。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JudgeSystem } from '../game/JudgeSystem.js';

// 既定設定: perfect=40, great=80, good=120
const JS = new JudgeSystem({ perfectMs: 40, greatMs: 80, goodMs: 120 });

// ─── classify ─────────────────────────────────────────────────────────────

// perfect 境界内 (±40)
test('classify: 0ms → perfect', () => {
  assert.equal(JS.classify(0), 'perfect');
});

test('classify: +40ms (boundary) → perfect', () => {
  assert.equal(JS.classify(40), 'perfect');
});

test('classify: -40ms (boundary) → perfect', () => {
  assert.equal(JS.classify(-40), 'perfect');
});

test('classify: +39ms → perfect', () => {
  assert.equal(JS.classify(39), 'perfect');
});

test('classify: -39ms → perfect', () => {
  assert.equal(JS.classify(-39), 'perfect');
});

// great 境界 (41..80)
test('classify: +41ms → great', () => {
  assert.equal(JS.classify(41), 'great');
});

test('classify: -41ms → great', () => {
  assert.equal(JS.classify(-41), 'great');
});

test('classify: +80ms (boundary) → great', () => {
  assert.equal(JS.classify(80), 'great');
});

test('classify: -80ms (boundary) → great', () => {
  assert.equal(JS.classify(-80), 'great');
});

test('classify: +79ms → great', () => {
  assert.equal(JS.classify(79), 'great');
});

// good 境界 (81..120)
test('classify: +81ms → good', () => {
  assert.equal(JS.classify(81), 'good');
});

test('classify: -81ms → good', () => {
  assert.equal(JS.classify(-81), 'good');
});

test('classify: +120ms (boundary) → good', () => {
  assert.equal(JS.classify(120), 'good');
});

test('classify: -120ms (boundary) → good', () => {
  assert.equal(JS.classify(-120), 'good');
});

test('classify: +119ms → good', () => {
  assert.equal(JS.classify(119), 'good');
});

// miss (>120)
test('classify: +121ms → miss', () => {
  assert.equal(JS.classify(121), 'miss');
});

test('classify: -121ms → miss', () => {
  assert.equal(JS.classify(-121), 'miss');
});

test('classify: +1000ms → miss', () => {
  assert.equal(JS.classify(1000), 'miss');
});

test('classify: -1000ms → miss', () => {
  assert.equal(JS.classify(-1000), 'miss');
});

// ─── judge ────────────────────────────────────────────────────────────────

test('judge: on-time → perfect with hitErrorMs=0', () => {
  const { result, hitErrorMs } = JS.judge(1000, 1000);
  assert.equal(result, 'perfect');
  assert.equal(hitErrorMs, 0);
});

test('judge: +40ms → perfect', () => {
  const { result, hitErrorMs } = JS.judge(1000, 1040);
  assert.equal(result, 'perfect');
  assert.equal(hitErrorMs, 40);
});

test('judge: -40ms → perfect', () => {
  const { result, hitErrorMs } = JS.judge(1000, 960);
  assert.equal(result, 'perfect');
  assert.equal(hitErrorMs, -40);
});

test('judge: +41ms → great', () => {
  const { result, hitErrorMs } = JS.judge(1000, 1041);
  assert.equal(result, 'great');
  assert.equal(hitErrorMs, 41);
});

test('judge: +80ms → great', () => {
  const { result, hitErrorMs } = JS.judge(1000, 1080);
  assert.equal(result, 'great');
  assert.equal(hitErrorMs, 80);
});

test('judge: +81ms → good', () => {
  const { result, hitErrorMs } = JS.judge(1000, 1081);
  assert.equal(result, 'good');
  assert.equal(hitErrorMs, 81);
});

test('judge: +120ms → good', () => {
  const { result, hitErrorMs } = JS.judge(1000, 1120);
  assert.equal(result, 'good');
  assert.equal(hitErrorMs, 120);
});

test('judge: +121ms → miss', () => {
  const { result, hitErrorMs } = JS.judge(1000, 1121);
  assert.equal(result, 'miss');
  assert.equal(hitErrorMs, 121);
});

test('judge: very late → miss', () => {
  const { result } = JS.judge(1000, 2000);
  assert.equal(result, 'miss');
});

// ─── カスタム閾値 ───────────────────────────────────────────────────────────

test('custom thresholds: perfect=20, great=50, good=80', () => {
  const custom = new JudgeSystem({ perfectMs: 20, greatMs: 50, goodMs: 80 });
  assert.equal(custom.classify(20), 'perfect');
  assert.equal(custom.classify(21), 'great');
  assert.equal(custom.classify(50), 'great');
  assert.equal(custom.classify(51), 'good');
  assert.equal(custom.classify(80), 'good');
  assert.equal(custom.classify(81), 'miss');
});

// ─── getter ──────────────────────────────────────────────────────────────────

test('getters return constructor values', () => {
  const js = new JudgeSystem({ perfectMs: 40, greatMs: 80, goodMs: 120 });
  assert.equal(js.perfectMs, 40);
  assert.equal(js.greatMs, 80);
  assert.equal(js.goodMs, 120);
});
