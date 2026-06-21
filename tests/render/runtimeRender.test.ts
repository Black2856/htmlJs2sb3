import assert from 'node:assert/strict';
import test from 'node:test';

import {createRenderProject} from '../fixtures/renderProject.ts';
import {createProject} from '../../src/model/ProjectFactory.ts';
import {Runtime} from '../../src/runtime/Runtime.ts';
import type {DrawableState, RendererPort} from '../../src/render/RendererPort.ts';

/** Fake RendererPort: a pure object recording every renderDrawables() call. No DOM dependency. */
class FakeRenderer implements RendererPort {
    calls: DrawableState[][] = [];

    renderDrawables(states: DrawableState[]): void {
        this.calls.push(states);
    }

    get lastCall(): DrawableState[] | undefined {
        return this.calls.at(-1);
    }
}

const buildRuntime = (renderer: RendererPort) => {
    const project = createProject(createRenderProject());
    const runtime = new Runtime({renderer});
    runtime.load(project);
    runtime.start();
    return {runtime, project};
};

test('tick() forwards a DrawableState per target (stage + each sprite) to the RendererPort', () => {
    const renderer = new FakeRenderer();
    const {runtime} = buildRuntime(renderer);

    runtime.greenFlag();
    runtime.tick();

    assert.equal(renderer.calls.length, 1, 'renderDrawables should be called exactly once per tick');
    const states = renderer.lastCall!;
    const ids = states.map(s => s.targetId);
    assert.deepEqual(ids, ['target-stage', 'sprite-back', 'sprite-front']);
});

test('tick() reports the stage as visible with fixed placement defaults', () => {
    const renderer = new FakeRenderer();
    const {runtime} = buildRuntime(renderer);

    runtime.greenFlag();
    runtime.tick();

    const stageState = renderer.lastCall!.find(s => s.targetId === 'target-stage')!;
    assert.equal(stageState.isStage, true);
    assert.equal(stageState.visible, true);
    assert.equal(stageState.x, 0);
    assert.equal(stageState.y, 0);
    assert.equal(stageState.size, 100);
    assert.equal(stageState.direction, 90);
});

test('tick() reflects each sprite model field (x/y/size/direction/visible/rotationStyle/layerOrder/costumeIndex)', () => {
    const renderer = new FakeRenderer();
    const {runtime} = buildRuntime(renderer);

    runtime.greenFlag();
    runtime.tick();

    const states = renderer.lastCall!;
    const back = states.find(s => s.targetId === 'sprite-back')!;
    assert.equal(back.x, -50);
    assert.equal(back.y, 25);
    assert.equal(back.size, 80);
    assert.equal(back.direction, 90);
    assert.equal(back.visible, true);
    assert.equal(back.rotationStyle, 'all around');
    assert.equal(back.layerOrder, 1);
    assert.equal(back.costumeIndex, 0);

    const front = states.find(s => s.targetId === 'sprite-front')!;
    assert.equal(front.x, 100);
    assert.equal(front.y, -40);
    assert.equal(front.rotationStyle, "don't rotate");
    assert.equal(front.layerOrder, 2);
});

test('tick() reflects sprite position changes made between ticks', () => {
    const renderer = new FakeRenderer();
    const {runtime, project} = buildRuntime(renderer);

    runtime.greenFlag();
    runtime.tick();

    const sprite = project.sprites.find(s => s.id === 'sprite-front')!;
    // Phase 3 has no motion-block primitives yet; mutate the model field
    // directly to simulate what a future motion block would do, and verify
    // the renderer wiring picks up the new value on the next tick.
    (sprite as unknown as {x: number; y: number}).x = 12;
    (sprite as unknown as {x: number; y: number}).y = -34;

    runtime.tick();

    const updated = renderer.lastCall!.find(s => s.targetId === 'sprite-front')!;
    assert.equal(updated.x, 12);
    assert.equal(updated.y, -34);
});

test('Runtime works without a renderer (renderer/input stay optional, additive)', () => {
    const project = createProject(createRenderProject());
    const runtime = new Runtime();
    runtime.load(project);
    runtime.start();
    runtime.greenFlag();
    assert.doesNotThrow(() => runtime.tick());
});
