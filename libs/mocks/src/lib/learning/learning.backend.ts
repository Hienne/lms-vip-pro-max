import {
  assignmentEndpoints,
  courseEndpoints,
  gamificationEndpoints,
  learnerEndpoints,
  learningReportEndpoints,
  type LearningReportEnrollmentRow,
  type LearningStatus,
  feedbackEndpoints,
  certificateEndpoints,
  personalEndpoints,
  trainingCatalogEndpoints,
  type AnyEndpoint,
  type AssignCourseCommand,
  type AssignmentDetail,
  type AssignmentRecipient,
  type AssignmentSummary,
  type BusinessModule,
  type ChangeCourseStateCommand,
  type ChapterInput,
  type CourseCard,
  type CourseDetail,
  type CourseShare,
  type LearnerCourse,
  type LearnerFacets,
  type CreateCourseCommand,
  type CreateGroupCommand,
  type GroupDetail,
  type LearningAsset,
  type ReplaceMembersCommand,
  type RescheduleAssignmentCommand,
  type PublishAssignment,
  type RevokeRecipientCommand,
  type SaveCatalogItemCommand,
  type SaveTrainingFieldCommand,
  type SaveDraftCommand,
  PublishCourseCommandSchema,
  ShareCourseCommandSchema,
  type TrainingField,
  type TrainingProgram,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeOk } from '../envelope';
import { AssetLibrary } from './asset.backend';
import { LearnerStudy } from './learner-session.backend';
import { LearningRefused, ok, refuse, refuseField } from './learning-reply';
import { LearnerCertificates } from './learner-certificates';
import { LearnerLeaderboard } from './learner-leaderboard';
import { LearnerBadges } from './learner-badges';
import { GamificationAdmin } from './gamification-admin';
import { LearnerLevel } from './learner-level';
import { LearnerStreak } from './learner-streak';
import { LearnerFeedback } from './learner-feedback';
import { LearnerNotes } from './learner-notes';
import { LearnerReminders } from './learner-reminders';
import { dashboardOf, programGroupsOf } from './learner-dashboard';
import {
  filterRows,
  groupRows,
  learningCounts,
  rowsCsv,
  sortRows,
} from './learning-reports';
import {
  LearnerEnrollments,
  type EnrollmentRecord,
} from './learner-enrollments';
import {
  businessModuleFixtures,
  libraryAssetFixtures,
  learnerAssessmentFixtures,
  learnerCourseStateFixtures,
  learnerReminderFixtures,
  learningGroupFixtures,
  lessonFeedbackSeeds,
  lessonNoteSeeds,
  seedCourseDetails,
  trainingFieldFixtures,
  trainingProgramFixtures,
} from './learning.fixtures';

/** A person as the assignment resolver needs them. */
export interface LearningPerson {
  readonly userId: string;
  readonly orgId: number | null;
  readonly teamId: number | null;
}

/** What the learning service asks the identity service: who calls, and who is in the org. */
export interface LearningDirectory {
  /** The caller's staff code; refuses (401, 403) like the identity service does. */
  callerId(request: FakeRequest): string;
  people(): readonly LearningPerson[];
  /** The current name of a person, team or org, kept on the target when it is assigned. */
  nameOf(
    type: 'user' | 'team' | 'org',
    id: string | number,
  ): string | undefined;
  /** The status of a quiz in the assessment service; `undefined` when it does not exist. */
  quizStatus(quizId: number): string | undefined;
  publishLessonQuizzes(
    request: FakeRequest,
    courseId: number,
    ids: readonly number[],
  ): void;
  /** Whether the caller is a system admin (an admin role with a GLOBAL grant). */
  isSystemAdmin(request: FakeRequest): boolean;
  /** Who the caller's report grants cover; refuses (403) a caller with no report grant. */
  reportScope(request: FakeRequest): (person: LearningPerson) => boolean;
  dashboardScope(
    request: FakeRequest,
  ): (course: CourseDetail['course']) => boolean;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Handler = (request: FakeRequest) => FakeReply;

const DAY = 86_400_000;
const now = () => new Date().toISOString();

const num = (value: string | undefined): number | undefined =>
  value === undefined || value === '' ? undefined : Number(value);

function paged<T>(rows: readonly T[], query: Readonly<Record<string, string>>) {
  const page = num(query['page']) ?? 0;
  const size = num(query['size']) ?? 20;
  return {
    items: rows.slice(page * size, page * size + size),
    page,
    size,
    totalElements: rows.length,
    totalPages: Math.ceil(rows.length / size),
  };
}

interface CourseRecord {
  course: Mutable<CourseDetail['course']>;
  published: CourseDetail | null;
  draft: CourseDetail | null;
}

/**
 * The backend's learning services in memory: training catalogue, course authoring with whole-tree
 * draft saves (new row ids on every save, `rowVersion` checks), the learner's catalogue,
 * assignments and learning groups. Progress and due dates are fixed fixtures, never computed.
 */
export class LearningBackend {
  /** Rollback point for the atomic course/exam authoring endpoint in the development backend. */
  checkpointCourseWrites(): () => void {
    const courses = structuredClone(this.courses);
    const nextId = this.nextId;
    return () => {
      this.courses = courses;
      this.nextId = nextId;
    };
  }
  private nextId = 5000;
  private fields: Mutable<TrainingField>[] = trainingFieldFixtures.map((f) => ({
    ...f,
  }));
  private modules: Mutable<BusinessModule>[] = businessModuleFixtures.map(
    (m) => ({ ...m }),
  );
  private programs: Mutable<TrainingProgram>[] = trainingProgramFixtures.map(
    (p) => ({ ...p }),
  );
  private courses: CourseRecord[] = seedCourseDetails().map((detail) => ({
    course: { ...detail.course },
    published: detail.course.publishedRevisionId ? detail : null,
    draft: detail.course.publishedRevisionId ? null : detail,
  }));
  private assignments: AssignmentDetail[] = [];
  private groups: GroupDetail[] = learningGroupFixtures.map((g) => ({
    group: { ...g.group },
    members: [...g.members],
  }));
  private shares: CourseShare[] = [];
  private assets: LearningAsset[] = [];
  private enrollments = new LearnerEnrollments(
    Object.entries(learnerCourseStateFixtures).flatMap(([userId, states]) =>
      states.flatMap((state) => {
        const detail = this.courses.find(
          (c) => c.course.id === state.courseId,
        )?.published;
        return detail
          ? [
              {
                userId,
                detail,
                state,
                origin: state.dueInDays !== null ? 'assignment' : 'self',
              } as const,
            ]
          : [];
      }),
    ),
  );

  private reminders = new LearnerReminders(learnerReminderFixtures);

  private readonly board: LearnerLeaderboard;

  private readonly streaks: LearnerStreak;
  private readonly levels: LearnerLevel;
  private readonly badges: LearnerBadges;
  private readonly gamification: GamificationAdmin;

  private notes = new LearnerNotes(
    this.enrollments,
    (request) => this.directory.callerId(request),
    lessonNoteSeeds,
  );

  private feedback = new LearnerFeedback(
    this.enrollments,
    (request) => this.directory.callerId(request),
    (userId) => this.directory.nameOf('user', userId),
    lessonFeedbackSeeds,
  );

  private certificates = new LearnerCertificates(
    this.enrollments,
    (request) => this.directory.callerId(request),
    (userId) => this.directory.nameOf('user', userId),
  );

  private study = new LearnerStudy(this.enrollments, (request) =>
    this.directory.callerId(request),
  );

  private library = new AssetLibrary({
    callerId: (request) => this.directory.callerId(request),
    assets: this.assets,
    seeded: libraryAssetFixtures,
    used: () => this.usedAssetIds(),
    coverOfVisibleCourse: (assetId) => this.coverOfVisibleCourse(assetId),
    id: () => this.id(),
  });

  /** How many reminders the person has due: what the mock's bell shows. */
  /** The course's draft holds content the assistant proposed: publishing asks for the review. */
  markAiGenerated(courseId: number): void {
    const record = this.courses.find((c) => c.course.id === courseId);
    if (record?.draft)
      record.draft = {
        ...record.draft,
        revision: { ...record.draft.revision, aiGenerated: true },
      };
  }

  /** Who owns a course and the program of its latest revision, for the quiz service. */
  courseOwnership(courseId: number | null) {
    const record = this.courses.find((c) => c.course.id === courseId);
    if (!record) return undefined;
    const detail = record.draft ?? record.published;
    return {
      ownerOrgId: record.course.ownerOrgId,
      ownerTeamId: record.course.ownerTeamId,
      ownerUserId: record.course.ownerUserId,
      programId: detail?.revision.programId ?? null,
    };
  }

  dueReminderCount(userId: string): number {
    return this.reminders.due(userId).length;
  }

  /** Rows the progress export allows; the real limit is 10,000. */
  exportRowLimit = 10_000;

  constructor(private readonly directory: LearningDirectory) {
    this.board = new LearnerLeaderboard(directory);
    this.streaks = new LearnerStreak(directory);
    this.levels = new LearnerLevel(directory);
    this.badges = new LearnerBadges(directory);
    this.gamification = new GamificationAdmin(directory);
  }

