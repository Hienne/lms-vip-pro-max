import { computed, inject, Injectable } from '@angular/core';
import { certificateEndpoints, type Certificate } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/** The most certificates the server sends in one page; no learner is near it. */
export const CERTIFICATES_PAGE_SIZE = 100;

/** A row of the list: what to print and where it leads, so the template only prints it. */
export interface CertificateRow {
  readonly id: number;
  /** The title of the revision the learner finished, or the course code when it has none. */
  readonly title: string;
  readonly code: string;
  readonly completedAt: string;
  readonly score: number | null;
  readonly verificationCode: string;
  readonly link: readonly (string | number)[];
}

const toRow = (certificate: Certificate): CertificateRow => ({
  id: certificate.id,
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

  private readonly data = serverData(() =>
    this.client.call(certificateEndpoints.certificates, {
      query: { page: 0, size: CERTIFICATES_PAGE_SIZE },
    }),
  );

  readonly rows$ = computed<readonly CertificateRow[]>(() =>
    (this.data.value()?.items ?? []).map(toRow),
  );
  readonly isEmpty$ = computed(() => this.data.value()?.totalElements === 0);
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;

  retry(): void {
    this.data.reload();
  }
}
