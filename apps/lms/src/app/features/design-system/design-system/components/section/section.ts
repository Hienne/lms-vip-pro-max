import { Component, computed, input } from '@angular/core';
import {
  sectionDomId,
  sectionHeadingId,
  type DesignSystemSectionId,
} from '../../../data-access/design-system-sections';

/** Frame of one catalogue section: focusable heading, optional description and a projected body. */
@Component({
  selector: 'app-ds-section',
  templateUrl: './section.html',
  styleUrl: './section.scss',
})
export class DsSection {
  readonly section = input.required<DesignSystemSectionId>();
  readonly title = input.required<string>();
  readonly description = input('');

  protected readonly domId = computed(() => sectionDomId(this.section()));
  protected readonly headingId = computed(() =>
    sectionHeadingId(this.section()),
  );
}
