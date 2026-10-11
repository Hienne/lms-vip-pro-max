import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-data-section',
  imports: [DsSection, DsDemo],
  templateUrl: './data-section.html',
})
export class DataSection {}
