import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  assessmentV1Endpoints,
  courseJobEndpoints,
  courseJobReviewPath,
  MAX_PAGE_SIZE,
  organizationEndpoints,
  trainingCatalogEndpoints,
  type CourseJob,
  type CourseJobInputs,
} from '@lms/contracts';
import { CourseJobAccess } from '../../../../../core/course-jobs/course-job-access';
import { CourseJobTrackerStore } from '../../../../../core/course-jobs/course-job-tracker.store';
import { serverData } from '../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../../core/session/session.store';

export interface StartCourseRequest {
  readonly file: File;
  readonly inputs: CourseJobInputs;
}

/**
 * The start form of AI course generation: the options it offers (units for an admin, the
 * programmes of the chosen unit, the competencies) and the start itself. The unit is an admin's
 * choice only; an instructor's course always belongs to their own unit, which the server decides.
 * Starting hands the new job to the background tracker, so the owl follows it from any page.
 */
@Injectable()
export class StartCourseStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly tracker = inject(CourseJobTrackerStore);
  private readonly router = inject(Router);
  private readonly access = inject(CourseJobAccess);

  /** Whether the form asks for a unit. */
  readonly picksUnit$ = this.access.picksUnit$;

  private readonly chosenOrgId = signal<number | undefined>(undefined);

  private readonly ownerOrgId = computed(() =>
    this.picksUnit$() ? this.chosenOrgId() : this.session.user$()?.org?.id,
  );

  private readonly unitsData = serverData(
    () =>
      this.client.call(organizationEndpoints.listOrgs, {
        query: { size: MAX_PAGE_SIZE, sort: 'name,asc' },
      }),
    { params: () => (this.picksUnit$() ? true : undefined) },
  );

  private readonly programmesData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.listPrograms, {
        query: { ownerOrgId, size: MAX_PAGE_SIZE },
      }),
    { params: () => this.ownerOrgId() },
  );

  private readonly competenciesData = serverData(() =>
    this.client.call(assessmentV1Endpoints.competencies, {
      query: { status: 'ACTIVE' },
    }),
  );

  readonly units$ = computed(() => this.unitsData.value()?.items ?? []);
  readonly programmes$ = computed(
    () => this.programmesData.value()?.items ?? [],
  );
  readonly competencies$ = computed(() => this.competenciesData.value() ?? []);

  /** An admin picked another unit: its programmes replace the list. */
  chooseUnit(orgId: number | undefined): void {
    this.chosenOrgId.set(orgId);
  }

  private readonly starting = serverMutation(
    (request: StartCourseRequest) =>
      this.client.call(courseJobEndpoints.start, {
        body: { file: request.file, inputs: JSON.stringify(request.inputs) },
      }),
    {
      errors: 'alert',
      onSuccess: (job: CourseJob) => {
        this.tracker.track(job);
        this.done?.(job);
      },
      success: () => ({
        title: 'Đã bắt đầu tạo khóa học',
        detail: 'Bạn có thể làm việc khác, con cú sẽ báo khi dàn ý sẵn sàng.',
      }),
    },
  );

  readonly isStarting$ = this.starting.isPending;
  readonly error$ = this.starting.error;

  private done: ((job: CourseJob) => void) | undefined;

  /** Starts the job; `done` runs once it is queued, with the job. */
  start(request: StartCourseRequest, done: (job: CourseJob) => void): void {
    this.done = done;
    this.starting.run(request);
  }

  /** Opens the review screen of a job. */
  open(job: CourseJob): void {
    void this.router.navigateByUrl(courseJobReviewPath(job.jobId));
  }
}
