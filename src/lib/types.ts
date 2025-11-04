/**
 * Type definitions and whatnot.
 * Defines interfaces used across the library.
 */
export interface HighlightToken {
  text: string;
  className: string;
}

export interface HighlightConfig {
  urlProtocols?: RegExp;
  redirectKeywords?: string[];
  extensionTags?: string[];
  contentPreservingTags?: string[];
}

export interface ClosingResult {
  content: string;
  end: number;
}

export interface TokenizerState {
  inMultilineComment: boolean;
  commentBuffer: string;
  inExtensionTag: string | null;
  templateDepth: number;
}
