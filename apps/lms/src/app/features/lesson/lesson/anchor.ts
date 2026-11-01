/** A video position in whole seconds as `m:ss`, the way the server writes a bookmark's label. */
export function clock(second: number): string {
  const total = Math.max(0, Math.floor(second));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
