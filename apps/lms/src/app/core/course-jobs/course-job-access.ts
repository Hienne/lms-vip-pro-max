import { computed, inject, Injectable } from '@angular/core';
import { SessionStore } from '../session/session.store';

/** The roles the server lets start a course generation (its `tao_khoa_hoc` skill and job API). */
const COURSE_MANAGER_ROLES: readonly string[] = [
  'INSTRUCTOR',
  'ADMIN',
  'SUPER_ADMIN',
];

/**
 * Temporarily hides drafting with the in-house assistant: the course editor's "Soạn cùng trợ lý"
 * button, the chat's attach button and the job tracker. Courses are drafted only with a Trợ lý
 * ngoài meanwhile; its key button and its sessions in the editor do not depend on this. Set to
 * `true` to bring the in-house assistant back.
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
}
