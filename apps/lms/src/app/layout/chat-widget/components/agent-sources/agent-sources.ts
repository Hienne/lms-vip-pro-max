import { Component, computed, input } from '@angular/core';
import type { Citation } from '@lms/contracts';
import { Popover } from '@lms/ui';
import {
  citationLocation,
  citationName,
} from '../../../../shared/assistant/citation-label';

/** The id of a source in the list, which a number in the answer moves focus to. */
export function agentSourceId(turnId: number, n: number): string {
  return `agent-source-${turnId}-${n}`;
}

/**
 * The sources under a reply, one line each: its number, the file and the place in it. A line
 * opens a popover with the quoted passage.
 */
@Component({
  selector: 'app-agent-sources',
  imports: [Popover],
  templateUrl: './agent-sources.html',
  styleUrl: './agent-sources.scss',
})
export class AgentSources {
  readonly turnId = input.required<number>();
  readonly citations = input.required<readonly Citation[]>();

  /** One line per number, in number order. */
  protected readonly items = computed(() => {
    const byNumber = new Map<number, Citation>();
    for (const citation of this.citations()) {
      if (!byNumber.has(citation.n)) byNumber.set(citation.n, citation);
    }
    return [...byNumber.values()]
      .sort((a, b) => a.n - b.n)
      .map((citation) => ({
        citation,
        id: agentSourceId(this.turnId(), citation.n),
        name: citationName(citation),
        location: citationLocation(citation),
      }));
  });
}
