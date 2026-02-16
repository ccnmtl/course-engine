/**
 * HTML/Text block OLX generator.
 * Produces paired files for each text block:
 *   html/{blockId}.xml — metadata pointer
 *   html/{blockId}.html — actual HTML content
 */
import { escapeXml, textToHtml } from '../utils.js';

/**
 * @param {Map<string, import('../model.js').TextBlock>} textBlocks
 * @returns {Map<string, string>} filePath → content
 */
export function generateHtmlBlocks(textBlocks) {
    const files = new Map();

    for (const [blockId, block] of textBlocks) {
        // XML metadata file
        files.set(`html/${blockId}.xml`,
            `<html filename="${escapeXml(blockId)}" display_name="${escapeXml(block.title)}"/>\n`
        );

        // HTML content file
        const htmlContent = textToHtml(block.content);
        files.set(`html/${blockId}.html`, htmlContent + '\n');
    }

    return files;
}
