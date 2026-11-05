import { computed, inject, Injectable, Injector } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  learnerEndpoints,
  learnerQuizEndpoints,
  type CourseLevel,
  type LessonProgress,
} from '@lms/contracts';
import { map } from 'rxjs';
import { readLearnerCourse } from '../../../../core/learning/read-learner-course';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { coverPreview } from '../../../../shared/course/cover-image';
import { LEVEL_LABEL } from '../../../../shared/course/course-labels';

export type CourseView = 'loading' | 'missing' | 'not-enrolled' | 'enrolled';

export type LessonState = 'not_started' | 'in_progress' | 'completed';

export interface OutlineLesson {
  readonly id: number;
  readonly title: string;
  readonly quiz: boolean;
  readonly required: boolean;
  readonly minutes: number;
  /** `null` before enrolment: the server has no status for a lesson the learner has not started. */
  readonly state: LessonState | null;
  /** A quiz lesson opens in the lesson player too, which shows its quiz. */
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
 * The learner's page for one course. One course call gives the card and the content (outline,
 * objectives, completion rule); once enrolled, the enrolment detail adds the server's lesson
 * status. The rules (progress, who may enrol) stay on the server; the store only arranges what it
 * sent.
 */
@Injectable()
export class CourseStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

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

  private readonly courseData = serverData(
    (courseId: number) => readLearnerCourse(this.client, courseId),
    { params: () => this.courseId$(), reloadOn: this.refresh },
  );

  private readonly detailData = serverData(
    (enrollmentId: number) =>
      this.client.call(learnerEndpoints.enrollment, {
        params: { enrollmentId },
      }),
    {
      params: () => this.courseData.value()?.card.enrollmentId ?? undefined,
      reloadOn: this.refresh,
    },
  );

  /** The course's quizzes for the enrolled learner; the endpoint answers nobody else. */
  private readonly quizData = serverData(
    (courseId: number) =>
      this.client.call(learnerQuizEndpoints.courseQuizzes, {
        params: { courseId },
      }),
    {
      params: () =>
        this.courseData.value()?.card.enrollmentId == null
          ? undefined
          : this.courseId$(),
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
  readonly card$ = computed(() => this.courseData.value()?.card);
  readonly content$ = computed(() => this.courseData.value()?.content);
  /** Display only; completion and passing scores come from the server. */
  readonly requiredQuizCount$ = computed(() => {
    const content = this.content$();
    const ids = new Set(
      (content?.chapters ?? []).flatMap((chapter) =>
        chapter.lessons.flatMap(({ lesson }) =>
          lesson.lessonType === 'quiz' && lesson.isRequired && lesson.quizId
            ? [lesson.quizId]
            : [],
        ),
      ),
    );
    if (content?.finalQuizId) ids.add(content.finalQuizId);
    return ids.size;
  });
  readonly detail$ = this.detailData.value;
  /**
   * The revision's cover image. The server decides whether a learner may read it without a block;
   * until it does, a refusal shows no image.
   */
  readonly cover$ = coverPreview(
    this.client,
    this.injector,
    () => this.content$()?.revision.coverAssetId,
  );
  readonly loadError$ = computed(
    () => this.courseData.error() ?? this.detailData.error(),
  );
  readonly isEnrolling$ = this.enrollment.isPending;
  /** Kept apart from `loadError$`: a quiz list that fails must not hide the course. */
  readonly quizError$ = this.quizData.error;
  readonly quizzesLoading$ = this.quizData.isLoading;

  /** The course's final exam, the one the page features; `undefined` when it has none. */
  readonly finalExam$ = computed(() =>
    this.quizData
      .value()
      ?.find((c) =>
        this.content$()?.finalQuizId
          ? c.quiz.id === this.content$()?.finalQuizId
          : c.quiz.quizType === 'FINAL_EXAM',
      ),
  );

  /** Every other quiz of the course, in the server's order. */
  readonly otherQuizzes$ = computed(() =>
    (this.quizData.value() ?? []).filter((c) => c !== this.finalExam$()),
  );

  readonly view$ = computed((): CourseView => {
    if (this.courseId$() === undefined) return 'missing';
    const course = this.courseData.value();
    if (course === undefined) return 'loading';
    if (course === null) return 'missing';
    if (course.card.enrollmentId == null) return 'not-enrolled';
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
    const lessons = (this.content$()?.chapters ?? []).flatMap((c) => c.lessons);
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

  /**
   * Where the finished course's certificate opens: the server puts the id on the card only for a
   * completed cycle, so a course in progress has none.
   */
  readonly certificateLink$ = computed((): string | null => {
    const id = this.card$()?.certificateId;
    return id == null ? null : `/certificate/${id}`;
  });

  readonly outline$ = computed((): readonly OutlineChapter[] => {
    const content = this.content$();
    const courseId = this.courseId$();
    const view = this.view$();
    if (!content || !courseId) return [];
    // Before enrolment the outline is the structure only: no status and no way into the player.
    const enrolled = view === 'enrolled';
    if (!enrolled && view !== 'not-enrolled') return [];
    const resume = this.resumeLessonId$();
    const states = this.lessonStates();
    return content.chapters.map(({ chapter, lessons }, index) => ({
      id: chapter.id,
      title: chapter.title,
      open: index === 0 || lessons.some((l) => l.lesson.id === resume),
      lessons: lessons.map(({ lesson }) => ({
        id: lesson.id,
        title: lesson.title,
        quiz: lesson.lessonType === 'quiz',
        required: lesson.isRequired ?? false,
        minutes: Math.round((lesson.estimatedDurationSeconds ?? 0) / 60),
        state: enrolled ? stateOf(states.get(lesson.id)) : null,
        link: enrolled ? `/lesson/${courseId}/${lesson.id}` : null,
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
    this.courseData.reload();
    this.detailData.reload();
    this.quizData.reload();
  }

  retryQuizzes(): void {
    this.quizData.reload();
  }
}
