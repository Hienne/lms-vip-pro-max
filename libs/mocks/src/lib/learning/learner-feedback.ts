import {
  LessonCommentsQuerySchema,
  RateLessonCommandSchema,
  SendFeedbackCommandSchema,
  type Anchor,
  type FeedbackKind,
  type FeedbackStatus,
  type FeedbackView,
  type LessonCommentView,
  type LessonFeedback,
  type LessonRatingResult,
  type RatingSummary,
} from '@lms/contracts';
import type { FakeRequest } from '../backend/fake-backend';
import type { LearnerEnrollments } from './learner-enrollments';
import { refuse } from './learning-reply';
import {
  locateLesson,
  NO_ANCHOR,
  resolveAnchor,
  type Located,
} from './lesson-anchors';
import type { LessonFeedbackSeeds } from './learning.fixtures';

/** The most comments, questions and reports one learner sends on one lesson per learning day. */
export const MAX_SENDS_PER_DAY = 20;
/** The comments the lesson view carries before "Xem thêm nhận xét". */
export const FIRST_COMMENTS = 20;

const HOUR = 3_600_000;

/** The calendar day in Vietnam, where the daily limit resets (UTC+7, no daylight saving). */
const learningDay = (iso: string) =>
  new Date(Date.parse(iso) + 7 * HOUR).toISOString().slice(0, 10);

interface Row {
  readonly id: number;
  readonly userId: string;
  readonly lessonId: number;
  readonly courseId: number;
  readonly kind: 'rating' | FeedbackKind;
  readonly stars: number | null;
  readonly text: string | null;
  readonly anchor: Anchor;
  readonly status: FeedbackStatus | null;
  readonly reply: string | null;
  createTime: string;
}

const newestFirst = (a: Row, b: Row) =>
  b.createTime.localeCompare(a.createTime) || b.id - a.id;

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Ratings, comments, questions and reports on lessons, in memory. What the mock does is what the
 * backend checks: the lesson belongs to a course the caller holds (and has not left), one live rating
 * per learner and lesson, text 5 to 1000 characters after trimming, an anchor that points at a real
 * page or second, at most 20 sends per learner, lesson and learning day. Comments are public with the
 * author's name; questions and reports are visible only to their sender.
 */
export class LearnerFeedback {
  private rows: Row[] = [];
  private nextId = 1;
  private clock = Date.now();
  /** While the seed is placed, rows keep to the past instead of jumping to now. */
  private seeding = false;

  constructor(
    private readonly enrollments: LearnerEnrollments,
    private readonly callerId: (request: FakeRequest) => string,
    private readonly nameOf: (userId: string) => string | undefined,
    seeds: LessonFeedbackSeeds,
  ) {
    this.seed(seeds);
  }

  /** `GET /lessons/{lessonId}/feedback` */
  lessonFeedback(request: FakeRequest): LessonFeedback {
    const { userId, lessonId } = this.lessonOf(request);
    const comments = this.commentsPage(userId, lessonId, 0, FIRST_COMMENTS);
    return {
      rating: this.ratingOf(lessonId),
      myStars:
        this.ratings(lessonId).find((r) => r.userId === userId)?.stars ?? null,
      comments,
      mine: this.rows
        .filter(
          (r) =>
            r.userId === userId &&
            r.lessonId === lessonId &&
            (r.kind === 'question' || r.kind === 'report'),
        )
        .sort(newestFirst)
        .map(this.feedbackView),
    };
  }

  /** `GET /lessons/{lessonId}/comments` */
  comments(request: FakeRequest): LessonFeedback['comments'] {
    const { userId, lessonId } = this.lessonOf(request);
    const numeric = (value: string | undefined) =>
      value === undefined || value === '' ? undefined : Number(value);
    const parsed = LessonCommentsQuerySchema.safeParse({
      page: numeric(request.query['page']),
      size: numeric(request.query['size']),
    });
    if (!parsed.success) return refuse('validationFailed');
    const { page = 0, size = FIRST_COMMENTS } = parsed.data;
    return this.commentsPage(userId, lessonId, page, size);
  }

  /** `PUT /lessons/{lessonId}/rating`: replaces the caller's rating. */
  rate(request: FakeRequest): LessonRatingResult {
    const { userId, lessonId, located } = this.lessonOf(request);
    const parsed = RateLessonCommandSchema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    this.rows = this.rows.filter(
      (r) =>
        !(
          r.kind === 'rating' &&
          r.userId === userId &&
          r.lessonId === lessonId
        ),
    );
    this.add({
      userId,
      lessonId,
      courseId: located.courseId,
      kind: 'rating',
      stars: parsed.data.stars,
    });
    const summary = this.ratingOf(lessonId) as RatingSummary;
    return { ...summary, myStars: parsed.data.stars };
  }

  /** `POST /lessons/{lessonId}/feedback` */
  send(request: FakeRequest): FeedbackView {
    const { userId, lessonId, located } = this.lessonOf(request);
    const parsed = SendFeedbackCommandSchema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    const anchor = resolveAnchor(located.lesson, parsed.data.anchor);
    const today = learningDay(new Date().toISOString());
    const sentToday = this.rows.filter(
      (r) =>
        r.kind !== 'rating' &&
        r.userId === userId &&
        r.lessonId === lessonId &&
        learningDay(r.createTime) === today,
    );
    if (sentToday.length >= MAX_SENDS_PER_DAY) return refuse('feedbackLimit');
    const kind = parsed.data.kind;
    const row = this.add({
      userId,
      lessonId,
      courseId: located.courseId,
      kind,
      text: parsed.data.text,
      anchor,
      status: kind === 'comment' ? null : 'new',
    });
    return this.feedbackView(row);
  }

