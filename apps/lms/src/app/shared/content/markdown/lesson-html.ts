import type { BodyFormat } from '@lms/contracts';
import { parseContent, type Inline } from './markdown.parse';

const TAGS = new Set([
  'p',
  'div',
  'br',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'a',
]);
const DROP = new Set([
  'script',
  'style',
  'template',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'img',
  'audio',
  'video',
  'source',
]);

/** Rebuild an inert HTML fragment using the same vocabulary as the lesson API. */
export function cleanLessonHtml(
  source: string,
  document: Document,
  openLinksExternally = false,
): string {
  const template = document.createElement('template');
  template.innerHTML = source;
  const result = document.createElement('div');
  appendClean(template.content, result, document, openLinksExternally);
  return result.textContent?.trim() ? result.innerHTML : '';
}

function appendClean(
  source: Node,
  target: HTMLElement,
  document: Document,
  openLinksExternally: boolean,
): void {
  for (const node of source.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      target.append(node.textContent ?? '');
      continue;
    }
    if (!(node instanceof Element) || DROP.has(node.localName)) continue;
    if (!TAGS.has(node.localName)) {
      appendClean(node, target, document, openLinksExternally);
      continue;
    }
    const clean = document.createElement(node.localName);
    const href = node.getAttribute('href');
    if (node.localName === 'a' && href && /^https?:\/\//i.test(href.trim())) {
      clean.setAttribute('href', href.trim());
      if (openLinksExternally) {
        clean.setAttribute('target', '_blank');
        clean.setAttribute('rel', 'noopener noreferrer');
      }
    }
    appendClean(node, clean, document, openLinksExternally);
    target.append(clean);
  }
}

/** Existing Markdown and plain blocks keep their stored format until the author edits them. */
export function lessonEditorHtml(
  source: string,
  format: BodyFormat,
  document: Document,
): string {
  if (format === 'html') return cleanLessonHtml(source, document);
  const body = document.createElement('div');
  for (const block of parseContent(source, format)) {
    if (block.kind === 'list') {
      const list = document.createElement(block.ordered ? 'ol' : 'ul');
      for (const item of block.items) {
        const row = document.createElement('li');
        appendInline(row, item, document);
        list.append(row);
      }
      body.append(list);
    } else if (block.kind === 'code') {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = block.text;
      pre.append(code);
      body.append(pre);
    } else {
      const element = document.createElement(
        block.kind === 'heading'
          ? block.level === 3
            ? 'h2'
            : 'h3'
          : block.kind === 'quote'
            ? 'blockquote'
            : 'p',
      );
      appendInline(element, block.inlines, document);
      body.append(element);
    }
  }
  return body.innerHTML;
}

function appendInline(
  target: HTMLElement,
  items: readonly Inline[],
  document: Document,
): void {
  for (const item of items) {
    switch (item.kind) {
      case 'text':
        target.append(item.text);
        break;
      case 'mention':
        target.append('@' + item.name);
        break;
      case 'break':
        target.append(document.createElement('br'));
        break;
      default: {
        const element = document.createElement(
          item.kind === 'link' ? 'a' : item.kind,
        );
        if (item.kind === 'link') element.setAttribute('href', item.href);
        element.textContent = item.text;
        target.append(element);
      }
    }
  }
}
