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
  it('says where the active block sits and lists every block with its kind and state', () => {
    const { el } = render(2);
    expect(el.querySelector('label')?.textContent?.trim()).toBe('Khối 2/3');
    const select = el.querySelector('select')!;
    expect(select.id).toBe(el.querySelector('label')!.getAttribute('for'));
    const options = Array.from(select.options).map((o) =>
      o.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(options).toEqual([
      'Khối 1 · Video · Đã hoàn thành',
      'Khối 2 · Tài liệu PDF · 40%',
      'Khối 3 · Bài đọc',
    ]);
    expect(select.selectedIndex).toBe(1);
  });

  it('emits the chosen block, and nothing for the block already on screen', () => {
    const { el, picked } = render(1);
    const select = el.querySelector('select')!;
    select.value = '3';
    select.dispatchEvent(new Event('change'));
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    expect(picked).toEqual([3]);
  });
});
