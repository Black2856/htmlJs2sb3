import assert from 'node:assert/strict';
import test from 'node:test';

import {buildZip, unzipStored, crc32} from '../../src/sb3/zip.ts';

test('crc32 matches the IEEE check value for "123456789"', () => {
    const bytes = new TextEncoder().encode('123456789');
    assert.equal(crc32(bytes), 0xcbf43926);
});

test('buildZip / unzipStored round-trips entries byte-for-byte', () => {
    const encoder = new TextEncoder();
    const entries = [
        {name: 'project.json', data: encoder.encode('{"hello":"world"}')},
        {name: 'a1b2.svg', data: new Uint8Array([1, 2, 3, 4, 5])},
        {name: 'nested/path.bin', data: new Uint8Array([255, 0, 128])}
    ];

    const archive = buildZip(entries);
    // Local file header signature at offset 0.
    assert.equal(new DataView(archive.buffer).getUint32(0, true), 0x04034b50);

    const back = unzipStored(archive);
    assert.equal(back.size, 3);
    for (const entry of entries) {
        assert.deepEqual([...back.get(entry.name)!], [...entry.data]);
    }
});

test('unzipStored rejects a buffer without an end-of-central-directory record', () => {
    assert.throws(() => unzipStored(new Uint8Array([1, 2, 3])), /end-of-central-directory/);
});
