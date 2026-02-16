/**
 * OLX Reverse Parser — reads extracted OLX files and builds a CourseData model.
 * This is the reverse of the generators: OLX XML → internal model → Excel.
 */
import { createCourseData } from './model.js';

/**
 * Parse extracted OLX files into CourseData.
 * @param {Map<string, string>} files - filePath → content (from extractTarGz)
 * @returns {{ data: import('./model.js').CourseData, warnings: string[] }}
 */
export function parseOlx(files) {
    const data = createCourseData();
    const warnings = [];

    // --- Step 1: Parse course.xml to get the run/url_name ---
    const courseXml = files.get('course.xml');
    if (!courseXml) {
        warnings.push('Missing course.xml — cannot determine course structure.');
        return { data, warnings };
    }

    const courseAttrs = parseXmlAttributes(courseXml);
    const run = courseAttrs.url_name || '';
    data.info.org = courseAttrs.org || '';
    data.info.courseId = courseAttrs.course || '';
    data.info.run = run;

    // --- Step 2: Parse course/{run}.xml for metadata and chapter list ---
    const courseRunXml = files.get(`course/${run}.xml`);
    if (courseRunXml) {
        const runAttrs = parseXmlAttributes(courseRunXml);
        data.info.courseName = runAttrs.display_name || '';
        data.info.language = runAttrs.language || 'en';
        data.info.selfPaced = runAttrs.self_paced === 'true';
        if (runAttrs.start) data.info.startDate = runAttrs.start;
        if (runAttrs.end) data.info.endDate = runAttrs.end;
    }

    // --- Step 3: Parse policies for additional metadata ---
    const policyFile = files.get(`policies/${run}/policy.json`);
    if (policyFile) {
        try {
            const policy = JSON.parse(policyFile);
            const coursePolicy = policy[`course/${run}`] || Object.values(policy)[0] || {};
            if (!data.info.courseName && coursePolicy.display_name) {
                data.info.courseName = coursePolicy.display_name;
            }
            if (coursePolicy.language) data.info.language = coursePolicy.language;
            if (coursePolicy.self_paced !== undefined) data.info.selfPaced = coursePolicy.self_paced;
        } catch (e) {
            warnings.push(`Could not parse policies/${run}/policy.json`);
        }
    }

    // --- Step 4: Walk the hierarchy: chapters → sequentials → verticals → blocks ---
    const chapterIds = extractChildIds(courseRunXml || '', 'chapter');

    for (const chId of chapterIds) {
        const chXml = files.get(`chapter/${chId}.xml`);
        if (!chXml) {
            warnings.push(`Chapter file not found: chapter/${chId}.xml`);
            continue;
        }
        const chAttrs = parseXmlAttributes(chXml);
        const chapterName = chAttrs.display_name || chId;

        const seqIds = extractChildIds(chXml, 'sequential');
        for (const seqId of seqIds) {
            const seqXml = files.get(`sequential/${seqId}.xml`);
            if (!seqXml) {
                warnings.push(`Sequential file not found: sequential/${seqId}.xml`);
                continue;
            }
            const seqAttrs = parseXmlAttributes(seqXml);
            const seqName = seqAttrs.display_name || seqId;

            const vertIds = extractChildIds(seqXml, 'vertical');
            for (const vertId of vertIds) {
                const vertXml = files.get(`vertical/${vertId}.xml`);
                if (!vertXml) {
                    warnings.push(`Vertical file not found: vertical/${vertId}.xml`);
                    continue;
                }
                const vertAttrs = parseXmlAttributes(vertXml);
                const vertName = vertAttrs.display_name || vertId;

                // Extract all blocks from this vertical
                const blocks = extractBlocks(vertXml);
                for (const block of blocks) {
                    let blockType;
                    let blockId = block.url_name;

                    switch (block.tag) {
                        case 'html':
                            blockType = 'text';
                            parseHtmlBlock(files, blockId, data, warnings);
                            break;
                        case 'video':
                            blockType = 'video';
                            parseVideoBlock(files, blockId, block, data, warnings);
                            break;
                        case 'problem':
                            blockType = 'problem';
                            parseProblemBlock(files, blockId, data, warnings);
                            break;
                        case 'openassessment':
                            blockType = 'openresponse';
                            parseOpenResponseBlock(files, blockId, data, warnings);
                            break;
                        // Known block types that don't carry extractable content
                        case 'library_content':
                        case 'discussion':
                        case 'lti':
                        case 'lti_consumer':
                            continue; // skip silently
                        default:
                            warnings.push(`Unknown block type "${block.tag}" in vertical ${vertId}, skipping.`);
                            continue;
                    }

                    if (blockType && blockId) {
                        data.structure.push({
                            chapter: chapterName,
                            sequential: seqName,
                            vertical: vertName,
                            blockType,
                            blockId
                        });
                    }
                }
            }
        }
    }

    return { data, warnings };
}

