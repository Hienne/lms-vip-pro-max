import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MarkdownEditor } from './markdown-editor';

@Component({
  imports: [MarkdownEditor],
  template: `<app-markdown-editor label="Nội dung câu hỏi" [(value)]="text" />`,
})
class Host {
  readonly text = signal('');
}

async function render(initial = '') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.text.set(initial);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const box = () => el.querySelector<HTMLTextAreaElement>('textarea');
  const tool = (name: string) =>
    Array.from(
      el.querySelectorAll<HTMLButtonElement>('[role="toolbar"] button'),
    ).find((b) => b.textContent?.trim() === name)!;
  return { fixture, el, host: fixture.componentInstance, box, tool };
}

describe('MarkdownEditor', () => {
  it('writes what the user types into the model', async () => {
    const { fixture, box, host } = await render();
    const textarea = box()!;
    textarea.value = 'Xin chào';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.text()).toBe('Xin chào');
    expect(textarea.getAttribute('aria-label')).toBe('Nội dung câu hỏi');
  });

  it('applies a toolbar action to the selection', async () => {
    const { box, tool, host } = await render('một hai ba');
    const textarea = box()!;
    textarea.setSelectionRange(4, 7);
    tool('Đậm').click();
    expect(host.text()).toBe('một **hai** ba');
    expect(textarea.value).toBe('một **hai** ba');
  });

  it('counts characters against the limit', async () => {
    const { el } = await render('abc');
    expect(el.querySelector('.markdown-editor__foot')?.textContent).toContain(
      '3 / 100',
    );
  });

  it('switches to a rendered preview and back', async () => {
    const { fixture, el, box } = await render('Có **đậm**');
    const preview = Array.from(
      el.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find((o) => o.textContent?.trim() === 'Xem trước')!;
    preview.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(box()).toBeNull();
    expect(
      el.querySelector('.markdown-editor__preview strong')?.textContent,
    ).toBe('đậm');

    const write = Array.from(
      el.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find((o) => o.textContent?.trim() === 'Soạn')!;
    write.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(box()?.value).toBe('Có **đậm**');
  });

  it('says there is nothing to preview for an empty body', async () => {
    const { fixture, el } = await render('');
    Array.from(el.querySelectorAll<HTMLElement>('[role="option"]'))
      .find((o) => o.textContent?.trim() === 'Xem trước')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.markdown-editor__empty')).not.toBeNull();
  });
});
