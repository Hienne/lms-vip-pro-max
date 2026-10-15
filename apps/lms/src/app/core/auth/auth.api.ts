import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  authEndpoints,
  toUrl,
  type ChangePasswordCommand,
  type DemoAccount,
  type LoginCommand,
  type LoginResult,
  type Profile,
  type UpdateProfileCommand,
} from '@lms/contracts';
import type { Observable } from 'rxjs';
import { parseResponse } from '../http/parse-response';

/** Method names follow `lms-mockup/src/api/auth.js`. */
@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(command: LoginCommand): Observable<LoginResult> {
    const endpoint = authEndpoints.login;
    return this.http
      .post<unknown>(toUrl(endpoint), command)
      .pipe(parseResponse(endpoint.response));
  }

  loginDemo(userId: string): Observable<LoginResult> {
    const endpoint = authEndpoints.loginDemo;
    return this.http
      .post<unknown>(toUrl(endpoint, { userId }), null)
      .pipe(parseResponse(endpoint.response));
  }

  logout(): Observable<true> {
    const endpoint = authEndpoints.logout;
    return this.http
      .post<unknown>(toUrl(endpoint), null)
      .pipe(parseResponse(endpoint.response));
  }

  profile(): Observable<Profile> {
    const endpoint = authEndpoints.profile;
    return this.http
      .get<unknown>(toUrl(endpoint))
      .pipe(parseResponse(endpoint.response));
  }

  updateProfile(command: UpdateProfileCommand): Observable<Profile> {
    const endpoint = authEndpoints.updateProfile;
    return this.http
      .put<unknown>(toUrl(endpoint), command)
      .pipe(parseResponse(endpoint.response));
  }

  changePassword(command: ChangePasswordCommand): Observable<true> {
    const endpoint = authEndpoints.changePassword;
    return this.http
      .post<unknown>(toUrl(endpoint), command)
      .pipe(parseResponse(endpoint.response));
  }

  demoAccounts(): Observable<DemoAccount[]> {
    const endpoint = authEndpoints.demoAccounts;
    return this.http
      .get<unknown>(toUrl(endpoint))
      .pipe(parseResponse(endpoint.response));
  }
}
