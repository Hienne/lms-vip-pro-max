import type { GrantScope, ScopeType } from '@lms/contracts';

/** What a grant's scope is called, with the org or team name when the caller has it. */
export function scopeLabel(
  scope: GrantScope,
  names: {
    readonly orgName?: string | null;
    readonly teamName?: string | null;
  } = {},
): string {
  switch (scope.type) {
    case 'GLOBAL':
      return 'Toàn hệ thống';
    case 'ORG':
      return `Đơn vị ${names.orgName ?? `#${scope.orgId ?? '?'}`}`;
    case 'TEAM':
      return `Nhóm ${names.teamName ?? `#${scope.teamId ?? '?'}`}`;
    case 'OWN':
      return 'Cá nhân';
  }
}

/** What a kind of scope is called when the admin picks one for a new grant. */
export const SCOPE_TYPE_LABEL: Readonly<Record<ScopeType, string>> = {
  GLOBAL: 'Toàn hệ thống',
  ORG: 'Một đơn vị',
  TEAM: 'Một nhóm',
  OWN: 'Chỉ dữ liệu cá nhân',
};
