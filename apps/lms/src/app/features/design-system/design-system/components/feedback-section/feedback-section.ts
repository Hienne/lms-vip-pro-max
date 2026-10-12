import { Component } from '@angular/core';
import { Button, Card, Empty, ErrorState, Skeleton, Spinner } from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-feedback-section',
  imports: [
    DsSection,
    DsDemo,
    Button,
    Card,
    Empty,
    ErrorState,
    Skeleton,
    Spinner,
  ],
  templateUrl: './feedback-section.html',
  styleUrl: './feedback-section.scss',
})
export class FeedbackSection {}
