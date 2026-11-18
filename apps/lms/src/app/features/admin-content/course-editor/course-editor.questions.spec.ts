import { AI_COURSE_COMPOSE_ENABLED } from '../../../core/course-jobs/course-job-access';
import { TestBed } from '@angular/core/testing';
import {
  courseContentEndpoints,
  courseEndpoints,
  courseJobEndpoints,
  type CourseContent,
  type CourseDetail,
  type CourseJob,
  type ProposalState,
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
  status: 'completed',
  step: null,
  progress: 100,
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

const question = (content: string, decision?: ProposalState) => ({
  type: 'SINGLE' as const,
  content,
  explanation: null,
  difficulty: 'EASY' as const,
  options: [
    { content: 'Đúng', correct: true },
    { content: 'Sai', correct: false },
  ],
  decision,
});

const contentOf = (decisions: readonly (ProposalState | undefined)[]) =>
  ({
    jobId: 7,
    status: 'completed',
    progress: 100,
    outlineLocked: true,
    lessons: [{ key: 'c1l1', title: 'Đối soát', status: 'done' }],
    questions: [
      {
        lessonKey: 'c1l1',
        status: 'done',
        questions: decisions.map((decision, index) =>
          question(`Câu ${index + 1}?`, decision),
        ),
      },
    ],
  }) satisfies CourseContent;

// The AI job UI is hidden while AI_COURSE_COMPOSE_ENABLED is off.
describe.skipIf(!AI_COURSE_COMPOSE_ENABLED)(
  'CourseEditor step 3 with proposed questions',
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

    /**
     * The course is the AI's and its job is `job`. The server keeps the decisions in `decisions`
     * (what a reload reads back): accepting turns a proposal into `added`, as the backend does.
     */
    function aiCourse(
      job: CourseJob,
      decisions: (ProposalState | undefined)[],
    ): void {
      screen.calls.mockImplementation((endpoint, request) => {
        if (endpoint === courseEndpoints.getCourse) {
          const detail = (
            original(endpoint, request).body as { data: CourseDetail }
          ).data;
          return ok({
            ...detail,
            revision: { ...detail.revision, aiGenerated: true },
          });
        }
        if (endpoint === courseJobEndpoints.list) {
          return ok([{ ...job, sourceFileName: null, createdDraftId: null }]);
        }
        if (endpoint === courseJobEndpoints.get) return ok(job);
        if (endpoint === courseContentEndpoints.content) {
          return ok(contentOf(decisions));
        }
        if (endpoint === courseContentEndpoints.decideQuestion) {
          const index = Number(request.params['index']);
          const decision = (request.body as { decision: string }).decision;
          decisions[index] = decision === 'accepted' ? 'added' : 'rejected';
          return ok(contentOf(decisions));
        }
        if (endpoint === courseContentEndpoints.retry) {
          return ok(contentOf(decisions));
        }
        return original(endpoint, request);
      });
    }

    const openStep3 = async () => {
      await screen.open(`/admin/courses/${COURSE}/edit?step=2`);
      await screen.settle();
    };

    it('lists the proposed questions by lesson with accept and reject', async () => {
      aiCourse(jobOf(), [undefined, 'pending']);
      await openStep3();

      expect(screen.text()).toContain('Câu hỏi AI đề xuất');
      expect(screen.text()).toContain('Bài 1.1: Đối soát');
      expect(screen.text()).toContain('Câu 1?');
      expect(screen.text()).toContain('Câu 2?');
      expect(screen.el.querySelectorAll('button').length).toBeGreaterThan(0);
      expect(
        [...screen.el.querySelectorAll('button')].filter(
          (b) => b.textContent?.trim() === 'Chấp nhận',
        ),
      ).toHaveLength(2);
    });

    it('adds an accepted question and keeps it listed as added', async () => {
      aiCourse(jobOf(), [undefined, undefined]);
      await openStep3();

      await screen.click(screen.button('Chấp nhận'));

      expect(
        screen.lastCall(courseContentEndpoints.decideQuestion),
      ).toMatchObject({
        params: { jobId: '7', key: 'c1l1', index: '0' },
        body: { decision: 'accepted' },
      });
      await screen.settle();
      expect(screen.text()).toContain('Đã thêm vào ngân hàng câu hỏi');
      expect(screen.text()).toContain('Câu 2?');
    });

    it('removes a rejected proposal from the list', async () => {
      aiCourse(jobOf(), [undefined, undefined]);
      await openStep3();

      await screen.click(screen.button('Từ chối'));

      expect(
        screen.lastCall(courseContentEndpoints.decideQuestion),
      ).toMatchObject({ body: { decision: 'rejected' } });
      await screen.settle();
      expect(screen.text()).not.toContain('Câu 1?');
      expect(screen.text()).toContain('Câu 2?');
    });

    it('shows the decisions the server kept after a reload', async () => {
      aiCourse(jobOf(), ['added', 'rejected', undefined]);
      await openStep3();

      expect(screen.text()).toContain('Câu 1?');
      expect(screen.text()).toContain('Đã thêm vào ngân hàng câu hỏi');
      expect(screen.text()).not.toContain('Câu 2?');
      expect(screen.text()).toContain('Câu 3?');
    });

    it('reports a failed question step here and retries it', async () => {
      aiCourse(
        jobOf({ status: 'failed', step: 'questions', error: 'Mô hình lỗi' }),
        [],
      );
      await openStep3();

      expect(screen.text()).toContain('AI không đề xuất được câu hỏi');
      expect(screen.text()).toContain('Mô hình lỗi');
      await screen.click(screen.button('Thử lại'));

      expect(screen.callsTo(courseContentEndpoints.retry)).toBe(1);
    });

    it('shows nothing about proposals for a course the AI did not start', async () => {
      await openStep3();

      expect(screen.text()).not.toContain('Câu hỏi AI đề xuất');
      expect(screen.callsTo(courseContentEndpoints.content)).toBe(0);
    });
  },
);
