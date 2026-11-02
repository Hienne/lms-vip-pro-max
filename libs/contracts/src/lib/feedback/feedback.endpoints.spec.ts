import { capturedFeedback as captured } from './feedback.captured';
import { feedbackEndpoints as e } from './feedback.endpoints';
import {
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MIN_LENGTH,
  RateLessonCommandSchema,
  SendFeedbackCommandSchema,
} from './feedback.schema';
import { CourseCardSchema } from '../course/course.schema';
import { EnvelopeSchema } from '../http/envelope';

describe('feedbackEndpoints', () => {
  it.each([
    ['lessonFeedback', e.lessonFeedback, captured.lessonFeedback],
    [
      'lessonFeedback (other learner)',
      e.lessonFeedback,
      captured.lessonFeedbackOther,
    ],
    [
      'lessonFeedback (nothing yet)',
      e.lessonFeedback,
      captured.lessonFeedbackEmpty,
    ],
    ['rateLesson', e.rateLesson, captured.rateLesson],
    ['sendFeedback (comment)', e.sendFeedback, captured.sendComment],
    ['sendFeedback (question)', e.sendFeedback, captured.sendQuestion],
    ['lessonComments', e.lessonComments, captured.lessonComments],
  ] as const)('parses the %s answer', (_, endpoint, data) => {
    expect(endpoint.response.safeParse(data).success).toBe(true);
  });

  it('keeps null for what nobody has done yet', () => {
    const parsed = e.lessonFeedback.response.parse(
      captured.lessonFeedbackEmpty,
    );
    expect(parsed.rating).toBeNull();
    expect(parsed.myStars).toBeNull();
  });

  it('refuses a rating answer without the caller stars', () => {
    expect(
      e.rateLesson.response.safeParse({ average: 4, count: 1 }).success,
    ).toBe(false);
  });

  it('puts the instructor side of a question as nulls until it is answered', () => {
    expect(e.sendFeedback.response.parse(captured.sendQuestion)).toMatchObject({
      status: 'new',
      reply: null,
      replyTime: null,
    });
    expect(
      e.sendFeedback.response.parse(captured.sendComment).status,
    ).toBeNull();
  });

  describe('commands', () => {
    it.each([1, 3, 5])('accepts %i stars', (stars) => {
      expect(RateLessonCommandSchema.safeParse({ stars }).success).toBe(true);
    });

    it.each([0, 6, 2.5, -1])('refuses %s stars', (stars) => {
      expect(RateLessonCommandSchema.safeParse({ stars }).success).toBe(false);
    });

    const send = (text: string, kind = 'comment') =>
      SendFeedbackCommandSchema.safeParse({
        kind,
        text,
        anchor: { type: 'none' },
      });

    it('trims the text and holds it to 5 to 1000 characters', () => {
      expect(send('  Trang ba  ')).toMatchObject({
        success: true,
        data: { text: 'Trang ba' },
      });
      expect(send('a'.repeat(FEEDBACK_MIN_LENGTH - 1)).success).toBe(false);
      expect(send(` ${'a'.repeat(FEEDBACK_MIN_LENGTH - 1)} `).success).toBe(
        false,
      );
      expect(send('a'.repeat(FEEDBACK_MIN_LENGTH)).success).toBe(true);
      expect(send('a'.repeat(FEEDBACK_MAX_LENGTH)).success).toBe(true);
      expect(send('a'.repeat(FEEDBACK_MAX_LENGTH + 1)).success).toBe(false);
    });

    it('sends only the kinds a learner can send, and an anchor with its own fields', () => {
      expect(send('Câu hỏi hay', 'question').success).toBe(true);
      expect(send('Báo nội dung', 'report').success).toBe(true);
      expect(send('Năm sao', 'rating').success).toBe(false);
      expect(
        SendFeedbackCommandSchema.safeParse({
          kind: 'comment',
          text: 'Trang ba',
          anchor: { type: 'pdf', blockId: 32 },
        }).success,
      ).toBe(false);
    });
  });

  it('parses the captured course card with its rating', () => {
    expect(CourseCardSchema.parse(captured.courseCard).rating).toEqual({
      average: 4,
      count: 2,
    });
  });

  it('reads the captured refusal of 0 stars as an error envelope on the stars field', () => {
    const envelope = EnvelopeSchema.parse(captured.ratingRefusal);
    expect(envelope).toMatchObject({
      status: 'ERROR',
      messageCode: 'CORE-VALIDATION_FAILED',
      message: 'Số sao phải từ 1 đến 5.',
    });
  });

  it('adds the rating to a course card, and keeps cards without one valid', () => {
    const card = { courseId: 7, code: 'DEMO-MEDIA' };
    expect(
      CourseCardSchema.parse({ ...card, rating: { average: 4.3, count: 12 } })
        .rating,
    ).toEqual({ average: 4.3, count: 12 });
    expect(CourseCardSchema.parse({ ...card, rating: null }).rating).toBeNull();
    expect(CourseCardSchema.safeParse(card).success).toBe(true);
  });
});
