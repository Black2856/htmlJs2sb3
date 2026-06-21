import type {DslProject} from '../validation/projectValidator.ts';
import {computeMd5} from '../assets/md5.ts';
import {
    serializeProject,
    PLACEHOLDER_COSTUME_MD5EXT,
    PLACEHOLDER_COSTUME_SVG
} from './projectSerializer.ts';
import {collectAssets} from './assetCollector.ts';
import {buildZip, type ZipEntry} from './zip.ts';
import type {Sb3Project} from './types.ts';

/**
 * Phase 6-4: packages a normalized DSL project into a `.sb3` archive
 * (`project.json` + the referenced costume/sound files). Asset bytes are
 * supplied by the caller, keyed by `md5ext`; the packager refuses to produce
 * an archive unless every referenced asset is present and consistent, so
 * "JSON-only" output never passes as a finished SB3.
 */

export interface Sb3PackageOptions {
    /** Asset file bytes keyed by `md5ext` (e.g. `abc123.svg`). */
    assets?: Map<string, Uint8Array>;
}

export interface Sb3PackageResult {
    sb3: Uint8Array;
    projectJson: Sb3Project;
}

const encodeProjectJson = (project: Sb3Project): Uint8Array =>
    new TextEncoder().encode(JSON.stringify(project));

/** Distinct md5ext values referenced by the serialized targets' costumes/sounds, in first-seen order. */
const referencedMd5Exts = (projectJson: Sb3Project): string[] => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    const visit = (md5ext: string): void => {
        if (!seen.has(md5ext)) {
            seen.add(md5ext);
            ordered.push(md5ext);
        }
    };
    for (const target of projectJson.targets) {
        for (const costume of target.costumes) visit(costume.md5ext);
        for (const sound of target.sounds) visit(sound.md5ext);
    }
    return ordered;
};

export const packageSb3 = (
    project: DslProject,
    options: Sb3PackageOptions = {}
): Sb3PackageResult => {
    const assetBytes = new Map<string, Uint8Array>(options.assets ?? []);
    const projectJson = serializeProject(project);

    const collection = collectAssets(project);
    if (collection.errors.length > 0) {
        throw new Error(
            `Cannot package .sb3: asset references are inconsistent:\n${collection.errors.join('\n')}`
        );
    }

    // The serializer injects a placeholder backdrop for any costume-less
    // target; back it with real bytes so the archive stays self-consistent.
    if (!assetBytes.has(PLACEHOLDER_COSTUME_MD5EXT)) {
        assetBytes.set(PLACEHOLDER_COSTUME_MD5EXT, PLACEHOLDER_COSTUME_SVG);
    }

    // Every md5ext that project.json references must exist as a zip entry.
    const referenced = referencedMd5Exts(projectJson);
    const missing = referenced.filter(md5ext => !assetBytes.has(md5ext));
    if (missing.length > 0) {
        throw new Error(
            `Cannot package .sb3: missing asset bytes for ${missing.join(', ')}`
        );
    }

    const hashMismatches = collection.assets.flatMap(asset => {
        const bytes = assetBytes.get(asset.md5ext);
        if (!bytes) return [];
        const actual = computeMd5(bytes);
        return actual === asset.assetId
            ? []
            : [`${asset.md5ext} has MD5 ${actual}, expected ${asset.assetId}`];
    });
    if (hashMismatches.length > 0) {
        throw new Error(
            `Cannot package .sb3: asset byte hashes are inconsistent:\n${hashMismatches.join('\n')}`
        );
    }

    const entries: ZipEntry[] = [
        {name: 'project.json', data: encodeProjectJson(projectJson)}
    ];
    for (const md5ext of referenced) {
        entries.push({name: md5ext, data: assetBytes.get(md5ext)!});
    }

    return {sb3: buildZip(entries), projectJson};
};
