import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  COMMUNITY_LIMITS,
  communityEndpoints,
  type CreateContentCommand,
} from '@lms/contracts';
import { switchMap, timer } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { communityCoverUpload } from '../../data-access/community-cover';
import { CommunityChanges } from '../../data-access/community-changes';
import {
  ContentAuthoring,
  createFields,
  type DraftFields,
} from '../../data-access/content-authoring';
import { randomId } from '../../../../core/browser/secure-context';

/** How long the title must rest before similar questions are looked up. */
const SUGGEST_DELAY_MS = 400;
const SUGGESTIONS = 5;

/**
 * Đặt câu hỏi (CM-02). Similar questions follow the title; "Lưu nháp" creates the draft and moves
 * to the editor, "Đăng câu hỏi" creates and publishes it. One `clientRequestId` per visit makes a
 * retry return the same question instead of a second one.
 */
@Injectable()
export class AskStore {
  readonly cover = communityCoverUpload();
  private readonly client = inject(EndpointClient);
  private readonly authoring = inject(ContentAuthoring);
  private readonly changes = inject(CommunityChanges);
  private readonly router = inject(Router);

  private readonly clientRequestId = randomId();

  private readonly state = {
    title: signal(''),
    /** Set once the question exists, so leaving for it does not ask about unsaved changes. */
    done: signal(false),
  };

  private readonly suggestQuery = computed(() => {
    const q = this.state.title().trim();
    return q.length >= COMMUNITY_LIMITS.suggestionQuery.min
      ? q.slice(0, COMMUNITY_LIMITS.suggestionQuery.max)
      : undefined;
  });

  private readonly suggestionData = serverData(
    (q: string) =>
      timer(SUGGEST_DELAY_MS).pipe(
        switchMap(() =>
          this.client.call(communityEndpoints.questionSuggestions, {
            query: { q, limit: SUGGESTIONS },
          }),
        ),
      ),
    { params: () => this.suggestQuery() },
  );

  private readonly saveMutation = serverMutation(
    (command: CreateContentCommand) =>
      this.authoring.create('question', command),
    {
      errors: 'toast',
      success: () => ({
        title: 'Đã lưu nháp',
        detail: 'Bản nháp chỉ mình bạn thấy, xem lại trong Của tôi.',
      }),
      invalidates: this.changes.contents,
      onSuccess: (created) => {
        this.setDone();
        void this.router.navigate(
          ['/community/contents', created.contentId, 'edit'],
          { replaceUrl: true },
        );
      },
    },
  );

  private readonly publishMutation = serverMutation(
    (command: CreateContentCommand) =>
      this.authoring.createAndPublish('question', command),
    {
      errors: 'toast',
      success: () => 'Đã đăng câu hỏi',
      invalidates: this.changes.contents,
      onSuccess: (published) => {
        this.setDone();
        void this.router.navigate(
          ['/community/contents', published.contentId],
          {
            replaceUrl: true,
          },
        );
      },
    },
  );

  // Selectors
  readonly suggestions$ = computed(() =>
    this.suggestQuery() ? (this.suggestionData.value() ?? []) : [],
  );
  /** True once a lookup for the current title came back with nothing. */
  readonly noSuggestions$ = computed(
    () =>
      !!this.suggestQuery() &&
      this.suggestionData.value()?.length === 0 &&
      !this.suggestionData.error(),
  );
  readonly isSaving$ = this.saveMutation.isPending;
  readonly isPublishing$ = this.publishMutation.isPending;
  readonly isBusy$ = computed(
    () =>
      this.cover.isPending$() ||
      this.saveMutation.isPending() ||
      this.publishMutation.isPending(),
  );
  readonly done$ = this.state.done.asReadonly();

  // Setters
  private setTitle(title: string): void {
    this.state.title.set(title);
  }

  private setDone(): void {
    this.state.done.set(true);
  }

  // Commands
  typeTitle(title: string): void {
    this.setTitle(title);
  }

  saveDraft(fields: DraftFields, tagIds: readonly number[]): void {
    if (this.isBusy$()) return;
    this.saveMutation.run(this.command(fields, tagIds));
  }

  publish(fields: DraftFields, tagIds: readonly number[]): void {
    if (this.isBusy$()) return;
    this.publishMutation.run(this.command(fields, tagIds));
  }

  private command(
    fields: DraftFields,
    tagIds: readonly number[],
  ): CreateContentCommand {
    return {
      clientRequestId: this.clientRequestId,
      ...createFields(fields),
      visibility: 'organization',
      tagIds: [...tagIds],
    };
  }
}
