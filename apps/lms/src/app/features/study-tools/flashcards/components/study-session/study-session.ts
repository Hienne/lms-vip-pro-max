import {
  effect,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  Button,
  ErrorState,
  Icon,
  PageHeader,
  Progress,
  SectionCard,
  Stat,
  StatStrip,
} from '@lms/ui';
import type { AppError } from '../../../../../core/errors/app-error';

/** One accessible study surface for both personal and course cards. Server state belongs to the caller. */
@Component({
  selector: 'app-flashcard-study',
  imports: [
    Button,
    ErrorState,
    Icon,
    PageHeader,
    Progress,
    SectionCard,
    Stat,
    StatStrip,
  ],
  templateUrl: './study-session.html',
  styleUrl: './study-session.scss',
})
export class StudySession {
  readonly name = input.required<string>();
  readonly total = input.required<number>();
  readonly index = input(0);
  readonly completed = input(0);
  readonly known = input(0);
  readonly again = input(0);
  readonly hasCurrent = input(true);
  readonly question = input('');
  readonly answers = input<readonly string[]>([]);
  readonly explanation = input('');
  readonly revealed = input(false);
  readonly answerLoading = input(false);
  readonly answerError = input<AppError>();
  readonly busy = input(false);
  readonly starred = input(false);
  readonly answerRequested = output<void>();
  readonly rated = output<'AGAIN' | 'KNOWN'>();
  readonly starToggled = output<void>();
  readonly finished = output<void>();
  readonly restarted = output<void>();
  readonly retryAnswer = output<void>();
  protected readonly percent = computed(() =>
    this.total() > 0
      ? (Math.min(this.completed(), this.total()) / this.total()) * 100
      : 0,
  );
  private readonly face = viewChild<ElementRef<HTMLElement>>('face');
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');
  constructor() {
    // A new card or the summary receives focus after its view query becomes available.
    effect(() => {
      this.index();
      const target = this.hasCurrent() ? this.face() : this.summary();
      target?.nativeElement.focus();
    });
  }
}
