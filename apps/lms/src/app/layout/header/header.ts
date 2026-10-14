import { Component, input, output } from '@angular/core';
import { Icon, IconButton } from '@lms/ui';

/**
 * The page header (the mockup's `.header`). Below the `lg` breakpoint it carries the button that
 * opens the navigation drawer; the shell passes in whether that drawer is open.
 */
@Component({
  selector: 'app-header',
  imports: [Icon, IconButton],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  readonly navOpen = input(false);
  readonly menu = output<void>();
}
