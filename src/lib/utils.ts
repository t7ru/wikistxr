/**
 * Utility functions for WikitextHighlighter.
 * Includes HTML escaping, span creation, and bracket matching for parsing wikitext syntax.
 */

import type { ClosingResult } from "./types";

/**
 * Escape HTML special characters to prevent injection.
 *
 * Converts &, <, >, ", and ' to their HTML entity equivalents.
 * Use before inserting user text into HTML to prevent XSS vulnerabilities.
 * Some people are too clever for their own good.
 *
 * @param text - The text to escape
 * @returns Escaped HTML text
 * @example
 * escapeHtml("<script>alert('xss')</script>")
 * // Returns: "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Wrap text in a styled span element.
 *
 * Creates an HTML span with the given class name. If className is empty,
 * returns escaped text without span wrapping for efficiency.
 *
 * @param text - The text content
 * @param className - CSS class name(s), or empty string for no wrapping
 * @returns HTML span element or escaped text
 * @example
 * createSpan("bold", "wt-strong")
 * // Returns: "<span class="wt-strong">bold</span>"
 *
 * @example
 * createSpan("plain", "")
 * // Returns: "plain"
 */
export function createSpan(text: string, className: string): string {
  const escaped = escapeHtml(text);
  return className ? `<span class="${className}">${escaped}</span>` : escaped;
}

/**
 * Find the first complete balanced pair of opening and closing delimiters.
 *
 * Handles nested delimiters (e.g., [[ [[ ]] ]]) by tracking depth.
 * Useful for matching wikitext brackets like [[...]], {{...}}, etc.
 *
 * @param text - The text to search
 * @param open - Opening delimiter (e.g., "[[")
 * @param close - Closing delimiter (e.g., "]]")
 * @returns Object with content (substring including delimiters) and end position, or null if unbalanced
 * @example
 * findClosing("[[link|text]] after", "[[", "]]")
 * // Returns: { content: "[[link|text]]", end: 14 }
 *
 * @example
 * findClosing("[[unclosed", "[[", "]]")
 * // Returns: null
 */
export function findClosing(
  text: string,
  open: string,
  close: string,
): ClosingResult | null {
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    if (text.slice(i, i + open.length) === open) {
      depth++;
      i += open.length - 1;
      continue;
    }

    if (text.slice(i, i + close.length) === close) {
      depth--;
      if (depth === 0) {
        const endPos = i + close.length;
        return {
          content: text.slice(0, endPos),
          end: endPos,
        };
      }
      i += close.length - 1;
      continue;
    }
  }

  return null;
}
