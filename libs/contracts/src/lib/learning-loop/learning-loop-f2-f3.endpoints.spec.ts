import { AgentStreamEventSchema } from '../assistant-agent/agent.schema';
import { toUrl } from '../http/endpoint';
import { competencyReviewEndpoints } from './competency-review.endpoints';
import {
  SelfExplainBodySchema,
  selfExplainEndpoints,
} from './self-explain.endpoints';

/**
 * Examples in the shape `SelfExplainIT` and `CompetencyReviewIT` (corebanking-academy, tickets 03
 * and 05) assert. Written from those tests, not captured from a running server; recapture them from
 * the local stack once the backend runs it.
 */
const capturedReview = [
  {
    competencyId: 2,
    name: 'Kiểm soát và tuân thủ',
    percent: 0,
    lessons: [
      {
        courseId: 1,
        courseTitle: 'Tổng quan hệ thống Core Banking',
        lessonId: 3,
        lessonTitle: 'Luồng giao dịch từ kênh đến sổ cái',
        missedCount: 3,
        lastMissedAt: '2026-11-18T03:15:43.415915Z',
      },
    ],
  },
  {
    competencyId: 3,
    name: 'Vận hành và quy trình',
    percent: 33.33,
    lessons: [],
  },
];

const capturedStream = [
  { type: 'conversation', conversationId: 6 },
  { type: 'delta', text: '**Bạn đã nắm được**\n- Ý chính [1].' },
  {
    type: 'done',
    answer: '**Bạn đã nắm được**\n- Ý chính [1].',
    turnId: 9,
    citations: [
      {
        n: 1,
        documentId: 0,
        fileName: 'Bài học',
        page: null,
        lineStart: 0,
        lineEnd: 0,
        snippet: 'Nội dung bài học.',
        lesson: {
          courseId: 1,
          courseTitle: 'Khóa học',
          revisionId: 1,
          chapterTitle: 'Chương 1',
          lessonId: 3,
          lessonTitle: 'Bài 3',
          blockId: 1,
          url: '/lesson/1/3',
        },
      },
    ],
  },
];

describe('competencyReviewEndpoints', () => {
  it('parses the response example', () => {
    expect(
      competencyReviewEndpoints.review.response.safeParse(capturedReview)
        .success,
    ).toBe(true);
  });

  it('refuses more than three lessons for one competency', () => {
    const lesson = capturedReview[0].lessons[0];
    const four = [
      { ...capturedReview[0], lessons: [lesson, lesson, lesson, lesson] },
    ];
    expect(
      competencyReviewEndpoints.review.response.safeParse(four).success,
    ).toBe(false);
  });

  it('is answered by the mock until the backend has it', () => {
    expect(competencyReviewEndpoints.review.served).toBe('mock');
  });
});

describe('selfExplainEndpoints', () => {
  it.each(capturedStream)('parses the stream event %#', (event) => {
    expect(AgentStreamEventSchema.safeParse(event).success).toBe(true);
  });

  it('accepts 50 to 1500 characters after trimming and nothing else', () => {
    const body = (text: string) => SelfExplainBodySchema.safeParse({ text });
    expect(body('x'.repeat(49)).success).toBe(false);
    expect(body(`  ${'x'.repeat(49)}  `).success).toBe(false);
    expect(body('x'.repeat(50)).success).toBe(true);
    expect(body('x'.repeat(1500)).success).toBe(true);
    expect(body('x'.repeat(1501)).success).toBe(false);
  });

  it('builds the lesson path', () => {
    expect(toUrl(selfExplainEndpoints.selfExplain, { lessonId: 41 })).toBe(
      '/api/v1/assistant/lessons/41/self-explain',
    );
  });
});