// --- Block Parsers ---

function parseHtmlBlock(files, blockId, data, warnings) {
    if (data.textBlocks.has(blockId)) return;

    const xmlFile = files.get(`html/${blockId}.xml`);
    const xmlAttrs = xmlFile ? parseXmlAttributes(xmlFile) : {};
    const title = xmlAttrs.display_name || blockId;

    // The content is in an .html file, referenced by the filename attribute
    const htmlFilename = xmlAttrs.filename || blockId;
    const htmlContent = files.get(`html/${htmlFilename}.html`) || '';

    data.textBlocks.set(blockId, {
        blockId,
        title,
        content: htmlContent.trim()
    });
}

function parseVideoBlock(files, blockId, inlineAttrs, data, warnings) {
    if (data.videoBlocks.has(blockId)) return;

    const xmlFile = files.get(`video/${blockId}.xml`);
    const attrs = xmlFile ? parseXmlAttributes(xmlFile) : inlineAttrs;

    const title = attrs.display_name || blockId;

    // YouTube ID from youtube_id_1_0 or parse from youtube="1.00:ID"
    let youtubeId = attrs.youtube_id_1_0 || '';
    if (!youtubeId && attrs.youtube) {
        const match = attrs.youtube.match(/1\.00:(\S+)/);
        if (match) youtubeId = match[1];
    }

    // HTML5 sources
    let html5Url = '';
    if (attrs.html5_sources) {
        try {
            // It might be a JSON array or HTML-encoded
            const decoded = attrs.html5_sources.replace(/&quot;/g, '"');
            const arr = JSON.parse(decoded);
            html5Url = arr[0] || '';
        } catch (e) {
            // Try as plain string
            html5Url = attrs.html5_sources;
        }
    }

    data.videoBlocks.set(blockId, {
        blockId,
        title,
        youtubeId,
        html5Url,
        startTime: attrs.start_time || '00:00:00',
        endTime: attrs.end_time || '00:00:00'
    });
}

function parseProblemBlock(files, blockId, data, warnings) {
    if (data.problemBlocks.has(blockId)) return;

    const xmlFile = files.get(`problem/${blockId}.xml`);
    if (!xmlFile) {
        warnings.push(`Problem file not found: problem/${blockId}.xml`);
        return;
    }

    const attrs = parseXmlAttributes(xmlFile);
    const title = attrs.display_name || blockId;

    // Parse question text from <label> tag
    const labelMatch = xmlFile.match(/<label>([\s\S]*?)<\/label>/);
    const questionText = labelMatch ? stripTags(labelMatch[1]).trim() : '';

    // Parse choices
    const choices = [];
    const choiceRegex = /<choice\s+correct="(true|false)">([\s\S]*?)<\/choice>/g;
    let match;
    while ((match = choiceRegex.exec(xmlFile)) !== null) {
        const correct = match[1] === 'true';
        const choiceContent = match[2];

        // Extract hint if present
        const hintMatch = choiceContent.match(/<choicehint>([\s\S]*?)<\/choicehint>/);
        const hint = hintMatch ? stripTags(hintMatch[1]).trim() : '';

        // Extract choice text (everything before the hint tag)
        let text = choiceContent;
        if (hintMatch) {
            text = choiceContent.substring(0, choiceContent.indexOf('<choicehint'));
        }
        text = stripTags(text).trim();

        choices.push({ text, correct, hint });
    }

    // Parse explanation from <solution>
    const solMatch = xmlFile.match(/<solution>([\s\S]*?)<\/solution>/);
    const explanation = solMatch ? stripTags(solMatch[1]).replace(/Explanation\s*/i, '').trim() : '';

    data.problemBlocks.set(blockId, {
        blockId,
        title,
        questionText,
        choices,
        explanation,
        showAnswer: attrs.showanswer || 'attempted'
    });
}

