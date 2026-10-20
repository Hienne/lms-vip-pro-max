import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ThemeStore,
  type ThemePalette,
  type ThemePreference,
} from '../../core/theme/theme.store';
import { ThemeControls } from './theme-controls';

class FakeThemeStore {
  readonly palette$ = signal<ThemePalette>('ngoc');
  readonly preference$ = signal<ThemePreference>('dark');
  readonly setPalette = vi.fn((palette: ThemePalette) =>
    this.palette$.set(palette),
  );
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
  const group = (label: string) =>
    root.querySelector<HTMLElement>(`[role="listbox"][aria-label="${label}"]`)!;
  const options = (label: string) =>
    Array.from(group(label).querySelectorAll<HTMLElement>('[role="option"]'));
  const option = (label: string, text: string) =>
    options(label).find((o) => o.textContent?.trim() === text)!;
  const selected = (label: string) =>
    options(label)
      .filter((o) => o.getAttribute('aria-selected') === 'true')
      .map((o) => o.textContent?.trim());
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { store, options, option, selected, settle };
}

describe('ThemeControls', () => {
  it('offers the four palettes with the stored one selected', async () => {
    const { options, selected } = await render();
    expect(options('Bảng màu').map((o) => o.textContent?.trim())).toEqual([
      'BIDV chuẩn',
      'Ngọc',
      'Cobalt',
      'Giấy',
    ]);
    expect(selected('Bảng màu')).toEqual(['Ngọc']);
  });

  it('paints each palette swatch from its constant swatch tokens', async () => {
    const { option } = await render();
    const swatch = option('Bảng màu', 'Cobalt').querySelector<HTMLElement>(
      '.swatch-group__swatch',
    )!;
    expect(swatch.style.getPropertyValue('--swatch-fill')).toBe(
      'var(--color-swatch-cobalt-fill)',
    );
    expect(swatch.style.getPropertyValue('--swatch-base')).toBe(
      'var(--color-swatch-cobalt-base)',
    );
  });

  it('offers Hệ thống, Sáng and Tối with the stored one selected', async () => {
    const { options, selected } = await render();
    expect(options('Chế độ').map((o) => o.textContent?.trim())).toEqual([
      'Hệ thống',
      'Sáng',
      'Tối',
    ]);
    expect(selected('Chế độ')).toEqual(['Tối']);
  });

  it('chooses a palette through the store', async () => {
    const { store, option, selected, settle } = await render();
    option('Bảng màu', 'Giấy').click();
    await settle();
    expect(store.setPalette).toHaveBeenCalledWith('giay');
    expect(selected('Bảng màu')).toEqual(['Giấy']);
  });

  it('chooses a mode through the store', async () => {
    const { store, option, selected, settle } = await render();
    option('Chế độ', 'Hệ thống').click();
    await settle();
    expect(store.setPreference).toHaveBeenCalledWith('system');
    expect(selected('Chế độ')).toEqual(['Hệ thống']);
  });

  it('follows the store when the choice changes elsewhere', async () => {
    const { store, selected, settle } = await render();
    store.palette$.set('bidv');
    store.preference$.set('light');
    await settle();
    expect(selected('Bảng màu')).toEqual(['BIDV chuẩn']);
    expect(selected('Chế độ')).toEqual(['Sáng']);
  });
});
