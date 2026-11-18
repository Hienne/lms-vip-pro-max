import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MyPoints } from '@lms/contracts';
import { Button, Card, Icon, Mai, PageHeader, Progress } from '@lms/ui';
import type { ContinueView } from '../../data-access/learn.store';

@Component({
  selector: 'app-learn-hero',
  imports: [Button, Card, Icon, Mai, PageHeader, Progress, RouterLink],
  templateUrl: './learn-hero.html',
  styleUrl: './learn-hero.scss',
})
export class LearnHero {
  readonly learnerName = input('');
  readonly welcomeBack = input(false);
  readonly resume = input<ContinueView | null>(null);
  readonly resumeLoading = input(false);
  readonly resumeFailed = input(false);
  readonly points = input<MyPoints>();
  readonly pointsFailed = input(false);

  protected readonly greeting = computed(() =>
    this.learnerName() ? 'Xin chào, ' + this.learnerName() : 'Xin chào',
  );

  readonly retryResume = output();
  readonly retryPoints = output();
}
