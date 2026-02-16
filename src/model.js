/**
 * Internal data model for Course Engine.
 * Parser builds this from Excel; generators consume it to produce OLX.
 */

/**
 * @typedef {Object} CourseInfo
 * @property {string} courseName
 * @property {string} org
 * @property {string} courseId
 * @property {string} run
 * @property {string} language
 * @property {string} startDate
 * @property {string} endDate
 * @property {boolean} selfPaced
 */

/**
 * @typedef {Object} TextBlock
 * @property {string} blockId
 * @property {string} title
 * @property {string} content - HTML content
 */

/**
 * @typedef {Object} VideoBlock
 * @property {string} blockId
 * @property {string} title
 * @property {string} youtubeId
 * @property {string} html5Url
 * @property {string} startTime
 * @property {string} endTime
 */

/**
 * @typedef {Object} ProblemBlock
 * @property {string} blockId
 * @property {string} title
 * @property {string} questionText
 * @property {Array<{text: string, correct: boolean, hint: string}>} choices
 * @property {string} explanation
 * @property {string} showAnswer
 */

/**
 * @typedef {Object} CriterionOption
 * @property {string} label
 * @property {number} points
 */

/**
 * @typedef {Object} Criterion
 * @property {string} name
 * @property {CriterionOption[]} options
 */

/**
 * @typedef {Object} OpenResponseBlock
 * @property {string} blockId
 * @property {string} title
 * @property {string} prompt
 * @property {Criterion[]} criteria
 * @property {string} assessmentType - 'self', 'peer', 'staff'
 */

/**
 * @typedef {Object} StructureRow
 * @property {string} chapter
 * @property {string} sequential
 * @property {string} vertical
 * @property {string} blockType - 'text', 'video', 'problem', 'openresponse'
 * @property {string} blockId
 */

/**
 * @typedef {Object} CourseData
 * @property {CourseInfo} info
 * @property {StructureRow[]} structure
 * @property {Map<string, TextBlock>} textBlocks
 * @property {Map<string, VideoBlock>} videoBlocks
 * @property {Map<string, ProblemBlock>} problemBlocks
 * @property {Map<string, OpenResponseBlock>} openResponseBlocks
 */

/**
 * Create an empty CourseData object.
 */
export function createCourseData() {
    return {
        info: {
            courseName: '',
            org: '',
            courseId: '',
            run: '',
            language: 'en',
            startDate: '',
            endDate: '',
            selfPaced: true
        },
        structure: [],
        textBlocks: new Map(),
        videoBlocks: new Map(),
        problemBlocks: new Map(),
        openResponseBlocks: new Map()
    };
}

/**
 * Build hierarchical tree from flat structure rows.
 * Returns: [{ name, id, sequentials: [{ name, id, verticals: [{ name, id, blocks: [{ type, blockId }] }] }] }]
 */
export function buildHierarchy(structure, idMap) {
    const chapters = [];
    const chapterMap = new Map();

    for (const row of structure) {
        // Chapter level
        if (!chapterMap.has(row.chapter)) {
            const ch = {
                name: row.chapter,
                id: idMap.get(`ch:${row.chapter}`) || row.chapter,
                sequentials: [],
                _seqMap: new Map()
            };
            chapterMap.set(row.chapter, ch);
            chapters.push(ch);
        }
        const chapter = chapterMap.get(row.chapter);

        // Sequential level
        const seqKey = `${row.chapter}|${row.sequential}`;
        if (!chapter._seqMap.has(row.sequential)) {
            const seq = {
                name: row.sequential,
                id: idMap.get(`seq:${seqKey}`) || row.sequential,
                verticals: [],
                _vertMap: new Map()
            };
            chapter._seqMap.set(row.sequential, seq);
            chapter.sequentials.push(seq);
        }
        const sequential = chapter._seqMap.get(row.sequential);

        // Vertical level
        const vertKey = `${seqKey}|${row.vertical}`;
        if (!sequential._vertMap.has(row.vertical)) {
            const vert = {
                name: row.vertical,
                id: idMap.get(`vert:${vertKey}`) || row.vertical,
                blocks: []
            };
            sequential._vertMap.set(row.vertical, vert);
            sequential.verticals.push(vert);
        }
        const vertical = sequential._vertMap.get(row.vertical);

        // Add block reference
        vertical.blocks.push({
            type: row.blockType,
            blockId: row.blockId
        });
    }

    // Clean up temp maps
    for (const ch of chapters) {
        delete ch._seqMap;
        for (const seq of ch.sequentials) {
            delete seq._vertMap;
        }
    }

    return chapters;
}
