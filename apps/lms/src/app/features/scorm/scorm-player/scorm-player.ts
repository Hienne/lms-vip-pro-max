import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Button,
  FmtDatetimePipe,
  Icon,
  PageHeader,
  SectionCard,
  Skeleton,
} from '@lms/ui';
import { SCORM_STATUS } from '../data-access/scorm-status';
import { ScormPlayerStore } from './data-access/scorm-player.store';

@Component({
  selector: 'app-scorm-player',
  imports: [
    Alert,
    Button,
    FmtDatetimePipe,
    Icon,
    PageHeader,
    RouterLink,
    SectionCard,
    Skeleton,
  ],
  providers: [ScormPlayerStore],
  templateUrl: './scorm-player.html',
  styleUrl: './scorm-player.scss',
  host: {
    '(window:message)': 'message($event)',
    '(window:beforeunload)': 'beforeUnload($event)',
  },
})
export class ScormPlayer {
  protected readonly store = inject(ScormPlayerStore);
  protected readonly status = SCORM_STATUS;
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  protected message(event: MessageEvent): void {
    this.store.receive(
      event,
      this.frame()?.nativeElement.contentWindow ?? null,
    );
  }
  hasUnsavedChanges(): boolean {
    return ['saving', 'error'].includes(this.store.saveState$());
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }
}
