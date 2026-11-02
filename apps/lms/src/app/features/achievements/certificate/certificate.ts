import { Component, computed, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Breadcrumb,
  Button,
  Empty,
  ErrorState,
  FmtDatePipe,
  FmtPctPipe,
  Icon,
  Mai,
  PageHeader,
  Skeleton,
  type BreadcrumbItem,
} from '@lms/ui';
import { CertificateStore } from './data-access/certificate.store';

/** One certificate as a printable document (the mockup's `certificate` page). */
@Component({
  selector: 'app-certificate',
  imports: [
    Breadcrumb,
    Button,
    Empty,
    ErrorState,
    FmtDatePipe,
    FmtPctPipe,
    Icon,
    Mai,
    PageHeader,
    RouterLink,
    Skeleton,
  ],
  providers: [CertificateStore],
  templateUrl: './certificate.html',
  styleUrl: './certificate.scss',
})
export class Certificate {
  protected readonly store = inject(CertificateStore);
  private readonly document = inject(DOCUMENT);

  protected readonly crumbs = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Chứng nhận', href: '/certificates' },
    { label: this.store.title$() ?? '' },
  ]);

  /** Opens the browser's print dialog, which also saves a PDF. */
  protected print(): void {
    this.document.defaultView?.print();
  }
}
