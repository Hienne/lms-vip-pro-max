import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Empty,
  ErrorState,
  Icon,
  Mai,
  PageHeader,
  Spinner,
} from '@lms/ui';
import { CertificatesStore } from './data-access/certificates.store';
@Component({
  selector: 'app-certificates',
  imports: [
    Badge,
    Breadcrumb,
    Icon,
    Mai,
    DatePipe,
    RouterLink,
    Button,
    Card,
    Empty,
    ErrorState,
    PageHeader,
    Spinner,
  ],
  providers: [CertificatesStore],
  templateUrl: './certificates.html',
  styleUrl: './certificates.scss',
})
export class Certificates {
  protected readonly store = inject(CertificatesStore);
  protected print(): void {
    window.print();
  }
}
@Component({
  selector: 'app-certificate-detail',
  imports: [
    Badge,
    Breadcrumb,
    Icon,
    Mai,
    DatePipe,
    RouterLink,
    Button,
    Card,
    Empty,
    ErrorState,
    PageHeader,
    Spinner,
  ],
  providers: [CertificatesStore],
  templateUrl: './certificates.html',
  styleUrl: './certificates.scss',
})
export class CertificateDetail {
  protected readonly store = inject(CertificatesStore);
  protected print(): void {
    window.print();
  }
}
