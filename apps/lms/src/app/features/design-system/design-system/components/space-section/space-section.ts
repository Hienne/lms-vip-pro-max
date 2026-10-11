import { Component, inject } from '@angular/core';
import { DsSection } from '../section/section';
import { SpaceSectionStore } from './data-access/space-section.store';

/** Spacing steps of the theme; the bar width classes are written out so Tailwind finds them. */
const SPACING_STEPS = [
  { step: 1, bar: 'w-1' },
  { step: 2, bar: 'w-2' },
  { step: 3, bar: 'w-3' },
  { step: 4, bar: 'w-4' },
  { step: 6, bar: 'w-6' },
  { step: 8, bar: 'w-8' },
  { step: 12, bar: 'w-12' },
] as const;

const RADII = [
  { name: 'sm', classes: 'rounded-sm' },
  { name: 'md', classes: 'rounded-md' },
  { name: 'lg', classes: 'rounded-lg' },
  { name: 'xl', classes: 'rounded-xl' },
] as const;

const SHADOWS = [
  { name: 'sm', classes: 'shadow-sm' },
  { name: 'md', classes: 'shadow-md' },
  { name: 'lg', classes: 'shadow-lg' },
] as const;

@Component({
  selector: 'app-space-section',
  imports: [DsSection],
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
