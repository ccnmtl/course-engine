/**
 * Excel parser — reads a multi-sheet workbook and builds a CourseData model.
 * Uses ExcelJS for browser-compatible xlsx parsing.
 */
import ExcelJS from 'exceljs';
import { createCourseData } from './model.js';

/**
 * Parse an Excel workbook ArrayBuffer into CourseData.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{ data: import('./model.js').CourseData, errors: string[] }>}
 */
export async function parseWorkbook(buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const errors = [];
    const data = createCourseData();

    // --- Sheet 1: Course Info ---
    const infoSheet = findSheet(wb, 'Course Info');
    if (infoSheet) {
        const infoMap = new Map();
        infoSheet.eachRow((row) => {
            const key = cellValue(row.getCell(1));
            const value = cellValue(row.getCell(2));
            if (key && value) {
                infoMap.set(key.toLowerCase(), value);
            }
        });
        data.info.courseName = infoMap.get('course name') || '';
        data.info.org = infoMap.get('organization') || '';
        data.info.courseId = infoMap.get('course id') || '';
        data.info.run = infoMap.get('run') || '';
        data.info.language = infoMap.get('language') || 'en';
        data.info.startDate = infoMap.get('start date') || '';
        data.info.endDate = infoMap.get('end date') || '';
        data.info.selfPaced = (infoMap.get('self-paced') || 'yes').toLowerCase() === 'yes';

        if (!data.info.courseName) errors.push('Course Info: "Course Name" is required.');
        if (!data.info.org) errors.push('Course Info: "Organization" is required.');
        if (!data.info.courseId) errors.push('Course Info: "Course ID" is required.');
        if (!data.info.run) errors.push('Course Info: "Run" is required.');
    } else {
        errors.push('Missing sheet: "Course Info"');
    }

    // --- Sheet 2: Structure ---
    const structSheet = findSheet(wb, 'Structure');
    if (structSheet) {
        const headers = getHeaders(structSheet);
        structSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header
            const r = rowToObject(row, headers);
            const chapter = objStr(r, 'chapter');
            const sequential = objStr(r, 'sequential');
            const vertical = objStr(r, 'vertical');
            const blockType = objStr(r, 'block_type').toLowerCase();
            const blockId = objStr(r, 'block_id');

            if (!chapter) { errors.push(`Structure row ${rowNumber}: "chapter" is required.`); return; }
            if (!sequential) { errors.push(`Structure row ${rowNumber}: "sequential" is required.`); return; }
            if (!vertical) { errors.push(`Structure row ${rowNumber}: "vertical" is required.`); return; }
            if (!blockType) { errors.push(`Structure row ${rowNumber}: "block_type" is required.`); return; }
            if (!blockId) { errors.push(`Structure row ${rowNumber}: "block_id" is required.`); return; }

            const validTypes = ['text', 'video', 'problem', 'openresponse'];
            if (!validTypes.includes(blockType)) {
                errors.push(`Structure row ${rowNumber}: Invalid block_type "${blockType}". Must be one of: ${validTypes.join(', ')}`);
                return;
            }

            data.structure.push({ chapter, sequential, vertical, blockType, blockId });
        });
    } else {
        errors.push('Missing sheet: "Structure"');
    }

    // --- Sheet 3: Text Blocks ---
    const textSheet = findSheet(wb, 'Text Blocks');
    if (textSheet) {
        const headers = getHeaders(textSheet);
        textSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const r = rowToObject(row, headers);
            const blockId = objStr(r, 'block_id');
            if (!blockId) { errors.push(`Text Blocks row ${rowNumber}: "block_id" is required.`); return; }
            data.textBlocks.set(blockId, {
                blockId,
                title: objStr(r, 'title') || 'Text',
                content: objStr(r, 'content') || ''
            });
        });
    }

    // --- Sheet 4: Videos ---
    const videoSheet = findSheet(wb, 'Videos');
    if (videoSheet) {
        const headers = getHeaders(videoSheet);
        videoSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const r = rowToObject(row, headers);
            const blockId = objStr(r, 'block_id');
            if (!blockId) { errors.push(`Videos row ${rowNumber}: "block_id" is required.`); return; }
            data.videoBlocks.set(blockId, {
                blockId,
                title: objStr(r, 'title') || 'Video',
                youtubeId: objStr(r, 'youtube_id'),
                html5Url: objStr(r, 'html5_url'),
                startTime: objStr(r, 'start_time') || '00:00:00',
                endTime: objStr(r, 'end_time') || '00:00:00'
            });
        });
    }

    // --- Sheet 5: Problems ---
    const probSheet = findSheet(wb, 'Problems');
    if (probSheet) {
        const headers = getHeaders(probSheet);
        probSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const r = rowToObject(row, headers);
            const blockId = objStr(r, 'block_id');
            if (!blockId) { errors.push(`Problems row ${rowNumber}: "block_id" is required.`); return; }

            const choiceLetters = ['a', 'b', 'c', 'd', 'e', 'f'];
            const correctRaw = objStr(r, 'correct').toUpperCase();
            const correctSet = new Set(correctRaw.split(/[,;\s]+/).filter(Boolean));

            const choices = [];
            for (const letter of choiceLetters) {
                const text = objStr(r, `choice_${letter}`);
                if (!text) continue;
                choices.push({
                    text,
                    correct: correctSet.has(letter.toUpperCase()),
                    hint: objStr(r, `hint_${letter}`)
                });
            }

            if (choices.length < 2) {
                errors.push(`Problems row ${rowNumber}: At least 2 choices are required.`);
                return;
            }

            if (!choices.some(c => c.correct)) {
                errors.push(`Problems row ${rowNumber}: No correct answer specified.`);
                return;
            }

            data.problemBlocks.set(blockId, {
                blockId,
                title: objStr(r, 'title') || blockId,
                questionText: objStr(r, 'question_text'),
                choices,
                explanation: objStr(r, 'explanation'),
                showAnswer: objStr(r, 'show_answer') || 'attempted'
            });
        });
    }

    // --- Sheet 6: Open Response ---
    const oraSheet = findSheet(wb, 'Open Response');
    if (oraSheet) {
        const headers = getHeaders(oraSheet);
        oraSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const r = rowToObject(row, headers);
            const blockId = objStr(r, 'block_id');
            if (!blockId) { errors.push(`Open Response row ${rowNumber}: "block_id" is required.`); return; }

            // Parse criteria: criterion_1_name, criterion_1_options, criterion_2_name, ...
            const criteria = [];
            for (let c = 1; c <= 10; c++) {
                const name = objStr(r, `criterion_${c}_name`);
                const optStr = objStr(r, `criterion_${c}_options`);
                if (!name || !optStr) break;
                // Format: "Poor=0;Fair=1;Good=2"
                const options = optStr.split(';').map(pair => {
                    const [label, pts] = pair.split('=');
                    return { label: label.trim(), points: parseInt(pts) || 0 };
                });
                criteria.push({ name, options });
            }

            data.openResponseBlocks.set(blockId, {
                blockId,
                title: objStr(r, 'title') || blockId,
                prompt: objStr(r, 'prompt') || '',
                criteria,
                assessmentType: objStr(r, 'assessment_type') || 'self'
            });
        });
    }

    // --- Cross-validate: check all block_ids in Structure exist ---
    for (const row of data.structure) {
        const { blockType, blockId } = row;
        if (blockType === 'text' && !data.textBlocks.has(blockId)) {
            errors.push(`Structure references text block "${blockId}" but it's not defined in "Text Blocks" sheet.`);
        } else if (blockType === 'video' && !data.videoBlocks.has(blockId)) {
            errors.push(`Structure references video block "${blockId}" but it's not defined in "Videos" sheet.`);
        } else if (blockType === 'problem' && !data.problemBlocks.has(blockId)) {
            errors.push(`Structure references problem block "${blockId}" but it's not defined in "Problems" sheet.`);
        } else if (blockType === 'openresponse' && !data.openResponseBlocks.has(blockId)) {
            errors.push(`Structure references open response block "${blockId}" but it's not defined in "Open Response" sheet.`);
        }
    }

    return { data, errors };
}

