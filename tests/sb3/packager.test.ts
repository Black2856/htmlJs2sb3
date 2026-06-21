import assert from 'node:assert/strict';
import test from 'node:test';

import {createMinimalProject} from '../fixtures/minimalProject.ts';
import {createAssetProject, createFullFeatureProject, assetBytesFor} from '../fixtures/sb3Projects.ts';
import {packageSb3} from '../../src/sb3/sb3Packager.ts';
import {PLACEHOLDER_COSTUME_MD5EXT} from '../../src/sb3/projectSerializer.ts';
import {unzipStored} from '../../src/sb3/zip.ts';
import type {Sb3Project} from '../../src/sb3/types.ts';

const parseProjectJson = (sb3: Uint8Array): Record<string, unknown> => {
    const files = unzipStored(sb3);
    const json = files.get('project.json');
    assert.ok(json, 'project.json present in archive');
    return JSON.parse(new TextDecoder().decode(json));
};

/** Asserts every costume/sound md5ext in project.json has a backing zip entry. */
const assertAllAssetsPackaged = (projectJson: Sb3Project, sb3: Uint8Array): void => {
    const files = unzipStored(sb3);
    for (const target of projectJson.targets) {
        for (const costume of target.costumes) {
            assert.ok(files.has(costume.md5ext), `missing costume entry ${costume.md5ext}`);
        }
        for (const sound of target.sounds) {
            assert.ok(files.has(sound.md5ext), `missing sound entry ${sound.md5ext}`);
        }
    }
};

test('packages a costume-less project with project.json + placeholder backdrop', () => {
    const {sb3, projectJson} = packageSb3(createMinimalProject());
    const files = unzipStored(sb3);
    // Stage and sprite both lack costumes → one shared placeholder backdrop.
    assert.deepEqual([...files.keys()].sort(), ['project.json', PLACEHOLDER_COSTUME_MD5EXT].sort());
    assert.equal((parseProjectJson(sb3).targets as unknown[]).length, 2);
    assertAllAssetsPackaged(projectJson, sb3);
});

test('packages costume + sound assets (plus the Stage placeholder) alongside project.json', () => {
    const project = createAssetProject();
    const {sb3, projectJson} = packageSb3(project, {assets: assetBytesFor(project)});
    const files = unzipStored(sb3);
    assert.equal(files.has('project.json'), true);
    assert.equal(files.has(project.assets[0].md5ext), true);
    assert.equal(files.has(project.assets[1].md5ext), true);
    // project.json + costume + sound + Stage placeholder backdrop.
    assert.equal(files.size, 4);
    assertAllAssetsPackaged(projectJson, sb3);
});

test('refuses to package when referenced asset bytes are missing', () => {
    const project = createAssetProject();
    assert.throws(() => packageSb3(project), /missing asset bytes/);
});

test('refuses to package asset bytes whose MD5 does not match assetId', () => {
    const project = createAssetProject();
    const assets = assetBytesFor(project);
    assets.set(project.assets[0].md5ext, new TextEncoder().encode('<svg></svg>'));
    assert.throws(
        () => packageSb3(project, {assets}),
        /asset byte hashes are inconsistent/
    );
});

test('packages the full-feature project and backs every referenced md5ext', () => {
    const project = createFullFeatureProject();
    const {sb3, projectJson} = packageSb3(project, {assets: assetBytesFor(project)});
    const parsed = parseProjectJson(sb3);
    assert.equal((parsed.extensions as string[]).includes('pen'), true);
    assertAllAssetsPackaged(projectJson, sb3);
});
