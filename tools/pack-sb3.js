#!/usr/bin/env node
/**
 * pack-sb3.js
 * Pack DSL → project.json + assets into a .sb3 (ZIP) file.
 * No external dependencies. Pure JS ZIP writer (store/no compression).
 * CLI: node tools/pack-sb3.js <dsl.json> <out.sb3>
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { Sb3Generator } from './generate-sb3.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ── CRC32 ──────────────────────────────────────────────────────────────────

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Minimal WAV ────────────────────────────────────────────────────────────

function minimalWav() {
  // 44-byte header + 4 samples of silence
  const numSamples = 4;
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const buf = Buffer.alloc(44 + dataSize, 0);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);          // chunk size
  buf.writeUInt16LE(1, 20);           // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // samples stay 0

  return buf;
}

// ── Placeholder SVG ────────────────────────────────────────────────────────

function minimalSvg() {
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', 'utf8');
}

// ── Asset resolution ───────────────────────────────────────────────────────

function resolveAsset(filePath, dataFormat) {
  const absPath = resolve(PROJECT_ROOT, filePath);
  if (existsSync(absPath)) {
    const data = readFileSync(absPath);
    const assetId = createHash('md5').update(data).digest('hex');
    return { data, assetId };
  }
  // Placeholder
  let data;
  if (dataFormat === 'wav' || dataFormat === 'mp3') {
    data = minimalWav();
  } else if (dataFormat === 'svg') {
    data = minimalSvg();
  } else {
    // For png, bitmapResolution etc — use minimal SVG as placeholder
    // (In practice Scratch ignores content if we mark it correctly)
    data = minimalSvg();
  }
  const assetId = createHash('md5').update(data).digest('hex');
  return { data, assetId };
}

// ── ZIP writer (store/no compression) ─────────────────────────────────────

function writeU16LE(buf, offset, val) { buf.writeUInt16LE(val >>> 0, offset); }
function writeU32LE(buf, offset, val) { buf.writeUInt32LE(val >>> 0, offset); }

function buildZip(entries) {
  // entries: Array of { name: string, data: Buffer }
  const localHeaders = [];
  let offset = 0;

  const parts = [];
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    // Local file header: 30 bytes + name
    const lh = Buffer.alloc(30 + nameBuf.length);
    writeU32LE(lh, 0, 0x04034B50);   // signature
    writeU16LE(lh, 4, 20);            // version needed
    writeU16LE(lh, 6, 0);             // flags
    writeU16LE(lh, 8, 0);             // compression: store
    writeU16LE(lh, 10, 0);            // mod time
    writeU16LE(lh, 12, 0);            // mod date
    writeU32LE(lh, 14, crc);
    writeU32LE(lh, 18, size);         // compressed size
    writeU32LE(lh, 22, size);         // uncompressed size
    writeU16LE(lh, 26, nameBuf.length);
    writeU16LE(lh, 28, 0);            // extra field length
    nameBuf.copy(lh, 30);

    localHeaders.push({ offset, nameBuf, crc, size, lhLen: lh.length });
    parts.push(lh, data);
    offset += lh.length + size;
  }

  // Central directory
  const cdParts = [];
  let cdSize = 0;
  const cdOffset = offset;
  for (const lh of localHeaders) {
    const cd = Buffer.alloc(46 + lh.nameBuf.length);
    writeU32LE(cd, 0, 0x02014B50);   // central dir signature
    writeU16LE(cd, 4, 20);            // version made by
    writeU16LE(cd, 6, 20);            // version needed
    writeU16LE(cd, 8, 0);             // flags
    writeU16LE(cd, 10, 0);            // compression: store
    writeU16LE(cd, 12, 0);            // mod time
    writeU16LE(cd, 14, 0);            // mod date
    writeU32LE(cd, 16, lh.crc);
    writeU32LE(cd, 20, lh.size);
    writeU32LE(cd, 24, lh.size);
    writeU16LE(cd, 28, lh.nameBuf.length);
    writeU16LE(cd, 30, 0);            // extra field length
    writeU16LE(cd, 32, 0);            // comment length
    writeU16LE(cd, 34, 0);            // disk number start
    writeU16LE(cd, 36, 0);            // internal attr
    writeU32LE(cd, 38, 0);            // external attr
    writeU32LE(cd, 42, lh.offset);
    lh.nameBuf.copy(cd, 46);
    cdParts.push(cd);
    cdSize += cd.length;
  }

  // End of central directory
  const eocd = Buffer.alloc(22);
  writeU32LE(eocd, 0, 0x06054B50);
  writeU16LE(eocd, 4, 0);             // disk number
  writeU16LE(eocd, 6, 0);             // disk with cd start
  writeU16LE(eocd, 8, entries.length);
  writeU16LE(eocd, 10, entries.length);
  writeU32LE(eocd, 12, cdSize);
  writeU32LE(eocd, 16, cdOffset);
  writeU16LE(eocd, 20, 0);            // comment length

  return Buffer.concat([...parts, ...cdParts, eocd]);
}

// ── Main ───────────────────────────────────────────────────────────────────

function packSb3(dslPath, outPath) {
  const dsl = JSON.parse(readFileSync(resolve(dslPath), 'utf8'));
  const gen = new Sb3Generator(dsl);
  const project = gen.build();

  // Collect all assets and update assetId/md5ext in project
  const assetEntries = new Map(); // md5ext -> Buffer

  for (const target of project.targets) {
    for (const costume of target.costumes) {
      const { data, assetId } = resolveAsset(
        // Find original DSL file path
        findDslAssetPath(dsl, costume.name, 'costume'),
        costume.dataFormat
      );
      costume.assetId = assetId;
      costume.md5ext = `${assetId}.${costume.dataFormat}`;
      assetEntries.set(costume.md5ext, data);
    }
    for (const sound of target.sounds) {
      const { data, assetId } = resolveAsset(
        findDslAssetPath(dsl, sound.name, 'sound'),
        sound.dataFormat
      );
      sound.assetId = assetId;
      sound.md5ext = `${assetId}.${sound.dataFormat}`;
      assetEntries.set(sound.md5ext, data);
    }
  }

  // Build ZIP entries
  const entries = [];

  // project.json first
  const projectJson = Buffer.from(JSON.stringify(project), 'utf8');
  entries.push({ name: 'project.json', data: projectJson });

  // Assets
  for (const [name, data] of assetEntries) {
    entries.push({ name, data });
  }

  const zipBuf = buildZip(entries);
  writeFileSync(resolve(outPath), zipBuf);
  console.log(`Written: ${outPath} (${entries.length} entries, ${zipBuf.length} bytes)`);
}

function findDslAssetPath(dsl, assetName, kind) {
  const allTargets = [dsl.stage, ...(dsl.sprites || [])];
  for (const t of allTargets) {
    const arr = kind === 'costume' ? (t.costumes || []) : (t.sounds || []);
    const found = arr.find(a => a.name === assetName);
    if (found) return found.file;
  }
  return `assets/${assetName}`;
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node tools/pack-sb3.js <dsl.json> <out.sb3>');
    process.exit(1);
  }
  packSb3(args[0], args[1]);
}
