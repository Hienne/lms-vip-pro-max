import { NavCountsSchema } from '@lms/contracts';
import { navCountsFixtures } from './shell.fixtures';

describe('shell fixtures', () => {
  it.each(Object.entries(navCountsFixtures))('%s counts parse', (_, counts) => {
    expect(() => NavCountsSchema.parse(counts)).not.toThrow();
  });

  it('follows the seed: unread notifications per user, inbox only for roles that reply', () => {
    expect(navCountsFixtures['LEARNER']).toEqual({
      notifications: 2,
      inbox: 0,
    });
    expect(navCountsFixtures['INSTRUCTOR']).toEqual({
      notifications: 1,
      inbox: 3,
    });
    expect(navCountsFixtures['ADMIN']).toEqual({ notifications: 1, inbox: 3 });
    expect(navCountsFixtures['REPORT_VIEWER']).toEqual({
      notifications: 0,
      inbox: 0,
    });
  });
});
