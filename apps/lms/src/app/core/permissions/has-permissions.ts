import type { Permission } from '@lms/contracts';

/** Whether the server granted every required permission; one rule for `*appCan` and the guard. */
export function hasPermissions(
  granted: readonly Permission[],
  required: Permission | readonly Permission[],
): boolean {
  const needed = typeof required === 'string' ? [required] : required;
  return needed.every((permission) => granted.includes(permission));
}
