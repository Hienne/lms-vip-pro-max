import { TestBed } from '@angular/core/testing';
import { ContentThumbnail } from './content-thumbnail';

describe('ContentThumbnail', () => {
  it('renders nothing and takes no room when the author uploaded no image', () => {
    const fixture = TestBed.createComponent(ContentThumbnail);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('img')).toBeNull();
    expect(host.classList).toContain('thumbnail--empty');
  });

  it('shows a selected cover and drops it if the image cannot be displayed', () => {
    const fixture = TestBed.createComponent(ContentThumbnail);
    fixture.componentRef.setInput('preview', '/selected-cover.png');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const image = host.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toContain('/selected-cover.png');
    expect(host.classList).not.toContain('thumbnail--empty');
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(host.querySelector('img')).toBeNull();
    expect(host.classList).toContain('thumbnail--empty');
    fixture.componentRef.setInput('preview', '/replacement-cover.png');
    fixture.detectChanges();
    expect(host.querySelector('img')?.getAttribute('src')).toContain(
      '/replacement-cover.png',
    );
  });
});
