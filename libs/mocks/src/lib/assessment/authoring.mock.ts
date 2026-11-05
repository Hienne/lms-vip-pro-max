import {
  assessmentV1Endpoints as api,
  programAssessmentEndpoints as programApi,
  ProgramQuestionRequestSchema,
  assessmentReportEndpoints as reports,
  QuestionRequestV1Schema,
  QuizRequestV1Schema,
  QuizPoolRequestV1Schema,
  type AnyEndpoint,
  type Me,
  type QuestionDetailV1,
  type QuizDetailV1,
  XLSX_MIME_TYPE,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeError, envelopeOk } from '../envelope';
import { assessmentQuestionFixtures } from './assessment.mock';
import {
  trainingProgramFixtures,
  courseDetailFixtures,
} from '../learning/learning.fixtures';
import { SEED_ORGS } from '../backend/seed';

const now = () => new Date().toISOString();
const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});
const fail = (code: string, message: string, status = 200): FakeReply => ({
  status,
  body: envelopeError(code, 'Không thể thực hiện', message),
});
const page = <T>(items: readonly T[], q: FakeRequest['query']) => {
  const size = Math.min(100, Math.max(1, Number(q['size']) || 20)),
    page = Math.max(0, Number(q['page']) || 0);
  const [key, dir] = q['sort']?.split(',') ?? [];
  const sorted = key
    ? [...items].sort(
        (a, b) =>
          String(Reflect.get(Object(a), key) ?? '').localeCompare(
            String(Reflect.get(Object(b), key) ?? ''),
            'vi',
            { numeric: true },
          ) * (dir === 'desc' ? -1 : 1),
      )
    : [...items];
  return {
    items: sorted.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
  };
};
const inOrg = (
  ancestor: number | null | undefined,
  id: number | null | undefined,
): boolean => {
  if (id == null || ancestor == null) return false;
  let node = SEED_ORGS.find((o) => o.id === id);
  const seen = new Set<number>();
  while (node && !seen.has(node.id)) {
    if (node.id === ancestor) return true;
    seen.add(node.id);
    node = SEED_ORGS.find((o) => o.id === node?.parentId);
  }
  return false;
};

/** Development fixtures for the verified Java wire shapes; never a replacement for Java security or grading. */
export class AssessmentAuthoringMock {
  constructor(private readonly caller: (request: FakeRequest) => Me) {}
  private nextId = 1000;

