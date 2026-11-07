import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MyPoints } from '@lms/contracts';
import { Button, Card, Icon, Mai, PageHeader, Progress } from '@lms/ui';
import type { ContinueView } from '../../data-access/learn.store';

/**
 * The top of the learner's home: the shared page header (title, today's date and the one thing that
 * needs attention first), the points figure linking to the leaderboard, and a card with the lesson to
 * resume, its course progress and one button. It renders what the store gives it and reads
 * nothing itself.
 */
@Component({
  selector: 'app-learn-hero',
  imports: [Button, Card, Icon, Mai, PageHeader, Progress, RouterLink],
  templateUrl: './learn-hero.html',
  styleUrl: './learn-hero.scss',
})
export class LearnHero {
  readonly today = input.required<string>();
  readonly headline = input('');
  readonly resume = input<ContinueView | null>(null);
  readonly resumeLoading = input(false);
  readonly resumeFailed = input(false);
  readonly points = input<MyPoints>();
  readonly pointsFailed = input(false);

  /** The header's description: today's date, then what needs attention first. */
  protected readonly summary = computed(() =>
    [this.today(), this.headline()].filter(Boolean).join(' · '),
  );

  readonly retryResume = output();
  readonly retryPoints = output();
}
