import { computed, inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { personalEndpoints } from '@lms/contracts';
import { FileSaver } from '../../../../core/files/file-saver';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
@Injectable()
export class CertificatesStore {
  private readonly client = inject(EndpointClient);
  private readonly saver = inject(FileSaver);
  private readonly router = inject(ActivatedRoute);
  private readonly nav = inject(Router);
  private readonly certificateId = toSignal(this.router.paramMap);
  private readonly list = serverData(() =>
    this.client.call(personalEndpoints.certificates, {
      query: { page: 0, size: 100, sort: 'completedAt,desc' },
    }),
  );
  private readonly detail = serverData(
    (id: string) =>
      this.client.call(personalEndpoints.certificate, {
        params: { certificateId: id },
      }),
    { params: () => this.certificateId()?.get('id') ?? undefined },
  );
  private readonly downloadMutation = serverMutation(
    (id: string) =>
      this.client.call(personalEndpoints.downloadCertificate, {
        params: { certificateId: id },
      }),
    {
      errors: 'toast',
      success: () => 'Đã tải chứng nhận mẫu',
      onSuccess: (blob) =>
        this.saver.save(
          blob,
          this.detail.value()?.fileName ??
            this.items$().find(
              (item) => item.id === this.certificateId()?.get('id'),
            )?.fileName ??
            'chung-nhan.pdf',
        ),
    },
  );
  readonly list$ = this.list.value;
  readonly detail$ = this.detail.value;
  readonly items$ = computed(() => this.list.value()?.items ?? []);
  readonly isLoading$ = computed(() =>
    this.certificateId()?.has('id')
      ? this.detail.isLoading()
      : this.list.isLoading(),
  );
  readonly error$ = computed(() =>
    this.certificateId()?.has('id') ? this.detail.error() : this.list.error(),
  );
  readonly isDownloading$ = this.downloadMutation.isPending;
  retry(): void {
    if (this.certificateId()?.has('id')) this.detail.reload();
    else this.list.reload();
  }
  open(id: string): void {
    void this.nav.navigate(['/certificate', id]);
  }
  download(id: string): void {
    this.downloadMutation.run(id);
  }
}
