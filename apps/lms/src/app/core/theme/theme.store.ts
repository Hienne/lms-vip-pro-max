import { DOCUMENT } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  InjectionToken,
  signal,
  untracked,
} from '@angular/core';

/** What the user chose. Absence of a stored choice means `system`. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** What is actually shown. */
export type EffectiveTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'lms.theme';
const THEME_ATTRIBUTE = 'data-theme';
const SYSTEM_DARK_QUERY_TEXT = '(prefers-color-scheme: dark)';

export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type SystemDarkQuery = Pick<
  MediaQueryList,
  'matches' | 'addEventListener' | 'removeEventListener'
>;

/** Browser storage, or `null` when the browser blocks it (the getter itself can throw). */
export const THEME_STORAGE = new InjectionToken<ThemeStorage | null>(
  'THEME_STORAGE',
  {
    providedIn: 'root',
    factory: () => {
      try {
        return inject(DOCUMENT).defaultView?.localStorage ?? null;
      } catch {
        return null;
      }
    },
  },
);

/** The `prefers-color-scheme: dark` media query, or `null` when `matchMedia` is unavailable. */
export const SYSTEM_DARK_QUERY = new InjectionToken<SystemDarkQuery | null>(
  'SYSTEM_DARK_QUERY',
  {
    providedIn: 'root',
    factory: () =>
      inject(DOCUMENT).defaultView?.matchMedia?.(SYSTEM_DARK_QUERY_TEXT) ??
      null,
  },
);

function readPreference(storage: ThemeStorage | null): ThemePreference {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/**
 * The theme preference of this browser. The only code that writes the theme attribute on the root
 * element: everything else changes look through the tokens in `@lms/ui`'s theme.
 *
 * - `system` follows `prefers-color-scheme` live; the attribute is absent and the tokens' media
 *   query does the work.
 * - `light` / `dark` set the attribute and are remembered per browser under `lms.theme`.
 * - Storage may be blocked: reads and writes never throw.
 * - The inline script in index.html applies the stored choice before the app boots.
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly storage = inject(THEME_STORAGE);
  private readonly systemQuery = inject(SYSTEM_DARK_QUERY);

  private readonly state = {
    preference: signal<ThemePreference>(readPreference(this.storage)),
    systemDark: signal(this.systemQuery?.matches ?? false),
  };

  readonly preference$ = this.state.preference.asReadonly();

  readonly effective$ = computed<EffectiveTheme>(() => {
    const preference = this.preference$();
    if (preference !== 'system') return preference;
    return this.state.systemDark() ? 'dark' : 'light';
  });

  private readonly applyAttribute = effect(() => {
    const preference = this.preference$();
    untracked(() => {
      if (preference === 'system') this.root.removeAttribute(THEME_ATTRIBUTE);
      else this.root.setAttribute(THEME_ATTRIBUTE, preference);
    });
  });

  private readonly persistPreference = effect(() => {
    const preference = this.preference$();
    untracked(() => this.writeStorage(preference));
  });

  private readonly followSystem = effect((onCleanup) => {
    const query = this.systemQuery;
    if (!query) return;
    const onChange = (event: { matches: boolean }) =>
      this.setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    onCleanup(() => query.removeEventListener('change', onChange));
  });

  /** The one command: choose Hệ thống, Sáng or Tối. */
  setPreference(preference: ThemePreference): void {
    this.state.preference.set(preference);
  }

  private setSystemDark(dark: boolean): void {
    this.state.systemDark.set(dark);
  }

  private writeStorage(preference: ThemePreference): void {
    try {
      if (preference === 'system') this.storage?.removeItem(THEME_STORAGE_KEY);
      else this.storage?.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage is blocked or full: the choice still applies for this page view.
    }
  }
}
