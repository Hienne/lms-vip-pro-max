import { A11yModule } from '@angular/cdk/a11y';
import { PersonalFlashcards } from './personal-flashcards';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  flashcardEndpoints,
  learnerEndpoints,
  type FlashcardRating,
  type StudyFlashcard,
} from '@lms/contracts';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  Segmented,
  type SegmentedOption,
  PageHeader,
  Pagination,
  Search,
  Select,
} from '@lms/ui';
import { serverData } from '../../../core/data-access/server-data';
import { serverMutation } from '../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../core/http/endpoint-client';

type CardRequest = {
  courseId: number;
  cardId: number;
  questionVersion: number;
};
type RatingRequest = CardRequest & {
  rating?: FlashcardRating;
  starred?: boolean;
};

@Component({
  selector: 'app-flashcards',
  imports: [
    A11yModule,
    Button,
    Card,
    ErrorState,
    Icon,
    Segmented,
    PageHeader,
    Pagination,
    Search,
    Select,
    PersonalFlashcards,
  ],
  templateUrl: './flashcards.html',
  styleUrl: './flashcards.scss',
})
export class Flashcards {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  protected readonly source = signal(
    Number(this.route.snapshot.queryParamMap.get('courseId')) > 0
      ? 'course'
      : 'personal',
  );
  protected readonly sources: readonly SegmentedOption<string>[] = [
    { value: 'personal', label: 'Bộ thẻ của tôi', icon: 'user' },
    { value: 'course', label: 'Bộ thẻ khóa học', icon: 'book-open' },
  ];
  protected readonly scopeOptions: readonly SegmentedOption<string>[] = [
    { value: 'due', label: 'Cần ôn' },
    { value: 'all', label: 'Tất cả' },
    { value: 'starred', label: 'Đã đánh dấu', icon: 'star' },
  ];
  protected readonly pageSize = 20;
  protected readonly page = signal(1);
  protected readonly field = signal<number | undefined>(undefined);
  protected readonly program = signal<number | undefined>(undefined);
  protected readonly keyword = signal('');
  protected readonly courseId = signal(
    Number(this.route.snapshot.queryParamMap.get('courseId')) || 0,
  );
  protected readonly competency = signal(
    Number(this.route.snapshot.queryParamMap.get('competencyId')) || 0,
  );
  protected readonly mode = signal('due');
  protected readonly shuffle = signal(false);
  protected readonly round = signal<readonly StudyFlashcard[] | null>(null);
  protected readonly index = signal(0);
  protected readonly shown = signal<CardRequest | undefined>(undefined);
  protected readonly faceBack = signal(false);
  protected readonly rated = signal<ReadonlyMap<number, FlashcardRating>>(
    new Map(),
  );

  protected readonly facets = serverData(() =>
    this.client.call(learnerEndpoints.facets),
  );
  protected readonly courses = serverData(
    (query) => this.client.call(learnerEndpoints.myCourses, { query }),
    {
      params: () => ({
        page: this.page() - 1,
        size: this.pageSize,
        fieldId: this.field(),
        programId: this.program(),
        q: this.keyword().trim().slice(0, 100) || undefined,
      }),
    },
  );
  protected readonly programs = computed(() =>
    (this.facets.value()?.programs ?? []).filter(
      (program) => !this.field() || program.fieldId === this.field(),
    ),
  );
  protected readonly cards = serverData(
    (courseId: number) =>
      this.client.call(flashcardEndpoints.list, { params: { courseId } }),
    { params: () => this.courseId() || undefined },
  );
  protected readonly groups = computed(() =>
    Array.from(
      new Map(
        (this.cards.value() ?? []).map((card) => [
          card.competencyId,
          card.competencyName,
        ]),
      ),
    ),
  );
  protected readonly available = computed(() =>
    (this.cards.value() ?? []).filter(
      (card) =>
        (!this.competency() || card.competencyId === this.competency()) &&
        (this.mode() !== 'due' || card.reviewStatus !== 'KNOWN') &&
        (this.mode() !== 'starred' || card.starred),
    ),
  );
  protected readonly current = computed(() => this.round()?.[this.index()]);
  protected readonly answer = serverData(
    ({ courseId, cardId, questionVersion }: CardRequest) =>
      this.client.call(flashcardEndpoints.reveal, {
        params: { courseId, cardId },
        query: { questionVersion },
      }),
    { params: () => this.shown() },
  );
  protected readonly knownCount = computed(
    () =>
      [...this.rated().values()].filter((value) => value === 'KNOWN').length,
  );
  protected readonly againCount = computed(
    () =>
      [...this.rated().values()].filter((value) => value === 'AGAIN').length,
  );
  protected filterCourses(
    field: number | undefined,
    program: number | undefined,
    keyword: string,
  ): void {
    this.field.set(field);
    this.program.set(program);
    this.keyword.set(keyword);
    this.page.set(1);
    this.pickCourse(0);
  }

