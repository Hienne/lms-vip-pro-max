import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Pagination } from './pagination';

@Component({
  imports: [Pagination],
  template: `<ui-pagination
    [total]="total()"
    [page]="page()"
    [pageSize]="10"
    (pageChange)="changed.push($event)"
  />`,
})
class Host {
  readonly total = signal(25);
  readonly page = signal(1);
  readonly changed: number[] = [];
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const set = (change: (host: Host) => void) => {
    change(fixture.componentInstance);
    fixture.detectChanges();
  };
  const buttons = () =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('nav button'));
  return { root, set, buttons, host: fixture.componentInstance };
}

const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim();

describe('Pagination', () => {
  it('shows the range and one button per page between previous and next', () => {
    const { root, buttons } = render();
    expect(text(root.querySelector('span')!)).toBe('Hiển thị 1–10 / 25');
    expect(
      buttons().map((b) => b.getAttribute('aria-label') ?? text(b)),
    ).toEqual(['Trang trước', '1', '2', '3', 'Trang sau']);
  });

  it('marks the current page and disables previous on the first page', () => {
    const { buttons } = render();
    expect(buttons()[0].disabled).toBe(true);
    expect(buttons()[1].getAttribute('aria-current')).toBe('page');
    expect(buttons()[2].getAttribute('aria-current')).toBeNull();
  });

  it('reads the last range on the last page and disables next', () => {
    const { root, buttons, set } = render();
    set((h) => h.page.set(3));
    expect(text(root.querySelector('span')!)).toBe('Hiển thị 21–25 / 25');
    expect(buttons().at(-1)?.disabled).toBe(true);
  });

  it('treats a page past the end as the last one', () => {
    const { root, set } = render();
    set((h) => h.page.set(9));
    expect(text(root.querySelector('span')!)).toBe('Hiển thị 21–25 / 25');
  });

  it('emits the page asked for', () => {
    const { buttons, host } = render();
    buttons()[2].click();
    buttons()[4].click();
    expect(host.changed).toEqual([2, 2]);
  });

  it('has no page buttons for a single page and 0–0 for no rows', () => {
    const { root, set } = render();
    set((h) => h.total.set(7));
    expect(root.querySelector('nav')).toBeNull();
    set((h) => h.total.set(0));
    expect(text(root.querySelector('span')!)).toBe('Hiển thị 0–0 / 0');
  });
});
