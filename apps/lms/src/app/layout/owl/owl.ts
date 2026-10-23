import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Icon, Tooltip } from '@lms/ui';
import { DocumentTrackerStore } from '../../core/knowledge/document-tracker.store';

/**
 * The owl in the corner of every app page: it chews while the user's uploads are being processed,
 * smiles when one is ready and shows a plain face when one failed, and takes the user to the
 * assistant. It keeps no state of its own; the tracker owns what is pending and what finished.
 */
@Component({
  selector: 'app-owl',
  imports: [Icon, Tooltip],
  host: {
    '[class.owl--beside-toolbar]': 'besideToolbar()',
    '(keydown.escape)': 'dismiss()',
  },
  templateUrl: './owl.html',
  styleUrl: './owl.scss',
})
export class Owl {
  private readonly tracker = inject(DocumentTrackerStore);
  private readonly router = inject(Router);

  /** Moves the owl left, off the dev toolbar that is pinned to the same corner. */
  readonly besideToolbar = input(false);

  protected readonly state = this.tracker.owlState$;
  protected readonly finished = computed(
    () => this.tracker.lastFinished$()?.document ?? null,
  );
  protected readonly pendingCount = computed(
    () => this.tracker.pending$().length,
  );

  protected readonly label = computed(() =>
    this.state() === 'processing'
      ? `Trợ lý AI: đang xử lý ${this.pendingCount()} tài liệu`
      : 'Trợ lý AI',
  );
  protected readonly tip = computed(() =>
    this.state() === 'processing'
      ? `Đang xử lý ${this.pendingCount()} tài liệu`
      : 'Trợ lý AI',
  );

  /** What a screen reader hears when the state changes; it names no count, so it speaks once. */
  protected readonly announcement = computed(() => {
    const document = this.finished();
    if (this.state() === 'processing') return 'Đang xử lý tài liệu.';
    if (!document) return '';
    return this.state() === 'done'
      ? `Đã xử lý xong tài liệu ${document.fileName}.`
      : `Không xử lý được tài liệu ${document.fileName}.`;
  });

  protected open(): void {
    void this.router.navigateByUrl('/assistant');
    this.dismiss();
  }

  protected dismiss(): void {
    this.tracker.dismiss();
  }
}
