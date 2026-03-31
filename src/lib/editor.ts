import type { HighlightToken } from "./types";
import { WikitextHighlighter } from "./highlighter";

const initialState = 0;
const EMPTY_PLACEHOLDER = "\u200B";
const EMPTY_PLACEHOLDER_HTML = `<span class="wt-placeholder">${EMPTY_PLACEHOLDER}</span>`;

export type EditorDebugEvent =
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
  | { type: "computeLines:start"; lines: number; lastLines: number }
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
  | { type: "extractLines:done"; lines: number; lastLineLength: number }
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
  | { type: "warn"; message: string; data?: Record<string, unknown> };

const previewText = (s: string, max = 120) =>
  s.length <= max
    ? s.replace(/\r\n/g, "\n")
    : s.replace(/\r\n/g, "\n").slice(0, max) + "…";
const nodeDebugName = (node: Node | null) =>
  !node
    ? "null"
    : node.nodeType === Node.TEXT_NODE
      ? "#text"
      : node instanceof HTMLElement
        ? `<${node.tagName.toLowerCase()}>`
        : `nodeType:${node.nodeType}`;

export class WikitextEditor extends WikitextHighlighter {
  private lastLines: string[] = [];
  private cachedTokens: HighlightToken[][] = [];
  private cachedStates: number[] = [initialState];
  private container?: HTMLElement;
  private lineElements: HTMLElement[] = [];
  private inputHandler?: (event: Event) => void;
  private keydownHandler?: (event: KeyboardEvent) => void;
  private pasteHandler?: (event: ClipboardEvent) => void;
  private applyingUpdate = false;

  public debug?: (event: EditorDebugEvent) => void;

  private debugEmit(event: EditorDebugEvent): void {
    if (this.debug) this.debug(event);
  }

  public resetCache(): void {
    this.lastLines = [];
    this.cachedTokens = [];
    this.cachedStates = [initialState];
  }

