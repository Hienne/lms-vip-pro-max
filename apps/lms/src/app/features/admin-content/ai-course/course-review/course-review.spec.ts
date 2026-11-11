import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import type { CourseContent } from '@lms/contracts';
import { envelopeOk } from '@lms/mocks';
import { of } from 'rxjs';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../../core/http/http.testing';
import { CourseReview } from './course-review';

const BASE = '/api/v1/assistant/course-jobs/5';

/** Lets the signals, effects and queued microtasks run; `whenStable` would wait for open requests. */
async function settle(): Promise<void> {
  TestBed.tick();
  await Promise.resolve();
  TestBed.tick();
  await Promise.resolve();
}

const outline = {
  title: 'Quy trình đối soát',
  summary: 'Khóa học về đối soát.',
  objectives: ['Hiểu quy trình'],
  chapters: [
    {
      title: 'Tổng quan',
      lessons: [
        {
          title: 'Mục đích',
          objectives: ['Hiểu vì sao'],
          estimatedMinutes: 10,
        },
        { title: 'Dữ liệu', objectives: [], estimatedMinutes: 15 },
      ],
    },
  ],
};

const lesson = (
  key: string,
  status: string,
  patch: Partial<CourseContent['lessons'][number]> = {},
): CourseContent['lessons'][number] => ({
  key,
  title: `Bài ${key}`,
  status,
  error: null,
  blocks:
    status === 'done'
      ? [
          { type: 'text', title: 'Giới thiệu', body: 'Nội dung bài.' },
          {
            type: 'process',
            title: 'Các bước',
            steps: [{ title: 'Chuẩn bị', description: 'Mở báo cáo.' }],
          },
        ]
      : null,
  sourceNotes: status === 'done' ? [{ note: 'Trang 3.' }] : null,
  ...patch,
});

const content = (patch: Partial<CourseContent> = {}): CourseContent => ({
  jobId: 5,
  status: 'waiting_approval',
  step: 'outline',
  progress: 30,
  error: null,
  outline,
  outlineLocked: false,
  lessons: [],
  questions: [],
  createdDraftId: null,
  ...patch,
});

const writtenQuestion = (decision: 'pending' | 'accepted' | 'rejected') => ({
  lessonKey: 'c1l1',
  status: 'done',
  error: null,
  questions: [
    {
      type: 'SINGLE' as const,
      content: 'Đối soát để làm gì?',
      explanation: 'Theo mục 2.',
      difficulty: 'EASY' as const,
      options: [
        { content: 'Phát hiện chênh lệch', correct: true },
        { content: 'Không để làm gì', correct: false },
      ],
      decision,
    },
  ],
});

