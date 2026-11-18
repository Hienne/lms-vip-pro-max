import { computed, inject, Injectable, signal } from '@angular/core';
import { assessmentV1Endpoints } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import type { RulesPatch } from './drafting-fill';
import { emptyRules, type DraftRulesValue } from './drafting-rules';

/**
 * Step 3 of a drafting session on the editor page: the draft questions and their competency as the
 * assistant wrote them, one write at a time. The questions form is the step 3 card's own
 * (`drafting-questions`), made from what this store holds; the form's values reach the server only
 * through "Đã chốt". Provided by the editor page, beside {@link DraftingFillStore}, which writes here.
 */
@Injectable()
export class DraftingQuestionsStore {
  private readonly client = inject(EndpointClient);

  private readonly state = {
    /** The questions and competency as the assistant wrote them so far. */
    proposed: signal<DraftRulesValue>(emptyRules()),
    /** The competency was written by the assistant (not left empty). */
    competencyWritten: signal(false),
    /** The step 3 card is on the page: the competency list is read. */
    listShown: signal(false),
  };

  private readonly competenciesData = serverData(
    () =>
      this.client.call(assessmentV1Endpoints.competencies, {
        query: { status: 'ACTIVE' },
      }),
    { params: () => (this.state.listShown() ? true : undefined) },
  );

  /** What the step 3 card's form starts from, and is replaced by on each write. */
  readonly proposed$ = this.state.proposed.asReadonly();
  /** The competencies a question may be tagged with, the list the server picks from. */
  readonly competencies$ = computed(() => this.competenciesData.value() ?? []);

  private setProposed(proposed: DraftRulesValue): void {
    this.state.proposed.set(proposed);
  }

  private setCompetencyWritten(written: boolean): void {
    this.state.competencyWritten.set(written);
  }

  private setListShown(shown: boolean): void {
    this.state.listShown.set(shown);
  }

  /** The step 3 card shows: the competency list is read once. */
  showList(): void {
    this.setListShown(true);
  }

  /** One write of the assistant: the competency, or the questions so far. */
  write(patch: RulesPatch): void {
    this.setProposed(patch.rules(this.state.proposed()));
    if (patch.field === 'competencyId') this.setCompetencyWritten(true);
  }

  /** The step is confirmed (the questions are the course's exam now) or proposed again. */
  clear(): void {
    this.setProposed(emptyRules());
    this.setCompetencyWritten(false);
  }

  /** The competency of `value` still holds what the assistant picked. */
  competencyMarked(value: DraftRulesValue): boolean {
    return (
      this.state.competencyWritten() &&
      value.competencyId === this.state.proposed().competencyId
    );
  }

  /** The keys of the questions of `value` the author has not changed since the assistant wrote them. */
  questionMarks(value: DraftRulesValue): ReadonlySet<string> {
    const written = new Map(
      this.state
        .proposed()
        .questions.map((question) => [question.key, JSON.stringify(question)]),
    );
    return new Set(
      value.questions
        .filter(
          (question) => written.get(question.key) === JSON.stringify(question),
        )
        .map((question) => question.key),
    );
  }
}
