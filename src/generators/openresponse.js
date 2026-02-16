/**
 * Open Response Assessment OLX generator.
 * Produces: openassessment/{blockId}.xml for each ORA block.
 */
import { escapeXml } from '../utils.js';

/**
 * @param {Map<string, import('../model.js').OpenResponseBlock>} oraBlocks
 * @returns {Map<string, string>} filePath → content
 */
export function generateOpenResponseBlocks(oraBlocks) {
    const files = new Map();

    for (const [blockId, block] of oraBlocks) {
        let xml = `<openassessment url_name="${escapeXml(blockId)}" display_name="${escapeXml(block.title)}"`;
        xml += ` submission_due="2099-01-01T00:00:00Z" submission_start="2000-01-01T00:00:00Z">\n`;

        // Title
        xml += `  <title>${escapeXml(block.title)}</title>\n`;

        // Prompt
        xml += `  <prompt>\n`;
        xml += `    <description>${escapeXml(block.prompt)}</description>\n`;
        xml += `  </prompt>\n`;

        // Rubric
        xml += `  <rubric>\n`;
        for (const criterion of block.criteria) {
            xml += `    <criterion>\n`;
            xml += `      <name>${escapeXml(criterion.name)}</name>\n`;
            xml += `      <label>${escapeXml(criterion.name)}</label>\n`;
            xml += `      <prompt>${escapeXml(criterion.name)}</prompt>\n`;
            for (const opt of criterion.options) {
                xml += `      <option points="${opt.points}">\n`;
                xml += `        <name>${escapeXml(opt.label)}</name>\n`;
                xml += `        <label>${escapeXml(opt.label)}</label>\n`;
                xml += `        <explanation>${escapeXml(opt.label)} level performance</explanation>\n`;
                xml += `      </option>\n`;
            }
            xml += `    </criterion>\n`;
        }
        xml += `  </rubric>\n`;

        // Assessment steps
        xml += `  <assessments>\n`;
        if (block.assessmentType === 'peer') {
            xml += `    <assessment name="peer-assessment" must_grade="5" must_be_graded_by="3"/>\n`;
        }
        if (block.assessmentType === 'self' || block.assessmentType === 'peer') {
            xml += `    <assessment name="self-assessment"/>\n`;
        }
        if (block.assessmentType === 'staff') {
            xml += `    <assessment name="staff-assessment" required="true"/>\n`;
        }
        xml += `  </assessments>\n`;

        xml += `</openassessment>\n`;

        files.set(`openassessment/${blockId}.xml`, xml);
    }

    return files;
}
