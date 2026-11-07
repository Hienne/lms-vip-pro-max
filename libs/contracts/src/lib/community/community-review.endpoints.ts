import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageQuerySchema, PageSchema } from '../http/page';
import {
  CommentViewSchema,
  ContentCardSchema,
  ContentDetailSchema,
  CreateContentCommandSchema,
  PersonRefSchema,
} from './community.schema';

const contentParams = z.object({ contentId: z.number().int().positive() });
const version = z.number().int().nonnegative();
export const ReviewStatusSchema = z.enum([
  'draft',
  'open',
  'concluded',
  'closed',
]);
export const ReviewCardSchema = ContentCardSchema.extend({
  reviewStatus: ReviewStatusSchema,
  dueAt: BackendDateTimeSchema.nullish(),
  currentRevisionId: z.number().int().nullish(),
  openThreadCount: z.number().int().nonnegative(),
  invitedCount: z.number().int().nonnegative(),
});
export const ReviewViewSchema = ContentDetailSchema.extend({
  reviewStatus: ReviewStatusSchema,
  dueAt: BackendDateTimeSchema.nullish(),
  concludedRevisionId: z.number().int().nullish(),
  conclusion: z.string().nullish(),
  concludedBy: PersonRefSchema.nullish(),
  concludedAt: BackendDateTimeSchema.nullish(),
  openThreadCount: z.number().int().nonnegative(),
  reviewCapabilities: z.array(
    z.enum(['open', 'comment', 'invite', 'close', 'conclude', 'follow_up']),
  ),
});
export const ReviewInvitationSchema = z.object({
  invitationId: z.number().int(),
  proposalContentId: z.number().int(),
  reviewer: PersonRefSchema,
  invitedBy: PersonRefSchema,
  status: z.enum(['pending', 'accepted', 'declined', 'completed', 'cancelled']),
  respondedAt: BackendDateTimeSchema.nullish(),
  expiresAt: BackendDateTimeSchema.nullish(),
  version,
  createTime: BackendDateTimeSchema,
  updateTime: BackendDateTimeSchema,
  capabilities: z.array(z.enum(['accept', 'decline', 'complete', 'cancel'])),
});
export const ReviewAnchorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('section'), section: z.string().min(1).max(255) }),
  z.object({
    type: z.literal('line'),
    startLine: z.number().int(),
    endLine: z.number().int(),
  }),
  z.object({ type: z.literal('page'), page: z.number().int() }),
  z.object({
    type: z.literal('region'),
    page: z.number().int(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
]);
export const ReviewThreadSchema = z.object({
  threadId: z.number().int(),
  proposalContentId: z.number().int(),
  revisionId: z.number().int(),
  revisionAssetId: z.number().int().nullish(),
  anchor: ReviewAnchorSchema,
  status: z.enum(['open', 'resolved']),
  resolvedBy: PersonRefSchema.nullish(),
  resolvedAt: BackendDateTimeSchema.nullish(),
  resolutionNote: z.string().nullish(),
  rootComment: CommentViewSchema.nullish(),
  version,
  createTime: BackendDateTimeSchema,
  updateTime: BackendDateTimeSchema,
  capabilities: z.array(z.enum(['resolve', 'reopen'])),
});
export const CreateReviewCommandSchema = CreateContentCommandSchema.extend({
  dueAt: z.iso.datetime().optional(),
});
export type ReviewCard = z.infer<typeof ReviewCardSchema>;
export type ReviewView = z.infer<typeof ReviewViewSchema>;
export type ReviewInvitation = z.infer<typeof ReviewInvitationSchema>;
export type ReviewThread = z.infer<typeof ReviewThreadSchema>;
export type CreateReviewCommand = z.infer<typeof CreateReviewCommandSchema>;
export const ReviewListQuerySchema = PageQuerySchema.extend({
  q: z.string().max(300).optional(),
  status: ReviewStatusSchema.optional(),
});
export type ReviewListQuery = z.infer<typeof ReviewListQuerySchema>;

/** Architecture review writes use the existing versioned content API; read APIs return current ACL capabilities. */
export const communityReviewEndpoints = {
  list: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/reviews',
    query: ReviewListQuerySchema,
    response: PageSchema(ReviewCardSchema),
  }),
  detail: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/reviews/{contentId}',
    params: contentParams,
    response: ReviewViewSchema,
  }),
  create: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/reviews',
    body: CreateReviewCommandSchema,
    response: ContentDetailSchema,
  }),
  threads: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/reviews/{contentId}/threads',
    params: contentParams,
    query: PageQuerySchema.extend({
      revisionId: z.number().int().positive(),
      status: z.enum(['open', 'resolved']).optional(),
    }),
    response: PageSchema(ReviewThreadSchema),
  }),
  createThread: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/reviews/{contentId}/threads',
    params: contentParams,
    body: z.strictObject({
      clientRequestId: z.uuid(),
      revisionId: z.number().int().positive(),
      revisionAssetId: z.number().int().positive().optional(),
      anchor: ReviewAnchorSchema,
      bodyMarkdown: z.string().min(1).max(10_000),
    }),
    response: ReviewThreadSchema,
  }),
  threadAction: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/review-threads/{threadId}',
    params: z.object({ threadId: z.number().int().positive() }),
    body: z.strictObject({
      expectedVersion: version,
      action: z.enum(['resolve', 'reopen']),
      note: z.string().min(1).max(3_000),
    }),
    response: ReviewThreadSchema,
  }),
  invitations: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/reviews/{contentId}/invitations',
    params: contentParams,
    query: PageQuerySchema,
    response: PageSchema(ReviewInvitationSchema),
  }),
  invite: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/reviews/{contentId}/invitations',
    params: contentParams,
    body: z.strictObject({
      reviewerUserIds: z.array(z.string().min(1).max(20)).min(1).max(500),
      expiresAt: z.iso.datetime().optional(),
    }),
    response: z.array(ReviewInvitationSchema),
  }),
  respond: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/review-invitations/{invitationId}',
    params: z.object({ invitationId: z.number().int().positive() }),
    body: z.strictObject({
      expectedVersion: version,
      action: z.enum(['accept', 'decline', 'complete', 'cancel']),
    }),
    response: ReviewInvitationSchema,
  }),
  open: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/contents/{contentId}/lifecycle',
    params: contentParams,
    body: z.strictObject({
      expectedContentVersion: version,
      action: z.literal('open_review'),
      reason: z.string().min(5).max(3_000),
    }),
    response: ContentDetailSchema,
  }),
  conclude: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/reviews/{contentId}/conclude',
    params: contentParams,
    body: z.strictObject({
      expectedContentVersion: version,
      concludedRevisionId: z.number().int().positive(),
      conclusion: z.string().min(20).max(20_000),
    }),
    response: ReviewViewSchema,
  }),
  close: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/reviews/{contentId}/close',
    params: contentParams,
    body: z.strictObject({
      expectedContentVersion: version,
      reason: z.string().min(5).max(3_000),
    }),
    response: ReviewViewSchema,
  }),
  followUp: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/reviews/{contentId}/follow-up',
    params: contentParams,
    body: CreateReviewCommandSchema.extend({
      sourceRevisionId: z.number().int().positive(),
    }),
    response: ContentDetailSchema,
  }),
};
