import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-forms-section',
  imports: [DsSection, DsDemo],
  templateUrl: './forms-section.html',
})
export class FormsSection {}
