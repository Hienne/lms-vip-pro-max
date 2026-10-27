import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ORG_IMPORT_LIMITS,
  organizationEndpoints,
  type OrganizationImportResult,
} from '@lms/contracts';
import { Toaster } from '@lms/ui';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { OrgStore } from './org.store';

export const ORG_IMPORT_TEMPLATE_NAME = 'organization-import-template.xlsx';

/**
 * The "Nhập từ tệp" drawer: the template download, the picked `.xlsx`, its check (`dryRun=true`)
 * and its import (`dryRun=false`). Provided by the drawer, so the file is forgotten when it
 * closes. The app checks only the extension and the size; every rule inside the file is the
 * server's, and a refusal is the usual toast. A successful import asks the org screen to close
 * the drawer and reload the tree and the panel.
 */
@Injectable()
export class OrgImportStore {
  private readonly client = inject(EndpointClient);
  private readonly saver = inject(FileSaver);
  private readonly org = inject(OrgStore);
  private readonly toaster = inject(Toaster);

  private readonly state = {
    file: signal<File | undefined>(undefined),
    fileError: signal<string | undefined>(undefined),
    /** The check of the current file; cleared by a new file, a new check or a refused import. */
    checked: signal<OrganizationImportResult | undefined>(undefined),
  };

  private readonly templateMutation = serverMutation(
    () => this.client.call(organizationEndpoints.orgImportTemplate),
    {
      errors: 'toast',
      onSuccess: (blob) => this.saver.save(blob, ORG_IMPORT_TEMPLATE_NAME),
    },
  );

  private readonly checkMutation = serverMutation(
    (file: File) =>
      this.client.call(organizationEndpoints.importOrgs, {
        query: { dryRun: true },
        body: { file },
      }),
    { errors: 'toast', onSuccess: (result) => this.setChecked(result) },
  );

  private readonly importMutation = serverMutation(
    (file: File) =>
      this.client.call(organizationEndpoints.importOrgs, {
        query: { dryRun: false },
        body: { file },
      }),
    {
      errors: 'toast',
      success: (_, result) =>
        `Đã nhập ${result.createdOrganizations} đơn vị/phòng, ${result.createdTeams} nhóm`,
      onSuccess: () => this.org.finishImport(),
    },
  );

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
    () => this.state.file() !== undefined && !this.isBusy$(),
  );
  /** Only after a successful check of the current file, and never while a request is out. */
  readonly canImport$ = computed(
    () =>
      this.state.file() !== undefined &&
      this.checked$() !== undefined &&
      !this.isBusy$(),
  );
  /** The line under the picked file: where its check stands. */
  readonly fileStatus$ = computed(() => {
    const checked = this.checked$();
    if (this.isChecking$()) return 'Đang kiểm tra…';
    if (checked) {
      return `Hợp lệ: ${checked.organizationCount} đơn vị/phòng, ${checked.teamCount} nhóm`;
    }
    return 'Chưa kiểm tra';
  });
  /** The picked node's code, a hint for `parentCode` and `orgCode` in the file. */
  readonly selectedCode$ = computed(() => this.org.selected$()?.code);
  /** An org administrator imports teams only; the server enforces it. */
  readonly teamsOnly$ = computed(() => !this.org.canManageOrgs$());

  // Setters: the only writers of state
  private setFile(file: File | undefined): void {
    this.state.file.set(file);
  }

  private setFileError(message: string | undefined): void {
    this.state.fileError.set(message);
  }

  private setChecked(result: OrganizationImportResult | undefined): void {
    this.state.checked.set(result);
  }

  // Commands
  downloadTemplate(): void {
    this.templateMutation.run(undefined);
  }

  /**
   * Takes the picked file, or refuses a wrong type or size without sending it. Ignored while an
   * import is out: resetting it would drop the answer the server still writes.
   */
  pick(file: File | undefined): void {
    if (this.isImporting$()) return;
    this.checkMutation.reset();
    this.importMutation.reset();
    this.setChecked(undefined);
    const problem = file && fileProblem(file);
    this.setFileError(problem);
    this.setFile(problem ? undefined : file);
  }

  check(): void {
    const file = this.state.file();
    if (!file || this.isBusy$()) return;
    this.importMutation.reset();
    this.setChecked(undefined);
    this.checkMutation.run(file);
  }

  import(): void {
    const file = this.state.file();
    if (!file || !this.canImport$()) return;
    this.importMutation.run(file);
  }

  /** The copy button's result: a code copied, or a browser that refused. */
  codeCopied(copied: boolean): void {
    if (copied) this.toaster.success('Đã sao chép mã');
    else this.toaster.error('Không sao chép được mã');
  }

  close(): void {
    this.org.closeImport();
  }
}

/** The app's own checks before sending: the extension and the size, nothing inside the file. */
export function fileProblem(file: File): string | undefined {
  if (!file.name.toLowerCase().endsWith(ORG_IMPORT_LIMITS.extension)) {
    return 'Chỉ nhận tệp Excel .xlsx.';
  }
  if (file.size > ORG_IMPORT_LIMITS.maxBytes) {
    return 'Tệp lớn hơn 5 MB.';
  }
  return undefined;
}
