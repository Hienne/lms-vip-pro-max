import type { RoleGrant } from '@lms/contracts';

/**
 * Display/route eligibility for APIs with explicit business-role requirements. A function alone
 * does not grant an operation. Keep each role and scope on the same effective /me grant.
 * Resource ownership, org ancestry, memberships and every write are still checked by Java.
 */
export function canOpenFunction(
  code: string,
  grants: readonly RoleGrant[],
): boolean {
  switch (code) {
    case 'COURSE_LEARNING':
    case 'LEARNING_PROGRESS':
    case 'QUIZ_TAKING':
      return grants.some(
        (g) => g.roleCode === 'LEARNER' && g.scope.type === 'OWN',
      );
    case 'TRAINING_CATALOG':
    case 'COURSE_MANAGEMENT':
    case 'LESSON_MANAGEMENT':
    case 'QUIZ_MANAGEMENT':
    case 'COURSE_ASSIGNMENT':
      return grants.some(
        (g) =>
          (g.roleCode === 'SUPER_ADMIN' && g.scope.type === 'GLOBAL') ||
          ['ADMIN', 'INSTRUCTOR'].includes(g.roleCode),
      );
    case 'QUESTION_BANK':
      return grants.some(
        (g) =>
          (g.roleCode === 'SUPER_ADMIN' && g.scope.type === 'GLOBAL') ||
          (['ADMIN', 'INSTRUCTOR'].includes(g.roleCode) &&
            ['GLOBAL', 'ORG'].includes(g.scope.type)),
      );
    case 'USER_MANAGEMENT':
    case 'ORGANIZATION_MANAGEMENT':
    case 'SYSTEM_AUDIT':
      return grants.some(
        (g) =>
          (g.roleCode === 'SUPER_ADMIN' && g.scope.type === 'GLOBAL') ||
          (g.roleCode === 'ADMIN' && ['GLOBAL', 'ORG'].includes(g.scope.type)),
      );
    case 'REPORTING':
      return grants.some(
        (g) =>
          ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'REPORT_VIEWER'].includes(
            g.roleCode,
          ) && ['GLOBAL', 'ORG', 'TEAM'].includes(g.scope.type),
      );
    default:
      // Community can grant its functions from membership without an identity role grant.
      return true;
  }
}
