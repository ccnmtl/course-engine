/**
 * Archive generator — produces a tar.gz file in the browser using fflate.
 */
import { tarGzip } from './tar.js';

/**
 * Generate a .tar.gz Blob from a Map<filePath, content>.
 * All paths are prefixed with "course/" to match EdX import expectations.
 * @param {Map<string, string>} files - filePath → content
 * @returns {Promise<Blob>}
 */
export async function generateTarGz(files) {
    const entries = [];

    for (const [path, content] of files) {
        const fullPath = `course/${path}`;
        const data = new TextEncoder().encode(content);
        entries.push({ name: fullPath, data });
    }

    const compressed = await tarGzip(entries);
    return new Blob([compressed], { type: 'application/x-gzip' });
}

/**
 * Trigger a browser download for a Blob.
 * Uses the File System Access API (showSaveFilePicker) when available for a
 * native save dialog, with a fallback to the <a> download attribute method.
 */
export async function downloadBlob(blob, filename) {
    // Method 1: File System Access API — user gets a native Save dialog
    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const opts = {
                suggestedName: filename,
                types: [{
                    description: 'Compressed archive',
                    accept: { 'application/gzip': ['.tar.gz', '.gz'] }
                }]
            };
            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return; // success
        } catch (err) {
            // User cancelled the dialog, or API failed — fall through to fallback
            if (err.name === 'AbortError') return;
            console.warn('showSaveFilePicker failed, using fallback:', err);
        }
    }

    // Method 2: Classic <a> download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Delay cleanup so browser can initiate the download
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 5000);
}
