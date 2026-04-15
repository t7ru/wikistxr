<div align="center">
<img src="https://raw.githubusercontent.com/t7ru/wikistxr/refs/heads/master/demo/logo.png" width="222" alt="wikistxr logo">

# wikistxr

A blazingly fast library for **Wiki**text that has a **s**yn**t**a**x** highligh**ter** and edi**tor** written in Rust and TypeScript.

[![](https://data.jsdelivr.com/v1/package/npm/wikistxr/badge)](https://www.jsdelivr.com/package/npm/wikistxr)

</div>

## Neat Little Facts About It

- Supports all wikitext syntax.
- SIMD-accelerated tokenization via Rust.
- Configurable protocols, redirect keywords, extension tags, etc.
- Semantic CSS classes via `getDefaultStyles()`.

## Installation

```bash
npm i wikistxr
```

## Usage

### WikitextHighlighter

**Static, full-pass syntax highlighting**

- Tokenizes input in one pass.
- Renders to HTML strings.

```javascript
import { WikitextHighlighter } from "wikistxr";

const highlighter = new WikitextHighlighter();
const html = highlighter.highlight(wikitextString);
```

### WikitextEditor

**Incremental, live editing with DOM patching**

- Caches tokenizer state and tokens per line.
- Handles cursor persistence and DOM synchronization.

```javascript
import { WikitextEditor } from "wikistxr";

const editor = new WikitextEditor();
editor.attach(editableDiv);
editor.update(wikitextString);
```

## Configuration

Both classes accept the same options:

```javascript
const config = {
  urlProtocols: "http|https|mailto",
  redirectKeywords: ["REDIRECT", "WEITERLEITUNG"],
  extensionTags: ["nowiki", "ref", "gallery"],
  contentPreservingTags: ["nowiki", "pre"],
};

const highlighter = new WikitextHighlighter(config);
```

To apply default styles:

```javascript
const styles = WikitextHighlighter.getDefaultStyles();
```

## Development

```bash
# Build Rust core and TypeScript bundles
bun run build

# Run development demo
bun run dev
```

## License

[MIT](LICENSE)