  /** The status of a quiz, for the learning service's publish check; `undefined` when it is gone. */
  quizStatus(quizId: number): string | undefined {
    return this.quizzes.find((q) => q.quiz.id === quizId)?.quiz.status;
  }
  private questions: (QuestionDetailV1 & { programId: number })[] = [
    1, 2, 5,
  ].flatMap((courseId) =>
    assessmentQuestionFixtures.map((q, i) => ({
      id: (courseId - 1) * 2 + i + 1,
      code: courseId === 1 ? q.code : `${q.code}-${courseId}`,
      programId:
        courseDetailFixtures.find((c) => c.course.id === courseId)?.revision
          .programId ?? 0,
      courseId,
      lessonId: null,
      competencyId: 1,
      questionType:
        q.type === 'single' ? ('SINGLE' as const) : ('MULTIPLE' as const),
      content: q.text,
      explanation: q.explanation,
      difficulty:
        q.difficulty === 'easy' ? ('EASY' as const) : ('MEDIUM' as const),
      points: 1,
      status: 'ACTIVE' as const,
      contentVersion: 1,
      options: q.options.map((o, j) => ({
        id: courseId * 100 + i * 10 + j + 1,
        content: o.text,
        correct: q.correctOptionIds.includes(o.id),
        sortNo: j,
      })),
      usedInQuizzes: [],
      rowVersion: 0,
      createTime: now(),
      updateTime: now(),
    })),
  );
  private quizzes: QuizDetailV1[] = [1, 2, 3].map((id) => {
    const courseId = id === 3 ? 2 : 1;
    return {
      quiz: {
        id,
        courseId,
        title:
          id === 1
            ? 'Luyện tập: Tổng quan hệ thống Core Banking'
            : id === 2
              ? 'Thi cuối khóa: Tổng quan hệ thống Core Banking'
              : 'Thi cuối khóa: Quy trình quản lý thay đổi',
        description: '',
        quizType: id === 1 ? 'PRACTICE' : 'FINAL_EXAM',
        status: 'PUBLISHED',
        selectionMode: 'FIXED',
        questionCount: 2,
        shuffleQuestions: true,
        shuffleOptions: true,
        timeLimitMinutes: 15,
        openAt: null,
        closeAt: null,
        graceSeconds: 0,
        passPercent: 80,
        scoringMode: 'ALL_OR_NOTHING',
        scoreMethod: 'BEST',
        reviewPolicy: 'AFTER_SUBMIT',
        maxAttempts: 3,
        retakeWaitHours: 0,
        allowRetakeAfterPass: false,
        requireLessonsCompleted: false,
        publishedAt: now(),
        rowVersion: 0,
        createTime: now(),
        updateTime: now(),
      },
      pool: this.questions
        .filter((q) => q.courseId === courseId)
        .map((q, sortNo) => ({
          questionId: q.id,
          code: q.code,
          contentPreview: q.content,
          questionType: q.questionType,
          difficulty: q.difficulty,
          status: q.status,
          sortNo,
          pointsOverride: null,
          effectivePoints: q.points,
        })),
      activePoolSize: 2,
    };
  });
  /**
   * The mock reads no Excel: every accepted file holds the same three questions. A file named
   * `loi`, a wrong type, a file over 5 MiB, or a second import (the codes exist) is the backend's
   * `ASSESSMENT-IMPORT_INVALID`, and nothing is written. `overwrite` replaces them instead.
   */
  private importQuestions(r: FakeRequest, me: Me): FakeReply {
    const courseId = Number(r.query['courseId']);
    if (!this.canManage(me, courseId))
      return fail('CORE-ACCESS_DENIED', 'Không đủ quyền.', 403);
    const body = r.body;
    const file =
      body instanceof FormData
        ? body.get('file')
        : (body as { file?: unknown } | null)?.file;
    if (!(file instanceof Blob) || !(file as File).name)
      return fail('CORE-VALIDATION_FAILED', 'Cần chọn một tệp.');
    const name = (file as File).name.toLowerCase();
    if (
      !name.endsWith('.xlsx') ||
      name.includes('loi') ||
      file.size > 5 * 1024 * 1024
    )
      return fail(
        'ASSESSMENT-IMPORT_INVALID',
        'Tệp nhập chưa hợp lệ. Vui lòng kiểm tra các lỗi chi tiết.',
      );
    const dryRun = r.query['dryRun'] !== 'false';
    const overwrite = r.query['overwrite'] === 'true';
    const codes = ['NHAP-01', 'NHAP-02', 'NHAP-03'];
    const existing = codes.filter((code) =>
      this.questions.some((q) => q.courseId === courseId && q.code === code),
    );
    if (existing.length && !overwrite)
      return fail(
        'ASSESSMENT-IMPORT_INVALID',
        'Tệp nhập chưa hợp lệ. Vui lòng kiểm tra các lỗi chi tiết.',
      );
    const result = {
      dryRun,
      rowCount: codes.length,
      toCreate: codes.length - existing.length,
      toUpdate: existing.length,
      created: 0,
      updated: 0,
    };
    if (dryRun) return ok(result);
    const programId =
      courseDetailFixtures.find((c) => c.course.id === courseId)?.revision
        .programId ?? 0;
    this.questions = [
      ...this.questions.filter(
        (q) => !(q.courseId === courseId && codes.includes(q.code)),
      ),
      ...codes.map((code, i) => ({
        id: this.nextId++,
        code,
        programId,
        courseId,
        lessonId: null,
        competencyId: 1,
        questionType: 'SINGLE' as const,
        content: `Câu hỏi nhập từ tệp ${i + 1}`,
        explanation: '',
        difficulty: 'MEDIUM' as const,
        points: 1,
        status: 'ACTIVE' as const,
        contentVersion: 1,
        options: ['A', 'B'].map((content, sortNo) => ({
          id: this.nextId++,
          content,
          correct: sortNo === 0,
          sortNo,
        })),
        usedInQuizzes: [],
        rowVersion: 0,
        createTime: now(),
        updateTime: now(),
      })),
    ];
    this.refreshPools();
    return ok({
      ...result,
      dryRun: false,
      created: result.toCreate,
      updated: result.toUpdate,
    });
  }
  answers(endpoint: AnyEndpoint): boolean {
    return [
      ...Object.values(api),
      ...Object.values(programApi),
      ...Object.values(reports),
    ].some((e) => e === endpoint);
  }
  private canManageProgram(me: Me, programId: number): boolean {
    const program = trainingProgramFixtures.find((p) => p.id === programId);
    if (!program) return false;
    return me.roleGrants.some(
      (g) =>
        (g.roleCode === 'SUPER_ADMIN' && g.scope.type === 'GLOBAL') ||
        (['ADMIN', 'INSTRUCTOR'].includes(g.roleCode) &&
          (g.scope.type === 'GLOBAL' ||
            (g.scope.type === 'ORG' &&
              inOrg(g.scope.orgId, program.ownerOrgId)))),
    );
  }
  private canManage(me: Me, courseId: number | null): boolean {
    const course = courseDetailFixtures.find(
      (c) => c.course.id === courseId,
    )?.course;
    if (!course) return false;
    return me.roleGrants.some((g) => {
      if (g.roleCode === 'SUPER_ADMIN' && g.scope.type === 'GLOBAL')
        return true;
      if (!['ADMIN', 'INSTRUCTOR'].includes(g.roleCode)) return false;
      switch (g.scope.type) {
        case 'GLOBAL':
          return true;
        case 'ORG':
          return inOrg(g.scope.orgId, course.ownerOrgId);
        case 'TEAM':
          return (
            course.ownerTeamId != null && course.ownerTeamId === g.scope.teamId
          );
        case 'OWN':
          return (
            course.ownerUserId === me.user.userId &&
            course.ownerOrgId === me.user.orgId
          );
      }
    });
  }
  private refreshPools(): void {
    for (const detail of this.quizzes) {
      detail.pool = detail.pool.map((entry) => {
        const question = this.questions.find((q) => q.id === entry.questionId);
        return question
          ? {
              ...entry,
              code: question.code,
              contentPreview: question.content,
              questionType: question.questionType,
              difficulty: question.difficulty,
              status: question.status,
              effectivePoints: entry.pointsOverride ?? question.points,
            }
          : entry;
      });
      detail.activePoolSize = detail.pool.filter(
        (entry) => entry.status === 'ACTIVE',
      ).length;
    }
  }
  private shortageAfterDeactivation(ids: readonly number[]): boolean {
    return this.quizzes.some(
      (detail) =>
        detail.quiz.status === 'PUBLISHED' &&
        detail.pool.some((p) => ids.includes(p.questionId)) &&
        detail.pool.filter(
          (p) =>
            !ids.includes(p.questionId) &&
            this.questions.some(
              (q) => q.id === p.questionId && q.status === 'ACTIVE',
            ),
        ).length < detail.quiz.questionCount,
    );
  }
  handle(endpoint: AnyEndpoint, r: FakeRequest): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    const programMode = Object.entries(programApi).some(
      ([key, value]) => value === endpoint && value !== Reflect.get(api, key),
    );
    if (programMode) {
      const original = endpoint;
      const key = Object.keys(api).find(
        (key) => Reflect.get(programApi, key) === original,
      );
      if (key) endpoint = Reflect.get(api, key);
    }
    const me = this.caller(r);
    if (me.user.mustChangePassword)
      return fail(
        'IDENTITY-PASSWORD_CHANGE_REQUIRED',
        'Cần đổi mật khẩu.',
        403,
      );
    if (Object.values(reports).some((e) => e === endpoint))
      return this.report(endpoint, r, me);
    if (endpoint === api.competencies)
      return ok([
        {
          id: 1,
          code: 'CIF',
          name: 'Quản lý CIF',
          description: null,
          parentId: null,
          sortNo: 0,
          status: 'ACTIVE',
          rowVersion: 0,
          createTime: now(),
          updateTime: now(),
        },
      ]);
    if (endpoint === api.questionImportTemplate)
      return {
        ...ok(null),
        file: new Blob(['Mẫu nhập câu hỏi (bản giả lập).'], {
          type: XLSX_MIME_TYPE,
        }),
      };
    if (endpoint === api.importQuestions) return this.importQuestions(r, me);
    const id = Number(r.params['id']);
    const question = this.questions.find((q) => q.id === id),
      detail = this.quizzes.find((q) => q.quiz.id === id);
    const raw = r.body && typeof r.body === 'object' ? r.body : {};
    const courseId =
      question && [api.question, api.updateQuestion].some((e) => e === endpoint)
        ? question.courseId
        : detail &&
            ![
              api.questions,
              api.courseQuizList,
              api.createQuestion,
              api.createQuiz,
            ].some((e) => e === endpoint)
          ? detail.quiz.courseId
          : Number(r.query['courseId'] ?? Reflect.get(raw, 'courseId'));
    if (
      endpoint === api.bulkQuestionStatus ||
      endpoint === api.bulkDeleteQuestions
    ) {
      const schema =
        endpoint === api.bulkQuestionStatus
          ? api.bulkQuestionStatus.body
          : api.bulkDeleteQuestions.body;
      const parsed = schema.safeParse(raw);
      if (!parsed.success)
        return fail(
          'CORE-VALIDATION_FAILED',
          'Danh sách câu hỏi không hợp lệ.',
        );
      const ids = parsed.data.ids,
        rows = this.questions.filter((q) => ids.includes(q.id));
      if (rows.length !== new Set(ids).size)
        return fail('ASSESSMENT-NOT_FOUND', 'Không tìm thấy câu hỏi.');
      if (
        rows.some((q) =>
          programMode
            ? !this.canManageProgram(me, q.programId)
            : !this.canManage(me, q.courseId),
        )
      )
        return fail('CORE-ACCESS_DENIED', 'Không đủ quyền.', 403);
      if (endpoint === api.bulkDeleteQuestions) {
        if (
          this.quizzes.some((q) =>
            q.pool.some((p) => ids.includes(p.questionId)),
          )
        )
          return fail('ASSESSMENT-QUESTION_IN_USE', 'Câu đang được dùng.');
        this.questions = this.questions.filter((q) => !ids.includes(q.id));
      } else {
        const status = Reflect.get(raw, 'status');
        if (status !== 'ACTIVE' && status !== 'INACTIVE')
          return fail('CORE-VALIDATION_FAILED', 'Trạng thái không hợp lệ.');
        if (status === 'INACTIVE' && this.shortageAfterDeactivation(ids))
          return fail(
            'ASSESSMENT-QUIZ_NOT_READY',
            'Ngưng sử dụng làm bài kiểm tra đã xuất bản thiếu câu hỏi.',
          );
        for (const q of rows) {
          q.status = status;
          q.rowVersion++;
        }
        for (const quiz of this.quizzes)
          quiz.pool = quiz.pool.map((p) => ({
            ...p,
            status:
              this.questions.find((q) => q.id === p.questionId)?.status ??
              p.status,
          }));
      }
      this.refreshPools();
      return ok({ affected: rows.length });
    }
    const programId =
      question && [api.question, api.updateQuestion].some((e) => e === endpoint)
        ? question.programId
        : Number(r.query['programId'] ?? Reflect.get(raw, 'programId'));
    const questionOperation = [
      api.questions,
      api.question,
      api.createQuestion,
      api.updateQuestion,
    ].some((e) => e === endpoint);
    if (
      programMode && questionOperation
        ? !(endpoint === api.questions && r.query['courseId']
            ? this.canManage(me, courseId) &&
              courseDetailFixtures.find((c) => c.course.id === courseId)
                ?.revision.programId === programId
            : this.canManageProgram(me, programId))
        : !this.canManage(me, courseId)
    )
      return fail(
        'CORE-ACCESS_DENIED',
        'Không đủ quyền quản lý khóa học.',
        403,
      );
    if (endpoint === api.questions) {
      const q = r.query;
      const rows = this.questions.filter(
        (x) =>
          (programMode ? x.programId === programId : x.courseId === courseId) &&
          (!q['q'] ||
            (x.code + ' ' + x.content)
              .toLowerCase()
              .includes(q['q'].toLowerCase())) &&
          [
            'questionType',
            'difficulty',
            'status',
            'competencyId',
            'lessonId',
          ].every((key) => !q[key] || String(Reflect.get(x, key)) === q[key]),
      );
      return ok(
        page(
          rows.map((x) => ({
            id: x.id,
            code: x.code,
            programId: x.programId,
            courseId: x.courseId,
            lessonId: x.lessonId,
            competencyId: x.competencyId,
            competencyName: 'Quản lý CIF',
            questionType: x.questionType,
            contentPreview: x.content.slice(0, 200),
            difficulty: x.difficulty,
            points: x.points,
            status: x.status,
            contentVersion: x.contentVersion,
            optionCount: x.options.length,
            correctCount: x.options.filter((o) => o.correct).length,
            usedInQuizCount: this.quizzes.filter((q) =>
              q.pool.some((p) => p.questionId === x.id),
            ).length,
            rowVersion: x.rowVersion,
            updateTime: x.updateTime,
          })),
          q,
        ),
      );
    }
    if (endpoint === api.question)
      return question
        ? ok({
            ...question,
            usedInQuizzes: this.quizzes
              .filter((q) => q.pool.some((p) => p.questionId === id))
              .map((q) => ({
                id: q.quiz.id,
                title: q.quiz.title,
                status: q.quiz.status,
              })),
          })
        : fail('ASSESSMENT-NOT_FOUND', 'Không tìm thấy.');
    if (endpoint === api.createQuestion || endpoint === api.updateQuestion) {
      const parsed = programMode
        ? ProgramQuestionRequestSchema.safeParse(raw)
        : QuestionRequestV1Schema.safeParse(raw);
      if (!parsed.success)
        return fail('CORE-VALIDATION_FAILED', 'Kiểm tra dữ liệu câu hỏi.');
      if (
        endpoint === api.updateQuestion &&
        (!question ||
          question.rowVersion !== Number(r.query['expectedVersion']))
      )
        return fail(
          'ASSESSMENT-CONFLICT',
          'Dữ liệu đã thay đổi. Tải lại trước khi sửa.',
        );
      const command = {
          ...parsed.data,
          courseId:
            'courseId' in parsed.data
              ? parsed.data.courseId
              : (question?.courseId ?? null),
          lessonId: 'lessonId' in parsed.data ? parsed.data.lessonId : null,
        },
        count = command.options.filter((o) => o.correct).length;
      if (command.questionType === 'SINGLE' ? count !== 1 : count < 2)
        return fail('CORE-VALIDATION_FAILED', 'Đáp án đúng không hợp lệ.');
      if (
        programMode &&
        question &&
        question.programId !== Number(Reflect.get(raw, 'programId'))
      )
        return fail(
          'CORE-VALIDATION_FAILED',
          'Không thể chuyển câu hỏi sang chương trình khác.',
        );
      if (
        question &&
        command.status === 'INACTIVE' &&
        this.shortageAfterDeactivation([question.id])
      )
        return fail(
          'ASSESSMENT-QUIZ_NOT_READY',
          'Ngưng sử dụng làm bài kiểm tra đã xuất bản thiếu câu hỏi.',
        );
      const item: QuestionDetailV1 & { programId: number } = {
        programId: programMode
          ? programId
          : (courseDetailFixtures.find((c) => c.course.id === command.courseId)
              ?.revision.programId ?? 0),
        ...command,
        id: question?.id ?? this.nextId++,
        code: command.code || `Q${this.nextId}`,
        options: command.options.map((o, sortNo) => ({
          ...o,
          id: o.id ?? this.nextId++,
          sortNo,
        })),
        contentVersion: (question?.contentVersion ?? 0) + 1,
        usedInQuizzes: [],
        rowVersion: (question?.rowVersion ?? -1) + 1,
        createTime: question?.createTime ?? now(),
        updateTime: now(),
      };
      this.questions = [
        ...this.questions.filter((q) => q.id !== item.id),
        item,
      ];
      this.refreshPools();
      return ok(item);
    }
    if (endpoint === api.courseQuizList)
      return ok(
        page(
          this.quizzes
            .filter(
              (q) =>
                q.quiz.courseId === courseId &&
                (!r.query['status'] || q.quiz.status === r.query['status']),
            )
            .map((q) => ({
              ...q.quiz,
              gradedAttempts: 0,
              passedAttempts: 0,
              poolSize: q.pool.length,
            })),
          r.query,
        ),
      );
    if (endpoint === api.quiz)
      return detail
        ? ok(detail)
        : fail('ASSESSMENT-NOT_FOUND', 'Không tìm thấy đề.');
    if (endpoint === api.createQuiz || endpoint === api.updateQuiz) {
      const parsed = QuizRequestV1Schema.safeParse(raw);
      if (!parsed.success)
        return fail('CORE-VALIDATION_FAILED', 'Cấu hình không hợp lệ.');
      if (
        endpoint === api.updateQuiz &&
        (!detail ||
          detail.quiz.rowVersion !== Number(r.query['expectedVersion']))
      )
        return fail('ASSESSMENT-CONFLICT', 'Dữ liệu đã thay đổi.');
      if (
        parsed.data.quizType === 'FINAL_EXAM' &&
        this.quizzes.some(
          (q) =>
            q.quiz.courseId === parsed.data.courseId &&
            q.quiz.quizType === 'FINAL_EXAM' &&
            q.quiz.id !== detail?.quiz.id,
        )
      )
        return fail(
          'ASSESSMENT-DUPLICATE',
          'Khóa học đã có bài thi cuối khóa.',
        );
      const item: QuizDetailV1 = {
        quiz: {
          ...parsed.data,
          id: detail?.quiz.id ?? this.nextId++,
          status: detail?.quiz.status ?? 'DRAFT',
          rowVersion: (detail?.quiz.rowVersion ?? -1) + 1,
          publishedAt: detail?.quiz.publishedAt ?? null,
          createTime: detail?.quiz.createTime ?? now(),
          updateTime: now(),
        },
        pool: detail?.pool ?? [],
        activePoolSize: detail?.activePoolSize ?? 0,
      };
      this.quizzes = [
        ...this.quizzes.filter((q) => q.quiz.id !== item.quiz.id),
        item,
      ];
      return ok(item);
    }
    if (!detail) return fail('ASSESSMENT-NOT_FOUND', 'Không tìm thấy đề.');
    if (endpoint === api.replacePool) {
      const parsed = QuizPoolRequestV1Schema.safeParse(raw);
      if (!parsed.success)
        return fail('CORE-VALIDATION_FAILED', 'Bộ câu hỏi không hợp lệ.');
      if (detail.quiz.rowVersion !== Number(r.query['expectedVersion']))
        return fail('ASSESSMENT-CONFLICT', 'Dữ liệu đã thay đổi.');
      if (
        parsed.data.items.some(
          (p) =>
            !this.questions.some(
              (q) =>
                q.id === p.questionId &&
                q.programId ===
                  courseDetailFixtures.find((c) => c.course.id === courseId)
                    ?.revision.programId,
            ),
        )
      )
        return fail(
          'CORE-VALIDATION_FAILED',
          'Câu hỏi không thuộc chương trình của khóa học.',
        );
      detail.pool = parsed.data.items.map((p) => {
        const q = this.questions.find((q) => q.id === p.questionId);
        if (!q) throw new Error('Validated question missing');
        return {
          questionId: q.id,
          code: q.code,
          contentPreview: q.content,
          questionType: q.questionType,
          difficulty: q.difficulty,
          status: q.status,
          sortNo: p.sortNo,
          pointsOverride: p.points,
          effectivePoints: p.points ?? q.points,
        };
      });
      detail.activePoolSize = detail.pool.filter(
        (p) => p.status === 'ACTIVE',
      ).length;
      detail.quiz.rowVersion++;
      return ok(structuredClone(detail));
    }
    if (detail.quiz.rowVersion !== Reflect.get(raw, 'expectedVersion'))
      return fail('ASSESSMENT-CONFLICT', 'Dữ liệu đã thay đổi.');
    if (endpoint === api.publishQuiz) {
      if (detail.activePoolSize < detail.quiz.questionCount)
        return fail('ASSESSMENT-QUIZ_NOT_READY', 'Chưa đủ câu đang dùng.');
      detail.quiz.status = 'PUBLISHED';
    }
    if (endpoint === api.closeQuiz) detail.quiz.status = 'CLOSED';
    detail.quiz.rowVersion++;
    return ok(structuredClone(detail));
  }
  private report(endpoint: AnyEndpoint, r: FakeRequest, me: Me): FakeReply {
    const grants = me.roleGrants.filter(
      (g) =>
        ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'REPORT_VIEWER'].includes(
          g.roleCode,
        ) && g.scope.type !== 'OWN',
    );
    if (!grants.length)
      return fail('CORE-ACCESS_DENIED', 'Không đủ quyền báo cáo.', 403);
    // Fixed synthetic rows, scoped to org 1 / team 1. No browser-side scoring or aggregation.
    const submittedAt = '2026-11-01T02:00:00Z';
    const q = r.query,
      visible =
        grants.some(
          (g) =>
            g.scope.type === 'GLOBAL' ||
            (g.scope.type === 'ORG' && inOrg(g.scope.orgId, 1)) ||
            (g.scope.type === 'TEAM' && g.scope.teamId === 1),
        ) &&
        (!q['orgId'] || inOrg(Number(q['orgId']), 1)) &&
        (!q['teamId'] || q['teamId'] === '1') &&
        (!q['quizId'] || q['quizId'] === '1') &&
        (!q['courseId'] || q['courseId'] === '1') &&
        (!q['from'] || Date.parse(submittedAt) >= Date.parse(q['from'])) &&
        (!q['to'] || Date.parse(submittedAt) < Date.parse(q['to']));
    if (endpoint === reports.overview)
      return ok({
        gradedAttempts: visible ? 1 : 0,
        learners: visible ? 1 : 0,
        passedLearners: 0,
        passRate: visible ? 0 : null,
        averageScore: visible ? 50 : null,
        inProgressAttempts: 0,
        byQuiz: visible
          ? [
              {
                id: 1,
                name: 'Luyện tập Core Banking',
                gradedAttempts: 1,
                learners: 1,
                passedLearners: 0,
                passRate: 0,
                averageScore: 50,
              },
            ]
          : [],
        byOrg: visible
          ? [
              {
                id: 1,
                name: 'Ban QL&PT Core Banking',
                gradedAttempts: 1,
                learners: 1,
                passedLearners: 0,
                passRate: 0,
                averageScore: 50,
              },
            ]
          : [],
      });
    const type =
      endpoint === reports.export
        ? r.params['type']
        : endpoint === reports.results
          ? 'results'
          : endpoint === reports.learners
            ? 'learners'
            : endpoint === reports.competency
              ? 'competency'
              : 'questions';
    if (type === 'learners' && !q['quizId'])
      return fail('CORE-VALIDATION_FAILED', 'Chọn bài kiểm tra.');
    const match =
      visible &&
      (!q['quizId'] || q['quizId'] === '1') &&
      (!q['courseId'] || q['courseId'] === '1') &&
      (!q['userId'] || q['userId'] === '000004') &&
      (!q['status'] || q['status'] === 'SUBMITTED') &&
      (!q['passed'] || q['passed'] === 'false') &&
      (!q['learnerStatus'] || q['learnerStatus'] === 'FAILED') &&
      (type === 'learners' ||
        ((!q['from'] || Date.parse(q['from']) <= Date.parse(submittedAt)) &&
          (!q['to'] || Date.parse(q['to']) > Date.parse(submittedAt))));
    const common = {
      userId: '000004',
      userName: 'Học viên Demo',
      orgId: 1,
      orgName: 'Ban QL&PT Core Banking',
      teamId: 1,
      teamName: 'Nhóm nghiệp vụ',
    };
    const rows: object[] = !match
      ? []
      : type === 'results'
        ? [
            {
              ...common,
              attemptId: 1,
              quizId: 1,
              quizTitle: 'Luyện tập Core Banking',
              courseId: 1,
              attemptNo: 1,
              status: 'SUBMITTED',
              submitType: 'MANUAL',
              startedAt: '2026-11-01T01:50:00Z',
              submittedAt,
              correctCount: 1,
              totalQuestions: 2,
              scorePercent: 50,
              passed: false,
            },
          ]
        : type === 'learners'
          ? [
              {
                ...common,
                enrollmentId: 1,
                learnerStatus: 'FAILED',
                attemptsUsed: 1,
                attemptsLeft: 2,
                bestScore: 50,
                lastScore: 50,
                finalScore: 50,
                passed: false,
                lastSubmittedAt: submittedAt,
              },
            ]
          : type === 'competency'
            ? [
                {
                  groupKey: q['groupBy'] === 'org' ? '1' : '000004',
                  groupName:
                    q['groupBy'] === 'org'
                      ? 'Ban QL&PT Core Banking'
                      : 'Học viên Demo',
                  competencyId: 1,
                  code: 'CIF',
                  name: 'Quản lý CIF',
                  totalQuestions: 2,
                  correctCount: 1,
                  maxScore: 2,
                  score: 1,
                  percent: 50,
                },
              ]
            : [
                {
                  questionId: 1,
                  questionVersion: 1,
                  code: 'CH-CIF-01',
                  contentPreview: 'Khi khách hàng đổi CCCD, cần làm gì?',
                  timesServed: 1,
                  timesCorrect: 0,
                  timesBlank: 0,
                  wrongPercent: 100,
                },
              ];
    if (endpoint !== reports.export) return ok(page(rows, q));
    const keys = Object.keys(rows[0] ?? {}),
      cell = (v: unknown) =>
        `"${String(v ?? '')
          .replace(/^([=+@-])/, "'$1")
          .replaceAll('"', '""')}"`;
    const csv = [
      keys.join(','),
      ...rows.map((value) =>
        keys.map((key) => cell(Reflect.get(value, key))).join(','),
      ),
    ].join('\r\n');
    return {
      ...ok(null),
      file: new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
    };
  }
}
