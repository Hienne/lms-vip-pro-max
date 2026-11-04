import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button } from '@lms/ui';
import { APP_CONFIG } from '../../../core/config/app-config';
import { SessionStore } from '../../../core/session/session.store';

/**
 * The page of a function whose screen is not built yet, so every sidebar link lands somewhere.
 * The sidebar marks these entries "Sắp ra mắt". It is titled with the route's title; development
 * and staging builds also link to the migration board, which production users never see.
 */
@Component({
  selector: 'app-route-placeholder',
  imports: [Button, RouterLink],
  templateUrl: './route-placeholder.html',
  styleUrl: './route-placeholder.scss',
})
export class RoutePlaceholder {
  protected readonly title = inject(ActivatedRoute).snapshot.title ?? '';
  protected readonly showBoard = inject(APP_CONFIG).devTools;
  private readonly session = inject(SessionStore);
  protected readonly homePath = () => this.session.homePath$() ?? '/';
}
