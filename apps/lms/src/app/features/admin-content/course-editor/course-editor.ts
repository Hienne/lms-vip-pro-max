import { Component, computed, inject, linkedSignal } from '@angular/core';
import { form, FormRoot, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  Alert,
  AlertAction,
  Breadcrumb,
  Button,
  DrawerOutlet,
  ErrorState,
  FormActions,
  Icon,
  LinkButton,
  Spinner,
  Stepper,
} from '@lms/ui';
import type { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { BottomBar } from '../../../layout/shell-insets';
import { CatalogStatus } from '../../../shared/status/catalog-status';
import { CourseInfo } from './components/course-info/course-info';
import { CourseOutline } from './components/course-outline/course-outline';
import { CourseReview } from './components/course-review/course-review';
import { CourseRules } from './components/course-rules/course-rules';
import { LessonForm } from './components/lesson-form/lesson-form';
import {
  emptyDraftValue,
  toDraftValue,
  toSaveDraftCommand,
  type CourseDraftValue,
  type LessonValue,
} from './course-draft';
import { courseCodeSchema, courseDraftSchema } from './course-draft.schema';
import {
  CourseEditorStore,
  EDITOR_STEPS,
} from './data-access/course-editor.store';

/** The draft without its row keys, to tell whether the author changed anything. */
const fingerprint = (value: CourseDraftValue) =>
  JSON.stringify([value.code, toSaveDraftCommand(value, 0)]);

/**
 * The course editor (the mockup's `courseWizard`): four steps over one draft, saved whole. The
 * draft is this page's form model, read again from the server after every save because the
 * server renumbers the tree. Assigning moved to the assignments screen.
 */
@Component({
  selector: 'app-course-editor',
  imports: [
    Alert,
    AlertAction,
    BottomBar,
    Breadcrumb,
    Button,
    CatalogStatus,
    CourseInfo,
    CourseOutline,
    CourseReview,
    CourseRules,
    DrawerOutlet,
    ErrorState,
    FormActions,
    FormRoot,
    Icon,
    LessonForm,
    LinkButton,
    RouterLink,
    Spinner,
    Stepper,
  ],
  providers: [CourseEditorStore],
  templateUrl: './course-editor.html',
  styleUrl: './course-editor.scss',
})
export class CourseEditor implements HasUnsavedChanges {
  protected readonly store = inject(CourseEditorStore);
  protected readonly steps = EDITOR_STEPS;

  private readonly model = linkedSignal(() => {
    const detail = this.store.course$();
    return detail ? toDraftValue(detail) : emptyDraftValue();
  });
  protected readonly courseForm = form(
    this.model,
    (path) => {
      courseDraftSchema(path);
      if (this.store.isCreate$()) {
        courseCodeSchema(path.code, this.store.takenCode$);
      }
    },
    {
      submission: {
        action: async () =>
          this.store.isCreate$()
            ? this.store.create(this.model())
            : this.store.save(this.command()),
      },
    },
  );

  /** Create mode shows the form at once; edit mode waits for the course to be read. */
  protected readonly ready = computed(
    () => this.store.isCreate$() || !!this.store.course$(),
  );

  private readonly saved = computed(() => {
    const detail = this.store.course$();
    return detail
      ? fingerprint(toDraftValue(detail))
      : fingerprint(emptyDraftValue());
  });

  protected readonly dirty = computed(
    () => this.store.isDraft$() && fingerprint(this.model()) !== this.saved(),
  );

  /**
   * The fields of steps 1 to 3 in the order the page shows them; the publish step is checked by
   * the publish itself.
   */
  private readonly stepFields = () => {
    const f = this.courseForm;
    return [
      [f.title, f.programId, f.code, f.summary, f.objectives],
      [f.chapters],
      [f.rewardPoints],
    ];
  };

  constructor() {
    this.store.registerStepChecks(
      this.stepFields().map((fields) => ({
        invalid: () => fields.some((field) => field().invalid()),
        touched: () => fields.some((field) => field().touched()),
        touch: () => fields.forEach((field) => field().markAsTouched()),
      })),
    );
  }

  protected readonly editingLesson = computed((): LessonValue | undefined => {
    const target = this.store.editingLesson$();
    return target
      ? this.model().chapters[target.chapter]?.lessons[target.lesson]
      : undefined;
  });

  hasUnsavedChanges(): boolean {
    return !this.store.left$() && this.dirty();
  }

  /** "Tiếp tục": when the step stays because of an error, the first one gets focus. */
  protected continue(): void {
    const step = this.store.step$();
    if (this.store.continue()) return;
    this.stepFields()[step]
      ?.find((field) => field().invalid())?.()
      .errorSummary()[0]
      ?.fieldTree()
      .focusBoundControl();
  }

  protected publish(): void {
    void submit(this.courseForm, async () =>
      this.store.isCreate$()
        ? this.store.createAndPublish(this.model())
        : this.store.publish(this.command()),
    );
  }

  protected applyLesson(lesson: LessonValue): void {
    const target = this.store.editingLesson$();
    if (!target) return;
    this.model.update((value) => ({
      ...value,
      chapters: value.chapters.map((chapter, ci) =>
        ci === target.chapter
          ? {
              ...chapter,
              lessons: chapter.lessons.map((l, li) =>
                li === target.lesson ? lesson : l,
              ),
            }
          : chapter,
      ),
    }));
    this.store.closeLesson();
  }

  private command() {
    const { expectedVersion: _version, ...command } = toSaveDraftCommand(
      this.model(),
      0,
    );
    return command;
  }
}
