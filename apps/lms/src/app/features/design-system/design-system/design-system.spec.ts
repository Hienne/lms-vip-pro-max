import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { createAppRoutes } from '../../../app.routes';
import { provideAppConfig } from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { DESIGN_SYSTEM_SECTIONS } from '../data-access/design-system-sections';

const LIGHT_TOKENS: Record<string, string> = {
  '--color-text': '#1a1d1c',
  '--color-text-secondary': '#4a5553',
  '--color-text-muted': '#5f6b69',
  '--color-surface': '#ffffff',
  '--color-bg': '#f5f8f8',
  '--color-primary': '#006b68',
  '--color-on-primary': '#ffffff',
  '--color-accent-ink': '#8a5a00',
  '--color-accent-subtle': '#fff6dc',
  '--color-success': '#1b7a43',
  '--color-success-subtle': '#e8f5ec',
  '--color-warning': '#b45309',
  '--color-warning-subtle': '#fef3e2',
  '--color-danger': '#c2362f',
  '--color-danger-subtle': '#fdecea',
  '--color-info': '#2563a6',
  '--color-info-subtle': '#e8f0f9',
  '--color-border-strong': '#8a9694',
};

async function openDesignSystem(devTools = true) {
  TestBed.configureTestingModule({
    providers: [
      provideAppConfig(testAppConfig({ devTools })),
      provideRouter(createAppRoutes({ devTools })),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/design-system');
  TestBed.tick();
  await harness.fixture.whenStable();
  return {
    page: harness.routeNativeElement as HTMLElement,
    router: TestBed.inject(Router),
  };
}

describe('/design-system', () => {
  beforeEach(() => {
    for (const [token, value] of Object.entries(LIGHT_TOKENS)) {
      document.documentElement.style.setProperty(token, value);
    }
  });

  afterEach(() => {
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('lms.theme');
  });

  it('opens publicly with a table of contents linking to every section', async () => {
    const { page } = await openDesignSystem();
    const links = Array.from(
      page.querySelectorAll('nav[aria-label="Mục lục Design System"] a'),
    );
    expect(
      links.map((link) => link.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(DESIGN_SYSTEM_SECTIONS.map((s) => `${s.number} ${s.tocLabel}`));
  });

  it('renders all thirteen sections in order, each with its heading', async () => {
    const { page } = await openDesignSystem();
    const sections = Array.from(
      page.querySelectorAll('main section[id^="ds-"]'),
    );
    expect(sections.map((section) => section.id)).toEqual(
      DESIGN_SYSTEM_SECTIONS.map((s) => `ds-${s.id}`),
    );
    for (const section of DESIGN_SYSTEM_SECTIONS) {
      expect(page.querySelector(`#h-${section.id}`)?.tagName).toBe('H2');
    }
  });

  describe('theme switch', () => {
    const option = (page: HTMLElement, label: string) =>
      Array.from(
        page.querySelectorAll<HTMLElement>('nav [role="option"]'),
      ).find((o) => o.textContent?.trim() === label) as HTMLElement;

    it('offers Hệ thống, Sáng and Tối as one group with the current choice selected', async () => {
      const { page } = await openDesignSystem();
      const group = page.querySelector('nav [role="listbox"]');
      expect(group?.getAttribute('aria-label')).toBe('Giao diện');
      const options = Array.from(page.querySelectorAll('nav [role="option"]'));
      expect(options.map((o) => o.textContent?.trim())).toEqual([
        'Hệ thống',
        'Sáng',
        'Tối',
      ]);
      expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual([
        'true',
        'false',
        'false',
      ]);
    });

    it('changes the theme attribute on the root element and remembers the choice', async () => {
      const { page } = await openDesignSystem();
      option(page, 'Tối').click();
      TestBed.tick();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem('lms.theme')).toBe('dark');

      option(page, 'Sáng').click();
      TestBed.tick();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      option(page, 'Hệ thống').click();
      TestBed.tick();
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
      expect(localStorage.getItem('lms.theme')).toBeNull();
    });

    it('recomputes the contrast table after the theme changes', async () => {
      const { page } = await openDesignSystem();
      const ratio = () =>
        page.querySelector('#ds-color tbody tr [data-ratio]')?.textContent;
      expect(ratio()).toBe('16.98:1');

      option(page, 'Tối').click();
      // The tokens take their dark values with the attribute; here the stylesheet is simulated.
      document.documentElement.style.setProperty('--color-text', '#e7eeed');
      document.documentElement.style.setProperty('--color-surface', '#151e1d');
      TestBed.tick();
      await TestBed.inject(ApplicationRef).whenStable();
      expect(ratio()).not.toBe('16.98:1');
      expect(Number.parseFloat(ratio() ?? '0')).toBeGreaterThan(12);
    });
  });

  describe('buttons section', () => {
    it('shows the variant × state table and the icon-button row, no placeholder left', async () => {
      const { page } = await openDesignSystem();
      const section = page.querySelector('#ds-buttons') as HTMLElement;
      expect(section.querySelector('[data-placeholder]')).toBeNull();
      const rows = Array.from(section.querySelectorAll('tbody tr'));
      expect(
        rows.map((r) => r.querySelector('th')?.textContent?.trim()),
      ).toEqual(['primary', 'secondary', 'ghost', 'danger', 'danger-ghost']);
      const cells = rows[0].querySelectorAll('td button');
      expect(cells).toHaveLength(5);
      expect(cells[3].hasAttribute('disabled')).toBe(true);
      expect(cells[4].getAttribute('aria-busy')).toBe('true');
      const icons = Array.from(section.querySelectorAll('button.icon-btn'));
      expect(icons.map((b) => b.getAttribute('aria-label'))).toEqual([
        'Sửa',
        'Xóa',
        'Thông báo',
      ]);
    });
  });

  describe('navigation section', () => {
    it('demos the segmented control', async () => {
      const { page } = await openDesignSystem();
      const demo = page.querySelector('#ds-nav [role="listbox"]');
      expect(demo?.getAttribute('aria-label')).toBe('Kỳ');
      const selected = demo?.querySelector('[aria-selected="true"]');
      expect(selected?.textContent?.trim()).toBe('Tháng');
    });
  });

  describe('brand', () => {
    it('shows the flower mark in the table of contents and the hero header', async () => {
      const { page } = await openDesignSystem();
      expect(
        page.querySelector('nav ui-mai')?.getAttribute('aria-hidden'),
      ).toBe('true');
      const hero = page.querySelector('app-hero') as HTMLElement;
      expect(hero.querySelector('h1')?.textContent).toContain(
        'Flat, rõ ràng, đáng tin cậy — và dễ chuyển thành code.',
      );
      expect(hero.textContent).toContain(
        'Core Banking Academy · Design System v2',
      );
      expect(hero.querySelectorAll('li')).toHaveLength(5);
      expect(hero.querySelector('[aria-hidden="true"] ui-mai')).not.toBeNull();
    });
  });

  describe('learning section', () => {
    it('demos the reward badges and keeps the unbuilt demos as placeholders', async () => {
      const { page } = await openDesignSystem();
      const section = page.querySelector('#ds-learning') as HTMLElement;
      const badges = Array.from(section.querySelectorAll('ui-mai-badge'));
      expect(badges).toHaveLength(4);
      expect(
        badges.map((b) => b.textContent?.includes('Chưa mở khóa')),
      ).toEqual([false, false, true, true]);
      expect(
        section.querySelectorAll('[data-placeholder]').length,
      ).toBeGreaterThan(0);
    });
  });

  describe('principles section', () => {
    it('shows the six principles and the v1 → v2 change log', async () => {
      const { page } = await openDesignSystem();
      const section = page.querySelector('#ds-principles') as HTMLElement;
      expect(section.querySelector('#h-principles')?.textContent).toContain(
        'Nguyên tắc & những gì đã sửa từ v1',
      );
      expect(section.querySelectorAll('ul > li')).toHaveLength(6);
      expect(section.textContent).toContain('Một hành động chính');
      expect(section.querySelectorAll('tbody tr')).toHaveLength(8);
      expect(section.textContent).toContain('Success trùng Primary');
    });
  });

  describe('typography section', () => {
    it('shows the type scale from display to caption plus tabular numbers', async () => {
      const { page } = await openDesignSystem();
      const section = page.querySelector('#ds-type') as HTMLElement;
      const labels = Array.from(
        section.querySelectorAll('.sample > span:first-child'),
      ).map((label) => label.textContent);
      expect(labels).toEqual([
        'Display · 36/700',
        'H1 · 28/700',
        'H2 · 22/600',
        'H3 · 18/600',
        'Body · 16/400 · lh 1.5',
        'Small · 14/500',
        'Caption · 12/600',
        'Số liệu · tabular',
      ]);
      expect(section.querySelector('.text-3xl')?.textContent).toContain(
        'Chào mừng bạn gia nhập Ban!',
      );
    });
  });

  describe('spacing, radius, shadow and motion section', () => {
    it('shows the scales and replays the motion samples on demand', async () => {
      const { page } = await openDesignSystem();
      const section = page.querySelector('#ds-space') as HTMLElement;
      expect(section.querySelectorAll('.step')).toHaveLength(7);
      expect(section.textContent).toContain('--spacing-12');
      expect(section.querySelectorAll('.swatch')).toHaveLength(4);
      expect(section.querySelectorAll('.shadow-sample')).toHaveLength(3);

      const before = section.querySelector('[data-motion] > *');
      section.querySelector<HTMLButtonElement>('button.replay')?.click();
      TestBed.tick();
      expect(section.querySelector('[data-motion] > *')).not.toBe(before);
    });
  });

  describe('colour section', () => {
    it('shows a swatch with name, token, live value and purpose', async () => {
      const { page } = await openDesignSystem();
      const swatch = page.querySelector('#ds-color li');
      expect(swatch?.textContent).toContain('Primary');
      expect(swatch?.textContent).toContain('--color-primary');
      expect(swatch?.textContent).toContain('#006B68');
      expect(swatch?.textContent).toContain(
        'CTA, link, trạng thái active, tiến độ',
      );
    });

    it('computes the contrast table from the live token values', async () => {
      const { page } = await openDesignSystem();
      const rows = Array.from(page.querySelectorAll('#ds-color tbody tr'));
      expect(rows).toHaveLength(12);
      expect(rows[0].querySelector('[data-ratio]')?.textContent).toBe(
        '16.98:1',
      );
      expect(rows[0].querySelector('[data-grade]')?.textContent?.trim()).toBe(
        'AAA',
      );
      expect(rows[11].querySelector('[data-ratio]')?.textContent).toBe(
        '3.06:1',
      );
      expect(rows[11].querySelector('[data-grade]')?.textContent?.trim()).toBe(
        'Đạt 3:1 (UI)',
      );
    });
  });

  describe('migration placeholders', () => {
    it('shows "Chưa migrate" for a demo whose entries are not done', async () => {
      const { page } = await openDesignSystem();
      const placeholder = page.querySelector('#ds-forms [data-placeholder]');
      expect(placeholder?.textContent).toContain('Chưa migrate');
      expect(placeholder?.textContent).toContain('field');
    });

    it('shows the status only in production', async () => {
      const { page } = await openDesignSystem(false);
      const text = page.querySelector(
        '#ds-forms [data-placeholder]',
      )?.textContent;
      expect(text).toContain('Chưa làm');
      expect(text).not.toContain('@');
      expect(text).not.toContain('Pull request');
    });
  });

  describe('navigation', () => {
    it('moves focus to the section heading when its table of contents link is used', async () => {
      const { page } = await openDesignSystem();
      page
        .querySelector<HTMLAnchorElement>('nav a[href$="#ds-color"]')
        ?.click();
      expect(document.activeElement?.id).toBe('h-color');
    });

    it('reaches every section: its link moves focus to the heading', async () => {
      const { page } = await openDesignSystem();
      for (const { id } of DESIGN_SYSTEM_SECTIONS) {
        page
          .querySelector<HTMLAnchorElement>(`nav a[href$="#ds-${id}"]`)
          ?.click();
        expect(document.activeElement?.id).toBe(`h-${id}`);
      }
    });

    it('offers a skip link that lands on the main content', async () => {
      const { page } = await openDesignSystem();
      page.querySelector<HTMLAnchorElement>('a.skip-link')?.click();
      expect(document.activeElement?.id).toBe('ds-main');
    });
  });
});

describe('progress board route', () => {
  async function open(devTools: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(testAppConfig({ devTools })),
        provideRouter(createAppRoutes({ devTools })),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dev/migration').catch(() => undefined);
    await harness.fixture.whenStable();
    return harness;
  }

  it('is present when devTools is true', async () => {
    const harness = await open(true);
    const board = harness.routeNativeElement as HTMLElement;
    expect(board.querySelector('h1')?.textContent).toContain('Tiến độ migrate');
    expect(board.querySelector('[data-summary]')?.textContent).toContain('mục');
    expect(board.querySelector('[data-entry="button"]')).not.toBeNull();
  });

  it('is absent when devTools is false', async () => {
    const harness = await open(false);
    expect(TestBed.inject(Router).url).not.toBe('/dev/migration');
    expect(
      (harness.routeNativeElement as HTMLElement | null)?.querySelector(
        '[data-summary]',
      ) ?? null,
    ).toBeNull();
  });
});
