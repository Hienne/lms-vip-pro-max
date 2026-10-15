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

export const authEndpoints = {
  login: defineEndpoint({
    method: 'post',
    path: '/api/auth/login',
    summary: 'Sign in with email and password',
    body: LoginCommandSchema,
    response: LoginResultSchema,
    errors: [401, 422, 423],
  }),
  loginDemo: defineEndpoint({
    method: 'post',
    path: '/api/auth/demo-accounts/{userId}/login',
    summary: 'Sign in as a demo account',
    params: z.object({ userId: z.string() }),
    response: LoginResultSchema,
    errors: [404, 423],
  }),
  logout: defineEndpoint({
    method: 'post',
    path: '/api/auth/logout',
    summary: 'End the current session',
    response: LogoutResultSchema,
    errors: [],
  }),
  profile: defineEndpoint({
    method: 'get',
    path: '/api/auth/profile',
    summary: 'The signed-in user with unit, group, role, menus and scope',
    response: ProfileSchema,
    errors: [401],
  }),
  updateProfile: defineEndpoint({
    method: 'put',
    path: '/api/auth/profile',
    summary: 'Edit the personal fields of the signed-in user',
    body: UpdateProfileCommandSchema,
    response: ProfileSchema,
    errors: [401, 422],
  }),
  changePassword: defineEndpoint({
    method: 'post',
    path: '/api/auth/change-password',
    summary: 'Change the password of the signed-in user',
    body: ChangePasswordCommandSchema,
    response: ChangePasswordResultSchema,
    errors: [401, 422],
  }),
  demoAccounts: defineEndpoint({
    method: 'get',
    path: '/api/auth/demo-accounts',
    summary: 'Accounts offered on the login screen',
    response: z.array(DemoAccountSchema),
    errors: [],
  }),
} as const;
