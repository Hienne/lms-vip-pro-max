import {
  courseJobEndpoints,
  CourseJobInputsSchema,
  type AnyEndpoint,
  type CourseJob,
  type CourseJobInputs,
  type CourseJobStatus,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeError, envelopeOk } from '../envelope';

// The backend's course generation jobs (corebanking-academy, /api/v1/assistant/course-jobs) as the
// in-app mock: jobs live in memory and move one step each time the app asks about them, so the
// owl's progress, the review notice and a reload (the list is read again) can be tried without a
// model. The real queue, steps and model are the backend's.

const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});
const refuse = (code: string, message: string): FakeReply => ({
  status: 200,
  body: envelopeError(code, 'Không thể thực hiện', message),
});
const notFound = (): FakeReply =>
  refuse('CORE-RESOURCE_NOT_FOUND', 'Không tìm thấy công việc.');

/** The progress a job shows on each of the polls after it is queued, then it waits for approval. */
const PROGRESS_STEPS: readonly { status: CourseJobStatus; progress: number }[] =
  [
    { status: 'running', progress: 10 },
    { status: 'running', progress: 20 },
    { status: 'waiting_approval', progress: 30 },
  ];

interface MockJob {
  job: CourseJob;
  /** How many polls the job has lived through. */
  polls: number;
  readonly owner: string;
}

export class CourseJobMock {
  private nextId = 1;
  private jobs: MockJob[] = [];

  answers(endpoint: AnyEndpoint): boolean {
    return Object.values(courseJobEndpoints).some((item) => item === endpoint);
  }

  /** Queues a job the way a confirmed chat card does; `owner` is the signed-in user. */
  queue(owner: string, inputs: CourseJobInputs, fileName: string): CourseJob {
    const now = new Date().toISOString();
    const job: CourseJob = {
      jobId: this.nextId++,
      status: 'queued',
      step: 'summarise_sections',
      progress: 0,
      error: null,
      inputs,
      ownerOrgId: inputs.ownerOrgId ?? 1,
      source: { documentId: null, fileName, status: 'ready' },
      createdDraftId: null,
      steps: [
        {
          kind: 'summarise_sections',
          itemKey: '',
          status: 'pending',
          errorMessage: null,
        },
      ],
      createTime: now,
      updateTime: now,
    };
    this.jobs.unshift({ job, polls: 0, owner });
    return job;
  }

  handle(
    endpoint: AnyEndpoint,
    request: FakeRequest,
    owner: string,
  ): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    if (endpoint === courseJobEndpoints.start)
      return this.start(request, owner);
    if (endpoint === courseJobEndpoints.list) {
      const mine = this.jobs.filter((entry) => entry.owner === owner);
      mine.forEach((entry) => this.advance(entry));
      return ok(mine.map((entry) => this.summary(entry.job)));
    }
    const entry = this.jobs.find(
      (item) =>
        item.owner === owner &&
        item.job.jobId === Number(request.params['jobId']),
    );
    if (!entry) return notFound();
    if (endpoint === courseJobEndpoints.get) {
      this.advance(entry);
      return ok(entry.job);
    }
    if (endpoint === courseJobEndpoints.cancel) {
      if (['completed', 'failed', 'cancelled'].includes(entry.job.status)) {
        return refuse('CORE-VALIDATION_FAILED', 'Công việc này đã kết thúc.');
      }
      entry.job = { ...entry.job, status: 'cancelled' };
      return ok(entry.job);
    }
    this.jobs = this.jobs.filter((item) => item !== entry);
    return ok(null);
  }

  private start(request: FakeRequest, owner: string): FakeReply {
    const body = request.body;
    const file =
      body instanceof FormData
        ? body.get('file')
        : (body as { file?: unknown } | null)?.file;
    const text =
      body instanceof FormData
        ? body.get('inputs')
        : (body as { inputs?: unknown } | null)?.inputs;
    if (!(file instanceof Blob) || typeof text !== 'string') {
      return refuse(
        'CORE-VALIDATION_FAILED',
        'Cần chọn một tệp và nhập thông tin.',
      );
    }
    let inputs: CourseJobInputs;
    try {
      inputs = CourseJobInputsSchema.parse(JSON.parse(text));
    } catch {
      return refuse(
        'CORE-VALIDATION_FAILED',
        'Thông tin khởi tạo không hợp lệ.',
      );
    }
    if (inputs.chapters == null && inputs.durationMinutes == null) {
      return refuse(
        'CORE-VALIDATION_FAILED',
        'Nhập số chương hoặc thời lượng mong muốn.',
      );
    }
    const live = this.jobs.filter(
      (entry) => entry.owner === owner && entry.job.status !== 'cancelled',
    );
    if (live.length >= 3) {
      return refuse(
        'ASSISTANT-JOB_RATE_LIMITED',
        'Bạn đã tạo 3 khóa học bằng AI trong ngày, thử lại sau 24 giờ.',
      );
    }
    const name = (file as File).name || 'tai-lieu.md';
    return ok(this.queue(owner, inputs, name));
  }

  /** Each look at a live job moves it forward; one that waits for approval stays there. */
  private advance(entry: MockJob): void {
    if (entry.job.status !== 'queued' && entry.job.status !== 'running') return;
    const next =
      PROGRESS_STEPS[Math.min(entry.polls, PROGRESS_STEPS.length - 1)];
    entry.polls += 1;
    entry.job = {
      ...entry.job,
      status: next.status,
      progress: next.progress,
      step:
        next.status === 'waiting_approval' ? 'outline' : 'summarise_sections',
      updateTime: new Date().toISOString(),
    };
  }

  private summary(job: CourseJob) {
    return {
      jobId: job.jobId,
      status: job.status,
      step: job.step ?? null,
      progress: job.progress,
      error: job.error ?? null,
      sourceFileName: job.source?.fileName ?? null,
      createdDraftId: job.createdDraftId ?? null,
      createTime: job.createTime,
    };
  }
}
