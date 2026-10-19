import { Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Mai } from '@lms/ui';
import {
  DESIGN_SYSTEM_SECTIONS,
  sectionDomId,
  sectionHeadingId,
  type DesignSystemSectionId,
} from '../data-access/design-system-sections';
import { ThemeSwitch } from './components/theme-switch/theme-switch';
import { Hero } from './components/hero/hero';
import { PrinciplesSection } from './components/principles-section/principles-section';
import { ColorSection } from './components/color-section/color-section';
import { TypeSection } from './components/type-section/type-section';
import { SpaceSection } from './components/space-section/space-section';
import { IconsSection } from './components/icons-section/icons-section';
import { ButtonsSection } from './components/buttons-section/buttons-section';
import { FormsSection } from './components/forms-section/forms-section';
import { StatusSection } from './components/status-section/status-section';
import { DataSection } from './components/data-section/data-section';
import { NavSection } from './components/nav-section/nav-section';
import { FeedbackSection } from './components/feedback-section/feedback-section';
import { LearningSection } from './components/learning-section/learning-section';
import { ChartsSection } from './components/charts-section/charts-section';

const MAIN_ID = 'ds-main';

@Component({
  selector: 'app-design-system',
  imports: [
    RouterLink,
    Mai,
    Hero,
    ThemeSwitch,
    PrinciplesSection,
    ColorSection,
    TypeSection,
    SpaceSection,
    IconsSection,
    ButtonsSection,
    FormsSection,
    StatusSection,
    DataSection,
    NavSection,
    FeedbackSection,
    LearningSection,
    ChartsSection,
  ],
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
