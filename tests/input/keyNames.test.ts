import assert from 'node:assert/strict';
import test from 'node:test';

import {normalizeKey} from '../../src/input/keyNames.ts';

test('normalizeKey maps space and arrow keys to Scratch key names', () => {
    assert.equal(normalizeKey(' '), 'space');
    assert.equal(normalizeKey('ArrowUp'), 'up arrow');
    assert.equal(normalizeKey('ArrowDown'), 'down arrow');
    assert.equal(normalizeKey('ArrowLeft'), 'left arrow');
    assert.equal(normalizeKey('ArrowRight'), 'right arrow');
    assert.equal(normalizeKey('Enter'), 'enter');
});

test('normalizeKey lower-cases single letter keys', () => {
    assert.equal(normalizeKey('a'), 'a');
    assert.equal(normalizeKey('A'), 'a');
    assert.equal(normalizeKey('z'), 'z');
});

test('normalizeKey leaves single digit keys as-is', () => {
    assert.equal(normalizeKey('0'), '0');
    assert.equal(normalizeKey('5'), '5');
    assert.equal(normalizeKey('9'), '9');
});

test('normalizeKey lower-cases other key names', () => {
    assert.equal(normalizeKey('Shift'), 'shift');
    assert.equal(normalizeKey('Escape'), 'escape');
    assert.equal(normalizeKey('Tab'), 'tab');
});
