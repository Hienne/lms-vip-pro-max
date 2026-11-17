import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { LessonTextEditor } from './lesson-text-editor';

describe('LessonTextEditor inline HTML', () => {
  function render(value = '<p>Nội dung đang có</p>') {
    TestBed.configureTestingModule({
      providers: [
        { provide: EndpointClient, useValue: { call: () => of(new Blob()) } },
      ],
    });
    const fixture = TestBed.createComponent(LessonTextEditor);
    fixture.componentRef.setInput('format', 'html');
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    TestBed.tick();
    const root = fixture.nativeElement as HTMLElement;
    const button = (name: string) =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === name,
      )!;
    const settle = () => {
      fixture.detectChanges();
      TestBed.tick();
    };
    return { fixture, root, button, settle };
  }

  it('uses named Word-style icon controls and a read-only preview', () => {
    const { root, button, settle } = render();
    for (const label of [
      'Bold (Ctrl+B)',
      'Italic (Ctrl+I)',
      'Underline (Ctrl+U)',
      'Undo (Ctrl+Z)',
      'Redo (Ctrl+Y)',
      'Chèn ảnh',
      'Chèn bảng',
    ]) {
      const control = root.querySelector(`button[aria-label="${label}"]`);
      expect(control?.querySelector('ui-icon')).toBeTruthy();
    }
    expect(button('Code')).toBeTruthy();
    button('Preview').click();
    settle();
    const preview = root.querySelector(
      '[aria-label="Xem trước nội dung bài học"]',
    );
    expect(preview?.getAttribute('contenteditable')).toBe('false');
    expect(preview?.textContent).toBe('Nội dung đang có');
    button('Soạn thảo').click();
    settle();
    expect(
      root
        .querySelector('[aria-label="Nội dung bài học"]')
        ?.getAttribute('contenteditable'),
    ).toBe('true');
  });

  it('previews Markdown without changing existing lesson content, then inserts safe HTML', () => {
    const { fixture, root, button, settle } = render();
    button('Markdown').click();
    settle();
    const input = root.querySelector<HTMLTextAreaElement>(
      '[aria-label="Nội dung Markdown"]',
    )!;
    input.value =
      '# Quy trình\n\n**Kiểm tra**\n\n- Đầu vào\n- Đầu ra\n\n```js\nalert("example");\n```\n<script>alert(1)</script>';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    settle();
    const preview = root.querySelector('[aria-label="Xem trước Markdown"]')!;
    expect(preview.querySelector('h2')?.textContent).toBe('Quy trình');
    expect(preview.querySelector('strong')?.textContent).toBe('Kiểm tra');
    expect(preview.querySelectorAll('li')).toHaveLength(2);
    expect(preview.querySelector('pre code')?.textContent).toBe(
      'alert("example");',
    );
    expect(preview.querySelector('script')).toBeNull();
    expect(fixture.componentInstance.value()).toBe('<p>Nội dung đang có</p>');
    const descriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
    const exec = vi.fn((command: string, _show: boolean, html: string) => {
      expect(command).toBe('insertHTML');
      root
        .querySelector('.lesson-text-editor__body')!
        .insertAdjacentHTML('beforeend', html);
      return true;
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: exec,
    });
    try {
      button('Chèn Markdown').click();
      settle();
      expect(exec).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.value()).toContain(
        '<p>Nội dung đang có</p>',
      );
      expect(fixture.componentInstance.value()).toContain(
        '<strong>Kiểm tra</strong>',
      );
      expect(fixture.componentInstance.value()).not.toContain('<script>');
      expect(root.querySelector('[aria-label="Nội dung Markdown"]')).toBeNull();
    } finally {
      if (descriptor)
        Object.defineProperty(document, 'execCommand', descriptor);
      else Reflect.deleteProperty(document, 'execCommand');
    }
  });

  it('renders the same text again when only its stored format changes', () => {
    const { fixture, root, settle } = render('**Đậm**');
    expect(root.querySelector('.lesson-text-editor__body strong')).toBeNull();
    fixture.componentRef.setInput('format', 'markdown');
    settle();
    expect(
      root.querySelector('.lesson-text-editor__body strong')?.textContent,
    ).toBe('Đậm');
  });

  it('opens a Markdown file into the preview without replacing existing content', async () => {
    const { fixture, root, button, settle } = render();
    button('Markdown').click();
    settle();
    const input = root.querySelector<HTMLInputElement>('input[accept^=".md"]')!;
    const file = new File(['## Hướng dẫn\n\n**Đối soát**'], 'huong-dan.md', {
      type: 'text/markdown',
    });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve('## Hướng dẫn\n\n**Đối soát**'),
    });
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    settle();
    expect(
      root.querySelector<HTMLTextAreaElement>(
        '[aria-label="Nội dung Markdown"]',
      )?.value,
    ).toContain('## Hướng dẫn');
    expect(
      root.querySelector('[aria-label="Xem trước Markdown"] strong')
        ?.textContent,
    ).toBe('Đối soát');
    expect(fixture.componentInstance.value()).toBe('<p>Nội dung đang có</p>');
  });
  it('resolves a saved image after the editor inserts its initial HTML and releases it on close', () => {
    const original = {
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
    };
    URL.createObjectURL = vi.fn(() => 'blob:lesson-image');
    URL.revokeObjectURL = vi.fn();
    const readImage = vi.fn(() =>
      of(new Blob(['image'], { type: 'image/png' })),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: EndpointClient, useValue: { call: readImage } }],
    });
    const fixture = TestBed.createComponent(LessonTextEditor);
    try {
      fixture.componentRef.setInput('format', 'html');
      fixture.componentRef.setInput(
        'value',
        '<p>Bài học</p><img data-asset-id="42" alt="Sơ đồ">',
      );
      fixture.componentRef.setInput('assets', [
        { assetId: 42, usage: 'image', name: 'anh.png', sizeBytes: 5 },
      ]);
      fixture.detectChanges();
      TestBed.tick();
      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('img')
          ?.getAttribute('src'),
      ).toBe('blob:lesson-image');
      TestBed.tick();
      expect(readImage).toHaveBeenCalledTimes(1);
      fixture.destroy();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:lesson-image');
    } finally {
      if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });
});
