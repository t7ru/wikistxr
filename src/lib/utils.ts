/**
 * Utility functions for wikitext highlighting.
 * - HTML escaping
 * - Safe span creation
 * - Delimiter matching with nesting (e.g. [[ [[ ]] ]])
 */

import type { ClosingResult } from "./types";

/**
 * Escape HTML special characters so user text can't break your output.
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
 * Wrap text in <span class="..."> safely.
 * If className is empty, just return escaped text.
 */
export function createSpan(text: string, className: string): string {
  const escaped = escapeHtml(text);
  return className ? `<span class="${className}">${escaped}</span>` : escaped;
}

/**
 * Find the first complete balanced pair of `open`…`close`, handling nesting
 * Returns { content, end } where:
 *    content = substring from 0 up to and including the matching close
 *    end = index right after that closing token
 * Returns null if never balanced
 */
export function findClosing(
  text: string,
  open: string,
  close: string
): ClosingResult | null {
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    // match opener
    if (text.slice(i, i + open.length) === open) {
      depth++;
      i += open.length - 1;
      continue;
    }

    // match closer
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