/**
 * Type definitions and whatnot.
 * Defines interfaces used across the library.
 */
export interface HighlightToken {
  text: string;
  className: string;
}

export interface HighlightConfig {
  urlProtocols?: RegExp | string;
  redirectKeywords?: string[] | string;
  extensionTags?: string[] | string;
  contentPreservingTags?: string[] | string;
}
