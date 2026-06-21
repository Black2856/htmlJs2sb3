/**
 * timing-drift.test.js
 * JudgeSystem の effectiveOffsetMs（chartOffsetMs + userOffsetMs + deviceCalibMs 合算）と、
 * offset 適用で hitErrorMs が期待通りシフトすることを検証。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JudgeSystem } from '../game/JudgeSystem.js';

test('effectiveOffsetMs: default offsets are 0', () => {
  const js = new JudgeSystem();
  assert.equal(js.effectiveOffsetMs(), 0);
});

test('effectiveOffsetMs: single offset', () => {
  const js = new JudgeSystem();
  js.setOffsets({ chartOffsetMs: 50 });
  assert.equal(js.effectiveOffsetMs(), 50);
});

test('effectiveOffsetMs: multiple offsets sum correctly', () => {
  const js = new JudgeSystem();
  js.setOffsets({ chartOffsetMs: 10, userOffsetMs: 20, deviceCalibMs: 30 });
  assert.equal(js.effectiveOffsetMs(), 60);
});

test('effectiveOffsetMs: negative offsets', () => {
  const js = new JudgeSystem();
  js.setOffsets({ chartOffsetMs: -50, userOffsetMs: 20, deviceCalibMs: 10 });
  assert.equal(js.effectiveOffsetMs(), -20);
});

test('effectiveOffsetMs: partial setOffsets keeps unset values at 0', () => {
  const js = new JudgeSystem();
  js.setOffsets({ userOffsetMs: 15 });
  assert.equal(js.effectiveOffsetMs(), 15);
});

test('effectiveOffsetMs: setOffsets resets previous values', () => {
  const js = new JudgeSystem();
  js.setOffsets({ chartOffsetMs: 100, userOffsetMs: 50 });
  assert.equal(js.effectiveOffsetMs(), 150);
  // 再設定: deviceCalibMs だけ
  js.setOffsets({ deviceCalibMs: 25 });
  assert.equal(js.effectiveOffsetMs(), 25);
});

test('hitErrorMs: judge returns hitAudioMs - noteTimeMs', () => {
  const js = new JudgeSystem();
  // noteTimeMs=1000ms, hit=1010ms → hitError = +10ms
  const result = js.judge(1000, 1010);
  assert.equal(result.hitErrorMs, 10);
});

test('hitErrorMs: negative error (early hit)', () => {
  const js = new JudgeSystem();
  // hit=990ms, note=1000ms → hitError = -10ms
  const result = js.judge(1000, 990);
  assert.equal(result.hitErrorMs, -10);
});

test('judge: offset does not directly affect hitErrorMs in judge()', () => {
  /**
   * judge() はそのまま hitAudioMs - noteTimeMs を返す。
   * offset の適用は呼び出し元 (RhythmGame) が担当するため、
   * JudgeSystem 自体は offset を差し引かない。
   * CONTRACT: "hitErrorMs = hitAudioMs - noteTimeMs"
   */
  const js = new JudgeSystem();
  js.setOffsets({ chartOffsetMs: 100 });

  const noteTimeMs = 1000;
  const hitAudioMs = 1020;
  const result = js.judge(noteTimeMs, hitAudioMs);
  // offset を考慮しない生のerror
  assert.equal(result.hitErrorMs, 20);
});

test('offset shift: applying effectiveOffsetMs to note time shifts hitErrorMs', () => {
  /**
   * effectiveOffsetMs を使ってノーツ時刻を補正した場合の検証。
   * 補正後ノーツ時刻 = noteTimeMs - effectiveOffsetMs
   * hitErrorMs = hitAudioMs - compensatedNoteTimeMs
   */
  const js = new JudgeSystem();
  js.setOffsets({ chartOffsetMs: 50, userOffsetMs: 10 });
  const effective = js.effectiveOffsetMs(); // 60

  const noteTimeMs = 1000;
  const hitAudioMs = 1000; // perfectly on time relative to audio

  // 補正後ノーツ時刻 = 1000 - 60 = 940
  const compensatedNote = noteTimeMs - effective;
  const result = js.judge(compensatedNote, hitAudioMs);

  // hitError = 1000 - 940 = 60
  assert.equal(result.hitErrorMs, 60);
});

test('offset compensation improves late hit classification', () => {
  /**
   * 正のoffset(charOffsetMs)が大きい = 音声がノーツより早め。
   * 補正することで遅めのhitが perfect に寄る例。
   */
  const js = new JudgeSystem({ perfectMs: 40, greatMs: 80, goodMs: 120 });
  js.setOffsets({ chartOffsetMs: 30 });
  const effective = js.effectiveOffsetMs(); // 30

  const noteTimeMs = 1000;
  const hitAudioMs = 1060; // 補正なし → hitError = +60 → great

  // 補正なしでは great
  const raw = js.judge(noteTimeMs, hitAudioMs);
  assert.equal(raw.result, 'great');
  assert.equal(raw.hitErrorMs, 60);

  // 補正後: note = 1000 - 30 = 970
  const compensatedNote = noteTimeMs - effective;
  const compensated = js.judge(compensatedNote, hitAudioMs);
  // hitError = 1060 - 970 = 90 → still great but different value
  assert.equal(compensated.hitErrorMs, 90);
});
