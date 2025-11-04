/**
 * Incremental wikitext editor helper.
 * HEAVILY EXPERIMENTAL.
 *
 * Extends WikitextHighlighter to provide real-time syntax highlighting for editable wikitext.
 * Caches tokens and parser states to retokenize only changed lines while maintaining multiline
 * context (comments, tags, templates) across edits.
 *
 * @example
 * const editor = new WikitextEditor();
 * editor.attach(editableDiv);
 *
 * @example
 * const editor = new WikitextEditor({
 *   extensionTags: ['nowiki', 'ref', 'custom']
 * });
 * editor.attach(container);
 * editor.update(wikitextString);
 */
import type { HighlightToken, HighlightConfig, TokenizerState } from "./types";
import { WikitextHighlighter } from "./highlighter";

const initialState: TokenizerState = {
  inMultilineComment: false,
  commentBuffer: "",
  inExtensionTag: null,
  templateDepth: 0,
};

const EMPTY_PLACEHOLDER = "\u200B";
const EMPTY_PLACEHOLDER_HTML = `<span class="wt-placeholder">${EMPTY_PLACEHOLDER}</span>`;

/**
 * Compare two TokenizerState objects for equality.
 * @param a - First state
 * @param b - Second state
 * @returns True if states are identical
 */
function statesEqual(a: TokenizerState, b: TokenizerState): boolean {
  return (
    a.inMultilineComment === b.inMultilineComment &&
    a.commentBuffer === b.commentBuffer &&
    a.inExtensionTag === b.inExtensionTag &&
    a.templateDepth === b.templateDepth
  );
}

export class WikitextEditor extends WikitextHighlighter {
  private lastLines: string[] = [];
  private cachedTokens: HighlightToken[][] = [];
  private cachedStates: TokenizerState[] = [];
  private container?: HTMLElement;
  private lineElements: HTMLElement[] = [];
  private inputHandler?: (event: Event) => void;
  private keydownHandler?: (event: KeyboardEvent) => void;
  private applyingUpdate = false;

  /**
   * Create a new WikitextEditor instance.
   * @param config - Optional configuration for protocols, keywords, and tags
   */
  constructor(config: HighlightConfig = {}) {
    super(config);
    this.resetCache();
  }

  /**
   * Reset all internal caches and tokenizer state to initial values.
   *
   * Call this before attaching to a new container or when starting a fresh edit session.
   */
  public resetCache(): void {
    this.tokenizer.reset();
    this.lastLines = [];
    this.cachedTokens = [];
    this.cachedStates = [
      {
        inMultilineComment: false,
        commentBuffer: "",
        inExtensionTag: null,
        templateDepth: 0,
      },
    ];
  }

