/**
 * Minimal tar + gzip implementation using fflate.
 * Creates a tar archive from an array of { name, data } entries,
 * then gzips the result.
 */
import { gzipSync } from 'fflate';

/**
 * Create a tar.gz buffer from entries.
 * @param {Array<{name: string, data: Uint8Array}>} entries
 * @returns {Uint8Array}
 */
export function tarGzip(entries) {
    const tarData = createTar(entries);
    return gzipSync(tarData);
}

/**
 * Create a tar buffer (POSIX ustar format).
 */
function createTar(entries) {
    const blocks = [];

    // Collect all directory paths
    const dirs = new Set();
    for (const entry of entries) {
        const parts = entry.name.split('/');
        for (let i = 1; i < parts.length; i++) {
            dirs.add(parts.slice(0, i).join('/') + '/');
        }
    }

    // Add directory entries
    for (const dir of [...dirs].sort()) {
        blocks.push(createTarHeader(dir, 0, true));
    }

    // Add file entries
    for (const entry of entries) {
        const header = createTarHeader(entry.name, entry.data.length, false);
        blocks.push(header);

        // File data padded to 512-byte blocks
        const paddedSize = Math.ceil(entry.data.length / 512) * 512;
        const padded = new Uint8Array(paddedSize);
        padded.set(entry.data);
        blocks.push(padded);
    }

    // End-of-archive: two 512-byte blocks of zeros
    blocks.push(new Uint8Array(1024));

    // Concatenate
    const totalSize = blocks.reduce((s, b) => s + b.length, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const block of blocks) {
        result.set(block, offset);
        offset += block.length;
    }

    return result;
}

/**
 * Create a 512-byte tar header.
 */
function createTarHeader(name, size, isDir) {
    const header = new Uint8Array(512);

    // Name (0, 100)
    writeString(header, 0, name, 100);

    // Mode (100, 8)
    writeString(header, 100, isDir ? '0000755' : '0000644', 8);

    // UID (108, 8)
    writeString(header, 108, '0001000', 8);

    // GID (116, 8)
    writeString(header, 116, '0001000', 8);

    // Size (124, 12) — octal
    writeString(header, 124, size.toString(8).padStart(11, '0'), 12);

    // Mtime (136, 12) — current time in octal
    const mtime = Math.floor(Date.now() / 1000);
    writeString(header, 136, mtime.toString(8).padStart(11, '0'), 12);

    // Checksum placeholder (148, 8) — spaces
    for (let i = 148; i < 156; i++) header[i] = 0x20;

    // Type flag (156, 1)
    header[156] = isDir ? 0x35 : 0x30; // '5' for dir, '0' for file

    // USTAR magic (257, 6)
    writeString(header, 257, 'ustar', 6);
    header[263] = 0x20; // version space
    header[264] = 0x20;

    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
        checksum += header[i];
    }
    writeString(header, 148, checksum.toString(8).padStart(6, '0') + '\0 ', 8);

    return header;
}

function writeString(buf, offset, str, maxLen) {
    for (let i = 0; i < Math.min(str.length, maxLen); i++) {
        buf[offset + i] = str.charCodeAt(i);
    }
}
