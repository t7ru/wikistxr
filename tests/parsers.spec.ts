import { describe, expect, it } from "vitest";
import { parseExternalLink, parseLink, parseTag } from "../src/lib/parsers";

describe("Parsers", () => {
  it("leaves link display text unstyled by design", () => {
    const html = parseLink("[[Article|Display Text]]");

    expect(html).toContain('class="wt-link-pagename"');
    expect(html).not.toContain("wt-link-delimiter");
    expect(html).not.toContain("wt-link-text");
    expect(html).toContain("|Display Text");
  });

  it("leaves external link labels without wt-extlink-text class", () => {
    const html = parseExternalLink("[https://tds-editor.com Example]");

    expect(html).toContain('class="wt-extlink-bracket"');
    expect(html).not.toContain("wt-extlink-text");
    expect(html).toContain(" Example");
    expect(html).not.toContain("Example</span>");
  });

  it("preserves extension tag content even when attributes are present", () => {
    const html = parseTag(
      '<ref name="cite">Some content</ref>',
      "wt-ext-ref-full",
      ["ref"],
    );

    expect(html).toContain(
      '<span class="wt-exttag wt-ext-ref">&lt;ref name=&quot;cite&quot;&gt;</span>',
    );
    expect(html).toContain('<span class="wt-ext-ref">Some content</span>');
    expect(html).toContain(
      '<span class="wt-exttag wt-ext-ref">&lt;/ref&gt;</span>',
    );
  });
});
