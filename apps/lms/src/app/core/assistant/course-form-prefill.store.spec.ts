import { TestBed } from '@angular/core/testing';
import { CourseFormPrefillStore } from './course-form-prefill.store';

describe('CourseFormPrefillStore', () => {
  it('hands the prefill over once and is empty afterwards', () => {
    const store = TestBed.inject(CourseFormPrefillStore);
    const file = new File(['x'], 'q.md');
    store.set({ file, fields: { title: 'Khóa thử' } });

    expect(store.take()).toEqual({ file, fields: { title: 'Khóa thử' } });
    expect(store.take()).toBeNull();
  });

  it('is empty when nothing was set, and clear drops what waits', () => {
    const store = TestBed.inject(CourseFormPrefillStore);
    expect(store.take()).toBeNull();

    store.set({ file: null, fields: {} });
    store.clear();
    expect(store.take()).toBeNull();
  });
});
