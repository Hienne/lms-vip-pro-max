/**
 * The body of a backend PATCH: only the fields whose value changed. A field left out keeps its
 * value on the server and `null` clears it, so a PATCH never repeats what did not change (the
 * backend answers `EMPTY_UPDATE` to an empty body and `UNSUPPORTED_FIELD` to a field it does not
 * list). The values are compared one by one; callers pass scalars and `null`.
 */
export function toPatch<T extends object, K extends keyof T>(
  original: T,
  next: Pick<T, K>,
  fields: readonly K[],
): Partial<Pick<T, K>> {
  const patch: Partial<Pick<T, K>> = {};
  for (const field of fields) {
    if (!Object.is(original[field], next[field])) patch[field] = next[field];
  }
  return patch;
}

/** True when `toPatch` found nothing to send. */
export function isEmptyPatch(patch: object): boolean {
  return Object.keys(patch).length === 0;
}
