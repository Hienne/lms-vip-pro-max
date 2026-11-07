import { inject, Injectable } from '@angular/core';
import {
  communityEndpoints,
  communityReviewEndpoints,
  type CreateReviewCommand,
  type ContentDetail,
  type RevisionDetail,
  type SaveContentDraftCommand,
} from '@lms/contracts';
import { of, switchMap, type Observable } from 'rxjs';
import { EndpointClient } from '../../../core/http/endpoint-client';

/** The kinds a screen creates from scratch; answers are created on the question page. */
export type AuthoredKind =
  | 'question'
  | 'article'
  | 'lesson_learned'
  | 'architecture_review';

const CREATE = {
  architecture_review: communityReviewEndpoints.create,
  question: communityEndpoints.createQuestion,
  article: communityEndpoints.createArticle,
  lesson_learned: communityEndpoints.createLesson,
} as const;

/** The draft fields a form sends; versions are added from the server's last answer. */
export type DraftFields = Omit<
  SaveContentDraftCommand,
  'expectedContentVersion' | 'expectedRevisionVersion'
>;

/** The fields a create command takes: everything but the change note, which only a later save has. */
export function createFields(
  fields: DraftFields,
): Omit<DraftFields, 'changeNote'> {
  const draft = { ...fields };
  delete draft.changeNote;
  return draft;
}

/** The versions a draft write must carry, from the last detail or revision the server sent. */
export interface DraftVersions {
  readonly contentVersion: number;
  readonly revisionVersion: number;
}

/**
 * The server calls that write a community draft, shared by "Đặt câu hỏi" (CM-02) and the editor
 * (CM-05). Each returns the observable for a store's `serverMutation`; none holds state. The
 * versions always come from the server, never from a local count.
 */
@Injectable()
export class ContentAuthoring {
  private readonly client = inject(EndpointClient);

  /** Creates the draft; a retry with the same `clientRequestId` returns the same content. */
  create(
    kind: AuthoredKind,
    command: CreateReviewCommand,
  ): Observable<ContentDetail> {
    return this.client.call(CREATE[kind], { body: command });
  }

  /** Creates the draft and publishes it at once ("Đăng" on a new post). */
  createAndPublish(
    kind: AuthoredKind,
    command: CreateReviewCommand,
  ): Observable<ContentDetail> {
    return this.create(kind, command).pipe(
      switchMap((created) =>
        this.publish(created.contentId, {
          contentVersion: created.contentVersion,
          revisionVersion: created.draftRevision?.revisionVersion ?? 0,
        }),
      ),
    );
  }

  /**
   * The editable draft of a published content: the one it has, or a copy of the published
   * revision the server opens (C12; a retry returns the same draft).
   */
  openDraft(detail: ContentDetail): Observable<RevisionDetail> {
    return detail.draftRevision
      ? of(detail.draftRevision)
      : this.client.call(communityEndpoints.openDraft, {
          params: { contentId: detail.contentId },
          body: { expectedContentVersion: detail.contentVersion },
        });
  }

  /** Saves the draft; the answer carries the next content and revision versions. */
  save(
    contentId: number,
    versions: DraftVersions,
    fields: DraftFields,
  ): Observable<RevisionDetail> {
    return this.client.call(communityEndpoints.saveDraft, {
      params: { contentId },
      body: {
        expectedContentVersion: versions.contentVersion,
        expectedRevisionVersion: versions.revisionVersion,
        ...fields,
      },
    });
  }

  /** Replaces the tags; they belong to the content, so a published post shows them at once. */
  setTags(
    contentId: number,
    contentVersion: number,
    tagIds: readonly number[],
  ): Observable<ContentDetail> {
    return this.client.call(communityEndpoints.setTags, {
      params: { contentId },
      body: { expectedContentVersion: contentVersion, tagIds: [...tagIds] },
    });
  }

  publish(
    contentId: number,
    versions: DraftVersions,
  ): Observable<ContentDetail> {
    return this.client.call(communityEndpoints.publishContent, {
      params: { contentId },
      body: {
        expectedContentVersion: versions.contentVersion,
        expectedRevisionVersion: versions.revisionVersion,
      },
    });
  }
}
