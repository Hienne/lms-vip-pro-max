import { TestBed } from '@angular/core/testing';
import type { ProcessStep } from '@lms/contracts';
import { ProcessBlock } from './process-block';

const step = (
  id: number,
  sortNo: number,
  description: string | null,
): ProcessStep => ({
  id,
  blockId: 1,
  title: `Bước ${id}`,
  description,
  sortNo,
  rowVersion: 0,
});

function render(steps: readonly ProcessStep[]): HTMLElement {
  const fixture = TestBed.createComponent(ProcessBlock);
  fixture.componentRef.setInput('steps', steps);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ProcessBlock', () => {
  it('lists the steps by their order with a number, a title and the description', () => {
    const el = render([
      step(3, 3, null),
      step(1, 1, 'Mở hồ sơ'),
      step(2, 2, 'Duyệt'),
    ]);
    const items = Array.from(el.querySelectorAll('li'));
    expect(items.map((li) => li.querySelector('h3')?.textContent)).toEqual([
      'Bước 1',
      'Bước 2',
      'Bước 3',
    ]);
    expect(
      items.map((li) => li.querySelector('.process__number')?.textContent),
    ).toEqual(['1', '2', '3']);
    expect(items[0].querySelector('p')?.textContent).toBe('Mở hồ sơ');
    expect(items[2].querySelector('p')).toBeNull();
  });

  it('is an ordered list', () => {
    expect(render([step(1, 1, null)]).querySelector('ol')).not.toBeNull();
  });

  it('says so when the block has no steps', () => {
    expect(render([]).textContent).toContain('Khối này chưa có bước nào.');
  });
});
