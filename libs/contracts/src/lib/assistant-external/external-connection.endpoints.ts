import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  CreatedExternalConnectionSchema,
  CreateExternalConnectionCommandSchema,
  ExternalAssistantStatusSchema,
  ExternalConnectionSchema,
  OAuthConsentRequestSchema,
  OAuthConsentResultSchema,
} from './external-connection.schema';

/**
 * Kết nối trợ lý ngoài: `/api/v1/assistant/external-connections`, with the sign-in JWT. No mockup
 * file: the backend (corebanking-academy `ExternalConnectionController`) is the spec. While the
 * feature flag is off every endpoint but `status` answers 404 `CORE-ENDPOINT_NOT_FOUND`; a caller
 * outside the Soạn cùng trợ lý roles is `CORE-ACCESS_DENIED`.
 */
export const externalConnectionEndpoints = {
  /** Whether the header shows the button: the flag, and the caller's roles now. Any signed-in user. */
  status: defineEndpoint({
    method: 'get',
    path: '/api/v1/assistant/external-connections/status',
    response: ExternalAssistantStatusSchema,
  }),
  /** The caller's connections that are not revoked, newest first. */
  list: defineEndpoint({
    method: 'get',
    path: '/api/v1/assistant/external-connections',
    response: z.array(ExternalConnectionSchema),
  }),
  /**
   * Creates a connection and returns its token once. `validDays` other than 30 or 90 is
   * `CORE-VALIDATION_FAILED` on field `validDays`.
   */
  create: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/external-connections',
    body: CreateExternalConnectionCommandSchema,
    response: CreatedExternalConnectionSchema,
  }),
  /** Revokes one of the caller's connections at once; another user's id is not found. */
  revoke: defineEndpoint({
    method: 'delete',
    path: '/api/v1/assistant/external-connections/{connectionId}',
    params: z.object({ connectionId: z.number().int() }),
    response: z.null(),
  }),
} as const;

const REQUEST = '/api/v1/assistant/oauth-requests/{requestId}';

/**
 * Cho phép kết nối (ADR 0005): the page a Trợ lý ngoài's OAuth sign-in lands on, with the sign-in
 * JWT. The backend (corebanking-academy `OAuthConsentController`) is the spec. A used, expired (10
 * minutes) or unknown request is `CORE-RESOURCE_NOT_FOUND`; outside the Soạn cùng trợ lý roles,
 * `CORE-ACCESS_DENIED`; with the flag off, 404.
 */
export const oauthConsentEndpoints = {
  read: defineEndpoint({
    method: 'get',
    path: REQUEST,
    params: z.object({ requestId: z.string().min(1) }),
    response: OAuthConsentRequestSchema,
  }),
  /**
   * Makes a connection and returns the client's redirect with a one-time code. At the connection
   * limit it is `CORE-STATE_CONFLICT` on field `connections`, and the request stays open.
   */
  approve: defineEndpoint({
    method: 'post',
    path: `${REQUEST}/approve`,
    params: z.object({ requestId: z.string().min(1) }),
    response: OAuthConsentResultSchema,
  }),
  /** Returns the client's redirect with `error=access_denied`; nothing is made. */
  deny: defineEndpoint({
    method: 'post',
    path: `${REQUEST}/deny`,
    params: z.object({ requestId: z.string().min(1) }),
    response: OAuthConsentResultSchema,
  }),
} as const;
