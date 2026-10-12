import { Injectable, signal } from '@angular/core';

@Injectable()
export class FormsSectionStore {
  private readonly state = {
    summaryShown: signal(false),
    receivedFiles: signal(''),
  };

  readonly summaryShown$ = this.state.summaryShown.asReadonly();
  readonly receivedFiles$ = this.state.receivedFiles.asReadonly();

  setSummaryShown(shown: boolean): void {
    this.state.summaryShown.set(shown);
  }

  addFiles(files: readonly File[]): void {
    this.state.receivedFiles.set(files.map((file) => file.name).join(', '));
  }

  showSummary(): void {
    this.setSummaryShown(true);
  }

  hideSummary(): void {
    this.setSummaryShown(false);
  }
}
