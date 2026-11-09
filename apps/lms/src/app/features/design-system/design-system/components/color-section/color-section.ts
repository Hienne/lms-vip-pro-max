import {
  afterRenderEffect,
  Component,
  DOCUMENT,
  inject,
  untracked,
} from '@angular/core';
import { Badge, Card, CardHeader, Icon, Table, TableWrap } from '@lms/ui';
import { ThemeStore } from '../../../../../core/theme/theme.store';
import { DsSection } from '../section/section';
import { ColorSectionStore } from './data-access/color-section.store';

@Component({
  selector: 'app-color-section',
  imports: [DsSection, Card, CardHeader, Badge, Icon, Table, TableWrap],
  providers: [ColorSectionStore],
  templateUrl: './color-section.html',
  styleUrl: './color-section.scss',
})
export class ColorSection {
  protected readonly store = inject(ColorSectionStore);
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeStore);

  constructor() {
    afterRenderEffect(() => {
      // Read again whenever the effective theme changes: the tokens change value
      // with them.
      this.theme.effective$();
      untracked(() => this.readTokens());
    });
  }

  private readTokens(): void {
    const view = this.document.defaultView;
    if (view) {
      this.store.readTokens(
        view.getComputedStyle(this.document.documentElement),
      );
    }
  }
}
