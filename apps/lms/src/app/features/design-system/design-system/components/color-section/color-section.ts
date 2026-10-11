import { DOCUMENT } from '@angular/common';
import { afterRenderEffect, Component, inject } from '@angular/core';
import { DsSection } from '../section/section';
import { ColorSectionStore } from './data-access/color-section.store';

@Component({
  selector: 'app-color-section',
  imports: [DsSection],
  providers: [ColorSectionStore],
  templateUrl: './color-section.html',
  styleUrl: './color-section.scss',
})
export class ColorSection {
  protected readonly store = inject(ColorSectionStore);
  private readonly document = inject(DOCUMENT);

  constructor() {
    afterRenderEffect(() => {
      const view = this.document.defaultView;
      if (view) {
        this.store.readTokens(
          view.getComputedStyle(this.document.documentElement),
        );
      }
    });
  }
}
