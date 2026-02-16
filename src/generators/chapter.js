/**
 * Chapter OLX generator.
 * Produces: chapter/{id}.xml for each chapter.
 */
import { escapeXml } from '../utils.js';

/**
 * @param {Array} chapters - hierarchy from buildHierarchy
 * @returns {Map<string, string>} filePath → content
 */
export function generateChapters(chapters) {
    const files = new Map();

    for (const ch of chapters) {
        let xml = `<chapter display_name="${escapeXml(ch.name)}">\n`;
        for (const seq of ch.sequentials) {
            xml += `  <sequential url_name="${escapeXml(seq.id)}"/>\n`;
        }
        xml += `</chapter>\n`;
        files.set(`chapter/${ch.id}.xml`, xml);
    }

    return files;
}
