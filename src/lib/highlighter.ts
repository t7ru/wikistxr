/**
 * Core class for syntax highlighting Wikitext.
 * Tokenizes input text into structured tokens and renders them as HTML with CSS classes
 * Supports customization via HighlightConfig for protocols, keywords, and tags
 * Use WikitextHighlighter for fullpass highlighting or WikitextEditor for incremental updates
 */
import type { HighlightToken, HighlightConfig } from './types';
import {
  DEFAULT_URL_PROTOCOLS,
  DEFAULT_REDIRECT_KEYWORDS,
  DEFAULT_EXTENSION_TAGS,
  DEFAULT_CONTENT_PRESERVING_TAGS,
  DEFAULT_STYLES
} from './constants';
import { createSpan } from './utils';
import { WikitextTokenizer } from './tokenizer';
import {
  parseTemplate,
  parseTemplateVariable,
  parseLink,
  parseExternalLink,
  parseTag
} from './parsers';

export class WikitextHighlighter {
  protected urlProtocols: RegExp;
  protected redirectRegex: RegExp;
  protected extensionTags: string[];
  protected contentPreservingTags: string[];
  protected tokenizer: WikitextTokenizer;

  constructor(config: HighlightConfig = {}) {
    this.urlProtocols = config.urlProtocols || DEFAULT_URL_PROTOCOLS;
    const redirectKeywords = config.redirectKeywords || DEFAULT_REDIRECT_KEYWORDS;
    this.redirectRegex = new RegExp(
      `^\\s*(?:#${redirectKeywords.join('|#')})(\\s*:)?\\s*(?=\\[\\[)`,
      'i'
    );
    this.extensionTags = config.extensionTags || DEFAULT_EXTENSION_TAGS;
    this.contentPreservingTags = config.contentPreservingTags || DEFAULT_CONTENT_PRESERVING_TAGS;
    this.tokenizer = new WikitextTokenizer(
      this.urlProtocols,
      this.redirectRegex,
      this.extensionTags,
      this.contentPreservingTags
    );
  }

  public highlight(text: string): string {
    const lines = text.split('\n');
    const tokensPerLine = this.tokenizeLines(lines, true);
    const htmlLines = this.renderLines(tokensPerLine);
    return htmlLines.join('\n');
  }

  public tokenize(text: string): HighlightToken[][] {
    return this.tokenizeLines(text.split('\n'), true);
  }

  protected tokenizeLines(
    lines: string[],
    resetTokenizer = false
  ): HighlightToken[][] {
    if (resetTokenizer) this.tokenizer.reset();
    const tokens: HighlightToken[][] = [];
    for (let i = 0; i < lines.length; i++) {
      tokens.push(this.tokenizer.tokenizeLine(lines[i], i === 0));
    }
    return tokens;
  }

  protected renderLines(tokensPerLine: HighlightToken[][]): string[] {
    return tokensPerLine.map(lineTokens =>
      lineTokens.map(token => this.renderToken(token)).join('')
    );
  }

  protected renderToken(token: HighlightToken): string {
    const { text, className } = token;

    if (className === 'wt-template-full') return parseTemplate(text);
    if (className === 'wt-template-var') return parseTemplateVariable(text);
    if (className === 'wt-link-full') return parseLink(text);
    if (className === 'wt-extlink-full') return parseExternalLink(text);

    if (className?.startsWith('wt-ext-') || text.startsWith('<')) {
      return parseTag(text, className, this.extensionTags);
    }

    if (className) {
      return createSpan(text, className);
    }

    return escapeHtml(text);
  }

  public static getDefaultStyles(): string {
    return DEFAULT_STYLES;
  }
}

export type { HighlightToken, HighlightConfig } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}