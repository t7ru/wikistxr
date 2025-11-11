import { describe, expect, it } from "vitest";
import { WikitextTokenizer } from "../src/lib/tokenizer";
import {
  DEFAULT_CONTENT_PRESERVING_TAGS,
  DEFAULT_EXTENSION_TAGS,
  DEFAULT_URL_PROTOCOLS,
} from "../src/lib/constants";

const createTokenizer = () =>
  new WikitextTokenizer(
    DEFAULT_URL_PROTOCOLS,
    /^$/,
    DEFAULT_EXTENSION_TAGS,
    DEFAULT_CONTENT_PRESERVING_TAGS,
  );

describe("WikitextTokenizer", () => {
  it("keeps styling hooks for partially typed internal links", () => {
    const tokenizer = createTokenizer();
    const tokens = tokenizer.tokenizeLine("[[Article|Display", false);

    expect(tokens).toMatchObject([
      { text: "[[", className: "wt-link-bracket" },
      { text: "Article", className: "wt-link-pagename" },
      { text: "|", className: "wt-link-pipe" },
      { text: "Display", className: "wt-link-label" },
    ]);
  });

  it("recognizes external links according to the protocol whitelist", () => {
    const tokenizer = createTokenizer();
    const tokens = tokenizer.tokenizeLine("[https://tds.wiki Example]", false);

    expect(tokens).toEqual([{ text: "[https://tds.wiki Example]", className: "wt-extlink-full" }]);
  });

  it("respects custom protocols for bracketed external links", () => {
    const extendedProtocols = new RegExp(
      DEFAULT_URL_PROTOCOLS.source.replace("^(?:", "^(?:mailto|"),
      DEFAULT_URL_PROTOCOLS.flags,
    );
    const tokenizer = new WikitextTokenizer(
      extendedProtocols,
      /^$/,
      DEFAULT_EXTENSION_TAGS,
      DEFAULT_CONTENT_PRESERVING_TAGS,
    );
    const tokens = tokenizer.tokenizeLine("[mailto:toru@tds.wiki Label]", false);

    expect(tokens).toEqual([
      { text: "[mailto:toru@tds.wiki Label]", className: "wt-extlink-full" },
    ]);
  });
});
