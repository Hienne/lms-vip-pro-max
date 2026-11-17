import { z } from 'zod';

const whole = (min: number, max: number, message: string) =>
  z
    .string()
    .refine(
      (text) =>
        text === '' ||
        (/^\d+$/.test(text) && Number(text) >= min && Number(text) <= max),
      message,
    );

/**
 * What the "Tạo bằng AI" section collects (the programme is step 1's own field) as text; the dialog turns it into the job inputs. The server
 * checks the same limits again, and decides the unit of an instructor's course.
 */
export const StartCourseFormSchema = z.object({
  targetLearners: z
    .string()
    .trim()
    .min(1, 'Nhập đối tượng học viên')
    .max(500, 'Tối đa 500 ký tự'),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  chapters: whole(1, 20, 'Số chương từ 1 đến 20'),
  durationMinutes: whole(15, 1200, 'Thời lượng từ 15 đến 1200 phút'),
  competencyId: z.string().min(1, 'Chọn năng lực'),
  ownerOrgId: z.string(),
});
export type StartCourseFormValue = z.infer<typeof StartCourseFormSchema>;

export const EMPTY_START_COURSE_FORM: StartCourseFormValue = {
  targetLearners: '',
  level: 'BEGINNER',
  chapters: '',
  durationMinutes: '',
  competencyId: '',
  ownerOrgId: '',
};

export const LEVEL_OPTIONS = [
  { value: 'BEGINNER', label: 'Cơ bản' },
  { value: 'INTERMEDIATE', label: 'Trung cấp' },
  { value: 'ADVANCED', label: 'Nâng cao' },
] as const;