// --- Helpers ---

/**
 * Find a worksheet by name (case-insensitive).
 */
function findSheet(wb, name) {
    const target = name.toLowerCase().trim();
    return wb.worksheets.find(ws => ws.name.toLowerCase().trim() === target) || null;
}

/**
 * Extract header names from the first row of a worksheet.
 * Returns a Map of column index -> lowercase header name.
 */
function getHeaders(sheet) {
    const headers = new Map();
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        const val = cellValue(cell);
        if (val) {
            headers.set(colNumber, val.toLowerCase().replace(/\s+/g, '_'));
        }
    });
    return headers;
}

/**
 * Convert a row to a plain object keyed by header names.
 */
function rowToObject(row, headers) {
    const obj = {};
    headers.forEach((headerName, colNumber) => {
        obj[headerName] = cellValue(row.getCell(colNumber));
    });
    return obj;
}

/**
 * Extract string value from an ExcelJS cell, handling rich text and other types.
 */
function cellValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    const v = cell.value;
    // Rich text objects
    if (typeof v === 'object' && v.richText) {
        return v.richText.map(r => r.text).join('').trim();
    }
    // Date objects
    if (v instanceof Date) {
        return v.toISOString().split('T')[0];
    }
    // Formula results
    if (typeof v === 'object' && v.result !== undefined) {
        return String(v.result).trim();
    }
    return String(v).trim();
}

/**
 * Get a string value from a row object by key (case-insensitive, underscore-normalized).
 */
function objStr(row, key) {
    const lowerKey = key.toLowerCase().replace(/\s+/g, '_');
    if (row[lowerKey] !== undefined) return String(row[lowerKey]).trim();
    // fallback: try exact key
    if (row[key] !== undefined) return String(row[key]).trim();
    return '';
}
