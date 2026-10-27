import { Component, inject, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  form,
  FormField,
  required,
  maxLength,
  submit,
} from '@angular/forms/signals';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Empty,
  ErrorState,
  Field,
  FmtTimePipe,
  Icon,
  Input,
  Tabs,
  TabPanel,
  Textarea,
} from '@lms/ui';
import { LessonStore } from './data-access/lesson.store';
@Component({
  selector: 'app-lesson',
  imports: [
    RouterLink,
    FormField,
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    Empty,
    ErrorState,
    Field,
    FmtTimePipe,
    Icon,
    Input,
    Tabs,
    TabPanel,
    Textarea,
  ],
  providers: [LessonStore],
  templateUrl: './lesson.html',
  styleUrl: './lesson.scss',
})
export class Lesson {
  protected readonly store = inject(LessonStore);
  private readonly noteModel = linkedSignal(() => {
    this.store.noteRevision$();
    return { text: '' };
  });
  protected readonly noteForm = form(this.noteModel, (path) => {
    required(path.text, { message: 'Nhập nội dung ghi chú.' });
    maxLength(path.text, 4000, { message: 'Ghi chú tối đa 4000 ký tự.' });
  });
  protected saveNote(event: Event): void {
    event.preventDefault();
    void submit(this.noteForm, async () =>
      this.store.saveNote(this.noteModel().text),
    );
  }
}
