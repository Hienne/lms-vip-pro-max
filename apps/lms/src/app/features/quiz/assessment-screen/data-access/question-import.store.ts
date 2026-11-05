import { computed, inject, Injectable, signal } from '@angular/core';
import {
  assessmentV1Endpoints as api,
  courseEndpoints,
  QUESTION_IMPORT_LIMITS,
  type QuestionImportResult,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { AssessmentScreenStore } from './assessment-screen.store';

export const QUESTION_IMPORT_TEMPLATE_NAME = 'question-import-template.xlsx';

/** The size limit in the copy: binary megabytes, written "MB" as users read it. */
const MAX_MB = QUESTION_IMPORT_LIMITS.maxBytes / (1024 * 1024);

/**
 * The "Nhập từ Excel" drawer of the question bank: the course to import into, the template, the
 * picked `.xlsx`, its check (`dryRun=true`) and its import (`dryRun=false`). Provided by the
 * drawer, so the file is forgotten when it closes. The app checks only the extension and the size;
 * every rule inside the file is the server's, and a refusal is the usual toast. A written import
 * asks the screen to close the drawer and reload the bank.
 */
@Injectable()
export class QuestionImportStore {
  private readonly client = inject(EndpointClient);
  private readonly saver = inject(FileSaver);
  private readonly screen = inject(AssessmentScreenStore);

  private readonly state = {
    /** `undefined` follows the first course of the program. */
    courseId: signal<number | undefined>(undefined),
    overwrite: signal(false),
    file: signal<File | undefined>(undefined),
    fileError: signal<string | undefined>(undefined),
    /** The check of the current file and settings; cleared by any change to them. */
    checked: signal<QuestionImportResult | undefined>(undefined),
  };

  /** A question is imported into one course's bank, so the drawer asks which of the program's. */
  private readonly coursesData = serverData(
    (programId: number) =>
      this.client.call(courseEndpoints.instructorCourses, {
        query: { programId, page: 0, size: 50 },
      }),
    { params: () => this.screen.selectedProgramId$() },
  );

  private readonly templateMutation = serverMutation(
    () => this.client.call(api.questionImportTemplate),
    {
      errors: 'toast',
      onSuccess: (blob) => this.saver.save(blob, QUESTION_IMPORT_TEMPLATE_NAME),
    },
  );

  private readonly checkMutation = serverMutation(
    (input: { file: File; courseId: number; overwrite: boolean }) =>
      this.client.call(api.importQuestions, {
        query: {
          courseId: input.courseId,
          dryRun: true,
          overwrite: input.overwrite,
        },
        body: { file: input.file },
      }),
    { errors: 'toast', onSuccess: (result) => this.setChecked(result) },
  );

  private readonly importMutation = serverMutation(
    (input: { file: File; courseId: number; overwrite: boolean }) =>
      this.client.call(api.importQuestions, {
        query: {
          courseId: input.courseId,
          dryRun: false,
          overwrite: input.overwrite,
        },
        body: { file: input.file },
      }),
    {
      errors: 'toast',
      success: (_, result) =>
        `Đã nhập ${result.created} câu hỏi, ghi đè ${result.updated} câu`,
      onSuccess: () => this.screen.finishImport(),
    },
  );

  readonly limitsHint = `Tệp ${QUESTION_IMPORT_LIMITS.extension}, tối đa ${MAX_MB} MB và ${QUESTION_IMPORT_LIMITS.maxRows} dòng dữ liệu.`;
  readonly courses$ = computed(() => this.coursesData.value()?.items ?? []);
  readonly coursesError$ = this.coursesData.error;
  readonly isLoadingCourses$ = this.coursesData.isLoading;
  /** The chosen course, or the program's first while none is chosen. */
  readonly courseId$ = computed<number | undefined>(
    () => this.state.courseId() ?? this.courses$()[0]?.courseId,
  );
  readonly overwrite$ = this.state.overwrite.asReadonly();
  readonly file$ = this.state.file.asReadonly();
  readonly fileError$ = this.state.fileError.asReadonly();
  /** Hidden again once the import of that file is refused. */
  readonly checked$ = computed(() =>
    this.importMutation.error() ? undefined : this.state.checked(),
  );
  readonly isDownloading$ = this.templateMutation.isPending;
  readonly isChecking$ = this.checkMutation.isPending;
  readonly isImporting$ = this.importMutation.isPending;
  readonly isBusy$ = computed(() => this.isChecking$() || this.isImporting$());
  readonly canCheck$ = computed(
    () =>
      this.state.file() !== undefined &&
      this.courseId$() !== undefined &&
      !this.isBusy$(),
  );
  /** Only after a successful check of the current file and settings, never while a request is out. */
  readonly canImport$ = computed(
    () => this.canCheck$() && this.checked$() !== undefined,
  );
  /** The line under the picked file: where its check stands. */
  readonly fileStatus$ = computed(() => {
    const checked = this.checked$();
    if (this.isChecking$()) return 'Đang kiểm tra…';
    if (checked) {
      return `Hợp lệ: ${checked.toCreate} câu mới, ${checked.toUpdate} câu ghi đè`;
    }
    return 'Chưa kiểm tra';
  });

  // Setters: the only writers of state
  private setCourseId(id: number | undefined): void {
    this.state.courseId.set(id);
  }
  private setOverwrite(value: boolean): void {
    this.state.overwrite.set(value);
  }
  private setFile(file: File | undefined): void {
    this.state.file.set(file);
  }
  private setFileError(message: string | undefined): void {
    this.state.fileError.set(message);
  }
  private setChecked(result: QuestionImportResult | undefined): void {
    this.state.checked.set(result);
  }

  // Commands
  downloadTemplate(): void {
    this.templateMutation.run(undefined);
  }

  /** Any change to the file or the settings voids the check of the earlier ones. */
  private forgetCheck(): void {
    this.checkMutation.reset();
    this.importMutation.reset();
    this.setChecked(undefined);
  }

  selectCourse(value: string): void {
    if (this.isBusy$()) return;
    const id = Number(value);
    this.forgetCheck();
    this.setCourseId(Number.isSafeInteger(id) && id > 0 ? id : undefined);
  }

  setOverwriteExisting(value: boolean): void {
    if (this.isBusy$()) return;
    this.forgetCheck();
    this.setOverwrite(value);
  }

  /**
   * Takes the picked file, or refuses a wrong type or size without sending it. Ignored while a
   * request is out: resetting it would drop the answer the server still writes.
   */
  pick(file: File | undefined): void {
    if (this.isBusy$()) return;
    this.forgetCheck();
    const problem = file && fileProblem(file);
    this.setFileError(problem);
    this.setFile(problem ? undefined : file);
  }

  private input() {
    const file = this.state.file();
    const courseId = this.courseId$();
    return file && courseId
      ? { file, courseId, overwrite: this.state.overwrite() }
      : undefined;
  }

  check(): void {
    const input = this.input();
    if (!input || this.isBusy$()) return;
    this.importMutation.reset();
    this.setChecked(undefined);
    this.checkMutation.run(input);
  }

  import(): void {
    const input = this.input();
    if (!input || !this.canImport$()) return;
    this.importMutation.run(input);
  }

  close(): void {
    this.screen.closeImport();
  }
}

/** The app's own checks before sending: the extension and the size, nothing inside the file. */
export function fileProblem(file: File): string | undefined {
  if (!file.name.toLowerCase().endsWith(QUESTION_IMPORT_LIMITS.extension)) {
    return 'Chỉ nhận tệp Excel .xlsx.';
  }
  if (file.size > QUESTION_IMPORT_LIMITS.maxBytes) {
    return `Tệp lớn hơn ${MAX_MB} MB.`;
  }
  return undefined;
}
