import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  CertificateSchema,
  CertificatesQuerySchema,
} from './certificate.schema';

const LEARNING = '/api/v1/me/learning';

/**
 * The learner's certificates (lms-mockup/src/api/learner.js, `certificates`). Only the caller's
 * completed cycles exist as certificates; any other id answers `LEARNING-NOT_FOUND`, and a role
 * other than learner `CORE-ACCESS_DENIED`. The browser prints the certificate, so there is no
 * download endpoint.
 */
export const certificateEndpoints = {
  /** The caller's completed cycles, newest completion first. */
  certificates: defineEndpoint({
    method: 'get',
    path: `${LEARNING}/certificates`,
    query: CertificatesQuerySchema,
    response: PageSchema(CertificateSchema),
  }),
  /** One certificate by its enrollment id. */
  certificate: defineEndpoint({
    method: 'get',
    path: `${LEARNING}/certificates/{enrollmentId}`,
    params: z.object({ enrollmentId: z.number().int() }),
    response: CertificateSchema,
  }),
} as const;
