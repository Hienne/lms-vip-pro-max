import { describe, expect, it } from 'vitest';
import { assessmentReportEndpoints } from './assessment-reports.endpoints';

describe('assessment report results', () => {
  it('accepts an ungraded attempt without inventing a correct-answer count', () => {
    const page = assessmentReportEndpoints.results.response.parse({
      items: [
        {
          attemptId: 1,
          quizId: 2,
          quizTitle: 'Exam',
          courseId: 3,
          userId: '000001',
          userName: null,
          orgId: null,
          orgName: null,
          teamId: null,
          teamName: null,
          attemptNo: 1,
          status: 'IN_PROGRESS',
          submitType: null,
          startedAt: '2026-11-10T01:00:00Z',
          submittedAt: null,
          correctCount: null,
          totalQuestions: 10,
          scorePercent: null,
          passed: null,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    expect(page.items[0].correctCount).toBeNull();
  });
});
