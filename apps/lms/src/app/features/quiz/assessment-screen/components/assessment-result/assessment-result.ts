import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  Icon,
  Mai,
  OptionCard,
  Progress,
} from '@lms/ui';
import type { AttemptResult } from '@lms/contracts';
@Component({
  selector: 'app-assessment-result',
  imports: [
    DatePipe,
    RouterLink,
    Alert,
    Badge,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    CardHeader,
    Icon,
    Mai,
    OptionCard,
    Progress,
  ],
  templateUrl: './assessment-result.html',
  styleUrl: './assessment-result.scss',
})
export class AssessmentResult {
  readonly data = input.required<AttemptResult | undefined | null>();
  readonly reviewOpen = input(false);
  readonly reviewOpenChange = output<boolean>();
}
