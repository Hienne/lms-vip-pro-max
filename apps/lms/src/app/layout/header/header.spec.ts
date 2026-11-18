import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { parseAppConfig, provideAppConfig } from '../../core/config/app-config';
import { testAppConfig } from '../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../core/http/http.testing';
import { SessionStore } from '../../core/session/session.store';
import {
  FakeSessionStore,
  seedProfile,
} from '../../core/session/session.testing';
import { Header } from './header';

/** What the header's own children read: the Trợ lý ngoài button asks the server nothing here. */
const HEADER_PROVIDERS = [
  provideRouter([]),
  provideAppConfig(parseAppConfig(testAppConfig())),
  provideEnvelopeHttpClient(),
  { provide: SessionStore, useClass: FakeSessionStore },
];

describe('Header user menu', () => {
  afterEach(() =>
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = '')),
  );

  async function open(levelName: string | null, guideAvailable = false) {
    TestBed.configureTestingModule({ providers: HEADER_PROVIDERS });
    const fixture = TestBed.createComponent(Header);
    fixture.componentRef.setInput('user', seedProfile('000004'));
    fixture.componentRef.setInput('levelName', levelName);
    fixture.componentRef.setInput('guideAvailable', guideAvailable);
    fixture.detectChanges();
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector(
      'ui-menu button',
    ) as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return document.querySelector('.cdk-overlay-container')?.textContent ?? '';
  }

  it('shows the learner level name with no XP number', async () => {
    const menu = await open('Chuyên viên');
    expect(menu).toContain('Cấp độ: Chuyên viên');
    expect(menu).not.toMatch(/\bXP\b/);
  });

  it('shows no level line for someone without a level', async () => {
    const menu = await open(null);
    expect(menu).not.toContain('Cấp độ');
    expect(menu).toContain('Hồ sơ cá nhân');
  });

  it('shows the guide entry only when the shell offers a permitted guide', async () => {
    expect(await open(null, true)).toContain('Hướng dẫn sử dụng');
  });

  it('omits the guide entry when no guide is available', async () => {
    expect(await open(null)).not.toContain('Hướng dẫn sử dụng');
  });

  it('opens a full search field on mobile, emits the query and closes the popover', async () => {
    TestBed.configureTestingModule({
      providers: [
        ...HEADER_PROVIDERS,
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: true, breakpoints: {} }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(Header);
    const searched = vi.fn();
    fixture.componentInstance.searched.subscribe(searched);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#gsearch')).toBeNull();
    const trigger = fixture.nativeElement.querySelector(
      'button[aria-label="Mở tìm kiếm"]',
    ) as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const field = document.querySelector<HTMLInputElement>('#mobile-gsearch')!;
    expect(field).not.toBeNull();
    field.value = 'CIF';
    field.dispatchEvent(new Event('input'));
    field
      .closest('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(searched).toHaveBeenCalledWith('CIF');
    expect(document.querySelector('#mobile-gsearch')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
