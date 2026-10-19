import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, Card, Icon, Input, PageHeader, Textarea } from '@lms/ui';
import { LessonStore } from './data-access/lesson.store';

@Component({
  selector: 'app-lesson',
  imports: [RouterLink, Button, Card, Icon, Input, PageHeader, Textarea],
  providers: [LessonStore],
  templateUrl: './lesson.html',
  styleUrl: './lesson.scss',
})
export class Lesson {
  protected readonly store = inject(LessonStore);
}
