<div align="center"><img src="https://raw.githubusercontent.com/t7ru/wikistxr/refs/heads/main/src/demo/logo.png" width="222" alt="wikistxr logo">

# wikistxr</div>

A lightweight and fast library for **Wiki**text that has a **s**yn**t**a**x** highligh**ter** and edi**tor** written in TypeScript.

## Features

- Very fast!
- Easily portable to every modern browser environment
- Wikitext-aware tokenization (templates, links, tables, comments, tags, magic words, etc.)
- Configurable protocols, redirect keywords, extension tags, etc.
- HTML output with granular CSS classes (`getDefaultStyles()` provided)
- Incremental mode caches line tokens and state for fast live editing

## Installation

```bash
npm install wikistxr
```

## Two Modes

### WikitextHighlighter

**Static, full-pass syntax highlighting**

- Tokenizes entire wikitext input in one pass
- Renders to HTML string with CSS classes
- No DOM management or cursor tracking
- Ideal for read-only display like code previews

```javascript
import { WikitextHighlighter } from "wikistxr";

const highlighter = new WikitextHighlighter();
const html = highlighter.highlight(wikitextString);
container.innerHTML = html;
```

Highlighter runs way faster for most files, however, it sucks at rerendering. Which leads us to...

### WikitextEditor (experimental)

**Incremental, live editing with DOM patching**

- Extends `WikitextHighlighter` with editing capabilities
- Caches tokenizer state and tokens per line
- A more robust content tracking in general
- Ideal for interactive editors, real-time preview, or large documents

```javascript
import { WikitextEditor } from "wikistxr";

const editor = new WikitextEditor();
editor.attach(editableDiv); // Turns div editable and sets up event listeners
editor.update(wikitextString); // Initial render with syntax highlighting
```

_That being said... I still recommend using WikitextHighlighter with an actual editor like Monaco._

You can find a live demo [here](https://wikistxr.t7ru.link/).

## Configuration

Both classes accept the same configuration options:

```javascript
const config = {
  urlProtocols: /^(?:http|https|mailto)/i,
  redirectKeywords: ["REDIRECT", "RINVIA"],
  extensionTags: ["nowiki", "ref", "gallery"],
  contentPreservingTags: ["nowiki", "pre", "tabber"],
};

const highlighter = new WikitextHighlighter(config);
const editor = new WikitextEditor(config);
```

Optional: Add new styles

```javascript
const styleTag = document.createElement("style");
styleTag.textContent = WikitextEditor.getDefaultStyles();
document.head.appendChild(styleTag);
```

## Demo

Run the bundled demo (Vite):

```bash
npm install
npm run build && npm run preview

# npm run dev only partially works,
# since the demo uses the built dist
# instead of src to mimic real usage.
```

Open the displayed URL to switch between **Highlighter** and **Editor** modes, load sample snippets, and verify highlighting.

## Building

```bash
npm run build
```

Outputs CJS + ESM bundles under `dist/`.

## License

MIT
