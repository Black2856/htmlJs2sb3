/**
 * Minimal ZIP reader/writer for `.sb3` packaging — STORE (no compression)
 * method only, which the official VM/parser accepts. Kept dependency-free
 * (no JSZip) and portable (Uint8Array + DataView + TextEncoder), consistent
 * with the project's "no heavyweight libraries" constraint.
 */

export interface ZipEntry {
    name: string;
    data: Uint8Array;
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const DOS_DATE_1980 = 0x21;

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

export const crc32 = (bytes: Uint8Array): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
};

/** Builds a STORE-method ZIP archive from the given entries. */
export const buildZip = (entries: ZipEntry[]): Uint8Array => {
    const encoder = new TextEncoder();
    const localChunks: Uint8Array[] = [];
    const centralChunks: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const crc = crc32(entry.data);
        const size = entry.data.length;

        const local = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, LOCAL_SIG, true);
        lv.setUint16(4, 20, true); // version needed
        lv.setUint16(6, 0, true); // flags
        lv.setUint16(8, 0, true); // method = store
        lv.setUint16(10, 0, true); // mod time
        lv.setUint16(12, DOS_DATE_1980, true); // mod date
        lv.setUint32(14, crc, true);
        lv.setUint32(18, size, true); // compressed size
        lv.setUint32(22, size, true); // uncompressed size
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true); // extra length
        local.set(nameBytes, 30);
        localChunks.push(local, entry.data);

        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, CENTRAL_SIG, true);
        cv.setUint16(4, 20, true); // version made by
        cv.setUint16(6, 20, true); // version needed
        cv.setUint16(8, 0, true); // flags
        cv.setUint16(10, 0, true); // method
        cv.setUint16(12, 0, true); // mod time
        cv.setUint16(14, DOS_DATE_1980, true); // mod date
        cv.setUint32(16, crc, true);
        cv.setUint32(20, size, true);
        cv.setUint32(24, size, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true); // extra length
        cv.setUint16(32, 0, true); // comment length
        cv.setUint16(34, 0, true); // disk number
        cv.setUint16(36, 0, true); // internal attrs
        cv.setUint32(38, 0, true); // external attrs
        cv.setUint32(42, offset, true); // local header offset
        central.set(nameBytes, 46);
        centralChunks.push(central);

        offset += local.length + entry.data.length;
    }

    const centralStart = offset;
    const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, EOCD_SIG, true);
    ev.setUint16(4, 0, true); // disk number
    ev.setUint16(6, 0, true); // central dir disk
    ev.setUint16(8, entries.length, true); // entries on disk
    ev.setUint16(10, entries.length, true); // total entries
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralStart, true);
    ev.setUint16(20, 0, true); // comment length

    const all = [...localChunks, ...centralChunks, eocd];
    const total = all.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(total);
    let pointer = 0;
    for (const chunk of all) {
        result.set(chunk, pointer);
        pointer += chunk.length;
    }
    return result;
};

/** Reads a STORE-method ZIP archive back into a name → bytes map (for tests). */
export const unzipStored = (buffer: Uint8Array): Map<string, Uint8Array> => {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let eocd = -1;
    for (let i = buffer.length - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === EOCD_SIG) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw new Error('Not a ZIP archive (missing end-of-central-directory record).');

    const count = view.getUint16(eocd + 10, true);
    let cdOffset = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    const entries = new Map<string, Uint8Array>();

    for (let n = 0; n < count; n++) {
        if (view.getUint32(cdOffset, true) !== CENTRAL_SIG) {
            throw new Error('Corrupt ZIP: bad central directory signature.');
        }
        const method = view.getUint16(cdOffset + 10, true);
        const compSize = view.getUint32(cdOffset + 20, true);
        const nameLen = view.getUint16(cdOffset + 28, true);
        const extraLen = view.getUint16(cdOffset + 30, true);
        const commentLen = view.getUint16(cdOffset + 32, true);
        const localOffset = view.getUint32(cdOffset + 42, true);
        const name = decoder.decode(buffer.subarray(cdOffset + 46, cdOffset + 46 + nameLen));

        if (view.getUint32(localOffset, true) !== LOCAL_SIG) {
            throw new Error(`Corrupt ZIP: bad local header for ${name}.`);
        }
        if (method !== 0) {
            throw new Error(`Unsupported ZIP compression method ${method} for ${name}.`);
        }
        const localNameLen = view.getUint16(localOffset + 26, true);
        const localExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        entries.set(name, buffer.slice(dataStart, dataStart + compSize));

        cdOffset += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
};
