import { CourseCardSchema } from '@lms/contracts';
import { toCourseCardView } from './course-card-view';

/** The server's card, trimmed to what the mapping reads. */
const enrolledCard = CourseCardSchema.parse({
  courseId: 1,
  code: 'NV-101',
  title: 'Tổng quan hệ thống Core Banking',
  requirement: 'mandatory',
  lessonCount: 4,
  durationSeconds: 4080,
  enrollmentId: 3,
  learningStatus: 'in_progress',
  progressPercent: 62,
  coverAssetId: null,
});

describe('toCourseCardView', () => {
  it('names no cover for a card without one', () => {
    const view = toCourseCardView(enrolledCard);
    expect(view.hasCover).toBe(false);
    expect(view.coverUrl).toBeNull();
  });

  it('keeps the cover place while the cover is read, then passes its address', () => {
    const card = { ...enrolledCard, coverAssetId: 7 };
    expect(toCourseCardView(card, { state: 'loading' })).toMatchObject({
      hasCover: true,
      coverUrl: null,
    });
    expect(
      toCourseCardView(card, { state: 'ready', src: 'blob:cover' }),
    ).toMatchObject({ hasCover: true, coverUrl: 'blob:cover' });
  });

  it('drops a cover the server refused, so the card is text only', () => {
    const card = { ...enrolledCard, coverAssetId: 7 };
    expect(toCourseCardView(card, { state: 'failed' })).toMatchObject({
      hasCover: false,
      coverUrl: null,
    });
  });

  it('says whether the learner is enrolled', () => {
    expect(toCourseCardView(enrolledCard).enrolled).toBe(true);
    const visitor = toCourseCardView({ ...enrolledCard, enrollmentId: null });
    expect(visitor.enrolled).toBe(false);
    expect(visitor.statusLabel).toBe('Chưa đăng ký');
  });
});
