import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  flashcardEndpoints,
  learnerEndpoints,
  type FlashcardRating,
  type StudyFlashcard,
} from '@lms/contracts';
import type { SegmentedOption } from '@lms/ui';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
type CardRequest = {
  courseId: number;
  cardId: number;
  questionVersion: number;
};
type RatingRequest = CardRequest & {
  rating?: FlashcardRating;
  starred?: boolean;
};

@Injectable()
export class FlashcardsStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly state = {
    source: signal(
      Number(this.route.snapshot.queryParamMap.get('courseId')) > 0
        ? 'course'
        : 'personal',
    ),
    page: signal(1),
    field: signal<number | undefined>(undefined),
    program: signal<number | undefined>(undefined),
    keyword: signal(''),
    courseId: signal(
      Number(this.route.snapshot.queryParamMap.get('courseId')) || 0,
    ),
    competency: signal(
      Number(this.route.snapshot.queryParamMap.get('competencyId')) || 0,
    ),
    mode: signal('due'),
    shuffle: signal(false),
    round: signal<readonly StudyFlashcard[] | null>(null),
    index: signal(0),
    shown: signal<CardRequest | undefined>(undefined),
    faceBack: signal(false),
    rated: signal<ReadonlyMap<number, FlashcardRating>>(new Map()),
    pendingRating: signal<FlashcardRating | undefined>(undefined),
  };
  private readonly facets = serverData(() =>
    this.client.call(learnerEndpoints.facets),
  );
  private readonly courses = serverData(
    (query) => this.client.call(learnerEndpoints.myCourses, { query }),
    {
      params: () => ({
        page: this.state.page() - 1,
        size: this.pageSize,
        fieldId: this.state.field(),
        programId: this.state.program(),
        q: this.state.keyword().trim().slice(0, 100) || undefined,
      }),
    },
  );
  private readonly cards = serverData(
    (courseId: number) =>
      this.client.call(flashcardEndpoints.list, { params: { courseId } }),
    { params: () => this.state.courseId() || undefined },
  );
  private readonly answer = serverData(
    ({ courseId, cardId, questionVersion }: CardRequest) =>
      this.client.call(flashcardEndpoints.reveal, {
        params: { courseId, cardId },
        query: { questionVersion },
      }),
    { params: () => this.state.shown() },
  );
  private readonly saveRating = serverMutation(
    ({ courseId, cardId, ...body }: RatingRequest) =>
      this.client.call(flashcardEndpoints.progress, {
        params: { courseId, cardId },
        body,
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        const card = this.current$();
        const rating = this.state.pendingRating();
        if (card && rating) {
          this.setRatedWith((values) => new Map(values).set(card.id, rating));
          this.setShown(undefined);
          this.setIndexWith((index) => index + 1);
        }
      },
    },
  );
  private readonly saveStar = serverMutation(
    ({ courseId, cardId, ...body }: RatingRequest) =>
      this.client.call(flashcardEndpoints.progress, {
        params: { courseId, cardId },
        body,
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        const id = this.current$()?.id;
        this.setRoundWith(
          (cards) =>
            cards?.map((card) =>
              card.id === id ? { ...card, starred: !card.starred } : card,
            ) ?? null,
        );
      },
    },
  );
  readonly sources: readonly SegmentedOption<string>[] = [
    { value: 'personal', label: 'Bộ thẻ của tôi', icon: 'user' },
    { value: 'course', label: 'Bộ thẻ khóa học', icon: 'book-open' },
  ];
  readonly scopeOptions: readonly SegmentedOption<string>[] = [
    { value: 'due', label: 'Cần ôn' },
    { value: 'all', label: 'Tất cả' },
    { value: 'starred', label: 'Đã đánh dấu', icon: 'star' },
  ];
  readonly pageSize = 20;
  readonly programs$ = computed(() =>
    (this.facets.value()?.programs ?? []).filter(
      (program) =>
        !this.state.field() || program.fieldId === this.state.field(),
    ),
  );
  readonly groups$ = computed(() =>
    Array.from(
      new Map(
        (this.cards.value() ?? []).map((card) => [
          card.competencyId,
          card.competencyName,
        ]),
      ),
    ),
  );
  readonly available$ = computed(() =>
    (this.cards.value() ?? []).filter(
      (card) =>
        (!this.state.competency() ||
          card.competencyId === this.state.competency()) &&
        (this.state.mode() !== 'due' || card.reviewStatus !== 'KNOWN') &&
        (this.state.mode() !== 'starred' || card.starred),
    ),
  );
  readonly roundName$ = computed(
    () =>
      this.courses
        .value()
        ?.items.find((c) => c.courseId === this.state.courseId())?.title ??
      'Bộ thẻ khóa học',
  );
  readonly current$ = computed(() => this.state.round()?.[this.state.index()]);
  readonly knownCount$ = computed(
    () =>
      [...this.state.rated().values()].filter((value) => value === 'KNOWN')
        .length,
  );
  readonly againCount$ = computed(
    () =>
      [...this.state.rated().values()].filter((value) => value === 'AGAIN')
        .length,
  );
  readonly source$ = this.state.source.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly field$ = this.state.field.asReadonly();
  readonly program$ = this.state.program.asReadonly();
  readonly keyword$ = this.state.keyword.asReadonly();
  readonly courseId$ = this.state.courseId.asReadonly();
  readonly competency$ = this.state.competency.asReadonly();
  readonly mode$ = this.state.mode.asReadonly();
  readonly shuffle$ = this.state.shuffle.asReadonly();
  readonly round$ = this.state.round.asReadonly();
  readonly index$ = this.state.index.asReadonly();
  readonly shown$ = this.state.shown.asReadonly();
  readonly faceBack$ = this.state.faceBack.asReadonly();
  readonly rated$ = this.state.rated.asReadonly();
  readonly pendingRating$ = this.state.pendingRating.asReadonly();
  readonly facets$ = this.facets.value;
  readonly facetsLoading$ = this.facets.isLoading;
  readonly facetsError$ = this.facets.error;
  readonly courses$ = this.courses.value;
  readonly coursesLoading$ = this.courses.isLoading;
  readonly coursesError$ = this.courses.error;
  readonly cards$ = this.cards.value;
  readonly cardsLoading$ = this.cards.isLoading;
  readonly cardsError$ = this.cards.error;
  readonly answer$ = this.answer.value;
  readonly answerLoading$ = this.answer.isLoading;
  readonly answerError$ = this.answer.error;
  readonly saveRatingPending$ = this.saveRating.isPending;
  readonly saveStarPending$ = this.saveStar.isPending;
  setSource(value: Parameters<typeof this.state.source.set>[0]): void {
    this.state.source.set(value);
  }
  setPage(value: Parameters<typeof this.state.page.set>[0]): void {
    this.state.page.set(value);
  }
  setField(value: Parameters<typeof this.state.field.set>[0]): void {
    this.state.field.set(value);
  }
  setProgram(value: Parameters<typeof this.state.program.set>[0]): void {
    this.state.program.set(value);
  }
  setKeyword(value: Parameters<typeof this.state.keyword.set>[0]): void {
    this.state.keyword.set(value);
  }
  setCourseId(value: Parameters<typeof this.state.courseId.set>[0]): void {
    this.state.courseId.set(value);
  }
  setCompetency(value: Parameters<typeof this.state.competency.set>[0]): void {
    this.state.competency.set(value);
  }
  setMode(value: Parameters<typeof this.state.mode.set>[0]): void {
    this.state.mode.set(value);
  }
  setShuffle(value: Parameters<typeof this.state.shuffle.set>[0]): void {
    this.state.shuffle.set(value);
  }
  setRound(value: Parameters<typeof this.state.round.set>[0]): void {
    this.state.round.set(value);
  }
  private setRoundWith(
    update: Parameters<typeof this.state.round.update>[0],
  ): void {
    this.state.round.update(update);
  }
  setIndex(value: Parameters<typeof this.state.index.set>[0]): void {
    this.state.index.set(value);
  }
  private setIndexWith(
    update: Parameters<typeof this.state.index.update>[0],
  ): void {
    this.state.index.update(update);
  }
  setShown(value: Parameters<typeof this.state.shown.set>[0]): void {
    this.state.shown.set(value);
  }
  setFaceBack(value: Parameters<typeof this.state.faceBack.set>[0]): void {
    this.state.faceBack.set(value);
  }
  private setFaceBackWith(
    update: Parameters<typeof this.state.faceBack.update>[0],
  ): void {
    this.state.faceBack.update(update);
  }
  setRated(value: Parameters<typeof this.state.rated.set>[0]): void {
    this.state.rated.set(value);
  }
  private setRatedWith(
    update: Parameters<typeof this.state.rated.update>[0],
  ): void {
    this.state.rated.update(update);
  }
  setPendingRating(
    value: Parameters<typeof this.state.pendingRating.set>[0],
  ): void {
    this.state.pendingRating.set(value);
  }
  filterCourses(
    field: number | undefined,
    program: number | undefined,
    keyword: string,
  ): void {
    this.setField(field);
    this.setProgram(program);
    this.setKeyword(keyword);
    this.setPage(1);
    this.pickCourse(0);
  }
  pickCourse(id: number): void {
    this.setCourseId(id);
    this.setCompetency(0);
    this.finish();
  }
  start(cards: readonly StudyFlashcard[]): void {
    if (!cards.length) return;
    const deck = [...cards];
    if (this.state.shuffle()) {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    this.setRated(new Map());
    this.setRound(deck);
    this.move(0);
  }
  move(index: number): void {
    if (this.saveRating.isPending() || this.saveStar.isPending()) return;
    this.setShown(undefined);
    this.setFaceBack(false);
    this.setIndex(
      Math.max(0, Math.min(index, this.state.round()?.length ?? 0)),
    );
  }
  reveal(card: StudyFlashcard): void {
    if (this.answer.value()) {
      this.setFaceBackWith((value) => !value);
      return;
    }
    this.setFaceBack(true);
    this.setShown({
      courseId: this.state.courseId(),
      cardId: card.id,
      questionVersion: card.questionVersion,
    });
  }
  revealCurrent(): void {
    const card = this.current$();
    if (card) this.reveal(card);
  }
  rateCurrent(rating: FlashcardRating): void {
    const card = this.current$();
    if (card) this.submitRating(card, rating);
  }
  toggleCurrentStar(): void {
    const card = this.current$();
    if (card) this.toggleStar(card);
  }
  submitRating(card: StudyFlashcard, rating: FlashcardRating): void {
    if (
      this.saveRating.isPending() ||
      this.saveStar.isPending() ||
      !this.state.faceBack() ||
      !this.answer.value()
    )
      return;
    this.setPendingRating(rating);
    this.saveRating.run({
      courseId: this.state.courseId(),
      cardId: card.id,
      questionVersion: card.questionVersion,
      rating,
    });
  }
  toggleStar(card: StudyFlashcard): void {
    if (this.saveStar.isPending() || this.saveRating.isPending()) return;
    this.saveStar.run({
      courseId: this.state.courseId(),
      cardId: card.id,
      questionVersion: card.questionVersion,
      starred: !card.starred,
    });
  }
  retryRound(): void {
    const cards =
      this.state
        .round()
        ?.filter((card) => this.state.rated().get(card.id) === 'AGAIN') ?? [];
    if (cards.length) this.start(cards);
  }
  finish(): void {
    this.setRound(null);
    this.setShown(undefined);
    this.cards.reload();
  }
  reloadFacets(): void {
    this.facets.reload();
  }
  reloadCourses(): void {
    this.courses.reload();
  }
  reloadCards(): void {
    this.cards.reload();
  }
  reloadAnswer(): void {
    this.answer.reload();
  }
  runSaveRating(value: Parameters<typeof this.saveRating.run>[0]): void {
    this.saveRating.run(value);
  }
  runSaveStar(value: Parameters<typeof this.saveStar.run>[0]): void {
    this.saveStar.run(value);
  }
}
