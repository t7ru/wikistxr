/**
 * Incremental wikitext editor helper.
 * 
 * Extends WikitextHighlighter to provide live, line-based incremental highlighting
 * for editable wikitext. Caches tokens and parser states to retokenize only changed
 * lines while maintaining multiline context (comments, tags, templates) across edits.
 * 
 * @example
 * const editor = new WikitextEditor();
 * editor.attach(editableDiv);
 * editableDiv.addEventListener('input', (e) => editor.update(e.currentTarget.textContent));
 */
import type { HighlightToken, HighlightConfig, TokenizerState } from "./types";
import { WikitextHighlighter } from "./highlighter";

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

  constructor(config: HighlightConfig = {}) {
    super(config);
    this.resetCache();
  }

  /**
   * Reset all caches and tokenizer state.
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
   * Attach editor to a DOM element. Makes it contentEditable and clears existing content.
   * @param container - The HTML element to attach to
   */
  public attach(container: HTMLElement): void {
    this.container = container;
    this.container.contentEditable = "true";
    this.container.innerHTML = "";
    this.lineElements = [];
  }

  /**
   * Update editor with new wikitext. Retokenizes changed lines and patches DOM.
   * @param text - The wikitext content to render
   * @throws Error if attach() was not called first
   */
  public update(text: string): void {
    if (!this.container) throw new Error("Call attach() first");

    const lines = text.split("\n");
    const htmlLines = this.computeLines(lines);

    for (let i = 0; i < lines.length; i++) {
      let lineEl = this.lineElements[i];
      if (!lineEl) {
        lineEl = document.createElement("div");
        lineEl.className = "wt-line";
        this.container.appendChild(lineEl);
        this.lineElements.push(lineEl);
      }
      if (lineEl.innerHTML !== htmlLines[i]) {
        lineEl.innerHTML = htmlLines[i];
      }
    }

    while (this.lineElements.length > lines.length) {
      this.lineElements.pop()!.remove();
    }
  }

  /**
   * Highlight wikitext without DOM attachment. Returns HTML string.
   * @param text - The wikitext content to highlight
   * @returns HTML string with syntax highlighting
   */
  public override highlight(text: string): string {
    const lines = text.split("\n");
    const htmlLines = this.computeLines(lines);
    return htmlLines.join("\n");
  }

  /**
   * Tokenize wikitext into structured tokens. Updates cache.
   * @param text - The wikitext content to tokenize
   * @returns Array of token arrays (one per line)
   */
  public override tokenize(text: string): HighlightToken[][] {
    this.computeLines(text.split("\n"));
    return this.cachedTokens;
  }

  /**
   * Compute line tokens with incremental retokenization.
   * Finds the first changed line, retokenizes from there, and stops early if
   * the tokenizer state converges with the cached state.
   * @param lines - Array of wikitext lines
   * @returns Array of HTML strings (one per line)
   * @private
   */
  private computeLines(lines: string[]): string[] {
    const initialState: TokenizerState = {
      inMultilineComment: false,
      commentBuffer: "",
      inExtensionTag: null,
      templateDepth: 0,
    };

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
}
