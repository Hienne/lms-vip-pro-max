import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-buttons-section',
  imports: [DsSection, DsDemo],
  templateUrl: './buttons-section.html',
})
export class ButtonsSection {}
