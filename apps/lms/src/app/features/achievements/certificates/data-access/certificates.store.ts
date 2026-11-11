import { computed, inject, Injectable, signal } from '@angular/core';
import { certificateEndpoints, type Certificate } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import type { CertificateDocument } from '../../certificate-sheet/certificate-sheet';

/** The most certificates the server sends in one page; no learner is near it. */
export const CERTIFICATES_PAGE_SIZE = 100;

/** A row of the list: what to print and where it leads, so the template only prints it. */
export interface CertificateRow extends CertificateDocument {
  readonly id: number;
  readonly code: string;
  readonly link: readonly (string | number)[];
}

const toRow = (certificate: Certificate): CertificateRow => ({
  id: certificate.id,
  fullName: certificate.fullName,
  title: certificate.courseTitle ?? certificate.courseCode,
  code: certificate.courseCode,
  completedAt: certificate.completedAt,
  score: certificate.bestScorePercent,
  verificationCode: certificate.verificationCode,
  link: ['/certificate', certificate.id],
});

/**
 * "Chứng nhận hoàn thành": the caller's completed cycles as the server lists them, newest first, in
 * one page. A certificate exists only when the server returns it; nothing is inferred from progress.
 */
@Injectable()
export class CertificatesStore {
  private readonly client = inject(EndpointClient);

  private readonly state = { search: signal(''), sort: signal('newest') };

  private readonly data = serverData(() =>
    this.client.call(certificateEndpoints.certificates, {
      query: { page: 0, size: CERTIFICATES_PAGE_SIZE },
    }),
  );

  private readonly allRows = computed<readonly CertificateRow[]>(() =>
    (this.data.value()?.items ?? []).map(toRow),
  );
  readonly search$ = this.state.search.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly rows$ = computed(() => {
    const query = this.state.search().trim().toLocaleLowerCase('vi');
    return this.allRows()
      .filter((row) =>
        [row.title, row.code, row.verificationCode]
          .join(' ')
          .toLocaleLowerCase('vi')
          .includes(query),
      )
      .sort(
        (a, b) =>
          (this.state.sort() === 'oldest' ? 1 : -1) *
          a.completedAt.localeCompare(b.completedAt),
      );
  });
  setSearch(value: string): void {
    this.state.search.set(value);
  }
  setSort(value: string): void {
    this.state.sort.set(value);
  }
  readonly isEmpty$ = computed(() => this.data.value()?.totalElements === 0);
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;

  retry(): void {
    this.data.reload();
  }
}