  /** The course's rating over every lesson, or null when nobody has rated: what its card carries. */
  courseRating(courseId: number): RatingSummary | null {
    return this.summary(
      this.rows.filter((r) => r.kind === 'rating' && r.courseId === courseId),
    );
  }

  private ratings(lessonId: number): Row[] {
    return this.rows.filter(
      (r) => r.kind === 'rating' && r.lessonId === lessonId,
    );
  }

  private ratingOf(lessonId: number): RatingSummary | null {
    return this.summary(this.ratings(lessonId));
  }

  private summary(rated: readonly Row[]): RatingSummary | null {
    if (rated.length === 0) return null;
    const total = rated.reduce((sum, r) => sum + (r.stars ?? 0), 0);
    return { average: round1(total / rated.length), count: rated.length };
  }

  private commentsPage(
    userId: string,
    lessonId: number,
    page: number,
    size: number,
  ): LessonFeedback['comments'] {
    const all = this.rows
      .filter((r) => r.kind === 'comment' && r.lessonId === lessonId)
      .sort(newestFirst);
    return {
      items: all
        .slice(page * size, page * size + size)
        .map((r) => this.commentView(r, userId)),
      page,
      size,
      totalElements: all.length,
      totalPages: Math.ceil(all.length / size),
    };
  }

  private commentView(row: Row, callerId: string): LessonCommentView {
    return {
      id: row.id,
      authorName: this.nameOf(row.userId) ?? row.userId,
      text: row.text ?? '',
      anchor: row.anchor,
      createTime: row.createTime,
      mine: row.userId === callerId,
    };
  }

  private feedbackView = (row: Row): FeedbackView => ({
    id: row.id,
    kind: row.kind as FeedbackKind,
    text: row.text ?? '',
    anchor: row.anchor,
    status: row.status,
    reply: row.reply,
    replyTime: row.reply ? row.createTime : null,
    createTime: row.createTime,
  });

  private add(
    row: Pick<Row, 'userId' | 'lessonId' | 'courseId' | 'kind'> & Partial<Row>,
  ): Row {
    // Each row is a second after the last, so "newest first" is stable even within one test.
    this.clock = this.seeding
      ? this.clock + 60_000
      : Math.max(this.clock + 1000, Date.now());
    const added: Row = {
      stars: null,
      text: null,
      anchor: { type: 'none', ...NO_ANCHOR },
      status: null,
      reply: null,
      ...row,
      id: this.nextId++,
      createTime: new Date(this.clock).toISOString(),
    };
    this.rows.push(added);
    return added;
  }

  private lessonOf(request: FakeRequest): {
    userId: string;
    lessonId: number;
    located: Located;
  } {
    const userId = this.callerId(request);
    const lessonId = Number(request.params['lessonId']);
    const located = locateLesson(this.enrollments, userId, lessonId);
    if (!located) return refuse('learningNotFound');
    return { userId, lessonId, located };
  }

  /** The seeds sit on the first lesson of the course that holds a PDF, anchored on its first blocks. */
  private seed(seeds: LessonFeedbackSeeds): void {
    const userIds = [...new Set(seeds.rows.map((r) => r.userId))];
    const record = userIds
      .map((userId) => this.enrollments.of(userId, seeds.courseId))
      .find((found) => found !== undefined);
    const lesson = record?.content.chapters
      .flatMap((c) => c.lessons)
      .find((l) => l.blocks.some((b) => b.block.blockType === 'pdf'));
    if (!record || !lesson) return;
    this.clock = Date.now() - 3 * 86_400_000;
    this.seeding = true;
    const blockOf = (type: 'pdf' | 'video') =>
      lesson.blocks.find((b) => b.block.blockType === type)?.block.id ?? null;
    const base = {
      lessonId: lesson.lesson.id,
      courseId: record.content.course.id,
    };
    for (const seed of seeds.rows) {
      if (seed.kind === 'rating') {
        this.add({
          ...base,
          userId: seed.userId,
          kind: 'rating',
          stars: seed.stars,
        });
        continue;
      }
      const blockId = seed.type === 'none' ? null : blockOf(seed.type);
      if (seed.type !== 'none' && blockId === null) continue;
      const anchor: Anchor =
        seed.type === 'none'
          ? { type: 'none', ...NO_ANCHOR }
          : {
              type: seed.type,
              blockId,
              page: seed.type === 'pdf' ? (seed.at ?? 1) : null,
              second: seed.type === 'video' ? (seed.at ?? 0) : null,
            };
      this.add({
        ...base,
        userId: seed.userId,
        kind: seed.kind,
        text: seed.text,
        anchor,
        status: seed.kind === 'comment' ? null : (seed.status ?? 'new'),
        reply: seed.reply ?? null,
      });
    }
    this.seeding = false;
    this.clock = Date.now();
  }
}
