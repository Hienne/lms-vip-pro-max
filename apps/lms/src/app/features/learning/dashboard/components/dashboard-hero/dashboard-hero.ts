import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, Icon, Mai } from '@lms/ui';
import type { LearningDashboard } from '@lms/contracts';
@Component({
  selector: 'app-dashboard-hero',
  imports: [RouterLink, Button, Icon, Mai],
  templateUrl: './dashboard-hero.html',
  styleUrl: './dashboard-hero.scss',
})
export class DashboardHero {
  readonly dashboard = input.required<LearningDashboard>();
  readonly firstName = input.required<string>();
  readonly date = input.required<string>();
  readonly greeting = input.required<string>();
}
