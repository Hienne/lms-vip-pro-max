import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { courseEndpoints, type CreateCourseCommand } from '@lms/contracts';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';

/**
 * Creating a course: the server makes the course and its empty first draft under the caller's org,
 * then the editor takes over.
 */
@Injectable()
export class CourseNewStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  private readonly state = {
    /** Set once the course exists, so moving on to the editor does not ask about leaving. */
    created: signal(false),
  };

  private readonly orgId = computed(() => this.session.user$()?.org?.id);

  private readonly createMutation = serverMutation(
    (command: CreateCourseCommand) =>
      this.client.call(courseEndpoints.createCourse, { body: command }),
    {
      errors: 'alert',
      success: (_command, created) => ({
        title: 'Đã tạo khóa học',
        detail: `${created.course.code} ở trạng thái Nháp. Tiếp tục soạn nội dung.`,
      }),
      onSuccess: (created) => {
        this.setCreated(true);
        void this.router.navigate(
          ['/admin/courses', created.course.id, 'edit'],
          { replaceUrl: true },
        );
      },
    },
  );

  readonly created$ = this.state.created.asReadonly();
  readonly isCreating$ = this.createMutation.isPending;
  readonly createError$ = this.createMutation.error;
  readonly orgName$ = computed(() => this.session.user$()?.org?.name ?? '');

  private setCreated(created: boolean): void {
    this.state.created.set(created);
  }

  create(command: Omit<CreateCourseCommand, 'ownerOrgId'>): void {
    const ownerOrgId = this.orgId();
    if (ownerOrgId) this.createMutation.run({ ...command, ownerOrgId });
  }
}
