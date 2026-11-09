import { OverlayContainer } from '@angular/cdk/overlay';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ThemeStore,
  type ThemePreference,
} from '../../../core/theme/theme.store';
import { ThemePicker } from './theme-picker';

class FakeThemeStore {
  readonly preference$ = signal<ThemePreference>('system');
  readonly setPreference = vi.fn((preference: ThemePreference) =>
    this.preference$.set(preference),
  );
}

async function render() {
  const store = new FakeThemeStore();
  TestBed.configureTestingModule({
    providers: [{ provide: ThemeStore, useValue: store }],
  });
  const fixture = TestBed.createComponent(ThemePicker);
  document.body.appendChild(fixture.nativeElement);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();
  const container = TestBed.inject(OverlayContainer).getContainerElement();
  const trigger = (fixture.nativeElement as HTMLElement).querySelector(
    'button',
  ) as HTMLButtonElement;
  const panel = () => container.querySelector<HTMLElement>('[role="dialog"]');
  return { store, trigger, panel, settle };
}

describe('ThemePicker', () => {
  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
    document.body.innerHTML = '';
  });

  it('is a labelled icon button that announces a dialog', async () => {
    const { trigger, panel } = await render();
    expect(trigger.getAttribute('aria-label')).toBe('Chế độ giao diện');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.querySelector('ui-icon')).not.toBeNull();
    expect(panel()).toBeNull();
  });

  it('opens the mode control in a named panel', async () => {
    const { trigger, panel, settle } = await render();
    trigger.click();
    await settle();
    expect(panel()?.getAttribute('aria-label')).toBe('Chế độ giao diện');
    expect(
      Array.from(panel()!.querySelectorAll('[role="listbox"]')).map((g) =>
        g.getAttribute('aria-label'),
      ),
    ).toEqual(['Chế độ']);
  });

  it('applies a choice at once', async () => {
    const { store, trigger, panel, settle } = await render();
    trigger.click();
    await settle();
    const dark = Array.from(
      panel()!.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find((o) => o.textContent?.trim() === 'Tối')!;
    dark.click();
    await settle();
    expect(store.setPreference).toHaveBeenCalledWith('dark');
  });
});
