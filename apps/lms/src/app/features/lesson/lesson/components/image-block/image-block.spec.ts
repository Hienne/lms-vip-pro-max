import { TestBed } from '@angular/core/testing';
import { ImageBlock } from './image-block';

function render(caption: string | null = null) {
  const fixture = TestBed.createComponent(ImageBlock);
  fixture.componentRef.setInput('src', '/api/v1/learning-assets/4/content');
  fixture.componentRef.setInput('alt', 'Mẫu báo cáo đối soát');
  fixture.componentRef.setInput('caption', caption);
  let retries = 0;
  fixture.componentInstance.retry.subscribe(() => (retries += 1));
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    retries: () => retries,
  };
}

describe('ImageBlock', () => {
  it('shows the picture with its alt text and the caption below', () => {
    const { el } = render('Báo cáo cuối ngày');
    const img = el.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/api/v1/learning-assets/4/content');
    expect(img.getAttribute('alt')).toBe('Mẫu báo cáo đối soát');
    expect(el.querySelector('figcaption')?.textContent).toBe(
      'Báo cáo cuối ngày',
    );
  });

  it('has no caption element without a caption', () => {
    expect(render().el.querySelector('figcaption')).toBeNull();
  });

  it('says so and offers "Thử lại" when the picture does not load', () => {
    const { el, fixture, retries } = render();
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('Không tải được hình ảnh.');
    el.querySelector('button')!.click();
    fixture.detectChanges();
    expect(retries()).toBe(1);
    expect(el.querySelector('img')).not.toBeNull();
  });
});
