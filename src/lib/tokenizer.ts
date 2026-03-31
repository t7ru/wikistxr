/**
 * Optimized WikitextTokenizer for parsing wikitext into tokens.
 * Batches consecutive text and leverages WebAssembly for high-performance extraction.
 */
import initWasm, {
  WikitextTokenizer as WasmTokenizer,
} from "../../wasm/wikistxr.js";
import { HighlightToken } from "./types";
import {
  DEFAULT_REDIRECT_KEYWORDS,
  DEFAULT_EXTENSION_TAGS,
  DEFAULT_CONTENT_PRESERVING_TAGS,
  DEFAULT_URL_PROTOCOLS,
} from "./constants";

await initWasm();

const CLASS_MAP = [
  "", // CLS_TEXT
  "wt-comment",
  "wt-section-header wt-section-2",
  "wt-section-header wt-section-3",
  "wt-section-header wt-section-4",
  "wt-section-header wt-section-5",
  "wt-section-header wt-section-6",
  "wt-redirect",
  "wt-list",
  "wt-hr",
  "wt-table-bracket",
  "wt-table-attrs",
  "wt-table-delimiter",
  "wt-table-cell",
  "wt-table-header",
  "wt-template-bracket",
  "wt-template",
  "wt-template-var",
  "wt-templateparameter-bracket",
  "wt-templateparameter-name",
  "wt-templateparameter-delimiter",
  "wt-templateparameter",
  "wt-link-full",
  "wt-link-bracket",
  "wt-link-pagename",
  "", // CLS_LINK_PIPE
  "", // CLS_LINK_LABEL
  "wt-extlink-full",
  "wt-extlink-bracket",
  "wt-extlink", // CLS_ELINK_PROTO
  "wt-extlink", // CLS_ELINK_URL
  "", // CLS_ELINK_LABEL
  "wt-free-extlink",
  "wt-htmltag",
  "wt-exttag",
  "wt-ext-content",
  "wt-strong-em",
  "wt-strong",
  "wt-em",
  "wt-html-entity",
  "wt-signature",
  "wt-magic-word",
  "wt-template-delimiter",
  "wt-template-argument-name",
];

export class WikitextTokenizer {
  private engine: WasmTokenizer;
  private extensionTags: string[];
  private contentTags: string[];
  private urlRegex: RegExp | null = null;

  constructor(
    urlProtocols: RegExp | string = DEFAULT_URL_PROTOCOLS,
    redirectKw: string[] | string = DEFAULT_REDIRECT_KEYWORDS,
    extTags: string[] | string = DEFAULT_EXTENSION_TAGS,
    contentTags: string[] | string = DEFAULT_CONTENT_PRESERVING_TAGS,
  ) {
    let safeUrlProtos =
      typeof urlProtocols === "string" ? urlProtocols : urlProtocols.source;

    safeUrlProtos = safeUrlProtos
      .replace(/\(\?\=.*?\)/g, "")
      .replace(/^\^/, "")
      .replace(/\\\//g, "/");

    const safeRedirects = Array.isArray(redirectKw)
      ? redirectKw.join("|")
      : String(redirectKw);
    this.extensionTags = Array.isArray(extTags)
      ? extTags
      : String(extTags).split(",");
    this.contentTags = Array.isArray(contentTags)
      ? contentTags
      : String(contentTags).split(",");

    try {
      this.urlRegex = new RegExp(
        `(?:${safeUrlProtos})[^\\s\\u00a0{\\[<>~]+`,
        "g",
      );
    } catch (e) {
      console.error("Failed to compile URL regex", e);
    }

    this.engine = new WasmTokenizer(
      safeUrlProtos,
      safeRedirects,
      this.extensionTags.join(","),
      this.contentTags.join(","),
    );
  }

  private parsePlaintextUrls(
    text: string,
    baseClass: string,
    tokens: HighlightToken[],
  ) {
    if (!this.urlRegex) return tokens.push({ text, className: baseClass });

    this.urlRegex.lastIndex = 0;
    let lastIdx = 0,
      match;

    while ((match = this.urlRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        tokens.push({
          text: text.substring(lastIdx, match.index),
          className: baseClass,
        });
      }

      let cleanMatch = match[0],
        endPunctuation = "";
      const trailingMatch = cleanMatch.match(/[.,')]+$/);

      if (trailingMatch) {
        endPunctuation = trailingMatch[0];
        cleanMatch = cleanMatch.slice(0, -endPunctuation.length);
        this.urlRegex.lastIndex -= endPunctuation.length;
      }

      tokens.push({ text: cleanMatch, className: "wt-free-extlink" });
      if (endPunctuation)
        tokens.push({ text: endPunctuation, className: baseClass });

      lastIdx = match.index + cleanMatch.length + endPunctuation.length;
    }

    if (lastIdx < text.length) {
      tokens.push({ text: text.substring(lastIdx), className: baseClass });
    }
  }

  tokenizeLine(
    lineText: string,
    stateMask: number,
    isFirst: boolean,
  ): { newStateMask: number; tokens: HighlightToken[] } {
    if (!this.engine)
      return {
        newStateMask: stateMask,
        tokens: [{ text: lineText, className: "" }],
      };

    const result = this.engine.tokenize_line(lineText, stateMask, isFirst);
    const tokens: HighlightToken[] = [];
    const incomingCi = (stateMask & (0x3f << 1)) >> 1;

    for (let i = 1; i < result.length; i += 3) {
      const start = result[i],
        end = result[i + 1],
        classId = result[i + 2];
      if (start === end) continue;

      let className = CLASS_MAP[classId] || "";
      const text = lineText.substring(start, end);

      if (classId === 0) {
        this.parsePlaintextUrls(text, className, tokens);
        continue;
      }

      if (classId === 34) {
        const match = text.match(/^<\/?([a-z][^\s>\/]*)/i);
        if (match) {
          const tagName = match[1].toLowerCase();
          className = text.startsWith("</")
            ? `wt-exttag wt-ext-${tagName}`
            : text.endsWith(`</${tagName}>`)
              ? `wt-ext-${tagName}-full`
              : this.extensionTags.includes(tagName)
                ? `wt-exttag wt-ext-${tagName}`
                : "wt-htmltag";
        }
      } else if (classId === 35) {
        const match = text.match(/^<([a-z][^\s>\/]*)/i);
        className = match
          ? `wt-ext-${match[1].toLowerCase()}-start`
          : incomingCi > 0 && incomingCi <= this.contentTags.length
            ? `wt-ext-${this.contentTags[incomingCi - 1]}`
            : "wt-ext-content";
      }

      tokens.push({ text, className });
    }

    return { newStateMask: result[0], tokens };
  }
}
