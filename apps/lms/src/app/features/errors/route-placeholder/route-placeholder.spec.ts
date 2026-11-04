import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { SessionStore } from '../../../core/session/session.store';
import { RoutePlaceholder } from './route-placeholder';

async function open(devTools: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideAppConfig(parseAppConfig(testAppConfig({ devTools }))),
      provideRouter([
        {
          path: 'knowledge',
          title: 'Kho tri thức',
          data: { mockupPage: 'knowledge' },
          component: RoutePlaceholder,
        },
      ]),
      { provide: SessionStore, useValue: { homePath$: signal('/courses') } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/knowledge');
  return harness.routeNativeElement as HTMLElement;
}

describe('RoutePlaceholder (coming-soon page)', () => {
  it('names the function, says it is coming and leads home', async () => {
    const page = await open(false);

    expect(page.querySelector('h2')?.textContent?.trim()).toBe('Kho tri thức');
    expect(page.textContent).toContain(
      'Chức năng này đang được hoàn thiện và sẽ có trong bản cập nhật tới.',
    );
    const home = page.querySelector<HTMLAnchorElement>('a[uiButton]');
    expect(home?.textContent?.trim()).toBe('Về trang chủ');
    expect(home?.getAttribute('href')).toBe('/courses');
    expect(page.querySelector('ui-icon, svg')).toBeNull();
  });

  it('never talks about the mockup, Angular or migration to a production user', async () => {
    const page = await open(false);

    expect(page.textContent).not.toMatch(/mockup|angular|migrat/i);
    expect(page.querySelector('a[href="/dev/migration"]')).toBeNull();
  });

  it('keeps the link to the migration board with dev tools', async () => {
    const page = await open(true);

    expect(
      page.querySelector('a[href="/dev/migration"]')?.textContent,
    ).toContain('Xem tiến độ migrate');
    expect(page.textContent).not.toMatch(/mockup|angular/i);
  });
});
