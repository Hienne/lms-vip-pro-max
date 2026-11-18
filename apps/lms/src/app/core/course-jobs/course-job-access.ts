import { computed, inject, Injectable } from '@angular/core';
import { SessionStore } from '../session/session.store';

/** The roles the server lets start a course generation (its `tao_khoa_hoc` skill and job API). */
const COURSE_MANAGER_ROLES: readonly string[] = [
  'INSTRUCTOR',
  'ADMIN',
  'SUPER_ADMIN',
];

/**
 * What the signed-in user may do with AI course generation. It only decides what to show: the
 * server refuses everyone else, and a learner never sees the attach button or the form.
 */
@Injectable({ providedIn: 'root' })
export class CourseJobAccess {
  private readonly session = inject(SessionStore);

  private readonly roles = computed(() =>
    (this.session.user$()?.grants ?? []).map((grant) => grant.roleCode),
  );

  /** An instructor or an admin. */
  readonly canGenerate$ = computed(() =>
    this.roles().some((role) => COURSE_MANAGER_ROLES.includes(role)),
  );
}
