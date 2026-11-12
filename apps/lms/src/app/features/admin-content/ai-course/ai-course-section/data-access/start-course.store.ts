import { computed, inject, Injectable, signal } from '@angular/core';
import {
  assessmentV1Endpoints,
  courseJobEndpoints,
  MAX_PAGE_SIZE,
  organizationEndpoints,
  type CourseJob,
  type CourseJobInputs,
} from '@lms/contracts';
import { CourseJobAccess } from '../../../../../core/course-jobs/course-job-access';
import { CourseJobTrackerStore } from '../../../../../core/course-jobs/course-job-tracker.store';
import { serverData } from '../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { UPLOAD_ACCEPT, uploadProblem } from '../../../../../core/knowledge/upload-rules';
import {
  EMPTY_START_COURSE_FORM,
  StartCourseFormSchema,
  type StartCourseFormValue,
} from '../ai-course-section.form';

/** What step 1 of the course editor already knows; the AI section adds the rest. */
export interface CourseBasics {
  readonly title: string;
  readonly description: string;
  readonly programmeId: number;
}

/**
 * The "Tạo bằng AI" section on step 1 of the course editor: what it collects (a source file and
 * what the course is for), the options it offers (units for an admin, the competencies), whether
 * it may start and why not, and the start itself. The unit is an admin's choice only; an
 * instructor's course always belongs to their own unit, which the server decides. Starting hands
 * the new job to the background tracker, so the owl follows it from any page.
 */
@Injectable()
export class StartCourseStore {
  private readonly client = inject(EndpointClient);
  private readonly tracker = inject(CourseJobTrackerStore);
  private readonly access = inject(CourseJobAccess);

  protected readonly accept = UPLOAD_ACCEPT;

  /** Whether the section asks for a unit. */
  readonly picksUnit$ = this.access.picksUnit$;

  readonly model = signal<StartCourseFormValue>({ ...EMPTY_START_COURSE_FORM });
  private readonly chosenFile = signal<File | null>(null);
  private readonly chosenProblem = signal<string | null>(null);
  readonly file$ = this.chosenFile.asReadonly();
  readonly fileProblem$ = this.chosenProblem.asReadonly();

  private readonly unitsData = serverData(
    () =>
      this.client.call(organizationEndpoints.listOrgs, {
        query: { size: MAX_PAGE_SIZE, sort: 'name,asc' },
      }),
    { params: () => (this.picksUnit$() ? true : undefined) },
  );

  private readonly competenciesData = serverData(() =>
    this.client.call(assessmentV1Endpoints.competencies, {
      query: { status: 'ACTIVE' },
    }),
  );

  readonly units$ = computed(() => this.unitsData.value()?.items ?? []);
  readonly competencies$ = computed(() => this.competenciesData.value() ?? []);

  /** A file picked in the section: kept when the upload rules accept it, else the problem is shown. */
  chooseFile(picked: File | null): void {
    if (!picked) return;
    const problem = uploadProblem(picked);
    this.chosenProblem.set(problem);
    this.chosenFile.set(problem ? null : picked);
  }

  /**
   * Why the section cannot start yet, in the order the author fixes it; null when it can. The
   * button stays disabled with this line beside it.
   */
  readonly problem$ = computed((): string | null => {
    if (this.chosenFile() === null) return 'Chọn tệp nguồn';
    const value = this.model();
    const checked = StartCourseFormSchema.safeParse(value);
    if (!checked.success) return checked.error.issues[0].message;
    if (value.chapters === '' && value.durationMinutes === '') {
      return 'Nhập số chương hoặc thời lượng mong muốn';
    }
    if (this.picksUnit$() && value.ownerOrgId === '') {
      return 'Chọn đơn vị sở hữu khóa học';
    }
    return null;
  });

  private readonly starting = serverMutation(
    (request: { file: File; inputs: CourseJobInputs }) =>
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
        detail: 'AI đang viết dàn ý; bạn xem kết quả ngay ở bước 2.',
      }),
    },
  );

  readonly isStarting$ = this.starting.isPending;
  readonly error$ = this.starting.error;

  private done: ((job: CourseJob) => void) | undefined;

  /**
   * Starts the job with step 1's name, description and programme; `done` runs once the server has
   * created the job and its draft course. Does nothing while the section is not ready.
   */
  start(basics: CourseBasics, done: (job: CourseJob) => void): void {
    const file = this.chosenFile();
    if (!file || this.problem$() !== null || this.isStarting$()) return;
    const value = this.model();
    this.done = done;
    this.starting.run({
      file,
      inputs: {
        targetLearners: value.targetLearners.trim(),
        level: value.level,
        chapters: value.chapters === '' ? null : Number(value.chapters),
        durationMinutes:
          value.durationMinutes === '' ? null : Number(value.durationMinutes),
        programmeId: basics.programmeId,
        competencyId: Number(value.competencyId),
        ownerOrgId:
          this.picksUnit$() && value.ownerOrgId !== ''
            ? Number(value.ownerOrgId)
            : null,
        title: basics.title.trim() || null,
        description: basics.description.trim() || null,
      },
    });
  }
}
