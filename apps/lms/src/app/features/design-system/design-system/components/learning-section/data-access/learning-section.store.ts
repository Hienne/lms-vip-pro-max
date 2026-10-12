import { Injectable, signal } from '@angular/core';

@Injectable()
export class LearningSectionStore {
  private readonly state = {
    lessonRating: signal(0),
  };

  readonly lessonRating$ = this.state.lessonRating.asReadonly();

  setLessonRating(stars: number): void {
    this.state.lessonRating.set(stars);
  }
}
