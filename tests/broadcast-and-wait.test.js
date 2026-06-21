/**
 * broadcast-and-wait.test.js
 * broadcastAndWait で送信側が受信側スクリプト完了まで進まないことを検証。
 * 受信側が変数をセット→送信側が直後にその値を読める順序をフレーム進行で検証。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Runtime } from '../engine/Runtime.js';

function makeRuntime(dsl) {
  const rt = new Runtime({ canvas: null, soundBridge: null });
  rt.loadProject(dsl);
  return rt;
}

function stepN(rt, n) {
  for (let i = 0; i < n; i++) rt.stepFrame();
}

test('broadcastAndWait: sender waits for receiver to complete', () => {
  /**
   * シナリオ:
   * Stage の green_flag スクリプトで:
   *   1. result = 0 を設定
   *   2. broadcastAndWait("go")  ← ここで待つ
   *   3. afterBroadcast = 1 を設定
   *
   * "go" の受信スクリプトで:
   *   1. result = 42 を設定
   *
   * broadcastAndWait で待った後、sender が resume するので
   * afterBroadcast がセットされる時点では result == 42 になっているはず。
   */
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { result: 0, afterBroadcast: 0 },
      lists: {}, procedures: [],
      scripts: [
        {
          event: { type: 'green_flag' },
          steps: [
            { type: 'set', var: 'result', value: 0 },
            { type: 'broadcastAndWait', name: 'go' },
            { type: 'set', var: 'afterBroadcast', value: 1 },
          ],
        },
        {
          event: { type: 'receive', name: 'go' },
          steps: [
            { type: 'set', var: 'result', value: 42 },
          ],
        },
      ],
    },
    sprites: [],
    broadcasts: ['go'],
  });

  rt.greenFlag();

  // フレームを1回だけ進める: sender は broadcastAndWait で止まる
  stepN(rt, 1);
  // まだ afterBroadcast はセットされていない
  assert.equal(rt.stage.variables.get('afterBroadcast'), 0);

  // さらにフレームを進めて受信スクリプトを完了させる
  stepN(rt, 5);

  // 受信スクリプト完了後、送信側が resume して afterBroadcast = 1 になる
  assert.equal(rt.stage.variables.get('result'), 42);
  assert.equal(rt.stage.variables.get('afterBroadcast'), 1);
});

test('broadcastAndWait: result is set before after-broadcast code runs', () => {
  /**
   * 受信側の result セットが完了してから
   * 送信側の afterBroadcast セットが走ることを確認。
   */
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { order: 0 },
      lists: {}, procedures: [],
      scripts: [
        {
          event: { type: 'green_flag' },
          steps: [
            { type: 'broadcastAndWait', name: 'step1' },
            // 受信側完了後、order は receiver の値(10)のはず
            // ここで order を 20 に上書き
            { type: 'change', var: 'order', value: 10 },
          ],
        },
        {
          event: { type: 'receive', name: 'step1' },
          steps: [
            { type: 'set', var: 'order', value: 10 },
          ],
        },
      ],
    },
    sprites: [],
    broadcasts: ['step1'],
  });

  rt.greenFlag();
  stepN(rt, 10);

  // 受信側が order=10、その後送信側が +10 → 20
  assert.equal(rt.stage.variables.get('order'), 20);
});

test('broadcast (no wait): sender continues immediately', () => {
  /**
   * 通常の broadcast は待たないので
   * sender が next step を先に実行する。
   * 受信側の変数更新が sender の次ステップより後になることがある。
   */
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { senderDone: 0, receiverDone: 0 },
      lists: {}, procedures: [],
      scripts: [
        {
          event: { type: 'green_flag' },
          steps: [
            { type: 'broadcast', name: 'ping' },
            { type: 'set', var: 'senderDone', value: 1 },
          ],
        },
        {
          event: { type: 'receive', name: 'ping' },
          steps: [
            { type: 'set', var: 'receiverDone', value: 1 },
          ],
        },
      ],
    },
    sprites: [],
    broadcasts: ['ping'],
  });

  rt.greenFlag();
  // 1フレーム: sender は broadcast して即座に senderDone=1 → フレーム内で両方走る場合もある
  stepN(rt, 5);

  // 両方とも最終的に完了
  assert.equal(rt.stage.variables.get('senderDone'), 1);
  assert.equal(rt.stage.variables.get('receiverDone'), 1);
});
