import { from, Observable } from 'rxjs';
import { SLICE_BYTES } from './sha256';
import type { HashEvent, Hasher } from './sha256-hasher';

/** The digest `FakeHasher` gives a blob of `size` bytes. */
export const digestOf = (size: number): string =>
  size.toString(16).padStart(64, '0');

/** The sizes of the slices a blob of `size` bytes is hashed in. */
export const sliceSizes = (size: number): number[] =>
  Array.from({ length: Math.ceil(size / SLICE_BYTES) }, (_, i) =>
    Math.min(SLICE_BYTES, size - i * SLICE_BYTES),
  );

/**
 * Hashes by size, so equal sizes give equal digests and a spec knows them without computing (and
 * without `Blob.arrayBuffer()`, which jsdom lacks).
 */
export class FakeHasher implements Hasher {
  readonly hashed: number[] = [];

  hash(blob: Blob): Observable<HashEvent> {
    this.hashed.push(blob.size);
    return from<HashEvent[]>([
      { type: 'progress', hashed: blob.size, total: blob.size },
      {
        type: 'done',
        hex: digestOf(blob.size),
        sliceHashes: sliceSizes(blob.size).map(digestOf),
      },
    ]);
  }
}
