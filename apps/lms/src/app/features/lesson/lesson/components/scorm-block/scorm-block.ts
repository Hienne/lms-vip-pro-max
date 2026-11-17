import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { Alert, Button, Skeleton } from '@lms/ui';
import { SCORM_STATUS } from '../../../../../shared/scorm/scorm-status';
import { ScormBlockStore } from './data-access/scorm-block.store';

@Component({
  selector: 'app-scorm-block',
  imports: [Alert, Button, Skeleton],
  providers: [ScormBlockStore],
  templateUrl: './scorm-block.html',
  styleUrl: './scorm-block.scss',
  host: { '(window:message)': 'receive($event)' },
})
export class ScormBlock {
  protected readonly store = inject(ScormBlockStore);
  protected readonly status = SCORM_STATUS;
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  protected receive(event: MessageEvent): void {
    this.store.receive(
      event,
      this.frame()?.nativeElement.contentWindow ?? null,
    );
  }
  hasUnsavedChanges(): boolean {
    return this.store.unsaved$();
  }
}
