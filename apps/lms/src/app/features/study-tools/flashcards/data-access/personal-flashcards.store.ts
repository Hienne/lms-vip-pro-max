import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { personalFlashcardEndpoints, type PersonalCard } from '@lms/contracts';
import { confirm, type SegmentedOption } from '@lms/ui';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { filter, map } from 'rxjs';

@Injectable()
export class PersonalFlashcardsStore {
  private readonly client = inject(EndpointClient);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = {
    deckId: signal(0),
    managing: signal(false),
    deckName: signal(''),
    editingDeck: signal(false),
    creatingDeck: signal(false),
    editingCard: signal<number | null>(null),
    addingMany: signal(false),
    draftError: signal(''),
    drafts: signal([
      { key: 1, prompt: '', answer: '' },
      { key: 2, prompt: '', answer: '' },
    ]),
    prompt: signal(''),
    answer: signal(''),
    round: signal<readonly PersonalCard[] | null>(null),
    index: signal(0),
    rated: signal<ReadonlyMap<number, 'AGAIN' | 'KNOWN'>>(new Map()),
    revealed: signal(false),
    scope: signal('all'),
    shuffle: signal(false),
  };
  private nextKey = 3;
  private readonly saveMany = serverMutation(
    (items: readonly { prompt: string; answer: string }[]) =>
      this.client.call(personalFlashcardEndpoints.createCards, {
        params: { deckId: this.state.deckId() },
        body: {
          items: items.map((item) => ({
            prompt: item.prompt.trim(),
            answer: item.answer.trim(),
            competencyId: null,
          })),
        },
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        this.cards.reload();
        this.decks.reload();
        this.setAddingMany(false);
        this.setDrafts([
          { key: this.nextKey++, prompt: '', answer: '' },
          { key: this.nextKey++, prompt: '', answer: '' },
        ]);
      },
    },
  );
  private readonly decks = serverData(() =>
    this.client.call(personalFlashcardEndpoints.decks),
  );
  private readonly cards = serverData(
    (deckId: number) =>
      this.client.call(personalFlashcardEndpoints.cards, {
        params: { deckId },
      }),
    { params: () => this.state.deckId() || undefined },
  );
  private readonly saveDeck = serverMutation(
    (value: { id: number; name: string }) =>
      value.id
        ? this.client.call(personalFlashcardEndpoints.updateDeck, {
            params: { deckId: value.id },
            body: {
              name: value.name,
              courseId:
                this.decks.value()?.find((deck) => deck.id === value.id)
                  ?.courseId ?? null,
            },
          })
        : this.client.call(personalFlashcardEndpoints.createDeck, {
            body: { name: value.name, courseId: null },
          }),
    {
      errors: 'toast',
      onSuccess: (deck) => {
        this.setDeckId(deck.id);
        this.setManaging(true);
        this.decks.reload();
        this.setEditingDeck(false);
        this.setCreatingDeck(false);
        this.setDeckName('');
      },
    },
  );
  private readonly removeDeck = serverMutation(
    (deckId: number) =>
      this.client.call(personalFlashcardEndpoints.deleteDeck, {
        params: { deckId },
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        this.setDeckId(0);
        this.decks.reload();
      },
    },
  );
  private readonly saveCard = serverMutation(
    (value: { id: number | null; prompt: string; answer: string }) => {
      const body = {
        prompt: value.prompt,
        answer: value.answer,
        competencyId:
          this.cards.value()?.find((card) => card.id === value.id)
            ?.competencyId ?? null,
      };
      return value.id
        ? this.client.call(personalFlashcardEndpoints.updateCard, {
            params: { deckId: this.state.deckId(), cardId: value.id },
            body,
          })
        : this.client.call(personalFlashcardEndpoints.createCard, {
            params: { deckId: this.state.deckId() },
            body,
          });
    },
    {
      errors: 'toast',
      onSuccess: () => {
        this.cards.reload();
        this.decks.reload();
        this.setEditingCard(null);
        this.setPrompt('');
        this.setAnswer('');
      },
    },
  );
  private readonly removeCard = serverMutation(
    (cardId: number) =>
      this.client.call(personalFlashcardEndpoints.deleteCard, {
        params: { deckId: this.state.deckId(), cardId },
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        this.cards.reload();
        this.decks.reload();
      },
    },
  );
  private readonly progress = serverMutation(
    (value: {
      cardId: number;
      rating?: 'AGAIN' | 'KNOWN';
      starred?: boolean;
    }) =>
      this.client
        .call(personalFlashcardEndpoints.progress, {
          params: { deckId: this.state.deckId(), cardId: value.cardId },
          body: { rating: value.rating, starred: value.starred },
        })
        .pipe(map((card) => ({ card, rating: value.rating }))),
    {
      errors: 'toast',
      onSuccess: ({ card, rating }) => {
        if (rating) {
          this.setRatedWith((values) => new Map(values).set(card.id, rating));
          this.setIndexWith((i) => i + 1);
          this.setRevealed(false);
        }
        this.setRoundWith(
          (cards) =>
            cards?.map((item) => (item.id === card.id ? card : item)) ?? null,
        );
        this.cards.reload();
      },
    },
  );
  readonly scopeOptions: readonly SegmentedOption<string>[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'due', label: 'Cần ôn' },
    { value: 'starred', label: 'Đã đánh dấu', icon: 'star' },
  ];
  readonly current$ = computed(() => this.state.round()?.[this.state.index()]);
  readonly answerLines$ = computed(() => {
    const card = this.current$();
    return card ? [card.answer] : [];
  });
  readonly studying$ = computed(() => this.state.round() !== null);
  readonly selectedDeckName$ = computed(
    () =>
      this.decks.value()?.find((d) => d.id === this.state.deckId())?.name ??
      'Bộ thẻ của tôi',
  );
  readonly deckCount$ = computed(() => this.decks.value()?.length ?? null);
  readonly knownCount$ = computed(
    () => [...this.state.rated().values()].filter((v) => v === 'KNOWN').length,
  );
  readonly againCount$ = computed(
    () => [...this.state.rated().values()].filter((v) => v === 'AGAIN').length,
  );
  readonly availableCards$ = computed(() =>
    (this.cards.value() ?? []).filter(
      (card) =>
        (this.state.scope() !== 'due' || card.reviewStatus !== 'KNOWN') &&
        (this.state.scope() !== 'starred' || card.starred),
    ),
  );
  readonly deckId$ = this.state.deckId.asReadonly();
  readonly managing$ = this.state.managing.asReadonly();
  readonly deckName$ = this.state.deckName.asReadonly();
  readonly editingDeck$ = this.state.editingDeck.asReadonly();
  readonly creatingDeck$ = this.state.creatingDeck.asReadonly();
  readonly editingCard$ = this.state.editingCard.asReadonly();
  readonly addingMany$ = this.state.addingMany.asReadonly();
  readonly draftError$ = this.state.draftError.asReadonly();
  readonly drafts$ = this.state.drafts.asReadonly();
  readonly prompt$ = this.state.prompt.asReadonly();
  readonly answer$ = this.state.answer.asReadonly();
  readonly round$ = this.state.round.asReadonly();
  readonly index$ = this.state.index.asReadonly();
  readonly rated$ = this.state.rated.asReadonly();
  readonly revealed$ = this.state.revealed.asReadonly();
  readonly scope$ = this.state.scope.asReadonly();
  readonly shuffle$ = this.state.shuffle.asReadonly();
  readonly decks$ = this.decks.value;
  readonly decksLoading$ = this.decks.isLoading;
  readonly decksError$ = this.decks.error;
  readonly cards$ = this.cards.value;
  readonly cardsLoading$ = this.cards.isLoading;
  readonly cardsError$ = this.cards.error;
  readonly saveManyPending$ = this.saveMany.isPending;
  readonly saveDeckPending$ = this.saveDeck.isPending;
  readonly removeDeckPending$ = this.removeDeck.isPending;
  readonly saveCardPending$ = this.saveCard.isPending;
  readonly removeCardPending$ = this.removeCard.isPending;
  readonly progressPending$ = this.progress.isPending;
  setDeckId(value: Parameters<typeof this.state.deckId.set>[0]): void {
    this.state.deckId.set(value);
  }
  setManaging(value: Parameters<typeof this.state.managing.set>[0]): void {
    this.state.managing.set(value);
  }
  setDeckName(value: Parameters<typeof this.state.deckName.set>[0]): void {
    this.state.deckName.set(value);
  }
  setEditingDeck(
    value: Parameters<typeof this.state.editingDeck.set>[0],
  ): void {
    this.state.editingDeck.set(value);
  }
  setCreatingDeck(
    value: Parameters<typeof this.state.creatingDeck.set>[0],
  ): void {
    this.state.creatingDeck.set(value);
  }
  setEditingCard(
    value: Parameters<typeof this.state.editingCard.set>[0],
  ): void {
    this.state.editingCard.set(value);
  }
  setAddingMany(value: Parameters<typeof this.state.addingMany.set>[0]): void {
    this.state.addingMany.set(value);
  }
  setDraftError(value: Parameters<typeof this.state.draftError.set>[0]): void {
    this.state.draftError.set(value);
  }
  setDrafts(value: Parameters<typeof this.state.drafts.set>[0]): void {
    this.state.drafts.set(value);
  }
  private setDraftsWith(
    update: Parameters<typeof this.state.drafts.update>[0],
  ): void {
    this.state.drafts.update(update);
  }
  setPrompt(value: Parameters<typeof this.state.prompt.set>[0]): void {
    this.state.prompt.set(value);
  }
  setAnswer(value: Parameters<typeof this.state.answer.set>[0]): void {
    this.state.answer.set(value);
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
  setRated(value: Parameters<typeof this.state.rated.set>[0]): void {
    this.state.rated.set(value);
  }
  private setRatedWith(
    update: Parameters<typeof this.state.rated.update>[0],
  ): void {
    this.state.rated.update(update);
  }
  setRevealed(value: Parameters<typeof this.state.revealed.set>[0]): void {
    this.state.revealed.set(value);
  }
  setScope(value: Parameters<typeof this.state.scope.set>[0]): void {
    this.state.scope.set(value);
  }
  setShuffle(value: Parameters<typeof this.state.shuffle.set>[0]): void {
    this.state.shuffle.set(value);
  }
  addDraft(): void {
    if (this.state.drafts().length < 100)
      this.setDraftsWith((items) => [
        ...items,
        { key: this.nextKey++, prompt: '', answer: '' },
      ]);
  }
  updateDraft(key: number, field: 'prompt' | 'answer', value: string): void {
    this.setDraftsWith((items) =>
      items.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  }
  removeDraft(key: number): void {
    this.setDraftsWith((items) => items.filter((item) => item.key !== key));
  }
  submitDrafts(): void {
    const items = this.state
      .drafts()
      .filter((item) => item.prompt.trim() || item.answer.trim());
    if (
      !items.length ||
      items.some((item) => !item.prompt.trim() || !item.answer.trim())
    ) {
      this.setDraftError('Điền câu hỏi và đáp án cho các thẻ muốn lưu.');
      return;
    }
    this.setDraftError('');
    this.saveMany.run(items);
  }
  beginCreateDeck(): void {
    this.setCreatingDeck(true);
    this.setEditingDeck(false);
    this.setDeckName('');
  }
  revealCurrent(): void {
    if (this.current$() && !this.progress.isPending())
      this.setRevealed(!this.state.revealed());
  }
  rateCurrent(rating: 'AGAIN' | 'KNOWN'): void {
    const card = this.current$();
    if (card) this.rate(card, rating);
  }
  toggleCurrentStar(): void {
    const card = this.current$();
    if (card) this.runProgress({ cardId: card.id, starred: !card.starred });
  }
  finish(): void {
    if (this.progress.isPending()) return;
    this.setRound(null);
    this.cards.reload();
  }
  retryRound(): void {
    const cards =
      this.state
        .round()
        ?.filter((c) => this.state.rated().get(c.id) === 'AGAIN') ?? [];
    if (cards.length) this.beginRound(cards);
  }
  private beginRound(cards: readonly PersonalCard[]): void {
    if (!cards.length) return;
    this.setRated(new Map());
    this.setRound(cards);
    this.setIndex(0);
    this.setRevealed(false);
  }
  selectDeck(id: number, manage = false): void {
    this.setDeckId(id);
    this.setManaging(manage);
    this.setRound(null);
    this.setEditingDeck(false);
    this.setCreatingDeck(false);
    this.setEditingCard(null);
    this.setAddingMany(false);
    this.setDeckName('');
  }
  editCard(card: PersonalCard): void {
    this.setEditingCard(card.id);
    this.setPrompt(card.prompt);
    this.setAnswer(card.answer);
  }
  start(): void {
    const cards = [...this.availableCards$()];
    if (this.state.shuffle()) {
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
    }
    this.beginRound(cards);
  }
  deleteDeck(): void {
    const deckId = this.state.deckId();
    if (!deckId || this.removeDeck.isPending()) return;
    confirm(this.dialog, {
      title: 'Xóa bộ thẻ?',
      message: 'Toàn bộ thẻ trong bộ sẽ bị xóa.',
      confirmLabel: 'Xóa bộ thẻ',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.removeDeck.run(deckId));
  }
  deleteCard(card: PersonalCard): void {
    if (this.removeCard.isPending()) return;
    confirm(this.dialog, {
      title: 'Xóa thẻ?',
      message: 'Thẻ này sẽ bị xóa khỏi bộ thẻ.',
      confirmLabel: 'Xóa thẻ',
      tone: 'danger',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.removeCard.run(card.id));
  }
  rate(card: PersonalCard, rating: 'AGAIN' | 'KNOWN'): void {
    if (!this.state.revealed() || this.progress.isPending()) return;
    this.progress.run({ cardId: card.id, rating });
  }
  reloadDecks(): void {
    this.decks.reload();
  }
  reloadCards(): void {
    this.cards.reload();
  }
  runSaveMany(value: Parameters<typeof this.saveMany.run>[0]): void {
    this.saveMany.run(value);
  }
  runSaveDeck(value: Parameters<typeof this.saveDeck.run>[0]): void {
    this.saveDeck.run(value);
  }
  runRemoveDeck(value: Parameters<typeof this.removeDeck.run>[0]): void {
    this.removeDeck.run(value);
  }
  runSaveCard(value: Parameters<typeof this.saveCard.run>[0]): void {
    this.saveCard.run(value);
  }
  runRemoveCard(value: Parameters<typeof this.removeCard.run>[0]): void {
    this.removeCard.run(value);
  }
  runProgress(value: Parameters<typeof this.progress.run>[0]): void {
    if (this.progress.isPending()) return;
    this.progress.run(value);
  }
}
