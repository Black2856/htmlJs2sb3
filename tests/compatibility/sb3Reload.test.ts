import {test} from 'node:test';
import assert from 'node:assert/strict';
import parseProject from 'scratch-parser';
import {packageSb3} from '../../src/sb3/index.ts';
import {createMinimalProject} from '../fixtures/minimalProject.ts';
import {createAssetProject, createFullFeatureProject, assetBytesFor} from '../fixtures/sb3Projects.ts';
import type {DslProject} from '../../src/validation/projectValidator.ts';

/**
 * Phase 6-5: reloads our generated `.sb3` through the OFFICIAL `scratch-parser`
 * (the same unpack/parse/validate pipeline scratch-vm uses on project load).
 * This is the strongest compatibility signal available without a full
 * scratch-vm build: it runs our `project.json` through the real AJV-compiled
 * SB3 JSON schema, not our own hand-written validator.
 */

interface ParsedProject {
    targets: Array<{isStage: boolean; [key: string]: unknown}>;
    extensions?: string[];
    [key: string]: unknown;
}

const reloadThroughOfficialParser = (project: DslProject): Promise<ParsedProject> => {
    const assets = project.assets.length > 0 ? assetBytesFor(project) : undefined;
    const {sb3} = packageSb3(project, assets ? {assets} : {});
    const buffer = Buffer.from(sb3);

    return new Promise((resolve, reject) => {
        parseProject(buffer, false, (err: unknown, result: [ParsedProject, unknown]) => {
            if (err) {
                reject(err instanceof Error ? err : new Error(JSON.stringify(err)));
                return;
            }
            resolve(result[0]);
        });
    });
};

test('minimal asset-free project is accepted by the official SB3 parser', async () => {
    const parsed = await reloadThroughOfficialParser(createMinimalProject());
    assert.equal(Array.isArray(parsed.targets), true);
});

test('asset project (costume + sound) is accepted by the official SB3 parser', async () => {
    const parsed = await reloadThroughOfficialParser(createAssetProject());
    assert.equal(Array.isArray(parsed.targets), true);
});

test('full-feature project (procedure/broadcast/variable/list/monitor/pen + assets) is accepted by the official SB3 parser', async () => {
    const parsed = await reloadThroughOfficialParser(createFullFeatureProject());
    assert.equal(parsed.targets.length, 2);
    assert.ok(parsed.extensions?.includes('pen'), 'expected the "pen" extension to be present');
});
