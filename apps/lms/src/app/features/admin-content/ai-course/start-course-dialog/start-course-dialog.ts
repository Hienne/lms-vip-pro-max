import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import type { CourseJob, CourseJobInputs } from '@lms/contracts';
import {
  Alert,
  Button,
  Field,
  Icon,
  IconButton,
  Input,
  Select,
  Spinner,
  Textarea,
} from '@lms/ui';
import { firstValueFrom } from 'rxjs';
import {
  UPLOAD_ACCEPT,
  uploadProblem,
} from '../../../../core/knowledge/upload-rules';
import {
  EMPTY_START_COURSE_FORM,
  LEVEL_OPTIONS,
  StartCourseFormSchema,
  type StartCourseFormValue,
} from './start-course-dialog.form';
import { StartCourseStore } from './data-access/start-course.store';

/**
 * The start form of "Tạo bằng AI": one file and what the course is for. It queues the job and
 * closes with it; the owl then follows the job from any page. An admin also picks the unit that
 * will own the course, an instructor's is always their own.
 */
@Component({
  selector: 'app-start-course-dialog',
  imports: [
    Alert,
    Button,
    Field,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    Select,
    Spinner,
    Textarea,
  ],
  providers: [StartCourseStore],
  templateUrl: './start-course-dialog.html',
  styleUrl: './start-course-dialog.scss',
})
export class StartCourseDialog {
  private readonly ref = inject<DialogRef<CourseJob>>(DialogRef);
  private readonly store = inject(StartCourseStore);

  protected readonly accept = UPLOAD_ACCEPT;
  protected readonly levels = LEVEL_OPTIONS;
  protected readonly picksUnit = this.store.picksUnit$;
  protected readonly units = this.store.units$;
  protected readonly programmes = this.store.programmes$;
  protected readonly competencies = this.store.competencies$;
  protected readonly starting = this.store.isStarting$;
  protected readonly error = this.store.error$;

  protected readonly file = signal<File | null>(null);
  protected readonly fileProblem = signal<string | null>(null);

  private readonly model = signal<StartCourseFormValue>({
    ...EMPTY_START_COURSE_FORM,
  });
  protected readonly startForm = form(
    this.model,
    (path) => validateStandardSchema(path, StartCourseFormSchema),
    {
      submission: {
        action: async () => this.start(),
      },
    },
  );

  /** A file, the fields, the server's one-of rule (chapters or duration) and, for an admin, a unit. */
  protected readonly canStart = computed(() => {
    const value = this.model();
    return (
      this.file() !== null &&
      !this.starting() &&
      this.startForm().valid() &&
      (value.chapters !== '' || value.durationMinutes !== '') &&
      (!this.picksUnit() || value.ownerOrgId !== '')
    );
  });

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.item(0) ?? null;
    input.value = '';
    if (!picked) return;
    const problem = uploadProblem(picked);
    this.fileProblem.set(problem);
    this.file.set(problem ? null : picked);
  }

  /** An admin chose a unit: its programmes replace the list and the old choice no longer applies. */
  protected unitPicked(): void {
    const id = this.model().ownerOrgId;
    this.store.chooseUnit(id === '' ? undefined : Number(id));
    this.startForm.programmeId().value.set('');
  }

  protected cancel(): void {
    this.ref.close();
  }

  private start(): void {
    const file = this.file();
    if (!file || !this.canStart()) return;
    const value = this.model();
    const inputs: CourseJobInputs = {
      targetLearners: value.targetLearners.trim(),
      level: value.level,
      chapters: value.chapters === '' ? null : Number(value.chapters),
      durationMinutes:
        value.durationMinutes === '' ? null : Number(value.durationMinutes),
      programmeId: Number(value.programmeId),
      competencyId: Number(value.competencyId),
      ownerOrgId:
        this.picksUnit() && value.ownerOrgId !== ''
          ? Number(value.ownerOrgId)
          : null,
    };
    this.store.start({ file, inputs }, (job) => this.ref.close(job));
  }
}

/**
 * Opens the start form. Resolves with the queued job, or `undefined` when the dialog is dismissed.
 */
export function startCourseWithAi(
  dialog: Dialog,
): Promise<CourseJob | undefined> {
  return firstValueFrom(
    dialog.open<CourseJob, unknown, StartCourseDialog>(StartCourseDialog, {
      role: 'dialog',
      ariaModal: true,
      ariaLabelledBy: 'start-course-title',
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-pane',
    }).closed,
    { defaultValue: undefined },
  );
}
