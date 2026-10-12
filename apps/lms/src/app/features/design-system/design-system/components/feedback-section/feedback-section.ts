import { Component } from '@angular/core';
import { Alert, AlertAction, Button, Skeleton, Spinner, Tip } from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-feedback-section',
  imports: [
    DsSection,
    DsDemo,
    Alert,
    AlertAction,
    Button,
    Skeleton,
    Spinner,
    Tip,
  ],
  templateUrl: './feedback-section.html',
  styleUrl: './feedback-section.scss',
})
export class FeedbackSection {}
