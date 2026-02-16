/**
 * Course Engine — Main application entry point.
 * Orchestrates file upload, parsing, preview, and export.
 * Supports two modes: Build (Excel → EdX) and Import (EdX → Excel).
 */
import { parseWorkbook } from './parser.js';
import ExcelJS from 'exceljs';
import { buildHierarchy } from './model.js';
import { generateId, sanitizeUrlName } from './utils.js';
import { renderPreview } from './preview.js';
import { generateCourse } from './generators/course.js';
import { generateChapters } from './generators/chapter.js';
import { generateSequentials } from './generators/sequential.js';
import { generateVerticals } from './generators/vertical.js';
import { generateHtmlBlocks } from './generators/html.js';
import { generateVideoBlocks } from './generators/video.js';
import { generateProblemBlocks } from './generators/problem.js';
import { generateOpenResponseBlocks } from './generators/openresponse.js';
import { generateTarGz, downloadBlob } from './archive.js';
import { extractTarGz } from './untar.js';
import { parseOlx } from './olx-parser.js';
import { courseDataToExcel } from './excel-writer.js';

// ============================================================
// MODE SWITCHING
// ============================================================

const tabBuild = document.getElementById('tab-build');
const tabImport = document.getElementById('tab-import');
const buildMode = document.getElementById('build-mode');
const importMode = document.getElementById('import-mode');

tabBuild.addEventListener('click', () => switchMode('build'));
tabImport.addEventListener('click', () => switchMode('import'));

function switchMode(mode) {
    const isBuild = mode === 'build';
    buildMode.style.display = isBuild ? '' : 'none';
    importMode.style.display = isBuild ? 'none' : '';
    tabBuild.classList.toggle('active', isBuild);
    tabImport.classList.toggle('active', !isBuild);
}


// ============================================================
// BUILD MODE — Excel → EdX .tar.gz
// ============================================================

let courseData = null;
let hierarchy = null;
let idMap = new Map();

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const templateBtn = document.getElementById('template-btn');
const previewSection = document.getElementById('preview-section');
const previewContent = document.getElementById('preview-content');
const errorsSection = document.getElementById('errors-section');
const errorsList = document.getElementById('errors-list');
const statsSection = document.getElementById('stats-section');
const exportBtn = document.getElementById('export-btn');
const fileName = document.getElementById('file-name');
const courseTitle = document.getElementById('course-title');

browseBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

async function handleFile(file) {
    fileName.textContent = file.name;
    fileName.style.display = 'inline-block';

    try {
        const buffer = await file.arrayBuffer();
        const result = await parseWorkbook(buffer);

        courseData = result.data;

        idMap = new Map();
        for (const row of courseData.structure) {
            const chKey = `ch:${row.chapter}`;
            if (!idMap.has(chKey)) idMap.set(chKey, sanitizeUrlName(row.chapter) + '_' + generateId().substring(0, 8));

            const seqKey = `seq:${row.chapter}|${row.sequential}`;
            if (!idMap.has(seqKey)) idMap.set(seqKey, sanitizeUrlName(row.sequential) + '_' + generateId().substring(0, 8));

            const vertKey = `vert:${row.chapter}|${row.sequential}|${row.vertical}`;
            if (!idMap.has(vertKey)) idMap.set(vertKey, sanitizeUrlName(row.vertical) + '_' + generateId().substring(0, 8));
        }

        hierarchy = buildHierarchy(courseData.structure, idMap);

        if (result.errors.length > 0) {
            errorsSection.style.display = 'block';
            errorsList.innerHTML = result.errors
                .map(e => `<li>${escapeHtml(e)}</li>`)
                .join('');
        } else {
            errorsSection.style.display = 'none';
        }

        if (courseData.info.courseName) {
            courseTitle.textContent = courseData.info.courseName;
            courseTitle.style.display = 'block';
        }

        updateStats(courseData, statsSection);

        previewSection.style.display = 'block';
        previewContent.innerHTML = renderPreview(hierarchy, courseData);

        exportBtn.disabled = result.errors.length > 0;
        exportBtn.style.display = 'flex';
    } catch (err) {
        console.error('File parsing failed:', err);
        errorsSection.style.display = 'block';
        errorsList.innerHTML = `<li>Error parsing file: ${escapeHtml(err.message)}</li>`;
    }
}

