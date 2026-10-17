import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  DemoAccountSchema,
  ChangePasswordCommandSchema,
  ChangePasswordResultSchema,
  ProfileSchema,
  UpdateProfileCommandSchema,
} from './auth.schema';

/**
 * Mock-only auth endpoints the backend lacks (the real ones are `authV1Endpoints`). Keys follow
 * the function names of `lms-mockup/src/api/auth.js`.
 */
export const authEndpoints = {
  /** Edit the personal fields of the signed-in user. */
  updateProfile: defineEndpoint({
    method: 'put',
    path: '/api/auth/profile',
    body: UpdateProfileCommandSchema,
    response: ProfileSchema,
  }),
  /** Change the password of the signed-in user. */
  changePassword: defineEndpoint({
    method: 'post',
    path: '/api/auth/change-password',
    body: ChangePasswordCommandSchema,
    response: ChangePasswordResultSchema,
  }),
  /** Accounts the dev toolbar offers as mock roles. */
  demoAccounts: defineEndpoint({
    method: 'get',
    path: '/api/auth/demo-accounts',
    response: z.array(DemoAccountSchema),
  }),
} as const;
