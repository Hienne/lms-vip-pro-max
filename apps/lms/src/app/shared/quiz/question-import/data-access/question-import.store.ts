import { computed, inject, Injectable, signal } from '@angular/core';
import { map } from 'rxjs';
import {
  programAssessmentEndpoints as api,
  QUESTION_IMPORT_LIMITS,
  type QuestionImportResult,
} from '@lms/contracts';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { serverData } from '../../../../core/data-access/server-data';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { QUESTION_IMPORT_HOST } from './question-import.host';

export const QUESTION_IMPORT_TEMPLATE_NAME = 'question-import-template.xlsx';
const MAX_MB = QUESTION_IMPORT_LIMITS.maxBytes / (1024 * 1024);
const COLUMN_LABELS: Record<string, string> = {
  ma: 'Mã câu hỏi',
  noi_dung: 'Nội dung câu hỏi',
  loai: 'Loại câu hỏi',
  phuong_an: 'Phương án',
  dap_an_dung: 'Đáp án đúng',
  giai_thich: 'Giải thích',
  do_kho: 'Độ khó',
  nhom_kien_thuc: 'Nhóm năng lực',
  diem: 'Điểm',
  trang_thai: 'Trạng thái',
};
interface ImportInput {
  file: File;
  programId: number;
  courseId?: number;
  overwrite: boolean;
}
interface CheckedFile extends ImportInput {
  result: QuestionImportResult;
}

/** Imports into the selected program. The server validates every row before an atomic write. */
@Injectable()
export class QuestionImportStore {
  private readonly client = inject(EndpointClient);
  private readonly saver = inject(FileSaver);
  private readonly host = inject(QUESTION_IMPORT_HOST);
  private readonly state = {
    overwrite: signal(false),
    file: signal<File | undefined>(undefined),
    fileError: signal<string | undefined>(undefined),
    checked: signal<CheckedFile | undefined>(undefined),
  };
  private readonly competenciesData = serverData(() =>
    this.client.call(api.competencies, { query: { status: 'ACTIVE' } }),
  );
  private readonly templateMutation = serverMutation(
    () => this.client.call(api.questionImportTemplate),
    {
      errors: 'toast',
      onSuccess: (blob) => this.saver.save(blob, QUESTION_IMPORT_TEMPLATE_NAME),
    },
  );
  private readonly checkMutation = serverMutation(
    (input: ImportInput) =>
      this.client
        .call(api.importQuestions, {
          query: {
            programId: input.programId,
            courseId: input.courseId,
            dryRun: true,
            overwrite: input.overwrite,
          },
          body: { file: input.file },
        })
        .pipe(map((result) => ({ ...input, result }))),
    { errors: 'alert', onSuccess: (checked) => this.setChecked(checked) },
  );
  private readonly importMutation = serverMutation(
    (input: ImportInput) =>
      this.client.call(api.importQuestions, {
        query: {
          programId: input.programId,
          courseId: input.courseId,
          dryRun: false,
          overwrite: input.overwrite,
        },
        body: { file: input.file },
      }),
    {
      errors: 'alert',
      success: (_, result) =>
        `Đã nhập ${result.created} câu hỏi, ghi đè ${result.updated} câu`,
      onSuccess: () => this.host.finishImport(),
    },
  );
  readonly programId$ = this.host.programId$;
  readonly programName$ = this.host.programName$;
  readonly fixedCourse$ = computed(() => this.host.fixedCourse$?.());
  readonly competencies$ = computed(() =>
    (this.competenciesData.value() ?? []).filter((c) => c.status === 'ACTIVE'),
  );
  readonly limitsHint = `Tệp ${QUESTION_IMPORT_LIMITS.extension}, tối đa ${MAX_MB} MB và ${QUESTION_IMPORT_LIMITS.maxRows} dòng dữ liệu.`;
  readonly overwrite$ = this.state.overwrite.asReadonly();
  readonly file$ = this.state.file.asReadonly();
  readonly fileError$ = this.state.fileError.asReadonly();
  readonly checked$ = computed(() => {
    const checked = this.state.checked();
    return checked &&
      !this.importMutation.error() &&
      checked.programId === this.programId$() &&
      checked.courseId === this.fixedCourse$()?.courseId &&
      checked.file === this.file$() &&
      checked.overwrite === this.overwrite$()
      ? checked.result
      : undefined;
  });
  readonly error$ = computed(
    () => this.checkMutation.error() ?? this.importMutation.error(),
  );
  readonly rowErrors$ = computed(() =>
    (this.error$()?.fieldErrors ?? []).map((error) => {
      const match = /^Questions\[(\d+)\]\.?(.*)$/.exec(error.field);
      return {
        row: match?.[1],
        column:
          COLUMN_LABELS[match?.[2] ?? error.field] ??
          (match ? 'Dữ liệu câu hỏi' : 'Tệp Excel'),
        message: error.message,
      };
    }),
  );
  readonly isDownloading$ = this.templateMutation.isPending;
  readonly isChecking$ = this.checkMutation.isPending;
  readonly isImporting$ = this.importMutation.isPending;
  readonly isBusy$ = computed(() => this.isChecking$() || this.isImporting$());
  readonly canCheck$ = computed(
    () => !!this.file$() && !!this.programId$() && !this.isBusy$(),
  );
  readonly canImport$ = computed(
    () => this.canCheck$() && this.checked$() !== undefined,
  );
  readonly step$ = computed(() =>
    this.checked$() ? 3 : this.isChecking$() || this.error$() ? 2 : 1,
  );
  readonly fileStatus$ = computed(() => {
    const checked = this.checked$();
    if (this.isChecking$()) return 'Đang kiểm tra…';
    if (this.error$()) return 'Cần kiểm tra lại';
    return checked ? 'Đã kiểm tra' : 'Chưa kiểm tra';
  });
  private setOverwrite(value: boolean): void {
    this.state.overwrite.set(value);
  }
  private setFile(file: File | undefined): void {
    this.state.file.set(file);
  }
  private setFileError(message: string | undefined): void {
    this.state.fileError.set(message);
  }
  private setChecked(checked: CheckedFile | undefined): void {
    this.state.checked.set(checked);
  }

