import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  learnerEndpoints,
  type CourseLevel,
  type EnrollmentDetail,
  type LessonProgress,
} from '@lms/contracts';
import { map } from 'rxjs';
import { findLearnerCourse } from '../../../../core/learning/learner-course';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { LEVEL_LABEL } from '../../../../shared/course/course-labels';

export type CourseView = 'loading' | 'missing' | 'not-enrolled' | 'enrolled';

export type LessonState = 'not_started' | 'in_progress' | 'completed';

export interface OutlineLesson {
  readonly id: number;
  readonly title: string;
  readonly quiz: boolean;
  readonly required: boolean;
  readonly minutes: number;
  readonly state: LessonState;
  /** `null` for a quiz lesson: it opens from the lesson player, not from here. */
  readonly link: string | null;
}

export interface OutlineChapter {
  readonly id: number;
  readonly title: string;
  /** The first chapter and the one holding the lesson to resume start open. */
  readonly open: boolean;
  readonly lessons: readonly OutlineLesson[];
}

const stateOf = (progress: LessonProgress | undefined): LessonState =>
  progress?.status === 'completed' || progress?.status === 'in_progress'
    ? progress.status
    : 'not_started';

/**
 * The learner's page for one course. The card (what the learner sees in the lists) and, once
 * enrolled, the enrolment detail with the outline and the server's lesson status. The rules
 * (progress, who may enrol) stay on the server; the store only arranges what it sent.
 */
@Injectable()
export class CourseStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);

  private readonly refresh = invalidation();

  /** `undefined` for a path that holds no course id. */
  readonly courseId$ = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('id'));
        return Number.isInteger(id) && id > 0 ? id : undefined;
      }),
    ),
    { initialValue: undefined },
  );

  private readonly cardData = serverData(
    (courseId: number) => findLearnerCourse(this.client, courseId),
    { params: () => this.courseId$(), reloadOn: this.refresh },
  );

  private readonly detailData = serverData(
    (enrollmentId: number) =>
      this.client.call(learnerEndpoints.enrollment, {
        params: { enrollmentId },
      }),
    {
      params: () => this.cardData.value()?.enrollmentId ?? undefined,
      reloadOn: this.refresh,
    },
  );

  private readonly enrollment = serverMutation(
    (courseId: number) =>
      this.client.call(learnerEndpoints.enroll, {
        params: { courseId },
      }),
    {
      errors: 'toast',
      success: () => 'Đã đăng ký khóa học',
      invalidates: this.refresh,
    },
  );

  // Selectors
  readonly card$ = computed(() => this.cardData.value() ?? undefined);
  readonly detail$ = this.detailData.value;
  readonly loadError$ = computed(
    () => this.cardData.error() ?? this.detailData.error(),
  );
  readonly isEnrolling$ = this.enrollment.isPending;

  readonly view$ = computed((): CourseView => {
    if (this.courseId$() === undefined) return 'missing';
    const card = this.cardData.value();
    if (card === undefined) return 'loading';
    if (card === null) return 'missing';
    if (card.enrollmentId == null) return 'not-enrolled';
    return this.detailData.value() ? 'enrolled' : 'loading';
  });

  /** An optional course the learner has not joined: the only one they may join themselves. */
  readonly canEnroll$ = computed(
    () =>
      this.view$() === 'not-enrolled' &&
      this.card$()?.requirement === 'optional',
  );

  /** A mandatory course reaches the learner by assignment only. */
  readonly needsAssignment$ = computed(
    () =>
      this.view$() === 'not-enrolled' &&
      this.card$()?.requirement === 'mandatory',
  );

  readonly isOverdue$ = computed(() => this.card$()?.overdue ?? false);

  readonly levelLabel$ = computed(() => {
    const level: CourseLevel | null | undefined = this.card$()?.level;
    return level ? LEVEL_LABEL[level] : '';
  });

  private readonly lessonStates = computed(
    () => new Map(this.detail$()?.lessons.map((l) => [l.lessonId, l]) ?? []),
  );

  /** Where "Tiếp tục học" goes: the server's last lesson, else the first content lesson. */
  readonly resumeLessonId$ = computed((): number | undefined => {
    const detail = this.detail$();
    if (!detail) return undefined;
    const lessons = detail.content.chapters.flatMap((c) => c.lessons);
    const last = detail.enrollment.lastLessonId;
    if (last && lessons.some((l) => l.lesson.id === last)) return last;
    return lessons.find((l) => l.lesson.lessonType === 'content')?.lesson.id;
  });

  readonly resumeLink$ = computed((): string | null => {
    const lessonId = this.resumeLessonId$();
    const courseId = this.courseId$();
    return lessonId && courseId ? `/lesson/${courseId}/${lessonId}` : null;
  });

  /** "Bắt đầu học" before the first lesson, "Tiếp tục học" while learning, nothing once done. */
  readonly primaryAction$ = computed((): string | null => {
    if (this.view$() !== 'enrolled' || !this.resumeLink$()) return null;
    switch (this.card$()?.learningStatus) {
      case 'completed':
        return null;
      case 'not_started':
        return 'Bắt đầu học';
      default:
        return 'Tiếp tục học';
    }
  });

  readonly outline$ = computed((): readonly OutlineChapter[] => {
    const detail: EnrollmentDetail | undefined = this.detail$();
    const courseId = this.courseId$();
    if (!detail || !courseId) return [];
    const resume = this.resumeLessonId$();
    const states = this.lessonStates();
    return detail.content.chapters.map(({ chapter, lessons }, index) => ({
      id: chapter.id,
      title: chapter.title,
      open: index === 0 || lessons.some((l) => l.lesson.id === resume),
      lessons: lessons.map(({ lesson }) => ({
        id: lesson.id,
        title: lesson.title,
        quiz: lesson.lessonType === 'quiz',
        required: lesson.isRequired ?? false,
        minutes: Math.round((lesson.estimatedDurationSeconds ?? 0) / 60),
        state: stateOf(states.get(lesson.id)),
        link:
          lesson.lessonType === 'quiz'
            ? null
            : `/lesson/${courseId}/${lesson.id}`,
      })),
    }));
  });

  /** Lessons done out of all lessons, for the ring's caption. */
  readonly lessonTally$ = computed(() => {
    const lessons = this.outline$().flatMap((c) => c.lessons);
    return {
      done: lessons.filter((l) => l.state === 'completed').length,
      total: lessons.length,
    };
  });

  // Commands
  enroll(): void {
    const courseId = this.courseId$();
    if (courseId && this.canEnroll$()) this.enrollment.run(courseId);
  }

  retry(): void {
    this.cardData.reload();
    this.detailData.reload();
  }
}
