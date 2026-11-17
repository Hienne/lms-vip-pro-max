import { Component, computed, inject, input } from '@angular/core';
import type { Citation } from '@lms/contracts';
import { RouterLink } from '@angular/router';
import { Badge, Popover } from '@lms/ui';
import { SourceViewerStore } from '../../../core/assistant/source-viewer.store';
import { citationLocation, citationName } from '../citation-label';

/**
 * One source of an answer: a numbered badge that opens a popover with the file, the place in it and
 * the quoted passage.
 */
@Component({
  selector: 'app-source-badge',
  imports: [Badge, Popover, RouterLink],
  templateUrl: './source-badge.html',
  styleUrl: './source-badge.scss',
})
export class SourceBadge {
  readonly citation = input.required<Citation>();
  protected readonly viewer = inject(SourceViewerStore);

  protected readonly name = computed(() => citationName(this.citation()));
  protected readonly location = computed(() =>
    citationLocation(this.citation()),
  );
}
