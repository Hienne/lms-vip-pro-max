import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  PageHeader,
  Pagination,
} from '@lms/ui';
import { SavedStore } from './data-access/saved.store';
@Component({
  selector: 'app-saved',
  imports: [DatePipe, Button, Card, Empty, ErrorState, PageHeader, Pagination],
  providers: [SavedStore],
  templateUrl: './saved.html',
  styleUrl: './saved.scss',
})
export class Saved {
  protected readonly store = inject(SavedStore);
}
