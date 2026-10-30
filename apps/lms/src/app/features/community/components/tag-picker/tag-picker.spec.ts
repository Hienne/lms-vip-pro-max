import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { TagView } from '@lms/contracts';
import { TagPicker } from './tag-picker';

const tags = (count: number): TagView[] =>
  Array.from({ length: count }, (_, i) => ({
    tagId: i + 1,
    slug: `t${i + 1}`,
    name: `Thẻ ${i + 1}`,
    status: 'active',
  }));

@Component({
  imports: [TagPicker],
  template: `<app-tag-picker [tags]="tags" [(value)]="value" />`,
})
class Host {
  tags = tags(12);
  readonly value = signal<readonly number[]>([2]);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, host: fixture.componentInstance };
}

describe('TagPicker', () => {
  it('lists every tag as an option and marks the chosen ones', async () => {
    const { el } = await render();
    const options = Array.from(
      el.querySelectorAll<HTMLElement>('[role="option"]'),
    );
    expect(options.length).toBe(12);
    expect(
      options
        .filter((o) => o.getAttribute('aria-selected') === 'true')
        .map((o) => o.textContent?.trim()),
    ).toEqual(['Thẻ 2']);
  });

  it('shows the counter and the hint', async () => {
    const { el } = await render();
    expect(el.querySelector('.tag-picker__count')?.textContent).toContain(
      '1/10',
    );
    expect(el.querySelector('.tag-picker__hint')?.textContent).toContain(
      'Chọn tối đa 10 thẻ',
    );
  });

  it('adds a tag on click and ignores a pick past the limit', async () => {
    const { fixture, el, host } = await render();
    const options = () =>
      Array.from(el.querySelectorAll<HTMLElement>('[role="option"]'));
    options()[0].click();
    await fixture.whenStable();
    expect([...host.value()].sort()).toEqual([1, 2]);

    host.value.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    fixture.detectChanges();
    await fixture.whenStable();
    options()[10].click();
    await fixture.whenStable();
    expect(host.value().length).toBe(10);
    expect(host.value()).not.toContain(11);
  });
});
