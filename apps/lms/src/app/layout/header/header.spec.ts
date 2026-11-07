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

  async function open(levelName: string | null) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Header);
    fixture.componentRef.setInput('user', seedProfile('000004'));
    fixture.componentRef.setInput('levelName', levelName);
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
});
