import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { certificateEndpoints } from '@lms/contracts';
import { map } from 'rxjs';
import { APP_CONFIG } from '../../../../core/config/app-config';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/** The message code the server answers for a certificate that is not the caller's or not earned. */
const NOT_FOUND = 'LEARNING-NOT_FOUND';

/** What the document prints, so the template only lays it out. */
export interface CertificateDocument {
  readonly fullName: string;
  /** The title of the revision the learner finished, or the course code when it has none. */
  readonly title: string;
  /** The course code to show beside the title; null when the title already is the code. */
  readonly code: string | null;
  readonly completedAt: string;
  readonly score: number | null;
  readonly verificationCode: string;
}

/**
 * One certificate of the caller, by the enrollment id in the path. A path that holds no id and an
 * id the server does not know are the same "not found"; the first costs no call. Any other failure
 * keeps its own error so the screen can offer a retry.
 */
@Injectable()
export class CertificateStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);

  /** `undefined` for a path that holds no certificate id. */
  private readonly id$ = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('id'));
        return Number.isInteger(id) && id > 0 ? id : undefined;
      }),
    ),
    { initialValue: undefined },
  );

  private readonly data = serverData(
    (enrollmentId: number) =>
      this.client.call(certificateEndpoints.certificate, {
        params: { enrollmentId },
      }),
    { params: () => this.id$() },
  );

  readonly isMissing$ = computed(
    () =>
      this.id$() === undefined || this.data.error()?.messageCode === NOT_FOUND,
  );
  /** A failure other than "not found". */
  readonly error$ = computed(() =>
    this.isMissing$() ? undefined : this.data.error(),
  );
  readonly isLoading$ = computed(
    () => !this.isMissing$() && this.data.isLoading(),
  );

  readonly document$ = computed<CertificateDocument | undefined>(() => {
    const certificate = this.data.value();
    if (!certificate) return undefined;
    const title = certificate.courseTitle ?? certificate.courseCode;
    return {
      fullName: certificate.fullName,
      title,
      code: title === certificate.courseCode ? null : certificate.courseCode,
      completedAt: certificate.completedAt,
      score: certificate.bestScorePercent,
      verificationCode: certificate.verificationCode,
    };
  });
  /** The last crumb and the page title; the course code while the title is unknown. */
  readonly title$ = computed(() => this.document$()?.title);

  /** The mock backend answers with made-up data, which the document says. */
  readonly isDemo = inject(APP_CONFIG).mockBackend;

  retry(): void {
    this.data.reload();
  }
}
