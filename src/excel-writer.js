/**
 * Excel Writer — converts CourseData back to an Excel workbook.
 * Uses ExcelJS for browser-compatible xlsx generation.
 */
import ExcelJS from 'exceljs';

/**
 * Generate an Excel workbook Blob from CourseData.
 * @param {import('./model.js').CourseData} courseData
 * @returns {Promise<Blob>}
 */
export async function courseDataToExcel(courseData) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Course Engine';
    wb.created = new Date();

    // --- Sheet 1: Course Info ---
    const ws1 = wb.addWorksheet('Course Info');
    ws1.columns = [
        { header: 'Field', key: 'field', width: 20 },
        { header: 'Value', key: 'value', width: 50 }
    ];
    ws1.addRows([
        { field: 'Course Name', value: courseData.info.courseName || '' },
        { field: 'Organization', value: courseData.info.org || '' },
        { field: 'Course ID', value: courseData.info.courseId || '' },
        { field: 'Run', value: courseData.info.run || '' },
        { field: 'Language', value: courseData.info.language || 'en' },
        { field: 'Start Date', value: courseData.info.startDate || '' },
        { field: 'End Date', value: courseData.info.endDate || '' },
        { field: 'Self-Paced', value: courseData.info.selfPaced ? 'Yes' : 'No' }
    ]);

    // --- Sheet 2: Structure ---
    const ws2 = wb.addWorksheet('Structure');
    ws2.columns = [
        { header: 'chapter', key: 'chapter', width: 35 },
        { header: 'sequential', key: 'sequential', width: 30 },
        { header: 'vertical', key: 'vertical', width: 35 },
        { header: 'block_type', key: 'blockType', width: 15 },
        { header: 'block_id', key: 'blockId', width: 35 }
    ];
    courseData.structure.forEach(row => {
        ws2.addRow({
            chapter: row.chapter,
            sequential: row.sequential,
            vertical: row.vertical,
            blockType: row.blockType,
            blockId: row.blockId
        });
    });

    // --- Sheet 3: Text Blocks ---
    const ws3 = wb.addWorksheet('Text Blocks');
    ws3.columns = [
        { header: 'block_id', key: 'blockId', width: 35 },
        { header: 'title', key: 'title', width: 25 },
        { header: 'content', key: 'content', width: 80 }
    ];
    for (const [id, block] of courseData.textBlocks) {
        ws3.addRow({
            blockId: block.blockId,
            title: block.title,
            content: block.content
        });
    }

    // --- Sheet 4: Videos ---
    const ws4 = wb.addWorksheet('Videos');
    ws4.columns = [
        { header: 'block_id', key: 'blockId', width: 35 },
        { header: 'title', key: 'title', width: 25 },
        { header: 'youtube_id', key: 'youtubeId', width: 20 },
        { header: 'html5_url', key: 'html5Url', width: 40 },
        { header: 'start_time', key: 'startTime', width: 12 },
        { header: 'end_time', key: 'endTime', width: 12 }
    ];
    for (const [id, block] of courseData.videoBlocks) {
        ws4.addRow({
            blockId: block.blockId,
            title: block.title,
            youtubeId: block.youtubeId,
            html5Url: block.html5Url,
            startTime: block.startTime,
            endTime: block.endTime
        });
    }

    // --- Sheet 5: Problems ---
    const ws5 = wb.addWorksheet('Problems');
    const probCols = [
        { header: 'block_id', key: 'blockId', width: 35 },
        { header: 'title', key: 'title', width: 15 },
        { header: 'question_text', key: 'questionText', width: 50 },
        { header: 'choice_a', key: 'choice_a', width: 20 },
        { header: 'choice_b', key: 'choice_b', width: 20 },
        { header: 'choice_c', key: 'choice_c', width: 20 },
        { header: 'choice_d', key: 'choice_d', width: 20 },
        { header: 'choice_e', key: 'choice_e', width: 20 },
        { header: 'choice_f', key: 'choice_f', width: 20 },
        { header: 'correct', key: 'correct', width: 10 },
        { header: 'hint_a', key: 'hint_a', width: 25 },
        { header: 'hint_b', key: 'hint_b', width: 25 },
        { header: 'hint_c', key: 'hint_c', width: 25 },
        { header: 'hint_d', key: 'hint_d', width: 25 },
        { header: 'hint_e', key: 'hint_e', width: 25 },
        { header: 'hint_f', key: 'hint_f', width: 25 },
        { header: 'explanation', key: 'explanation', width: 50 },
        { header: 'show_answer', key: 'showAnswer', width: 12 }
    ];
    ws5.columns = probCols;

    for (const [id, block] of courseData.problemBlocks) {
        const row = {
            blockId: block.blockId,
            title: block.title,
            questionText: block.questionText,
            explanation: block.explanation,
            showAnswer: block.showAnswer
        };
        const letters = ['a', 'b', 'c', 'd', 'e', 'f'];

        // Choices and Hints
        for (let i = 0; i < 6; i++) {
            const letter = letters[i];
            if (block.choices[i]) {
                row[`choice_${letter}`] = block.choices[i].text;
                row[`hint_${letter}`] = block.choices[i].hint;
            }
        }

        // Correct answers
        row.correct = block.choices
            .map((c, i) => c.correct ? letters[i].toUpperCase() : null)
            .filter(Boolean)
            .join(',');

        ws5.addRow(row);
    }

    // --- Sheet 6: Open Response ---
    // Dynamically determine max criteria count
    let maxCriteria = 1;
    for (const [id, block] of courseData.openResponseBlocks) {
        maxCriteria = Math.max(maxCriteria, block.criteria.length);
    }

    const ws6 = wb.addWorksheet('Open Response');
    const oraCols = [
        { header: 'block_id', key: 'blockId', width: 35 },
        { header: 'title', key: 'title', width: 25 },
        { header: 'prompt', key: 'prompt', width: 60 }
    ];

    for (let i = 1; i <= maxCriteria; i++) {
        oraCols.push(
            { header: `criterion_${i}_name`, key: `crit_${i}_name`, width: 25 },
            { header: `criterion_${i}_options`, key: `crit_${i}_opts`, width: 50 }
        );
    }
    oraCols.push({ header: 'assessment_type', key: 'assessmentType', width: 15 });
    ws6.columns = oraCols;

    for (const [id, block] of courseData.openResponseBlocks) {
        const row = {
            blockId: block.blockId,
            title: block.title,
            prompt: block.prompt,
            assessmentType: block.assessmentType
        };
        for (let i = 0; i < maxCriteria; i++) {
            if (i < block.criteria.length) {
                const crit = block.criteria[i];
                row[`crit_${i + 1}_name`] = crit.name;
                row[`crit_${i + 1}_opts`] = crit.options.map(o => `${o.label}=${o.points}`).join(';');
            }
        }
        ws6.addRow(row);
    }

    // Generate the workbook as a blob
    const buffer = await wb.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
