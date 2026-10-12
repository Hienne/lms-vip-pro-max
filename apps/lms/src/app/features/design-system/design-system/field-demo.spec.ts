import {
  openDesignSystem,
  placeholderMismatches,
} from './design-system.testing';

const click = (root: ParentNode, text: string) => {
  const button = Array.from(root.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === text,
  ) as HTMLButtonElement;
  button.click();
};

async function openForm() {
  const { page } = await openDesignSystem();
  const section = page.querySelector('#ds-forms') as HTMLElement;
  const form = section.querySelector('form') as HTMLFormElement;
  const settle = async () => {
    const { TestBed } = await import('@angular/core/testing');
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  };
  return { section, form, settle };
}

describe('Field demo', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is shown instead of its placeholder', async () => {
    const { section } = await openForm();
    expect(placeholderMismatches(section, ['field'])).toEqual([]);
  });

  it('renders the mockup fields with visible labels, the hint and the required marks', async () => {
    const { form } = await openForm();
    const labels = Array.from(form.querySelectorAll('.field__label')).map((l) =>
      l.textContent?.replace('*', '').trim(),
    );
    expect(labels).toEqual([
      'Tên khóa học',
      'Email',
      'Chương trình',
      'Mô tả',
      'Chỉ đọc',
    ]);
    expect(form.querySelectorAll('.field__req')).toHaveLength(2);
    expect(form.querySelector('.field__help')?.textContent).toContain(
      'Tối đa 120 ký tự.',
    );
    expect(form.querySelector('.error-summary')).toBeNull();
  });

  it('"Thử validate" shows the errors under the fields and a focused summary linking to them', async () => {
    const { form, settle } = await openForm();
    document.body.append(form.closest('app-design-system') ?? form);
    click(form, 'Thử validate');
    await settle();
    const summary = form.querySelector('ui-error-summary') as HTMLElement;
    const links = Array.from(summary.querySelectorAll('a'));
    expect(links.map((a) => a.textContent)).toEqual([
      'Tên khóa học là bắt buộc.',
      'Email không đúng định dạng.',
    ]);
    expect(form.querySelectorAll('.field__error')).toHaveLength(2);
    expect(form.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
    links[0].click();
    expect(document.activeElement?.id).toBe('ds-title');
  });

  it('"Xóa lỗi" clears the errors and the summary', async () => {
    const { form, settle } = await openForm();
    click(form, 'Thử validate');
    await settle();
    click(form, 'Xóa lỗi');
    await settle();
    expect(form.querySelector('ui-error-summary')).toBeNull();
    expect(form.querySelector('.field__error')).toBeNull();
    expect(form.querySelector('[aria-invalid]')).toBeNull();
  });
});
