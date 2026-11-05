import { createHash } from 'node:crypto';
import { SLICE_BYTES, sha256Blob, sha256Digest } from './sha256';

/** jsdom's `Blob` has no `arrayBuffer()`; a browser's does, and that is the default reader. */
const readSlice = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const oneShot = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

/** Bytes that differ from slice to slice, so a mixed-up slice order changes the digest. */
function pattern(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = (i * 31 + (i >> 8)) & 0xff;
  return bytes;
}

describe('sha256Blob', () => {
  const hash = (blob: Blob, options = {}) =>
    sha256Blob(blob, { read: readSlice, ...options });

  it.each([
    [
      'the empty file',
      '',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ],
    [
      'abc',
      'abc',
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    ],
    [
      'the two-block message of FIPS 180-4',
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
    [
      'a million letters a',
      'a'.repeat(1_000_000),
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    ],
  ])('matches the standard vector for %s', async (_name, text, expected) => {
    expect(await hash(new Blob([text]))).toBe(expected);
  });

  it('gives the same digest whatever the slice size', async () => {
    const bytes = pattern(100_003);
    const expected = oneShot(bytes);
    for (const sliceBytes of [63, 64, 65, 4096, 100_003, 1_000_000]) {
      expect(await hash(new Blob([bytes]), { sliceBytes })).toBe(expected);
    }
  });

  it('reads a file larger than one slice in slices and equals the one-shot digest', async () => {
    const bytes = pattern(SLICE_BYTES * 2 + 12_345);
    const sliceSizes: number[] = [];
    const digest = await sha256Blob(new Blob([bytes]), {
      read: (blob) => {
        sliceSizes.push(blob.size);
        return readSlice(blob);
      },
    });
    expect(digest).toBe(oneShot(bytes));
    expect(sliceSizes).toEqual([SLICE_BYTES, SLICE_BYTES, 12_345]);
  });

  describe('the digest of each slice', () => {
    const digest = (blob: Blob, options = {}) =>
      sha256Digest(blob, { read: readSlice, ...options });

    it('gives the digest of every slice beside the whole one, from one read', async () => {
      const bytes = pattern(250);
      let reads = 0;
      const result = await digest(new Blob([bytes]), {
        sliceBytes: 100,
        read: (blob: Blob) => {
          reads++;
          return readSlice(blob);
        },
      });
      expect(reads).toBe(3);
      expect(result.hex).toBe(oneShot(bytes));
      expect(result.sliceHashes).toEqual([
        oneShot(bytes.slice(0, 100)),
        oneShot(bytes.slice(100, 200)),
        oneShot(bytes.slice(200)),
      ]);
    });

    it('gives the whole digest as the only slice of a blob that fits one slice', async () => {
      const bytes = pattern(100);
      const result = await digest(new Blob([bytes]), { sliceBytes: 100 });
      expect(result.sliceHashes).toEqual([oneShot(bytes)]);
    });

    it('has no slice for the empty blob', async () => {
      expect((await digest(new Blob([]))).sliceHashes).toEqual([]);
    });
  });

  it('never reads the whole file at once', async () => {
    const bytes = pattern(SLICE_BYTES + 10);
    let largest = 0;
    await sha256Blob(new Blob([bytes]), {
      read: (blob) => {
        largest = Math.max(largest, blob.size);
        return readSlice(blob);
      },
    });
    expect(largest).toBeLessThanOrEqual(SLICE_BYTES);
  });

  it('reports progress after each slice, ending at the whole file', async () => {
    const reports: [number, number][] = [];
    await hash(new Blob([pattern(250)]), {
      sliceBytes: 100,
      onProgress: (hashed: number, total: number) =>
        reports.push([hashed, total]),
    });
    expect(reports).toEqual([
      [100, 250],
      [200, 250],
      [250, 250],
    ]);
  });

  it('reports the empty file as done', async () => {
    const reports: [number, number][] = [];
    await hash(new Blob([]), {
      onProgress: (hashed: number, total: number) =>
        reports.push([hashed, total]),
    });
    expect(reports.at(-1)).toEqual([0, 0]);
  });

  it('stops between slices when the signal aborts', async () => {
    const controller = new AbortController();
    let reads = 0;
    const outcome = sha256Blob(new Blob([pattern(500)]), {
      sliceBytes: 100,
      signal: controller.signal,
      read: (blob) => {
        if (++reads === 2) controller.abort();
        return readSlice(blob);
      },
    });
    await expect(outcome).rejects.toMatchObject({ name: 'AbortError' });
    expect(reads).toBe(2);
  });

  it('refuses a slice size that is not a positive whole number', async () => {
    await expect(hash(new Blob(['a']), { sliceBytes: 0 })).rejects.toThrow(
      /slice/i,
    );
  });

  it('hashes 100 MB, and reports how long it takes', async () => {
    const bytes = new Uint8Array(100 * 1024 * 1024).fill(7);
    const blob = new Blob([bytes]);
    const started = performance.now();
    const digest = await hash(blob);
    const seconds = (performance.now() - started) / 1000;
    // Reported, not asserted tightly: it depends on the machine and on jsdom's FileReader.
    console.info(
      `sha256 of 100 MB: ${seconds.toFixed(2)} s (${(100 / seconds).toFixed(0)} MB/s) in jsdom with FileReader`,
    );
    expect(digest).toBe(oneShot(bytes));
    expect(seconds).toBeLessThan(60);
  }, 120_000);
});
