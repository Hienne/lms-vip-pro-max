import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  untracked,
} from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { QuizSummary } from '@lms/contracts';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  Icon,
  Input,
  Select,
} from '@lms/ui';
import type { CourseDraftValue } from '../../course-draft';
import { CourseEditorStore } from '../../data-access/course-editor.store';
import { QuestionImport } from '../../../../../shared/quiz/question-import/question-import';
import { QUESTION_IMPORT_HOST } from '../../../../../shared/quiz/question-import/data-access/question-import.host';
import { CourseExamForm } from './components/course-exam-form/course-exam-form';
import { newExamValue } from './data-access/course-exam.model';
import { CourseExamStore } from './data-access/course-exam.store';

const QUIZ_STATUS: Record<QuizSummary['status'], string> = {
  DRAFT: ' · Nháp',
  PUBLISHED: '',
  CLOSED: ' · Đã đóng',
};

const QUIZ_STATUS_LABEL: Record<QuizSummary['status'], string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã xuất bản',
  CLOSED: 'Đã đóng',
};

/**
 * Step 3 of the editor: the course's final exam and the reward for completing it. Completion
 * itself is measured by the server: every required lesson, a video watched past its threshold, a
 * PDF read to its last page, and the final exam when one is chosen. The card shows the exam in one
 * of three states: none, one the wizard manages (random pool over the program's bank) and one the
 * quiz screen customised (read-only here).
 */
@Component({
  selector: 'app-course-rules',
  imports: [
    Alert,
    Button,
    Card,
    CardBody,
    CourseExamForm,
    Field,
    FormField,
    Icon,
    Input,
    QuestionImport,
    Select,
  ],
  providers: [
    CourseExamStore,
    {
      provide: QUESTION_IMPORT_HOST,
      useFactory: () => {
        const exam = inject(CourseExamStore);
        return {
          programId$: exam.programId$,
          programName$: exam.programName$,
          fixedCourse$: exam.importCourse$,
          finishImport: () => exam.finishImport(),
          closeImport: () => exam.closeImport(),
        };
      },
    },
  ],
  templateUrl: './course-rules.html',
  styleUrl: './course-rules.scss',
})
export class CourseRules {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();

  protected readonly store = inject(CourseEditorStore);
  protected readonly exam = inject(CourseExamStore);
  protected readonly canAuthor = computed(() => {
    const f = this.draft();
    return [f.title, f.code, f.programId, f.level].every(
      (field) => !field().invalid(),
    );
  });
  constructor() {
    this.exam.registerDraft(computed(() => this.draft()().value()));
  }

  /** The course's final exams to pick from; a quiz that is not published says so. */
  protected readonly examOptions = computed(() => {
    const options = this.store
      .quizzes$()
      .filter((quiz) => quiz.quizType === 'FINAL_EXAM')
      .map((quiz) => ({
        value: String(quiz.id),
        label: `${quiz.title}${QUIZ_STATUS[quiz.status]}`,
      }));
    const chosen = this.draft().finalQuizId().value();
    return chosen && !options.some((o) => o.value === chosen)
      ? [
          ...options,
          {
            value: chosen,
            label: `Bài kiểm tra #${chosen} (không thuộc khóa học này)`,
          },
        ]
      : options;
  });

  /** The form's starting values for a new exam. */
  protected readonly newExam = linkedSignal({
    source: this.exam.formOpen$,
    computation: () =>
      untracked(() =>
        newExamValue(this.draft().title().value(), this.exam.activeBank$()),
      ),
  });

  protected readonly statusLabel = QUIZ_STATUS_LABEL;

  protected readonly hasExam = computed(
    () => this.draft().finalQuizId().value() !== '',
  );

  /**
   * "Gỡ khỏi khóa học": the course stops requiring the exam once the draft is saved. The quiz
   * itself stays (one final exam per course), so it can be attached again.
   */
  protected detach(): void {
    this.draft().finalQuizId().value.set('');
  }

  /** "Gắn lại bài thi": the course requires the kept exam again. */
  protected attach(quizId: number): void {
    this.draft().finalQuizId().value.set(String(quizId));
  }
}