function updateStats(data, container) {
    if (!data) return;
    const s = data.structure;
    const chapters = new Set(s.map(r => r.chapter)).size;
    const sequentials = new Set(s.map(r => `${r.chapter}|${r.sequential}`)).size;
    const verticals = new Set(s.map(r => `${r.chapter}|${r.sequential}|${r.vertical}`)).size;

    container.innerHTML = `
    <div class="stat"><span class="stat-value">${chapters}</span><span class="stat-label">Chapters</span></div>
    <div class="stat"><span class="stat-value">${sequentials}</span><span class="stat-label">Subsections</span></div>
    <div class="stat"><span class="stat-value">${verticals}</span><span class="stat-label">Units</span></div>
    <div class="stat"><span class="stat-value">${data.textBlocks.size}</span><span class="stat-label">Text Blocks</span></div>
    <div class="stat"><span class="stat-value">${data.videoBlocks.size}</span><span class="stat-label">Videos</span></div>
    <div class="stat"><span class="stat-value">${data.problemBlocks.size}</span><span class="stat-label">Problems</span></div>
    <div class="stat"><span class="stat-value">${data.openResponseBlocks.size}</span><span class="stat-label">Open Response</span></div>
  `;
    container.style.display = 'flex';
}

// --- Build Export ---

exportBtn.addEventListener('click', async () => {
    if (!courseData || !hierarchy) return;

    exportBtn.disabled = true;
    exportBtn.innerHTML = '<span class="btn-icon">⏳</span> Generating...';

    try {
        const allFiles = new Map();

        const merge = (fileMap) => {
            for (const [path, content] of fileMap) {
                allFiles.set(path, content);
            }
        };

        merge(generateCourse(courseData.info, hierarchy));
        merge(generateChapters(hierarchy));
        merge(generateSequentials(hierarchy));
        merge(generateVerticals(hierarchy));
        merge(generateHtmlBlocks(courseData.textBlocks));
        merge(generateVideoBlocks(courseData.videoBlocks));
        merge(generateProblemBlocks(courseData.problemBlocks));
        merge(generateOpenResponseBlocks(courseData.openResponseBlocks));

        const blob = await generateTarGz(allFiles);
        const filename = `${sanitizeUrlName(courseData.info.courseName || 'course')}_export.tar.gz`;
        await downloadBlob(blob, filename);

        exportBtn.innerHTML = `<span class="btn-icon">✅</span> Downloaded: ${filename}`;
        setTimeout(() => {
            exportBtn.innerHTML = '<span class="btn-icon">📦</span> Export .tar.gz for EdX';
            exportBtn.disabled = false;
        }, 4000);
    } catch (err) {
        console.error('Export failed:', err);
        exportBtn.innerHTML = '<span class="btn-icon">❌</span> Export Failed';
        setTimeout(() => {
            exportBtn.innerHTML = '<span class="btn-icon">📦</span> Export .tar.gz for EdX';
            exportBtn.disabled = false;
        }, 3000);
    }
});

// --- Template Download ---

templateBtn.addEventListener('click', () => {
    generateTemplate();
});

