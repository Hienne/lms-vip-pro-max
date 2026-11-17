import { toSignal } from '@angular/core/rxjs-interop';
import { computed, inject, Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { courseJobEndpoints } from '@lms/contracts';
import { map } from 'rxjs';
import { serverData } from '../../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../../core/http/endpoint-client';

/**
 * Where an old link to a generation job (`/admin/courses/ai-drafts/:jobId`) leads now: to the
 * course editor of the job's draft course. A job made before jobs owned a course has no such
 * course, so the screen says so.
 */
@Injectable()
export class LegacyCourseJobStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);

  private readonly jobId$ = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('jobId'));
        return Number.isInteger(id) && id > 0 ? id : undefined;
      }),
    ),
  );

  private readonly data = serverData(
    (jobId: number) =>
      this.client.call(courseJobEndpoints.get, { params: { jobId } }),
    { params: () => this.jobId$() },
  );

  readonly error$ = this.data.error;

  /** The editor of the job's course; undefined while loading and for a job without a course. */
  readonly editorPath$ = computed(() => {
    const courseId = this.data.value()?.courseId;
    return courseId == null ? undefined : `/admin/courses/${courseId}/edit`;
  });

  /** True once the job is read and has no course: it belongs to the old flow. */
  readonly isLegacy$ = computed(() => {
    const job = this.data.value();
    return job !== undefined && job.courseId == null;
  });

  reload(): void {
    this.data.reload();
  }
}
