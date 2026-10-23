import { Component, computed, input } from '@angular/core';
import type { Citation } from '@lms/contracts';
import { citationLabel } from '../../data-access/citation-label';

/** The sources of an answer: one row per citation, the quoted passage one click away. */
@Component({
  selector: 'app-citation-list',
  templateUrl: './citation-list.html',
  styleUrl: './citation-list.scss',
})
export class CitationList {
  readonly citations = input.required<readonly Citation[]>();

  protected readonly items = computed(() =>
    this.citations().map((citation) => ({
      n: citation.n,
      label: citationLabel(citation),
      snippet: citation.snippet,
    })),
  );
}
