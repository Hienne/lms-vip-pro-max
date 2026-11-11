import { Component, inject, viewChild } from '@angular/core';
import {
  Button,
  ErrorState,
  Icon,
  Select,
  Segmented,
  SectionCard,
  Checkbox,
  PageHeader,
  Pagination,
  Search,
} from '@lms/ui';
import { StudySession } from './components/study-session/study-session';
import { FlashcardsStore } from './data-access/flashcards.store';
import { PersonalFlashcards } from './personal-flashcards';
@Component({
  selector: 'app-flashcards',
  imports: [
    Button,
    ErrorState,
    Icon,
    Select,
    Segmented,
    SectionCard,
    Checkbox,
    PageHeader,
    Pagination,
    Search,
    StudySession,
    PersonalFlashcards,
  ],
  providers: [FlashcardsStore],
  templateUrl: './flashcards.html',
  styleUrl: './flashcards.scss',
})
export class Flashcards {
  protected readonly store = inject(FlashcardsStore);
  protected readonly personal = viewChild(PersonalFlashcards);
}
