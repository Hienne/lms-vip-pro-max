import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  ErrorState,
  FmtDatetimePipe,
  FmtScorePipe,
  Icon,
  IconButton,
  LinkButton,
  PageHeader,
  Segmented,
  type SegmentedOption,
  Skeleton,
  Stat,
  StatStrip,
  Table,
  TableWrap,
} from '@lms/ui';
import {
  ATTEMPTS_PER_QUIZ,
  QUIZ_FILTERS,
  type QuizFilter,
  QuizHubStore,
} from './data-access/quiz-hub.store';

const FILTER_LABELS: Record<QuizFilter, string> = {
  all: 'Tất cả',
  open: 'Còn thi được',
  passed: 'Đã đạt',
  failed: 'Chưa đạt',
};

/**
 * The quiz hub (`/quiz`): every quiz of the courses the learner is in the middle of and every quiz
 * they have attempts on, as a list on the left; the selected quiz's figures, its next action and its
 * attempts on the right. The filter (`?loc=`) and the selected quiz (`?bai=`) live in the URL, so a
 * reload or a shared link opens the same view. The mockup has no hub; this is the menu's landing page.
 */
@Component({
  selector: 'app-quiz-hub',
  imports: [
    Alert,
    Badge,
    Button,
    Card,
    Empty,
    ErrorState,
    FmtDatetimePipe,
    FmtScorePipe,
    Icon,
    IconButton,
    LinkButton,
    PageHeader,
    RouterLink,
    Segmented,
    Skeleton,
    Stat,
    StatStrip,
    Table,
    TableWrap,
  ],
  providers: [QuizHubStore],
  templateUrl: './quiz-hub.html',
  styleUrl: './quiz-hub.scss',
})
export class QuizHub {
  protected readonly store = inject(QuizHubStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly perQuiz = ATTEMPTS_PER_QUIZ;

  private readonly params = toSignal(this.route.queryParamMap, {
    requireSync: true,
  });

  protected readonly filter = computed((): QuizFilter => {
    const value = this.params().get('loc');
    return (QUIZ_FILTERS as readonly string[]).includes(value ?? '')
      ? (value as QuizFilter)
      : 'all';
  });

  protected readonly filterOptions = computed(
    (): readonly SegmentedOption<QuizFilter>[] =>
      QUIZ_FILTERS.map((value) => ({
        value,
        label: `${FILTER_LABELS[value]} (${this.store.filterCounts$()[value]})`,
      })),
  );

  protected readonly visible = computed(() =>
    this.store.filtered(this.filter()),
  );

  /** The quiz named in the URL when the filter keeps it, else the first one listed. */
  protected readonly selected = computed(() => {
    const visible = this.visible();
    const id = Number(this.params().get('bai'));
    return visible.find((entry) => entry.quizId === id) ?? visible[0];
  });

  protected readonly shownAttempts = computed(
    () => this.selected()?.attempts.slice(0, ATTEMPTS_PER_QUIZ) ?? [],
  );

  protected setFilter(filter: QuizFilter): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { loc: filter === 'all' ? null : filter, bai: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Query params that select a quiz while keeping the filter. */
  protected selectParams(quizId: number): Record<string, string> {
    const filter = this.filter();
    return filter === 'all'
      ? { bai: String(quizId) }
      : { loc: filter, bai: String(quizId) };
  }
}
