/**
 * clone-lifecycle.test.js
 * createClone でクローン生成＆clone_start起動、deleteClone もしくは条件でクローン削除、
 * CloneManager.total()/countFor() の増減を検証。
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

test('createClone creates a clone and increments total()', () => {
  const rt = makeRuntime({
    stage: { name: 'Stage', isStage: true, variables: {}, lists: {}, procedures: [], scripts: [] },
    sprites: [{
      name: 'Sprite1', isStage: false,
      x: 0, y: 0, size: 100, direction: 90, visible: true, draggable: false, rotationStyle: 'all around',
      currentCostume: 0, costumes: [], sounds: [],
      variables: {}, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'createClone', target: 'myself' }],
      }],
    }],
    broadcasts: [],
  });

  assert.equal(rt.clones.total(), 0);
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.clones.total(), 1);
});

test('countFor returns count for specific sprite name', () => {
  const rt = makeRuntime({
    stage: { name: 'Stage', isStage: true, variables: {}, lists: {}, procedures: [], scripts: [] },
    sprites: [{
      name: 'Note', isStage: false,
      x: 0, y: 0, size: 100, direction: 90, visible: true, draggable: false, rotationStyle: 'all around',
      currentCostume: 0, costumes: [], sounds: [],
      variables: {}, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [
          { type: 'createClone', target: 'myself' },
          { type: 'createClone', target: 'myself' },
          { type: 'createClone', target: 'myself' },
        ],
      }],
    }],
    broadcasts: [],
  });

  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.clones.countFor('Note'), 3);
  assert.equal(rt.clones.total(), 3);
});

test('clone_start script runs for new clone', () => {
  /**
   * クローン開始時に変数を Stage に書き込んでクローン起動を確認
   */
  const rt = makeRuntime({
    stage: {
      name: 'Stage', isStage: true,
      variables: { cloneStarted: 0 }, lists: {}, procedures: [],
      scripts: [],
    },
    sprites: [{
      name: 'Sprite1', isStage: false,
      x: 0, y: 0, size: 100, direction: 90, visible: true, draggable: false, rotationStyle: 'all around',
      currentCostume: 0, costumes: [], sounds: [],
      variables: {}, lists: {}, procedures: [],
      scripts: [
        {
          event: { type: 'green_flag' },
          steps: [{ type: 'createClone', target: 'myself' }],
        },
        {
          event: { type: 'clone_start' },
          steps: [
            { type: 'set', var: 'cloneStarted', value: 99 },
          ],
        },
      ],
    }],
    broadcasts: [],
  });

  rt.greenFlag();
  stepN(rt, 5);
  assert.equal(rt.stage.variables.get('cloneStarted'), 99);
});

test('deleteClone removes clone and decrements total()', () => {
  const rt = makeRuntime({
    stage: { name: 'Stage', isStage: true, variables: {}, lists: {}, procedures: [], scripts: [] },
    sprites: [{
      name: 'Sprite1', isStage: false,
      x: 0, y: 0, size: 100, direction: 90, visible: true, draggable: false, rotationStyle: 'all around',
      currentCostume: 0, costumes: [], sounds: [],
      variables: {}, lists: {}, procedures: [],
      scripts: [
        {
          event: { type: 'green_flag' },
          steps: [{ type: 'createClone', target: 'myself' }],
        },
        {
          event: { type: 'clone_start' },
          steps: [{ type: 'deleteClone' }],
        },
      ],
    }],
    broadcasts: [],
  });

  rt.greenFlag();
  stepN(rt, 2);
  // clone_start が走るのは createClone の後のフレームで
  // deleteClone がそのフレームで実行される
  stepN(rt, 5);
  assert.equal(rt.clones.total(), 0);
});

test('greenFlag resets clones', () => {
  const rt = makeRuntime({
    stage: { name: 'Stage', isStage: true, variables: {}, lists: {}, procedures: [], scripts: [] },
    sprites: [{
      name: 'Sprite1', isStage: false,
      x: 0, y: 0, size: 100, direction: 90, visible: true, draggable: false, rotationStyle: 'all around',
      currentCostume: 0, costumes: [], sounds: [],
      variables: {}, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'createClone', target: 'myself' }],
      }],
    }],
    broadcasts: [],
  });

  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.clones.total(), 1);

  // 再び greenFlag するとクローンがリセット
  rt.greenFlag();
  assert.equal(rt.clones.total(), 0);
  stepN(rt, 2);
  assert.equal(rt.clones.total(), 1);
});

test('clone is added to runtime.targets', () => {
  const rt = makeRuntime({
    stage: { name: 'Stage', isStage: true, variables: {}, lists: {}, procedures: [], scripts: [] },
    sprites: [{
      name: 'Sprite1', isStage: false,
      x: 0, y: 0, size: 100, direction: 90, visible: true, draggable: false, rotationStyle: 'all around',
      currentCostume: 0, costumes: [], sounds: [],
      variables: {}, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'createClone', target: 'myself' }],
      }],
    }],
    broadcasts: [],
  });

  const initialCount = rt.targets.length;
  rt.greenFlag();
  stepN(rt, 2);
  assert.equal(rt.targets.length, initialCount + 1);
  // クローンは isClone=true
  const clone = rt.targets.find(t => t.isClone);
  assert.ok(clone, 'クローンがruntime.targetsに存在するはず');
  assert.equal(clone.isClone, true);
});

test('CloneManager.deleteClone removes from targets', () => {
  const rt = makeRuntime({
    stage: { name: 'Stage', isStage: true, variables: {}, lists: {}, procedures: [], scripts: [] },
    sprites: [{
      name: 'Sprite1', isStage: false,
      x: 0, y: 0, size: 100, direction: 90, visible: true, draggable: false, rotationStyle: 'all around',
      currentCostume: 0, costumes: [], sounds: [],
      variables: {}, lists: {}, procedures: [],
      scripts: [{
        event: { type: 'green_flag' },
        steps: [{ type: 'createClone', target: 'myself' }],
      }],
    }],
    broadcasts: [],
  });

  rt.greenFlag();
  stepN(rt, 2);
  const clone = rt.targets.find(t => t.isClone);
  assert.ok(clone);

  const before = rt.targets.length;
  rt.clones.deleteClone(clone);
  assert.equal(rt.targets.length, before - 1);
  assert.equal(rt.clones.total(), 0);
});
