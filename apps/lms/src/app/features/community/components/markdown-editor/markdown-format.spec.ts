import { describe, expect, it } from 'vitest';
import { applyMarkdown } from './markdown-format';

describe('applyMarkdown', () => {
  it('wraps the selection in bold markers and keeps it selected', () => {
    const edit = applyMarkdown('một hai ba', 4, 7, 'bold');
    expect(edit.value).toBe('một **hai** ba');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe(
      'hai',
    );
  });

  it('removes the markers when the wrapped text is selected again', () => {
    const edit = applyMarkdown('một **hai** ba', 6, 9, 'bold');
    expect(edit.value).toBe('một hai ba');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe(
      'hai',
    );
  });

  it('inserts a placeholder for an empty selection', () => {
    const edit = applyMarkdown('', 0, 0, 'italic');
    expect(edit.value).toBe('*văn bản*');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe(
      'văn bản',
    );
  });

  it('uses a fenced block for code across lines and inline code on one line', () => {
    expect(applyMarkdown('a', 0, 1, 'code').value).toBe('`a`');
    expect(applyMarkdown('a\nb', 0, 3, 'code').value).toBe('```\na\nb\n```');
  });

  it('builds a link around the selection and selects the address', () => {
    const edit = applyMarkdown('xem tài liệu', 4, 12, 'link');
    expect(edit.value).toBe('xem [tài liệu](https://)');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe(
      'https://',
    );
  });

  it('turns every selected line into a list item, and back', () => {
    const listed = applyMarkdown('a\nb\nc', 0, 3, 'list');
    expect(listed.value).toBe('- a\n- b\nc');
    const plain = applyMarkdown(
      listed.value,
      listed.selectionStart,
      listed.selectionEnd,
      'list',
    );
    expect(plain.value).toBe('a\nb\nc');
  });
});
