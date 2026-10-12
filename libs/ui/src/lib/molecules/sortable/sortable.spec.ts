import { CdkDropList } from '@angular/cdk/drag-drop';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { SortableItem, SortableList, type SortableMove } from './sortable';

@Component({
  imports: [SortableList, SortableItem],
  template: `
    <div uiSortableList label="Bài học" (moved)="move($event)">
      @for (lesson of lessons(); track lesson) {
        <ui-sortable-item [label]="lesson">{{ lesson }}</ui-sortable-item>
      }
    </div>
  `,
})
class Host {
  readonly lessons = signal(['Bài 1', 'Bài 2', 'Bài 3']);
  readonly events: SortableMove[] = [];
  move(event: SortableMove) {
    this.events.push(event);
    this.lessons.update((all) => {
      const next = [...all];
      const [item] = next.splice(event.from, 1);
      next.splice(event.to, 0, item);
      return next;
    });
  }
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const rows = () =>
    Array.from(root.querySelectorAll<HTMLElement>('.sort-item'));
  const button = (row: number, name: 'Chuyển lên' | 'Chuyển xuống') =>
    rows()[row].querySelector<HTMLButtonElement>(
      `button[aria-label="${name}"]`,
    ) as HTMLButtonElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const announcer = TestBed.inject(LiveAnnouncer);
  const announce = vi.spyOn(announcer, 'announce');
  return {
    fixture,
    root,
    rows,
    button,
    settle,
    announce,
    host: fixture.componentInstance,
  };
}

const names = (rows: HTMLElement[]) =>
  rows.map((r) => r.querySelector('.sort-item__body')?.textContent?.trim());

describe('Sortable list', () => {
  it('is a named list of items with a decorative drag handle and two move buttons each', async () => {
    const { root, rows } = await render();
    expect(
      root.querySelector('[uiSortableList]')?.getAttribute('aria-label'),
    ).toBe('Bài học');
    expect(names(rows())).toEqual(['Bài 1', 'Bài 2', 'Bài 3']);
    const handle = rows()[0].querySelector('.drag-handle');
    expect(handle?.getAttribute('aria-hidden')).toBe('true');
    expect(rows()[0].querySelectorAll('button')).toHaveLength(2);
  });

  it('disables "Chuyển lên" on the first item and "Chuyển xuống" on the last', async () => {
    const { button } = await render();
    expect(button(0, 'Chuyển lên').disabled).toBe(true);
    expect(button(0, 'Chuyển xuống').disabled).toBe(false);
    expect(button(2, 'Chuyển xuống').disabled).toBe(true);
    expect(button(1, 'Chuyển lên').disabled).toBe(false);
  });

  it('emits { from, to } for a move button and leaves reordering to the caller', async () => {
    const { button, host, settle, rows } = await render();
    button(0, 'Chuyển xuống').click();
    await settle();
    expect(host.events).toEqual([{ from: 0, to: 1 }]);
    expect(names(rows())).toEqual(['Bài 2', 'Bài 1', 'Bài 3']);
  });

  it('does not reorder anything itself when the caller ignores the event', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.move = () => undefined;
    fixture.detectChanges();
    await fixture.whenStable();
    (
      fixture.nativeElement.querySelector(
        'button[aria-label="Chuyển xuống"]',
      ) as HTMLElement
    ).click();
    fixture.detectChanges();
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll('.sort-item__body'),
      ).map((e) => (e as HTMLElement).textContent?.trim()),
    ).toEqual(['Bài 1', 'Bài 2', 'Bài 3']);
  });

  it('keeps focus on the same move button of the moved item', async () => {
    const { button, settle } = await render();
    button(1, 'Chuyển xuống').focus();
    button(1, 'Chuyển xuống').click();
    await settle();
    await settle();
    expect(document.activeElement).toBe(
      button(2, 'Chuyển xuống').disabled
        ? button(2, 'Chuyển lên')
        : button(2, 'Chuyển xuống'),
    );
  });

  it('announces the move with the item name and its new position', async () => {
    const { button, settle, announce } = await render();
    button(0, 'Chuyển xuống').click();
    await settle();
    expect(announce).toHaveBeenCalledWith('Đã chuyển Bài 1 xuống vị trí 2');
    button(1, 'Chuyển lên').click();
    await settle();
    expect(announce).toHaveBeenLastCalledWith('Đã chuyển Bài 1 lên vị trí 1');
  });

  it('emits { from, to } for a drag drop and announces it', async () => {
    const { fixture, host, announce } = await render();
    const drop = fixture.debugElement
      .query(By.directive(CdkDropList))
      .injector.get(CdkDropList);
    drop.dropped.emit({ previousIndex: 0, currentIndex: 2 } as never);
    expect(host.events).toEqual([{ from: 0, to: 2 }]);
    expect(announce).toHaveBeenCalledWith('Đã chuyển Bài 1 xuống vị trí 3');
  });

  it('ignores a drop in the same place', async () => {
    const { fixture, host } = await render();
    const drop = fixture.debugElement
      .query(By.directive(CdkDropList))
      .injector.get(CdkDropList);
    drop.dropped.emit({ previousIndex: 1, currentIndex: 1 } as never);
    expect(host.events).toEqual([]);
  });
});
