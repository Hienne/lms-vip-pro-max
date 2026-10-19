import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button, Card, Empty, ErrorState, PageHeader, Spinner } from '@lms/ui';
import { CertificatesStore } from './data-access/certificates.store';
@Component({
  selector: 'app-certificates',
  imports: [
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
}
@Component({
  selector: 'app-certificate-detail',
  imports: [
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
}
