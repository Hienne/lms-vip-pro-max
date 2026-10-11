import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DESIGN_SYSTEM_SECTIONS,
  sectionDomId,
  sectionHeadingId,
  type DesignSystemSectionId,
} from '../data-access/design-system-sections';
import { ColorSection } from './components/color-section/color-section';

const MAIN_ID = 'ds-main';

@Component({
  selector: 'app-design-system',
  imports: [RouterLink, ColorSection],
  templateUrl: './design-system.html',
  styleUrl: './design-system.scss',
})
export class DesignSystem {
  private readonly document = inject(DOCUMENT);

  protected readonly mainId = MAIN_ID;
  protected readonly tocItems = DESIGN_SYSTEM_SECTIONS.map((section) => ({
    ...section,
    domId: sectionDomId(section.id),
  }));

  /** The router scrolls to the fragment; focus follows so keyboard and screen-reader users land on the heading. */
  protected focusHeading(id: DesignSystemSectionId): void {
    this.focus(sectionHeadingId(id));
  }

  protected focusMain(): void {
    this.focus(MAIN_ID);
  }

  private focus(elementId: string): void {
    this.document.getElementById(elementId)?.focus({ preventScroll: true });
  }
}
