/**
 * Preview renderer — generates HTML preview of course structure and content.
 */
import { escapeXml } from './utils.js';

/**
 * Render a course tree preview from hierarchy and block data.
 * @param {Array} chapters
 * @param {import('./model.js').CourseData} courseData
 * @returns {string} HTML string
 */
export function renderPreview(chapters, courseData) {
    if (!chapters || chapters.length === 0) {
        return '<p class="preview-empty">No course structure to preview. Upload an Excel file to begin.</p>';
    }

    let html = '';

    for (const ch of chapters) {
        html += `<div class="preview-chapter">`;
        html += `<h3 class="preview-chapter-title">
      <span class="preview-icon">📚</span> ${escapeXml(ch.name)}
    </h3>`;

        for (const seq of ch.sequentials) {
            html += `<div class="preview-sequential">`;
            html += `<h4 class="preview-seq-title">
        <span class="preview-icon">📖</span> ${escapeXml(seq.name)}
      </h4>`;

            for (const vert of seq.verticals) {
                html += `<div class="preview-vertical">`;
                html += `<h5 class="preview-vert-title">
          <span class="preview-icon">📄</span> ${escapeXml(vert.name)}
        </h5>`;
                html += `<div class="preview-blocks">`;

                for (const block of vert.blocks) {
                    html += renderBlock(block, courseData);
                }

                html += `</div></div>`;
            }

            html += `</div>`;
        }

        html += `</div>`;
    }

    return html;
}

function renderBlock(block, courseData) {
    const { type, blockId } = block;

    switch (type) {
        case 'text': {
            const tb = courseData.textBlocks.get(blockId);
            if (!tb) return errorBlock('text', blockId);
            return `<div class="preview-block block-text">
        <div class="block-badge badge-text">TEXT</div>
        <div class="block-title">${escapeXml(tb.title)}</div>
        <div class="block-content-preview">${truncate(stripHtml(tb.content), 120)}</div>
      </div>`;
        }
        case 'video': {
            const vb = courseData.videoBlocks.get(blockId);
            if (!vb) return errorBlock('video', blockId);
            return `<div class="preview-block block-video">
        <div class="block-badge badge-video">VIDEO</div>
        <div class="block-title">${escapeXml(vb.title)}</div>
        <div class="block-content-preview">
          ${vb.youtubeId ? `<span class="video-id">YouTube: ${escapeXml(vb.youtubeId)}</span>` : ''}
          ${vb.html5Url ? `<span class="video-id">URL: ${escapeXml(vb.html5Url)}</span>` : ''}
        </div>
      </div>`;
        }
        case 'problem': {
            const pb = courseData.problemBlocks.get(blockId);
            if (!pb) return errorBlock('problem', blockId);
            const correctCount = pb.choices.filter(c => c.correct).length;
            return `<div class="preview-block block-problem">
        <div class="block-badge badge-problem">PROBLEM</div>
        <div class="block-title">${escapeXml(pb.title)}</div>
        <div class="block-content-preview">${escapeXml(truncate(pb.questionText, 100))}</div>
        <div class="block-meta">${pb.choices.length} choices · ${correctCount} correct</div>
      </div>`;
        }
        case 'openresponse': {
            const ora = courseData.openResponseBlocks.get(blockId);
            if (!ora) return errorBlock('openresponse', blockId);
            return `<div class="preview-block block-ora">
        <div class="block-badge badge-ora">OPEN RESPONSE</div>
        <div class="block-title">${escapeXml(ora.title)}</div>
        <div class="block-content-preview">${escapeXml(truncate(ora.prompt, 100))}</div>
        <div class="block-meta">${ora.criteria.length} criteria · ${ora.assessmentType} assessment</div>
      </div>`;
        }
        default:
            return `<div class="preview-block block-unknown">
        <div class="block-badge">UNKNOWN</div>
        <div class="block-title">${escapeXml(blockId)}</div>
      </div>`;
    }
}

function errorBlock(type, blockId) {
    return `<div class="preview-block block-error">
    <div class="block-badge badge-error">⚠️ MISSING</div>
    <div class="block-title">${escapeXml(type)}: ${escapeXml(blockId)} — not found in data sheets</div>
  </div>`;
}

function stripHtml(html) {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(str, max) {
    if (!str) return '';
    if (str.length <= max) return str;
    return str.substring(0, max) + '…';
}
