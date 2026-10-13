import { Component, inject } from '@angular/core';
import { Button, Card } from '@lms/ui';
import { DsSection } from '../section/section';
import { SpaceSectionStore } from './data-access/space-section.store';

/**
 * Samples of the theme's spacing steps, radii and shadows. Each carries a BEM modifier; the
 * stylesheet generates one modifier per token with `@each`, so a name here must be a token key.
 */
const SPACING_STEPS = [1, 2, 3, 4, 6, 8, 12].map((step) => ({
  step,
  bar: `step__bar--${step}`,
}));

const RADII = ['sm', 'md', 'lg', 'xl'].map((name) => ({
  name,
  modifier: `radius-sample--${name}`,
}));

const SHADOWS = ['sm', 'md', 'lg'].map((name) => ({
  name,
  modifier: `shadow-sample--${name}`,
}));

@Component({
  selector: 'app-space-section',
  imports: [DsSection, Card, Button],
  providers: [SpaceSectionStore],
  templateUrl: './space-section.html',
  styleUrl: './space-section.scss',
})
export class SpaceSection {
  protected readonly store = inject(SpaceSectionStore);
  protected readonly steps = SPACING_STEPS;
  protected readonly radii = RADII;
  protected readonly shadows = SHADOWS;
}
