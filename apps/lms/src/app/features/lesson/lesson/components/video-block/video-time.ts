/**
 * Index of the last item that has started by `second` (the player's whole second), or -1 before the
 * first. Seconds can be decimals; an item counts from its whole second, which is how its label
 * reads, so seeking to it makes it the current one. Items arrive in time order.
 */
export function startedIndex(
  items: readonly { readonly startSeconds: number }[],
  second: number,
): number {
  let index = -1;
  for (let i = 0; i < items.length; i += 1) {
    if (Math.floor(items[i].startSeconds) > second) break;
    index = i;
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
