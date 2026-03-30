import type { HighlightToken, HighlightConfig } from "./types";
import { WikitextHighlighter } from "./highlighter";

const initialState = 0;

const EMPTY_PLACEHOLDER = "\u200B";
const EMPTY_PLACEHOLDER_HTML = `<span class="wt-placeholder">${EMPTY_PLACEHOLDER}</span>`;

type EditorDebugEvent =
  | { type: "attach"; contentEditable: string }
  | {
      type: "input";
      inputType?: string;
      data?: string | null;
      domLinesCount: number;
      payloadLength: number;
      cursorOffsetCalculated: number | null;
      cursorOffsetUsed: number | null;
    }
  | {
      type: "keydown";
      key: string;
      shiftKey: boolean;
      ctrlKey: boolean;
      altKey: boolean;
      metaKey: boolean;
      prevented: boolean;
    }
  | {
      type: "insertNewLine";
      cursorOffset: number;
      beforeLength: number;
      afterLength: number;
      beforePreview: string;
      afterPreview: string;
    }
  | {
      type: "update:start";
      reason: "external" | "input" | "insertNewLine";
      textLength: number;
      lines: number;
      cursorOffsetOverride: number | null;
    }
  | {
      type: "computeLines:start";
      lines: number;
      lastLines: number;
    }
  | {
      type: "computeLines:diff";
      startLineIndex: number;
      minLen: number;
      wasNoop: boolean;
    }
  | {
      type: "computeLines:tokenizeLine";
      i: number;
      isFirstLine: boolean;
      lineLength: number;
      lineSameAsCached: boolean;
      stateBefore: number;
      stateAfter: number;
      convergedAtLine: boolean;
    }
  | {
      type: "update:domPatch";
      lineIndex: number;
      reusedExistingElement: boolean;
      innerHtmlChanged: boolean;
      htmlLength: number;
      safeHtmlWasPlaceholder: boolean;
    }
  | {
      type: "update:restoreCursor";
      requestedOffset: number;
      resolvedLineIndex: number | null;
      resolvedInnerOffset: number | null;
      lineTextLength: number | null;
    }
  | {
      type: "extractLines:start";
      containerChildCount: number;
      containerTextContentLength: number;
    }
  | {
      type: "extractLines:processText";
      rawLength: number;
      normalizedLength: number;
      splitCount: number;
      sample: string;
    }
  | {
      type: "extractLines:br";
      bufferLengthBeforeFlush: number;
      emittedLineIndex: number;
    }
  | {
      type: "extractLines:block";
      tag: string;
      innerTextLength: number;
      emittedLineIndex: number;
    }
  | {
      type: "extractLines:flush";
      emittedLineIndex: number;
      emittedLineLength: number;
      emittedLineSample: string;
    }
  | {
      type: "extractLines:done";
      lines: number;
      lastLineLength: number;
    }
  | {
      type: "cursor:calc";
      lineIndex: number;
      offsetInLine: number;
      absoluteOffset: number;
      rangeStartNode: string;
      rangeStartOffset: number;
    }
  | {
      type: "cursor:setInLine";
      requestedInnerOffset: number;
      walkedTextNodes: number;
      fellBackToEnd: boolean;
    }
  | {
      type: "warn";
      message: string;
      data?: Record<string, unknown>;
    };

function previewText(s: string, max = 120): string {
  const normalized = s.replace(/\r\n/g, "\n");
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, max) + "…";
}

function nodeDebugName(node: Node | null): string {
  if (!node) return "null";
  if (node.nodeType === Node.TEXT_NODE) return "#text";
  if (node instanceof HTMLElement) return `<${node.tagName.toLowerCase()}>`;
  return `nodeType:${node.nodeType}`;
}

export class WikitextEditor extends WikitextHighlighter {
  private lastLines: string[] = [];
  private cachedTokens: HighlightToken[][] = [];
  private cachedStates: number[] = [];
  private container?: HTMLElement;
  private lineElements: HTMLElement[] = [];
  private inputHandler?: (event: Event) => void;
  private keydownHandler?: (event: KeyboardEvent) => void;
  private pasteHandler?: (event: ClipboardEvent) => void;
  private applyingUpdate = false;

