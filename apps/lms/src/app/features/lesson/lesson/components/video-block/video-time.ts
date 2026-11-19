/**
 * Index of the first item of the run that has started by `second` (the player's whole second), or
 * -1 before the first. Seconds can be decimals; an item counts from its whole second, which is how
 * its label reads, so seeking to it makes it the current one. Items that share that whole second
 * (the pieces of a long Transcript line, 0.001 s apart) are one run, and its first item is the
 * current one. Items arrive in time order. An item without a time (an untimed Transcript, which
 * never mixes with timed lines) never starts.
 */
export function startedIndex(
  items: readonly { readonly startSeconds: number | null }[],
  second: number,
): number {
  let index = -1;
  let runSecond = -1;
  for (let i = 0; i < items.length; i += 1) {
    const start = items[i].startSeconds;
    if (start === null || Math.floor(start) > second) break;
    if (Math.floor(start) !== runSecond) {
      index = i;
      runSecond = Math.floor(start);
    }
  }
  return index;
}

/** Lower case without accents (`đ` included), so a search ignores both case and diacritics. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}
