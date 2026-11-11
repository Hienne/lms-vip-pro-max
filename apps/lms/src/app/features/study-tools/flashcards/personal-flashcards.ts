import { Component, inject } from '@angular/core';
import {
  Button,
  Card,
  CardBody,
  ErrorState,
  Icon,
  Input,
  Segmented,
  Textarea,
  SectionCard,
  Checkbox,
  Empty,
} from '@lms/ui';
import { StudySession } from './components/study-session/study-session';
import { PersonalFlashcardsStore } from './data-access/personal-flashcards.store';

@Component({
  selector: 'app-personal-flashcards',
  imports: [
    Button,
    Card,
    CardBody,
    ErrorState,
    Icon,
    Input,
    Segmented,
    Textarea,
    SectionCard,
    Checkbox,
    Empty,
    StudySession,
  ],
  providers: [PersonalFlashcardsStore],
  templateUrl: './personal-flashcards.html',
  styleUrl: './personal-flashcards.scss',
})
export class PersonalFlashcards {
  protected readonly store = inject(PersonalFlashcardsStore);
  readonly studying$ = this.store.studying$;
  readonly deckCount$ = this.store.deckCount$;
  createDeck(): void {
    this.store.beginCreateDeck();
  }
}
