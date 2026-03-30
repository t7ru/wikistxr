/**
 * Main entry point, duh.
 */
import { WikitextHighlighter } from "./highlighter";
import { WikitextEditor } from "./editor";
import type { HighlightToken, HighlightConfig } from "./types";
import {
  DEFAULT_URL_PROTOCOLS,
  DEFAULT_REDIRECT_KEYWORDS,
  DEFAULT_EXTENSION_TAGS,
  DEFAULT_CONTENT_PRESERVING_TAGS,
  DEFAULT_STYLES,
} from "./constants";

export {
  WikitextHighlighter,
  WikitextEditor,
  DEFAULT_URL_PROTOCOLS,
  DEFAULT_REDIRECT_KEYWORDS,
  DEFAULT_EXTENSION_TAGS,
  DEFAULT_CONTENT_PRESERVING_TAGS,
  DEFAULT_STYLES,
};

export type { HighlightToken, HighlightConfig };
