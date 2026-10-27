import { TestBed } from '@angular/core/testing';
import {
  LOCAL_STORAGE,
  type PreferenceStorage,
} from '../../../../core/storage/local-storage';
import { KeptUploads, type KeptUpload } from './kept-uploads.storage';

const kept = (over: Partial<KeptUpload> = {}): KeptUpload => ({
  uploadId: '5b0c1c3e-5d57-4a3f-9a3f-0c6f6f0a1b01',
  position: '0.0.1',
  blockType: 'video',
  name: 'clip.mp4',
  sizeBytes: 1000,
  checksumSha256: 'a'.repeat(64),
  expiresAt: '2099-01-01T00:00:00',
  ...over,
});

describe('KeptUploads', () => {
  let store: Map<string, string>;
  let kept$: KeptUploads;

  const create = (storage: PreferenceStorage | null) => {
    TestBed.configureTestingModule({
      providers: [{ provide: LOCAL_STORAGE, useValue: storage }],
    });
    kept$ = TestBed.inject(KeptUploads);
  };

  beforeEach(() => {
    store = new Map();
    create({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    });
  });

  it('keeps uploads per user and course under the versioned key, with no bytes', () => {
    kept$.write('000002', 6, [kept()]);

    expect([...store.keys()]).toEqual(['lms.asset-uploads.v1.000002.6']);
    expect(kept$.read('000002', 6)).toEqual([kept()]);
    expect(kept$.read('000002', 7)).toEqual([]);
    expect(kept$.read('000003', 6)).toEqual([]);
  });

  it('forgets an upload the server no longer holds', () => {
    kept$.write('000002', 6, [
      kept({
        uploadId: '5b0c1c3e-5d57-4a3f-9a3f-0c6f6f0a1b02',
        expiresAt: '2000-01-01T00:00:00',
      }),
      kept(),
    ]);

    expect(kept$.read('000002', 6).map((k) => k.name)).toEqual(['clip.mp4']);
    expect(
      JSON.parse(store.get('lms.asset-uploads.v1.000002.6')!),
    ).toHaveLength(1);
  });

  it('keeps an upload whose expiry the server did not say', () => {
    kept$.write('000002', 6, [kept({ expiresAt: null })]);
    expect(kept$.read('000002', 6)).toHaveLength(1);
  });

  it('removes the entry when nothing is left to keep', () => {
    kept$.write('000002', 6, [kept()]);
    kept$.write('000002', 6, []);
    expect(store.size).toBe(0);
  });

  it('drops a malformed entry and counts it as none', () => {
    store.set('lms.asset-uploads.v1.000002.6', '{not json');
    expect(kept$.read('000002', 6)).toEqual([]);
    expect(store.size).toBe(0);

    store.set(
      'lms.asset-uploads.v1.000002.6',
      JSON.stringify([{ uploadId: 1 }]),
    );
    expect(kept$.read('000002', 6)).toEqual([]);
    expect(store.size).toBe(0);
  });

  it('keeps them in memory when the browser blocks storage', () => {
    TestBed.resetTestingModule();
    create(null);
    kept$.write('000002', 6, [kept()]);
    expect(kept$.read('000002', 6)).toEqual([kept()]);
  });

  it('keeps them in memory when storage throws', () => {
    TestBed.resetTestingModule();
    create({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    kept$.write('000002', 6, [kept()]);
    expect(kept$.read('000002', 6)).toEqual([kept()]);
  });
});
