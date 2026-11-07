import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MyPoints } from '@lms/contracts';
import { Button, Icon, Mai } from '@lms/ui';
import type { ContinueView } from '../../data-access/learn.store';

/**
 * The top of the learner's home (the mockup's hero): the date, a greeting by given name, the one
 * thing that needs attention first, the lesson to resume with one button, and the points figure
 * linking to the leaderboard. It renders what the store gives it and reads nothing itself.
 */
@Component({
  selector: 'app-learn-hero',
  imports: [Button, Icon, Mai, RouterLink],
  templateUrl: './learn-hero.html',
  styleUrl: './learn-hero.scss',
})
export class LearnHero {
  readonly today = input.required<string>();
  readonly givenName = input('');
  readonly headline = input('');
  readonly resume = input<ContinueView | null>(null);
  readonly resumeLoading = input(false);
  readonly resumeFailed = input(false);
  readonly points = input<MyPoints>();
  readonly pointsFailed = input(false);

  protected readonly greeting = computed(
    () => `Chào ${this.givenName() || 'bạn'}, hôm nay học gì tiếp nhỉ?`,
  );

  readonly retryResume = output();
  readonly retryPoints = output();
}
