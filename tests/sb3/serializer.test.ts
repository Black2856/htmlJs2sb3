import assert from 'node:assert/strict';
import test from 'node:test';

import {createMinimalProject} from '../fixtures/minimalProject.ts';
import {createFullFeatureProject, createAssetProject} from '../fixtures/sb3Projects.ts';
import {serializeProject} from '../../src/sb3/projectSerializer.ts';
import type {Sb3Block} from '../../src/sb3/types.ts';

test('serializes Stage first, original targets only, in map/array forms', () => {
    const sb3 = serializeProject(createFullFeatureProject());
    assert.equal(sb3.targets.length, 2);
    assert.equal(sb3.targets[0].isStage, true);
    assert.equal(sb3.targets[1].isStage, false);
    assert.equal(sb3.targets[0].layerOrder, 0);

    // variables: id -> [name, value]; lists: id -> [name, values].
    assert.deepEqual(sb3.targets[0].variables['var-score'], ['score', 0]);
    assert.deepEqual(sb3.targets[0].lists['list-items'], ['items', []]);
    // broadcasts live on the Stage; sprites serialize empty.
    assert.deepEqual(sb3.targets[0].broadcasts, {'bcast-go': 'go'});
    assert.deepEqual(sb3.targets[1].broadcasts, {});
    assert.equal(sb3.meta.semver, '3.0.0');
});

test('does not re-number block/variable/list/broadcast IDs', () => {
    const sb3 = serializeProject(createFullFeatureProject());
    const stage = sb3.targets[0];
    assert.ok('var-score' in stage.variables);
    assert.ok('list-items' in stage.lists);
    assert.ok('bcast-go' in stage.broadcasts);
    // Non-inlined blocks keep their DSL ids verbatim.
    assert.ok('flag-main' in stage.blocks);
    assert.ok('call-proc' in stage.blocks);
});

test('compresses primitive shadow inputs and drops the inlined block', () => {
    const sb3 = serializeProject(createMinimalProject());
    const sprite = sb3.targets[1];
    const move = sprite.blocks['block-sprite-move'];
    // math_number shadow -> [1, [4, value]] and the shadow block is removed.
    assert.deepEqual(move.inputs.STEPS, [1, [4, 10]]);
    assert.equal('shadow-sprite-ten' in sprite.blocks, false);

    // text shadow on the Stage's set block compresses to a [10, ...] primitive.
    const stageSet = sb3.targets[0].blocks['block-stage-set'];
    assert.deepEqual(stageSet.inputs.VALUE, [1, [10, '0']]);
    assert.equal('shadow-stage-zero' in sb3.targets[0].blocks, false);
});

test('keeps next:null and serializes fields as [value] / [value, id]', () => {
    const sb3 = serializeProject(createFullFeatureProject());
    const stage = sb3.targets[0];
    const penClear = stage.blocks['pen-clear-main'];
    assert.equal(penClear.next, null); // next:null preserved, not omitted
    const setScore = stage.blocks['set-score'];
    assert.deepEqual(setScore.fields.VARIABLE, ['score', 'var-score']);
});

test('serializes custom-block mutation as string-encoded fields', () => {
    const sb3 = serializeProject(createFullFeatureProject());
    const stage = sb3.targets[0];
    const proto = stage.blocks['proc-proto'] as Sb3Block;
    assert.equal(proto.mutation?.proccode, 'log %s');
    assert.equal(proto.mutation?.argumentids, '["arg-msg"]');
    assert.equal(proto.mutation?.argumentnames, '["msg"]');
    assert.equal(proto.mutation?.warp, 'false');

    const call = stage.blocks['call-proc'] as Sb3Block;
    assert.equal(call.mutation?.proccode, 'log %s');
    // argument reporter is a real block, not inlined.
    assert.equal(stage.blocks['read-msg'].opcode, 'argument_reporter_string_number');
});

test('preserves top-level x/y and omits them on nested blocks', () => {
    const sb3 = serializeProject(createFullFeatureProject());
    const stage = sb3.targets[0];
    assert.equal(stage.blocks['proc-def'].x, 0);
    assert.equal(stage.blocks['proc-def'].y, 400);
    assert.equal(stage.blocks['set-score'].x, undefined);
    assert.equal(stage.blocks['set-score'].y, undefined);
});

test('collects the pen extension from used opcodes', () => {
    const sb3 = serializeProject(createFullFeatureProject());
    assert.deepEqual(sb3.extensions, ['pen']);
});

test('serializes costumes/sounds without the DSL-only id field', () => {
    const project = createAssetProject();
    const sb3 = serializeProject(project);
    const sprite = sb3.targets[1];
    const cos = sprite.costumes[0];
    assert.equal('id' in cos, false);
    assert.equal(cos.assetId, project.assets[0].id);
    assert.equal(cos.md5ext, project.assets[0].md5ext);
    const snd = sprite.sounds[0];
    assert.equal('id' in snd, false);
    assert.equal(snd.dataFormat, 'wav');
    assert.equal(snd.rate, 48000);
});

test('fills monitor defaults from a minimal monitor record', () => {
    const sb3 = serializeProject(createFullFeatureProject());
    assert.equal(sb3.monitors.length, 1);
    const monitor = sb3.monitors[0];
    assert.equal(monitor.id, 'var-score');
    assert.equal(monitor.opcode, 'data_variable');
    assert.equal(monitor.visible, true);
    assert.equal(monitor.mode, 'default');
    assert.deepEqual(monitor.params, {VARIABLE: 'score'});
});

test('normalizes the Stage name and preserves declared extensions', () => {
    const project = createFullFeatureProject();
    project.stage.name = 'Custom stage name';
    project.extensions.unshift('faceSensing');
    const sb3 = serializeProject(project);
    assert.equal(sb3.targets[0].name, 'Stage');
    assert.deepEqual(sb3.extensions, ['faceSensing', 'pen']);
});

test('rejects a DSL project that has not passed validation', () => {
    const project = createFullFeatureProject();
    project.stage.blocks['flag-main'].next = 'missing-block';
    assert.throws(() => serializeProject(project), /Cannot serialize invalid DSL project/);
});
