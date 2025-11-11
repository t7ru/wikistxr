import { describe, expect, it } from "vitest";
import { WikitextHighlighter } from "../src/lib/highlighter";

describe("WikitextHighlighter", () => {
  it("treats redirect keywords literally even when containing regex tokens", () => {
    const highlighter = new WikitextHighlighter({
      redirectKeywords: ["REDIRECT.*"],
    });

    const html = highlighter.highlight("#REDIRECT.* [[Target Page]]");

    expect(html).toContain('class="wt-redirect"');
    expect(html).toContain("Target Page");
  });

  it("escapes raw HTML text from user input", () => {
    const highlighter = new WikitextHighlighter();
    const html = highlighter.highlight("<b>unsafe</b>");

    expect(html).toContain('<span class="wt-htmltag">&lt;b&gt;</span>');
    expect(html).toContain('<span class="wt-htmltag">&lt;/b&gt;</span>');
    expect(html).not.toContain("<b>");
  });
});
