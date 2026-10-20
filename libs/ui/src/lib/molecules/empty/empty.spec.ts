import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Empty, type EmptyTone, type EmptyVariant } from './empty';

@Component({
  imports: [Empty],
  template: `
    <ui-empty
      icon="inbox"
      title="Chưa có bài thi nào"
      [description]="description()"
      [tone]="tone()"
      [headingLevel]="level()"
      [variant]="variant()"
    >
      <button class="action">Khám phá khóa học</button>
    </ui-empty>
  `,
})
class Host {
  readonly description = signal('Hoàn thành khóa học đầu tiên để mở bài thi.');
  readonly tone = signal<EmptyTone>('primary');
  readonly level = signal<1 | 2 | 3 | 4>(3);
  readonly variant = signal<EmptyVariant>('page');
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    empty: root.querySelector('ui-empty') as HTMLElement,
    icon: () => root.querySelector('.empty__icon') as HTMLElement,
    heading: () => root.querySelector('h1, h2, h3, h4') as HTMLElement,
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
    host.level.set(1);
    fixture.detectChanges();
    expect(heading().tagName).toBe('H1');
  });

  it('has no icon circle and no entrance animation', () => {
    const { empty } = render();
    expect(empty.querySelector('.empty__art')).toBeNull();
    expect(empty.className).not.toContain('animate');
  });

  it('puts the icon beside the heading, coloured by tone and decorative', () => {
    const { fixture, host, icon } = render();
    expect(icon().parentElement?.classList).toContain('empty__title');
    expect(icon().className).not.toContain('empty__icon--');
    host.tone.set('danger');
    fixture.detectChanges();
    expect(icon().classList).toContain('empty__icon--danger');
    expect(icon().getAttribute('aria-hidden')).toBe('true');
  });

  it('inline: one muted line and the action, with no heading or icon', () => {
    const { fixture, host, empty, heading, icon } = render();
    host.variant.set('inline');
    fixture.detectChanges();
    expect(empty.classList).toContain('empty--inline');
    expect(heading()).toBeNull();
    expect(icon()).toBeNull();
    expect(empty.querySelectorAll('p')).toHaveLength(1);
    expect(empty.querySelector('.empty__line')?.textContent).toBe(
      'Chưa có bài thi nào. Hoàn thành khóa học đầu tiên để mở bài thi.',
    );
    expect(empty.querySelector('button.action')).not.toBeNull();
    host.description.set('');
    fixture.detectChanges();
    expect(empty.querySelector('.empty__line')?.textContent).toBe(
      'Chưa có bài thi nào',
    );
  });
});
