import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  adminOrgEndpoints,
  toUrl,
  type AdminMeta,
  type ResetPasswordResult,
  type SaveUserCommand,
  type SetUserStatusCommand,
  type UserDetail,
  type UserListItem,
} from '@lms/contracts';
import type { Observable } from 'rxjs';
import { parseResponse } from '../../../core/http/parse-response';

/** Method names follow `lms-mockup/src/api/admin.js`. */
@Service()
export class AdminOrgApi {
  private readonly http = inject(HttpClient);

  users(): Observable<UserListItem[]> {
    const endpoint = adminOrgEndpoints.users;
    return this.http
      .get<unknown>(toUrl(endpoint))
      .pipe(parseResponse(endpoint.response));
  }

  user(userId: string): Observable<UserDetail> {
    const endpoint = adminOrgEndpoints.user;
    return this.http
      .get<unknown>(toUrl(endpoint, { userId }))
      .pipe(parseResponse(endpoint.response));
  }

  saveUser(command: SaveUserCommand): Observable<UserListItem> {
    const endpoint = adminOrgEndpoints.saveUser;
    return this.http
      .post<unknown>(toUrl(endpoint), command)
      .pipe(parseResponse(endpoint.response));
  }

  setUserStatus(
    userId: string,
    command: SetUserStatusCommand,
  ): Observable<UserListItem> {
    const endpoint = adminOrgEndpoints.setUserStatus;
    return this.http
      .put<unknown>(toUrl(endpoint, { userId }), command)
      .pipe(parseResponse(endpoint.response));
  }

  resetPassword(userId: string): Observable<ResetPasswordResult> {
    const endpoint = adminOrgEndpoints.resetPassword;
    return this.http
      .post<unknown>(toUrl(endpoint, { userId }), null)
      .pipe(parseResponse(endpoint.response));
  }

  adminMeta(): Observable<AdminMeta> {
    const endpoint = adminOrgEndpoints.adminMeta;
    return this.http
      .get<unknown>(toUrl(endpoint))
      .pipe(parseResponse(endpoint.response));
  }
}
