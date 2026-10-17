import { defineEndpoint } from '../http/endpoint';
import { z } from 'zod';
import {
  LoginV1CommandSchema,
  MeSchema,
  TokenResponseSchema,
} from './auth-v1.schema';

/** The backend's auth endpoints. Their fixtures are not registered in the mock API. */
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
} as const;
