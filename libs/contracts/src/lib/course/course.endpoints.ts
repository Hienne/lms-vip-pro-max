import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  AssetContentQuerySchema,
  ChangeCourseStateCommandSchema,
  CopyCourseCommandSchema,
  CourseCardSchema,
  CourseDetailSchema,
  CourseListQuerySchema,
  CourseSchema,
  CourseShareSchema,
  CreateCourseCommandSchema,
  LearningAssetSchema,
  SaveDraftCommandSchema,
  ShareCourseCommandSchema,
  VersionCommandSchema,
} from './course.schema';

const courseParams = z.object({ courseId: z.number().int() });
const revisionParams = courseParams.extend({ revisionId: z.number().int() });

/** The backend's course authoring endpoints (/api/v1/courses, /instructor, /learning-assets). */
export const courseEndpoints = {
  /** Courses the caller owns or may manage, with the number of people assigned. */
  instructorCourses: defineEndpoint({
    method: 'get',
    path: '/api/v1/instructor/courses',
    query: CourseListQuerySchema,
    response: PageSchema(CourseCardSchema),
  }),
  /** Creates the course and its first draft; the server decides the owner. */
  createCourse: defineEndpoint({
    method: 'post',
    path: '/api/v1/courses',
    body: CreateCourseCommandSchema,
    response: CourseDetailSchema,
  }),
  /** The content tree for authoring; without `revisionId`, the latest revision. Editors only. */
  getCourse: defineEndpoint({
    method: 'get',
    path: '/api/v1/courses/{courseId}',
    params: courseParams,
    query: z.object({ revisionId: z.number().int().positive().optional() }),
    response: CourseDetailSchema,
  }),
  /** Reuses the open draft, or clones the published revision into a new one. */
  openDraft: defineEndpoint({
    method: 'post',
    path: '/api/v1/courses/{courseId}/draft',
    params: courseParams,
    response: CourseDetailSchema,
  }),
  /** Replaces the whole draft tree and issues new chapter, lesson and block ids. */
  saveDraft: defineEndpoint({
    method: 'put',
    path: '/api/v1/courses/{courseId}/revisions/{revisionId}',
    params: revisionParams,
    body: SaveDraftCommandSchema,
    response: CourseDetailSchema,
  }),
  /** Checks and freezes the revision; learners' progress is kept. */
  publish: defineEndpoint({
    method: 'post',
    path: '/api/v1/courses/{courseId}/revisions/{revisionId}/publish',
    params: revisionParams,
    body: VersionCommandSchema,
    response: CourseDetailSchema,
  }),
  /** Pause or archive; learning history is kept. */
  changeState: defineEndpoint({
    method: 'patch',
    path: '/api/v1/courses/{courseId}/state',
    params: courseParams,
    body: ChangeCourseStateCommandSchema,
    response: CourseSchema,
  }),
  /** A new course with a new code, its content cloned into a draft. */
  copyCourse: defineEndpoint({
    method: 'post',
    path: '/api/v1/courses/{courseId}/copy',
    params: courseParams,
    body: CopyCourseCommandSchema,
    response: CourseDetailSchema,
  }),
  /** Content managers only. */
  shares: defineEndpoint({
    method: 'get',
    path: '/api/v1/courses/{courseId}/shares',
    params: courseParams,
    response: z.array(CourseShareSchema),
  }),
  /** Revoking a share does not remove past assignments. */
  share: defineEndpoint({
    method: 'put',
    path: '/api/v1/courses/{courseId}/shares',
    params: courseParams,
    body: ShareCourseCommandSchema,
    response: CourseShareSchema,
  }),
  /** The file itself after a permission check (supports Range for video and PDF). */
  getAssetContent: defineEndpoint({
    method: 'get',
    path: '/api/v1/learning-assets/{assetId}/content',
    params: z.object({ assetId: z.number().int() }),
    query: AssetContentQuerySchema,
    responseType: 'blob',
    response: z.instanceof(Blob),
  }),
} as const;
