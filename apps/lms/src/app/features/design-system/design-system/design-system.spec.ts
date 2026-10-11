import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appRoutes } from '../../../app.routes';
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

describe('/design-system', () => {
  let page: HTMLElement;

  beforeEach(async () => {
    for (const [token, value] of Object.entries(LIGHT_TOKENS)) {
      document.documentElement.style.setProperty(token, value);
    }
    TestBed.configureTestingModule({ providers: [provideRouter(appRoutes)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/design-system');
    page = harness.routeNativeElement as HTMLElement;
    TestBed.tick();
    await harness.fixture.whenStable();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('opens publicly with a table of contents linking to every section', () => {
    const links = Array.from(
      page.querySelectorAll('nav[aria-label="Mục lục Design System"] a'),
    );
    expect(
      links.map((link) => link.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(DESIGN_SYSTEM_SECTIONS.map((s) => `${s.number} ${s.tocLabel}`));
  });

  it('shows a swatch with name, token, live value and purpose', () => {
    const swatch = page.querySelector('#ds-color li');
    expect(swatch?.textContent).toContain('Primary');
    expect(swatch?.textContent).toContain('--color-primary');
    expect(swatch?.textContent).toContain('#006B68');
    expect(swatch?.textContent).toContain(
      'CTA, link, trạng thái active, tiến độ',
    );
  });

  it('computes the contrast table from the live token values', () => {
    const rows = Array.from(page.querySelectorAll('#ds-color tbody tr'));
    expect(rows).toHaveLength(12);
    const first = rows[0];
    expect(first.querySelector('[data-ratio]')?.textContent).toBe('16.98:1');
    expect(first.querySelector('[data-grade]')?.textContent?.trim()).toBe(
      'AAA',
    );
    const border = rows[11];
    expect(border.querySelector('[data-ratio]')?.textContent).toBe('3.06:1');
    expect(border.querySelector('[data-grade]')?.textContent?.trim()).toBe(
      'Đạt 3:1 (UI)',
    );
  });

  it('moves focus to the section heading when its table of contents link is used', () => {
    const link = page.querySelector<HTMLAnchorElement>(
      'nav a[href$="#ds-color"]',
    );
    link?.click();
    expect(document.activeElement?.id).toBe('h-color');
  });

  it('offers a skip link that lands on the main content', () => {
    page.querySelector<HTMLAnchorElement>('a.skip-link')?.click();
    expect(document.activeElement?.id).toBe('ds-main');
  });
});