  public debug?: (event: EditorDebugEvent) => void;

  private debugEmit(event: EditorDebugEvent): void {
    try {
      this.debug?.(event);
    } catch {}
  }

  constructor(config: HighlightConfig = {}) {
    super(config);
    this.resetCache();
  }

  public resetCache(): void {
    this.lastLines = [];
    this.cachedTokens = [];
    this.cachedStates = [initialState];
  }

  public attach(container: HTMLElement): void {
    if (this.container && this.inputHandler) {
      this.container.removeEventListener("input", this.inputHandler);
    }
    if (this.container && this.keydownHandler) {
      this.container.removeEventListener("keydown", this.keydownHandler);
    }
    if (this.container && this.pasteHandler) {
      this.container.removeEventListener("paste", this.pasteHandler);
    }
    this.container = container;
    this.container.contentEditable = "true";
    this.container.innerHTML = "";
    this.lineElements = [];
    this.resetCache();

    this.debugEmit({
      type: "attach",
      contentEditable: String(this.container.contentEditable),
    });

    this.inputHandler = (event: Event) => {
      if (this.applyingUpdate) {
        this.debugEmit({
          type: "warn",
          message: "input ignored because applyingUpdate=true",
        });
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

      let cursorOffsetCalculated: number | null = null;
      let cursorOffset: number | null = null;

      if (range) {
        cursorOffsetCalculated = this.getCursorOffsetFromElements(
          range,
          currentLineElements,
          domLines,
        );
        if (
          cursorOffsetCalculated === 0 &&
          inputEvent.inputType === "insertText" &&
          inputEvent.data?.length === 1
        ) {
          cursorOffset = 1;
        } else {
          cursorOffset = cursorOffsetCalculated;
        }
      }

      this.debugEmit({
        type: "input",
        inputType: inputEvent.inputType,
        data: inputEvent.data,
        domLinesCount: domLines.length,
        payloadLength: payload.length,
        cursorOffsetCalculated,
        cursorOffsetUsed: cursorOffset,
      });

      this.update(payload, cursorOffset, "input");
    };

    this.keydownHandler = (event: KeyboardEvent) => {
      let prevented = false;

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        prevented = true;
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
                prevented = true;
                this.restoreCursorOffset(cursorOffset - 1);
              }
              break;
            }
            currentPos += lineLength + 1;
          }
        }
      }

      this.debugEmit({
        type: "keydown",
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        prevented,
      });
    };

    this.pasteHandler = (event: ClipboardEvent) => {
      event.preventDefault();
      const pastedText = event.clipboardData?.getData("text/plain") ?? "";
      if (!this.container) return;

      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const currentLineElements = Array.from(
        this.container.querySelectorAll<HTMLElement>(".wt-line"),
      );
      const domLines = this.readDomLines();
      const currentText = domLines.join("\n");

      let selStart = currentText.length;
      let selEnd = currentText.length;

      if (range) {
        const startRange = range.cloneRange();
        startRange.collapse(true);
        selStart = this.getCursorOffsetFromElements(
          startRange,
          currentLineElements,
          domLines,
        );

        if (!range.collapsed) {
          const endRange = range.cloneRange();
          endRange.collapse(false);
          selEnd = this.getCursorOffsetFromElements(
            endRange,
            currentLineElements,
            domLines,
          );
        } else {
          selEnd = selStart;
        }
      }

      if (selStart > selEnd) [selStart, selEnd] = [selEnd, selStart];

      const newText =
        currentText.slice(0, selStart) + pastedText + currentText.slice(selEnd);
      const newCursorOffset = selStart + pastedText.length;

      this.debugEmit({
        type: "warn",
        message: "paste intercepted",
        data: {
          pastedTextLength: pastedText.length,
          selStart,
          selEnd,
          resultLength: newText.length,
          newCursorOffset,
        },
      });

      this.update(newText, newCursorOffset, "input");
    };

    this.container.addEventListener("input", this.inputHandler);
    this.container.addEventListener("keydown", this.keydownHandler);
    this.container.addEventListener("paste", this.pasteHandler);
  }

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

    this.debugEmit({
      type: "insertNewLine",
      cursorOffset,
      beforeLength: text.length,
      afterLength: newText.length,
      beforePreview: previewText(text),
      afterPreview: previewText(newText),
    });

    this.update(newText, cursorOffset + 1, "insertNewLine");
  }

  public update(
    text: string,
    cursorOffsetOverride: number | null = null,
    reason: "external" | "input" | "insertNewLine" = "external",
  ): void {
    if (!this.container) throw new Error("Call attach() first");
    if (this.applyingUpdate) {
      this.debugEmit({
        type: "warn",
        message: "update ignored because applyingUpdate=true",
        data: { reason },
      });
      return;
    }
    this.applyingUpdate = true;
    try {
      let cursorOffset = cursorOffsetOverride ?? null;
      const lines = text.split("\n");

      this.debugEmit({
        type: "update:start",
        reason,
        textLength: text.length,
        lines: lines.length,
        cursorOffsetOverride,
      });

      const htmlLines = this.computeLines(lines);
      const fragment = document.createDocumentFragment();

      for (let i = 0; i < lines.length; i++) {
        const existed = Boolean(this.lineElements[i]);
        let lineEl = this.lineElements[i];
        if (!lineEl) {
          lineEl = document.createElement("div");
        }
        if (lineEl.className !== "wt-line") {
          lineEl.className = "wt-line";
        }

        const html = htmlLines[i] ?? "";
        const safeHtml = html === "" ? EMPTY_PLACEHOLDER_HTML : html;
        const innerHtmlChanged = lineEl.innerHTML !== safeHtml;

        if (innerHtmlChanged) {
          lineEl.innerHTML = safeHtml;
        }

        this.debugEmit({
          type: "update:domPatch",
          lineIndex: i,
          reusedExistingElement: existed,
          innerHtmlChanged,
          htmlLength: html.length,
          safeHtmlWasPlaceholder: html === "",
        });

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

  public override highlight(text: string): string {
    const lines = text.split("\n");
    const htmlLines = this.computeLines(lines);
    return htmlLines.join("\n");
  }

  public override tokenize(text: string): HighlightToken[][] {
    this.computeLines(text.split("\n"));
    return this.cachedTokens;
  }

  private computeLines(lines: string[]): string[] {
    this.debugEmit({
      type: "computeLines:start",
      lines: lines.length,
      lastLines: this.lastLines.length,
    });

    let start = 0;
    const minLen = Math.min(lines.length, this.lastLines.length);
    while (start < minLen && lines[start] === this.lastLines[start]) start++;

    const wasNoop =
      start === lines.length && lines.length === this.lastLines.length;

    this.debugEmit({
      type: "computeLines:diff",
      startLineIndex: start,
      minLen,
      wasNoop,
    });

    if (wasNoop) {
      return this.renderLines(this.cachedTokens);
    }

    let currentState =
      (start > 0 ? this.cachedStates[start] : initialState) ?? initialState;

    if (this.cachedStates[start] === undefined && start > 0) {
      this.debugEmit({
        type: "warn",
        message: "cachedStates[start] was undefined; reset to initialState",
        data: {
          start,
          cachedStatesLength: this.cachedStates.length,
          linesLength: lines.length,
          lastLinesLength: this.lastLines.length,
        },
      });
    }

    const newTokens: HighlightToken[][] = this.cachedTokens.slice(0, start);
    const newStates: number[] = this.cachedStates.slice(0, start + 1);

    let converged = false;

    for (let i = start; i < lines.length; i++) {
      const stateBefore = currentState;
      const lineSameAsCached =
        i < this.lastLines.length && lines[i] === this.lastLines[i];

      const result = this.tokenizer.tokenizeLine(
        lines[i],
        currentState,
        i === 0,
      );
      newTokens.push(result.tokens);

      const after = result.newStateMask;
      newStates.push(after);
      currentState = after;

      let convergedAtLine = false;

      if (lineSameAsCached) {
        const oldAfter = this.cachedStates[i + 1];
        // Integer comparison is massively faster than object deep equality!
        if (oldAfter !== undefined && after === oldAfter) {
          newTokens.push(...this.cachedTokens.slice(i + 1));
          newStates.push(...this.cachedStates.slice(i + 2));
          converged = true;
          convergedAtLine = true;
        }
      }

      this.debugEmit({
        type: "computeLines:tokenizeLine",
        i,
        isFirstLine: i === 0,
        lineLength: lines[i].length,
        lineSameAsCached,
        stateBefore,
        stateAfter: after,
        convergedAtLine,
      });

      if (converged) break;
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

  // NOTE: DOM manipulation & cursor restoration logic below is left functionally identical
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

    this.debugEmit({
      type: "cursor:calc",
      lineIndex,
      offsetInLine,
      absoluteOffset: offset,
      rangeStartNode: nodeDebugName(range.startContainer),
      rangeStartOffset: range.startOffset,
    });

    return offset;
  }

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

        this.debugEmit({
          type: "update:restoreCursor",
          requestedOffset: offset,
          resolvedLineIndex: lineIndex,
          resolvedInnerOffset: innerOffset,
          lineTextLength: lineLength,
        });

        this.setCursorInLine(lineEl, innerOffset);
        return;
      }
      currentPos = lineEnd + 1;
    }

    this.debugEmit({
      type: "update:restoreCursor",
      requestedOffset: offset,
      resolvedLineIndex: null,
      resolvedInnerOffset: null,
      lineTextLength: null,
    });

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

    let walkedTextNodes = 0;

    while ((node = walker.nextNode())) {
      walkedTextNodes++;
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

          this.debugEmit({
            type: "cursor:setInLine",
            requestedInnerOffset: innerOffset,
            walkedTextNodes,
            fellBackToEnd: false,
          });

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

        this.debugEmit({
          type: "cursor:setInLine",
          requestedInnerOffset: innerOffset,
          walkedTextNodes,
          fellBackToEnd: false,
        });

        return;
      }
      currentInner += normalizedLength;
    }
    const range = document.createRange();
    range.selectNodeContents(lineEl);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    this.debugEmit({
      type: "cursor:setInLine",
      requestedInnerOffset: innerOffset,
      walkedTextNodes,
      fellBackToEnd: true,
    });
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

    this.debugEmit({
      type: "extractLines:start",
      containerChildCount: this.container.childNodes.length,
      containerTextContentLength: (this.container.textContent ?? "").length,
    });

    const lines: string[] = [];
    let buffer = "";

    const flush = () => {
      const normalized = this.normalizeLineText(buffer);
      const emittedLineIndex = lines.length;
      lines.push(normalized);

      this.debugEmit({
        type: "extractLines:flush",
        emittedLineIndex,
        emittedLineLength: normalized.length,
        emittedLineSample: previewText(normalized),
      });

      buffer = "";
    };

    const processText = (text: string) => {
      const normalized = this.normalizeLineText(text);
      const pieces = normalized.split(/\n/);

      this.debugEmit({
        type: "extractLines:processText",
        rawLength: text.length,
        normalizedLength: normalized.length,
        splitCount: pieces.length,
        sample: previewText(normalized),
      });

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
        this.debugEmit({
          type: "extractLines:br",
          bufferLengthBeforeFlush: buffer.length,
          emittedLineIndex: lines.length,
        });
        flush();
        node = walker.nextNode();
        continue;
      }
      if (tag === "div" || tag === "p" || tag === "li") {
        let rawText = node.innerText || "";
        if (rawText.endsWith("\n")) rawText = rawText.slice(0, -1);

        this.debugEmit({
          type: "extractLines:block",
          tag,
          innerTextLength: rawText.length,
          emittedLineIndex: lines.length,
        });

        if (buffer.length > 0) flush();
        processText(rawText);
        flush();

        let next: Node | null = walker.nextSibling();
        while (!next && walker.parentNode()) {
          next = walker.nextSibling();
        }
        node = next;
        continue;
      }
      node = walker.nextNode();
    }

    if (buffer.length > 0 || lines.length === 0) {
      flush();
    }

    this.debugEmit({
      type: "extractLines:done",
      lines: lines.length,
      lastLineLength: lines.length ? lines[lines.length - 1].length : 0,
    });

    return lines;
  }
}
