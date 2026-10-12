import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Breadcrumb } from '../../molecules/breadcrumb/breadcrumb';
import { PageHeader } from './page-header';

@Component({
  imports: [PageHeader, Breadcrumb],
  template: `
    <ui-page-header
      title="Khóa học của tôi"
      [eyebrow]="eyebrow()"
      [description]="description()"
    >
      @if (withBreadcrumb()) {
        <ui-breadcrumb slot="breadcrumb" [items]="trail" />
      }
      @if (withActions()) {
        <button slot="actions" type="button">Tạo khóa học</button>
      }
    </ui-page-header>
  `,
})
class Host {
  readonly trail = [{ label: 'Trang chủ' }];
  readonly eyebrow = signal<string | undefined>('Học tập');
  readonly description = signal<string | undefined>('Tiến độ của bạn.');
  readonly withBreadcrumb = signal(true);
  readonly withActions = signal(true);
}

async function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  return {
    host: fixture.componentInstance,
    root,
    settle: async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    },
  };
}

describe('PageHeader', () => {
  it('renders the title as the page heading, with eyebrow and description', async () => {
    const { root } = await render();
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      'Khóa học của tôi',
    );
    expect(root.querySelector('.page-header__eyebrow')?.textContent).toBe(
      'Học tập',
    );
    expect(root.querySelector('.page-header__desc')?.textContent).toBe(
      'Tiến độ của bạn.',
    );
  });

  it('omits eyebrow and description when not given', async () => {
    const { host, root, settle } = await render();
    host.eyebrow.set(undefined);
    host.description.set(undefined);
    await settle();
    expect(root.querySelector('.page-header__eyebrow')).toBeNull();
    expect(root.querySelector('.page-header__desc')).toBeNull();
  });

  it('projects actions into the actions area of the header', async () => {
    const { root } = await render();
    const actions = root.querySelector('header .page-header__actions');
    expect(actions?.querySelector('button')?.textContent).toBe('Tạo khóa học');
  });

  it('projects the breadcrumb before the header', async () => {
    const { root } = await render();
    const crumb = root.querySelector('ui-breadcrumb') as HTMLElement;
    const header = root.querySelector('header') as HTMLElement;
    expect(header.contains(crumb)).toBe(false);
    expect(
      crumb.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('leaves the slot areas empty when nothing is projected', async () => {
    const { host, root, settle } = await render();
    host.withActions.set(false);
    host.withBreadcrumb.set(false);
    await settle();
    expect(root.querySelector('.page-header__actions')?.children).toHaveLength(
      0,
    );
    expect(root.querySelector('ui-breadcrumb')).toBeNull();
  });
});
