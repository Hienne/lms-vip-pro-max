import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-status-section',
  imports: [DsSection, DsDemo],
  templateUrl: './status-section.html',
})
export class StatusSection {}
