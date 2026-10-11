import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-nav-section',
  imports: [DsSection, DsDemo],
  templateUrl: './nav-section.html',
})
export class NavSection {}
