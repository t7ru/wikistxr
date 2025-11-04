/**
 * Parsers for wikitext syntax elements.
 *
 * Each function takes raw wikitext text and returns HTML with syntax highlighting classes.
 * Handles templates, template variables, links, external links, and extension tags.
 * Supports nested structures (e.g., templates within templates, links within templates).
 */
import { escapeHtml, createSpan } from "./utils";

/**
 * Parse and highlight template syntax {{...}}.
 *
 * Handles nested templates, links, and pipe-delimited arguments with optional key=value syntax.
 *
 * @param text - Template text including brackets, e.g., "{{Template|arg=value}}"
 * @returns HTML string with template classes
 * @example
 * parseTemplate("{{cite web|url=example.com|title=Example}}")
 * // Returns: <span class="wt-template-bracket">{{</span>...
 */
export function parseTemplate(text: string): string {
  const parts: string[] = [];
  parts.push(createSpan("{{", "wt-template-bracket"));

  const inner = text.slice(2, -2);
  const parsed = parseInnerContent(inner);
  parts.push(parsed);

  parts.push(createSpan("}}", "wt-template-bracket"));
  return parts.join("");
}

/**
 * Parse inner template content with nested structure support.
 *
 * Recursively handles nested templates {{...}}, links [[...]], and pipe delimiters.
 *
 * @param content - Inner content without outer brackets
 * @returns HTML string with highlighted inner content
 * @private
 */