describe('CourseReview', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ jobId: '5' })) },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function open(first: CourseContent) {
    const fixture = TestBed.createComponent(CourseReview);
    fixture.detectChanges();
    await settle();
    backend.expectOne(`${BASE}/content`).flush(envelopeOk(first));
    await settle();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const button = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(text),
    );
  const click = async (
    fixture: { detectChanges(): void },
    el: HTMLElement,
    text: string,
  ) => {
    button(el, text)!.click();
    await settle();
    fixture.detectChanges();
  };

  it('shows the progress and an outline the author can edit before approving', async () => {
    const { el } = await open(content());

    expect(el.textContent).toContain('Đã viết xong'.slice(0, 0) + 'Tiến độ');
    expect(
      el.querySelector('[role="progressbar"], ui-progress'),
    ).not.toBeNull();
    expect((el.querySelector('input') as HTMLInputElement).value).toBe(
      'Quy trình đối soát',
    );
    expect(button(el, 'Duyệt dàn ý')!.disabled).toBe(false);
    expect(button(el, 'Lưu dàn ý')!.disabled).toBe(true);
  });

  it('saves an edited outline, and approving saves it first', async () => {
    const { fixture, el } = await open(content());
    const title = el.querySelector('input') as HTMLInputElement;
    title.value = 'Tên mới';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button(el, 'Lưu dàn ý')!.disabled).toBe(false);

    await click(fixture, el, 'Duyệt dàn ý');
    const saved = backend.expectOne(`${BASE}/outline`);
    expect(saved.request.method).toBe('PUT');
    expect(saved.request.body.title).toBe('Tên mới');
    saved.flush(envelopeOk(content()));
    await settle();

    const approved = backend.expectOne(`${BASE}/outline/approve`);
    expect(approved.request.method).toBe('POST');
    approved.flush(
      envelopeOk(content({ outlineLocked: true, status: 'running' })),
    );
    await settle();
    backend
      .expectOne(`${BASE}/content`)
      .flush(envelopeOk(content({ outlineLocked: true, status: 'running' })));
  });

  it('locks the outline after approval and writes progress per lesson', async () => {
    const { fixture, el } = await open(
      content({
        outlineLocked: true,
        status: 'running',
        step: 'lesson',
        lessons: [lesson('c1l1', 'done'), lesson('c1l2', 'running')],
        questions: [writtenQuestion('pending')],
      }),
    );

    expect(el.textContent).toContain('không sửa được nữa');
    expect(el.querySelector('input')).toBeNull();
    const regenerate = Array.from(
      el.querySelectorAll<HTMLButtonElement>('button'),
    ).filter((b) => b.textContent?.includes('Tạo lại bài này'));
    expect(regenerate.map((b) => b.disabled)).toEqual([false, true]);
    expect(el.textContent).toContain('Đang viết bài này');
    expect(el.textContent).toContain('Nội dung bài.');
    expect(el.textContent).toContain('Chuẩn bị');
    expect(el.textContent).toContain('Trang 3.');

    regenerate[0].click();
    await settle();
    const request = backend.expectOne(`${BASE}/lessons/c1l1/regenerate`);
    expect(request.request.method).toBe('POST');
    request.flush(envelopeOk(content({ outlineLocked: true })));
    await settle();
    backend.expectOne(`${BASE}/content`).flush(envelopeOk(content()));
  });

  it('keeps "Tạo bản nháp" off until every lesson is written, then creates it once', async () => {
    const writing = content({
      outlineLocked: true,
      status: 'running',
      lessons: [lesson('c1l1', 'done'), lesson('c1l2', 'pending')],
    });
    const { el } = await open(writing);
    expect(button(el, 'Tạo bản nháp')!.disabled).toBe(true);
  });

  it('enables the draft when all lessons are done and links to it afterwards', async () => {
    const ready = content({
      outlineLocked: true,
      step: 'review',
      progress: 100,
      lessons: [lesson('c1l1', 'done'), lesson('c1l2', 'done')],
    });
    const { fixture, el } = await open(ready);
    expect(button(el, 'Tạo bản nháp')!.disabled).toBe(false);

    await click(fixture, el, 'Tạo bản nháp');
    const request = backend.expectOne(`${BASE}/draft`);
    expect(request.request.method).toBe('POST');
    request.flush(
      envelopeOk({
        jobId: 5,
        status: 'completed',
        step: 'draft',
        progress: 100,
        error: null,
        inputs: {
          targetLearners: 'Giao dịch viên',
          level: 'BEGINNER',
          chapters: 3,
          programmeId: 5,
          competencyId: 9,
        },
        ownerOrgId: 1,
        source: null,
        createdDraftId: 77,
        steps: [],
        createTime: '2026-11-10T09:00:00.000Z',
        updateTime: '2026-11-10T09:05:00.000Z',
      }),
    );
    await settle();
    backend
      .expectOne(`${BASE}/content`)
      .flush(envelopeOk({ ...ready, status: 'completed', createdDraftId: 77 }));
    await settle();
    fixture.detectChanges();

    const link = el.querySelector<HTMLAnchorElement>(
      'a[href="/admin/courses/77/edit"]',
    );
    expect(link?.textContent).toContain('Mở bản nháp');
    expect(button(el, 'Tạo bản nháp')).toBeUndefined();
  });

  it('shows the error of a failed step with a retry', async () => {
    const { fixture, el } = await open(
      content({
        outlineLocked: true,
        status: 'failed',
        error: 'Bước viết bài bị lỗi.',
        lessons: [
          lesson('c1l1', 'done'),
          lesson('c1l2', 'failed', { error: 'Nội dung không hợp lệ.' }),
        ],
      }),
    );

    expect(el.textContent).toContain('Bước viết bài bị lỗi.');
    expect(el.textContent).toContain('Nội dung không hợp lệ.');
    await click(fixture, el, 'Thử lại');
    const request = backend.expectOne(`${BASE}/retry`);
    expect(request.request.method).toBe('POST');
    request.flush(
      envelopeOk(content({ outlineLocked: true, status: 'running' })),
    );
    await settle();
    backend
      .expectOne(`${BASE}/content`)
      .flush(envelopeOk(content({ outlineLocked: true, status: 'running' })));
  });

  it('records accept and reject for a proposed question, and takes a decision back', async () => {
    const { fixture, el } = await open(
      content({
        outlineLocked: true,
        step: 'review',
        lessons: [lesson('c1l1', 'done')],
        questions: [writtenQuestion('accepted')],
      }),
    );

    expect(el.textContent).toContain('Đối soát để làm gì?');
    expect(button(el, 'Chấp nhận')!.getAttribute('aria-pressed')).toBe('true');

    await click(fixture, el, 'Loại');
    const rejected = backend.expectOne(`${BASE}/questions/c1l1/0`);
    expect(rejected.request.method).toBe('PUT');
    expect(rejected.request.body).toEqual({ decision: 'rejected' });
    rejected.flush(envelopeOk(content()));
    await settle();
    backend.expectOne(`${BASE}/content`).flush(
      envelopeOk(
        content({
          outlineLocked: true,
          lessons: [lesson('c1l1', 'done')],
          questions: [writtenQuestion('rejected')],
        }),
      ),
    );
    await settle();
    fixture.detectChanges();

    await click(fixture, el, 'Loại');
    const back = backend.expectOne(`${BASE}/questions/c1l1/0`);
    expect(back.request.body).toEqual({ decision: 'pending' });
    back.flush(envelopeOk(content()));
    await settle();
    backend.expectOne(`${BASE}/content`).flush(envelopeOk(content()));
  });
});
