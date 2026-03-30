/**
 * Core class for syntax highlighting Wikitext.
 * Tokenizes input text into structured tokens and renders them as HTML.
 */
import type { HighlightToken, HighlightConfig } from "./types";
import { DEFAULT_STYLES, DEFAULT_EXTENSION_TAGS } from "./constants";
import { createSpan, escapeHtml } from "./utils";
import { WikitextTokenizer } from "./tokenizer";
import { parseTag } from "./parsers";

export class WikitextHighlighter {
  protected extensionTags: string[];
  protected tokenizer: WikitextTokenizer;

  constructor(config: HighlightConfig = {}) {
    const rawTags = config.extensionTags || DEFAULT_EXTENSION_TAGS;

    this.extensionTags = Array.isArray(rawTags)
      ? rawTags
      : String(rawTags).split(",");

    this.tokenizer = new WikitextTokenizer(
      config.urlProtocols,
      config.redirectKeywords,
      config.extensionTags,
      config.contentPreservingTags,
    );
  }

  public highlight(text: string): string {
    return this.renderLines(this.tokenizeLines(text.split("\n"))).join("\n");
  }

  public tokenize(text: string): HighlightToken[][] {
    return this.tokenizeLines(text.split("\n"));
  }

  protected tokenizeLines(lines: string[]): HighlightToken[][] {
    let currentState = 0;

    return lines.map((line, i) => {
      const { newStateMask, tokens } = this.tokenizer.tokenizeLine(
        line,
        currentState,
        i === 0,
      );
      currentState = newStateMask;
      return tokens;
    });
  }

  protected renderLines(tokensPerLine: HighlightToken[][]): string[] {
    return tokensPerLine.map((line) =>
      line.map((token) => this.renderToken(token)).join(""),
    );
  }

  protected renderToken({ text, className }: HighlightToken): string {
    if (
      className?.startsWith("wt-ext-") ||
      (text.startsWith("<") && className !== "wt-comment")
    ) {
      return parseTag(text, className, this.extensionTags);
    }

    return className ? createSpan(text, className) : escapeHtml(text);
  }

  public static getDefaultStyles(): string {
    return DEFAULT_STYLES;
  }
}

export type { HighlightToken, HighlightConfig } from "./types";