function parseInnerContent(content: string): string {
  const parts: string[] = [];
  let pos = 0;

  while (pos < content.length) {
    const remaining = content.slice(pos);

    if (remaining.startsWith("{{")) {
      let depth = 0;
      let endPos = pos;
      for (let i = pos; i < content.length - 1; i++) {
        if (content[i] === "{" && content[i + 1] === "{") {
          depth++;
          i++;
        } else if (content[i] === "}" && content[i + 1] === "}") {
          depth--;
          if (depth === 0) {
            endPos = i + 2;
            break;
          }
          i++;
        }
      }
      if (endPos > pos) {
        const nested = content.slice(pos, endPos);
        parts.push(parseTemplate(nested));
        pos = endPos;
        continue;
      }
    }

    if (remaining.startsWith("[[")) {
      let depth = 0;
      let endPos = pos;
      for (let i = pos; i < content.length - 1; i++) {
        if (content[i] === "[" && content[i + 1] === "[") {
          depth++;
          i++;
        } else if (content[i] === "]" && content[i + 1] === "]") {
          depth--;
          if (depth === 0) {
            endPos = i + 2;
            break;
          }
          i++;
        }
      }
      if (endPos > pos) {
        const nested = content.slice(pos, endPos);
        parts.push(parseLink(nested));
        pos = endPos;
        continue;
      }
    }

    if (content[pos] === "|") {
      const afterPipe = content.slice(pos + 1);
      const eqMatch = afterPipe.match(/^([^=|]*?)=/);

      if (eqMatch) {
        parts.push(createSpan("|", "wt-template-delimiter"));
        parts.push(createSpan(eqMatch[1], "wt-template-argument-name"));
        parts.push(createSpan("=", "wt-template-delimiter"));
        pos += 1 + eqMatch[0].length;
        continue;
      } else {
        parts.push(createSpan("|", "wt-template-delimiter"));
        pos++;
        continue;
      }
    }

    const nextSpecial = content.slice(pos).search(/[{[\|]/);
    if (nextSpecial === -1) {
      parts.push(createSpan(content.slice(pos), "wt-template"));
      break;
    } else if (nextSpecial > 0) {
      parts.push(
        createSpan(content.slice(pos, pos + nextSpecial), "wt-template"),
      );
      pos += nextSpecial;
    } else {
      parts.push(createSpan(content[pos], "wt-template"));
      pos++;
    }
  }

  return parts.join("");
}

/**
 * Parse and highlight template parameter syntax {{{...}}}.
 *
 * Template parameters are used in template definitions to mark positions where values are substituted.
 * Supports default values via pipe delimiter, e.g., {{{parameter|default}}}.
 *
 * @param text - Parameter text including brackets, e.g., "{{{parameter|default}}}"
 * @returns HTML string with template parameter classes
 * @example
 * parseTemplateParameter("{{{author|Unknown}}}")
 * // Returns: <span class="wt-templateparameter-bracket">{{{</span>...
 */
export function parseTemplateParameter(text: string): string {
  const parts: string[] = [];
  parts.push(createSpan("{{{", "wt-templateparameter-bracket"));

  const inner = text.slice(3, -3);
  const pipeIdx = inner.indexOf("|");

  if (pipeIdx > -1) {
    parts.push(
      createSpan(inner.slice(0, pipeIdx), "wt-templateparameter-name"),
    );
    parts.push(createSpan("|", "wt-templateparameter-delimiter"));
    parts.push(createSpan(inner.slice(pipeIdx + 1), "wt-templateparameter"));
  } else {
    parts.push(createSpan(inner, "wt-templateparameter-name"));
  }

  parts.push(createSpan("}}}", "wt-templateparameter-bracket"));
  return parts.join("");
}

/**
 * Parse and highlight internal wiki link syntax [[...]].
 *
 * Handles page names and display text via pipe delimiter, e.g., [[Page|Display]].
 *
 * @param text - Link text including brackets, e.g., "[[Article|Display Text]]"
 * @returns HTML string with link classes
 * @example
 * parseLink("[[Wikipedia|The Free Encyclopedia]]")
 * // Returns: <span class="wt-link-bracket">[[</span>...
 */
export function parseLink(text: string): string {
  const parts: string[] = [];
  parts.push(createSpan("[[", "wt-link-bracket"));

  const inner = text.slice(2, -2);
  const pipeIdx = inner.indexOf("|");

  if (pipeIdx > -1) {
    const pageName = inner.slice(0, pipeIdx);
    const rest = inner.slice(pipeIdx);

    parts.push(createSpan(pageName, "wt-link-pagename"));
    parts.push(createSpan(rest, ""));
  } else {
    parts.push(createSpan(inner, "wt-link-pagename"));
  }

  parts.push(createSpan("]]", "wt-link-bracket"));
  return parts.join("");
}

/**
 * Parse and highlight external link syntax [http://...].
 *
 * Supports URL with optional display text via space delimiter, e.g., [http://example.com Example].
 *
 * @param text - Link text including brackets, e.g., "[https://example.com Example Site]"
 * @returns HTML string with external link classes
 * @example
 * parseExternalLink("[https://example.com Example]")
 * // Returns: <span class="wt-extlink-bracket">[</span>...
 */
export function parseExternalLink(text: string): string {
  const parts: string[] = [];
  parts.push(createSpan("[", "wt-extlink-bracket"));

  const inner = text.slice(1, -1);
  const spaceIdx = inner.indexOf(" ");

  if (spaceIdx > -1) {
    parts.push(createSpan(inner.slice(0, spaceIdx), "wt-extlink"));
    parts.push(" ");
    parts.push(createSpan(inner.slice(spaceIdx + 1), "wt-extlink-text"));
  } else {
    parts.push(createSpan(inner, "wt-extlink"));
  }

  parts.push(createSpan("]", "wt-extlink-bracket"));
  return parts.join("");
}

/**
 * Parse and highlight HTML and extension tags.
 *
 * Distinguishes between HTML tags (e.g., <div>) and extension tags (e.g., <nowiki>).
 * For extension tags, splits opening/closing tags from content based on className hint.
 *
 * @param text - Tag text, e.g., "<nowiki>raw text</nowiki>"
 * @param className - Tokenizer class hint (-full, -start, -end)
 * @param extensionTags - List of recognized extension tags
 * @returns HTML string with tag classes
 * @example
 * parseTag("<nowiki>'''not bold'''</nowiki>", "wt-ext-nowiki-full", ["nowiki"])
 * // Returns: <span class="wt-exttag wt-ext-nowiki"><nowiki></span>...
 */
export function parseTag(
  text: string,
  className: string | undefined,
  extensionTags: string[],
): string {
  const tagMatch = text.match(/^<\/?([a-z][^\s>\/]*)/i);
  if (!tagMatch) return escapeHtml(text);

  const tagName = tagMatch[1].toLowerCase();
  if (!extensionTags.includes(tagName)) {
    return createSpan(text, "wt-htmltag");
  }

  const baseClass = `wt-ext-${tagName}`;
  const tagClass = `wt-exttag ${baseClass}`;

  if (className?.endsWith("-full")) {
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;
    const openIdx = text.indexOf(openTag);
    const closeIdx = text.indexOf(closeTag, openIdx + openTag.length);

    if (openIdx > -1 && closeIdx > -1) {
      const before = text.slice(0, openIdx);
      const content = text.slice(openIdx + openTag.length, closeIdx);
      const after = text.slice(closeIdx + closeTag.length);

      return (
        createSpan(before, baseClass) +
        createSpan(openTag, tagClass) +
        createSpan(content, baseClass) +
        createSpan(closeTag, tagClass) +
        createSpan(after, baseClass)
      );
    }
  }

  if (className?.endsWith("-start")) {
    const match = text.match(/^(<[^>]+>)(.*)$/s);
    if (match) {
      return createSpan(match[1], tagClass) + createSpan(match[2], baseClass);
    }
  }

  if (className?.endsWith("-end")) {
    const match = text.match(/^(.*)(<\/[^>]+>)$/s);
    if (match) {
      return createSpan(match[1], baseClass) + createSpan(match[2], tagClass);
    }
  }

  return createSpan(text, tagClass);
}
