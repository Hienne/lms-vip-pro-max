import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-charts-section',
  imports: [DsSection, DsDemo],
  templateUrl: './charts-section.html',
})
export class ChartsSection {}
