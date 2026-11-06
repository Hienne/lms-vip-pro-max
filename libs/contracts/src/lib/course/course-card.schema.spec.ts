import { capturedLearner } from '../learner/learner.captured';
import { CourseCardSchema } from './course.schema';

const card = capturedLearner.catalog.items[0];

describe('CourseCardSchema', () => {
  it('parses a card the backend sent before it had a cover field', () => {
    expect(CourseCardSchema.parse(card).coverAssetId).toBeUndefined();
  });

  it.each([42, null])('parses the cover asset id %s', (coverAssetId) => {
    expect(CourseCardSchema.parse({ ...card, coverAssetId }).coverAssetId).toBe(
      coverAssetId,
    );
  });

  it('refuses a cover id that is not an integer', () => {
    expect(() =>
      CourseCardSchema.parse({ ...card, coverAssetId: 'cover.png' }),
    ).toThrow();
  });
});
