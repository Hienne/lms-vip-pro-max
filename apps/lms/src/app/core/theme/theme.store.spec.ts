import { TestBed } from '@angular/core/testing';
import {
  PALETTE_STORAGE_KEY,
  SYSTEM_DARK_QUERY,
  THEME_STORAGE,
  THEME_STORAGE_KEY,
  ThemeStore,
  type SystemDarkQuery,
  type ThemeStorage,
} from './theme.store';

class FakeStorage implements ThemeStorage {
  readonly items = new Map<string, string>();
  getItem = (key: string) => this.items.get(key) ?? null;
  setItem = (key: string, value: string) => void this.items.set(key, value);
  removeItem = (key: string) => void this.items.delete(key);
}

/** A storage that throws on every access, like a browser with site data blocked. */
const blockedStorage: ThemeStorage = {
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
  removeItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
};

class FakeMediaQuery implements SystemDarkQuery {
  private readonly listeners = new Set<(event: { matches: boolean }) => void>();
  constructor(public matches: boolean) {}
  addEventListener(
    _type: 'change',
    listener: (event: { matches: boolean }) => void,
  ) {
    this.listeners.add(listener);
  }
  removeEventListener(
    _type: 'change',
    listener: (event: { matches: boolean }) => void,
  ) {
    this.listeners.delete(listener);
  }
  /** The operating system switches theme. */
  switchTo(dark: boolean) {
    this.matches = dark;
    this.listeners.forEach((listener) => listener({ matches: dark }));
  }
  get listenerCount() {
    return this.listeners.size;
  }
}

function setup(
  options: {
    storage?: ThemeStorage | null;
    systemDark?: boolean;
  } = {},
) {
  const storage =
    options.storage === undefined ? new FakeStorage() : options.storage;
  const media = new FakeMediaQuery(options.systemDark ?? false);
  TestBed.configureTestingModule({
    providers: [
      { provide: THEME_STORAGE, useValue: storage },
      { provide: SYSTEM_DARK_QUERY, useValue: media },
    ],
  });
  const store = TestBed.inject(ThemeStore);
  TestBed.tick();
  return { store, storage, media };
}

const rootTheme = () => document.documentElement.getAttribute('data-theme');
const rootPalette = () => document.documentElement.getAttribute('data-palette');