  downloadTemplate(): void {
    if (!this.isDownloading$()) this.templateMutation.run(undefined);
  }
  private forgetCheck(): void {
    this.checkMutation.reset();
    this.importMutation.reset();
    this.setChecked(undefined);
  }
  editFile(): void {
    if (!this.isBusy$()) this.forgetCheck();
  }
  setOverwriteExisting(value: boolean): void {
    if (this.isBusy$()) return;
    this.forgetCheck();
    this.setOverwrite(value);
  }
  pick(file: File | undefined): void {
    if (this.isBusy$()) return;
    this.forgetCheck();
    const problem = file && fileProblem(file);
    this.setFileError(problem);
    this.setFile(problem ? undefined : file);
  }
  private input(): ImportInput | undefined {
    const file = this.file$(),
      programId = this.programId$();
    return file && programId
      ? {
          file,
          programId,
          courseId: this.fixedCourse$()?.courseId,
          overwrite: this.overwrite$(),
        }
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
    if (input && this.canImport$()) this.importMutation.run(input);
  }
  close(): void {
    if (!this.isBusy$()) this.host.closeImport();
  }
}

/** File contents and row rules are validated by the server. */
export function fileProblem(file: File): string | undefined {
  if (!file.name.toLowerCase().endsWith(QUESTION_IMPORT_LIMITS.extension))
    return 'Chỉ nhận tệp Excel .xlsx.';
  if (!file.size) return 'Tệp Excel đang rỗng. Chọn lại tệp có dữ liệu.';
  if (file.size > QUESTION_IMPORT_LIMITS.maxBytes)
    return `Tệp lớn hơn ${MAX_MB} MB.`;
  return undefined;
}
