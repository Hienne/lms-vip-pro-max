import {
  courseContentEndpoints,
  courseJobEndpoints,
  CourseJobInputsSchema,
  CourseOutlineSchema,
  type AnyEndpoint,
  type CourseContent,
  type CourseJob,
  type CourseJobInputs,
  type CourseJobStatus,
  type CourseOutline,
  type QuestionDecision,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeError, envelopeOk } from '../envelope';

// The backend's course generation jobs (corebanking-academy, /api/v1/assistant/course-jobs) as the
// in-app mock: jobs live in memory and move one step each time the app asks about them, so the
// owl's progress, the review screen and a reload (the list is read again) can be tried without a
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

/** A lesson is written after this many looks at the job. */
const DONE_TICKS = 2;
const LESSON_FAILURE = 'Mô hình trả về nội dung không hợp lệ, hãy thử lại.';

/** One lesson the model writes once the outline is approved. */
interface MockLesson {
  readonly key: string;
  readonly title: string;
  ticks: number;
  failed: boolean;
  /** Fails the first time it is written, so the retry can be tried. */
  flaky: boolean;
}

interface MockGeneration {
  outline: CourseOutline;
  locked: boolean;
  lessons: MockLesson[];
  decisions: Map<string, QuestionDecision>;
}

interface MockJob {
  job: CourseJob;
  /** How many polls the job has lived through. */
  polls: number;
  readonly owner: string;
  generation?: MockGeneration;
}

const sampleOutline = (inputs: CourseJobInputs): CourseOutline => ({
  title: 'Quy trình đối soát cuối ngày',
  summary: `Khóa học cho ${inputs.targetLearners}: các bước đối soát giao dịch cuối ngày.`,
  objectives: [
    'Nắm các bước đối soát cuối ngày',
    'Xử lý chênh lệch đúng quy trình',
  ],
  chapters: [
    {
      title: 'Tổng quan đối soát',
      lessons: [
        {
          title: 'Mục đích của đối soát',
          objectives: ['Hiểu vì sao phải đối soát'],
          estimatedMinutes: 10,
        },
        {
          title: 'Các nguồn dữ liệu',
          objectives: ['Nhận biết các nguồn dữ liệu'],
          estimatedMinutes: 15,
        },
      ],
    },
    {
      title: 'Thực hiện đối soát',
      lessons: [
        {
          title: 'Các bước thực hiện',
          objectives: ['Làm đúng thứ tự'],
          estimatedMinutes: 20,
        },
        {
          title: 'Xử lý chênh lệch',
          objectives: ['Báo cáo chênh lệch'],
          estimatedMinutes: 20,
        },
      ],
    },
  ],
});

const lessonsOf = (outline: CourseOutline): MockLesson[] =>
  outline.chapters.flatMap((chapter, c) =>
    chapter.lessons.map((lesson, l) => ({
      key: `c${c + 1}l${l + 1}`,
      title: lesson.title,
      ticks: 0,
      failed: false,
      flaky: c === 1 && l === 1,
    })),
  );

const isCourseContent = (endpoint: AnyEndpoint): boolean =>
  Object.values(courseContentEndpoints).some((item) => item === endpoint);

export class CourseJobMock {
  private nextId = 1;
  private jobs: MockJob[] = [];

