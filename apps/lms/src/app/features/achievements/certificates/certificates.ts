import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Button,
  Search,
  Select,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtPctPipe,
  PageHeader,
  Skeleton,
} from '@lms/ui';
import { CertificatesStore } from './data-access/certificates.store';

/** The learner's certificates, one row per completed course cycle (the mockup's `certificates` page). */
@Component({
  selector: 'app-certificates',
  imports: [
    Button,

    Search,
    Select,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtPctPipe,
    PageHeader,
    RouterLink,
    Skeleton,
  ],
  providers: [CertificatesStore],
  templateUrl: './certificates.html',
  styleUrl: './certificates.scss',
})
export class Certificates {
  protected readonly store = inject(CertificatesStore);
}
