import { from, Observable } from 'rxjs';
import type { HashEvent, Hasher } from './sha256-hasher';

/** The digest `FakeHasher` gives a blob of `size` bytes. */
export const digestOf = (size: number): string =>
  size.toString(16).padStart(64, '0');

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
      { type: 'done', hex: digestOf(blob.size) },
    ]);
  }
}
