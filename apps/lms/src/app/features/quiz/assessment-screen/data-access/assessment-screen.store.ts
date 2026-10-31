import { Dialog } from '@angular/cdk/dialog';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, forkJoin, of } from 'rxjs';
import {
  assessmentEndpoints,
  type Question,
  type SaveQuestion,
  type SaveQuizConfig,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { invalidation } from '../../../../core/data-access/invalidation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { confirm, type DataTableSort } from '@lms/ui';

@Injectable()
export class AssessmentScreenStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly id = toSignal(this.route.paramMap);
  private readonly navigated = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );
  private readonly state = {
    screen: signal(''),
    questionDraft: signal<Question | undefined>(undefined),
    editorOpen: signal(false),
    questionFilters: signal({
      q: '',
      type: '',
      difficulty: '',
      competency: '',
      lessonId: '',
      status: '',
    }),
    questionPage: signal(1),
    questionSort: signal<DataTableSort>({ key: 'code', dir: 'asc' }),
    selectedIds: signal<string[]>([]),
  };
  readonly routeId$ = computed(() => this.id()?.get('id') ?? 'q1');
  readonly routeScreen$ = computed(() => {
    this.navigated();
    const path = this.router.url.split(/[?#]/)[0];
    if (path === '/admin/questions') return 'questions';
    if (path === '/admin/quizzes') return 'quizzes';
    if (path.startsWith('/admin/quizzes/')) return 'config';
    return '';
  });
  private readonly questionsData = serverData(
    (query: { page: number; size: number; sort: string }) =>
      this.client.call(assessmentEndpoints.questions, { query }),
    {
      params: () =>
        ['questions', 'config'].includes(this.routeScreen$())
          ? { page: 0, size: 100, sort: 'updatedAt,desc' }
          : undefined,
    },
  );
  private readonly quizListData = serverData(
    (query: { page: number; size: number; sort: string }) =>
      this.client.call(assessmentEndpoints.quizzes, { query }),
    {
      params: () =>
        this.routeScreen$() === 'quizzes'
          ? { page: 0, size: 50, sort: 'title,asc' }
          : undefined,
    },
  );
  private readonly optionsData = serverData(() =>
    this.client.call(assessmentEndpoints.assessmentOptions, { query: {} }),
  );
  private readonly configData = serverData(
    (quizId: string) =>
      this.client.call(assessmentEndpoints.quiz, { params: { quizId } }),
    {
      params: () =>
        this.routeScreen$() === 'config' && this.routeId$() !== 'new'
          ? this.routeId$()
          : undefined,
    },
  );
  private readonly refresh = invalidation();
  readonly questions$ = computed(() => this.questionsData.value());
  readonly quizList$ = computed(() => this.quizListData.value()?.items ?? []);
  readonly options$ = this.optionsData.value;
  readonly config$ = this.configData.value;
  readonly isLoading$ = computed(() => {
    switch (this.routeScreen$()) {
      case 'questions':
        return this.questionsData.isLoading();
      case 'quizzes':
        return this.quizListData.isLoading();
      case 'config':
        return this.configData.isLoading();
      default:
        return false;
    }
  });
  readonly error$ = computed(() => {
    switch (this.routeScreen$()) {
      case 'questions':
        return this.questionsData.error();
      case 'quizzes':
        return this.quizListData.error();
      case 'config':
        return this.configData.error();
      default:
        return undefined;
    }
  });
  private readonly questionSave = serverMutation(
    (input: { id?: string; command: SaveQuestion }) =>
      input.id
        ? this.client.call(assessmentEndpoints.saveQuestion, {
            params: { questionId: input.id },
            body: input.command,
          })
        : this.client.call(assessmentEndpoints.createQuestion, {
            body: input.command,
          }),
    {
      errors: 'alert',
      success: (input) =>
        input.id ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi',
      invalidates: this.refresh,
      onSuccess: () => {
        this.setEditorOpen(false);
        this.questionsData.reload();
      },
    },
  );
  private readonly questionStatus = serverMutation(
    (input: { id: string; status: 'active' | 'inactive' }) =>
      this.client.call(assessmentEndpoints.questionStatus, {
        params: { questionId: input.id },
        body: { status: input.status },
      }),
    {
      errors: 'toast',
      success: () => 'Đã cập nhật trạng thái câu hỏi',
      invalidates: this.refresh,
      onSuccess: () => this.questionsData.reload(),
    },
  );
  private readonly questionDelete = serverMutation(
    (id: string) =>
      this.client.call(assessmentEndpoints.deleteQuestion, {
        params: { questionId: id },
      }),
    {
      errors: 'toast',
      success: () => 'Đã xóa câu hỏi',
      invalidates: this.refresh,
      onSuccess: () => this.questionsData.reload(),
    },
  );
  private readonly quizSave = serverMutation(
    (input: { id?: string; command: SaveQuizConfig }) =>
      input.id
        ? this.client.call(assessmentEndpoints.saveQuiz, {
            params: { quizId: input.id },
            body: input.command,
          })
        : this.client.call(assessmentEndpoints.createQuiz, {
            body: input.command,
          }),
    {
      errors: 'toast',
      success: () => 'Đã lưu cấu hình bài kiểm tra',
      invalidates: this.refresh,
      onSuccess: (quiz) => {
        this.configData.reload();
        void this.router.navigate(['/admin/quizzes', quiz.id]);
      },
    },
  );
  readonly isSaving$ = computed(
    () =>
      this.questionSave.isPending() ||
      this.quizSave.isPending() ||
      this.questionStatus.isPending() ||
      this.questionDelete.isPending(),
  );
  readonly editorOpen$ = this.state.editorOpen.asReadonly();
  readonly questionFilters$ = this.state.questionFilters.asReadonly();
  readonly questionPage$ = this.state.questionPage.asReadonly();
  readonly questionSort$ = this.state.questionSort.asReadonly();
  readonly selectedIds$ = this.state.selectedIds.asReadonly();
  readonly questionSaveError$ = this.questionSave.error;
  readonly questionStats$ = computed(() => {
    const rows = this.questions$()?.items ?? [];
    return {
      active: rows.filter((x) => x.status === 'active').length,
      single: rows.filter((x) => x.type === 'single').length,
      multiple: rows.filter((x) => x.type === 'multiple').length,
      inactive: rows.filter((x) => x.status !== 'active').length,
    };
  });
  readonly filteredQuestions$ = computed(() => {
    const f = this.questionFilters$(),
      sort = this.questionSort$();
    const rows = (this.questions$()?.items ?? []).filter(
      (x) =>
        (!f.q ||
          (x.code + ' ' + x.text)
            .toLocaleLowerCase('vi')
            .includes(f.q.toLocaleLowerCase('vi'))) &&
        (!f.type || x.type === f.type) &&
        (!f.difficulty || x.difficulty === f.difficulty) &&
        (!f.competency || x.competency === f.competency) &&
        (!f.lessonId || x.lessonId === f.lessonId) &&
        (!f.status || x.status === f.status),
    );
    const value = (row: Question): string | number => {
      if (sort.key === 'usedIn') return row.usedIn.length;
      if (sort.key === 'difficulty')
        return ['easy', 'medium', 'hard'].indexOf(row.difficulty);
      return String(row[sort.key as keyof Question] ?? '');
    };
    return rows.sort(
      (a, b) =>
        String(value(a)).localeCompare(String(value(b)), 'vi', {
          numeric: true,
        }) * (sort.dir === 'asc' ? 1 : -1),
    );
  });
  readonly questionRows$ = computed(() =>
    this.filteredQuestions$().slice(
      (this.questionPage$() - 1) * 10,
      this.questionPage$() * 10,
    ),
  );
  private readonly bulkMutation = serverMutation(
    (input: { ids: string[]; action: 'active' | 'inactive' | 'delete' }) =>
      input.ids.length
        ? forkJoin(
            input.ids.map((id) =>
              input.action === 'delete'
                ? this.client.call(assessmentEndpoints.deleteQuestion, {
                    params: { questionId: id },
                  })
                : this.client.call(assessmentEndpoints.questionStatus, {
                    params: { questionId: id },
                    body: { status: input.action },
                  }),
            ),
          )
        : of([]),
    {
      errors: 'toast',
      success: () => 'Đã cập nhật các câu hỏi đã chọn',
      onSuccess: () => {
        this.setSelectedIds([]);
        this.questionsData.reload();
      },
    },
  );
  readonly isBulkSaving$ = this.bulkMutation.isPending;
  setEditorOpen(value: boolean): void {
    this.state.editorOpen.set(value);
  }
  setQuestionFilter(
    key: keyof ReturnType<typeof this.questionFilters$>,
    value: string,
  ): void {
    this.state.questionFilters.update((f) => ({ ...f, [key]: value }));
    this.setQuestionPage(1);
  }
  setQuestionPage(page: number): void {
    this.state.questionPage.set(page);
  }
  setQuestionSort(sort: DataTableSort): void {
    this.state.questionSort.set(sort);
  }
  setSelectedIds(ids: string[]): void {
    this.state.selectedIds.set(ids);
  }
  toggleQuestion(id: string, checked: boolean): void {
    this.setSelectedIds(
      checked
        ? [...new Set([...this.selectedIds$(), id])]
        : this.selectedIds$().filter((x) => x !== id),
    );
  }
  cancelQuestion(): void {
    this.setEditorOpen(false);
  }
  async bulkQuestions(action: 'active' | 'inactive' | 'delete'): Promise<void> {
    if (!this.selectedIds$().length) return;
    if (
      action === 'delete' &&
      !(await firstValueFrom(
        confirm(this.dialog, {
          title: `Xóa ${this.selectedIds$().length} câu hỏi?`,
          message:
            'Câu hỏi đang được dùng trong bài kiểm tra không thể xóa. Thao tác không thể hoàn tác.',
          confirmLabel: 'Xóa',
          tone: 'danger',
        }),
      ))
    )
      return;
    this.bulkMutation.run({ ids: [...this.selectedIds$()], action });
  }
  retry(): void {
    switch (this.routeScreen$()) {
      case 'questions':
        this.questionsData.reload();
        break;
      case 'config':
        this.configData.reload();
        break;
      default:
        this.quizListData.reload();
    }
  }
  editQuestion(question: Question | null): void {
    this.questionSave.reset();
    this.setQuestionDraft(question ?? undefined);
    this.setEditorOpen(true);
  }
  private setQuestionDraft(question: Question | undefined): void {
    this.state.questionDraft.set(question);
  }
  readonly questionDraft$ = this.state.questionDraft.asReadonly();
  saveQuestion(command: SaveQuestion, id?: string): void {
    this.questionSave.run({ command, id });
  }
  saveQuiz(command: SaveQuizConfig, id?: string): void {
    this.quizSave.run({ command, id });
  }
  changeQuestionStatus(id: string, status: 'active' | 'inactive'): void {
    this.questionStatus.run({ id, status });
  }
  deleteQuestion(id: string): void {
    this.questionDelete.run(id);
  }
}
