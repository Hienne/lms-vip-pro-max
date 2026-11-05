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

/** The digest of a blob, and the digest of each `sliceBytes` slice of it. */
export interface BlobDigest {
  /** The lower-case hex SHA-256 of the whole blob. */
  readonly hex: string;
  /**
   * The lower-case hex SHA-256 of each slice, in order (empty for an empty blob). When the slice
   * size is a part size, these are the parts' hashes, so a part need not be read again.
   */
  readonly sliceHashes: readonly string[];
}

/** The lower-case hex SHA-256 of `blob`. */
export async function sha256Blob(
  blob: Blob,
  options: HashOptions = {},
): Promise<string> {
  return (await sha256Digest(blob, options)).hex;
}

/** The SHA-256 of `blob` and of each of its slices, read once. */
export async function sha256Digest(
  blob: Blob,
  options: HashOptions = {},
): Promise<BlobDigest> {
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
  const sliceHashes: string[] = [];
  for (let start = 0; start < blob.size; start += sliceBytes) {
    signal?.throwIfAborted();
    const end = Math.min(start + sliceBytes, blob.size);
    const bytes = await read(blob.slice(start, end));
    hash.update(bytes);
    // A blob of one slice has one digest: the whole one, taken below.
    if (blob.size > sliceBytes) sliceHashes.push(bytesToHex(sha256(bytes)));
    onProgress?.(end, blob.size);
  }
  signal?.throwIfAborted();
  if (blob.size === 0) onProgress?.(0, 0);
  const hex = bytesToHex(hash.digest());
  if (blob.size > 0 && blob.size <= sliceBytes) sliceHashes.push(hex);
  return { hex, sliceHashes };
}
