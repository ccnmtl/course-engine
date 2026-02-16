/**
 * Problem (multiple choice) OLX generator.
 * Produces: problem/{blockId}.xml for each problem.
 */
import { escapeXml } from '../utils.js';

/**
 * @param {Map<string, import('../model.js').ProblemBlock>} problemBlocks
 * @returns {Map<string, string>} filePath → content
 */
export function generateProblemBlocks(problemBlocks) {
    const files = new Map();

    for (const [blockId, block] of problemBlocks) {
        let xml = `<problem display_name="${escapeXml(block.title)}" showanswer="${escapeXml(block.showAnswer)}">\n`;
        xml += `<multiplechoiceresponse>\n`;
        xml += `  <label>${escapeXml(block.questionText)}</label>\n`;
        xml += `<choicegroup type="MultipleChoice">\n`;

        for (const choice of block.choices) {
            const correctAttr = choice.correct ? 'true' : 'false';
            xml += `    <choice correct="${correctAttr}">${escapeXml(choice.text)}`;
            if (choice.hint) {
                xml += ` <choicehint>${escapeXml(choice.hint)}</choicehint>`;
            }
            xml += `\n</choice>\n`;
        }

        xml += `  </choicegroup>\n`;

        if (block.explanation) {
            xml += `<solution>\n`;
            xml += `<div class="detailed-solution">\n`;
            xml += `<p>Explanation</p>\n`;
            xml += `<p>${escapeXml(block.explanation)}</p>\n`;
            xml += `</div>\n`;
            xml += `</solution>\n`;
        }

        xml += `</multiplechoiceresponse>\n`;
        xml += `</problem>\n`;

        files.set(`problem/${blockId}.xml`, xml);
    }

    return files;
}
