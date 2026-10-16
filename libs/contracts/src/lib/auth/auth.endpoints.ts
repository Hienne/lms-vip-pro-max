import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  DemoAccountSchema,
  LoginCommandSchema,
  LoginResultSchema,
  ChangePasswordCommandSchema,
  ChangePasswordResultSchema,
  LogoutResultSchema,
  ProfileSchema,
  UpdateProfileCommandSchema,
} from './auth.schema';

/** Keys follow the function names of `lms-mockup/src/api/auth.js`. */
export const authEndpoints = {
  /** Sign in with email and password. */
  login: defineEndpoint({
    method: 'post',
    path: '/api/auth/login',
    body: LoginCommandSchema,
    response: LoginResultSchema,
  }),
  /** Sign in as a demo account. */
  loginDemo: defineEndpoint({
    method: 'post',
    path: '/api/auth/demo-accounts/{userId}/login',
    params: z.object({ userId: z.string() }),
    response: LoginResultSchema,
  }),
  /** End the current session. */
  logout: defineEndpoint({
    method: 'post',
    path: '/api/auth/logout',
    response: LogoutResultSchema,
  }),
  /** The signed-in user with unit, group, role, menus and scope. */
  profile: defineEndpoint({
    method: 'get',
    path: '/api/auth/profile',
    response: ProfileSchema,
  }),
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
  /** Accounts offered on the login screen. */
  demoAccounts: defineEndpoint({
    method: 'get',
    path: '/api/auth/demo-accounts',
    response: z.array(DemoAccountSchema),
  }),
} as const;
