import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Button,
  Empty,
  ErrorState,
  PageHeader,
  SectionCard,
  Skeleton,
} from '@lms/ui';
import { ConsentStore } from './data-access/consent.store';

/**
 * `/tro-ly-ngoai/cho-phep`: Cho phép kết nối (ADR 0005). A Trợ lý ngoài's sign-in lands here after
 * the user signs in; the page says who asks, for which account, what it may do and for how long,
 * and the user allows or refuses. Every new connection is asked for here.
 */
@Component({
  selector: 'app-external-assistant-consent',
  imports: [
    Alert,
    Button,
    Empty,
    ErrorState,
    PageHeader,
    RouterLink,
    SectionCard,
    Skeleton,
  ],
  providers: [ConsentStore],
  templateUrl: './consent.html',
  styleUrl: './consent.scss',
})
export class Consent {
  protected readonly store = inject(ConsentStore);
}
