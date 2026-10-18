import { SEED_PASSWORD, SEED_USERS, seedMe } from '@lms/mocks';

/** A demo account of the mock backend, for the dev toolbar's "sign in as". */
export interface MockAccount {
  readonly userId: string;
  readonly username: string;
  readonly fullName: string;
  /** The role names of its grants, e.g. "Giảng viên, Học viên". */
  readonly roleText: string;
}

/** The seed's seven accounts with their role names, as the backend's demo database has them. */
export const MOCK_ACCOUNTS: readonly MockAccount[] = SEED_USERS.map((user) => ({
  userId: user.userId,
  username: user.username,
  fullName: user.fullName,
  roleText: [
    ...new Set(seedMe(user.userId).roleGrants.map((g) => g.roleName)),
  ].join(', '),
}));

/** The password every demo account has; the mock backend checks it, nothing else does. */
export const MOCK_PASSWORD = SEED_PASSWORD;
