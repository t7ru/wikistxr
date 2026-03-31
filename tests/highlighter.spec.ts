import { describe, expect, it } from "bun:test";
import { WikitextHighlighter } from "../src/lib/highlighter";

describe("WikitextHighlighter", () => {
  it("highlights custom redirect keywords passed via config", () => {
    const highlighter = new WikitextHighlighter({
      redirectKeywords: ["CUSTOMREDIRECT"],
    });

    const html = highlighter.highlight("#CUSTOMREDIRECT [[Target Page]]");
    expect(html).toContain('<span class="wt-redirect">#CUSTOMREDIRECT </span>');
    expect(html).toContain('<span class="wt-link-pagename">Target Page</span>');
  });

  it("escapes raw HTML text from user input", () => {
    const highlighter = new WikitextHighlighter();
    const html = highlighter.highlight("<b>unsafe</b>");

    expect(html).toContain('<span class="wt-htmltag">&lt;b&gt;</span>');
    expect(html).toContain('<span class="wt-htmltag">&lt;/b&gt;</span>');
    expect(html).not.toContain("<b>");
  });
});
