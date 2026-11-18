import { computed, inject, Injectable } from '@angular/core';
import { SessionStore } from '../session/session.store';

/** The roles the server lets start a course generation (its `tao_khoa_hoc` skill and job API). */
const COURSE_MANAGER_ROLES: readonly string[] = [
  'INSTRUCTOR',
  'ADMIN',
  'SUPER_ADMIN',
];
const ADMIN_ROLES: readonly string[] = ['ADMIN', 'SUPER_ADMIN'];

/**
 * Temporarily hides every AI course-composing entry point (the course editor's "Tạo bằng AI"
 * toggle and section, the chat's attach button, the job tracker). Set to `true` to bring it back.
 */
export const AI_COURSE_COMPOSE_ENABLED = false;

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
  readonly canGenerate$ = computed(
    () =>
      AI_COURSE_COMPOSE_ENABLED &&
      this.roles().some((role) => COURSE_MANAGER_ROLES.includes(role)),
  );

  /** An admin picks the unit of the course; an instructor's is always their own. */
  readonly picksUnit$ = computed(() =>
    this.roles().some((role) => ADMIN_ROLES.includes(role)),
  );
}
