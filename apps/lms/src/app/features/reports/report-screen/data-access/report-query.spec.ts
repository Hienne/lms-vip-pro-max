import { convertToParamMap } from '@angular/router';
import {
  filtersFromQuery,
  queryFromFilters,
  tabQuery,
  type ReportFilters,
} from './report-query';

const all: ReportFilters = {
  orgId: 1,
  teamId: 2,
  courseId: 3,
  quizId: 4,
  from: '2026-10-01T00:00:00.000Z',
  to: '2026-12-01T00:00:00.000Z',
  userId: '000004',
  status: 'SUBMITTED',
  passed: false,
  learnerStatus: 'FAILED',
  groupBy: 'org',
};

describe('report query', () => {
  it('round-trips every filter and the page through the query string', () => {
    const params = queryFromFilters(all, 3);
    expect(params).toEqual({
      orgId: '1',
      teamId: '2',
      courseId: '3',
      quizId: '4',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-12-01T00:00:00.000Z',
      userId: '000004',
      status: 'SUBMITTED',
      passed: 'false',
      learnerStatus: 'FAILED',
      groupBy: 'org',
      page: '3',
    });
    expect(filtersFromQuery(convertToParamMap(params))).toEqual({
      filters: all,
      page: 3,
    });
  });

  it('leaves out empty values and the first page', () => {
    expect(queryFromFilters({ orgId: 1, userId: '' }, 1)).toEqual({
      orgId: '1',
    });
    expect(filtersFromQuery(convertToParamMap({}))).toEqual({
      filters: {},
      page: 1,
    });
  });

  it('ignores values that are not what the key holds', () => {
    expect(
      filtersFromQuery(
        convertToParamMap({
          orgId: 'abc',
          teamId: '-2',
          courseId: '1.5',
          quizId: '0',
          from: 'not a date',
          status: 'DONE',
          passed: 'maybe',
          learnerStatus: 'x',
          groupBy: 'team',
          page: '-1',
          userId: '000004',
        }),
      ),
    ).toEqual({ filters: { userId: '000004' }, page: 1 });
  });

  it('keeps on each tab only the filters that tab reads', () => {
    expect(tabQuery('overview', all)).toEqual({
      orgId: '1',
      teamId: '2',
      courseId: '3',
      quizId: '4',
      from: all.from,
      to: all.to,
    });
    expect(tabQuery('learners', all)).toEqual({
      orgId: '1',
      teamId: '2',
      courseId: '3',
      quizId: '4',
      learnerStatus: 'FAILED',
    });
    expect(tabQuery('results', all)).toMatchObject({
      userId: '000004',
      status: 'SUBMITTED',
      passed: 'false',
    });
    expect(tabQuery('results', all)).not.toHaveProperty('groupBy');
    expect(tabQuery('competency', all)).toMatchObject({ groupBy: 'org' });
    expect(tabQuery('questions', all)).not.toHaveProperty('userId');
  });
});
