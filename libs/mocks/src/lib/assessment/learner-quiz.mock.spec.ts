import {
  assessmentV1Endpoints,
  learnerQuizEndpoints as e,
  type AnyEndpoint,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { courseDetailFixtures } from '../learning/learning.fixtures';

function call(
  backend: FakeBackend,
  endpoint: AnyEndpoint,
  params: Record<string, string> = {},
  body?: unknown,
  query: Record<string, string> = {},
) {
  const reply = backend.handle(endpoint, {
    token: null,
    params,
    query,
    body,
  }) as FakeReply;
  return { reply, data: reply.body.data as never };
}

const data = <T>(value: { data: unknown }) => value.data as T;

describe('the learner quiz mock', () => {
  it('answers every learner quiz endpoint', () => {
    const backend = new FakeBackend();
    for (const endpoint of Object.values(e)) {
      expect(backend.answers(endpoint), endpoint.path).toBe(true);
    }
  });

  it('lists a course’s quizzes with the final exam last, each parsing its contract', () => {
    const backend = new FakeBackend();
    const { data: cards } = call(backend, e.courseQuizzes, { courseId: '1' });
    expect(() => e.courseQuizzes.response.parse(cards)).not.toThrow();
    const types = (cards as { quiz: { quizType: string } }[]).map(
      (c) => c.quiz.quizType,
    );
    expect(types).toEqual(['PRACTICE', 'FINAL_EXAM']);
  });

  it('links each final exam to the quiz lesson the learning mock serves for the course', () => {
    const backend = new FakeBackend();
    for (const courseId of [1, 2]) {
      const { data: cards } = call(backend, e.courseQuizzes, {
        courseId: String(courseId),
      });
      const exam = (
        cards as { quiz: { quizType: string }; lessonId: number | null }[]
      ).find((c) => c.quiz.quizType === 'FINAL_EXAM')!;
      const detail = courseDetailFixtures.find(
        (d) => d.course.id === courseId,
      )!;
      const quizLesson = detail.chapters
        .flatMap((c) => c.lessons)
        .find((l) => l.lesson.lessonType === 'quiz')!;
      expect(exam.lessonId).toBe(quizLesson.lesson.id);
    }
  });

  it('reports a block the server would, and refuses to start behind it', () => {
    const backend = new FakeBackend();
    const intro = call(backend, e.quizIntro, { quizId: '3' }).data as {
      canStart: boolean;
      blockReason: string;
    };
    expect(intro.canStart).toBe(false);
    expect(intro.blockReason).toBe('LESSONS_REQUIRED');
    const refused = call(backend, e.startAttempt, { quizId: '3' }).reply;
    expect(refused.body.status).toBe('ERROR');
  });

  it('runs start → save → reload → submit → result, and then blocks a passed final exam', () => {
    const backend = new FakeBackend();
    const session = data<{
      attemptId: number;
      questions: {
        attemptQuestionId: number;
        options: { id: number }[];
      }[];
    }>(call(backend, e.startAttempt, { quizId: '2' }));
    expect(() => e.startAttempt.response.parse(session)).not.toThrow();
    expect(JSON.stringify(session)).not.toMatch(/correct|explanation/);

    const first = session.questions[0];
    const receipt = call(
      backend,
      e.saveAnswer,
      {
        attemptId: String(session.attemptId),
        attemptQuestionId: String(first.attemptQuestionId),
      },
      { selectedOptionIds: [first.options[0].id], flagged: true },
    );
    expect(() => e.saveAnswer.response.parse(receipt.data)).not.toThrow();

    const reloaded = data<{
      questions: { selectedOptionIds: number[]; flagged: boolean }[];
    }>(
      call(backend, e.attemptSession, { attemptId: String(session.attemptId) }),
    );
    expect(reloaded.questions[0].selectedOptionIds).toEqual([
      first.options[0].id,
    ]);
    expect(reloaded.questions[0].flagged).toBe(true);

    const early = call(backend, e.attemptResult, {
      attemptId: String(session.attemptId),
    }).reply;
    expect(early.body.status).toBe('ERROR');

    const result = call(backend, e.submitAttempt, {
      attemptId: String(session.attemptId),
    }).data;
    expect(() => e.submitAttempt.response.parse(result)).not.toThrow();
    expect(
      call(backend, e.attemptResult, { attemptId: String(session.attemptId) })
        .data,
    ).toEqual(result);

    const intro = call(backend, e.quizIntro, { quizId: '2' }).data as {
      canStart: boolean;
      blockReason: string;
    };
    expect(intro.blockReason).toBe('PASSED');
    const history = call(backend, e.quizHistory, { quizId: '2' }).data;
    expect(() => e.quizHistory.response.parse(history)).not.toThrow();
    const mine = call(backend, e.myAttempts, {}, undefined, { size: '5' }).data;
    expect(() => e.myAttempts.response.parse(mine)).not.toThrow();
    expect((mine as { totalElements: number }).totalElements).toBe(1);
  });

  it('refuses an answer that is not an option of the question, and one after the submit', () => {
    const backend = new FakeBackend();
    const session = data<{
      attemptId: number;
      questions: { attemptQuestionId: number }[];
    }>(call(backend, e.startAttempt, { quizId: '1' }));
    const params = {
      attemptId: String(session.attemptId),
      attemptQuestionId: String(session.questions[0].attemptQuestionId),
    };
    expect(
      call(backend, e.saveAnswer, params, { selectedOptionIds: [999999] }).reply
        .body.status,
    ).toBe('ERROR');
    call(backend, e.submitAttempt, { attemptId: params.attemptId });
    expect(
      call(backend, e.saveAnswer, params, { flagged: true }).reply.body.status,
    ).toBe('ERROR');
  });

  it('exports the attempts as a CSV file', async () => {
    const backend = new FakeBackend();
    const { reply } = call(backend, e.exportAttempts);
    expect(reply.file).toBeInstanceOf(Blob);
    expect(await reply.file?.text()).toContain('Bài kiểm tra');
  });

  it('lists a course’s quizzes for the editor’s picker', () => {
    const { data: page } = call(
      new FakeBackend(),
      assessmentV1Endpoints.courseQuizList,
      {},
      undefined,
      { courseId: '1' },
    );
    expect(() =>
      assessmentV1Endpoints.courseQuizList.response.parse(page),
    ).not.toThrow();
    expect((page as { totalElements: number }).totalElements).toBe(2);
  });

  it('answers the competency read', () => {
    const { data: rows } = call(new FakeBackend(), e.myCompetency);
    const parsed = e.myCompetency.response.parse(rows);
    expect(parsed.some((row) => row.percent === null)).toBe(true);
    expect(parsed.find((row) => row.percent === null)?.totalQuestions).toBe(0);
  });
});
