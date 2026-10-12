import { CourseStatusSchema } from './learning.schema';

describe('CourseStatusSchema', () => {
  it.each(['not_started', 'in_progress', 'completed', 'failed'])(
    'accepts %s',
    (status) => {
      expect(CourseStatusSchema.parse(status)).toBe(status);
    },
  );

  it('rejects an unknown status, a different case and a non-string', () => {
    expect(CourseStatusSchema.safeParse('paused').success).toBe(false);
    expect(CourseStatusSchema.safeParse('Completed').success).toBe(false);
    expect(CourseStatusSchema.safeParse(undefined).success).toBe(false);
    expect(CourseStatusSchema.safeParse(1).success).toBe(false);
  });
});
