import { readFileSync } from 'node:fs';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Stat } from './stat';
import { StatStrip } from './stat-strip';

@Component({
  imports: [StatStrip, Stat],
  template: `
    <ui-stat-strip>
      <ui-stat id="plain" label="Tổng số khóa" [value]="12" />
      <ui-stat
        id="unit"
        label="Tỷ lệ hoàn thành"
        value="78"
        unit="%"
        note="3/4 khóa đã xong"
      />
      <ui-stat id="danger" label="Đang quá hạn" [value]="2" tone="danger" />
      <ui-stat
        id="link"
        label="Được giao"
        [value]="6"
        link="/catalog"
        [queryParams]="{ scope: 'assigned' }"
      >
        <span slot="note">4 bắt buộc</span>
      </ui-stat>
      <ui-stat id="action" label="Hoàn thành" value="—" note="Không tải được">
        <button type="button">Thử lại</button>
      </ui-stat>
    </ui-stat-strip>
  `,
})
class Host {}

@Component({
  imports: [StatStrip, Stat],
  template: `<ui-stat-strip>
    @for (n of cells; track n) {
      <ui-stat [label]="'Chỉ số ' + n" [value]="n" />
    }
  </ui-stat-strip>`,
})
class ManyHost {
  readonly cells = [1, 2, 3, 4, 5, 6, 7, 8];
}

function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    root,
    stat: (id: string) => root.querySelector(`#${id}`) as HTMLElement,
  };
}

describe('StatStrip', () => {
  it('holds its cells in one strip', () => {
    const { root } = render();
    expect(
      root.querySelector('ui-stat-strip')?.classList.contains('stat-strip'),
    ).toBe(true);
    expect(root.querySelectorAll('ui-stat-strip > ui-stat')).toHaveLength(5);
  });

  it('shows the value and the label, with no icon', () => {
    const el = render().stat('plain');
    expect(el.querySelector('.stat__value')?.textContent?.trim()).toBe('12');
    expect(el.querySelector('.stat__label')?.textContent?.trim()).toBe(
      'Tổng số khóa',
    );
    expect(el.querySelector('ui-icon')).toBeNull();
    expect(el.querySelector('a')).toBeNull();
  });

  it('shows the unit after the value and the note input below', () => {
    const el = render().stat('unit');
    expect(el.querySelector('.stat__value small')?.textContent).toBe('%');
    expect(
      el.querySelector('.stat__value')?.textContent?.replace(/\s+/g, ''),
    ).toBe('78%');
    expect(el.querySelector('.stat__note')?.textContent?.trim()).toBe(
      '3/4 khóa đã xong',
    );
  });

  it('colours the value for the danger tone only', () => {
    const { stat } = render();
    expect(stat('danger').querySelector('.stat__value--danger')).not.toBeNull();
    expect(stat('plain').querySelector('.stat__value--danger')).toBeNull();
  });

  it('makes the whole cell one link, with query params, and projects the note slot', () => {
    const el = render().stat('link');
    const links = el.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/catalog?scope=assigned');
    expect(el.querySelector('.stat__note span')?.textContent).toBe(
      '4 bắt buộc',
    );
  });

  it('projects an action as default content of an unlinked stat', () => {
    expect(
      render().stat('action').querySelector('.stat__extra button')?.textContent,
    ).toBe('Thử lại');
  });

  it('holds more than four cells in one strip that wraps into rows of four from md', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ManyHost);
    fixture.detectChanges();
    const strip = fixture.nativeElement.querySelector('ui-stat-strip');
    expect(strip.children).toHaveLength(8);
    // jsdom does not load the stylesheet, so the wrapping rule is read from its source.
    const css = readFileSync('src/styles/components/_stat-strip.scss', 'utf8');
    expect(css).toMatch(/:has\(> :nth-child\(7\)\)/);
    expect(css).toMatch(/repeat\(4, minmax\(0, 1fr\)\)/);
  });
});
