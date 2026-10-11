import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-type-section',
  imports: [DsSection, DsDemo],
  templateUrl: './type-section.html',
})
export class TypeSection {}
