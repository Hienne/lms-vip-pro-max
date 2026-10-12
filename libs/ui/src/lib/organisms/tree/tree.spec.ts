import { Component, signal, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Tree, type TreeNode } from './tree';

const NODES: readonly TreeNode<{ status: string }>[] = [
  {
    id: 'd1',
    label: 'Nghiệp vụ',
    icon: 'layers',
    children: [
      {
        id: 'p1',
        label: 'Nền tảng',
        icon: 'network',
        children: [
          {
            id: 'c1',
            label: 'Tổng quan Core Banking',
            icon: 'book-open',
            data: { status: 'Đã xuất bản' },
          },
          {
            id: 'c2',
            label: 'Tài khoản & giao dịch',
            icon: 'book-open',
            data: { status: 'Nháp' },
          },
        ],
      },
    ],
  },
  {
    id: 'd2',
    label: 'Vận hành',
    icon: 'layers',
    children: [{ id: 'p2', label: 'EOD', icon: 'network' }],
  },
];

@Component({
  imports: [Tree],
  template: `
    <ui-tree
      label="Cây nội dung"
      [nodes]="nodes"
      [trailing]="badgeTpl()"
      [(expanded)]="expanded"
      [(selected)]="selected"
    />
    <ng-template #badge let-node
      ><em class="status">{{ node.data?.status }}</em></ng-template
    >
  `,
})
class Host {
  readonly nodes = NODES;
  readonly expanded = signal<readonly string[]>(['d1']);
  readonly selected = signal<string | undefined>(undefined);
  readonly badgeTpl =
    viewChild.required<
      TemplateRef<{ $implicit: TreeNode<{ status: string }> }>
    >('badge');
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const items = () =>
    Array.from(root.querySelectorAll<HTMLElement>('[role="treeitem"]'));
  const item = (label: string) =>
    items().find(
      (i) => i.querySelector('.tree__label')?.textContent?.trim() === label,
    ) as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const press = async (key: string) => {
    (document.activeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
    await settle();
  };
  return {
    fixture,
    root,
    items,
    item,
    settle,
    press,
    host: fixture.componentInstance,
  };
}

describe('Tree', () => {
  it('is a named tree whose items carry level, expansion and selection state', async () => {
    const { root, item } = await render();
    expect(
      root.querySelector('[role="tree"]')?.getAttribute('aria-label'),
    ).toBe('Cây nội dung');
    expect(item('Nghiệp vụ').getAttribute('aria-level')).toBe('1');
    expect(item('Nghiệp vụ').getAttribute('aria-expanded')).toBe('true');
    expect(item('Vận hành').getAttribute('aria-expanded')).toBe('false');
    expect(item('Nền tảng').getAttribute('aria-level')).toBe('2');
    expect(item('Nền tảng').getAttribute('aria-expanded')).toBe('false');
  });

  it('renders children only for expanded nodes, as groups', async () => {
    const { root, items } = await render();
    expect(
      items().map((i) => i.querySelector('.tree__label')?.textContent?.trim()),
    ).toEqual(['Nghiệp vụ', 'Nền tảng', 'Vận hành']);
    expect(root.querySelectorAll('[role="group"]').length).toBeGreaterThan(0);
  });

  it('follows the expanded input from outside', async () => {
    const { item, settle, host } = await render();
    host.expanded.set(['d1', 'p1']);
    await settle();
    expect(item('Tổng quan Core Banking')).toBeDefined();
    expect(item('Nền tảng').getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the node icon and the trailing template for each node', async () => {
    const { item, settle, host } = await render();
    expect(
      item('Nghiệp vụ').querySelector('.tree__node ui-icon'),
    ).not.toBeNull();
    host.expanded.set(['d1', 'p1']);
    await settle();
    expect(
      item('Tổng quan Core Banking').querySelector('.status')?.textContent,
    ).toBe('Đã xuất bản');
  });

  it('selects a node on click and reports its id', async () => {
    const { item, settle, host } = await render();
    (item('Vận hành').querySelector('.tree__node') as HTMLElement).click();
    await settle();
    expect(host.selected()).toBe('d2');
    expect(item('Vận hành').getAttribute('aria-selected')).toBe('true');
    expect(item('Nghiệp vụ').getAttribute('aria-selected')).not.toBe('true');
  });

  it('expands a collapsed node on click and reports it', async () => {
    const { item, settle, host } = await render();
    (item('Vận hành').querySelector('.tree__node') as HTMLElement).click();
    await settle();
    expect(host.expanded()).toContain('d2');
  });

  it('moves with Up, Down, Home and End, and opens and closes with Right and Left', async () => {
    const { item, press, host } = await render();
    item('Nghiệp vụ').focus();
    await press('ArrowDown');
    expect(document.activeElement).toBe(item('Nền tảng'));
    await press('End');
    expect(document.activeElement).toBe(item('Vận hành'));
    await press('Home');
    expect(document.activeElement).toBe(item('Nghiệp vụ'));
    await press('ArrowLeft');
    expect(host.expanded()).not.toContain('d1');
    await press('ArrowRight');
    expect(host.expanded()).toContain('d1');
  });

  it('selects the focused node with Enter', async () => {
    const { item, press, host } = await render();
    item('Nghiệp vụ').focus();
    await press('ArrowDown');
    await press('Enter');
    expect(host.selected()).toBe('p1');
  });
});
