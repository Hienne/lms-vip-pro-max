import type { Role } from '@lms/contracts';

/** What the role guard hands the 403 page through navigation state. */
export interface ForbiddenState {
  readonly path: string;
  readonly roles: readonly Role[];
}
