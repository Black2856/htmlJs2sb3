import type {DslProject, DslTarget} from '../validation/projectValidator.ts';

/**
 * Phase 6-3 (assets): walks every target's costumes and sounds, checks each
 * reference against the project's declared assets (kind/dataFormat/md5ext, and
 * the canonical `md5ext === assetId.dataFormat`), and collects the deduplicated
 * set of files the SB3 package must contain.
 */

export interface RequiredAsset {
    assetId: string;
    md5ext: string;
    dataFormat: string;
    kind: 'costume' | 'sound';
}

export interface AssetCollectionResult {
    assets: RequiredAsset[];
    errors: string[];
}

const targetIterator = (project: DslProject): Array<{target: DslTarget; path: string}> => [
    {target: project.stage, path: '$.stage'},
    ...project.sprites.map((sprite, index) => ({target: sprite, path: `$.sprites.${index}`}))
];

export const collectAssets = (project: DslProject): AssetCollectionResult => {
    const assets = new Map(project.assets.map(asset => [asset.id, asset]));
    const required = new Map<string, RequiredAsset>();
    const errors: string[] = [];

    for (const {target, path} of targetIterator(project)) {
        const references = [
            ...target.costumes.map((item, index) => ({item, kind: 'costume' as const, where: `${path}.costumes.${index}`})),
            ...target.sounds.map((item, index) => ({item, kind: 'sound' as const, where: `${path}.sounds.${index}`}))
        ];

        for (const {item, kind, where} of references) {
            const asset = assets.get(item.assetId);
            if (!asset) {
                errors.push(`${where}: asset ${item.assetId} is not declared in project.assets.`);
                continue;
            }
            const expectedMd5Ext = `${item.assetId}.${item.dataFormat}`;
            if (asset.kind !== kind) {
                errors.push(`${where}: asset ${item.assetId} kind ${asset.kind} does not match ${kind} reference.`);
            }
            if (asset.dataFormat !== item.dataFormat) {
                errors.push(`${where}: dataFormat ${item.dataFormat} does not match asset ${asset.dataFormat}.`);
            }
            if (item.md5ext !== expectedMd5Ext || asset.md5ext !== expectedMd5Ext) {
                errors.push(`${where}: md5ext must be ${expectedMd5Ext}.`);
            }
            required.set(expectedMd5Ext, {
                assetId: item.assetId,
                md5ext: expectedMd5Ext,
                dataFormat: item.dataFormat,
                kind
            });
        }
    }

    return {assets: [...required.values()], errors};
};
