import { defineEndpoint } from '../http/endpoint';
import { z } from 'zod';
import {
  ChangePasswordV1CommandSchema,
  LoginV1CommandSchema,
  MeSchema,
  TokenResponseSchema,
  UpdateMeCommandSchema,
} from './auth-v1.schema';

/** The backend's auth endpoints. */
export const authV1Endpoints = {
  /** Sign in by username or staff code; the only `/api/` call without a bearer token. */
  login: defineEndpoint({
    method: 'post',
    path: '/api/v1/auth/login',
    body: LoginV1CommandSchema,
    response: TokenResponseSchema,
  }),
  /** Revokes every token of the account, on all devices. */
  logout: defineEndpoint({
    method: 'post',
    path: '/api/v1/auth/logout',
    response: z.unknown(),
  }),
  /** The signed-in user. */
  me: defineEndpoint({
    method: 'get',
    path: '/api/v1/auth/me',
    response: MeSchema,
  }),
  /** Edit the personal fields of the signed-in user; answers the refreshed `/me`. */
  updateMe: defineEndpoint({
    method: 'patch',
    path: '/api/v1/auth/me',
    body: UpdateMeCommandSchema,
    response: MeSchema,
  }),
  /** Change the password of the signed-in user and revoke every token. */
  changePassword: defineEndpoint({
    method: 'put',
    path: '/api/v1/auth/password',
    body: ChangePasswordV1CommandSchema,
    response: z.unknown(),
  }),
} as const;