  public attach(container: HTMLElement): void {
    if (this.container) {
      if (this.inputHandler)
        this.container.removeEventListener("input", this.inputHandler);
      if (this.keydownHandler)
        this.container.removeEventListener("keydown", this.keydownHandler);
      if (this.pasteHandler)
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
      if (this.applyingUpdate)
        return this.debugEmit({
          type: "warn",
          message: "input ignored (applyingUpdate)",
        });

      const inputEvent = event as InputEvent;
      const domLines = this.readDomLines();
      const payload = domLines.join("\n");
      const currentLineElements = Array.from(
        this.container!.querySelectorAll<HTMLElement>(".wt-line"),
      );
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

      let cursorOffset = null,
        cursorOffsetCalculated = null;

      if (range) {
        cursorOffsetCalculated = this.getCursorOffsetFromElements(
          range,
          currentLineElements,
          domLines,
        );
        cursorOffset =
          cursorOffsetCalculated === 0 &&
          inputEvent.inputType === "insertText" &&
          inputEvent.data?.length === 1
            ? 1
            : cursorOffsetCalculated;
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
      const isPlainKey =
        !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;

      if (event.key === "Enter" && isPlainKey) {
        event.preventDefault();
        prevented = true;
        this.insertNewLine();
      } else if (event.key === "ArrowLeft" && isPlainKey) {
        const selection = window.getSelection();
        if (selection?.isCollapsed && this.container) {
          const range = selection.getRangeAt(0);
          const domLines = this.readDomLines();
          const cursorOffset = this.getCursorOffsetFromElements(
            range,
            Array.from(
              this.container.querySelectorAll<HTMLElement>(".wt-line"),
            ),
            domLines,
          );

          let currentPos = 0;
          for (let i = 0; i < domLines.length; i++) {
            if (cursorOffset === currentPos) {
              if (i > 0 && domLines[i].length === 0) {
                event.preventDefault();
                prevented = true;
                this.restoreCursorOffset(cursorOffset - 1);
              }
              break;
            }
            currentPos += domLines[i].length + 1;
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
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const currentLineElements = Array.from(
        this.container.querySelectorAll<HTMLElement>(".wt-line"),
      );
      const domLines = this.readDomLines();
      const currentText = domLines.join("\n");

      let selStart = currentText.length,
        selEnd = currentText.length;

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
        } else selEnd = selStart;
      }

      if (selStart > selEnd) [selStart, selEnd] = [selEnd, selStart];
      const newText =
        currentText.slice(0, selStart) + pastedText + currentText.slice(selEnd);

      this.debugEmit({
        type: "warn",
        message: "paste intercepted",
        data: {
          pastedTextLength: pastedText.length,
          selStart,
          selEnd,
          resultLength: newText.length,
          newCursorOffset: selStart + pastedText.length,
        },
      });
      this.update(newText, selStart + pastedText.length, "input");
    };

    this.container.addEventListener("input", this.inputHandler);
    this.container.addEventListener("keydown", this.keydownHandler);
    this.container.addEventListener("paste", this.pasteHandler);
  }

  private insertNewLine(): void {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !this.container) return;

    const domLines = this.readDomLines();
    const cursorOffset = this.getCursorOffsetFromElements(
      selection.getRangeAt(0),
      Array.from(this.container.querySelectorAll<HTMLElement>(".wt-line")),
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
    if (this.applyingUpdate)
      return this.debugEmit({
        type: "warn",
        message: "update ignored (applyingUpdate)",
        data: { reason },
      });

    this.applyingUpdate = true;
    try {
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
        const lineEl = this.lineElements[i] ?? document.createElement("div");
        if (lineEl.className !== "wt-line") lineEl.className = "wt-line";

        const html = htmlLines[i] ?? "";
        const safeHtml = html === "" ? EMPTY_PLACEHOLDER_HTML : html;
        if (lineEl.innerHTML !== safeHtml) lineEl.innerHTML = safeHtml;

        this.debugEmit({
          type: "update:domPatch",
          lineIndex: i,
          reusedExistingElement: !!this.lineElements[i],
          innerHtmlChanged: lineEl.innerHTML !== safeHtml,
          htmlLength: html.length,
          safeHtmlWasPlaceholder: html === "",
        });

        this.lineElements[i] = lineEl;
        fragment.appendChild(lineEl);
      }

      this.lineElements.length = lines.length;
      this.container.replaceChildren(fragment);
      if (cursorOffsetOverride !== null)
        this.restoreCursorOffset(cursorOffsetOverride);
    } finally {
      this.applyingUpdate = false;
    }
  }

  public override highlight(text: string): string {
    return this.computeLines(text.split("\n")).join("\n");
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

    if (start === lines.length && lines.length === this.lastLines.length) {
      this.debugEmit({
        type: "computeLines:diff",
        startLineIndex: start,
        minLen,
        wasNoop: true,
      });
      return this.renderLines(this.cachedTokens);
    }

    let currentState =
      (start > 0 ? this.cachedStates[start] : initialState) ?? initialState;
    const newTokens = this.cachedTokens.slice(0, start);
    const newStates = this.cachedStates.slice(0, start + 1);
    let converged = false;

    for (let i = start; i < lines.length; i++) {
      const result = this.tokenizer.tokenizeLine(
        lines[i],
        currentState,
        i === 0,
      );
      newTokens.push(result.tokens);
      currentState = result.newStateMask;
      newStates.push(currentState);

      if (
        i < this.lastLines.length &&
        lines[i] === this.lastLines[i] &&
        this.cachedStates[i + 1] === currentState
      ) {
        newTokens.push(...this.cachedTokens.slice(i + 1));
        newStates.push(...this.cachedStates.slice(i + 2));
        converged = true;
      }

      this.debugEmit({
        type: "computeLines:tokenizeLine",
        i,
        isFirstLine: i === 0,
        lineLength: lines[i].length,
        lineSameAsCached:
          i < this.lastLines.length && lines[i] === this.lastLines[i],
        stateBefore: newStates[newStates.length - 2],
        stateAfter: currentState,
        convergedAtLine: converged,
      });
      if (converged) break;
    }

    while (newStates.length < lines.length + 1) newStates.push(initialState);
    this.lastLines = lines.slice();
    this.cachedTokens = newTokens;
    this.cachedStates = newStates;

    return this.renderLines(newTokens);
  }

  private getCursorOffsetFromElements(
    range: Range,
    lineElements: HTMLElement[],
    lineTexts: string[],
  ): number {
    if (!this.container) return 0;

    const startNode = range.startContainer;
    const targetLine = (
      startNode.nodeType === Node.TEXT_NODE
        ? startNode.parentElement
        : (startNode as HTMLElement)
    )?.closest(".wt-line") as HTMLElement | null;

    if (!targetLine || !this.container.contains(targetLine)) return 0;
    const lineIndex = lineElements.indexOf(targetLine);
    if (lineIndex === -1) return 0;

    let offset = lineTexts
      .slice(0, lineIndex)
      .reduce((acc, text) => acc + text.length + 1, 0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(targetLine);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    offset += this.normalizeLineText(preCaretRange.toString()).length;

    this.debugEmit({
      type: "cursor:calc",
      lineIndex,
      offsetInLine: offset,
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
    for (let i = 0; i < this.lineElements.length; i++) {
      const lineEl = this.lineElements[i];
      const lineLength = this.normalizeLineText(
        lineEl.textContent ?? "",
      ).length;

      if (offset <= currentPos + lineLength) {
        this.debugEmit({
          type: "update:restoreCursor",
          requestedOffset: offset,
          resolvedLineIndex: i,
          resolvedInnerOffset: offset - currentPos,
          lineTextLength: lineLength,
        });
        return this.setCursorInLine(lineEl, offset - currentPos);
      }
      currentPos += lineLength + 1;
    }

    this.debugEmit({
      type: "update:restoreCursor",
      requestedOffset: offset,
      resolvedLineIndex: null,
      resolvedInnerOffset: null,
      lineTextLength: null,
    });

    const fallbackRange = document.createRange();
    const lastChild = this.container.lastChild;
    if (lastChild) {
      lastChild.nodeType === Node.TEXT_NODE
        ? fallbackRange.setStart(lastChild, (lastChild as Text).length)
        : (fallbackRange.selectNodeContents(lastChild),
          fallbackRange.collapse(false));
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

    let currentInner = 0,
      walkedTextNodes = 0;
    const walker = document.createTreeWalker(
      lineEl,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node: Node | null;

    while ((node = walker.nextNode())) {
      walkedTextNodes++;
      const textNode = node as Text;
      const rawText = textNode.textContent ?? "";
      const normalizedLength = this.normalizeLineText(rawText).length;

      if (normalizedLength === 0 && innerOffset === currentInner) {
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return this.debugEmit({
          type: "cursor:setInLine",
          requestedInnerOffset: innerOffset,
          walkedTextNodes,
          fellBackToEnd: false,
        });
      }

      if (currentInner + normalizedLength >= innerOffset) {
        let rawIndex = 0,
          seen = 0;
        const targetInner = innerOffset - currentInner;
        while (rawIndex < rawText.length && seen < targetInner) {
          if (rawText[rawIndex] !== EMPTY_PLACEHOLDER) seen++;
          rawIndex++;
        }
        const range = document.createRange();
        range.setStart(textNode, rawIndex);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return this.debugEmit({
          type: "cursor:setInLine",
          requestedInnerOffset: innerOffset,
          walkedTextNodes,
          fellBackToEnd: false,
        });
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
      .replace(/\r\n|\u2028|\u2029/g, "\n")
      .replace(/\u00a0/g, " ")
      .replaceAll(EMPTY_PLACEHOLDER, "");
  }

  private readDomLines(): string[] {
    if (!this.container) return [];
    this.debugEmit({
      type: "extractLines:start",
      containerChildCount: this.container.childNodes.length,
      containerTextContentLength: (this.container.textContent ?? "").length,
    });

    const lines: string[] = [];
    let buffer = "";

    const flush = () => {
      const normalized = this.normalizeLineText(buffer);
      this.debugEmit({
        type: "extractLines:flush",
        emittedLineIndex: lines.length,
        emittedLineLength: normalized.length,
        emittedLineSample: previewText(normalized),
      });
      lines.push(normalized);
      buffer = "";
    };

    const processText = (text: string) => {
      const pieces = this.normalizeLineText(text).split(/\n/);
      this.debugEmit({
        type: "extractLines:processText",
        rawLength: text.length,
        normalizedLength: pieces.join("\n").length,
        splitCount: pieces.length,
        sample: previewText(pieces.join("\n")),
      });
      for (let i = 0; i < pieces.length; i++) {
        if (i > 0) flush();
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
      } else if (node instanceof HTMLElement) {
        const tag = node.tagName.toLowerCase();
        if (tag === "br") {
          this.debugEmit({
            type: "extractLines:br",
            bufferLengthBeforeFlush: buffer.length,
            emittedLineIndex: lines.length,
          });
          flush();
        } else if (tag === "div" || tag === "p" || tag === "li") {
          let rawText = node.textContent || "";
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
          while (!next && walker.parentNode()) next = walker.nextSibling();
          node = next;
          continue;
        }
      }
      node = walker.nextNode();
    }

    if (buffer.length > 0 || lines.length === 0) flush();
    this.debugEmit({
      type: "extractLines:done",
      lines: lines.length,
      lastLineLength: lines.length ? lines[lines.length - 1].length : 0,
    });
    return lines;
  }
}
