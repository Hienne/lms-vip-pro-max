import { TestBed } from '@angular/core/testing';
import { RemindersChanged } from './reminders-changed';

describe('RemindersChanged', () => {
  it('counts the changes, from zero, and is one token for the whole app', () => {
    const token = TestBed.inject(RemindersChanged);
    expect(token.version()).toBe(0);
    token.bump();
    token.bump();
    expect(TestBed.inject(RemindersChanged).version()).toBe(2);
  });
});
