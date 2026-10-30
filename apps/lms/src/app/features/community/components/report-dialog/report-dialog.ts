import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import { Button, Icon, IconButton, Textarea } from '@lms/ui';
import { defer, map, type Observable } from 'rxjs';
import { REPORT_REASONS } from '../../data-access/community-labels';
import {
  ReportFormSchema,
  type ReportDraft,
  type ReportFormValue,
} from './report-dialog.form';

/**
 * The report form, opened by {@link reportContent}. Closes with the reason and the optional
 * description, or with nothing when the user cancels.
 */
@Component({
  selector: 'app-report-dialog',
  imports: [Button, FormField, FormRoot, Icon, IconButton, Textarea],
  templateUrl: './report-dialog.html',
  styleUrl: './report-dialog.scss',
})
export class ReportDialog {
  private readonly ref = inject<DialogRef<ReportDraft>>(DialogRef);

  protected readonly reasons = REPORT_REASONS;

  private readonly model = signal<ReportFormValue>({
    reasonCode: '',
    description: '',
  });
  protected readonly reportForm = form(
    this.model,
    (path) => validateStandardSchema(path, ReportFormSchema),
    {
      submission: {
        action: async () => {
          const { reasonCode, description } = this.model();
          const text = description.trim();
          this.ref.close({
            reasonCode,
            ...(text ? { description: text } : {}),
          });
        },
      },
    },
  );

  protected cancel(): void {
    this.ref.close();
  }
}

/**
 * Opens the report dialog. The observable is cold, opens on subscribe and emits once with the
 * report, or completes without a value when the dialog is dismissed.
 */
export function reportContent(
  dialog: Dialog,
): Observable<ReportDraft | undefined> {
  return defer(() =>
    dialog
      .open<ReportDraft, unknown, ReportDialog>(ReportDialog, {
        role: 'dialog',
        ariaModal: true,
        ariaLabelledBy: 'report-dialog-title',
        backdropClass: 'dialog-backdrop',
        panelClass: 'dialog-pane',
      })
      .closed.pipe(map((result) => result)),
  );
}
