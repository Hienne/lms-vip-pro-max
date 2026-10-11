import { Component } from '@angular/core';
import { Icon, Mai } from '@lms/ui';

/** Hero panel of the page: the mockup's header with the decorative watermark flower. */
@Component({
  selector: 'app-hero',
  imports: [Icon, Mai],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  protected readonly highlights = [
    'WCAG 2.2 AA',
    'Dark mode',
    'Responsive 375 → 1440',
    'Bàn phím & screen reader',
    'Token-first',
  ];
}
