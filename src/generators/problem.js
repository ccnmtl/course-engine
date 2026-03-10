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

        // Determine if this is a single-select or multi-select problem
        const correctCount = block.choices.filter(c => c.correct).length;
        const isMultiSelect = block.isMultiSelect !== undefined ? block.isMultiSelect : (correctCount > 1);

        if (isMultiSelect) {
            xml += `<choiceresponse>\n  <label>${escapeXml(block.questionText)}</label>\n  <checkboxgroup>\n`;
        } else {
            xml += `<multiplechoiceresponse>\n  <label>${escapeXml(block.questionText)}</label>\n  <choicegroup type="MultipleChoice">\n`;
        }

        for (const choice of block.choices) {
            const correctAttr = choice.correct ? 'true' : 'false';
            xml += `    <choice correct="${correctAttr}">${escapeXml(choice.text)}`;
            if (choice.hint) {
                xml += ` <choicehint>${escapeXml(choice.hint)}</choicehint>`;
            }
            xml += `\n</choice>\n`;
        }

        if (isMultiSelect) {
            xml += `  </checkboxgroup>\n`;
        } else {
            xml += `  </choicegroup>\n`;
        }

        if (block.explanation) {
            xml += `<solution>\n`;
            xml += `<div class="detailed-solution">\n`;
            xml += `<p>Explanation</p>\n`;
            xml += `<p>${escapeXml(block.explanation)}</p>\n`;
            xml += `</div>\n`;
            xml += `</solution>\n`;
        }

        if (isMultiSelect) {
            xml += `</choiceresponse>\n`;
        } else {
            xml += `</multiplechoiceresponse>\n`;
        }

        xml += `</problem>\n`;

        files.set(`problem/${blockId}.xml`, xml);
    }

    return files;
}
