import { catchError, concatMap, from, map, of, toArray } from 'rxjs';
import { toAppError } from '../../../core/errors/app-error';
import { Component, computed, inject, signal } from '@angular/core';
import {
  courseEndpoints,
  flashcardEndpoints,
  programAssessmentEndpoints,
  type FlashcardPublication,
} from '@lms/contracts';
import {
  Button,
  Card,
  ErrorState,
  PageHeader,
  Pagination,
  Search,
  Select,
  Table,
  TableWrap,
} from '@lms/ui';
import { serverData } from '../../../core/data-access/server-data';
import { serverMutation } from '../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../core/http/endpoint-client';

@Component({
  selector: 'app-manage-flashcards',
  imports: [
    Button,
    Card,
    ErrorState,
    PageHeader,
    Pagination,
    Search,
    Select,
    Table,
    TableWrap,
  ],
  templateUrl: './manage-flashcards.html',
  styleUrl: './flashcards.scss',
})
export class ManageFlashcards {
  private readonly client = inject(EndpointClient);
  protected readonly pageSize = 20;
  protected readonly coursePage = signal(1);
  protected readonly questionPage = signal(1);
  protected readonly courseSearch = signal('');
  protected readonly questionSearch = signal('');
  protected readonly courseId = signal(0);
  protected readonly selected = signal<ReadonlyMap<number, number>>(new Map());
  protected readonly batchResult = signal<
    readonly { id: number; message: string }[] | null
  >(null);
  protected readonly batch = serverMutation(
    (input: {
      courseId: number;
      items: readonly { id: number; version: number }[];
    }) =>
      from(input.items).pipe(
        concatMap((item) =>
          this.client
            .call(flashcardEndpoints.publish, {
              params: { courseId: input.courseId, questionId: item.id },
              body: { status: 'PUBLISHED', questionVersion: item.version },
            })
            .pipe(
              map(() => ({ id: item.id, message: '' })),
              catchError((error: unknown) =>
                of({ id: item.id, message: toAppError(error).message }),
              ),
            ),
        ),
        toArray(),
      ),
    {
      errors: 'toast',
      onSuccess: (result) => {
        this.batchResult.set(result);
        this.selected.set(new Map());
        this.cards.reload();
      },
    },
  );
  protected toggleQuestion(
    id: number,
    version: number,
    checked: boolean,
  ): void {
    this.selected.update((current) => {
      const next = new Map(current);
      if (checked) next.set(id, version);
      else next.delete(id);
      return next;
    });
  }
  protected selectPage(checked: boolean): void {
    const next = new Map<number, number>();
    if (checked)
      for (const item of this.questions.value()?.items ?? []) {
        const existing = this.byQuestion().get(item.id);
        if (!(existing?.status === 'PUBLISHED' && existing.current))
          next.set(item.id, item.rowVersion);
      }
    this.selected.set(next);
  }
  protected publishSelected(): void {
    const items = [...this.selected()].map(([id, version]) => ({
      id,
      version,
    }));
    if (
      items.length &&
      window.confirm(
        'Công bố ' + items.length + ' câu? Học viên sẽ xem được đáp án.',
      )
    ) {
      this.batchResult.set(null);
      this.batch.run({ courseId: this.courseId(), items });
    }
  }
  protected readonly courses = serverData(
    (query) => this.client.call(courseEndpoints.instructorCourses, { query }),
    {
      params: () => ({
        page: this.coursePage() - 1,
        size: this.pageSize,
        q: this.courseSearch().trim().slice(0, 100) || undefined,
      }),
    },
  );
  protected readonly selectedCourse = computed(() =>
    this.courses
      .value()
      ?.items.find((course) => course.courseId === this.courseId()),
  );
  protected readonly questions = serverData(
    (query) =>
      this.client.call(programAssessmentEndpoints.questions, { query }),
    {
      params: () => {
        const course = this.selectedCourse();
        return course?.programId
          ? {
              programId: course.programId,
              courseId: course.courseId,
              page: this.questionPage() - 1,
              size: this.pageSize,
              status: 'ACTIVE' as const,
              q: this.questionSearch().trim().slice(0, 100) || undefined,
            }
          : undefined;
      },
    },
  );
  protected readonly cards = serverData(
    (courseId: number) =>
      this.client.call(flashcardEndpoints.managed, { params: { courseId } }),
    { params: () => this.courseId() || undefined },
  );
  protected readonly byQuestion = computed(
    () =>
      new Map(
        (this.cards.value() ?? []).map((card) => [card.questionId, card]),
      ),
  );
  protected readonly save = serverMutation(
    (input: {
      courseId: number;
      questionId: number;
      status: FlashcardPublication;
      questionVersion?: number;
    }) =>
      this.client.call(flashcardEndpoints.publish, {
        params: { courseId: input.courseId, questionId: input.questionId },
        body: { status: input.status, questionVersion: input.questionVersion },
      }),
    {
      errors: 'toast',
      onSuccess: () => this.cards.reload(),
      success: () => 'Đã lưu flashcard.',
    },
  );

  protected selectCourse(id: number): void {
    this.selected.set(new Map());
    this.batchResult.set(null);
    this.courseId.set(id);
    this.questionPage.set(1);
    this.questionSearch.set('');
  }

  protected searchCourses(value: string): void {
    this.courseSearch.set(value);
    this.coursePage.set(1);
    this.selectCourse(0);
  }

  protected change(
    questionId: number,
    status: FlashcardPublication,
    questionVersion?: number,
  ): void {
    if (this.courseId() && !this.save.isPending())
      this.save.run({
        courseId: this.courseId(),
        questionId,
        status,
        questionVersion,
      });
  }
}
