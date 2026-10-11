import { Component, computed, input } from '@angular/core';
import {
  DESIGN_SYSTEM_SECTIONS,
  sectionDomId,
  sectionHeadingId,
  type DesignSystemSectionId,
} from '../../../data-access/design-system-sections';

/** Frame of one catalogue section: eyebrow number, focusable heading and a projected body. */
@Component({
  selector: 'app-ds-section',
  templateUrl: './section.html',
})
export class DsSection {
  readonly section = input.required<DesignSystemSectionId>();
  readonly title = input.required<string>();
  readonly description = input('');

  protected readonly domId = computed(() => sectionDomId(this.section()));
  protected readonly headingId = computed(() =>
    sectionHeadingId(this.section()),
  );
  protected readonly number = computed(
    () => DESIGN_SYSTEM_SECTIONS.find((s) => s.id === this.section())?.number,
  );
}
