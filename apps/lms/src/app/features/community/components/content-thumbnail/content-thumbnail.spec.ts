import { TestBed } from '@angular/core/testing';
import { ContentThumbnail } from './content-thumbnail';

describe('ContentThumbnail', () => {
  it('rotates through twelve defaults and keeps the same cover across remounts', () => {
    const indices = new Set<string>();
    for (let id = 101; id < 113; id++) {
      const fixture = TestBed.createComponent(ContentThumbnail);
      fixture.componentRef.setInput('contentId', id);
      fixture.detectChanges();
      const tile = fixture.nativeElement.querySelector(
        '[data-index]',
      ) as HTMLElement;
      indices.add(tile.dataset['index']!);
      fixture.destroy();
    }
    expect(indices.size).toBe(12);
    const values = [1, 2].map(() => {
      const fixture = TestBed.createComponent(ContentThumbnail);
      fixture.componentRef.setInput('contentId', 101);
      fixture.componentRef.setInput('kind', 'question');
      fixture.detectChanges();
      return fixture.nativeElement
        .querySelector('[data-index]')
        .getAttribute('data-index');
    });
    expect(values[0]).toBe(values[1]);
  });

  it('uses a selected cover and falls back if the image cannot be displayed', () => {
    const fixture = TestBed.createComponent(ContentThumbnail);
    fixture.componentRef.setInput('preview', '/selected-cover.png');
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector(
      'img',
    ) as HTMLImageElement;
    expect(image.getAttribute('src')).toContain('/selected-cover.png');
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-index]')).not.toBeNull();
    fixture.componentRef.setInput('preview', '/replacement-cover.png');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('img').getAttribute('src'),
    ).toContain('/replacement-cover.png');
  });
});
