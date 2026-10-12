import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Empty, type EmptyTone } from './empty';

@Component({
  imports: [Empty],
  template: `
    <ui-empty
      icon="inbox"
      title="Chưa có bài thi nào"
      [description]="description()"
      [tone]="tone()"
      [headingLevel]="level()"
    >
      <button class="action">Khám phá khóa học</button>
    </ui-empty>
  `,
})
class Host {
  readonly description = signal('Hoàn thành khóa học đầu tiên để mở bài thi.');
  readonly tone = signal<EmptyTone>('primary');
  readonly level = signal<2 | 3 | 4>(3);
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    empty: root.querySelector('ui-empty') as HTMLElement,
    art: () => root.querySelector('.empty__art') as HTMLElement,
    heading: () => root.querySelector('h2, h3, h4') as HTMLElement,
    description: () => root.querySelector('p'),
  };
}

describe('Empty', () => {
  it('renders the title, description and projected action', () => {
    const { empty, heading, description } = render();
    expect(empty.classList).toContain('empty');
    expect(heading().textContent?.trim()).toBe('Chưa có bài thi nào');
    expect(description()?.textContent?.trim()).toBe(
      'Hoàn thành khóa học đầu tiên để mở bài thi.',
    );
    expect(empty.querySelector('button.action')?.textContent).toContain(
      'Khám phá khóa học',
    );
  });

  it('omits the description paragraph when there is none', () => {
    const { fixture, host, description } = render();
    host.description.set('');
    fixture.detectChanges();
    expect(description()).toBeNull();
  });

  it('uses a level 3 heading by default and follows the configured level', () => {
    const { fixture, host, heading } = render();
    expect(heading().tagName).toBe('H3');
    host.level.set(2);
    fixture.detectChanges();
    expect(heading().tagName).toBe('H2');
    host.level.set(4);
    fixture.detectChanges();
    expect(heading().tagName).toBe('H4');
  });

  it('colours the art by tone and keeps the icon decorative', () => {
    const { fixture, host, art } = render();
    expect(art().className).toBe('empty__art');
    host.tone.set('danger');
    fixture.detectChanges();
    expect(art().classList).toContain('empty__art--danger');
    expect(art().querySelector('ui-icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});
