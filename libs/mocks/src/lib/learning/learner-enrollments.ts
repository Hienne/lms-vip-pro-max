import type {
  BlockProgress,
  CourseDetail,
  CourseEnrollment,
  LessonProgress,
} from '@lms/contracts';
import type { LearnerCourseState } from './learning.fixtures';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type LessonOf = CourseDetail['chapters'][number]['lessons'][number];

const DAY = 86_400_000;
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

/** One learner's cycle in one course, with the revision they received and their progress rows. */
export interface EnrollmentRecord {
  readonly enrollment: Mutable<CourseEnrollment>;
  readonly lessons: Mutable<LessonProgress>[];
  readonly blocks: Mutable<BlockProgress>[];
  /** The published revision at enrolment time. */
  readonly content: CourseDetail;
  readonly dueAt: string | null;
  readonly assigned: boolean;
  /** The final exam was taken and never passed: the server's flag, not an enrolment status. */
  readonly failed: boolean;
  /** The best score on the final exam: the fixture's number, null when it was not taken. */
  readonly bestScorePercent: number | null;
}

export interface EnrollmentSource {
  readonly userId: string;
  readonly detail: CourseDetail;
  readonly state?: LearnerCourseState;
  readonly origin: 'assignment' | 'self';
}

/**
 * The learners' enrolments in memory: the fixtures' standing per course turned into lesson and
 * block progress rows, and the rows a self-enrolment adds. A stand-in for the backend's tables,
 * not its rules: the percentage of a seeded enrolment is the fixture's number.
 */
export class LearnerEnrollments {
  private records: EnrollmentRecord[] = [];
  private nextEnrollmentId = 1;
  private nextRowId = 1;

  constructor(sources: readonly EnrollmentSource[]) {
    for (const source of sources) this.add(source);
  }

  all(): readonly EnrollmentRecord[] {
    return this.records;
  }

  byId(enrollmentId: number): EnrollmentRecord | undefined {
    return this.records.find((r) => r.enrollment.id === enrollmentId);
  }

  of(userId: string, courseId: number): EnrollmentRecord | undefined {
    return this.records.find(
      (r) =>
        r.enrollment.userId === userId && r.enrollment.courseId === courseId,
    );
  }

  /** Adds the enrolment, or returns the one the person already has in this course. */
  add(source: EnrollmentSource): EnrollmentRecord {
    const existing = this.of(source.userId, source.detail.course.id);
    if (existing) return existing;
    const enrollmentId = this.nextEnrollmentId++;
    const { detail, state } = source;
    const lessons = detail.chapters.flatMap((c) => c.lessons);
    const standing = state?.learningStatus ?? 'not_started';
    // The backend has no failed status: the learner is still in progress and the card says `failed`.
    const status = standing === 'failed' ? 'in_progress' : standing;
    const started = status !== 'not_started';
    const completedLessons = this.completedLessons(lessons, state);
    const resume = this.resumeOf(lessons, completedLessons, status);
    const startedAt = started ? inDays(-6) : null;
    const lastAccessAt = started ? inDays(-4) : null;
    const record: EnrollmentRecord = {
      enrollment: {
        id: enrollmentId,
        courseId: detail.course.id,
        revisionId: detail.revision.id,
        userId: source.userId,
        cycleNo: 1,
        enrollmentOrigin: source.origin === 'self' ? 'self' : 'assignment',
        selfEnrolledAt: source.origin === 'self' ? inDays(0) : null,
        orgIdSnapshot: 1,
        teamIdSnapshot: null,
        enrolledAt: inDays(-7),
        startedAt,
        lastAccessAt,
        completedAt: status === 'completed' ? inDays(-2) : null,
        status,
        progressPercent: state?.progressPercent ?? 0,
        lastLessonId: resume?.lessonId ?? null,
        lastBlockId: resume?.blockId ?? null,
        rowVersion: 0,
        createTime: inDays(-7),
        updateTime: inDays(-4),
      },
      lessons: [],
      blocks: [],
      content: detail,
      dueAt: state?.dueInDays != null ? inDays(state.dueInDays) : null,
      assigned: source.origin === 'assignment',
      failed: standing === 'failed',
      bestScorePercent: state?.bestScorePercent ?? null,
    };
    lessons.forEach((lesson, index) => {
      const done = completedLessons.has(lesson.lesson.id);
      const current = resume?.lessonId === lesson.lesson.id && !done;
      const lessonStatus = done
        ? 'completed'
        : current
          ? 'in_progress'
          : 'not_started';
      record.lessons.push({
        id: this.nextRowId++,
        enrollmentId,
        lessonId: lesson.lesson.id,
        status: lessonStatus,
        progressPercent: done ? 100 : 0,
        startedAt: lessonStatus === 'not_started' ? null : inDays(-6 + index),
        lastAccessAt: lessonStatus === 'not_started' ? null : inDays(-4),
        completedAt: done ? inDays(-5 + index) : null,
        rowVersion: 0,
        createTime: inDays(-7),
        updateTime: inDays(-4),
      });
      for (const { block, assets } of lesson.blocks) {
        const asset = assets[0]?.asset;
        const isResume = current && resume?.blockId === block.id;
        record.blocks.push({
          id: this.nextRowId++,
          enrollmentId,
          blockId: block.id,
          status: done ? 'completed' : isResume ? 'in_progress' : 'not_started',
          progressPercent: done ? 100 : isResume ? 40 : 0,
          lastVideoPositionSeconds:
            isResume && block.blockType === 'video' ? 120 : null,
          lastPdfPage: isResume && block.blockType === 'pdf' ? 3 : null,
          mediaAssetId: isResume && asset ? asset.id : null,
          watchedSeconds: isResume && block.blockType === 'video' ? 120 : null,
          startedAt: done || isResume ? inDays(-6) : null,
          lastAccessAt: done || isResume ? inDays(-4) : null,
          completedAt: done ? inDays(-5) : null,
          lastEventSequence: 0,
          rowVersion: 0,
          createTime: inDays(-7),
          updateTime: inDays(-4),
        });
      }
    });
    this.records.push(record);
    return record;
  }

  /** Content lessons done in order from the first; a finished course also has its quiz lessons done. */
  private completedLessons(
    lessons: readonly LessonOf[],
    state: LearnerCourseState | undefined,
  ): Set<number> {
    const status = state?.learningStatus ?? 'not_started';
    if (status === 'not_started') return new Set();
    const content = lessons.filter((l) => l.lesson.lessonType === 'content');
    if (status === 'completed') return new Set(lessons.map((l) => l.lesson.id));
    if (status === 'failed') return new Set(content.map((l) => l.lesson.id));
    const count = Math.floor(
      ((state?.progressPercent ?? 0) / 100) * content.length,
    );
    return new Set(content.slice(0, count).map((l) => l.lesson.id));
  }

  private resumeOf(
    lessons: readonly LessonOf[],
    completed: ReadonlySet<number>,
    status: string,
  ): { lessonId: number; blockId: number | null } | null {
    if (status === 'not_started') return null;
    const next = lessons.find(
      (l) => l.lesson.lessonType === 'content' && !completed.has(l.lesson.id),
    );
    const target = next ?? [...lessons].reverse().find((l) => l.blocks.length);
    if (!target) return null;
    return {
      lessonId: target.lesson.id,
      blockId: target.blocks[0]?.block.id ?? null,
    };
  }
}
