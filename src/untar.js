/**
 * Tar extractor — reads a tar.gz buffer and extracts file entries.
 * Reverse of tar.js: gunzips then parses POSIX ustar headers.
 */
import { gunzipSync } from 'fflate';

/**
 * Extract files from a tar.gz ArrayBuffer.
 * @param {ArrayBuffer} buffer - The .tar.gz file contents
 * @returns {Map<string, string>} filePath → text content
 */
export function extractTarGz(buffer) {
    const compressed = new Uint8Array(buffer);
    const tarData = gunzipSync(compressed);
    return extractTar(tarData);
}

/**
 * Parse a tar buffer and extract file entries.
 * @param {Uint8Array} data
 * @returns {Map<string, string>} filePath → text content
 */
function extractTar(data) {
    const files = new Map();
    let offset = 0;

    while (offset + 512 <= data.length) {
        // Read header
        const header = data.subarray(offset, offset + 512);

        // Check for end-of-archive (all zeros)
        if (isZeroBlock(header)) break;

        // Parse name (bytes 0-99)
        const name = readString(header, 0, 100);
        if (!name) break;

        // Parse prefix for long paths (bytes 345-499, ustar)
        const prefix = readString(header, 345, 155);
        const fullName = prefix ? `${prefix}/${name}` : name;

        // Parse size (bytes 124-135, octal)
        const sizeStr = readString(header, 124, 12).replace(/\0/g, '').trim();
        const size = parseInt(sizeStr, 8) || 0;

        // Parse type flag (byte 156)
        const typeFlag = header[156];
        // '0' or '\0' = regular file, '5' = directory
        const isFile = typeFlag === 0x30 || typeFlag === 0;

        offset += 512; // move past header

        if (isFile && size > 0) {
            const fileData = data.subarray(offset, offset + size);
            const text = new TextDecoder('utf-8', { fatal: false }).decode(fileData);

            // Strip leading "course/" prefix if present (EdX wraps in a top-level dir)
            let cleanPath = fullName;
            const slashIdx = cleanPath.indexOf('/');
            if (slashIdx > 0) {
                cleanPath = cleanPath.substring(slashIdx + 1);
            }

            if (cleanPath) {
                files.set(cleanPath, text);
            }
        }

        // Advance past file data (padded to 512-byte boundary)
        const paddedSize = Math.ceil(size / 512) * 512;
        offset += paddedSize;
    }

    return files;
}

function readString(buf, offset, maxLen) {
    let end = offset;
    const limit = Math.min(offset + maxLen, buf.length);
    while (end < limit && buf[end] !== 0) end++;
    return new TextDecoder('ascii').decode(buf.subarray(offset, end));
}

function isZeroBlock(block) {
    for (let i = 0; i < 512 && i < block.length; i++) {
        if (block[i] !== 0) return false;
    }
    return true;
}
