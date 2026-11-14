import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { seedProfile } from '../../core/session/session.testing';
import { Header } from './header';

describe('Header user menu', () => {
  afterEach(() =>
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = '')),
  );

  async function open(levelName: string | null, guideAvailable = false) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Header);
    fixture.componentRef.setInput('user', seedProfile('000004'));
    fixture.componentRef.setInput('levelName', levelName);
    fixture.componentRef.setInput('guideAvailable', guideAvailable);
    fixture.detectChanges();
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector(
      'ui-menu button',
    ) as HTMLButtonElement;
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
});
