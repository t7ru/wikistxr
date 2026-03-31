import { describe, expect, it } from "bun:test";
import { parseTag } from "../src/lib/parsers";

describe("Parsers", () => {
  it("wraps known extension tags with the correct base classes", () => {
    const html = parseTag("<ref>", "wt-exttag wt-ext-ref", ["ref"]);
    expect(html).toBe('<span class="wt-exttag wt-ext-ref">&lt;ref&gt;</span>');
  });

  it("downgrades unknown tags to generic HTML tags", () => {
    const html = parseTag("<div>", "", ["ref"]);
    expect(html).toBe('<span class="wt-htmltag">&lt;div&gt;</span>');
  });

  it("splits multiline opening tags correctly using the -start hint", () => {
    const html = parseTag("<poem>Line 1", "wt-ext-poem-start", ["poem"]);

    expect(html).toContain(
      '<span class="wt-exttag wt-ext-poem">&lt;poem&gt;</span>',
    );
    expect(html).toContain('<span class="wt-ext-poem">Line 1</span>');
  });
});
