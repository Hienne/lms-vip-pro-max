import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
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

const QUIZ_STATUS: Record<QuizSummary['status'], string> = {
  DRAFT: ' · Nháp',
  PUBLISHED: '',
  CLOSED: ' · Đã đóng',
};

/**
 * Step 3 of the editor: the course's final exam and the reward for completing it. Completion
 * itself is measured by the server: every required lesson, a video watched past its threshold, a
 * PDF read to its last page, and the final exam when one is chosen. The exam's own settings
 * (time, questions, pass score, attempts) live on the quiz screen.
 */
@Component({
  selector: 'app-course-rules',
  imports: [
    Alert,
    Button,
    Card,
    CardBody,
    Field,
    FormField,
    Icon,
    Input,
    RouterLink,
    Select,
  ],
  templateUrl: './course-rules.html',
  styleUrl: './course-rules.scss',
})
export class CourseRules {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();

  protected readonly store = inject(CourseEditorStore);

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

  protected readonly hasExam = computed(
    () => this.draft().finalQuizId().value() !== '',
  );
}
