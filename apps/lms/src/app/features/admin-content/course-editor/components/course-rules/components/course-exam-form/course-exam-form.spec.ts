import { TestBed } from '@angular/core/testing';
import { newExamValue } from '../../data-access/course-exam.model';
import { CourseExamForm } from './course-exam-form';

describe('continuous exam question list', () => {
  async function render(required = true, count = 125) {
    const fixture = TestBed.createComponent(CourseExamForm);
    fixture.componentRef.setInput('value', {
      ...newExamValue('QA', 125),
      requireLessonsCompleted: required,
    });
    fixture.componentRef.setInput(
      'questions',
      Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        code: `Q-${i + 1}`,
        contentPreview: `Nội dung số ${i + 1}`,
        questionType: 'SINGLE',
        difficulty: 'EASY',
      })),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const boxes = () =>
      Array.from(
        root.querySelectorAll<HTMLInputElement>(
          '.course-exam-form__question input',
        ),
      );
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, root, boxes, settle };
  }

  it('renders questions from first to last, with filtering that retains selections', async () => {
    const { root, boxes, settle } = await render();
    expect(boxes()).toHaveLength(125);
    expect(root.textContent).not.toContain('Trang câu hỏi');
    expect(
      root.querySelectorAll('.course-exam-form__question')[124].textContent,
    ).toContain('Q-125');
    const search = root.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value = 'Q-125';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(boxes()).toHaveLength(1);
    boxes()[0].click();
    await settle();
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(boxes()).toHaveLength(125);
    expect(boxes()[124].checked).toBe(false);
    expect(boxes()[0].checked).toBe(true);
  });

  it('requires lessons by default and emits that setting in the exam command', async () => {
    const { fixture, root } = await render();
    const prerequisite = Array.from(root.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Yêu cầu hoàn thành'))
      ?.querySelector<HTMLInputElement>('input');
    expect(prerequisite?.checked).toBe(true);
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    expect(await fixture.componentInstance.save()).toBe(true);
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({
        requireLessonsCompleted: true,
        questionIds: expect.arrayContaining([1, 125]),
      }),
    );
  });

  it('preserves a stored disabled prerequisite while editing', async () => {
    const { root } = await render(false);
    const prerequisite = Array.from(root.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Yêu cầu hoàn thành'))
      ?.querySelector<HTMLInputElement>('input');
    expect(prerequisite?.checked).toBe(false);
  });

  it('shows the complete bank beyond the server pool limit and permits choosing any question within that limit', async () => {
    const { boxes, settle } = await render(true, 2107);
    expect(boxes()).toHaveLength(2107);
    expect(boxes().filter((box) => box.checked)).toHaveLength(2000);
    expect(boxes()[2106].disabled).toBe(true);
    boxes()[0].click();
    await settle();
    expect(boxes()[2106].disabled).toBe(false);
    boxes()[2106].click();
    await settle();
    expect(boxes()[2106].checked).toBe(true);
    expect(boxes().filter((box) => box.checked)).toHaveLength(2000);
  });
});
