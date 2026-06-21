/**
 * variable-list.test.js
 * VariableStore と ListStore の単体テスト。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VariableStore } from '../engine/VariableStore.js';
import { ListStore } from '../engine/ListStore.js';

// ═══════════════════════════════════════════════════════════
// VariableStore
// ═══════════════════════════════════════════════════════════

test('VariableStore: define and get', () => {
  const vs = new VariableStore();
  vs.define('score', 100);
  assert.equal(vs.get('score'), 100);
});

test('VariableStore: define with default value 0', () => {
  const vs = new VariableStore();
  vs.define('x');
  assert.equal(vs.get('x'), 0);
});

test('VariableStore: has() true/false', () => {
  const vs = new VariableStore();
  vs.define('a', 1);
  assert.equal(vs.has('a'), true);
  assert.equal(vs.has('b'), false);
});

test('VariableStore: get undefined returns 0', () => {
  const vs = new VariableStore();
  assert.equal(vs.get('nonexistent'), 0);
});

test('VariableStore: set changes value', () => {
  const vs = new VariableStore();
  vs.define('v', 5);
  vs.set('v', 42);
  assert.equal(vs.get('v'), 42);
});

test('VariableStore: set on undefined variable does nothing', () => {
  const vs = new VariableStore();
  vs.set('ghost', 99);
  assert.equal(vs.get('ghost'), 0);
});

test('VariableStore: change adds delta', () => {
  const vs = new VariableStore();
  vs.define('n', 10);
  vs.change('n', 5);
  assert.equal(vs.get('n'), 15);
});

test('VariableStore: change with non-numeric delta treats as 0', () => {
  const vs = new VariableStore();
  vs.define('n', 10);
  vs.change('n', 'abc');
  assert.equal(vs.get('n'), 10);
});

test('VariableStore: showMonitor / isMonitorVisible / hideMonitor', () => {
  const vs = new VariableStore();
  vs.define('v');
  assert.equal(vs.isMonitorVisible('v'), false);
  vs.showMonitor('v');
  assert.equal(vs.isMonitorVisible('v'), true);
  vs.hideMonitor('v');
  assert.equal(vs.isMonitorVisible('v'), false);
});

test('VariableStore: names() returns all defined names', () => {
  const vs = new VariableStore();
  vs.define('a');
  vs.define('b');
  vs.define('c');
  assert.deepEqual(vs.names().sort(), ['a', 'b', 'c']);
});

test('VariableStore: snapshot() returns current values', () => {
  const vs = new VariableStore();
  vs.define('x', 10);
  vs.define('y', 20);
  const snap = vs.snapshot();
  assert.equal(snap.x, 10);
  assert.equal(snap.y, 20);
});

// ═══════════════════════════════════════════════════════════
// ListStore
// ═══════════════════════════════════════════════════════════

test('ListStore: define and get initial items', () => {
  const ls = new ListStore();
  ls.define('myList', [1, 2, 3]);
  const arr = ls.get('myList');
  assert.deepEqual(arr, [1, 2, 3]);
});

test('ListStore: has() true/false', () => {
  const ls = new ListStore();
  ls.define('L1');
  assert.equal(ls.has('L1'), true);
  assert.equal(ls.has('L2'), false);
});

test('ListStore: add appends to end', () => {
  const ls = new ListStore();
  ls.define('L', []);
  ls.add('L', 'a');
  ls.add('L', 'b');
  assert.deepEqual(ls.get('L'), ['a', 'b']);
});

test('ListStore: itemAt 1-indexed', () => {
  const ls = new ListStore();
  ls.define('L', ['x', 'y', 'z']);
  assert.equal(ls.itemAt('L', 1), 'x');
  assert.equal(ls.itemAt('L', 2), 'y');
  assert.equal(ls.itemAt('L', 3), 'z');
});

test('ListStore: itemAt out of range returns ""', () => {
  const ls = new ListStore();
  ls.define('L', ['a', 'b']);
  assert.equal(ls.itemAt('L', 0), '');
  assert.equal(ls.itemAt('L', 3), '');
  assert.equal(ls.itemAt('L', -1), '');
});

test('ListStore: length returns correct count', () => {
  const ls = new ListStore();
  ls.define('L', [1, 2, 3, 4, 5]);
  assert.equal(ls.length('L'), 5);
});

test('ListStore: deleteAt 1-indexed removes item', () => {
  const ls = new ListStore();
  ls.define('L', ['a', 'b', 'c']);
  ls.deleteAt('L', 2);
  assert.deepEqual(ls.get('L'), ['a', 'c']);
});

test('ListStore: deleteAt out of range does nothing', () => {
  const ls = new ListStore();
  ls.define('L', ['a', 'b']);
  ls.deleteAt('L', 0);
  ls.deleteAt('L', 5);
  assert.deepEqual(ls.get('L'), ['a', 'b']);
});

test('ListStore: deleteAt "all" clears list', () => {
  const ls = new ListStore();
  ls.define('L', [1, 2, 3]);
  ls.deleteAt('L', 'all');
  assert.equal(ls.length('L'), 0);
});

test('ListStore: deleteAll clears list', () => {
  const ls = new ListStore();
  ls.define('L', [1, 2, 3]);
  ls.deleteAll('L');
  assert.equal(ls.length('L'), 0);
});

test('ListStore: insertAt 1-indexed inserts correctly', () => {
  const ls = new ListStore();
  ls.define('L', ['a', 'c']);
  ls.insertAt('L', 2, 'b');
  assert.deepEqual(ls.get('L'), ['a', 'b', 'c']);
});

test('ListStore: insertAt at position 1', () => {
  const ls = new ListStore();
  ls.define('L', ['b', 'c']);
  ls.insertAt('L', 1, 'a');
  assert.deepEqual(ls.get('L'), ['a', 'b', 'c']);
});

test('ListStore: insertAt at end', () => {
  const ls = new ListStore();
  ls.define('L', ['a', 'b']);
  ls.insertAt('L', 3, 'c');
  assert.deepEqual(ls.get('L'), ['a', 'b', 'c']);
});

test('ListStore: replaceAt 1-indexed replaces correctly', () => {
  const ls = new ListStore();
  ls.define('L', ['a', 'b', 'c']);
  ls.replaceAt('L', 2, 'B');
  assert.deepEqual(ls.get('L'), ['a', 'B', 'c']);
});

test('ListStore: replaceAt out of range does nothing', () => {
  const ls = new ListStore();
  ls.define('L', ['a', 'b']);
  ls.replaceAt('L', 0, 'X');
  ls.replaceAt('L', 5, 'X');
  assert.deepEqual(ls.get('L'), ['a', 'b']);
});

test('ListStore: indexOf returns 1-based index', () => {
  const ls = new ListStore();
  ls.define('L', ['apple', 'banana', 'cherry']);
  assert.equal(ls.indexOf('L', 'banana'), 2);
});

test('ListStore: indexOf returns 0 if not found', () => {
  const ls = new ListStore();
  ls.define('L', ['a', 'b']);
  assert.equal(ls.indexOf('L', 'z'), 0);
});

test('ListStore: indexOf Scratch equality - numeric strings', () => {
  const ls = new ListStore();
  ls.define('L', ['1', '2', '3']);
  // Scratch equality: "1" == 1 as numbers
  assert.equal(ls.indexOf('L', 1), 1);
});

test('ListStore: indexOf Scratch equality - case insensitive', () => {
  const ls = new ListStore();
  ls.define('L', ['Hello', 'World']);
  assert.equal(ls.indexOf('L', 'hello'), 1);
  assert.equal(ls.indexOf('L', 'WORLD'), 2);
});

test('ListStore: contains returns true/false', () => {
  const ls = new ListStore();
  ls.define('L', ['foo', 'bar']);
  assert.equal(ls.contains('L', 'foo'), true);
  assert.equal(ls.contains('L', 'baz'), false);
});

test('ListStore: contains case insensitive', () => {
  const ls = new ListStore();
  ls.define('L', ['HELLO']);
  assert.equal(ls.contains('L', 'hello'), true);
});

test('ListStore: showMonitor / hideMonitor', () => {
  const ls = new ListStore();
  ls.define('L');
  assert.equal(ls.isMonitorVisible('L'), false);
  ls.showMonitor('L');
  assert.equal(ls.isMonitorVisible('L'), true);
  ls.hideMonitor('L');
  assert.equal(ls.isMonitorVisible('L'), false);
});

test('ListStore: names() returns defined list names', () => {
  const ls = new ListStore();
  ls.define('L1');
  ls.define('L2');
  assert.deepEqual(ls.names().sort(), ['L1', 'L2']);
});

test('ListStore: snapshot returns copy', () => {
  const ls = new ListStore();
  ls.define('L', [1, 2, 3]);
  const snap = ls.snapshot();
  assert.deepEqual(snap.L, [1, 2, 3]);
  // mutating snap should not affect original
  snap.L.push(99);
  assert.equal(ls.length('L'), 3);
});