  protected pickCourse(id: number): void {
    this.courseId.set(id);
    this.competency.set(0);
    this.finish();
  }

  protected start(cards: readonly StudyFlashcard[]): void {
    const deck = [...cards];
    if (this.shuffle()) {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    this.rated.set(new Map());
    this.round.set(deck);
    this.move(0);
  }

  protected move(index: number): void {
    if (this.saveRating.isPending() || this.saveStar.isPending()) return;
    this.shown.set(undefined);
    this.faceBack.set(false);
    this.index.set(Math.max(0, Math.min(index, this.round()?.length ?? 0)));
  }

  protected reveal(card: StudyFlashcard): void {
    if (this.answer.value()) {
      this.faceBack.update((value) => !value);
      return;
    }
    this.faceBack.set(true);
    this.shown.set({
      courseId: this.courseId(),
      cardId: card.id,
      questionVersion: card.questionVersion,
    });
  }

  protected readonly saveRating = serverMutation(
    ({ courseId, cardId, ...body }: RatingRequest) =>
      this.client.call(flashcardEndpoints.progress, {
        params: { courseId, cardId },
        body,
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        const card = this.current();
        const rating = this.pendingRating();
        if (card && rating) {
          this.rated.update((values) => new Map(values).set(card.id, rating));
          this.shown.set(undefined);
          this.index.update((index) => index + 1);
        }
      },
    },
  );
  private readonly pendingRating = signal<FlashcardRating | undefined>(
    undefined,
  );

  protected submitRating(card: StudyFlashcard, rating: FlashcardRating): void {
    if (
      this.saveRating.isPending() ||
      this.saveStar.isPending() ||
      !this.answer.value()
    )
      return;
    this.pendingRating.set(rating);
    this.saveRating.run({
      courseId: this.courseId(),
      cardId: card.id,
      questionVersion: card.questionVersion,
      rating,
    });
  }

  protected readonly saveStar = serverMutation(
    ({ courseId, cardId, ...body }: RatingRequest) =>
      this.client.call(flashcardEndpoints.progress, {
        params: { courseId, cardId },
        body,
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        const id = this.current()?.id;
        this.round.update(
          (cards) =>
            cards?.map((card) =>
              card.id === id ? { ...card, starred: !card.starred } : card,
            ) ?? null,
        );
      },
    },
  );

  protected toggleStar(card: StudyFlashcard): void {
    this.saveStar.run({
      courseId: this.courseId(),
      cardId: card.id,
      questionVersion: card.questionVersion,
      starred: !card.starred,
    });
  }

  protected retryRound(): void {
    const cards =
      this.round()?.filter((card) => this.rated().get(card.id) === 'AGAIN') ??
      [];
    if (cards.length) this.start(cards);
  }

  protected finish(): void {
    this.round.set(null);
    this.shown.set(undefined);
    this.cards.reload();
  }
}
