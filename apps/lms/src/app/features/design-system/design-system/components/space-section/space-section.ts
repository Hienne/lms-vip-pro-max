import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-space-section',
  imports: [DsSection, DsDemo],
  templateUrl: './space-section.html',
})
export class SpaceSection {}