describe('ThemeStore', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-palette');
  });

  it('defaults to system, with no theme attribute', () => {
    const { store, storage } = setup();
    expect(store.preference$()).toBe('system');
    expect(store.effective$()).toBe('light');
    expect(rootTheme()).toBeNull();
    expect((storage as FakeStorage).items.has(THEME_STORAGE_KEY)).toBe(false);
  });

  it.each([
    [false, 'light'],
    [true, 'dark'],
  ] as const)(
    'shows the system theme in system mode (system dark: %s)',
    (systemDark, expected) => {
      const { store } = setup({ systemDark });
      expect(store.effective$()).toBe(expected);
    },
  );

  it.each(['light', 'dark'] as const)(
    'applies and remembers an explicit %s choice',
    (choice) => {
      const { store, storage } = setup({ systemDark: choice === 'light' });
      store.setPreference(choice);
      TestBed.tick();
      expect(store.preference$()).toBe(choice);
      expect(store.effective$()).toBe(choice);
      expect(rootTheme()).toBe(choice);
      expect((storage as FakeStorage).items.get(THEME_STORAGE_KEY)).toBe(
        choice,
      );
    },
  );

  it.each(['light', 'dark'] as const)(
    'restores a stored %s choice',
    (choice) => {
      const storage = new FakeStorage();
      storage.setItem(THEME_STORAGE_KEY, choice);
      const { store } = setup({ storage });
      expect(store.preference$()).toBe(choice);
      expect(rootTheme()).toBe(choice);
    },
  );

  it('treats an unknown stored value as system', () => {
    const storage = new FakeStorage();
    storage.setItem(THEME_STORAGE_KEY, 'sepia');
    const { store } = setup({ storage });
    expect(store.preference$()).toBe('system');
  });

  it('returns to following the system after a fixed choice', () => {
    const { store, storage } = setup({ systemDark: true });
    store.setPreference('light');
    TestBed.tick();
    expect(store.effective$()).toBe('light');

    store.setPreference('system');
    TestBed.tick();
    expect(store.effective$()).toBe('dark');
    expect(rootTheme()).toBeNull();
    expect((storage as FakeStorage).items.has(THEME_STORAGE_KEY)).toBe(false);
  });

  describe('system mode', () => {
    it('follows the operating system live', () => {
      const { store, media } = setup({ systemDark: false });
      media.switchTo(true);
      expect(store.effective$()).toBe('dark');
      media.switchTo(false);
      expect(store.effective$()).toBe('light');
    });

    it('ignores the operating system once the user chose a theme', () => {
      const { store, media } = setup({ systemDark: false });
      store.setPreference('light');
      media.switchTo(true);
      expect(store.effective$()).toBe('light');
    });

    it('stops listening when the store is destroyed', () => {
      const { media } = setup();
      expect(media.listenerCount).toBe(1);
      TestBed.resetTestingModule();
      expect(media.listenerCount).toBe(0);
    });
  });

  describe('storage', () => {
    it('does not throw when the browser blocks it', () => {
      expect(() => {
        const { store } = setup({ storage: blockedStorage });
        store.setPreference('dark');
        TestBed.tick();
        expect(store.effective$()).toBe('dark');
        expect(rootTheme()).toBe('dark');
      }).not.toThrow();
    });

    it('works without any storage', () => {
      const { store } = setup({ storage: null });
      store.setPreference('light');
      TestBed.tick();
      expect(rootTheme()).toBe('light');
    });
  });
  describe('palette', () => {
    it('defaults to BIDV chuẩn, with no palette attribute', () => {
      const { store, storage } = setup();
      expect(store.palette$()).toBe('bidv');
      expect(rootPalette()).toBeNull();
      expect((storage as FakeStorage).items.has(PALETTE_STORAGE_KEY)).toBe(
        false,
      );
    });

    it.each(['ngoc', 'cobalt', 'giay'] as const)(
      'applies and remembers %s',
      (palette) => {
        const { store, storage } = setup();
        store.setPalette(palette);
        TestBed.tick();
        expect(store.palette$()).toBe(palette);
        expect(rootPalette()).toBe(palette);
        expect((storage as FakeStorage).items.get(PALETTE_STORAGE_KEY)).toBe(
          palette,
        );
      },
    );

    it('restores a stored palette', () => {
      const storage = new FakeStorage();
      storage.setItem(PALETTE_STORAGE_KEY, 'giay');
      const { store } = setup({ storage });
      expect(store.palette$()).toBe('giay');
      expect(rootPalette()).toBe('giay');
    });

    it.each(['bidv-soft', 'blue', 'sand'])(
      'treats a revision 1 palette id (%s) as BIDV chuẩn',
      (old) => {
        const storage = new FakeStorage();
        storage.setItem(PALETTE_STORAGE_KEY, old);
        const { store } = setup({ storage });
        expect(store.palette$()).toBe('bidv');
        expect(rootPalette()).toBeNull();
      },
    );

    it('treats an unknown stored palette as BIDV chuẩn', () => {
      const storage = new FakeStorage();
      storage.setItem(PALETTE_STORAGE_KEY, 'neon');
      const { store } = setup({ storage });
      expect(store.palette$()).toBe('bidv');
      expect(rootPalette()).toBeNull();
    });

    it('removes the attribute and the stored value when going back to BIDV chuẩn', () => {
      const { store, storage } = setup();
      store.setPalette('cobalt');
      TestBed.tick();
      store.setPalette('bidv');
      TestBed.tick();
      expect(rootPalette()).toBeNull();
      expect((storage as FakeStorage).items.has(PALETTE_STORAGE_KEY)).toBe(
        false,
      );
    });

    it('is independent of the light/dark choice', () => {
      const { store, storage } = setup();
      store.setPreference('dark');
      store.setPalette('giay');
      TestBed.tick();
      store.setPreference('system');
      TestBed.tick();
      expect(store.palette$()).toBe('giay');
      expect(rootPalette()).toBe('giay');
      expect(rootTheme()).toBeNull();
      expect((storage as FakeStorage).items.get(PALETTE_STORAGE_KEY)).toBe(
        'giay',
      );
    });

    it('does not throw when the browser blocks storage', () => {
      expect(() => {
        const { store } = setup({ storage: blockedStorage });
        expect(store.palette$()).toBe('bidv');
        store.setPalette('cobalt');
        TestBed.tick();
        expect(rootPalette()).toBe('cobalt');
      }).not.toThrow();
    });
  });
});