  answers(endpoint: AnyEndpoint): boolean {
    return (
      Object.values(courseJobEndpoints).some((item) => item === endpoint) ||
      isCourseContent(endpoint)
    );
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
    if (isCourseContent(endpoint)) return this.review(endpoint, request, entry);
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

  /** The review calls: read, edit and approve the outline, redo a lesson, decide, retry, draft. */
  private review(
    endpoint: AnyEndpoint,
    request: FakeRequest,
    entry: MockJob,
  ): FakeReply {
    this.advance(entry);
    this.write(entry);
    const generation = entry.generation;
    const key = String(request.params['key'] ?? '');
    if (endpoint === courseContentEndpoints.content) {
      return ok(this.content(entry));
    }
    if (!generation) {
      return refuse('CORE-VALIDATION_FAILED', 'Dàn ý chưa sẵn sàng.');
    }
    if (endpoint === courseContentEndpoints.updateOutline) {
      if (generation.locked) {
        return refuse(
          'OUTLINE_LOCKED',
          'Dàn ý đã được duyệt nên không sửa được nữa.',
        );
      }
      const parsed = CourseOutlineSchema.safeParse(request.body);
      if (!parsed.success) {
        return refuse('CORE-VALIDATION_FAILED', 'Dàn ý không hợp lệ.');
      }
      generation.outline = parsed.data;
      return ok(this.content(entry));
    }
    if (endpoint === courseContentEndpoints.approveOutline) {
      if (generation.locked) {
        return refuse('OUTLINE_LOCKED', 'Dàn ý đã được duyệt rồi.');
      }
      generation.locked = true;
      generation.lessons = lessonsOf(generation.outline);
      entry.job = {
        ...entry.job,
        status: 'running',
        step: 'lesson',
        progress: 30,
      };
      return ok(this.content(entry));
    }
    if (endpoint === courseContentEndpoints.regenerateLesson) {
      const lesson = generation.lessons.find((item) => item.key === key);
      if (!lesson) return notFound();
      this.reopen(entry, [lesson]);
      return ok(this.content(entry));
    }
    if (endpoint === courseContentEndpoints.decideQuestion) {
      const decision = (request.body as { decision?: QuestionDecision } | null)
        ?.decision;
      if (!decision) {
        return refuse('CORE-VALIDATION_FAILED', 'Chọn một quyết định.');
      }
      generation.decisions.set(`${key}/${request.params['index']}`, decision);
      return ok(this.content(entry));
    }
    if (endpoint === courseContentEndpoints.retry) {
      const failed = generation.lessons.filter((lesson) => lesson.failed);
      if (failed.length === 0) {
        return refuse('NOTHING_FAILED', 'Không có bước nào bị lỗi.');
      }
      this.reopen(entry, failed);
      return ok(this.content(entry));
    }
    // createDraft
    const ready =
      generation.locked &&
      generation.lessons.length > 0 &&
      generation.lessons.every(
        (lesson) => lesson.ticks >= DONE_TICKS && !lesson.failed,
      );
    if (!ready) {
      return refuse(
        'STEP_NOT_READY',
        'Cần viết xong mọi bài học trước khi tạo bản nháp.',
      );
    }
    entry.job = {
      ...entry.job,
      status: 'completed',
      step: 'draft',
      progress: 100,
      createdDraftId: entry.job.createdDraftId ?? 100 + entry.job.jobId,
    };
    return ok(entry.job);
  }

  /** The lessons are written again; the others and the questions stay. */
  private reopen(entry: MockJob, lessons: readonly MockLesson[]): void {
    for (const lesson of lessons) {
      lesson.ticks = 0;
      lesson.failed = false;
      lesson.flaky = false;
    }
    entry.job = {
      ...entry.job,
      status: 'running',
      step: 'lesson',
      error: null,
    };
  }

  /** The model writes on: every look at an approved job finishes one more step of each lesson. */
  private write(entry: MockJob): void {
    const generation = entry.generation;
    if (!generation?.locked || entry.job.status !== 'running') return;
    for (const lesson of generation.lessons) {
      if (lesson.failed || lesson.ticks >= DONE_TICKS) continue;
      lesson.ticks += 1;
      if (lesson.ticks >= DONE_TICKS && lesson.flaky) {
        lesson.failed = true;
        lesson.ticks = DONE_TICKS - 1;
      }
    }
    const total = generation.lessons.length;
    const done = generation.lessons.filter((l) => l.ticks >= DONE_TICKS).length;
    const failed = generation.lessons.some((l) => l.failed);
    const working = generation.lessons.some(
      (l) => !l.failed && l.ticks < DONE_TICKS,
    );
    if (failed && !working) {
      entry.job = { ...entry.job, status: 'failed', error: LESSON_FAILURE };
    } else if (done === total) {
      entry.job = {
        ...entry.job,
        status: 'waiting_approval',
        step: 'review',
        progress: 100,
      };
    } else {
      entry.job = {
        ...entry.job,
        progress: 30 + Math.floor((70 * done) / total),
      };
    }
  }

  private content(entry: MockJob): CourseContent {
    const generation = entry.generation;
    const job = entry.job;
    const written = (lesson: MockLesson) =>
      lesson.ticks >= DONE_TICKS && !lesson.failed;
    const lessons = (generation?.lessons ?? []).map((lesson) => ({
      key: lesson.key,
      title: lesson.title,
      status: lesson.failed
        ? 'failed'
        : written(lesson)
          ? 'done'
          : lesson.ticks > 0
            ? 'running'
            : 'pending',
      error: lesson.failed ? LESSON_FAILURE : null,
      blocks: written(lesson)
        ? [
            {
              type: 'text' as const,
              title: lesson.title,
              body: `Nội dung **mẫu** viết từ tài liệu nguồn.\n\n- Ý chính thứ nhất\n- Ý chính thứ hai`,
            },
            {
              type: 'process' as const,
              title: 'Các bước',
              steps: [
                { title: 'Chuẩn bị', description: 'Mở báo cáo cuối ngày.' },
                { title: 'Đối chiếu', description: 'So khớp số liệu hai bên.' },
              ],
            },
          ]
        : null,
      sourceNotes: written(lesson)
        ? [{ note: 'Mục 2, trang 3 của tài liệu nguồn.' }]
        : null,
    }));
    const questions = (generation?.lessons ?? [])
      .filter(written)
      .map((lesson) => ({
        lessonKey: lesson.key,
        status: 'done',
        error: null,
        questions: [0, 1].map((index) => ({
          type: 'SINGLE' as const,
          content: `Câu ${index + 1} về bài “${lesson.title}”?`,
          explanation: 'Theo mục 2 của tài liệu nguồn.',
          difficulty: 'EASY' as const,
          options: [
            { content: 'Đáp án đúng', correct: true },
            { content: 'Đáp án sai', correct: false },
          ],
          decision:
            generation?.decisions.get(`${lesson.key}/${index}`) ?? 'pending',
        })),
      }));
    return {
      jobId: job.jobId,
      status: job.status,
      step: job.step ?? null,
      progress: job.progress,
      error: job.error ?? null,
      outline: generation?.outline ?? null,
      outlineLocked: generation?.locked ?? false,
      lessons,
      questions,
      createdDraftId: job.createdDraftId ?? null,
    };
  }

  /** Each look at a live job moves it forward; one that waits for approval stays there. */
  private advance(entry: MockJob): void {
    if (entry.generation?.locked) return;
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
    if (next.status === 'waiting_approval' && !entry.generation) {
      entry.generation = {
        outline: sampleOutline(entry.job.inputs),
        locked: false,
        lessons: [],
        decisions: new Map(),
      };
    }
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
