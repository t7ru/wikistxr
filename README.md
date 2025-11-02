# wikistxr
A lightweight and fast library for Wikitext that has a syntax highlighter and editor written in TypeScript. Ships with two modes:

- **WikitextHighlighter** – full-pass tokenizer + renderer, ideal for static rendering.
- **WikitextEditor** – incremental highlighter with DOM patching for live editors.

You can find a live demo [here](https://wikistxr.t7ru.link/).
## Features
- Very fast!
- Easily portable to every modern browser environments.
- Wikitext-aware tokenization (templates, links, tables, comments, tags, magic words, etc.).
- Configurable protocols, redirect keywords, and extension tags.
- HTML output with granular CSS classes (`getDefaultStyles()` provided).
- Incremental mode caches line tokens and state for fast live editing.

## Installation
```bash
npm install wikistxr
```

## Usage
#### Static highlighting
```typescript
import { WikitextHighlighter } from 'wikistxr';

const highlighter = new WikitextHighlighter();
const html = highlighter.highlight(wikitextString);
container.innerHTML = html;
```

#### Incremental editor
```typescript
import { WikitextEditor } from 'wikistxr';

const editor = new WikitextEditor();
editor.attach(editableDiv);
editor.update(wikitextString);
```

Include default styling if desired:
```typescript
const styleTag = document.createElement('style');
styleTag.textContent = WikitextEditor.getDefaultStyles();
document.head.appendChild(styleTag);
```

### Configuration
```typescript
const editor = new WikitextEditor({
  urlProtocols: /^(?:http|https|mailto)/i,
  redirectKeywords: ['REDIRECT', 'RINVIA'],
  extensionTags: ['nowiki', 'ref', 'gallery']
});
```

## Demo
Run the bundled demo (Vite):

```bash
npm install
npm run build
npm run preview
```

Open the displayed URL to switch between **Highlighter** and **Editor** modes, load sample snippets, and verify highlighting.

## Building
```bash
npm run build
```

Outputs CJS + ESM bundles under `dist/`.

## License
MIT