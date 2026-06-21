/**
 * block-execution.test.js
 * ヘッドレスRuntimeで簡単なDSLスクリプト（set/change/if/repeat/演算reporter）を
 * 実行し、変数結果を検証する。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Runtime } from '../engine/Runtime.js';

/**
 * ヘッドレスRuntimeを構築してDSLをロードする
 */
function makeRuntime(dsl) {
  const rt = new Runtime({ canvas: null, soundBridge: null });
  rt.loadProject(dsl);
  return rt;
}

/**
 * N フレーム進める
 */
function stepN(rt, n) {
  for (let i = 0; i < n; i++) rt.stepFrame();
}

// ─── set / change ─────────────────────────────────────────────────────────

test('set variable sets value', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { x: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'set', var: 'x', value: 42 }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('x'), 42);
});

test('change variable adds delta', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { n: 10 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'change', var: 'n', value: 5 }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('n'), 15);
});

// ─── if ─────────────────────────────────────────────────────────────────────

test('if true branch executes', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { result: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{
          type: 'if',
          condition: { op: 'eq', a: 1, b: 1 },
          then: [{ type: 'set', var: 'result', value: 99 }],
        }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('result'), 99);
});

test('if false branch does not execute', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { result: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{
          type: 'if',
          condition: { op: 'eq', a: 1, b: 2 },
          then: [{ type: 'set', var: 'result', value: 99 }],
        }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('result'), 0);
});

// ─── ifElse ─────────────────────────────────────────────────────────────────

test('ifElse else branch executes', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { v: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{
          type: 'ifElse',
          condition: { op: 'lt', a: 5, b: 3 },
          then: [{ type: 'set', var: 'v', value: 1 }],
          else: [{ type: 'set', var: 'v', value: 2 }],
        }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('v'), 2);
});

// ─── repeat ─────────────────────────────────────────────────────────────────

test('repeat increments N times', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { cnt: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{
          type: 'repeat', times: 5,
          steps: [{ type: 'change', var: 'cnt', value: 1 }],
        }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  // repeatは各反復後にframeを1回yield→5回ループには少なくとも6フレーム必要
  stepN(rt, 10);
  assert.equal(rt.stage.variables.get('cnt'), 5);
});

// ─── 演算 reporters ─────────────────────────────────────────────────────────

test('arithmetic reporters: add/sub/mul/div', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { a: 0, b: 0, c: 0, d: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [
          { type: 'set', var: 'a', value: { op: 'add', a: 3, b: 4 } },
          { type: 'set', var: 'b', value: { op: 'sub', a: 10, b: 3 } },
          { type: 'set', var: 'c', value: { op: 'mul', a: 6, b: 7 } },
          { type: 'set', var: 'd', value: { op: 'div', a: 10, b: 2 } },
        ],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('a'), 7);
  assert.equal(rt.stage.variables.get('b'), 7);
  assert.equal(rt.stage.variables.get('c'), 42);
  assert.equal(rt.stage.variables.get('d'), 5);
});

test('mod reporter', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { v: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'set', var: 'v', value: { op: 'mod', a: 10, b: 3 } }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('v'), 1);
});

test('join reporter', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { v: '' }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'set', var: 'v', value: { op: 'join', a: 'Hello', b: 'World' } }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('v'), 'HelloWorld');
});

test('var reporter reads variable', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { src: 77, dst: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [
          { type: 'set', var: 'dst', value: { op: 'var', name: 'src' } },
        ],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('dst'), 77);
});

test('mathop abs', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { v: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'set', var: 'v', value: { op: 'mathop', fn: 'abs', n: -42 } }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('v'), 42);
});

test('round reporter', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { v: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'set', var: 'v', value: { op: 'round', n: 3.7 } }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('v'), 4);
});

test('not reporter', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { v: 0 }, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{
          type: 'set', var: 'v',
          value: { op: 'not', a: false },
        }],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.stage.variables.get('v'), true);
});

// ─── procedure call ─────────────────────────────────────────────────────────

test('procedure call with argument', () => {
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { total: 0 }, lists: {}, procedures: [
        {
          name: 'addNum',
          params: [{ name: 'n', type: 'number' }],
          warp: false,
          steps: [{ type: 'change', var: 'total', value: { op: 'arg', name: 'n' } }],
        },
      ],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [
          { type: 'call', proc: 'addNum', args: { n: 10 } },
          { type: 'call', proc: 'addNum', args: { n: 20 } },
        ],
      }],
    },
    sprites: [],
    broadcasts: [],
  });
  rt.greenFlag();
  stepN(rt, 5);
  assert.equal(rt.stage.variables.get('total'), 30);
});
