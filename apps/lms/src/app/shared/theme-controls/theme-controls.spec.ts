import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeStore, type ThemePreference } from '../../core/theme/theme.store';
import { ThemeControls } from './theme-controls';

class FakeThemeStore {
  readonly preference$ = signal<ThemePreference>('dark');
  readonly setPreference = vi.fn((preference: ThemePreference) =>
    this.preference$.set(preference),
  );
}

async function render() {
  const store = new FakeThemeStore();
  TestBed.configureTestingModule({
    providers: [{ provide: ThemeStore, useValue: store }],
  });
  const fixture = TestBed.createComponent(ThemeControls);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const options = () =>
    Array.from(
      root.querySelectorAll<HTMLElement>(
        '[role="listbox"][aria-label="Chế độ"] [role="option"]',
      ),
    );
  const selected = () =>
    options()
      .filter((o) => o.getAttribute('aria-selected') === 'true')
      .map((o) => o.textContent?.trim());
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { store, options, selected, settle };
}

describe('ThemeControls', () => {
  it('offers Hệ thống, Sáng and Tối with the stored one selected', async () => {
    const { options, selected } = await render();
    expect(options().map((o) => o.textContent?.trim())).toEqual([
      'Hệ thống',
      'Sáng',
      'Tối',
    ]);
    expect(selected()).toEqual(['Tối']);
  });

  it('chooses a mode through the store', async () => {
    const { store, options, selected, settle } = await render();
    options()
      .find((o) => o.textContent?.trim() === 'Hệ thống')!
      .click();
    await settle();
    expect(store.setPreference).toHaveBeenCalledWith('system');
    expect(selected()).toEqual(['Hệ thống']);
  });

  it('follows the store when the choice changes elsewhere', async () => {
    const { store, selected, settle } = await render();
    store.preference$.set('light');
    await settle();
    expect(selected()).toEqual(['Sáng']);
  });
});
