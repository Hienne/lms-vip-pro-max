import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button, Empty, Icon } from '@lms/ui';
import { APP_CONFIG } from '../../../core/config/app-config';

/**
 * Stands in for a mockup route whose screen is not migrated yet, so every sidebar link lands
 * somewhere. The route's `data.mockupPage` names the mockup page it will become; development and
 * staging builds link to the migration board.
 */
@Component({
  selector: 'app-route-placeholder',
  imports: [Empty, Button, Icon, RouterLink],
  templateUrl: './route-placeholder.html',
  styleUrl: './route-placeholder.scss',
})
export class RoutePlaceholder {
  protected readonly mockupPage = String(
    inject(ActivatedRoute).snapshot.data['mockupPage'] ?? '',
  );
  protected readonly showBoard = inject(APP_CONFIG).devTools;
}
