/**
 * Parsers for wikitext syntax elements.
 */
import { escapeHtml, createSpan } from "./utils";

/**
 * Parse and highlight HTML and extension tags.
 *
 * Distinguishes between HTML tags (e.g., <div>) and extension tags (e.g., <nowiki>).
 * Assumes discrete tokens are emitted by the WASM tokenizer.
 *
 * @param text - Tag text, e.g., "<nowiki>" or inner content
 * @param className - Tokenizer class hint (e.g., wt-ext-pre-start)
 * @param extensionTags - List of recognized extension tags
 * @returns HTML string with tag classes
 */
export function parseTag(
  text: string,
  className: string | undefined,
  extensionTags: string[],
): string {
  if (!text.startsWith("<")) {
    if (className?.startsWith("wt-ext-") && !className.includes(" ")) {
      return createSpan(text, className);
    }
    return escapeHtml(text);
  }

  const tagMatch = text.match(/^<\/?([a-z][^\s>\/]*)/i);
  if (!tagMatch) return escapeHtml(text);

  const tagName = tagMatch[1].toLowerCase();

  const isKnownTag =
    (className && className.includes(`wt-ext-${tagName}`)) ||
    extensionTags.includes(tagName);

  if (!isKnownTag) {
    return createSpan(text, "wt-htmltag");
  }

  const baseClass = `wt-ext-${tagName}`;
  const tagClass = `wt-exttag ${baseClass}`;

  if (className?.endsWith("-start")) {
    const match = text.match(/^(<[^>]+>)(.*)$/s);
    if (match) {
      return createSpan(match[1], tagClass) + createSpan(match[2], baseClass);
    }
  }

  return createSpan(text, tagClass);
}
