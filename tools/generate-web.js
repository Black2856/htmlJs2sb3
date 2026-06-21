#!/usr/bin/env node
/**
 * generate-web.js
 * Validates DSL and copies web/ to dist/ for serving.
 * No external dependencies.
 * CLI: node tools/generate-web.js <dsl.json>
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function validateDslBasic(dsl) {
  const errors = [];
  if (!dsl.meta) errors.push('Missing meta');
  if (!dsl.stage) errors.push('Missing stage');
  if (!dsl.sprites) errors.push('Missing sprites');
  if (dsl.stage && !dsl.stage.name) errors.push('Stage missing name');
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node tools/generate-web.js <dsl.json>');
    process.exit(1);
  }
  const dslPath = resolve(args[0]);
  let dsl;
  try {
    dsl = JSON.parse(readFileSync(dslPath, 'utf8'));
  } catch (e) {
    console.error(`Failed to read/parse ${dslPath}: ${e.message}`);
    process.exit(1);
  }

  const errors = validateDslBasic(dsl);
  if (errors.length > 0) {
    console.error('DSL validation errors:');
    errors.forEach(e => console.error('  ' + e));
    process.exit(1);
  }

  const webDir = join(PROJECT_ROOT, 'web');
  const distDir = join(PROJECT_ROOT, 'dist');

  mkdirSync(distDir, { recursive: true });
  copyDir(webDir, distDir);

  // Write a manifest.json with DSL meta
  const manifest = {
    name: dsl.meta.name,
    dslVersion: dsl.meta.dslVersion,
    sprites: (dsl.sprites || []).map(s => s.name),
    broadcasts: dsl.broadcasts || [],
  };
  writeFileSync(join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`Web assets copied to dist/. Manifest written.`);
  process.exit(0);
}
