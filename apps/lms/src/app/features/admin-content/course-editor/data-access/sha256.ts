import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * The SHA-256 of a file, read in slices so a 500 MB video is never in memory at once. Web Crypto's
 * `digest` is one-shot (it would need the whole file as one buffer) and exists only on secure
 * pages, so the hash runs on `@noble/hashes`, which can be fed a slice at a time. This module
 * knows nothing of workers: `sha256.worker.ts` runs it off the main thread.
 */

/** The slice read and fed to the hash at a time. */
export const SLICE_BYTES = 8 * 1024 * 1024;

export interface HashOptions {
  /** Defaults to `SLICE_BYTES`. */
  readonly sliceBytes?: number;
  /** After each slice: bytes hashed so far, and the file size. */
  readonly onProgress?: (hashed: number, total: number) => void;
  /** Stops between slices and rejects with an `AbortError`. */
  readonly signal?: AbortSignal;
  /** How a slice is read; defaults to `Blob.arrayBuffer()`. A spec swaps it where that is missing. */
  readonly read?: (slice: Blob) => Promise<Uint8Array>;
}

const readWithBlob = async (slice: Blob): Promise<Uint8Array> =>
  new Uint8Array(await slice.arrayBuffer());

/** The lower-case hex SHA-256 of `blob`. */
export async function sha256Blob(
  blob: Blob,
  options: HashOptions = {},
): Promise<string> {
  const {
    sliceBytes = SLICE_BYTES,
    onProgress,
    signal,
    read = readWithBlob,
  } = options;
  if (!Number.isInteger(sliceBytes) || sliceBytes < 1) {
    throw new RangeError('The slice size must be a positive whole number.');
  }
  const hash = sha256.create();
  for (let start = 0; start < blob.size; start += sliceBytes) {
    signal?.throwIfAborted();
    const end = Math.min(start + sliceBytes, blob.size);
    hash.update(await read(blob.slice(start, end)));
    onProgress?.(end, blob.size);
  }
  signal?.throwIfAborted();
  if (blob.size === 0) onProgress?.(0, 0);
  return bytesToHex(hash.digest());
}