  /** The endpoints this service answers, for the fake backend's table. */
  entries(): [AnyEndpoint, Handler][] {
    const table: [AnyEndpoint, Handler][] = [
      [
        trainingCatalogEndpoints.listFields,
        (r) => this.listCatalog(r, this.fields, 'ownerOrgId'),
      ],
      [
        trainingCatalogEndpoints.createField,
        (r) => this.saveFieldModules(r, false),
      ],
      [
        trainingCatalogEndpoints.updateField,
        (r) => this.saveFieldModules(r, true),
      ],
      [
        trainingCatalogEndpoints.listPrograms,
        (r) => this.listCatalog(r, this.programs, 'ownerOrgId'),
      ],
      [
        trainingCatalogEndpoints.createProgram,
        (r) => this.createCatalog(r, this.programs),
      ],
      [
        trainingCatalogEndpoints.updateProgram,
        (r) => this.updateCatalog(r, this.programs),
      ],
      [
        trainingCatalogEndpoints.listModules,
        (r) => this.listCatalog(r, this.modules, 'fieldId'),
      ],
      [
        trainingCatalogEndpoints.createModule,
        (r) => this.createCatalog(r, this.modules),
      ],
      [
        trainingCatalogEndpoints.updateModule,
        (r) => this.updateCatalog(r, this.modules),
      ],
      [trainingCatalogEndpoints.deleteModule, (r) => this.deleteModule(r)],
      [courseEndpoints.instructorCourses, (r) => this.instructorCourses(r)],
      [courseEndpoints.createCourse, (r) => this.createCourse(r)],
      [courseEndpoints.getCourse, (r) => this.getCourse(r)],
      [courseEndpoints.openDraft, (r) => this.openDraft(r)],
      [courseEndpoints.saveDraft, (r) => this.saveDraft(r)],
      [courseEndpoints.publish, (r) => this.publish(r)],
      [courseEndpoints.changeState, (r) => this.changeState(r)],
      [courseEndpoints.copyCourse, (r) => this.copyCourse(r)],
      [courseEndpoints.shares, (r) => this.listShares(r)],
      [courseEndpoints.share, (r) => this.share(r)],
      ...this.library.entries(),
      [learnerEndpoints.catalog, (r) => this.learnerList(r, false)],
      [learnerEndpoints.myCourses, (r) => this.learnerList(r, true)],
      [learnerEndpoints.course, (r) => this.learnerCourse(r)],
      [learnerEndpoints.facets, (r) => this.facets(r)],
      [learnerEndpoints.progressSummary, (r) => this.progressSummary(r)],
      [learnerEndpoints.dashboard, (r) => this.dashboard(r)],
      [learnerEndpoints.dashboardPrograms, (r) => this.dashboardPrograms(r)],
      [learnerEndpoints.exportProgress, (r) => this.exportProgress(r)],
      [learningReportEndpoints.dashboard, (r) => this.managementDashboard(r)],
      [
        learningReportEndpoints.summary,
        (r) =>
          ok({
            dataAsOf: now(),
            timeZone: 'Asia/Ho_Chi_Minh',
            counts: learningCounts(this.reportRows(r)),
          }),
      ],
      [
        learningReportEndpoints.groups,
        (r) =>
          ok(paged(groupRows(this.reportRows(r), r.query['groupBy']), r.query)),
      ],
      [
        learningReportEndpoints.enrollments,
        (r) =>
          ok(paged(sortRows(this.reportRows(r), r.query['sort']), r.query)),
      ],
      [learningReportEndpoints.exportEnrollments, (r) => this.exportReport(r)],
      [
        learnerEndpoints.reminders,
        (r) => ok(this.reminders.due(this.directory.callerId(r))),
      ],
      [
        learnerEndpoints.reminderInbox,
        (r) => ok(this.reminders.inbox(this.directory.callerId(r))),
      ],
      [
        learnerEndpoints.markReminderRead,
        (r) =>
          ok(
            this.reminders.read(
              this.directory.callerId(r),
              num(r.params['reminderId']) ?? 0,
            ),
          ),
      ],
      [
        learnerEndpoints.markReminderSeen,
        (r) =>
          ok(
            this.reminders.seen(
              this.directory.callerId(r),
              num(r.params['reminderId']) ?? 0,
            ),
          ),
      ],
      [
        learnerEndpoints.deleteReminder,
        (r) =>
          ok(
            this.reminders.delete(
              this.directory.callerId(r),
              num(r.params['reminderId']) ?? 0,
            ),
          ),
      ],
      [learnerEndpoints.myPoints, (r) => ok(this.board.points(r))],
      [learnerEndpoints.myStreak, (r) => ok(this.streaks.streak(r))],
      [learnerEndpoints.weeklyActivity, (r) => ok(this.streaks.weekly(r))],
      [learnerEndpoints.myLevel, (r) => ok(this.levels.level(r))],
      [learnerEndpoints.myBadges, (r) => ok(this.badges.badges(r))],
      [gamificationEndpoints.config, (r) => ok(this.gamification.current(r))],
      [
        gamificationEndpoints.configVersions,
        (r) => ok(this.gamification.history(r)),
      ],
      [gamificationEndpoints.saveConfig, (r) => ok(this.gamification.save(r))],
      [
        gamificationEndpoints.calendar,
        (r) => ok(this.gamification.calendar(r)),
      ],
      [
        gamificationEndpoints.saveCalendar,
        (r) => ok(this.gamification.saveCalendar(r)),
      ],
      [gamificationEndpoints.badges, (r) => ok(this.gamification.badgeList(r))],
      [
        gamificationEndpoints.createBadge,
        (r) => ok(this.gamification.createBadge(r)),
      ],
      [
        gamificationEndpoints.updateBadge,
        (r) => ok(this.gamification.updateBadge(r)),
      ],
      [
        gamificationEndpoints.retireBadge,
        (r) => ok(this.gamification.retireBadge(r)),
      ],
      [gamificationEndpoints.impact, (r) => ok(this.gamification.impact(r))],
      [
        gamificationEndpoints.exportImpact,
        (r) => this.gamification.exportImpact(r),
      ],
      [learnerEndpoints.leaderboard, (r) => ok(this.board.leaderboard(r))],
      [learnerEndpoints.unitLeaderboard, (r) => ok(this.board.units(r))],
      [learnerEndpoints.myPreferences, (r) => ok(this.board.preferences(r))],
      [
        learnerEndpoints.updateMyPreferences,
        (r) => ok(this.board.updatePreferences(r)),
      ],
      [personalEndpoints.lessonNotes, (r) => ok(this.notes.notesOf(r))],
      [personalEndpoints.addNote, (r) => ok(this.notes.addNote(r))],
      [personalEndpoints.deleteNote, (r) => ok(this.notes.deleteNote(r))],
      [personalEndpoints.lessonBookmarks, (r) => ok(this.notes.bookmarksOf(r))],
      [
        personalEndpoints.toggleBookmark,
        (r) => ok(this.notes.toggleBookmark(r)),
      ],
      [
        personalEndpoints.deleteBookmark,
        (r) => ok(this.notes.deleteBookmark(r)),
      ],
      [personalEndpoints.saved, (r) => ok(this.notes.saved(r))],
      [
        feedbackEndpoints.lessonFeedback,
        (r) => ok(this.feedback.lessonFeedback(r)),
      ],
      [feedbackEndpoints.rateLesson, (r) => ok(this.feedback.rate(r))],
      [feedbackEndpoints.sendFeedback, (r) => ok(this.feedback.send(r))],
      [feedbackEndpoints.lessonComments, (r) => ok(this.feedback.comments(r))],
      [
        certificateEndpoints.certificates,
        (r) => ok(this.certificates.certificates(r)),
      ],
      [
        certificateEndpoints.certificate,
        (r) => ok(this.certificates.certificate(r)),
      ],
      [learnerEndpoints.enroll, (r) => this.enroll(r)],
      [learnerEndpoints.enrollment, (r) => this.enrollmentDetail(r)],
      [learnerEndpoints.openSession, (r) => this.study.openSession(r)],
      [learnerEndpoints.saveProgress, (r) => this.study.saveProgress(r)],
      [assignmentEndpoints.courseAssignments, (r) => this.courseAssignments(r)],
      [assignmentEndpoints.assignCourse, (r) => this.assignCourse(r)],
      [assignmentEndpoints.getAssignment, (r) => this.getAssignment(r)],
      [assignmentEndpoints.revokeRecipient, (r) => this.revokeRecipient(r)],
      [assignmentEndpoints.orgAssignments, (r) => this.orgAssignments(r)],
      [
        assignmentEndpoints.rescheduleAssignment,
        (r) => this.rescheduleAssignment(r),
      ],
      [assignmentEndpoints.remindAssignment, (r) => this.remindAssignment(r)],
      [assignmentEndpoints.revokeAssignment, (r) => this.revokeAssignment(r)],
      [assignmentEndpoints.listGroups, (r) => this.listGroups(r)],
      [assignmentEndpoints.createGroup, (r) => this.createGroup(r)],
      [assignmentEndpoints.getGroup, (r) => this.getGroup(r)],
      [assignmentEndpoints.replaceMembers, (r) => this.replaceMembers(r)],
    ];
    return table.map(([endpoint, handler]) => [
      endpoint,
      (request) => {
        try {
          this.directory.callerId(request);
          return handler(request);
        } catch (error) {
          if (error instanceof LearningRefused) return error.reply;
          throw error;
        }
      },
    ]);
  }

