import { describe, expect, it } from "vitest";
import { parseExternalLink, parseLink } from "../src/lib/parsers";

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
});
