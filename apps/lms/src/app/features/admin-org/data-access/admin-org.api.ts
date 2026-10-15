import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  adminOrgEndpoints,
  toUrl,
  type AdminMeta,
  type Group,
  type OrgUnit,
  type SaveGroupCommand,
  type SaveUnitCommand,
  type SetUnitStatusCommand,
  type Unit,
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

  org(): Observable<OrgUnit[]> {
    const endpoint = adminOrgEndpoints.org;
    return this.http
      .get<unknown>(toUrl(endpoint))
      .pipe(parseResponse(endpoint.response));
  }

  saveUnit(command: SaveUnitCommand): Observable<Unit> {
    const endpoint = adminOrgEndpoints.saveUnit;
    return this.http
      .post<unknown>(toUrl(endpoint), command)
      .pipe(parseResponse(endpoint.response));
  }

  setUnitStatus(
    unitId: string,
    command: SetUnitStatusCommand,
  ): Observable<Unit> {
    const endpoint = adminOrgEndpoints.setUnitStatus;
    return this.http
      .put<unknown>(toUrl(endpoint, { unitId }), command)
      .pipe(parseResponse(endpoint.response));
  }

  saveGroup(command: SaveGroupCommand): Observable<Group> {
    const endpoint = adminOrgEndpoints.saveGroup;
    return this.http
      .post<unknown>(toUrl(endpoint), command)
      .pipe(parseResponse(endpoint.response));
  }

  deleteGroup(groupId: string): Observable<true> {
    const endpoint = adminOrgEndpoints.deleteGroup;
    return this.http
      .delete<unknown>(toUrl(endpoint, { groupId }))
      .pipe(parseResponse(endpoint.response));
  }
}
