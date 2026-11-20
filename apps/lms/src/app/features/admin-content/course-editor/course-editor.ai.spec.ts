import { AI_COURSE_COMPOSE_ENABLED } from '../../../core/course-jobs/course-job-access';
import { TestBed } from '@angular/core/testing';
import {
  courseContentEndpoints,
  courseEndpoints,
  courseJobEndpoints,
  type CourseDetail,
  type CourseJob,
  type LessonAiState,
} from '@lms/contracts';
import { envelopeOk, type FakeReply } from '@lms/mocks';
import { setUpAdminScreen } from '../../../core/dev/mock-api/admin-screen.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import { FakeHasher } from './data-access/fake-hasher.testing';
import { Sha256Hasher } from './data-access/sha256-hasher';

const COURSE = 6;

const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});

const jobOf = (patch: Partial<CourseJob> = {}): CourseJob => ({
  jobId: 7,
  status: 'running',
  step: 'lesson',
  progress: 40,
  error: null,
  inputs: {
    targetLearners: 'Giao dịch viên mới',
    level: 'BEGINNER',
    chapters: 2,
    programmeId: 5,
    competencyId: 9,
  },
  ownerOrgId: 1,
  steps: [],
  createTime: '2026-11-12T08:00:00+07:00',
  updateTime: '2026-11-12T08:00:00+07:00',
  courseId: COURSE,
  revisionId: 300,
  ...patch,
});

const content = {
  jobId: 7,
  status: 'running',
  progress: 40,
  outlineLocked: true,
  lessons: [],
  questions: [],
};

// The AI job UI is hidden while AI_COURSE_COMPOSE_ENABLED is off.
describe.skipIf(!AI_COURSE_COMPOSE_ENABLED)(
  'CourseEditor step 2 with an AI job',
  () => {
    const screen = setUpAdminScreen([
      { provide: Sha256Hasher, useValue: new FakeHasher() },
    ]);

    const original = (endpoint: unknown, request: unknown): FakeReply =>
      MockBackend.prototype.handle.call(
        TestBed.inject(MockBackend),
        endpoint as never,
        request as never,
      ) as FakeReply;

    /** The course is the AI's: its first lessons take `states` in order, and the job is `job`. */
    function aiCourse(job: CourseJob, states: readonly LessonAiState[]) {
      screen.calls.mockImplementation((endpoint, request) => {
        if (endpoint === courseEndpoints.getCourse) {
          const reply = original(endpoint, request);
          const detail = (reply.body as { data: CourseDetail }).data;
          let next = 0;
          return ok({
            ...detail,
            revision: { ...detail.revision, aiGenerated: true },
            chapters: detail.chapters.map((chapter) => ({
              ...chapter,
              lessons: chapter.lessons.map((entry) => ({
                ...entry,
                lesson: { ...entry.lesson, aiState: states[next++] ?? null },
              })),
            })),
          });
        }
        if (endpoint === courseJobEndpoints.list) {
          return ok([{ ...job, sourceFileName: null, createdDraftId: null }]);
        }
        if (endpoint === courseJobEndpoints.get) return ok(job);
        if (
          endpoint === courseJobEndpoints.stop ||
          endpoint === courseContentEndpoints.retry ||
          endpoint === courseContentEndpoints.approveOutline ||
          endpoint === courseContentEndpoints.regenerateLesson
        ) {
          return ok(endpoint === courseJobEndpoints.stop ? job : content);
        }
        return original(endpoint, request);
      });
    }

    const openStep2 = async () => {
      await screen.open(`/admin/courses/${COURSE}/edit?step=1`);
      await screen.settle();
    };

    it('shows what the AI does and the state of each lesson', async () => {
      aiCourse(jobOf(), ['writing']);
      await openStep2();

      expect(screen.text()).toContain('Đang viết bài 1/1…');
      expect(screen.text()).toContain('AI đang viết');
      expect(
        screen.el.querySelector('button[aria-label="AI đang viết bài này"]'),
      ).toBeTruthy();
    });

    it('disables adding and removing chapters and lessons while the lessons are written, and says why', async () => {
      aiCourse(jobOf(), ['written', 'writing', 'pending']);
      await openStep2();

      expect(screen.text()).toContain('AI đang viết bài nên chưa thể thêm');
      expect(screen.button('Thêm chương')).toBeUndefined();
      expect(screen.button('Thêm bài học')).toBeUndefined();
      expect(
        (screen.button('Xóa chương 1') as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('keeps the structure editable before the outline is approved, and approves it', async () => {
      aiCourse(
        jobOf({ status: 'waiting_approval', step: 'outline', progress: 30 }),
        ['pending', 'pending', 'pending'],
      );
      await openStep2();

      expect(screen.button('Thêm chương')).toBeDefined();
      await screen.click(screen.button('Duyệt dàn ý và viết bài'));

      expect(screen.callsTo(courseContentEndpoints.approveOutline)).toBe(1);
    });

    it('stops the job after a confirm', async () => {
      aiCourse(jobOf(), ['written', 'writing', 'pending']);
      await openStep2();

      await screen.click(screen.button('Dừng tạo bằng AI'));
      expect(screen.callsTo(courseJobEndpoints.stop)).toBe(0);
      await screen.click(screen.button('Dừng tạo', screen.alertDialog()!));

      expect(screen.callsTo(courseJobEndpoints.stop)).toBe(1);
    });

    it('reports the failure at its step and retries it', async () => {
      aiCourse(
        jobOf({
          status: 'failed',
          step: 'outline',
          error: 'Mô hình trả về dữ liệu không hợp lệ',
        }),
        ['pending', 'pending', 'pending'],
      );
      await openStep2();

      expect(screen.text()).toContain('AI không tạo được dàn ý');
      expect(screen.text()).toContain('Mô hình trả về dữ liệu không hợp lệ');
      await screen.click(screen.button('Thử lại'));

      expect(screen.callsTo(courseContentEndpoints.retry)).toBe(1);
    });

    it('rewrites one lesson from its drawer after a confirm', async () => {
      aiCourse(jobOf({ status: 'completed', step: null, progress: 100 }), [
        'user_edited',
      ]);
      await openStep2();

      await screen.click(
        screen.el.querySelector<HTMLElement>(
          'ui-sortable-item button[aria-label="Sửa bài học"]',
        ) ?? undefined,
      );
      await screen.click(screen.button('Viết lại bằng AI', screen.drawer()!));
      await screen.click(screen.button('Viết lại', screen.alertDialog()!));

      expect(screen.callsTo(courseContentEndpoints.regenerateLesson)).toBe(1);
      expect(
        screen.lastCall(courseContentEndpoints.regenerateLesson),
      ).toMatchObject({ params: { key: 'c1l1' } });
    });
  },
);