function parseOpenResponseBlock(files, blockId, data, warnings) {
    if (data.openResponseBlocks.has(blockId)) return;

    const xmlFile = files.get(`openassessment/${blockId}.xml`);
    if (!xmlFile) {
        warnings.push(`Open response file not found: openassessment/${blockId}.xml`);
        return;
    }

    const attrs = parseXmlAttributes(xmlFile);
    const title = attrs.display_name || blockId;

    // Parse prompt
    const descMatch = xmlFile.match(/<description>([\s\S]*?)<\/description>/);
    const prompt = descMatch ? stripTags(descMatch[1]).trim() : '';

    // Parse criteria
    const criteria = [];
    const criterionRegex = /<criterion>([\s\S]*?)<\/criterion>/g;
    let critMatch;
    while ((critMatch = criterionRegex.exec(xmlFile)) !== null) {
        const critContent = critMatch[1];
        const nameMatch = critContent.match(/<name>([\s\S]*?)<\/name>/);
        const criterionName = nameMatch ? stripTags(nameMatch[1]).trim() : '';

        const options = [];
        const optionRegex = /<option\s+points="(\d+)">([\s\S]*?)<\/option>/g;
        let optMatch;
        while ((optMatch = optionRegex.exec(critContent)) !== null) {
            const points = parseInt(optMatch[1]) || 0;
            const optContent = optMatch[2];
            const labelMatch = optContent.match(/<label>([\s\S]*?)<\/label>/);
            const label = labelMatch ? stripTags(labelMatch[1]).trim() : '';
            options.push({ label, points });
        }

        if (criterionName) {
            criteria.push({ name: criterionName, options });
        }
    }

    // Parse assessment type
    let assessmentType = 'self';
    if (xmlFile.includes('name="staff-assessment"')) assessmentType = 'staff';
    else if (xmlFile.includes('name="peer-assessment"')) assessmentType = 'peer';

    data.openResponseBlocks.set(blockId, {
        blockId,
        title,
        prompt,
        criteria,
        assessmentType
    });
}

// --- XML Helpers ---

/**
 * Parse XML attributes from the root element of an XML string.
 * Returns a plain object of attr_name → value.
 */
function parseXmlAttributes(xml) {
    const attrs = {};
    // Match the first opening tag with its attributes
    const tagMatch = xml.match(/<\w+\s([^>]*?)\/?>/);
    if (!tagMatch) return attrs;

    const attrStr = tagMatch[1];
    // Match attr="value" pairs (handles single and double quotes)
    const attrRegex = /([\w_:-]+)\s*=\s*"([^"]*?)"/g;
    let match;
    while ((match = attrRegex.exec(attrStr)) !== null) {
        attrs[match[1]] = decodeXmlEntities(match[2]);
    }
    return attrs;
}

/**
 * Extract child element url_names for a given tag.
 * e.g., extractChildIds(xml, 'chapter') finds all <chapter url_name="..."/>
 */
function extractChildIds(xml, tagName) {
    const ids = [];
    const regex = new RegExp(`<${tagName}\\s[^>]*url_name="([^"]*)"`, 'g');
    let match;
    while ((match = regex.exec(xml)) !== null) {
        ids.push(match[1]);
    }
    return ids;
}

/**
 * Extract all block elements from a vertical XML.
 * Returns array of { tag, url_name, ...other_attrs }
 */
function extractBlocks(xml) {
    const blocks = [];
    const regex = /<(\w+)\s([^>]*?)\/?\s*>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        const tag = match[1];
        if (tag === 'vertical') continue; // skip the root <vertical> tag
        const attrs = {};
        const attrRegex = /([\w_:-]+)\s*=\s*"([^"]*?)"/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(match[2])) !== null) {
            attrs[attrMatch[1]] = decodeXmlEntities(attrMatch[2]);
        }
        if (attrs.url_name) {
            blocks.push({ tag, ...attrs });
        }
    }
    return blocks;
}

function stripTags(html) {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeXmlEntities(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}
