import { Component } from '@angular/core';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-icons-section',
  imports: [DsSection, DsDemo],
  templateUrl: './icons-section.html',
})
export class IconsSection {}
