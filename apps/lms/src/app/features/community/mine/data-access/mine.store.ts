import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  communityEndpoints,
  type ContentCard,
  type MyContentsQuery,
  type Page,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { CommunityChanges } from '../../data-access/community-changes';

export const MINE_PAGE_SIZE = 20;

/** "Bài của tôi" lists the caller's own contents (C11), "Đã lưu" their bookmarks (C29). */
export type MineTab = 'mine' | 'saved';

/** The status filter: drafts and published map to `publicationState`, closed to `lifecycleStatus`. */
export type MineStatus = '' | 'draft' | 'published' | 'closed';

const KINDS = ['question', 'answer', 'article', 'lesson_learned'] as const;
const STATUSES: readonly MineStatus[] = ['draft', 'published', 'closed'];

/** One row of "Bài của tôi": the card with the link and action the server's flags allow. */
export interface MineRow {
  readonly card: ContentCard;
  /** The detail to open; an answer opens its question. */
  readonly link: readonly (string | number)[];
  readonly status: 'draft' | 'published' | 'closed' | 'archived';
  /** The author has a draft to continue: never published, or a newer draft of a published post. */
  readonly editDraft: boolean;
}

function toRow(card: ContentCard): MineRow {
  const target =
    card.kind === 'answer' && card.questionId
      ? card.questionId
      : card.contentId;
  const status = !card.publishedAt
    ? 'draft'
    : card.lifecycleStatus === 'closed'
      ? 'closed'
      : card.lifecycleStatus === 'archived'
        ? 'archived'
        : 'published';
  return {
    card,
    link: ['/community/contents', target],
    status,
    editDraft:
      !!card.capabilities?.canEditDraft &&
      (status === 'draft' || !!card.hasDraft),
  };
}

/** Của tôi (CM-06): the caller's own posts and drafts, and the posts they saved. */
@Injectable()
export class MineStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(CommunityChanges);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly initial = this.route.snapshot.queryParams;

  private readonly state = {
    tab: signal<MineTab>(this.initial['tab'] === 'saved' ? 'saved' : 'mine'),
    kind: signal<string>(
      KINDS.includes(this.initial['kind']) ? this.initial['kind'] : '',
    ),
    status: signal<MineStatus>(
      STATUSES.includes(this.initial['status']) ? this.initial['status'] : '',
    ),
    minePage: signal(1),
    savedPage: signal(1),
    shownMine: linkedSignal<
      Page<ContentCard> | undefined,
      Page<ContentCard> | undefined
    >({
      source: () => this.mineData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
    shownSaved: linkedSignal<
      Page<ContentCard> | undefined,
      Page<ContentCard> | undefined
    >({
      source: () => this.savedData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  private readonly mineQuery = computed((): MyContentsQuery => {
    const status = this.state.status();
    return {
      page: this.state.minePage() - 1,
      size: MINE_PAGE_SIZE,
      ...(this.state.kind() ? { kind: this.state.kind() } : {}),
      ...(status === 'draft' || status === 'published'
        ? { publicationState: status }
        : {}),
      ...(status === 'closed' ? { lifecycleStatus: 'closed' } : {}),
    };
  });

  private readonly mineData = serverData(
    (query: MyContentsQuery) =>
      this.client.call(communityEndpoints.myContents, { query }),
    { params: () => this.mineQuery(), reloadOn: this.changes.contents },
  );

  private readonly savedData = serverData(
    (page: number) =>
      this.client.call(communityEndpoints.bookmarks, {
        query: { page: page - 1, size: MINE_PAGE_SIZE },
      }),
    {
      params: (): number => this.state.savedPage(),
      reloadOn: this.changes.saved,
    },
  );

  private readonly unsave = serverMutation(
    (contentId: number) =>
      this.client.call(communityEndpoints.setBookmark, {
        params: { contentId },
        body: { saved: false },
      }),
    {
      errors: 'toast',
      success: () => 'Đã bỏ lưu bài',
      invalidates: this.changes.saved,
    },
  );

  // Selectors
  readonly tab$ = this.state.tab.asReadonly();
  readonly kind$ = this.state.kind.asReadonly();
  readonly status$ = this.state.status.asReadonly();
  readonly minePage$ = this.state.minePage.asReadonly();
  readonly savedPage$ = this.state.savedPage.asReadonly();

  readonly mineRows$ = computed(() =>
    (this.state.shownMine()?.items ?? []).map(toRow),
  );
  readonly mineTotal$ = computed(
    () => this.state.shownMine()?.totalElements ?? 0,
  );
  readonly mineLoading$ = computed(
    () => this.mineData.isLoading() && this.state.shownMine() === undefined,
  );
  readonly mineError$ = this.mineData.error;
  readonly isFiltered$ = computed(
    () => !!(this.state.kind() || this.state.status()),
  );

  readonly saved$ = computed(() => this.state.shownSaved()?.items ?? []);
  readonly savedTotal$ = computed(
    () => this.state.shownSaved()?.totalElements ?? 0,
  );
  readonly savedLoading$ = computed(
    () => this.savedData.isLoading() && this.state.shownSaved() === undefined,
  );
  readonly savedError$ = this.savedData.error;
  readonly isUnsaving$ = this.unsave.isPending;

  // Setters
  private setTab(tab: MineTab): void {
    this.state.tab.set(tab);
  }

  private setKind(kind: string): void {
    this.state.kind.set(kind);
  }

  private setStatus(status: MineStatus): void {
    this.state.status.set(status);
  }

  private setMinePage(page: number): void {
    this.state.minePage.set(page);
  }

  private setSavedPage(page: number): void {
    this.state.savedPage.set(page);
  }

  // Commands
  showTab(tab: MineTab): void {
    this.setTab(tab);
    this.syncUrl();
  }

  filterKind(value: string): void {
    this.setKind(KINDS.includes(value as (typeof KINDS)[number]) ? value : '');
    this.setMinePage(1);
    this.syncUrl();
  }

  filterStatus(value: string): void {
    this.setStatus(
      STATUSES.includes(value as MineStatus) ? (value as MineStatus) : '',
    );
    this.setMinePage(1);
    this.syncUrl();
  }

  clearFilters(): void {
    this.setKind('');
    this.setStatus('');
    this.setMinePage(1);
    this.syncUrl();
  }

  goToMinePage(page: number): void {
    this.setMinePage(page);
  }

  goToSavedPage(page: number): void {
    this.setSavedPage(page);
  }

  unsaveContent(contentId: number): void {
    this.unsave.run(contentId);
  }

  retryMine(): void {
    this.mineData.reload();
  }

  retrySaved(): void {
    this.savedData.reload();
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: this.state.tab() === 'saved' ? 'saved' : null,
        kind: this.state.kind() || null,
        status: this.state.status() || null,
      },
      replaceUrl: true,
    });
  }
}
