/**
 * Vertical (unit/page) OLX generator.
 * Produces: vertical/{id}.xml for each unit.
 * Each vertical references its child blocks (html, video, problem, openassessment).
 */
import { escapeXml } from '../utils.js';

/**
 * Map block_type to the OLX tag name used inside verticals.
 */
const BLOCK_TYPE_TAG = {
    text: 'html',
    video: 'video',
    problem: 'problem',
    openresponse: 'openassessment'
};

/**
 * @param {Array} chapters - hierarchy from buildHierarchy
 * @returns {Map<string, string>} filePath → content
 */
export function generateVerticals(chapters) {
    const files = new Map();

    for (const ch of chapters) {
        for (const seq of ch.sequentials) {
            for (const vert of seq.verticals) {
                let xml = `<vertical display_name="${escapeXml(vert.name)}">\n`;
                for (const block of vert.blocks) {
                    const tag = BLOCK_TYPE_TAG[block.type] || block.type;
                    xml += `  <${tag} url_name="${escapeXml(block.blockId)}"/>\n`;
                }
                xml += `</vertical>\n`;
                files.set(`vertical/${vert.id}.xml`, xml);
            }
        }
    }

    return files;
}
