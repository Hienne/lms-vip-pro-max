import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-learning-section',
  imports: [DsSection, DsDemo],
  templateUrl: './learning-section.html',
})
export class LearningSection {}
