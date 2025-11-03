/**
 * Optimized WikitextTokenizer for parsing wikitext into tokens.
 * Batches consecutive plain/template text into single tokens for efficiency.
 * Maintains multi-line state for comments, extension tags, and templates.
 * Supports incremental highlighting via getState/setState.
 */
import type { HighlightToken, TokenizerState } from './types';
import { findClosing } from './utils';
export class WikitextTokenizer {
  private inMultilineComment = false;
  private commentBuffer = '';
  private inExtensionTag: string | null = null;
  private templateDepth = 0;
  constructor(
    private urlProtocols: RegExp,
    private redirectRegex: RegExp,
    private extensionTags: string[],
    private contentPreservingTags: string[]
  ) {}
  public tokenizeLine(line: string, isFirstLine: boolean): HighlightToken[] {
    let pos = 0;
    const tokens: HighlightToken[] = [];
    let buffer = '';
    let bufferClass = '';
    const flushBuffer = () => {
      if (buffer) {
        tokens.push({ text: buffer, className: bufferClass });
        buffer = '';
        bufferClass = '';
      }
    };
    // Multiline extension tag continuation
    if (this.inExtensionTag) {
      const closeTag = `</${this.inExtensionTag}>`;
      const closeIdx = line.indexOf(closeTag);
      if (closeIdx > -1) {
        const content = line.slice(0, closeIdx);
        if (content) {
          tokens.push({ text: content, className: `wt-ext-${this.inExtensionTag}` });
        }
        tokens.push({ text: closeTag, className: `wt-exttag wt-ext-${this.inExtensionTag}` });
        this.inExtensionTag = null;
        pos = closeIdx + closeTag.length;
      } else {
        tokens.push({ text: line, className: `wt-ext-${this.inExtensionTag}` });
        return tokens;
      }
    }
    // Multiline comment continuation
    if (this.inMultilineComment) {
      const commentEnd = line.indexOf('-->');
      if (commentEnd > -1) {
        this.commentBuffer += line.slice(0, commentEnd + 3);
        tokens.push({ text: this.commentBuffer, className: 'wt-comment' });
        this.inMultilineComment = false;
        this.commentBuffer = '';
        pos = commentEnd + 3;
      } else {
        this.commentBuffer += line + '\n';
        tokens.push({ text: line, className: 'wt-comment' });
        return tokens;
      }
    }
    // First line redirect
    if (isFirstLine && this.redirectRegex.test(line)) {
      const match = line.match(this.redirectRegex);
      if (match) {
        tokens.push({ text: match[0], className: 'wt-redirect' });
        pos = match[0].length;
      }
    }
    // Section headers
    if (pos === 0) {
      const headerMatch = line.match(/^(={2,6})(.+?)\1\s*$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        tokens.push({
          text: headerMatch[0],
          className: `wt-section-header wt-section-${level}`
        });
        return tokens;
      }
    }
    // Lists
    if (pos === 0) {
      const listMatch = line.match(/^([*#:;]+)/);
      if (listMatch) {
        tokens.push({ text: listMatch[0], className: 'wt-list' });
        pos = listMatch[0].length;
      }
    }
    // Horizontal ruler
    if (line.match(/^----+$/)) {
      tokens.push({ text: line, className: 'wt-hr' });
      return tokens;
    }
    // Table syntax outside templates
    if (pos === 0 && this.templateDepth === 0) {
      // Table start {|
      if (line.startsWith('{|')) {
        const rest = line.slice(2);
        const nonSpaceIdx = rest.search(/\S/);
        if (nonSpaceIdx === -1) {
          tokens.push({ text: line, className: 'wt-table-bracket' });
        } else {
          const beforeAttrs = rest.slice(0, nonSpaceIdx);
          const attrsAndAfter = rest.slice(nonSpaceIdx);
          tokens.push({ text: '{|', className: 'wt-table-bracket' });
          tokens.push({ text: beforeAttrs, className: '' });
          tokens.push({ text: attrsAndAfter, className: 'wt-table-attrs' });
        }
        return tokens;
      }
      // Table end |}
      if (line.startsWith('|}')) {
        const rest = line.slice(2);
        const nonSpaceIdx = rest.search(/\S/);
        if (nonSpaceIdx === -1) {
          tokens.push({ text: line, className: 'wt-table-bracket' });
        } else {
          const beforeAttrs = rest.slice(0, nonSpaceIdx);
          const attrsAndAfter = rest.slice(nonSpaceIdx);
          tokens.push({ text: '|}', className: 'wt-table-bracket' });
          tokens.push({ text: beforeAttrs, className: '' });
          tokens.push({ text: attrsAndAfter, className: 'wt-table-attrs' });
        }
        return tokens;
      }
      // Row separator |-
      if (line.startsWith('|-')) {
        const rest = line.slice(2);
        const nonSpaceIdx = rest.search(/\S/);
        if (nonSpaceIdx === -1) {
          tokens.push({ text: line, className: 'wt-table-delimiter' });
        } else {
          const beforeAttrs = rest.slice(0, nonSpaceIdx);
          const attrsAndAfter = rest.slice(nonSpaceIdx);
          tokens.push({ text: '|-', className: 'wt-table-delimiter' });
          tokens.push({ text: beforeAttrs, className: '' });
          tokens.push({ text: attrsAndAfter, className: 'wt-table-attrs' });
        }
        return tokens;
      }
      // Table header !
      if (line.startsWith('!')) {
        tokens.push({ text: '!', className: 'wt-table-header' });
        pos = 1;
        const pipeIdx = line.indexOf('|', pos);
        if (pipeIdx > pos && pipeIdx < line.length - 1) {
          const potentialAttrs = line.slice(pos, pipeIdx);
          if (potentialAttrs.includes('=') || potentialAttrs.includes('"')) {
            tokens.push({ text: potentialAttrs, className: 'wt-table-attrs' });
            tokens.push({ text: '|', className: 'wt-table-delimiter' });
            pos = pipeIdx + 1;
          }
        }
      }
      // Table cell |
      else if (line.startsWith('|')) {
        tokens.push({ text: '|', className: 'wt-table-cell' });
        pos = 1;
        const pipeIdx = line.indexOf('|', pos);
        if (pipeIdx > pos && pipeIdx < line.length - 1) {
          const potentialAttrs = line.slice(pos, pipeIdx);
          if (potentialAttrs.includes('=') || potentialAttrs.includes('"')) {
            tokens.push({ text: potentialAttrs, className: 'wt-table-attrs' });
            tokens.push({ text: '|', className: 'wt-table-delimiter' });
            pos = pipeIdx + 1;
          }
        }
      }
    }
    // Main parsing loop
    while (pos < line.length) {
      const remaining = line.slice(pos);
      // Template parameters/variables {{{...}}}
      if (remaining.startsWith('{{{')) {
        flushBuffer();
        let varPos = 0;
        const open = '{{{';
        varPos += 3;
        // parameter name
        let nameStart = varPos;
        while (varPos < remaining.length && remaining[varPos] !== '|' && remaining.slice(varPos, varPos + 3) !== '}}}') {
          varPos++;
        }
        const name = remaining.slice(nameStart, varPos);
        // parameters (multiple |)
        const params: string[] = [];
        while (varPos < remaining.length && remaining[varPos] === '|') {
          varPos++;
          let paramStart = varPos;
          while (varPos < remaining.length && remaining[varPos] !== '|' && remaining.slice(varPos, varPos + 3) !== '}}}') {
            varPos++;
          }
          const param = remaining.slice(paramStart, varPos);
          params.push(param);
        }
        let isComplete = false;
        if (varPos < remaining.length && remaining.slice(varPos, varPos + 3) === '}}}') {
          varPos += 3;
          isComplete = true;
        }
        const fullLength = varPos;
        if (isComplete) {
          const fullText = remaining.slice(0, fullLength);
          tokens.push({ text: fullText, className: 'wt-template-var' });
        } else {
          // partials push separate tokens
          tokens.push({ text: open, className: 'wt-templatevariable-bracket' });
          if (name) tokens.push({ text: name, className: 'wt-templatevariable-name' });
          for (let p = 0; p < params.length; p++) {
            tokens.push({ text: '|', className: 'wt-templatevariable-delimiter' });
            if (params[p]) tokens.push({ text: params[p], className: 'wt-templatevariable' });
          }
        }
        pos += fullLength;
        continue;
      }
      // template brackets
      if (remaining.startsWith('{{')) {
        flushBuffer();
        this.templateDepth++;
        tokens.push({ text: '{{', className: 'wt-template-bracket' });
        pos += 2;
        continue;
      }
      if (remaining.startsWith('}}')) {
        flushBuffer();
        this.templateDepth = Math.max(0, this.templateDepth - 1);
        tokens.push({ text: '}}', className: 'wt-template-bracket' });
        pos += 2;
        continue;
      }
      // inside templates batch content or handle nested structures
      if (this.templateDepth > 0) {
        if (remaining.startsWith('{{{')) {
          flushBuffer();
          let varPos = 0;
          const open = '{{{';
          varPos += 3;
          // parameter name
          let nameStart = varPos;
          while (varPos < remaining.length && remaining[varPos] !== '|' && remaining.slice(varPos, varPos + 3) !== '}}}') {
            varPos++;
          }
          const name = remaining.slice(nameStart, varPos);
          // parameters
          const params: string[] = [];
          while (varPos < remaining.length && remaining[varPos] === '|') {
            varPos++;
            let paramStart = varPos;
            while (varPos < remaining.length && remaining[varPos] !== '|' && remaining.slice(varPos, varPos + 3) !== '}}}') {
              varPos++;
            }
            const param = remaining.slice(paramStart, varPos);
            params.push(param);
          }
          let isComplete = false;
          if (varPos < remaining.length && remaining.slice(varPos, varPos + 3) === '}}}') {
            varPos += 3;
            isComplete = true;
          }
          const fullLength = varPos;
          if (isComplete) {
            tokens.push({ text: remaining.slice(0, fullLength), className: 'wt-template-var' });
          } else {
            tokens.push({ text: open, className: 'wt-templatevariable-bracket' });
            if (name) tokens.push({ text: name, className: 'wt-templatevariable-name' });
            for (let p = 0; p < params.length; p++) {
              tokens.push({ text: '|', className: 'wt-templatevariable-delimiter' });
              if (params[p]) tokens.push({ text: params[p], className: 'wt-templatevariable' });
            }
          }
          pos += fullLength;
          continue;
        }
        // Nested link [[...]]
        if (remaining.startsWith('[[')) {
          flushBuffer();
          const result = findClosing(remaining, '[[', ']]');
          if (result) {
            tokens.push({ text: result.content, className: 'wt-link-full' });
            pos += result.content.length;
            continue;
          }
        }
        // Nested template {{...}}
        if (remaining.startsWith('{{')) {
          flushBuffer();
          const result = findClosing(remaining, '{{', '}}');
          if (result) {
            tokens.push({ text: result.content, className: 'wt-template-full' });
            pos += result.content.length;
            continue;
          }
        }

        const parsedToken = this.parseToken(remaining);
        if (parsedToken) {
          flushBuffer();
          tokens.push(parsedToken);
          pos += parsedToken.text.length;
          continue;
        }

        buffer += line[pos];
        bufferClass = 'wt-template';
        pos++;
        continue;
      }
      // internal links [[...]]
      if (remaining.startsWith('[[')) {
        flushBuffer();
        let linkPos = 0;
        const open = '[[';
        linkPos += 2;
        let pageStart = linkPos;
        while (linkPos < remaining.length && remaining[linkPos] !== '|' && remaining.slice(linkPos, linkPos + 2) !== ']]') {
          linkPos++;
        }
        const page = remaining.slice(pageStart, linkPos);
        const params: string[] = [];
        while (linkPos < remaining.length && remaining[linkPos] === '|') {
          linkPos++;
          let paramStart = linkPos;
          while (linkPos < remaining.length && remaining[linkPos] !== '|' && remaining.slice(linkPos, linkPos + 2) !== ']]') {
            linkPos++;
          }
          const param = remaining.slice(paramStart, linkPos);
          params.push(param);
        }
        let isComplete = false;
        if (linkPos < remaining.length && remaining.slice(linkPos, linkPos + 2) === ']]') {
          linkPos += 2;
          isComplete = true;
        }
        const fullLength = linkPos;
        if (isComplete) {
          const fullText = remaining.slice(0, fullLength);
          tokens.push({ text: fullText, className: 'wt-link-full' });
        } else {
          tokens.push({ text: open, className: 'wt-link-bracket' });
          if (page) tokens.push({ text: page, className: 'wt-link-page' });
          for (let p = 0; p < params.length; p++) {
            tokens.push({ text: '|', className: 'wt-link-pipe' });
            if (params[p]) tokens.push({ text: params[p], className: 'wt-link-label' });
          }
        }
        pos += fullLength;
        continue;
      }
      // External links [http...]
      if (remaining.match(/^\[https?:\/\//i)) {
        flushBuffer();
        let linkPos = 0;
        const open = '[';
        linkPos += 1;
        let urlStart = linkPos;
        while (linkPos < remaining.length && remaining[linkPos] !== ' ' && remaining[linkPos] !== ']') {
          linkPos++;
        }
        const url = remaining.slice(urlStart, linkPos);
        let label = '';
        let hasSpace = false;
        if (linkPos < remaining.length && remaining[linkPos] === ' ') {
          hasSpace = true;
          linkPos++;
          let labelStart = linkPos;
          while (linkPos < remaining.length && remaining[linkPos] !== ']') {
            linkPos++;
          }
          label = remaining.slice(labelStart, linkPos);
        }
        let isComplete = false;
        if (linkPos < remaining.length && remaining[linkPos] === ']') {
          linkPos++;
          isComplete = true;
        }
        const fullLength = linkPos;
        if (isComplete) {
          const fullText = remaining.slice(0, fullLength);
          tokens.push({ text: fullText, className: 'wt-extlink-full' });
        } else {
          // partials push separate tokens
          tokens.push({ text: open, className: 'wt-extlink-bracket' });
          const protocolMatch = url.match(/^([a-z]+:\/+)/i);
          if (protocolMatch) {
            tokens.push({ text: protocolMatch[0], className: 'wt-extlink-protocol' });
            tokens.push({ text: url.slice(protocolMatch[0].length), className: 'wt-extlink-url' });
          } else {
            tokens.push({ text: url, className: 'wt-extlink-url' });
          }
          if (hasSpace) {
            tokens.push({ text: ' ', className: '' });
            if (label) tokens.push({ text: label, className: 'wt-extlink-label' });
          }
        }
        pos += fullLength;
        continue;
      }
      // normal parsing outside templates
      const token = this.parseToken(remaining);
      if (token) {
        flushBuffer();
        tokens.push(token);
        pos += token.text.length;
      } else {
        // plain text
        buffer += line[pos];
        bufferClass = '';
        pos++;
      }
    }
    flushBuffer();
    return tokens;
  }
  private parseToken(remaining: string): HighlightToken | null {
  // html comments
  const commentMatch = remaining.match(/^<!--([\s\S]*?)-->/);
  if (commentMatch) {
    return { text: commentMatch[0], className: 'wt-comment' };
  }
  if (remaining.startsWith('<!--')) {
    this.inMultilineComment = true;
    this.commentBuffer = remaining + '\n';
    return { text: remaining, className: 'wt-comment' };
  }
  // content preserving tags like extensions
  if (remaining.startsWith('<')) {
    const tagMatch = remaining.match(/^<\/?([a-z][^\s>\/]*)/i);
    if (tagMatch) {
      const tagName = tagMatch[1].toLowerCase();
      const isContentPreserving = this.contentPreservingTags.includes(tagName);
      if (isContentPreserving && !remaining.startsWith('</')) {
        const openTagMatch = remaining.match(/^<[^>]+>/);
        if (openTagMatch) {
          const openTag = openTagMatch[0];
          const isSelfClosing = openTag.endsWith('/>');
          if (!isSelfClosing) {
            const closeTag = `</${tagName}>`;
            const afterOpen = remaining.slice(openTag.length);
            const closeIdx = afterOpen.indexOf(closeTag);
            if (closeIdx > -1) {
              const content = afterOpen.slice(0, closeIdx);
              return {
                text: openTag + content + closeTag,
                className: `wt-ext-${tagName}-full`
              };
            } else {
              this.inExtensionTag = tagName;
              return { text: remaining, className: `wt-ext-${tagName}-start` };
            }
          }
        }
      }
      const fullTagMatch = remaining.match(/^<[^>]+>/);
      if (fullTagMatch) {
        const fullTag = fullTagMatch[0];
        const isExtTag = this.extensionTags.includes(tagName);
        return {
          text: fullTag,
          className: isExtTag ? `wt-exttag wt-ext-${tagName}` : 'wt-htmltag'
        };
      }
    }
  }
  // internal links [[...]]
  if (remaining.startsWith('[[')) {
    const result = findClosing(remaining, '[[', ']]');
    if (result) {
      return { text: result.content, className: 'wt-link-full' };
    }
  }
  // external links [http...]
  if (remaining.match(/^\[https?:\/\//i)) {
    const closeIdx = remaining.indexOf(']');
    if (closeIdx > -1) {
      const linkText = remaining.slice(0, closeIdx + 1);
      return { text: linkText, className: 'wt-extlink-full' };
    }
  }
  // bare urls
  if (!this.inExtensionTag && this.urlProtocols.test(remaining)) {
    const match = remaining.match(/^[^\s\u00a0{[\]<>~]+/);
    if (match) {
      let url = match[0];
      while (url.length > 0 && /[).,']$/.test(url)) {
        url = url.slice(0, -1);
      }
      if (url.length > 0) {
        return { text: url, className: 'wt-free-extlink' };
      }
    }
  }
  // html entities
  if (remaining.startsWith('&')) {
    const entityMatch = remaining.match(/^&(?:[a-zA-Z]+|#\d+|#x[\da-fA-F]+);/);
    if (entityMatch) {
      return { text: entityMatch[0], className: 'wt-html-entity' };
    }
  }
  // bold and italic (''''')
  if (remaining.startsWith("'''''")) {
    const closeIdx = remaining.indexOf("'''''", 5);
    if (closeIdx > -1) {
      return { text: remaining.slice(0, closeIdx + 5), className: 'wt-strong-em' };
    }
  }
  // bold (''')
  if (remaining.startsWith("'''")) {
    const closeIdx = remaining.indexOf("'''", 3);
    if (closeIdx > -1) {
      return { text: remaining.slice(0, closeIdx + 3), className: 'wt-strong' };
    }
  }
  // italic ('')
  if (remaining.startsWith("''")) {
    const closeIdx = remaining.indexOf("''", 2);
    if (closeIdx > 2) {
      return { text: remaining.slice(0, closeIdx + 2), className: 'wt-em' };
    }
  }
  // signatures
  const sigMatch = remaining.match(/^~{3,5}/);
  if (sigMatch) {
    return { text: sigMatch[0], className: 'wt-signature' };
  }
  // magic words
  const magicMatch = remaining.match(/^__[A-Z]+__/);
  if (magicMatch) {
    return { text: magicMatch[0], className: 'wt-magic-word' };
  }
  return null;
}
  public reset() {
    this.inMultilineComment = false;
    this.commentBuffer = '';
    this.inExtensionTag = null;
    this.templateDepth = 0;
  }
  /**
   * Get current tokenizer state for incremental highlighting.
   */
  public getState(): TokenizerState {
    return {
      inMultilineComment: this.inMultilineComment,
      commentBuffer: this.commentBuffer,
      inExtensionTag: this.inExtensionTag,
      templateDepth: this.templateDepth
    };
  }
  /**
   * Set tokenizer state for incremental highlighting.
   */
  public setState(state: TokenizerState): void {
    this.inMultilineComment = state.inMultilineComment;
    this.commentBuffer = state.commentBuffer;
    this.inExtensionTag = state.inExtensionTag;
    this.templateDepth = state.templateDepth;
  }
}