async function generateTemplate() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Course Engine';
    wb.created = new Date();

    // --- Sheet 1: Course Info ---
    const ws1 = wb.addWorksheet('Course Info');
    ws1.columns = [
        { header: 'Field', key: 'field', width: 20 },
        { header: 'Value', key: 'value', width: 40 }
    ];
    ws1.addRows([
        { field: 'Course Name', value: 'My Course Title' },
        { field: 'Organization', value: 'MyOrgX' },
        { field: 'Course ID', value: 'COURSE101' },
        { field: 'Run', value: '2024_T1' },
        { field: 'Language', value: 'en' },
        { field: 'Start Date', value: '2024-01-15' },
        { field: 'End Date', value: '2024-12-31' },
        { field: 'Self-Paced', value: 'Yes' }
    ]);

    // --- Sheet 2: Structure ---
    const ws2 = wb.addWorksheet('Structure');
    ws2.columns = [
        { header: 'chapter', key: 'chapter', width: 30 },
        { header: 'sequential', key: 'sequential', width: 25 },
        { header: 'vertical', key: 'vertical', width: 30 },
        { header: 'block_type', key: 'blockType', width: 15 },
        { header: 'block_id', key: 'blockId', width: 20 }
    ];
    ws2.addRows([
        { chapter: 'Chapter 1: Introduction', sequential: '1.1 Welcome', vertical: 'Unit 1.1.1 Overview', blockType: 'text', blockId: 'welcome_text' },
        { chapter: 'Chapter 1: Introduction', sequential: '1.1 Welcome', vertical: 'Unit 1.1.1 Overview', blockType: 'video', blockId: 'welcome_video' },
        { chapter: 'Chapter 1: Introduction', sequential: '1.2 Core Concepts', vertical: 'Unit 1.2.1 Lecture', blockType: 'video', blockId: 'lecture_1' },
        { chapter: 'Chapter 1: Introduction', sequential: '1.2 Core Concepts', vertical: 'Unit 1.2.1 Lecture', blockType: 'text', blockId: 'reading_1' },
        { chapter: 'Chapter 1: Introduction', sequential: '1.2 Core Concepts', vertical: 'Unit 1.2.2 Quiz', blockType: 'problem', blockId: 'quiz_q1' },
        { chapter: 'Chapter 1: Introduction', sequential: '1.2 Core Concepts', vertical: 'Unit 1.2.2 Quiz', blockType: 'problem', blockId: 'quiz_q2' },
        { chapter: 'Chapter 1: Introduction', sequential: '1.2 Core Concepts', vertical: 'Unit 1.2.3 Reflection', blockType: 'openresponse', blockId: 'reflection_1' }
    ]);

    // --- Sheet 3: Text Blocks ---
    const ws3 = wb.addWorksheet('Text Blocks');
    ws3.columns = [
        { header: 'block_id', key: 'blockId', width: 20 },
        { header: 'title', key: 'title', width: 20 },
        { header: 'content', key: 'content', width: 80 }
    ];
    ws3.addRows([
        { blockId: 'welcome_text', title: 'Welcome', content: '<h1>Welcome to the Course</h1><p>This course introduces you to key concepts.</p>' },
        { blockId: 'reading_1', title: 'Reading List', content: '<h1>Reading List</h1><p>1. Smith, J. (2024). Intro to the Subject.</p>' }
    ]);

    // --- Sheet 4: Videos ---
    const ws4 = wb.addWorksheet('Videos');
    ws4.columns = [
        { header: 'block_id', key: 'blockId', width: 20 },
        { header: 'title', key: 'title', width: 20 },
        { header: 'youtube_id', key: 'youtubeId', width: 20 },
        { header: 'html5_url', key: 'html5Url', width: 40 },
        { header: 'start_time', key: 'startTime', width: 12 },
        { header: 'end_time', key: 'endTime', width: 12 }
    ];
    ws4.addRows([
        { blockId: 'welcome_video', title: 'Welcome Video', youtubeId: 'dQw4w9WgXcQ', html5Url: '', startTime: '00:00:00', endTime: '00:00:00' },
        { blockId: 'lecture_1', title: 'Lecture 1', youtubeId: 'cH5tV9gFgHk', html5Url: '', startTime: '', endTime: '' }
    ]);

    // --- Sheet 5: Problems ---
    const ws5 = wb.addWorksheet('Problems');
    ws5.columns = [
        { header: 'block_id', key: 'blockId', width: 12 },
        { header: 'title', key: 'title', width: 10 },
        { header: 'question_text', key: 'questionText', width: 40 },
        { header: 'choice_a', key: 'choice_a', width: 15 },
        { header: 'choice_b', key: 'choice_b', width: 15 },
        { header: 'choice_c', key: 'choice_c', width: 15 },
        { header: 'choice_d', key: 'choice_d', width: 15 },
        { header: 'correct', key: 'correct', width: 8 },
        { header: 'hint_a', key: 'hint_a', width: 20 },
        { header: 'hint_b', key: 'hint_b', width: 20 },
        { header: 'hint_c', key: 'hint_c', width: 20 },
        { header: 'hint_d', key: 'hint_d', width: 20 },
        { header: 'explanation', key: 'explanation', width: 40 },
        { header: 'show_answer', key: 'showAnswer', width: 12 }
    ];
    ws5.addRows([
        { blockId: 'quiz_q1', title: 'Q1', questionText: 'What is 2 + 2?', choice_a: '3', choice_b: '4', choice_c: '5', choice_d: '22', correct: 'B', hint_a: 'Too low', hint_b: 'Correct!', hint_c: 'Too high', hint_d: 'Not quite', explanation: 'Basic addition: 2 + 2 = 4', showAnswer: 'attempted' },
        { blockId: 'quiz_q2', title: 'Q2', questionText: 'Which color is the sky on a clear day?', choice_a: 'Red', choice_b: 'Green', choice_c: 'Blue', choice_d: 'Yellow', correct: 'C', hint_a: 'Not red', hint_b: 'Not green', hint_c: "That's right!", hint_d: 'Not yellow', explanation: 'The sky appears blue due to Rayleigh scattering.', showAnswer: 'attempted' }
    ]);

    // --- Sheet 6: Open Response ---
    const ws6 = wb.addWorksheet('Open Response');
    ws6.columns = [
        { header: 'block_id', key: 'blockId', width: 15 },
        { header: 'title', key: 'title', width: 20 },
        { header: 'prompt', key: 'prompt', width: 60 },
        { header: 'criterion_1_name', key: 'crit1Name', width: 25 },
        { header: 'criterion_1_options', key: 'crit1Opts', width: 50 },
        { header: 'criterion_2_name', key: 'crit2Name', width: 25 },
        { header: 'criterion_2_options', key: 'crit2Opts', width: 50 },
        { header: 'assessment_type', key: 'assessmentType', width: 15 }
    ];
    ws6.addRows([
        { blockId: 'reflection_1', title: 'Chapter Reflection', prompt: 'Reflect on what you learned in this chapter. What was the most surprising concept?', crit1Name: 'Depth of Reflection', crit1Opts: 'Superficial=0;Adequate=1;Thoughtful=2;Exceptional=3', crit2Name: 'Writing Quality', crit2Opts: 'Poor=0;Fair=1;Good=2;Excellent=3', assessmentType: 'self' }
    ]);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, 'edx_manifest_template.xlsx');
}

