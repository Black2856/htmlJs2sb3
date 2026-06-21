#!/usr/bin/env node
/**
 * _verify.mjs
 * Reads dist/project.json and verifies sb3 structural integrity.
 * Exits 0 with "SB3 VERIFY OK" if all checks pass; exits 1 with errors otherwise.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectPath = resolve(__dirname, '../dist/project.json');

let project;
try {
  project = JSON.parse(readFileSync(projectPath, 'utf8'));
} catch (e) {
  console.error(`Failed to read ${projectPath}: ${e.message}`);
  process.exit(1);
}

const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const { targets } = project;

// 1. targets[0].isStage === true
assert(targets && targets.length > 0 && targets[0].isStage === true,
  'targets[0].isStage must be true');

const stage = targets[0];

// 2. Stage has broadcasts with song_start, spawn_note, note_judged
{
  const bc = stage.broadcasts || {};
  const names = Object.values(bc);
  for (const name of ['song_start', 'spawn_note', 'note_judged']) {
    assert(names.includes(name), `Stage.broadcasts missing: ${name}`);
  }
  assert(Object.keys(bc).length >= 3, `Stage should have >=3 broadcasts, got ${Object.keys(bc).length}`);
}

// 3. Stage variables: score, combo, maxCombo, fps
{
  const vars = stage.variables || {};
  const varNames = Object.values(vars).map(v => v[0]);
  for (const name of ['score', 'combo', 'maxCombo', 'fps']) {
    assert(varNames.includes(name), `Stage.variables missing: ${name}`);
  }
}

// 4. Note sprite exists
{
  const noteTarget = targets.find(t => t.name === 'Note');
  assert(noteTarget !== undefined, 'No target named "Note" found');
}

// Per-target block checks
for (const target of targets) {
  const blocks = target.blocks || {};
  const blockIds = new Set(Object.keys(blocks));

  for (const [bid, block] of Object.entries(blocks)) {
    // 5. topLevel blocks must have x and y
    if (block.topLevel === true) {
      assert(typeof block.x === 'number', `Block ${bid} (topLevel) missing x`);
      assert(typeof block.y === 'number', `Block ${bid} (topLevel) missing y`);
    }

    // 6. next/parent/inputs references must exist in blocks (no dangling)
    if (block.next !== null && block.next !== undefined) {
      assert(blockIds.has(block.next), `Block ${bid}.next="${block.next}" not in blocks`);
    }
    if (block.parent !== null && block.parent !== undefined) {
      assert(blockIds.has(block.parent), `Block ${bid}.parent="${block.parent}" not in blocks`);
    }
    // inputs: check block references (not primitives)
    for (const [inputName, inputVal] of Object.entries(block.inputs || {})) {
      if (!Array.isArray(inputVal)) continue;
      // inputVal[1] might be a blockId string or a primitive array
      const second = inputVal[1];
      if (typeof second === 'string') {
        assert(blockIds.has(second), `Block ${bid}.inputs.${inputName}[1]="${second}" not in blocks`);
      } else if (Array.isArray(second)) {
        // It's a primitive — ok
      }
      // inputVal[2] (shadow fallback)
      const third = inputVal[2];
      if (typeof third === 'string') {
        assert(blockIds.has(third), `Block ${bid}.inputs.${inputName}[2]="${third}" not in blocks`);
      }
    }
  }

  // 7. procedures_call mutation.proccode matches a procedures_prototype
  const protoCodes = new Set();
  for (const block of Object.values(blocks)) {
    if (block.opcode === 'procedures_prototype' && block.mutation) {
      protoCodes.add(block.mutation.proccode);
    }
  }
  for (const [bid, block] of Object.entries(blocks)) {
    if (block.opcode === 'procedures_call' && block.mutation) {
      assert(
        protoCodes.has(block.mutation.proccode),
        `Block ${bid} procedures_call proccode "${block.mutation.proccode}" has no matching prototype`
      );
    }
  }
}

if (errors.length > 0) {
  console.error('SB3 VERIFY FAILED:');
  errors.forEach(e => console.error('  ' + e));
  process.exit(1);
} else {
  console.log('SB3 VERIFY OK');
  process.exit(0);
}
