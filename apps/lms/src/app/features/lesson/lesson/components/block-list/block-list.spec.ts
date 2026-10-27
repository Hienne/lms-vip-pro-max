import { TestBed } from '@angular/core/testing';
import type { BlockDetail } from '@lms/contracts';
import type { BlockView } from '../../data-access/lesson.store';
import { BlockList } from './block-list';

const view = (
  id: number,
  status: BlockView['status'],
  percent: number,
  blockType: BlockDetail['block']['blockType'] = 'text',
): BlockView => ({
  id,
  title: `Khối ${id}`,
  status,
  percent,
  detail: {
    block: { blockType },
    assets: [],
    steps: [],
  } as unknown as BlockDetail,
});

function render(activeId: number) {
  const fixture = TestBed.createComponent(BlockList);
  fixture.componentRef.setInput('blocks', [
    view(1, 'completed', 100, 'video'),
    view(2, 'in_progress', 40, 'pdf'),
    view(3, 'not_started', 0),
  ]);
  fixture.componentRef.setInput('activeId', activeId);
  fixture.detectChanges();
  const picked: number[] = [];
  fixture.componentInstance.selected.subscribe((id) => picked.push(id));
  return { el: fixture.nativeElement as HTMLElement, picked };
}

describe('BlockList', () => {
  it('lists every block with its kind and state, and marks the active one', () => {
    const { el } = render(2);
    const items = Array.from(el.querySelectorAll('button'));
    expect(
      items.map((b) => b.querySelector('.blocks__title')?.textContent),
    ).toEqual(['Khối 1', 'Khối 2', 'Khối 3']);
    expect(items[0].textContent).toContain('Video');
    expect(items[0].textContent).toContain('Đã hoàn thành');
    expect(items[1].textContent).toContain('Tài liệu PDF');
    expect(items[1].textContent).toContain('40%');
    expect(items[2].querySelector('.blocks__state')?.textContent?.trim()).toBe(
      '',
    );
    expect(items.map((b) => b.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
    ]);
  });

  it('emits the chosen block, and is reachable and operable by keyboard as buttons', () => {
    const { el, picked } = render(1);
    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons.every((b) => b.tabIndex === 0)).toBe(true);
    buttons[2].click();
    expect(picked).toEqual([3]);
  });
});
