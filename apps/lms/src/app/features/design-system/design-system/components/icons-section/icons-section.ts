import { Component } from '@angular/core';
import { ICON_CATALOG, Icon } from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';

@Component({
  selector: 'app-icons-section',
  imports: [DsSection, DsDemo, Icon],
  templateUrl: './icons-section.html',
  styleUrl: './icons-section.scss',
})
export class IconsSection {
  protected readonly icons = ICON_CATALOG;
}