  private id(): number {
    return this.nextId++;
  }

  /**
   * Whether `assetId` is the cover of a published, active course; `undefined` when no draft or
   * published revision uses it as its cover.
   */
  private coverOfVisibleCourse(assetId: number): boolean | undefined {
    const covering = this.courses.filter((record) =>
      [record.published, record.draft].some(
        (detail) => detail?.revision.coverAssetId === assetId,
      ),
    );
    if (covering.length === 0) return undefined;
    return covering.some(
      (record) =>
        record.published?.revision.coverAssetId === assetId &&
        record.course.lifecycleStatus === 'active',
    );
  }

  /** The assets some draft or published tree of any course still uses. */
  private usedAssetIds(): Set<number> {
    const ids = new Set<number>();
    for (const record of this.courses) {
      for (const detail of [record.published, record.draft]) {
        const cover = detail?.revision.coverAssetId;
        if (cover) ids.add(cover);
        for (const chapter of detail?.chapters ?? []) {
          for (const lesson of chapter.lessons) {
            for (const block of lesson.blocks) {
              for (const { asset } of block.assets) ids.add(asset.id);
            }
          }
        }
      }
    }
    return ids;
  }

  // ---- training catalogue -------------------------------------------------------------------

  private saveFieldModules(request: FakeRequest, update: boolean): FakeReply {
    const fields = structuredClone(this.fields),
      modules = structuredClone(this.modules),
      nextId = this.nextId;
    try {
      const { modules: changes, ...body } =
        request.body as SaveTrainingFieldCommand;
      const reply = update
        ? this.updateCatalog({ ...request, body }, this.fields)
        : this.createCatalog({ ...request, body }, this.fields);
      const field = reply.body.data as TrainingField;
      const seen = new Set<number>();
      for (const change of changes ?? []) {
        if (change.id !== undefined) {
          const existing = this.modules.find((m) => m.id === change.id);
          if (!update || seen.has(change.id) || existing?.fieldId !== field.id)
            refuse('stateConflict');
          seen.add(change.id);
        }
        const rowRequest = {
          ...request,
          params: { id: String(change.id ?? '') },
          query: { expectedVersion: String(change.expectedVersion ?? '') },
          body: { ...change, ownerOrgId: field.ownerOrgId, fieldId: field.id },
        };
        if (change.deleted) this.deleteModule(rowRequest);
        else if (change.id) this.updateCatalog(rowRequest, this.modules);
        else this.createCatalog(rowRequest, this.modules);
      }
      return reply;
    } catch (error) {
      this.fields = fields;
      this.modules = modules;
      this.nextId = nextId;
      throw error;
    }
  }

  private deleteModule(request: FakeRequest): FakeReply {
    const id = num(request.params['id']);
    const row = this.modules.find((m) => m.id === id);
    if (!row) return refuse('resourceNotFound');
    if (row.rowVersion !== num(request.query['expectedVersion']))
      refuse('stateConflict');
    if (
      this.courses.some((course) =>
        [course.draft, course.published].some(
          (revision) => revision?.revision.moduleId === id,
        ),
      )
    )
      refuse('stateConflict');
    this.modules = this.modules.filter((m) => m.id !== id);
    return ok(null);
  }

  private listCatalog<T extends { sortNo?: number | null }>(
    request: FakeRequest,
    rows: readonly T[],
    key: 'ownerOrgId' | 'fieldId',
  ): FakeReply {
    const owner = num(request.query[key]);
    const matching = rows
      .filter((row) => (row as Record<string, unknown>)[key] === owner)
      .sort((a, b) => (a.sortNo ?? 0) - (b.sortNo ?? 0));
    return ok(paged(matching, request.query));
  }

  private createCatalog<T extends { id: number; code: string }>(
    request: FakeRequest,
    rows: T[],
  ): FakeReply {
    const command = request.body as SaveCatalogItemCommand;
    if (
      rows.some(
        (row) =>
          row.code.toLowerCase() === command.code.toLowerCase() &&
          (!Object.is(rows, this.modules) ||
            (row as unknown as BusinessModule).fieldId === command.fieldId),
      )
    ) {
      refuse('stateConflict');
    }
    const created = {
      ...command,
      id: this.id(),
      description: command.description ?? null,
      sortNo: command.sortNo ?? rows.length + 1,
      rowVersion: 0,
      createTime: now(),
      updateTime: now(),
    } as unknown as T;
    rows.push(created);
    return ok(created);
  }

  private updateCatalog<
    T extends { id: number; code: string; rowVersion: number },
  >(request: FakeRequest, rows: T[]): FakeReply {
    const row = rows.find((r) => r.id === num(request.params['id']));
    if (!row) return refuse('resourceNotFound');
    if (row.rowVersion !== num(request.query['expectedVersion']))
      refuse('stateConflict');
    const {
      ownerOrgId: _org,
      fieldId: _field,
      ...command
    } = request.body as SaveCatalogItemCommand;
    if (
      rows.some(
        (other) =>
          other.id !== row.id &&
          other.code.toLowerCase() === command.code.toLowerCase() &&
          (!Object.is(rows, this.modules) ||
            (other as unknown as BusinessModule).fieldId ===
              (row as unknown as BusinessModule).fieldId),
      )
    )
      refuse('stateConflict');
    Object.assign(row, command, {
      rowVersion: row.rowVersion + 1,
      updateTime: now(),
    });
    return ok(row);
  }

  // ---- courses ------------------------------------------------------------------------------

  private record(request: FakeRequest): CourseRecord {
    const record = this.courses.find(
      (c) => c.course.id === num(request.params['courseId']),
    );
    return record ?? refuse('resourceNotFound');
  }

  /** The revision an author works on: the draft, else the published one. */
  private latest(record: CourseRecord): CourseDetail {
    const detail = record.draft ?? record.published;
    if (!detail) return refuse('resourceNotFound');
    return { ...detail, course: { ...record.course } };
  }

  private card(record: CourseRecord, revision: CourseDetail): CourseCard {
    const lessons = revision.chapters.flatMap((c) => c.lessons);
    const people = new Set(
      this.assignments
        .filter((a) => a.assignment.courseId === record.course.id)
        .flatMap((a) =>
          a.recipients
            .filter((r) => r.status === 'active')
            .map((r) => r.userId),
        ),
    );
    const program = this.programs.find(
      (p) => p.id === revision.revision.programId,
    );
    const module = this.modules.find(
      (m) => m.id === revision.revision.moduleId,
    );
    const field = this.fields.find((f) => f.id === program?.fieldId);
    return {
      courseId: record.course.id,
      revisionId: revision.revision.id,
      code: record.course.code,
      title: revision.revision.title,
      programId: revision.revision.programId,
      moduleId: revision.revision.moduleId,
      level: revision.revision.level,
      requirement: revision.revision.defaultRequirement,
      publicationState: record.published ? 'published' : 'draft',
      lifecycleStatus: record.course.lifecycleStatus,
      lessonCount: lessons.length,
      durationSeconds: lessons.reduce(
        (sum, l) => sum + (l.lesson.estimatedDurationSeconds ?? 0),
        0,
      ),
      assignedCount: people.size,
      updateTime: record.course.updateTime,
      fieldId: field?.id ?? null,
      fieldName: field?.name ?? null,
      programName: program?.name ?? null,
      moduleName: module?.name ?? null,
      failed: false,
      bestScorePercent: null,
      rating: this.feedback.courseRating(record.course.id),
      certificateId: null,
      coverAssetId: revision.revision.coverAssetId ?? null,
    };
  }

  private matches(
    card: CourseCard,
    query: Readonly<Record<string, string>>,
  ): boolean {
    const q = query['q']?.trim().toLowerCase();
    const fieldId = num(query['fieldId']);
    return (
      (!q || `${card.code} ${card.title ?? ''}`.toLowerCase().includes(q)) &&
      (fieldId === undefined || card.fieldId === fieldId) &&
      (num(query['programId']) === undefined ||
        card.programId === num(query['programId'])) &&
      (num(query['moduleId']) === undefined ||
        card.moduleId === num(query['moduleId'])) &&
      (query['withoutModule'] !== 'true' || card.moduleName == null) &&
      (!query['level'] || card.level === query['level']) &&
      (!query['requirement'] || card.requirement === query['requirement'])
    );
  }

