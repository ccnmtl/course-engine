/**
 * Utility functions for Course Engine
 */

/**
 * Generate a UUID-like hex ID (32 chars) for OLX url_name attributes.
 */
export function generateId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Escape special characters for XML attribute values and text content.
 */
export function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape for XML attributes specifically (wraps in quotes).
 */
export function xmlAttr(name, value) {
  if (value == null || value === '') return '';
  return ` ${name}="${escapeXml(value)}"`;
}

/**
 * Sanitize a string into a safe url_name (lowercase, no spaces).
 */
export function sanitizeUrlName(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 60);
}

/**
 * Format a date string to ISO format for EdX.
 */
export function formatEdxDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().replace('.000Z', 'Z');
}

/**
 * Convert plain text to basic HTML paragraphs if it doesn't already contain HTML.
 */
export function textToHtml(text) {
  if (!text) return '';
  // If it already looks like HTML, return as-is
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  // Otherwise wrap paragraphs
  return text
    .split(/\n\n+/)
    .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}
