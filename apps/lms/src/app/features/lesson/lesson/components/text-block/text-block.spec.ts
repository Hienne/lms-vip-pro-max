import { TestBed } from '@angular/core/testing';
import type { LessonBlock } from '@lms/contracts';
import { of } from 'rxjs';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { TextBlock } from './text-block';

const block = (over: Partial<LessonBlock>): LessonBlock => ({
  id: 1,
  lessonId: 2,
  blockType: 'text',
  title: 'Tóm tắt',
  body: null,
  bodyFormat: 'markdown',
  completionMode: 'manual',
  completionThreshold: null,
  isRequired: true,
  sortNo: 1,
  videoChapters: [],
  transcript: [],
  rowVersion: 0,
  ...over,
});

function render(value: LessonBlock): HTMLElement {
  const fixture = TestBed.createComponent(TextBlock);
  fixture.componentRef.setInput('block', value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('TextBlock', () => {
  const readImage = vi.fn(() => of(new Blob([], { type: 'image/png' })));

  beforeEach(() => {
    readImage.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: EndpointClient, useValue: { call: readImage } }],
    });
  });

  it('keeps table structure and removes executable or unlinked image content', () => {
    const root = render(
      block({
        bodyFormat: 'html',
        body: '<table><tbody><tr><td colspan="2" onclick="alert(1)">Dữ liệu</td></tr></tbody></table><img data-asset-id="42" src="https://tracker.invalid/pixel"><script>alert(1)</script>',
      }),
    );
    expect(root.querySelector('td')?.getAttribute('colspan')).toBe('2');
    expect(root.querySelector('td')?.hasAttribute('onclick')).toBe(false);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('img')?.hasAttribute('src')).toBe(false);
    expect(readImage).not.toHaveBeenCalled();
  });

  it('steps its headings down under the block title', () => {
    const root = render(block({ body: '## Ý chính' }));
    expect(
      root.querySelector('.markdown')?.classList.contains('markdown--nested'),
    ).toBe(true);
  });

  it('renders the body in the format it was saved in', () => {
    expect(
      render(block({ body: '## Ý chính\n- một' })).querySelector('h3')
        ?.textContent,
    ).toBe('Ý chính');
    expect(
      render(
        block({ body: '<p>Đoạn <em>html</em></p>', bodyFormat: 'html' }),
      ).querySelector('p em')?.textContent,
    ).toBe('html');
    expect(
      render(block({ body: 'a\nb', bodyFormat: 'plain' })).querySelectorAll(
        'br',
      ).length,
    ).toBe(1);
  });

  it('reads a body with no format as markdown', () => {
    expect(
      render(block({ body: '**đậm**', bodyFormat: null })).querySelector(
        'strong',
      )?.textContent,
    ).toBe('đậm');
  });

  it('says so when the block has no text', () => {
    expect(render(block({ body: '  ' })).textContent).toContain(
      'Khối này chưa có nội dung.',
    );
    expect(render(block({ body: null })).textContent).toContain(
      'Khối này chưa có nội dung.',
    );
  });
});
