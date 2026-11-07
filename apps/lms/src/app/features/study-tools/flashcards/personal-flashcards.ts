import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, inject, signal } from '@angular/core';
import { personalFlashcardEndpoints, type PersonalCard } from '@lms/contracts';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  Input,
  Select,
  Segmented,
  Textarea,
  type SegmentedOption,
} from '@lms/ui';
import { serverData } from '../../../core/data-access/server-data';
import { serverMutation } from '../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../core/http/endpoint-client';

@Component({
  selector: 'app-personal-flashcards',
  imports: [
    A11yModule,
    Button,
    Card,
    ErrorState,
    Icon,
    Input,
    Select,
    Segmented,
    Textarea,
  ],
  templateUrl: './personal-flashcards.html',
  styleUrl: './personal-flashcards.scss',
})
export class PersonalFlashcards {
  private readonly client = inject(EndpointClient);
  protected readonly scopeOptions: readonly SegmentedOption<string>[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'due', label: 'Cần ôn' },
    { value: 'starred', label: 'Đã đánh dấu', icon: 'star' },
  ];
  protected readonly deckId = signal(0);
  protected readonly managing = signal(false);
  protected readonly deckName = signal('');
  protected readonly editingDeck = signal(false);
  protected readonly creatingDeck = signal(false);
  protected readonly editingCard = signal<number | null>(null);
  protected readonly addingMany = signal(false);
  protected readonly draftError = signal('');
  protected readonly drafts = signal([
    { key: 1, prompt: '', answer: '' },
    { key: 2, prompt: '', answer: '' },
  ]);
  private nextKey = 3;
  protected addDraft(): void {
    if (this.drafts().length < 100)
      this.drafts.update((items) => [
        ...items,
        { key: this.nextKey++, prompt: '', answer: '' },
      ]);
  }
  protected updateDraft(
    key: number,
    field: 'prompt' | 'answer',
    value: string,
  ): void {
    this.drafts.update((items) =>
      items.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  }
  protected removeDraft(key: number): void {
    this.drafts.update((items) => items.filter((item) => item.key !== key));
  }
  protected readonly saveMany = serverMutation(
    (items: readonly { prompt: string; answer: string }[]) =>
      this.client.call(personalFlashcardEndpoints.createCards, {
        params: { deckId: this.deckId() },
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
        this.addingMany.set(false);
        this.drafts.set([
          { key: this.nextKey++, prompt: '', answer: '' },
          { key: this.nextKey++, prompt: '', answer: '' },
        ]);
      },
    },
  );
  protected submitDrafts(): void {
    const items = this.drafts().filter(
      (item) => item.prompt.trim() || item.answer.trim(),
    );
    if (
      !items.length ||
      items.some((item) => !item.prompt.trim() || !item.answer.trim())
    ) {
      this.draftError.set('Điền câu hỏi và đáp án cho các thẻ muốn lưu.');
      return;
    }
    this.draftError.set('');
    this.saveMany.run(items);
  }
  protected readonly prompt = signal('');
  protected readonly answer = signal('');
  protected readonly round = signal<readonly PersonalCard[] | null>(null);
  protected readonly index = signal(0);
  protected readonly revealed = signal(false);
  protected readonly scope = signal('all');
  protected readonly shuffle = signal(false);
  protected readonly decks = serverData(() =>
    this.client.call(personalFlashcardEndpoints.decks),
  );
  protected readonly cards = serverData(
    (deckId: number) =>
      this.client.call(personalFlashcardEndpoints.cards, {
        params: { deckId },
      }),
    { params: () => this.deckId() || undefined },
  );
  protected readonly saveDeck = serverMutation(
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
        this.deckId.set(deck.id);
        this.managing.set(true);
        this.decks.reload();
        this.editingDeck.set(false);
        this.creatingDeck.set(false);
        this.deckName.set('');
      },
    },
  );
  protected readonly removeDeck = serverMutation(
    (deckId: number) =>
      this.client.call(personalFlashcardEndpoints.deleteDeck, {
        params: { deckId },
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        this.deckId.set(0);
        this.decks.reload();
      },
    },
  );
  protected readonly saveCard = serverMutation(
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
            params: { deckId: this.deckId(), cardId: value.id },
            body,
          })
        : this.client.call(personalFlashcardEndpoints.createCard, {
            params: { deckId: this.deckId() },
            body,
          });
    },
    {
      errors: 'toast',
      onSuccess: () => {
        this.cards.reload();
        this.decks.reload();
        this.editingCard.set(null);
        this.prompt.set('');
        this.answer.set('');
      },
    },
  );
  protected readonly removeCard = serverMutation(
    (cardId: number) =>
      this.client.call(personalFlashcardEndpoints.deleteCard, {
        params: { deckId: this.deckId(), cardId },
      }),
    {
      errors: 'toast',
      onSuccess: () => {
        this.cards.reload();
        this.decks.reload();
      },
    },
  );
  protected readonly progress = serverMutation(
    (value: {
      cardId: number;
      rating?: 'AGAIN' | 'KNOWN';
      starred?: boolean;
    }) =>
      this.client.call(personalFlashcardEndpoints.progress, {
        params: { deckId: this.deckId(), cardId: value.cardId },
        body: { rating: value.rating, starred: value.starred },
      }),
    {
      errors: 'toast',
      onSuccess: (card) => {
        this.round.update(
          (cards) =>
            cards?.map((item) => (item.id === card.id ? card : item)) ?? null,
        );
        this.cards.reload();
      },
    },
  );
  protected selectDeck(id: number, manage = false): void {
    this.deckId.set(id);
    this.managing.set(manage);
    this.round.set(null);
    this.editingDeck.set(false);
    this.creatingDeck.set(false);
    this.editingCard.set(null);
    this.addingMany.set(false);
    this.deckName.set('');
  }

  protected editCard(card: PersonalCard): void {
    this.editingCard.set(card.id);
    this.prompt.set(card.prompt);
    this.answer.set(card.answer);
  }
  protected readonly availableCards = computed(() =>
    (this.cards.value() ?? []).filter(
      (card) =>
        (this.scope() !== 'due' || card.reviewStatus !== 'KNOWN') &&
        (this.scope() !== 'starred' || card.starred),
    ),
  );

  protected start(): void {
    const cards = [...this.availableCards()];
    if (this.shuffle()) {
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
    }
    this.round.set(cards);
    this.index.set(0);
    this.revealed.set(false);
  }
  protected deleteDeck(): void {
    if (window.confirm('Xóa bộ thẻ và toàn bộ thẻ trong bộ?'))
      this.removeDeck.run(this.deckId());
  }
  protected deleteCard(card: PersonalCard): void {
    if (window.confirm('Xóa thẻ này?')) this.removeCard.run(card.id);
  }
  protected rate(card: PersonalCard, rating: 'AGAIN' | 'KNOWN'): void {
    this.progress.run({ cardId: card.id, rating });
  }
}