  private sorted(cards: CourseCard[], sort: string | undefined): CourseCard[] {
    const [field, dir] = (sort ?? 'updateTime,desc').split(',');
    const sign = dir === 'desc' ? -1 : 1;
    const value = (card: CourseCard): string | number =>
      field === 'title'
        ? (card.title ?? card.code)
        : field === 'progressPercent'
          ? (card.progressPercent ?? -1)
          : field === 'dueAt'
            ? (card.dueAt ?? '9999')
            : field === 'startedAt' ||
                field === 'lastAccessAt' ||
                field === 'completedAt'
              ? (card[field] ?? '')
              : field === 'id'
                ? (card.courseId ?? 0)
                : (card.updateTime ?? '');
    return cards.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      return (
        (typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), 'vi')) * sign
      );
    });
  }

  private instructorCourses(request: FakeRequest): FakeReply {
    const state = request.query['state'];
    const cards = this.courses
      .map((record) => this.card(record, this.latest(record)))
      .filter((card) => this.matches(card, request.query))
      .filter(
        (card) =>
          !state ||
          card.publicationState === state ||
          card.lifecycleStatus === state,
      );
    return ok(paged(this.sorted(cards, request.query['sort']), request.query));
  }

  private createCourse(request: FakeRequest): FakeReply {
    const command = request.body as CreateCourseCommand;
    if (
      this.courses.some(
        (c) => c.course.code.toLowerCase() === command.code.toLowerCase(),
      )
    ) {
      refuse('learningDuplicate');
    }
    const courseId = this.id();
    const empty: CourseDetail = {
      course: {
        id: courseId,
        code: command.code,
        ownerOrgId: command.ownerOrgId,
        ownerTeamId: command.ownerTeamId ?? null,
        ownerUserId: this.directory.callerId(request),
        publishedRevisionId: null,
        lifecycleStatus: 'active',
        copiedFromCourseId: null,
        rowVersion: 0,
        createTime: now(),
        updateTime: now(),
      },
      revision: this.emptyRevision(courseId, 1, command.title ?? null),
      objectives: [],
      chapters: [],
      completionRule: null,
      finalQuizId: null,
    };
    // The draft is written like a save: its title wins over `title`, and the tree is stored whole.
    const detail = command.draft
      ? this.writeDraft(empty, {
          ...command.draft,
          title: command.draft.title ?? command.title,
        })
      : empty;
    this.courses.push({
      course: { ...detail.course },
      published: null,
      draft: detail,
    });
    return ok(detail);
  }

  private emptyRevision(
    courseId: number,
    revisionNo: number,
    title: string | null,
  ) {
    return {
      id: this.id(),
      courseId,
      revisionNo,
      state: 'draft',
      basedOnRevisionId: null,
      programId: null,
      moduleId: null,
      title,
      summary: null,
      level: null,
      defaultRequirement: 'mandatory' as const,
      coverAssetId: null,
      coverIcon: null,
      coverColor: null,
      publishedAt: null,
      publishedBy: null,
      rowVersion: 0,
      createTime: now(),
      updateTime: now(),
    };
  }

  private getCourse(request: FakeRequest): FakeReply {
    const record = this.record(request);
    const revisionId = num(request.query['revisionId']);
    if (revisionId === undefined) return ok(this.latest(record));
    const detail = [record.draft, record.published].find(
      (d) => d?.revision.id === revisionId,
    );
    return detail
      ? ok({ ...detail, course: { ...record.course } })
      : refuse('resourceNotFound');
  }

  private openDraft(request: FakeRequest): FakeReply {
    const record = this.record(request);
    if (record.draft) return ok(this.latest(record));
    const base = record.published ?? refuse('resourceNotFound');
    const revisionId = this.id();
    record.draft = this.rebuild(
      {
        ...base,
        revision: {
          ...base.revision,
          id: revisionId,
          revisionNo: base.revision.revisionNo + 1,
          state: 'draft',
          basedOnRevisionId: base.revision.id,
          publishedAt: null,
          publishedBy: null,
          rowVersion: 0,
        },
      },
      this.toInput(base),
      true,
    );
    return ok(this.latest(record));
  }

  /** The tree of a revision as the save command spells it. */
  private toInput(detail: CourseDetail): ChapterInput[] {
    return detail.chapters.map((c) => ({
      title: c.chapter.title,
      lessons: c.lessons.map((l) => ({
        title: l.lesson.title,
        lessonType: l.lesson.lessonType,
        scormPackageId: l.lesson.scormPackageId ?? null,
        scormCompletionRule: l.lesson.scormCompletionRule ?? null,
        ...(l.lesson.quizId ? { quizId: l.lesson.quizId } : {}),
        estimatedDurationSeconds: l.lesson.estimatedDurationSeconds ?? 0,
        isRequired: l.lesson.isRequired ?? true,
        blocks: l.blocks.map((b) => ({
          blockType: b.block.blockType,
          title: b.block.title,
          body: b.block.body ?? undefined,
          bodyFormat: b.block.bodyFormat ?? undefined,
          completionMode: b.block.completionMode,
          completionThreshold: b.block.completionThreshold ?? undefined,
          isRequired: b.block.isRequired ?? true,
          assets: b.assets.map((a) => ({
            assetId: a.asset.id,
            usage: a.usage.usage,
          })),
          steps: b.steps.map((s) => ({
            title: s.title,
            description: s.description ?? undefined,
          })),
          videoChapters: b.block.videoChapters,
          transcript: b.block.transcript,
          allowSeeking: b.block.allowSeeking,
        })),
      })),
    }));
  }

  /**
   * A revision with a new tree: every chapter, lesson and block gets a new id, as the backend
   * does. `fromSource` links each row to the one at the same place in `base` (a cloned draft).
   */
  private rebuild(
    base: CourseDetail,
    chapters: readonly ChapterInput[],
    fromSource: boolean,
  ): CourseDetail {
    const revisionId = base.revision.id;
    const stamp = { rowVersion: 0, createTime: now(), updateTime: now() };
    return {
      ...base,
      chapters: chapters.map((chapter, ci) => {
        const chapterId = this.id();
        const sourceChapter = fromSource ? base.chapters[ci] : undefined;
        return {
          chapter: {
            id: chapterId,
            revisionId,
            title: chapter.title,
            sortNo: ci + 1,
            sourceChapterId: sourceChapter?.chapter.id ?? null,
            ...stamp,
          },
          lessons: chapter.lessons.map((lesson, li) => {
            const lessonId = this.id();
            const sourceLesson = sourceChapter?.lessons[li];
            return {
              lesson: {
                id: lessonId,
                chapterId,
                title: lesson.title,
                lessonType: lesson.lessonType,
                quizId: lesson.quizId ?? null,
                scormPackageId: lesson.scormPackageId ?? null,
                scormCompletionRule:
                  lesson.lessonType === 'scorm'
                    ? (lesson.scormCompletionRule ?? 'completed_or_passed')
                    : null,
                estimatedDurationSeconds: lesson.estimatedDurationSeconds,
                isRequired: lesson.isRequired ?? true,
                sortNo: li + 1,
                sourceLessonId: sourceLesson?.lesson.id ?? null,
                ...stamp,
              },
              blocks: lesson.blocks.map((block, bi) => {
                const blockId = this.id();
                return {
                  block: {
                    id: blockId,
                    lessonId,
                    blockType: block.blockType,
                    title: block.title,
                    body: block.body ?? null,
                    bodyFormat: block.bodyFormat ?? null,
                    completionMode: block.completionMode,
                    completionThreshold: block.completionThreshold ?? null,
                    isRequired: block.isRequired ?? true,
                    sortNo: bi + 1,
                    sourceBlockId: sourceLesson?.blocks[bi]?.block.id ?? null,
                    videoChapters: block.videoChapters ?? [],
                    transcript: block.transcript ?? [],
                    allowSeeking: block.allowSeeking ?? false,
                    ...stamp,
                  },
                  assets: block.assets.flatMap((use, ai) => {
                    const asset = this.library.asset(use.assetId);
                    return asset
                      ? [
                          {
                            usage: {
                              id: this.id(),
                              blockId,
                              assetId: asset.id,
                              usage: use.usage,
                              caption: use.caption ?? null,
                              altText: use.altText ?? null,
                              sortNo: ai + 1,
                              ...stamp,
                            },
                            asset,
                          },
                        ]
                      : [];
                  }),
                  steps: block.steps.map((step, si) => ({
                    id: this.id(),
                    blockId,
                    title: step.title,
                    description: step.description ?? null,
                    sortNo: si + 1,
                    ...stamp,
                  })),
                };
              }),
            };
          }),
        };
      }),
    };
  }

  private draftOf(request: FakeRequest): {
    record: CourseRecord;
    draft: CourseDetail;
  } {
    const record = this.record(request);
    const draft = record.draft;
    if (!draft || draft.revision.id !== num(request.params['revisionId'])) {
      return refuse('stateConflict');
    }
    return { record, draft };
  }

  private saveDraft(request: FakeRequest): FakeReply {
    const { record, draft } = this.draftOf(request);
    const command = request.body as SaveDraftCommand;
    if (command.expectedVersion !== draft.revision.rowVersion)
      refuse('stateConflict');
    record.draft = this.writeDraft(draft, command);
    record.course.updateTime = now();
    return ok(this.latest(record));
  }

  /** The draft revision with the command's fields and tree written, its version moved on by one. */
  private writeDraft(
    draft: CourseDetail,
    command: Omit<SaveDraftCommand, 'expectedVersion'>,
  ): CourseDetail {
    const revision = {
      ...draft.revision,
      programId: command.programId ?? null,
      moduleId: command.moduleId ?? null,
      title: command.title ?? null,
      summary: command.summary ?? null,
      level: command.level ?? null,
      defaultRequirement: command.defaultRequirement,
      coverAssetId: command.coverAssetId ?? null,
      coverIcon: command.coverIcon ?? null,
      rowVersion: draft.revision.rowVersion + 1,
      updateTime: now(),
    };
    const saved = this.rebuild({ ...draft, revision }, command.chapters, false);
    return {
      ...saved,
      objectives: command.objectives.map((description, index) => ({
        id: this.id(),
        revisionId: revision.id,
        description,
        sortNo: index + 1,
        rowVersion: 0,
        createTime: now(),
        updateTime: now(),
      })),
      completionRule: {
        id: draft.completionRule?.id ?? this.id(),
        revisionId: revision.id,
        requireAllRequiredLessons: true,
        rewardPoints: command.rewardPoints ?? 0,
        rowVersion: 0,
        createTime: now(),
        updateTime: now(),
      },
      finalQuizId: command.finalQuizId ?? null,
    };
  }

  private publish(request: FakeRequest): FakeReply {
    const { record, draft } = this.draftOf(request);
    const parsed = PublishCourseCommandSchema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    const { expectedVersion, assignments = [], shareOrgIds = [] } = parsed.data;
    if (expectedVersion !== draft.revision.rowVersion) refuse('stateConflict');
    if (
      !draft.revision.title ||
      draft.chapters.every((c) => c.lessons.length === 0)
    ) {
      refuse('validationFailed');
    }
    if (
      draft.finalQuizId !== null &&
      this.directory.quizStatus(draft.finalQuizId) !== 'PUBLISHED'
    ) {
      refuse('finalExamUnpublished');
    }
    // All or nothing: a refused row puts back everything the publish and the earlier rows changed.
    const before = {
      published: record.published,
      course: { ...record.course },
      assignments: [...this.assignments],
      shares: [...this.shares],
    };
    record.published = {
      ...draft,
      revision: {
        ...draft.revision,
        state: 'published',
        publishedAt: now(),
        publishedBy: this.directory.callerId(request),
        rowVersion: draft.revision.rowVersion + 1,
      },
    };
    record.draft = null;
    Object.assign(record.course, {
      publishedRevisionId: draft.revision.id,
      rowVersion: record.course.rowVersion + 1,
      updateTime: now(),
    });
    try {
      this.shareOnPublish(request, record, shareOrgIds);
      this.assignOnPublish(request, record, draft, assignments);
      const quizzes = new Set(
        draft.chapters.flatMap((chapter) =>
          chapter.lessons.flatMap(({ lesson }) =>
            lesson.lessonType === 'quiz' && lesson.quizId
              ? [lesson.quizId]
              : [],
          ),
        ),
      );
      if (quizzes.size)
        this.directory.publishLessonQuizzes(request, record.course.id, [
          ...quizzes,
        ]);
    } catch (error) {
      record.published = before.published;
      record.draft = draft;
      Object.assign(record.course, before.course);
      this.assignments = before.assignments;
      this.shares = before.shares;
      throw error;
    }
    return ok(this.latest(record));
  }

  /** The units a publish shares with; one with an active share is left as it is. */
  private shareOnPublish(
    request: FakeRequest,
    record: CourseRecord,
    orgIds: readonly number[],
  ): void {
    orgIds.forEach((orgId, index) => {
      if (
        orgId === record.course.ownerOrgId ||
        this.directory.nameOf('org', orgId) === undefined
      ) {
        refuseField(
          `shareOrgIds[${index}]`,
          'LEARNING-INVALID_REFERENCE',
          'ID tham chiếu không tồn tại hoặc không đúng quan hệ.',
        );
      }
      const active = this.shares.some(
        (s) =>
          s.courseId === record.course.id &&
          s.orgId === orgId &&
          s.status === 'active',
      );
      if (active) return;
      this.share({
        ...request,
        params: { courseId: String(record.course.id) },
        body: {
          orgId,
          includeDescendants: true,
          canAssign: true,
          canSelfEnroll: false,
          active: true,
        },
      });
    });
  }

  /** Each row becomes one assignment of the revision just published, by the owner unit. */
  private assignOnPublish(
    request: FakeRequest,
    record: CourseRecord,
    draft: CourseDetail,
    rows: readonly PublishAssignment[],
  ): void {
    rows.forEach((row, index) => {
      const field = `assignments[${index}]`;
      if (row.dueAt && Date.parse(row.dueAt) <= Date.parse(row.startAt)) {
        refuseField(
          field,
          'OUT_OF_RANGE',
          'Hạn hoàn thành phải sau thời điểm mở học.',
        );
      }
      if (this.resolve(row.target).length === 0) {
        refuseField(
          field,
          'LEARNING-EMPTY_TARGET',
          'Đối tượng giao không có học viên hợp lệ hoặc vượt giới hạn 500 người.',
        );
      }
      const command: AssignCourseCommand = {
        revisionId: draft.revision.id,
        assigningOrgId: record.course.ownerOrgId,
        startAt: row.startAt,
        ...(row.dueAt ? { dueAt: row.dueAt } : {}),
        requirement: draft.revision.defaultRequirement ?? 'optional',
        enrollmentMode: 'continue',
        reminderEnabled: row.reminderEnabled,
        reminderDaysBefore: row.reminderDaysBefore,
        idempotencyKey: `publish-${draft.revision.id}-${index}`,
        targets: [row.target],
      };
      this.assignCourse({
        ...request,
        params: { courseId: String(record.course.id) },
        body: command,
      });
    });
  }

  private changeState(request: FakeRequest): FakeReply {
    const record = this.record(request);
    const command = request.body as ChangeCourseStateCommand;
    if (command.expectedVersion !== record.course.rowVersion)
      refuse('stateConflict');
    Object.assign(record.course, {
      lifecycleStatus: command.status,
      rowVersion: record.course.rowVersion + 1,
      updateTime: now(),
    });
    return ok({ ...record.course });
  }

  private copyCourse(request: FakeRequest): FakeReply {
    const record = this.record(request);
    const { code } = request.body as { code: string };
    if (
      this.courses.some(
        (c) => c.course.code.toLowerCase() === code.toLowerCase(),
      )
    ) {
      refuse('stateConflict');
    }
    const base = this.latest(record);
    const courseId = this.id();
    const revision = {
      ...this.emptyRevision(courseId, 1, base.revision.title ?? null),
      ...{
        programId: base.revision.programId,
        moduleId: base.revision.moduleId,
        summary: base.revision.summary,
        level: base.revision.level,
        defaultRequirement: base.revision.defaultRequirement,
        coverAssetId: base.revision.coverAssetId,
        coverIcon: base.revision.coverIcon,
      },
    };
    const course = {
      ...record.course,
      id: courseId,
      code,
      publishedRevisionId: null,
      copiedFromCourseId: record.course.id,
      rowVersion: 0,
      createTime: now(),
      updateTime: now(),
    };
    const draft = this.rebuild(
      {
        ...base,
        course,
        revision,
        objectives: base.objectives.map((o) => ({
          ...o,
          id: this.id(),
          revisionId: revision.id,
        })),
      },
      this.toInput(base),
      false,
    );
    this.courses.push({ course, published: null, draft });
    return ok(draft);
  }

  private listShares(request: FakeRequest): FakeReply {
    const courseId = this.record(request).course.id;
    return ok(this.shares.filter((s) => s.courseId === courseId));
  }

  private share(request: FakeRequest): FakeReply {
    const record = this.record(request);
    const courseId = record.course.id;
    const parsed = ShareCourseCommandSchema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    const command = parsed.data;
    // A course is already the owner unit's: sharing it with that unit is a wrong reference.
    if (command.orgId === record.course.ownerOrgId) {
      return refuse('invalidReference');
    }
    const existing = this.shares.find(
      (s) => s.courseId === courseId && s.orgId === command.orgId,
    );
    const share: CourseShare = {
      id: existing?.id ?? this.id(),
      courseId,
      orgId: command.orgId,
      includeDescendants: command.includeDescendants,
      canAssign: command.canAssign,
      canSelfEnroll: command.canSelfEnroll,
      status: command.active ? 'active' : 'revoked',
      sharedBy: this.directory.callerId(request),
      sharedAt: now(),
      revokedAt: command.active ? null : now(),
      rowVersion: (existing?.rowVersion ?? -1) + 1,
      createTime: existing?.createTime ?? now(),
      updateTime: now(),
    };
    this.shares = [...this.shares.filter((s) => s !== existing), share];
    return ok(share);
  }

  // ---- learner ------------------------------------------------------------------------------

  /** The cards a learner's list shows, filtered and sorted by `request.query` and not paged. */
  private learnerCards(request: FakeRequest, mineOnly: boolean): CourseCard[] {
    const userId = this.directory.callerId(request);
    const learningStatus = request.query['learningStatus'];
    const flag = (name: 'overdue' | 'assigned' | 'failed') =>
      request.query[name] === undefined
        ? undefined
        : request.query[name] === 'true';
    const overdue = flag('overdue');
    const assigned = flag('assigned');
    const failed = flag('failed');
    const cards = this.courses
      .filter(
        (record) =>
          record.published && record.course.lifecycleStatus === 'active',
      )
      .map((record) =>
        this.learnerCard(record, this.enrollments.of(userId, record.course.id)),
      )
      .filter((card) => !mineOnly || card.assigned || card.enrollmentId)
      .filter((card) => this.matches(card, request.query))
      .filter(
        (card) =>
          !learningStatus ||
          (card.learningStatus ?? 'not_started') === learningStatus,
      )
      .filter((card) => overdue === undefined || !!card.overdue === overdue)
      .filter((card) => assigned === undefined || !!card.assigned === assigned)
      .filter((card) => failed === undefined || !!card.failed === failed);
    return this.sorted(cards, request.query['sort'] ?? 'dueAt,asc');
  }

  private learnerList(request: FakeRequest, mineOnly: boolean): FakeReply {
    const cards = this.learnerCards(request, mineOnly);
    if (
      !mineOnly ||
      (!request.query['learningStatus'] &&
        (request.query['requirement'] === 'mandatory' ||
          request.query['assigned'] === 'true'))
    ) {
      cards.sort(
        (a, b) =>
          Number(a.learningStatus === 'completed') -
          Number(b.learningStatus === 'completed'),
      );
    }
    return ok(paged(cards, request.query));
  }

  /** One visible course with its card and content; not enrolled, the lessons keep no blocks. */
  private learnerCourse(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const courseId = num(request.params['courseId']) ?? 0;
    const record = this.courses.find(
      (r) =>
        r.course.id === courseId &&
        r.published &&
        r.course.lifecycleStatus === 'active',
    );
    if (!record?.published) return refuse('learningNotFound');
    const enrolled = this.enrollments.of(userId, courseId);
    const card = this.learnerCard(record, enrolled);
    const content: CourseDetail = enrolled
      ? enrolled.content
      : {
          ...record.published,
          chapters: record.published.chapters.map((chapter) => ({
            ...chapter,
            lessons: chapter.lessons.map((lesson) => ({
              ...lesson,
              blocks: [],
            })),
          })),
        };
    const result: LearnerCourse = { card, content };
    return ok(result);
  }

  /** The fields, programmes and modules of the courses the caller sees, by `sortNo` then name. */
  private facets(request: FakeRequest): FakeReply {
    const cards = this.learnerCards(
      { ...request, query: { sort: 'id,asc' } },
      false,
    );
    const used = (ids: (number | null | undefined)[]) =>
      new Set(ids.filter((id): id is number => id != null));
    const byOrder = (
      a: { sortNo?: number | null; name: string },
      b: { sortNo?: number | null; name: string },
    ) =>
      (a.sortNo ?? 0) - (b.sortNo ?? 0) || a.name.localeCompare(b.name, 'vi');
    const programs = used(cards.map((c) => c.programId));
    const modules = used(cards.map((c) => c.moduleId));
    const fields = used(cards.map((c) => c.fieldId));
    const facets: LearnerFacets = {
      fields: this.fields
        .filter((f) => fields.has(f.id))
        .sort(byOrder)
        .map(({ id, code, name }) => ({ id, code, name })),
      programs: this.programs
        .filter((p) => programs.has(p.id))
        .sort(byOrder)
        .flatMap(({ id, fieldId, code, name }) =>
          fieldId == null ? [] : [{ id, fieldId, code, name }],
        ),
      modules: this.modules
        .filter((m) => modules.has(m.id))
        .sort(byOrder)
        .map(({ id, fieldId, code, name }) => ({ id, fieldId, code, name })),
      fieldsWithUnclassifiedCourses: [
        ...new Set(
          cards
            .filter((card) => card.moduleName == null)
            .map((card) => card.fieldId ?? null),
        ),
      ],
    };
    return ok(facets);
  }

  /** Counts over the caller's own cycles, a stand-in for the backend's (it counts the same rows). */
  private progressSummary(request: FakeRequest): FakeReply {
    const mine = this.learnerCards(
      { ...request, query: { sort: 'id,asc' } },
      true,
    );
    const status = (card: CourseCard) => card.learningStatus ?? 'not_started';
    const unavailable = { availability: 'unavailable' };
    return ok({
      serverTime: now(),
      timeZone: 'Asia/Ho_Chi_Minh',
      counts: {
        total: mine.length,
        completed: mine.filter((c) => status(c) === 'completed').length,
        inProgress: mine.filter((c) => status(c) === 'in_progress').length,
        notStarted: mine.filter((c) => status(c) === 'not_started').length,
        overdue: mine.filter((c) => c.overdue).length,
        assigned: mine.filter((c) => c.assigned).length,
        mandatory: mine.filter((c) => c.requirement === 'mandatory').length,
      },
      activity: unavailable,
      assessment:
        learnerAssessmentFixtures[this.directory.callerId(request)] ??
        unavailable,
      competency: unavailable,
    });
  }

  /** The caller's own cycles, unfiltered: what the dashboard reads. */
  private ownCards(request: FakeRequest): CourseCard[] {
    return this.learnerCards({ ...request, query: { sort: 'id,asc' } }, true);
  }

  private dashboard(request: FakeRequest): FakeReply {
    return ok(
      dashboardOf(
        this.ownCards(request),
        this.directory.callerId(request),
        now(),
      ),
    );
  }

  private dashboardPrograms(request: FakeRequest): FakeReply {
    return ok(paged(programGroupsOf(this.ownCards(request)), request.query));
  }

  /** Mirrors the backend's CSV: UTF-8 BOM, quoted cells, a leading `'` before a formula. */
  /**
   * Every enrolment in the caller's report scope that matches the filter, with the names the
   * report resolves. The org and team are the learner's current ones: the seed keeps no snapshot.
   */
  private reportRows(
    request: FakeRequest,
    dashboard = false,
  ): LearningReportEnrollmentRow[] {
    const coversCourse = dashboard
      ? this.directory.dashboardScope(request)
      : undefined;
    const coversPerson = dashboard
      ? undefined
      : this.directory.reportScope(request);
    const people = new Map(this.directory.people().map((p) => [p.userId, p]));
    const rows = this.enrollments.all().flatMap((enrolled) => {
      const person = people.get(enrolled.enrollment.userId);
      const record = this.courses.find(
        (r) => r.course.id === enrolled.enrollment.courseId,
      );
      if (
        !person ||
        !record?.published ||
        (coversCourse && !coversCourse(record.course)) ||
        (coversPerson && !coversPerson(person))
      )
        return [];
      const card = this.learnerCard(record, enrolled);
      const e = enrolled.enrollment;
      const orgId = e.orgIdSnapshot ?? person.orgId;
      const teamId = e.teamIdSnapshot ?? person.teamId;
      const row: LearningReportEnrollmentRow = {
        enrollment: {
          id: e.id,
          userId: e.userId,
          courseId: e.courseId,
          courseCode: card.code,
          courseTitle: card.title ?? card.code,
          revisionId: e.revisionId,
          programId: card.programId ?? null,
          programName: card.programName ?? null,
          orgId,
          teamId,
          status: (card.learningStatus ?? 'not_started') as LearningStatus,
          progressPercent: card.progressPercent ?? 0,
          assigned: !!card.assigned,
          mandatory: card.requirement === 'mandatory',
          enrolledAt: e.enrolledAt ?? null,
          startedAt: e.startedAt ?? null,
          lastAccessAt: e.lastAccessAt ?? null,
          completedAt: e.completedAt ?? null,
          dueAt: card.dueAt ?? null,
          overdue: !!card.overdue,
          canStudy: true,
        },
        fullName: this.directory.nameOf('user', e.userId) ?? null,
        orgName:
          orgId === null ? null : (this.directory.nameOf('org', orgId) ?? null),
        teamName:
          teamId === null
            ? null
            : (this.directory.nameOf('team', teamId) ?? null),
      };
      return [row];
    });
    return filterRows(rows, request.query);
  }

  private managementDashboard(request: FakeRequest): FakeReply {
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dataAsOf = now();
    const rows = this.reportRows(request, true);
    const daily = Array.from({ length: 14 }, (_, index) => ({
      date: dateFormatter.format(
        new Date(Date.parse(dataAsOf) - (13 - index) * DAY),
      ),
      started: 0,
      completed: 0,
    }));
    const byDate = new Map(daily.map((day) => [day.date, day]));
    for (const { enrollment } of rows) {
      for (const [key, value] of [
        ['started', enrollment.startedAt],
        ['completed', enrollment.completedAt],
      ] as const) {
        const day = value
          ? byDate.get(dateFormatter.format(new Date(value)))
          : undefined;
        if (day) day[key]++;
      }
    }
    return ok({
      dataAsOf,
      timeZone: 'Asia/Ho_Chi_Minh',
      counts: learningCounts(rows),
      daily,
    });
  }

  private exportReport(request: FakeRequest): FakeReply {
    const rows = sortRows(this.reportRows(request), request.query['sort']);
    if (rows.length > this.exportRowLimit) refuse('exportTooLarge');
    return { status: 200, body: envelopeOk(null), file: rowsCsv(rows) };
  }

  private exportProgress(request: FakeRequest): FakeReply {
    const rows = this.learnerCards(request, true);
    if (rows.length > this.exportRowLimit) refuse('exportTooLarge');
    const cell = (value: unknown): string => {
      let text = value === null || value === undefined ? '' : String(value);
      if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const lines = rows.map((card) =>
      [
        card.code,
        card.title,
        card.cycleNo,
        card.learningStatus ?? 'not_started',
        card.progressPercent,
        card.startedAt,
        card.lastAccessAt,
        card.completedAt,
        card.dueAt,
        card.deadlineStatus,
        card.bestScorePercent,
      ]
        .map(cell)
        .join(','),
    );
    const header =
      'Mã khóa,Tên khóa,Lần học,Trạng thái,Tiến độ,Bắt đầu,Truy cập gần nhất,Hoàn thành,Hạn,Trạng thái hạn,Điểm cao nhất';
    return {
      status: 200,
      body: envelopeOk(null),
      file: new Blob([`\uFEFF${header}\r\n${lines.join('\r\n')}\r\n`], {
        type: 'text/csv',
      }),
    };
  }

  private learnerCard(
    record: CourseRecord,
    enrolled: EnrollmentRecord | undefined,
  ): CourseCard {
    const published = record.published as CourseDetail;
    const lessons = published.chapters.flatMap((c) => c.lessons);
    const base = {
      ...this.card(record, published),
      assignedCount: null,
      requiredLessonCount: lessons.filter((l) => l.lesson.isRequired).length,
    };
    if (!enrolled) {
      return {
        ...base,
        learningStatus: null,
        progressPercent: null,
        assigned: false,
        overdue: false,
        failed: false,
        bestScorePercent: null,
        deadlineStatus: 'no_deadline',
      };
    }
    const { enrollment, dueAt } = enrolled;
    const completed = enrollment.status === 'completed';
    const overdue =
      dueAt !== null && !completed && Date.parse(dueAt) < Date.now();
    const resumeBlock = enrolled.blocks.find(
      (b) => b.blockId === enrollment.lastBlockId,
    );
    return {
      ...base,
      requirement: enrolled.assigned
        ? 'mandatory'
        : published.revision.defaultRequirement,
      enrollmentId: enrollment.id,
      certificateId: completed ? enrollment.id : null,
      learningStatus: enrollment.status,
      progressPercent: enrollment.progressPercent,
      dueAt,
      assigned: enrolled.assigned,
      overdue,
      failed: enrolled.failed,
      bestScorePercent: enrolled.bestScorePercent,
      cycleNo: enrollment.cycleNo,
      startedAt: enrollment.startedAt,
      lastAccessAt: enrollment.lastAccessAt,
      completedAt: enrollment.completedAt,
      lastLessonId: enrollment.lastLessonId,
      lastBlockId: enrollment.lastBlockId,
      completedRequiredLessonCount: enrolled.lessons.filter(
        (l) =>
          l.status === 'completed' &&
          lessons.find((x) => x.lesson.id === l.lessonId)?.lesson.isRequired,
      ).length,
      deadlineStatus:
        dueAt === null
          ? 'no_deadline'
          : completed
            ? 'completed_on_time'
            : overdue
              ? 'overdue_active'
              : 'on_time_active',
      mediaAssetId: resumeBlock?.mediaAssetId ?? null,
      lastPdfPage: resumeBlock?.lastPdfPage ?? null,
      lastVideoPositionSeconds: resumeBlock?.lastVideoPositionSeconds ?? null,
    };
  }

  /** Self-enrolment is idempotent; a course the caller is assigned to is not joined this way. */
  private enroll(request: FakeRequest): FakeReply {
    const record = this.record(request);
    const userId = this.directory.callerId(request);
    const published = record.published;
    if (!published || record.course.lifecycleStatus !== 'active') {
      return refuse('accessDenied');
    }
    if (published.revision.defaultRequirement !== 'optional') {
      return refuse('stateConflict');
    }
    const enrolled = this.enrollments.add({
      userId,
      detail: published,
      origin: 'self',
    });
    return ok(enrolled.enrollment);
  }

  /** Only the owner reads an enrolment; anyone else is refused, as the backend does with 403. */
  private enrollmentDetail(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const enrolled = this.enrollments.byId(
      num(request.params['enrollmentId']) ?? 0,
    );
    if (!enrolled) return refuse('resourceNotFound');
    if (enrolled.enrollment.userId !== userId) return refuse('accessDenied');
    return ok({
      enrollment: enrolled.enrollment,
      content: enrolled.content,
      lessons: enrolled.lessons,
      blocks: enrolled.blocks,
    });
  }

  // ---- assignments and groups ---------------------------------------------------------------

  private courseAssignments(request: FakeRequest): FakeReply {
    const courseId = this.record(request).course.id;
    const orgId = num(request.query['assigningOrgId']);
    const rows = this.assignments
      .filter(
        (a) =>
          a.assignment.courseId === courseId &&
          a.assignment.assigningOrgId === orgId,
      )
      .map((a) => a.assignment)
      .sort((a, b) => b.id - a.id);
    return ok(paged(rows, request.query));
  }

  private resolve(target: AssignCourseCommand['targets'][number]): string[] {
    const people = this.directory.people();
    switch (target.targetType) {
      case 'user':
        return people
          .filter((p) => p.userId === target.userId)
          .map((p) => p.userId);
      case 'team':
        return people
          .filter((p) => p.teamId === target.teamId)
          .map((p) => p.userId);
      case 'org':
        return people
          .filter((p) => p.orgId === target.orgId)
          .map((p) => p.userId);
      case 'learning_group':
        return (
          this.groups
            .find((g) => g.group.id === target.groupId)
            ?.members.filter((m) => !m.leftAt)
            .map((m) => m.userId) ?? []
        );
    }
  }

  private targetName(target: AssignCourseCommand['targets'][number]): string {
    switch (target.targetType) {
      case 'user':
        return this.directory.nameOf('user', target.userId ?? '') ?? '';
      case 'team':
        return this.directory.nameOf('team', target.teamId ?? 0) ?? '';
      case 'org':
        return this.directory.nameOf('org', target.orgId ?? 0) ?? '';
      case 'learning_group':
        return (
          this.groups.find((g) => g.group.id === target.groupId)?.group.name ??
          ''
        );
    }
  }

  private assignCourse(request: FakeRequest): FakeReply {
    const record = this.record(request);
    const command = request.body as AssignCourseCommand;
    const repeated = this.assignments.find(
      (a) => a.assignment.idempotencyKey === command.idempotencyKey,
    );
    if (repeated) return ok(repeated);
    if (record.published?.revision.id !== command.revisionId)
      refuse('stateConflict');
    if (command.targets.length === 0) refuse('validationFailed');
    if (
      command.dueAt &&
      Date.parse(command.dueAt) <= Date.parse(command.startAt)
    ) {
      refuse('validationFailed');
    }
    const assignmentId = this.id();
    const stamp = { rowVersion: 0, createTime: now(), updateTime: now() };
    const targets = command.targets.map((target) => ({
      id: this.id(),
      assignmentId,
      targetType: target.targetType,
      userId: target.userId ?? null,
      teamId: target.teamId ?? null,
      orgId: target.orgId ?? null,
      groupId: target.groupId ?? null,
      includeDescendants: target.includeDescendants ?? null,
      targetNameSnapshot: this.targetName(target),
      ...stamp,
    }));
    const byUser = new Map<string, number[]>();
    command.targets.forEach((target, index) => {
      for (const userId of this.resolve(target)) {
        byUser.set(userId, [...(byUser.get(userId) ?? []), targets[index].id]);
      }
    });
    const people = this.directory.people();
    const recipients: AssignmentRecipient[] = [...byUser.keys()].map(
      (userId) => ({
        id: this.id(),
        assignmentId,
        userId,
        enrollmentId: null,
        orgIdSnapshot: people.find((p) => p.userId === userId)?.orgId ?? null,
        teamIdSnapshot: people.find((p) => p.userId === userId)?.teamId ?? null,
        resolvedAt: now(),
        effectiveStartAt: command.startAt,
        effectiveDueAt: command.dueAt ?? null,
        requirement: command.requirement,
        status: 'active',
        revokedAt: null,
        revokeReason: null,
        ...stamp,
      }),
    );
    const detail: AssignmentDetail = {
      assignment: {
        id: assignmentId,
        courseId: record.course.id,
        revisionId: command.revisionId,
        assigningOrgId: command.assigningOrgId,
        assignedBy: this.directory.callerId(request),
        title: command.title ?? null,
        startAt: command.startAt,
        dueAt: command.dueAt ?? null,
        requirement: command.requirement,
        enrollmentMode: command.enrollmentMode,
        reminderEnabled: command.reminderEnabled ?? false,
        reminderDaysBefore: command.reminderDaysBefore ?? null,
        status:
          Date.parse(command.startAt) > Date.now() ? 'scheduled' : 'active',
        activatedAt: now(),
        idempotencyKey: command.idempotencyKey,
        ...stamp,
      },
      targets,
      recipients,
      sources: recipients.flatMap((recipient) =>
        (byUser.get(recipient.userId) ?? []).map((targetId) => ({
          id: this.id(),
          recipientId: recipient.id,
          targetId,
          ...stamp,
        })),
      ),
    };
    this.assignments.push(detail);
    return ok(detail);
  }

  private getAssignment(request: FakeRequest): FakeReply {
    const detail = this.assignments.find(
      (a) => a.assignment.id === num(request.params['assignmentId']),
    );
    return detail ? ok(detail) : refuse('resourceNotFound');
  }

  private revokeRecipient(request: FakeRequest): FakeReply {
    const recipientId = num(request.params['recipientId']);
    const detail = this.assignments.find((a) =>
      a.recipients.some((r) => r.id === recipientId),
    );
    if (!detail) return refuse('resourceNotFound');
    const { reason } = request.body as RevokeRecipientCommand;
    if (!reason.trim()) refuse('validationFailed');
    const index = detail.recipients.findIndex((r) => r.id === recipientId);
    const current = detail.recipients[index];
    if (current.status === 'revoked') refuse('stateConflict');
    const revoked = {
      ...current,
      status: 'revoked',
      revokedAt: now(),
      revokeReason: reason,
      rowVersion: current.rowVersion + 1,
    };
    detail.recipients = detail.recipients.map((r, i) =>
      i === index ? revoked : r,
    );
    return ok(revoked);
  }

  /** The org's assignments with the server's counts over active recipients. */
  private orgAssignments(request: FakeRequest): FakeReply {
    const orgId = num(request.query['assigningOrgId']);
    const courseId = num(request.query['courseId']);
    const [field, direction] = (request.query['sort'] ?? 'id,desc').split(',');
    const key = (a: AssignmentDetail): string | number =>
      field === 'id' ? a.assignment.id : (a.assignment[field as 'title'] ?? '');
    const rows = this.assignments
      .filter(
        (a) =>
          a.assignment.assigningOrgId === orgId &&
          (courseId === undefined || a.assignment.courseId === courseId),
      )
      .sort((a, b) => {
        const order = key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
        return direction === 'desc' ? -order : order;
      })
      .map((a) => this.summaryOf(a));
    return ok(paged(rows, request.query));
  }

  private summaryOf(detail: AssignmentDetail): AssignmentSummary {
    const course = this.courses.find(
      (c) => c.course.id === detail.assignment.courseId,
    );
    const active = detail.recipients.filter((r) => r.status === 'active');
    const finished = (r: AssignmentRecipient) =>
      this.enrollments.of(r.userId, detail.assignment.courseId)?.enrollment
        .status === 'completed';
    const completed = active.filter(finished).length;
    const overdue = active.filter(
      (r) =>
        !finished(r) &&
        !!r.effectiveDueAt &&
        Date.parse(r.effectiveDueAt) < Date.now(),
    ).length;
    return {
      assignment: detail.assignment,
      courseCode: course?.course.code ?? null,
      courseTitle: course?.published?.revision.title ?? null,
      targets: detail.targets,
      people: active.length,
      completed,
      progressPercent: active.length
        ? Math.floor((completed * 100) / active.length)
        : 0,
      overdue,
    };
  }

  private activeAssignment(request: FakeRequest): AssignmentDetail {
    const detail = this.assignments.find(
      (a) => a.assignment.id === num(request.params['assignmentId']),
    );
    if (!detail) return refuse('resourceNotFound');
    if (detail.assignment.status === 'revoked') return refuse('stateConflict');
    return detail;
  }

  private rescheduleAssignment(request: FakeRequest): FakeReply {
    const detail = this.activeAssignment(request);
    const command = request.body as RescheduleAssignmentCommand;
    if (command.expectedVersion !== detail.assignment.rowVersion)
      refuse('stateConflict');
    if (
      command.dueAt &&
      Date.parse(command.dueAt) < Date.parse(command.startAt)
    ) {
      refuse('validationFailed');
    }
    detail.assignment = {
      ...detail.assignment,
      startAt: command.startAt,
      dueAt: command.dueAt ?? null,
      reminderEnabled: command.reminderEnabled,
      reminderDaysBefore: command.reminderDaysBefore,
      rowVersion: detail.assignment.rowVersion + 1,
      updateTime: now(),
    };
    detail.recipients = detail.recipients.map((r) =>
      r.status === 'active'
        ? {
            ...r,
            effectiveStartAt: command.startAt,
            effectiveDueAt: command.dueAt ?? null,
            rowVersion: r.rowVersion + 1,
          }
        : r,
    );
    return ok(detail);
  }

  /** Learners reminded by hand today, per assignment: a repeat the same day reaches nobody new. */
  private remindedToday = new Map<number, Set<string>>();

  private remindAssignment(request: FakeRequest): FakeReply {
    const detail = this.activeAssignment(request);
    if (!detail.assignment.dueAt) refuse('validationFailed');
    const day = now().slice(0, 10);
    const key = detail.assignment.id;
    const reached = this.remindedToday.get(key) ?? new Set<string>();
    const due = detail.recipients.filter(
      (r) =>
        r.status === 'active' &&
        this.enrollments.of(r.userId, detail.assignment.courseId)?.enrollment
          .status !== 'completed' &&
        !reached.has(`${day}:${r.userId}`),
    );
    due.forEach((r) => reached.add(`${day}:${r.userId}`));
    this.remindedToday.set(key, reached);
    return ok({ reminded: due.length });
  }

  private revokeAssignment(request: FakeRequest): FakeReply {
    const detail = this.assignments.find(
      (a) => a.assignment.id === num(request.params['assignmentId']),
    );
    if (!detail) return refuse('resourceNotFound');
    if (detail.assignment.status === 'revoked') return ok(detail);
    const { reason } = request.body as RevokeRecipientCommand;
    if (!reason.trim()) refuse('validationFailed');
    detail.recipients = detail.recipients.map((r) =>
      r.status === 'active'
        ? {
            ...r,
            status: 'revoked',
            revokedAt: now(),
            revokeReason: reason,
            rowVersion: r.rowVersion + 1,
          }
        : r,
    );
    detail.assignment = {
      ...detail.assignment,
      status: 'revoked',
      rowVersion: detail.assignment.rowVersion + 1,
      updateTime: now(),
    };
    return ok(detail);
  }

  private listGroups(request: FakeRequest): FakeReply {
    const orgId = num(request.query['ownerOrgId']);
    return ok(
      paged(
        this.groups
          .filter((g) => g.group.ownerOrgId === orgId)
          .map((g) => g.group),
        request.query,
      ),
    );
  }

  private group(request: FakeRequest): GroupDetail {
    return (
      this.groups.find((g) => g.group.id === num(request.params['groupId'])) ??
      refuse('resourceNotFound')
    );
  }

  private createGroup(request: FakeRequest): FakeReply {
    const command = request.body as CreateGroupCommand;
    if (
      this.groups.some(
        (g) => g.group.code.toLowerCase() === command.code.toLowerCase(),
      )
    ) {
      refuse('stateConflict');
    }
    const detail: GroupDetail = {
      group: {
        id: this.id(),
        ownerOrgId: command.ownerOrgId,
        code: command.code,
        name: command.name,
        description: command.description ?? null,
        status: 'active',
        rowVersion: 0,
        createTime: now(),
        updateTime: now(),
      },
      members: [],
    };
    this.groups.push(detail);
    return ok(detail);
  }

  private getGroup(request: FakeRequest): FakeReply {
    return ok(this.group(request));
  }

  private replaceMembers(request: FakeRequest): FakeReply {
    const detail = this.group(request);
    const command = request.body as ReplaceMembersCommand;
    if (command.expectedVersion !== detail.group.rowVersion)
      refuse('stateConflict');
    const known = new Set(this.directory.people().map((p) => p.userId));
    if (command.userIds.some((id) => !known.has(id)))
      refuse('validationFailed');
    const addedBy = this.directory.callerId(request);
    detail.members = [...new Set(command.userIds)].map((userId) => {
      const kept = detail.members.find((m) => m.userId === userId);
      return (
        kept ?? {
          id: this.id(),
          groupId: detail.group.id,
          userId,
          joinedAt: now(),
          leftAt: null,
          addedBy,
          rowVersion: 0,
          createTime: now(),
          updateTime: now(),
        }
      );
    });
    detail.group = {
      ...detail.group,
      rowVersion: detail.group.rowVersion + 1,
      updateTime: now(),
    };
    return ok(detail);
  }
}
