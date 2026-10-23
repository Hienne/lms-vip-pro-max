import { Component, computed, input } from '@angular/core';
import type { Citation } from '@lms/contracts';
import { Badge, Popover } from '@lms/ui';
import {
  citationLocation,
  citationName,
} from '../../data-access/citation-label';

/**
 * One source of an answer: a numbered badge that opens a popover with the file, the place in it and
 * the quoted passage.
 */
@Component({
  selector: 'app-source-badge',
  imports: [Badge, Popover],
  templateUrl: './source-badge.html',
  styleUrl: './source-badge.scss',
})
export class SourceBadge {
  readonly citation = input.required<Citation>();

  protected readonly name = computed(() => citationName(this.citation()));
  protected readonly location = computed(() =>
    citationLocation(this.citation()),
  );
}
