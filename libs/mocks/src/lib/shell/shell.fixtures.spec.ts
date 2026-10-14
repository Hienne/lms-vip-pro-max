import { NavCountsSchema } from '@lms/contracts';
import { endpointExamples } from '../examples';
import { navCountsFixtures } from './shell.fixtures';

describe('shell fixtures', () => {
  it.each(Object.entries(navCountsFixtures))('%s counts parse', (_, counts) => {
    expect(() => NavCountsSchema.parse(counts)).not.toThrow();
  });

  it('follows the seed: unread notifications per user, inbox only for roles that reply', () => {
    expect(navCountsFixtures['learner']).toEqual({
      notifications: 2,
      inbox: 0,
    });
    expect(navCountsFixtures['instructor']).toEqual({
      notifications: 1,
      inbox: 3,
    });
    expect(navCountsFixtures['admin']).toEqual({ notifications: 1, inbox: 3 });
    expect(navCountsFixtures['viewer']).toEqual({ notifications: 0, inbox: 0 });
  });

  it('is the navCounts example, with one body per role', () => {
    const example = endpointExamples['navCounts'];
    expect(example?.default).toEqual(navCountsFixtures['learner']);
    expect(Object.keys(example?.roles ?? {}).sort()).toEqual(
      Object.keys(navCountsFixtures).sort(),
    );
  });
});
