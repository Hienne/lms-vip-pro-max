import { TestBed } from '@angular/core/testing';
import { LOCAL_STORAGE } from '../storage/local-storage';
import { TokenStore } from './token-store';

const KEY = 'lms.accessToken';

describe('TokenStore', () => {
  it('reads back a saved token until it expires, then removes it', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: 0 });
    try {
      const tokens = TestBed.inject(TokenStore);
      tokens.save('abc', 60);
      expect(tokens.read()).toBe('abc');
      vi.setSystemTime(59_000);
      expect(tokens.read()).toBe('abc');
      vi.setSystemTime(60_000);
      expect(tokens.read()).toBeNull();
      expect(localStorage.getItem(KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['not json', '{"accessToken":1}', '{"expiresAt":1}', 'null', '[]'])(
    'counts the entry %s as no token',
    (entry) => {
      localStorage.setItem(KEY, entry);
      expect(TestBed.inject(TokenStore).read()).toBeNull();
    },
  );

  it('works without storage and when storage throws', () => {
    const failing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [null, failing]) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LOCAL_STORAGE, useValue: storage }],
      });
      const tokens = TestBed.inject(TokenStore);
      expect(() => tokens.save('abc', 60)).not.toThrow();
      expect(tokens.read()).toBeNull();
      expect(() => tokens.clear()).not.toThrow();
    }
  });
});
