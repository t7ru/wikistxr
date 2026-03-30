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
    [],
    DEFAULT_EXTENSION_TAGS,
    DEFAULT_CONTENT_PRESERVING_TAGS,
  );

describe("WikitextTokenizer", () => {
  it("keeps styling hooks for partially typed internal links", () => {
    const tokenizer = createTokenizer();
    const { tokens } = tokenizer.tokenizeLine("[[Article|Display", 0, false);

    expect(tokens).toMatchObject([
      { text: "[[", className: "wt-link-bracket" },
      { text: "Article", className: "wt-link-pagename" },
      { text: "|", className: "" },
      { text: "Display", className: "" },
    ]);
  });

  it("recognizes external links according to the protocol whitelist", () => {
    const tokenizer = createTokenizer();
    const { tokens } = tokenizer.tokenizeLine(
      "[https://tds.wiki Example]",
      0,
      false,
    );

    expect(tokens).toEqual([
      { text: "[", className: "wt-extlink-bracket" },
      { text: "https://tds.wiki", className: "wt-extlink" }, // merged token
      { text: " Example", className: "" }, // ditto
      { text: "]", className: "wt-extlink-bracket" },
    ]);
  });

  it("respects custom protocols for bracketed external links", () => {
    const extendedProtocols = "nyawnyaw://|" + DEFAULT_URL_PROTOCOLS;

    const tokenizer = new WikitextTokenizer(
      extendedProtocols,
      [],
      DEFAULT_EXTENSION_TAGS,
      DEFAULT_CONTENT_PRESERVING_TAGS,
    );

    const { tokens } = tokenizer.tokenizeLine(
      "[nyawnyaw://toru@tds.wiki Label]",
      0,
      false,
    );

    expect(tokens).toEqual([
      { text: "[", className: "wt-extlink-bracket" },
      { text: "nyawnyaw://toru@tds.wiki", className: "wt-extlink" },
      { text: " Label", className: "" },
      { text: "]", className: "wt-extlink-bracket" },
    ]);
  });
});