  /**
   * Attach editor to a DOM element and enable live editing.
   *
   * Makes the container `contentEditable`, clears existing content, and sets up input listeners
   * for automatic highlighting as the user types.
   *
   * @param container - The HTML element to attach to
   * @throws Error if container is not a valid HTMLElement
   */
  public attach(container: HTMLElement): void {
    if (this.container && this.inputHandler) {
      this.container.removeEventListener("input", this.inputHandler);
    }
    if (this.container && this.keydownHandler) {
      this.container.removeEventListener("keydown", this.keydownHandler);
    }
    this.container = container;
    this.container.contentEditable = "true";
    this.container.innerHTML = "";
    this.lineElements = [];
    this.resetCache();
    this.inputHandler = (event: Event) => {
      if (this.applyingUpdate) {
        return;
      }
      const inputEvent = event as InputEvent;
      const domLines = this.readDomLines();
      const payload = domLines.join("\n");
      const currentLineElements = Array.from(
        this.container!.querySelectorAll<HTMLElement>(".wt-line"),
      );
      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      let cursorOffset: number | null = null;
      if (range) {
        const calculatedOffset = this.getCursorOffsetFromElements(
          range,
          currentLineElements,
          domLines,
        );
        if (
          calculatedOffset === 0 &&
          inputEvent.inputType === "insertText" &&
          inputEvent.data?.length === 1
        ) {
          cursorOffset = 1;
        } else {
          cursorOffset = calculatedOffset;
        }
      }
      this.update(payload, cursorOffset);
    };
    this.keydownHandler = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        this.insertNewLine();
      }
      if (
        event.key === "ArrowLeft" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        const selection = window.getSelection();
        if (selection && selection.isCollapsed && this.container) {
          const range = selection.getRangeAt(0);
          const lineElements = Array.from(
            this.container.querySelectorAll<HTMLElement>(".wt-line"),
          );
          const domLines = this.readDomLines();
          const cursorOffset = this.getCursorOffsetFromElements(
            range,
            lineElements,
            domLines,
          );
          let currentPos = 0;
          for (let i = 0; i < domLines.length; i++) {
            const lineLength = domLines[i].length;
            if (cursorOffset === currentPos) {
              if (i > 0 && lineLength === 0) {
                event.preventDefault();
                this.restoreCursorOffset(cursorOffset - 1);
              }
              break;
            }
            currentPos += lineLength + 1;
          }
        }
      }
    };
    this.container.addEventListener("input", this.inputHandler);
    this.container.addEventListener("keydown", this.keydownHandler);
  }

  /**
   * Insert a new line at the current cursor position.
   */
  private insertNewLine(): void {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !this.container) return;
    const range = selection.getRangeAt(0);
    const currentLineElements = Array.from(
      this.container.querySelectorAll<HTMLElement>(".wt-line"),
    );
    const domLines = this.readDomLines();
    const cursorOffset = this.getCursorOffsetFromElements(
      range,
      currentLineElements,
      domLines,
    );
    const text = domLines.join("\n");
    const newText =
      text.slice(0, cursorOffset) + "\n" + text.slice(cursorOffset);
    this.update(newText, cursorOffset + 1);
  }

  /**
   * Update editor with new wikitext content.
   *
   * Performs incremental retokenization of changed lines, patches the DOM,
   * and restores the cursor position to minimize disruption during editing.
   *
   * @param text - The wikitext content to render
   * @param cursorOffsetOverride - Optional cursor offset to restore after update
   * @throws Error if attach() was not called first
   */
  public update(
    text: string,
    cursorOffsetOverride: number | null = null,
  ): void {
    if (!this.container) throw new Error("Call attach() first");
    if (this.applyingUpdate) {
      return;
    }
    this.applyingUpdate = true;
    try {
      let cursorOffset = cursorOffsetOverride ?? null;
      const lines = text.split("\n");
      const htmlLines = this.computeLines(lines);
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < lines.length; i++) {
        let lineEl = this.lineElements[i];
        if (!lineEl) {
          lineEl = document.createElement("div");
        }
        if (lineEl.className !== "wt-line") {
          lineEl.className = "wt-line";
        }
        const html = htmlLines[i] ?? "";
        const safeHtml = html === "" ? EMPTY_PLACEHOLDER_HTML : html;
        if (lineEl.innerHTML !== safeHtml) {
          lineEl.innerHTML = safeHtml;
        }
        this.lineElements[i] = lineEl;
        fragment.appendChild(lineEl);
      }
      this.lineElements.length = lines.length;
      this.container.replaceChildren(fragment);
      if (cursorOffset !== null) {
        this.restoreCursorOffset(cursorOffset);
      }
    } finally {
      this.applyingUpdate = false;
    }
  }

  /**
   * Highlight wikitext without DOM attachment. Returns HTML string.
   *
   * Useful for generating highlighted output without the overhead of DOM management.
   *
   * @param text - The wikitext content to highlight
   * @returns HTML string with syntax highlighting classes
   */
  public override highlight(text: string): string {
    const lines = text.split("\n");
    const htmlLines = this.computeLines(lines);
    return htmlLines.join("\n");
  }

  /**
   * Tokenize wikitext into structured tokens. Updates internal cache.
   *
   * @param text - The wikitext content to tokenize
   * @returns Array of token arrays (one per line)
   */
  public override tokenize(text: string): HighlightToken[][] {
    this.computeLines(text.split("\n"));
    return this.cachedTokens;
  }

  /**
   * Compute line tokens with incremental retokenization.
   *
   * Finds the first changed line, retokenizes from that point forward,
   * and stops early if the tokenizer state converges with the cached state
   * (optimization for large files with localized edits).
   *
   * @param lines - Array of wikitext lines
   * @returns Array of HTML strings (one per line)
   */
  private computeLines(lines: string[]): string[] {
    let start = 0;
    const minLen = Math.min(lines.length, this.lastLines.length);
    while (start < minLen && lines[start] === this.lastLines[start]) start++;
    if (start === lines.length && lines.length === this.lastLines.length) {
      return this.renderLines(this.cachedTokens);
    }
    const startState = start > 0 ? this.cachedStates[start] : initialState;
    this.tokenizer.setState(startState);
    const newTokens: HighlightToken[][] = this.cachedTokens.slice(0, start);
    const newStates: TokenizerState[] = this.cachedStates.slice(0, start + 1);
    let converged = false;
    for (let i = start; i < lines.length; i++) {
      const tokens = this.tokenizer.tokenizeLine(lines[i], i === 0);
      newTokens.push(tokens);
      const after = this.tokenizer.getState();
      newStates.push(after);
      if (i < this.lastLines.length && lines[i] === this.lastLines[i]) {
        const oldAfter = this.cachedStates[i + 1];
        if (statesEqual(after, oldAfter)) {
          newTokens.push(...this.cachedTokens.slice(i + 1));
          newStates.push(...this.cachedStates.slice(i + 2));
          converged = true;
          break;
        }
      }
    }
    if (!converged) {
      while (newStates.length < lines.length + 1) {
        newStates.push(initialState);
      }
    }
    this.lastLines = lines.slice();
    this.cachedTokens = newTokens;
    this.cachedStates = newStates;
    return this.renderLines(newTokens);
  }

  /**
   * Get cursor offset as character count from container start.
   *
   * Calculates the absolute position of the current cursor within the container's text content.
   *
   * @param range - The current DOM Range from Selection
   * @param lineElements - Array of current line elements
   * @param lineTexts - Array of current line texts
   * @returns Character offset from container start, including newlines
   */
  private getCursorOffsetFromElements(
    range: Range,
    lineElements: HTMLElement[],
    lineTexts: string[],
  ): number {
    if (!this.container) return 0;
    let targetLine: HTMLElement | null = null;
    let node: Node | null = range.startContainer;
    while (node && node !== this.container) {
      if (node instanceof HTMLElement && node.classList.contains("wt-line")) {
        targetLine = node;
        break;
      }
      node = node.parentNode;
    }
    if (!targetLine) return 0;
    const lineIndex = lineElements.indexOf(targetLine);
    if (lineIndex === -1) return 0;
    let offset = 0;
    for (let i = 0; i < lineIndex; i++) {
      offset += lineTexts[i].length + 1;
    }
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(targetLine);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const offsetInLine = this.normalizeLineText(
      preCaretRange.toString(),
    ).length;
    offset += offsetInLine;
    return offset;
  }

  /**
   * Restore cursor position by character offset.
   *
   * Places the cursor at a specific character position within the container,
   * even after the DOM has been updated. Accounts for implicit newlines between lines.
   *
   * @param offset - Character offset from container start, including newlines
   */
  private restoreCursorOffset(offset: number): void {
    const selection = window.getSelection();
    if (!selection || !this.container) return;
    let currentPos = 0;
    let lineIndex = 0;
    for (; lineIndex < this.lineElements.length; lineIndex++) {
      const lineEl = this.lineElements[lineIndex];
      const lineText = this.normalizeLineText(lineEl.textContent ?? "");
      const lineLength = lineText.length;
      const lineEnd = currentPos + lineLength;
      if (offset <= lineEnd) {
        const innerOffset = offset - currentPos;
        this.setCursorInLine(lineEl, innerOffset);
        return;
      }
      currentPos = lineEnd + 1;
    }
    const fallbackRange = document.createRange();
    if (this.container.lastChild) {
      const lastChild = this.container.lastChild;
      if (lastChild.nodeType === Node.TEXT_NODE) {
        fallbackRange.setStart(lastChild, (lastChild as Text).length);
      } else {
        fallbackRange.selectNodeContents(lastChild as Node);
        fallbackRange.collapse(false);
      }
    } else {
      fallbackRange.setStart(this.container, 0);
    }
    fallbackRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(fallbackRange);
  }

  /**
   * Set cursor at a specific offset within a line element.
   *
   * @param lineEl - The line HTMLElement
   * @param innerOffset - Offset within the normalized line text
   */
  private setCursorInLine(lineEl: HTMLElement, innerOffset: number): void {
    const selection = window.getSelection();
    if (!selection) return;
    let currentInner = 0;
    const walker = document.createTreeWalker(
      lineEl,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const rawText = textNode.textContent ?? "";
      const normalized = this.normalizeLineText(rawText);
      const normalizedLength = normalized.length;
      if (normalizedLength === 0) {
        if (innerOffset === currentInner) {
          const range = document.createRange();
          range.setStart(textNode, 0);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        continue;
      }
      if (currentInner + normalizedLength >= innerOffset) {
        const targetInner = innerOffset - currentInner;
        let rawIndex = 0;
        let seen = 0;
        while (rawIndex < rawText.length && seen < targetInner) {
          if (rawText[rawIndex] !== EMPTY_PLACEHOLDER) {
            seen++;
          }
          rawIndex++;
        }
        const range = document.createRange();
        range.setStart(textNode, rawIndex);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      currentInner += normalizedLength;
    }
    const range = document.createRange();
    range.selectNodeContents(lineEl);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private normalizeLineText(text: string): string {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\u2028|\u2029/g, "\n")
      .replace(/\u00a0/g, " ")
      .split(EMPTY_PLACEHOLDER)
      .join("");
  }

  private readDomLines(): string[] {
    if (!this.container) return [];
    const lines = this.extractLinesFromDom();
    return lines;
  }

  private extractLinesFromDom(): string[] {
    if (!this.container) {
      return [];
    }
    const lines: string[] = [];
    let buffer = "";
    const flush = () => {
      lines.push(this.normalizeLineText(buffer));
      buffer = "";
    };
    const processText = (text: string) => {
      const pieces = this.normalizeLineText(text).split(/\n/);
      for (let i = 0; i < pieces.length; i++) {
        if (i > 0) {
          flush();
        }
        buffer += pieces[i];
      }
    };
    const walker = document.createTreeWalker(
      this.container,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    );
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        processText(node.textContent ?? "");
        node = walker.nextNode();
        continue;
      }
      if (!(node instanceof HTMLElement)) {
        node = walker.nextNode();
        continue;
      }
      const tag = node.tagName.toLowerCase();
      if (tag === "br") {
        flush();
        node = walker.nextNode();
        continue;
      }
      if (tag === "div" || tag === "p" || tag === "li") {
        processText(node.innerText || "");
        flush();
        const next = walker.nextSibling();
        if (next) {
          node = next;
          continue;
        }
        break;
      }
      node = walker.nextNode();
    }
    if (buffer.length > 0 || lines.length === 0) {
      flush();
    }
    return lines;
  }
}