// ============================================================
// IMPORT MODE — EdX .tar.gz → Excel
// ============================================================

let importedCourseData = null;

const importDropZone = document.getElementById('import-drop-zone');
const importFileInput = document.getElementById('import-file-input');
const importBrowseBtn = document.getElementById('import-browse-btn');
const importFileName = document.getElementById('import-file-name');
const importWarningsSection = document.getElementById('import-warnings-section');
const importWarningsList = document.getElementById('import-warnings-list');
const importStatsSection = document.getElementById('import-stats-section');
const importCourseTitle = document.getElementById('import-course-title');
const importPreviewSection = document.getElementById('import-preview-section');
const importPreviewContent = document.getElementById('import-preview-content');
const importExportBtn = document.getElementById('import-export-btn');

importBrowseBtn.addEventListener('click', () => importFileInput.click());

importFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleImportFile(e.target.files[0]);
    }
});

importDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    importDropZone.classList.add('drag-over');
});

importDropZone.addEventListener('dragleave', () => {
    importDropZone.classList.remove('drag-over');
});

importDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    importDropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        handleImportFile(e.dataTransfer.files[0]);
    }
});

async function handleImportFile(file) {
    importFileName.textContent = file.name;
    importFileName.style.display = 'inline-block';

    try {
        const buffer = await file.arrayBuffer();

        // Step 1: Extract the tar.gz
        const files = extractTarGz(buffer);

        // Step 2: Parse OLX into CourseData
        const result = parseOlx(files);
        importedCourseData = result.data;

        // Show warnings
        if (result.warnings.length > 0) {
            importWarningsSection.style.display = 'block';
            importWarningsList.innerHTML = result.warnings
                .map(w => `<li>${escapeHtml(w)}</li>`)
                .join('');
        } else {
            importWarningsSection.style.display = 'none';
        }

        // Show course title
        if (importedCourseData.info.courseName) {
            importCourseTitle.textContent = importedCourseData.info.courseName;
            importCourseTitle.style.display = 'block';
        }

        // Show stats
        updateStats(importedCourseData, importStatsSection);

        // Build hierarchy for preview
        const importIdMap = new Map();
        for (const row of importedCourseData.structure) {
            const chKey = `ch:${row.chapter}`;
            if (!importIdMap.has(chKey)) importIdMap.set(chKey, sanitizeUrlName(row.chapter) + '_' + generateId().substring(0, 8));

            const seqKey = `seq:${row.chapter}|${row.sequential}`;
            if (!importIdMap.has(seqKey)) importIdMap.set(seqKey, sanitizeUrlName(row.sequential) + '_' + generateId().substring(0, 8));

            const vertKey = `vert:${row.chapter}|${row.sequential}|${row.vertical}`;
            if (!importIdMap.has(vertKey)) importIdMap.set(vertKey, sanitizeUrlName(row.vertical) + '_' + generateId().substring(0, 8));
        }

        const importHierarchy = buildHierarchy(importedCourseData.structure, importIdMap);

        // Render preview
        importPreviewSection.style.display = 'block';
        importPreviewContent.innerHTML = renderPreview(importHierarchy, importedCourseData);

        // Enable export
        importExportBtn.disabled = false;
        importExportBtn.style.display = 'flex';

    } catch (err) {
        console.error('Import failed:', err);
        importWarningsSection.style.display = 'block';
        importWarningsList.innerHTML = `<li>Import failed: ${escapeHtml(err.message)}</li>`;
    }
}

// --- Import Export (to Excel) ---

importExportBtn.addEventListener('click', async () => {
    if (!importedCourseData) return;

    importExportBtn.disabled = true;
    importExportBtn.innerHTML = '<span class="btn-icon">⏳</span> Generating Excel...';

    try {
        const blob = await courseDataToExcel(importedCourseData);
        const filename = `${sanitizeUrlName(importedCourseData.info.courseName || 'course')}_edx_manifest.xlsx`;
        await downloadBlob(blob, filename);

        importExportBtn.innerHTML = `<span class="btn-icon">✅</span> Downloaded: ${filename}`;
        setTimeout(() => {
            importExportBtn.innerHTML = '<span class="btn-icon">📊</span> Export to Excel (.xlsx)';
            importExportBtn.disabled = false;
        }, 4000);
    } catch (err) {
        console.error('Excel export failed:', err);
        importExportBtn.innerHTML = '<span class="btn-icon">❌</span> Export Failed';
        setTimeout(() => {
            importExportBtn.innerHTML = '<span class="btn-icon">📊</span> Export to Excel (.xlsx)';
            importExportBtn.disabled = false;
        }, 3000);
    }
});

// ============================================================
// HELPERS
// ============================================================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
