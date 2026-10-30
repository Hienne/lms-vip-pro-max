import { Dialog } from '@angular/cdk/dialog';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  communityEndpoints,
  type ContentDetail,
  type CreateContentCommand,
  type RevisionDetail,
} from '@lms/contracts';
import { map, of, switchMap, tap, type Observable } from 'rxjs';
import { invalidation } from '../../../../core/data-access/invalidation';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { CommunityChanges } from '../../data-access/community-changes';
import {
  ContentAuthoring,
  createFields,
  type DraftFields,
  type DraftVersions,
} from '../../data-access/content-authoring';
import { reloadOnConflict } from '../../data-access/conflict';
import {
  contentFormFrom,
  type ContentFormValue,
} from '../../data-access/content-form';

/** What a new post is: "Bài viết" or "Bài học sự cố". */
export type NewKind = 'article' | 'lesson_learned';

interface DraftWrite {
  readonly fields: DraftFields;
  readonly tagIds: readonly number[];
}

/** Where the editor stands after the server's last answer about the draft. */
interface Saved {
  readonly versions: DraftVersions;
  readonly tagIds: readonly number[];
  readonly at: Date;
}

const sameTags = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * Soạn bài / sửa nháp (CM-05). A new article or lesson learned is created as a draft (then the
 * editor moves to its edit route) or created and published at once. An existing content is edited
 * on its draft: the one it has, or a copy of the published revision opened on the first save.
 * Versions always come from the server's last answer; a conflict asks to reload.
 */
