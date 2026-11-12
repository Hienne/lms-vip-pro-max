import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { LessonTextEditor } from './lesson-text-editor';

describe('LessonTextEditor inline HTML', () => {
  it('resolves a saved image after the editor inserts its initial HTML and releases it on close', () => {
    const original = {
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
    };
    URL.createObjectURL = vi.fn(() => 'blob:lesson-image');
    URL.revokeObjectURL = vi.fn();
    const readImage = vi.fn(() =>
      of(new Blob(['image'], { type: 'image/png' })),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: EndpointClient, useValue: { call: readImage } }],
    });
    const fixture = TestBed.createComponent(LessonTextEditor);
    try {
      fixture.componentRef.setInput('format', 'html');
      fixture.componentRef.setInput(
        'value',
        '<p>Bài học</p><img data-asset-id="42" alt="Sơ đồ">',
      );
      fixture.componentRef.setInput('assets', [
        { assetId: 42, usage: 'image', name: 'anh.png', sizeBytes: 5 },
      ]);
      fixture.detectChanges();
      TestBed.tick();
      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('img')
          ?.getAttribute('src'),
      ).toBe('blob:lesson-image');
      TestBed.tick();
      expect(readImage).toHaveBeenCalledTimes(1);
      fixture.destroy();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:lesson-image');
    } finally {
      if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });
});
