import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  AccessRequest,
  AccessRequestKind,
  AccessRequestStatus,
} from '@lms/contracts';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  DataTableCell,
  Empty,
  ErrorState,
  FmtDatetimePipe,
  FmtRelativePipe,
  Search,
  Select,
  Spinner,
  TablePrimary,
  TableSub,
} from '@lms/ui';
import type { StatusView } from '../../../../../shared/status/status-view';
import {
  ACCESS_REQUESTS_PAGE_SIZE,
  AccessRequestsStore,
} from '../../data-access/access-requests.store';
import { askApproval } from './approve-request-dialog';
import { askRejectionNote } from './reject-request-dialog';

/** A table row: the table wants an `id`, the request's own key is `requestId`. */
export type AccessRequestRow = AccessRequest & { readonly id: number };

const KIND_LABEL: Record<AccessRequestKind, string> = {
  REGISTER: 'Đăng ký',
  PASSWORD_RESET: 'Quên mật khẩu',
};

/** Pending needs an administrator; approved is done; a refusal is a result, not a fault. */
const STATUS_VIEW: Record<AccessRequestStatus, StatusView> = {
  PENDING: { label: 'Chờ xử lý', tone: 'warning', dot: true },
  APPROVED: { label: 'Đã duyệt', tone: 'success', dot: true },
  REJECTED: { label: 'Đã từ chối', tone: 'neutral', dot: true },
};

/**
 * The "Yêu cầu" panel of the Người dùng screen: the table of visitors' requests to register or to
 * reset a password (SPEC-access-requests). A pending registration can be approved or rejected; the
 * primary action of a reset request ("Đặt lại mật khẩu") belongs to its own module.
 */
@Component({
  selector: 'app-access-requests',
  imports: [
    Badge,
    Button,
    Card,
    CardHeader,
    DataTable,
    DataTableCell,
    Empty,
    ErrorState,
    FmtDatetimePipe,
    FmtRelativePipe,
    Search,
    Select,
    Spinner,
    TablePrimary,
    TableSub,
  ],
  templateUrl: './access-requests.html',
  styleUrl: './access-requests.scss',
})
export class AccessRequests {
  protected readonly store = inject(AccessRequestsStore);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly pageSize = ACCESS_REQUESTS_PAGE_SIZE;

  protected readonly rows = computed((): readonly AccessRequestRow[] =>
    this.store
      .rows$()
      .map((request) => ({ ...request, id: request.requestId })),
  );

  protected reject(request: AccessRequest): void {
    askRejectionNote(this.dialog, request.fullName || request.staffCode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((note) => this.store.reject(request.requestId, note));
  }

  protected approve(request: AccessRequest): void {
    askApproval(this.dialog, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((note) => this.store.approve(request.requestId, note));
  }

  protected kindLabel(kind: AccessRequestKind): string {
    return KIND_LABEL[kind];
  }

  protected statusView(status: AccessRequestStatus): StatusView {
    return STATUS_VIEW[status];
  }

  constructor() {
    // The list is read only while this panel exists.
    this.store.showList();
    inject(DestroyRef).onDestroy(() => this.store.hideList());
  }
}
