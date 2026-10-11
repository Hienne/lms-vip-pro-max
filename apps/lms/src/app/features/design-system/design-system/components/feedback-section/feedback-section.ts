import { Component } from '@angular/core';
import { Skeleton, Spinner } from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-feedback-section',
  imports: [DsSection, DsDemo, Skeleton, Spinner],
  templateUrl: './feedback-section.html',
  styleUrl: './feedback-section.scss',
})
export class FeedbackSection {}
