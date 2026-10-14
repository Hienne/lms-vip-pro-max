import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Button, Empty, Icon } from '@lms/ui';
import { ForbiddenStateSchema } from '../../../core/routing/forbidden-state';
import { roleLabel } from '../../../shared/status/role-badge';

const FALLBACK_REASON = 'Chức năng này không thuộc vai trò của bạn.';

/**
 * The 403 page (the mockup's `forbidden`). The role guard passes the requested path and the roles
 * that may enter in navigation state; without it (a direct visit or a reload that lost it) the
 * page falls back to the generic reason.
 */
@Component({
  selector: 'app-forbidden',
  imports: [Empty, Button, Icon, RouterLink],
  templateUrl: './forbidden.html',
  styleUrl: './forbidden.scss',
})
export class Forbidden {
  private readonly location = inject(Location);

  protected readonly description = `${reasonFrom(inject(Router))} Nếu cần quyền, hãy liên hệ quản trị viên đơn vị.`;

  protected back(): void {
    this.location.back();
  }
}

function reasonFrom(router: Router): string {
  const state = ForbiddenStateSchema.safeParse(
    router.currentNavigation()?.extras.state ?? history.state,
  );
  if (!state.success) return FALLBACK_REASON;
  const roles = state.data.roles.map(roleLabel).join(', ');
  return `Trang "${state.data.path}" dành cho vai trò: ${roles}.`;
}
