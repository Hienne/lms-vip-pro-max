import { TestBed } from '@angular/core/testing';
import type { LessonBlock } from '@lms/contracts';
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
