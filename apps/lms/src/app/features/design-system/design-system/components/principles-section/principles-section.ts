import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-principles-section',
  imports: [DsSection, DsDemo],
  templateUrl: './principles-section.html',
})
export class PrinciplesSection {}
