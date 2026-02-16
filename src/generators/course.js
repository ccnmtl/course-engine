/**
 * Course-level OLX generator.
 * Produces: course.xml, course/{run}.xml, policies/{run}/policy.json, policies/{run}/grading_policy.json
 */
import { escapeXml, formatEdxDate } from '../utils.js';

/**
 * @param {import('../model.js').CourseInfo} info
 * @param {Array} chapters - hierarchy from buildHierarchy
 * @returns {Map<string, string>} filePath → content
 */
export function generateCourse(info, chapters) {
    const files = new Map();
    const run = info.run || 'course_run';

    // course.xml — entry point
    files.set('course.xml',
        `<course url_name="${escapeXml(run)}" org="${escapeXml(info.org)}" course="${escapeXml(info.courseId)}"/>\n`
    );

    // course/{run}.xml — metadata + chapter references
    const selfPaced = info.selfPaced ? ' self_paced="true"' : '';
    const startAttr = info.startDate ? ` start="${escapeXml(formatEdxDate(info.startDate))}"` : '';
    const endAttr = info.endDate ? ` end="${escapeXml(formatEdxDate(info.endDate))}"` : '';

    let courseXml = `<course display_name="${escapeXml(info.courseName)}" language="${escapeXml(info.language)}"${selfPaced}${startAttr}${endAttr}>\n`;
    for (const ch of chapters) {
        courseXml += `  <chapter url_name="${escapeXml(ch.id)}"/>\n`;
    }
    courseXml += `</course>\n`;
    files.set(`course/${run}.xml`, courseXml);

    // policies/{run}/policy.json
    const policy = {
        [`course/${run}`]: {
            display_name: info.courseName,
            language: info.language,
            self_paced: info.selfPaced,
            ...(info.startDate && { start: formatEdxDate(info.startDate) }),
            ...(info.endDate && { end: formatEdxDate(info.endDate) }),
            tabs: [
                { course_staff_only: false, name: "Course", type: "courseware" },
                { course_staff_only: false, name: "Progress", type: "progress" },
                { course_staff_only: false, name: "Dates", type: "dates" },
                { course_staff_only: false, name: "Discussion", type: "discussion" }
            ]
        }
    };
    files.set(`policies/${run}/policy.json`, JSON.stringify(policy, null, 4) + '\n');

    // policies/{run}/grading_policy.json
    const gradingPolicy = {
        GRADER: [
            { drop_count: 0, min_count: 1, short_label: "HW", type: "Homework", weight: 0.5 },
            { drop_count: 0, min_count: 1, short_label: "Final", type: "Final Exam", weight: 0.5 }
        ],
        GRADE_CUTOFFS: { Pass: 0.5 }
    };
    files.set(`policies/${run}/grading_policy.json`, JSON.stringify(gradingPolicy, null, 4) + '\n');

    return files;
}
