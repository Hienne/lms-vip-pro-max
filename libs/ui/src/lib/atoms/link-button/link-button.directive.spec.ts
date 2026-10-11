import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LinkButton } from './link-button.directive';

@Component({
  imports: [LinkButton],
  template: `
    <button uiLinkButton id="b" (click)="clicks = clicks + 1">Xem thêm</button>
    <a uiLinkButton id="a" href="/catalog">Mở danh mục</a>
  `,
})
class Host {
  clicks = 0;
}

describe('LinkButton', () => {
  it('renders as a native button or a native link with the link-button look', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector('#b') as HTMLElement;
    const link = root.querySelector('#a') as HTMLElement;
    expect(button.tagName).toBe('BUTTON');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/catalog');
    expect(button.classList.contains('link-btn')).toBe(true);
    expect(link.classList.contains('link-btn')).toBe(true);
  });

  it('keeps native events', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#b') as HTMLElement).click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });
});
