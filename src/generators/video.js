/**
 * Video block OLX generator.
 * Produces: video/{blockId}.xml for each video.
 */
import { escapeXml } from '../utils.js';

/**
 * @param {Map<string, import('../model.js').VideoBlock>} videoBlocks
 * @returns {Map<string, string>} filePath → content
 */
export function generateVideoBlocks(videoBlocks) {
    const files = new Map();

    for (const [blockId, block] of videoBlocks) {
        const attrs = [];
        attrs.push(`url_name="${escapeXml(blockId)}"`);
        attrs.push(`display_name="${escapeXml(block.title)}"`);

        if (block.youtubeId) {
            attrs.push(`youtube="1.00:${escapeXml(block.youtubeId)}"`);
            attrs.push(`youtube_id_1_0="${escapeXml(block.youtubeId)}"`);
        }

        if (block.html5Url) {
            attrs.push(`html5_sources="[&quot;${escapeXml(block.html5Url)}&quot;]"`);
        } else {
            attrs.push(`html5_sources="[]"`);
        }

        attrs.push(`start_time="${escapeXml(block.startTime || '00:00:00')}"`);
        attrs.push(`end_time="${escapeXml(block.endTime || '00:00:00')}"`);
        attrs.push(`edx_video_id=""`);

        files.set(`video/${blockId}.xml`,
            `<video ${attrs.join(' ')}/>\n`
        );
    }

    return files;
}
