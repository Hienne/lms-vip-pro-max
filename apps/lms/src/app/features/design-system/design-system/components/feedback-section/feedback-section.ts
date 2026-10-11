import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-feedback-section',
  imports: [DsSection, DsDemo],
  templateUrl: './feedback-section.html',
})
export class FeedbackSection {}
