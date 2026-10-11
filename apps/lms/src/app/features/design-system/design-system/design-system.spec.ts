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
      const placeholder = page.querySelector('#ds-buttons [data-placeholder]');
      expect(placeholder?.textContent).toContain('Chưa migrate');
      expect(placeholder?.textContent).toContain('button');
    });

    it('shows the status only in production', async () => {
      const { page } = await openDesignSystem(false);
      const text = page.querySelector(
        '#ds-buttons [data-placeholder]',
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
