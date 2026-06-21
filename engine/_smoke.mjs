/**
 * engine/_smoke.mjs
 * Smoke test: runs scratch-rhythm.dsl.json headlessly for 500 frames
 * and verifies core behaviors: variables, sounds, clones.
 *
 * Usage: node engine/_smoke.mjs
 */
import { readFileSync } from 'fs';
import { Runtime } from './Runtime.js';

// ─── Load DSL ─────────────────────────────────────────────────────────────
const dsl = JSON.parse(
  readFileSync(new URL('../spec/scratch-rhythm.dsl.json', import.meta.url))
);

// ─── Build runtime (headless) ─────────────────────────────────────────────
const runtime = new Runtime({ canvas: null, soundBridge: null });
runtime.loadProject(dsl);

// ─── Inject SoundBridge stubs ─────────────────────────────────────────────
const playCalls = [];

runtime.sound.play = (name, opts) => {
  playCalls.push(name);
  return { stop: () => {} };
};

runtime.sound.playUntilDone = (name, opts) => {
  playCalls.push(name);
  return Promise.resolve();
};

// ─── greenFlag ────────────────────────────────────────────────────────────
runtime.greenFlag();

// ─── Simulate 500 frames ──────────────────────────────────────────────────
let cloneWasCreated = false;
let cloneWasDeleted = false;
let maxClones = 0;

for (let i = 0; i < 500; i++) {
  runtime.stepFrame();

  const total = runtime.clones.total();
  if (total > maxClones) maxClones = total;
  if (total > 0) cloneWasCreated = true;
  if (cloneWasCreated && total < maxClones) cloneWasDeleted = true;
}

// ─── Assertions ───────────────────────────────────────────────────────────
const stage = runtime.getTargetByName('Stage');

let allPassed = true;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    allPassed = false;
  } else {
    console.log(`PASS: ${message}`);
  }
}

assert(stage !== null, 'Stage target exists');
assert(stage.variables.has('score'), 'score variable exists on Stage');
assert(stage.variables.has('combo'), 'combo variable exists on Stage');
assert(
  playCalls.includes('song_main') || playCalls.length > 0,
  `playSound was called (calls: ${JSON.stringify(playCalls)})`
);
assert(
  cloneWasCreated,
  `clones were created (max=${maxClones})`
);

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\nResults:`);
console.log(`  score     = ${stage.variables.get('score')}`);
console.log(`  combo     = ${stage.variables.get('combo')}`);
console.log(`  maxClones = ${maxClones}`);
console.log(`  playCalls = ${JSON.stringify(playCalls)}`);
console.log(`  cloneWasDeleted = ${cloneWasDeleted}`);

if (allPassed) {
  console.log('\nSMOKE OK');
  process.exit(0);
} else {
  console.error('\nSMOKE FAILED');
  process.exit(1);
}
