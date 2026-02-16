/**
 * Sequential (subsection) OLX generator.
 * Produces: sequential/{id}.xml for each subsection.
 */
import { escapeXml } from '../utils.js';

/**
 * @param {Array} chapters - hierarchy from buildHierarchy
 * @returns {Map<string, string>} filePath → content
 */
export function generateSequentials(chapters) {
    const files = new Map();

    for (const ch of chapters) {
        for (const seq of ch.sequentials) {
            let xml = `<sequential display_name="${escapeXml(seq.name)}">\n`;
            for (const vert of seq.verticals) {
                xml += `  <vertical url_name="${escapeXml(vert.id)}"/>\n`;
            }
            xml += `</sequential>\n`;
            files.set(`sequential/${seq.id}.xml`, xml);
        }
    }

    return files;
}
