/**
 * Core class for syntax highlighting Wikitext.
 *
 * Tokenizes input text into structured tokens and renders them as HTML with CSS classes.
 * Supports customization via HighlightConfig for protocols, keywords, and tags.
 * Use WikitextHighlighter for full-pass highlighting or WikitextEditor for incremental updates.
 *
 * @example
 * const highlighter = new WikitextHighlighter();
 * const html = highlighter.highlight(wikitextString);
 * container.innerHTML = html;
 *
 * @example
 * const custom = new WikitextHighlighter({
 *   extensionTags: ['nowiki', 'ref', 'custom']
 * });
 */
import type { HighlightToken, HighlightConfig } from "./types";
import {
  DEFAULT_URL_PROTOCOLS,
  DEFAULT_REDIRECT_KEYWORDS,
  DEFAULT_EXTENSION_TAGS,
  DEFAULT_CONTENT_PRESERVING_TAGS,
  DEFAULT_STYLES,
} from "./constants";
import { createSpan } from "./utils";
import { WikitextTokenizer } from "./tokenizer";
import {
  parseTemplate,
  parseTemplateParameter,
  parseLink,
  parseExternalLink,
  parseTag,
} from "./parsers";

export class WikitextHighlighter {
  protected urlProtocols: RegExp;
  protected redirectRegex: RegExp;
  protected extensionTags: string[];
  protected contentPreservingTags: string[];
  protected tokenizer: WikitextTokenizer;

  /**
   * Create a new WikitextHighlighter instance.
   * @param config - Optional configuration for protocols, keywords, and tags
   */
  constructor(config: HighlightConfig = {}) {
    this.urlProtocols = config.urlProtocols || DEFAULT_URL_PROTOCOLS;
    const redirectKeywords =
      config.redirectKeywords || DEFAULT_REDIRECT_KEYWORDS;
    this.redirectRegex = new RegExp(
      `^\\s*(?:#${redirectKeywords.join("|#")})(\\s*:)?\\s*(?=\\[\\[)`,
      "i",
    );
    this.extensionTags = config.extensionTags || DEFAULT_EXTENSION_TAGS;
    this.contentPreservingTags =
      config.contentPreservingTags || DEFAULT_CONTENT_PRESERVING_TAGS;
    this.tokenizer = new WikitextTokenizer(
      this.urlProtocols,
      this.redirectRegex,
      this.extensionTags,
      this.contentPreservingTags,
    );
  }

  /**
   * Highlight wikitext and return HTML string.
   * @param text - The wikitext content to highlight
   * @returns HTML string with syntax highlighting classes
   */
  public highlight(text: string): string {
    const lines = text.split("\n");
    const tokensPerLine = this.tokenizeLines(lines, true);
    const htmlLines = this.renderLines(tokensPerLine);
    return htmlLines.join("\n");
  }

  /**
   * Tokenize wikitext into structured tokens.
   * @param text - The wikitext content to tokenize
   * @returns Array of token arrays (one per line)
   */
  public tokenize(text: string): HighlightToken[][] {
    return this.tokenizeLines(text.split("\n"), true);
  }

  /**
   * Tokenize multiple lines with optional tokenizer reset.
   * @param lines - Array of wikitext lines
   * @param resetTokenizer - Whether to reset tokenizer state before tokenizing
   * @returns Array of token arrays
   * @protected
   */
  protected tokenizeLines(
    lines: string[],
    resetTokenizer = false,
  ): HighlightToken[][] {
    if (resetTokenizer) this.tokenizer.reset();
    const tokens: HighlightToken[][] = [];
    for (let i = 0; i < lines.length; i++) {
      tokens.push(this.tokenizer.tokenizeLine(lines[i], i === 0));
    }
    return tokens;
  }

  /**
   * Render token arrays into HTML strings.
   * @param tokensPerLine - Array of token arrays (one per line)
   * @returns Array of HTML strings
   * @protected
   */
  protected renderLines(tokensPerLine: HighlightToken[][]): string[] {
    return tokensPerLine.map((lineTokens) =>
      lineTokens.map((token) => this.renderToken(token)).join(""),
    );
  }

  /**
   * Render a single token into HTML.
   * Delegates to specialized parsers for complete constructs (templates, links, tags).
   * @param token - The token to render
   * @returns HTML string
   * @protected
   */
  protected renderToken(token: HighlightToken): string {
    const { text, className } = token;

    if (className === "wt-template-full") return parseTemplate(text);
    if (className === "wt-template-var") return parseTemplateParameter(text);
    if (className === "wt-link-full") return parseLink(text);
    if (className === "wt-extlink-full") return parseExternalLink(text);

    if (className?.startsWith("wt-ext-") || text.startsWith("<")) {
      return parseTag(text, className, this.extensionTags);
    }

    if (className) {
      return createSpan(text, className);
    }

    return escapeHtml(text);
  }

  /**
   * Get default CSS styles for highlighted wikitext.
   * @returns CSS string with all syntax highlighting classes
   */
  public static getDefaultStyles(): string {
    return DEFAULT_STYLES;
  }
}

export type { HighlightToken, HighlightConfig } from "./types";

/**
 * Escape HTML special characters to prevent injection.
 * @param text - The text to escape
 * @returns Escaped HTML text
 * @private
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
