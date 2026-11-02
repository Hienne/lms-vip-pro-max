import {
  authV1Endpoints,
  feedbackEndpoints as e,
  learnerEndpoints,
  LessonFeedbackSchema,
  type AnyEndpoint,
  type CourseCard,
  type FeedbackView,
  type LessonFeedback,
  type LessonRatingResult,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';
import { MAX_SENDS_PER_DAY } from './learner-feedback';

describe('the lesson feedback of the mock backend', () => {
  let backend: FakeBackend;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T09:00:00Z'));
    backend = new FakeBackend();
  });
  afterEach(() => vi.useRealTimers());

  const call = (
    endpoint: AnyEndpoint,
    token: string,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token,
      params: request.params ?? {},
      query: request.query ?? {},
      body: request.body,
    }) as FakeReply;

  const login = (username: string): string =>
    (
      backend.handle(authV1Endpoints.login, {
        token: null,
        params: {},
        query: {},
        body: { username, password: SEED_PASSWORD },
      })?.body.data as { accessToken: string }
    ).accessToken;

  const hocvien = () => login('hocvien');
  const tichhop = () => login('hocvien.tichhop');

  /** The lesson the seed sits on: the first of course 1 with a PDF, and its block. */
  const spot = (token: string) => {
    const course = call(learnerEndpoints.course, token, {
      params: { courseId: '1' },
    }).body.data as {
      content: {
        chapters: {
          lessons: {
            lesson: { id: number };
            blocks: { block: { id: number; blockType: string } }[];
          }[];
        }[];
      };
    };
    for (const chapter of course.content.chapters) {
      for (const { lesson, blocks } of chapter.lessons) {
        const pdf = blocks.find((b) => b.block.blockType === 'pdf');
        if (pdf) return { lessonId: lesson.id, blockId: pdf.block.id };
      }
    }
    throw new Error('no pdf block');
  };

  const params = (lessonId: number) => ({ lessonId: String(lessonId) });
  const code = (reply: FakeReply) => reply.body.messageCode;
  const view = (token: string, lessonId: number) =>
    LessonFeedbackSchema.parse(
      call(e.lessonFeedback, token, { params: params(lessonId) }).body.data,
    );
  const send = (
    token: string,
    lessonId: number,
    kind: string,
    text: string,
    anchor: unknown = { type: 'none' },
  ) =>
    call(e.sendFeedback, token, {
      params: params(lessonId),
      body: { kind, text, anchor },
    });

  it('seeds a rating, a comment and the learner’s own question and report', () => {
    const token = hocvien();
    const { lessonId } = spot(token);
    const seen = view(token, lessonId);
    expect(seen.rating).toEqual({ average: 4.5, count: 2 });
    expect(seen.myStars).toBe(4);
    expect(seen.comments.items.map((c) => [c.authorName, c.mine])).toEqual([
      ['Học viên tiền gửi Demo', true],
      ['Học viên tích hợp Demo', false],
    ]);
    expect(seen.mine.map((m) => [m.kind, m.status])).toEqual([
      ['report', 'new'],
      ['question', 'answered'],
    ]);
    expect(seen.mine[1].reply).not.toBeNull();
  });

  it('shows the other learner the comments and the rating but never the questions or reports', () => {
    const { lessonId } = spot(tichhop());
    const seen = view(tichhop(), lessonId);
    expect(seen.myStars).toBe(5);
    expect(seen.rating).toEqual({ average: 4.5, count: 2 });
    expect(seen.comments.items.map((c) => c.mine)).toEqual([false, true]);
    expect(seen.mine).toEqual([]);
  });

  it('keeps one rating per learner: the last stars replace the first', () => {
    const token = hocvien();
    const { lessonId } = spot(token);
    const rate = (stars: number) =>
      call(e.rateLesson, token, {
        params: params(lessonId),
        body: { stars },
      });
    rate(2);
    const reply = rate(5).body.data as LessonRatingResult;
    expect(reply).toEqual({ average: 5, count: 2, myStars: 5 });
    expect(view(token, lessonId).myStars).toBe(5);
  });

  it.each([0, 6, 2.5])('refuses %s stars', (stars) => {
    const token = hocvien();
    const { lessonId } = spot(token);
    expect(
      code(
        call(e.rateLesson, token, {
          params: params(lessonId),
          body: { stars },
        }),
      ),
    ).toBe('CORE-VALIDATION_FAILED');
  });

  it('saves each kind with its status and trims the text', () => {
    const token = hocvien();
    const { lessonId, blockId } = spot(token);
    const pdf = { type: 'pdf', blockId, page: 3 };
    const comment = send(token, lessonId, 'comment', '  Trang ba rõ  ', pdf)
      .body.data as FeedbackView;
    expect(comment).toMatchObject({
      kind: 'comment',
      text: 'Trang ba rõ',
      status: null,
      anchor: { type: 'pdf', blockId, page: 3, second: null },
    });
    const question = send(token, lessonId, 'question', 'Hỏi giảng viên?').body
      .data as FeedbackView;
    expect(question).toMatchObject({ kind: 'question', status: 'new' });
    const report = send(token, lessonId, 'report', 'Sai thông tin').body
      .data as FeedbackView;
    expect(report).toMatchObject({ kind: 'report', status: 'new' });

    const seen = view(token, lessonId);
    expect(seen.comments.items[0].text).toBe('Trang ba rõ');
    expect(seen.mine.slice(0, 2).map((m) => m.kind)).toEqual([
      'report',
      'question',
    ]);
  });

  it('holds the text to 5 to 1000 characters after trimming and refuses a rating kind', () => {
    const token = hocvien();
    const { lessonId } = spot(token);
    const refused = 'CORE-VALIDATION_FAILED';
    expect(code(send(token, lessonId, 'comment', ' abcd '))).toBe(refused);
    expect(code(send(token, lessonId, 'comment', 'a'.repeat(1001)))).toBe(
      refused,
    );
    expect(code(send(token, lessonId, 'rating', 'Năm sao'))).toBe(refused);
    expect(code(send(token, lessonId, 'comment', 'abcde'))).toBe(
      'CORE-SUCCESS',
    );
    expect(code(send(token, lessonId, 'comment', 'a'.repeat(1000)))).toBe(
      'CORE-SUCCESS',
    );
  });

  it('refuses an anchor outside the file', () => {
    const token = hocvien();
    const { lessonId, blockId } = spot(token);
    expect(
      code(
        send(token, lessonId, 'comment', 'Trang năm mươi', {
          type: 'pdf',
          blockId,
          page: 50,
        }),
      ),
    ).toBe('LEARNING-INVALID_REFERENCE');
  });

  it('stops the 21st send of the learning day, and starts again the next day', () => {
    const token = hocvien();
    const { lessonId } = spot(token);
    // The seed already counts for nothing today: it is three days old.
    for (let i = 1; i <= MAX_SENDS_PER_DAY; i++) {
      expect(code(send(token, lessonId, 'comment', `Lần gửi ${i}`))).toBe(
        'CORE-SUCCESS',
      );
    }
    expect(code(send(token, lessonId, 'comment', 'Lần gửi 21'))).toBe(
      'LEARNING-FEEDBACK_LIMIT',
    );
    // Rating is not a send.
    expect(
      code(
        call(e.rateLesson, token, {
          params: params(lessonId),
          body: { stars: 3 },
        }),
      ),
    ).toBe('CORE-SUCCESS');
    vi.setSystemTime(new Date('2026-11-03T09:00:00Z'));
    expect(code(send(token, lessonId, 'comment', 'Sang ngày mới'))).toBe(
      'CORE-SUCCESS',
    );
  });

  it('pages the comments newest first', () => {
    const token = hocvien();
    const { lessonId } = spot(token);
    // 20 sends is the day's limit, so the 21st comes the next day.
    for (let i = 1; i <= 20; i++) {
      send(token, lessonId, 'comment', `Nhận xét ${i}`);
    }
    vi.setSystemTime(new Date('2026-11-03T09:00:00Z'));
    send(token, lessonId, 'comment', 'Nhận xét 21');
    const first = view(token, lessonId).comments;
    expect(first).toMatchObject({ page: 0, size: 20, totalElements: 23 });
    expect(first.items[0].text).toBe('Nhận xét 21');
    const next = call(e.lessonComments, token, {
      params: params(lessonId),
      query: { page: '1', size: '20' },
    }).body.data as LessonFeedback['comments'];
    expect(next.items.map((c) => c.text)).toEqual([
      'Nhận xét 1',
      expect.any(String),
      expect.any(String),
    ]);
    expect(
      code(
        call(e.lessonComments, token, {
          params: params(lessonId),
          query: { size: '101' },
        }),
      ),
    ).toBe('CORE-VALIDATION_FAILED');
  });

  it('answers not found for a lesson the caller does not hold', () => {
    const token = hocvien();
    expect(
      code(call(e.lessonFeedback, token, { params: params(999_999) })),
    ).toBe('LEARNING-NOT_FOUND');
    expect(
      code(
        call(e.rateLesson, token, {
          params: params(999_999),
          body: { stars: 4 },
        }),
      ),
    ).toBe('LEARNING-NOT_FOUND');
  });

  it('carries the course rating on the cards and the course, null when nobody rated', () => {
    const token = hocvien();
    const { lessonId } = spot(token);
    const courseCard = (id: string) =>
      (
        call(learnerEndpoints.course, token, { params: { courseId: id } }).body
          .data as { card: CourseCard }
      ).card;
    expect(courseCard('1').rating).toEqual({ average: 4.5, count: 2 });
    expect(courseCard('2').rating).toBeNull();
    const catalog = call(learnerEndpoints.catalog, token, {
      query: { size: '100' },
    }).body.data as { items: CourseCard[] };
    expect(catalog.items.find((c) => c.courseId === 1)?.rating).toEqual({
      average: 4.5,
      count: 2,
    });
    call(e.rateLesson, token, {
      params: params(lessonId),
      body: { stars: 1 },
    });
    expect(courseCard('1').rating).toEqual({ average: 3, count: 2 });
  });
});
