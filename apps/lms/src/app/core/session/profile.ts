import type {
  AccountStatus,
  FunctionCode,
  FunctionInfo,
  RoleGrant,
} from '@lms/contracts';

/** An org or team as the signed-in user's profile names it. */
export interface Placement {
  readonly id: number;
  readonly code: string | null;
  readonly name: string;
}

/**
 * The signed-in user as the app renders them; `toProfile` builds it from `/me`. It carries what
 * `/me` says and nothing the backend does not know: no role badge colour, no unit scope id.
 */
export interface Profile {
  /** The staff code, a string with its leading zeros. */
  readonly userId: string;
  readonly username: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly positionName: string | null;
  readonly status: AccountStatus;
  readonly authProvider: 'LOCAL' | 'SSO';
  /** A temporary password is in use: only the password change is open. */
  readonly mustChangePassword: boolean;
  readonly org: (Placement & { readonly type: string | null }) | null;
  readonly team: Placement | null;
  /** Every role grant with its scope, as `/me` lists them. */
  readonly grants: readonly RoleGrant[];
  /** The functions this app has a screen for, in the backend's order: the sidebar. */
  readonly functions: readonly FunctionInfo[];
  /** Their codes, for the route guard. */
  readonly menus: readonly FunctionCode[];
  /** Where `/` and the login page send the user. */
  readonly homePath: string;
  /** The role names for prose and the sidebar, e.g. "Giảng viên, Học viên". */
  readonly roleText: string;
}