@Injectable()
export class EditorStore {
  private readonly client = inject(EndpointClient);
  private readonly authoring = inject(ContentAuthoring);
  private readonly changes = inject(CommunityChanges);
  private readonly dialog = inject(Dialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly clientRequestId = crypto.randomUUID();
  private readonly refresh = invalidation();

  readonly contentId$ = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('id'));
        return Number.isInteger(id) && id > 0 ? id : undefined;
      }),
    ),
    { initialValue: undefined },
  );

  private readonly state = {
    newKind: signal<NewKind>(
      this.route.snapshot.queryParamMap.get('type') === 'lesson'
        ? 'lesson_learned'
        : 'article',
    ),
    /** The server's last answer about the draft; unset until the first save of this visit. */
    saved: signal<Saved | undefined>(undefined),
    historyOpen: signal(false),
    /** Set once the post is published or moved, so leaving does not ask about unsaved changes. */
    done: signal(false),
  };

  private readonly detailData = serverData(
    (contentId: number) =>
      this.client.call(communityEndpoints.content, {
        params: { contentId },
        query: { includeOwnDraft: true },
      }),
    { params: () => this.contentId$(), reloadOn: this.refresh },
  );

  /** The question an answer belongs to, for the "Đang sửa câu trả lời cho câu hỏi" note. */
  private readonly questionData = serverData(
    (questionId: number) =>
      this.client.call(communityEndpoints.content, {
        params: { contentId: questionId },
        query: {},
      }),
    { params: () => this.questionId() },
  );

  private readonly historyData = serverData(
    (contentId: number) =>
      this.client.call(communityEndpoints.revisions, {
        params: { contentId },
        query: { size: 50 },
      }),
    {
      params: () => (this.state.historyOpen() ? this.contentId$() : undefined),
    },
  );

  private readonly questionId = computed(
    () => this.detailData.value()?.questionId ?? undefined,
  );

  private readonly createMutation = serverMutation(
    ({
      command,
      publish,
    }: {
      command: CreateContentCommand;
      publish: boolean;
    }) =>
      publish
        ? this.authoring.createAndPublish(this.state.newKind(), command)
        : this.authoring.create(this.state.newKind(), command),
    {
      errors: 'toast',
      success: ({ publish }) => (publish ? 'Đã đăng bài' : 'Đã lưu nháp'),
      invalidates: this.changes.contents,
      onSuccess: (created) => {
        this.setDone(true);
        const published = !created.draftRevision;
        void this.router.navigate(
          published
            ? ['/community/contents', created.contentId]
            : ['/community/contents', created.contentId, 'edit'],
          { replaceUrl: true },
        );
      },
    },
  );

  private readonly saveMutation = serverMutation(
    (write: DraftWrite) =>
      this.writeDraft(write).pipe(
        reloadOnConflict(this.dialog, () => this.reloadContent()),
      ),
    {
      errors: 'toast',
      invalidates: this.changes.contents,
    },
  );

  private readonly publishMutation = serverMutation(
    (write: DraftWrite) =>
      this.writeDraft(write).pipe(
        switchMap((saved) =>
          this.authoring.publish(this.requireId(), saved.versions),
        ),
        reloadOnConflict(this.dialog, () => this.reloadContent()),
      ),
    {
      errors: 'toast',
      success: () => 'Đã đăng bản mới',
      invalidates: this.changes.contents,
      onSuccess: (published) => {
        this.setDone(true);
        const target =
          published.kind === 'answer' ? this.questionId() : published.contentId;
        void this.router.navigate([
          '/community/contents',
          target ?? published.contentId,
        ]);
      },
    },
  );

  // Selectors
  readonly isNew$ = computed(() => this.contentId$() === undefined);
  readonly newKind$ = this.state.newKind.asReadonly();
  readonly detail$ = this.detailData.value;
  readonly isLoading$ = this.detailData.isLoading;
  readonly loadError$ = this.detailData.error;
  /** The kind the form is laid out for. */
  readonly kind$ = computed(() =>
    this.isNew$() ? this.state.newKind() : this.detailData.value()?.kind,
  );
  readonly isPublished$ = computed(
    () => !!this.detailData.value()?.publishedRevision,
  );
  readonly canEdit$ = computed(
    () => !!this.detailData.value()?.capabilities.canEditDraft,
  );
  readonly questionTitle$ = computed(
    () => this.questionData.value()?.publishedRevision?.title,
  );
  /** The form to show once the content arrives: its draft, else its published revision. */
  readonly initialForm$ = computed((): ContentFormValue | undefined => {
    const detail = this.detailData.value();
    const revision = detail?.draftRevision ?? detail?.publishedRevision;
    return detail && revision
      ? contentFormFrom(
          revision,
          (detail.tags ?? []).map((tag) => tag.tagId),
        )
      : undefined;
  });
  readonly savedAt$ = computed(() => this.state.saved()?.at);
  readonly isBusy$ = computed(
    () =>
      this.createMutation.isPending() ||
      this.saveMutation.isPending() ||
      this.publishMutation.isPending(),
  );
  readonly done$ = this.state.done.asReadonly();
  readonly historyOpen$ = this.state.historyOpen.asReadonly();
  /** The answer being edited is the accepted one, so the asker confirms the new revision. */
  readonly isAcceptedAnswer$ = computed(() => {
    const detail = this.detailData.value();
    return (
      detail?.kind === 'answer' &&
      this.questionData.value()?.acceptedAnswerId === detail.contentId
    );
  });
  readonly history$ = computed(() => this.historyData.value()?.items ?? []);
  readonly historyLoading$ = this.historyData.isLoading;
  readonly historyError$ = this.historyData.error;

  // Setters
  private setNewKind(kind: NewKind): void {
    this.state.newKind.set(kind);
  }

  private setSaved(saved: Saved | undefined): void {
    this.state.saved.set(saved);
  }

  private setHistoryOpen(open: boolean): void {
    this.state.historyOpen.set(open);
  }

  private setDone(done: boolean): void {
    this.state.done.set(done);
  }

  // Commands
  /** Also written to `?type=`, so a reload opens the same form. */
  chooseKind(kind: NewKind): void {
    this.setNewKind(kind);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: kind === 'lesson_learned' ? 'lesson' : null },
      replaceUrl: true,
    });
  }

  saveDraft(fields: DraftFields, tagIds: readonly number[]): void {
    if (this.isNew$()) {
      this.createMutation.run({
        command: this.createCommand(fields, tagIds),
        publish: false,
      });
    } else {
      this.saveMutation.run({ fields, tagIds });
    }
  }

  publish(fields: DraftFields, tagIds: readonly number[]): void {
    if (this.isNew$()) {
      this.createMutation.run({
        command: this.createCommand(fields, tagIds),
        publish: true,
      });
    } else {
      this.publishMutation.run({ fields, tagIds });
    }
  }

  showHistory(): void {
    this.setHistoryOpen(true);
    this.historyData.reload();
  }

  hideHistory(): void {
    this.setHistoryOpen(false);
  }

  retryLoad(): void {
    this.detailData.reload();
  }

  /** Drops what this visit knew about the draft and reads the content again. */
  private reloadContent(): void {
    this.setSaved(undefined);
    this.refresh.bump();
  }

  private requireId(): number {
    const id = this.contentId$();
    if (id === undefined) throw new Error('The editor has no content id');
    return id;
  }

  private createCommand(
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

  /**
   * Saves the draft (opening one first when the post has none), then the tags when they changed.
   * Answers carry no tags: theirs come from the question. Each step that succeeds records its
   * versions at once, so a later step failing (tags, publish) does not leave the next try sending
   * versions this visit already replaced.
   */
  private writeDraft({ fields, tagIds }: DraftWrite): Observable<Saved> {
    const detail = this.detailData.value();
    if (!detail) throw new Error('The editor has no content loaded');
    const contentId = detail.contentId;
    const known = this.state.saved();
    const draft$: Observable<DraftVersions> = known
      ? of(known.versions)
      : this.authoring
          .openDraft(detail)
          .pipe(map((revision: RevisionDetail) => this.versionsOf(revision)));
    const previousTags =
      known?.tagIds ?? (detail.tags ?? []).map((tag) => tag.tagId);
    const record = (versions: DraftVersions) =>
      this.setSaved({ versions, tagIds: previousTags, at: new Date() });
    return draft$.pipe(
      tap(record),
      switchMap((versions) => this.authoring.save(contentId, versions, fields)),
      map((revision) => this.versionsOf(revision)),
      tap(record),
      switchMap((versions) =>
        detail.kind === 'answer' || sameTags(previousTags, tagIds)
          ? of({ versions, tagIds: previousTags, at: new Date() })
          : this.authoring
              .setTags(contentId, versions.contentVersion, tagIds)
              .pipe(
                map((updated: ContentDetail) => ({
                  versions: {
                    ...versions,
                    contentVersion: updated.contentVersion,
                  },
                  tagIds,
                  at: new Date(),
                })),
              ),
      ),
      tap((saved) => this.setSaved(saved)),
    );
  }

  private versionsOf(revision: RevisionDetail): DraftVersions {
    return {
      contentVersion: revision.contentVersion,
      revisionVersion: revision.revisionVersion,
    };
  }
}
