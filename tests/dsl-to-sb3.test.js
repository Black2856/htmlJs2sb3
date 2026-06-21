/**
 * dsl-to-sb3.test.js
 * Sb3Generator(sample DSL).build() の project.json 構造検証。
 * - targets[0].isStage
 * - Stage に broadcasts
 * - 各 target の blocks で parent/next/input 参照のダングリングゼロ
 * - procedures_call.mutation.proccode が prototype と一致
 * - 変数/リストの id 整合
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sb3Generator } from '../tools/generate-sb3.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dslPath = resolve(__dirname, '../spec/scratch-rhythm.dsl.json');
const sampleDsl = JSON.parse(readFileSync(dslPath, 'utf8'));

// ─── build() 基本構造 ──────────────────────────────────────────────────────

let project;

test('Sb3Generator.build() returns object without throwing', () => {
  assert.doesNotThrow(() => {
    const gen = new Sb3Generator(sampleDsl);
    project = gen.build();
  });
});

test('project has required top-level keys', () => {
  assert.ok('targets' in project, 'targets が存在するはず');
  assert.ok('monitors' in project);
  assert.ok('extensions' in project);
  assert.ok('meta' in project);
});

test('targets[0].isStage is true', () => {
  assert.equal(project.targets[0].isStage, true);
});

test('Stage target has broadcasts', () => {
  const stage = project.targets[0];
  assert.ok('broadcasts' in stage, 'Stage に broadcasts が存在するはず');
  assert.equal(typeof stage.broadcasts, 'object');
});

test('stage broadcasts contains all DSL broadcasts', () => {
  const stage = project.targets[0];
  const broadcastValues = Object.values(stage.broadcasts);
  for (const name of sampleDsl.broadcasts) {
    assert.ok(broadcastValues.includes(name), `broadcasts に "${name}" が含まれるはず`);
  }
});

test('targets array has stage + all sprites', () => {
  // stage(1) + sprites(1 = Note)
  assert.equal(project.targets.length, 1 + sampleDsl.sprites.length);
});

// ─── 変数/リスト id 整合 ─────────────────────────────────────────────────

test('stage variable ids are consistent in variables map', () => {
  const stage = project.targets[0];
  for (const [id, [name]] of Object.entries(stage.variables)) {
    assert.ok(typeof id === 'string' && id.length > 0, 'variable id が文字列');
    assert.ok(typeof name === 'string' && name.length > 0, 'variable name が文字列');
  }
});

test('stage list ids are consistent', () => {
  const stage = project.targets[0];
  for (const [id, [name, items]] of Object.entries(stage.lists)) {
    assert.ok(typeof id === 'string' && id.length > 0, 'list id が文字列');
    assert.ok(typeof name === 'string' && name.length > 0, 'list name が文字列');
    assert.ok(Array.isArray(items), 'list items が配列');
  }
});

test('stage variables from DSL are present', () => {
  const stage = project.targets[0];
  const varNames = Object.values(stage.variables).map(([n]) => n);
  for (const v of Object.keys(sampleDsl.stage.variables)) {
    assert.ok(varNames.includes(v), `Stage 変数 "${v}" が含まれるはず`);
  }
});

test('stage lists from DSL are present', () => {
  const stage = project.targets[0];
  const listNames = Object.values(stage.lists).map(([n]) => n);
  for (const l of Object.keys(sampleDsl.stage.lists)) {
    assert.ok(listNames.includes(l), `Stage リスト "${l}" が含まれるはず`);
  }
});

test('sprite variable ids are consistent', () => {
  for (const target of project.targets.slice(1)) {
    for (const [id, [name]] of Object.entries(target.variables)) {
      assert.ok(typeof id === 'string' && id.length > 0);
      assert.ok(typeof name === 'string');
    }
  }
});

// ─── blocks 構造: parent/next 参照の整合性 ───────────────────────────────

function checkBlockRefs(blocks, targetName) {
  const blockIds = new Set(Object.keys(blocks));
  for (const [id, block] of Object.entries(blocks)) {
    // next 参照が dangling でないこと
    if (block.next !== null && block.next !== undefined) {
      assert.ok(
        blockIds.has(block.next),
        `${targetName}: block "${id}" の next="${block.next}" が存在しない`
      );
    }
    // parent 参照が dangling でないこと（topLevel でない場合）
    if (!block.topLevel && block.parent !== null && block.parent !== undefined) {
      assert.ok(
        blockIds.has(block.parent),
        `${targetName}: block "${id}" の parent="${block.parent}" が存在しない`
      );
    }
    // inputs の中のブロック参照チェック
    for (const [inputKey, inputVal] of Object.entries(block.inputs || {})) {
      if (!Array.isArray(inputVal)) continue;
      // inputVal は [type, ref, ...] 形式
      const ref = inputVal[1];
      if (typeof ref === 'string') {
        assert.ok(
          blockIds.has(ref),
          `${targetName}: block "${id}" input "${inputKey}" ref="${ref}" が存在しない`
        );
      }
      // SUBSTACK: [2, blockId]
      if (inputKey === 'SUBSTACK' || inputKey === 'SUBSTACK2') {
        if (typeof inputVal[1] === 'string') {
          assert.ok(
            blockIds.has(inputVal[1]),
            `${targetName}: block "${id}" ${inputKey}="${inputVal[1]}" が存在しない`
          );
        }
      }
    }
  }
}

test('stage blocks: no dangling parent/next/input references', () => {
  const stage = project.targets[0];
  checkBlockRefs(stage.blocks, 'Stage');
});

test('sprite blocks: no dangling parent/next/input references', () => {
  for (const target of project.targets.slice(1)) {
    checkBlockRefs(target.blocks, target.name);
  }
});

// ─── procedures_call と prototype の proccode 整合 ────────────────────────

function collectProccodes(blocks) {
  const prototypeProccodes = new Map(); // prototypeId -> proccode
  const callProccodes = [];

  for (const [id, block] of Object.entries(blocks)) {
    if (block.opcode === 'procedures_prototype') {
      prototypeProccodes.set(id, block.mutation?.proccode);
    }
    if (block.opcode === 'procedures_call') {
      callProccodes.push({ id, proccode: block.mutation?.proccode });
    }
  }
  return { prototypeProccodes, callProccodes };
}

test('stage: procedures_call proccode matches prototype proccode', () => {
  const stage = project.targets[0];
  const { prototypeProccodes, callProccodes } = collectProccodes(stage.blocks);

  // プロトタイプが存在する場合、calls と proccode が一致するか確認
  const knownProccodes = new Set(prototypeProccodes.values());

  for (const call of callProccodes) {
    assert.ok(
      knownProccodes.has(call.proccode),
      `Stage: procedures_call proccode "${call.proccode}" が prototype に存在しない`
    );
  }
});

test('stage: procedures_definition has custom_block input pointing to prototype', () => {
  const stage = project.targets[0];
  const blocks = stage.blocks;

  for (const [id, block] of Object.entries(blocks)) {
    if (block.opcode !== 'procedures_definition') continue;
    const customBlockInput = block.inputs?.custom_block;
    assert.ok(customBlockInput, `procedures_definition "${id}" に custom_block input が必要`);
    const protoId = customBlockInput[1];
    assert.ok(
      typeof protoId === 'string' && blocks[protoId]?.opcode === 'procedures_prototype',
      `procedures_definition "${id}" の custom_block が prototype を指していない`
    );
  }
});

// ─── meta 検証 ────────────────────────────────────────────────────────────

test('meta.semver is 3.0.0', () => {
  assert.equal(project.meta.semver, '3.0.0');
});

// ─── costume / sound 構造 ─────────────────────────────────────────────────

test('stage costumes have required fields', () => {
  const stage = project.targets[0];
  for (const c of stage.costumes) {
    assert.ok('assetId' in c, 'assetId が存在するはず');
    assert.ok('name' in c);
    assert.ok('dataFormat' in c);
    assert.ok('md5ext' in c);
  }
});

test('sprite costumes have required fields', () => {
  for (const target of project.targets.slice(1)) {
    for (const c of target.costumes) {
      assert.ok('assetId' in c);
      assert.ok('name' in c);
      assert.ok('dataFormat' in c);
    }
  }
});

// ─── hat block 検証 ──────────────────────────────────────────────────────

test('stage has green_flag hat block (event_whenflagclicked)', () => {
  const stage = project.targets[0];
  const hats = Object.values(stage.blocks).filter(b => b.opcode === 'event_whenflagclicked');
  assert.ok(hats.length > 0, 'event_whenflagclicked が Stage blocks に存在するはず');
});

test('stage has receive hat for song_start', () => {
  const stage = project.targets[0];
  const hats = Object.values(stage.blocks).filter(b => b.opcode === 'event_whenbroadcastreceived');
  assert.ok(hats.length > 0, 'event_whenbroadcastreceived が Stage blocks に存在するはず');
});

test('note sprite has clone_start hat', () => {
  const note = project.targets.find(t => t.name === 'Note');
  assert.ok(note, 'Note sprite が存在するはず');
  const hats = Object.values(note.blocks).filter(b => b.opcode === 'control_start_as_clone');
  assert.ok(hats.length > 0, 'control_start_as_clone が Note blocks に存在するはず');
});
