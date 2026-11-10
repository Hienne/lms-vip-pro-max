import type { AgentSkill } from '@lms/contracts';

/** An opening question and the skill it is for, so the server does not have to guess. */
export interface Suggestion {
  readonly text: string;
  readonly skill: AgentSkill;
}

const doc = (text: string): Suggestion => ({ text, skill: 'qa_tai_lieu' });
const screen = (text: string): Suggestion => ({ text, skill: 'dieu_huong' });
const profile = (text: string): Suggestion => ({ text, skill: 'ho_so' });

/** One question for each thing the assistant does: documents, screens, the profile. */
export const DEFAULT_SUGGESTIONS = [
  doc('Quy trình EOD gồm những bước nào?'),
  screen('Mở trang Hồ sơ cá nhân'),
  profile('Đổi chức danh của tôi'),
] as const satisfies readonly Suggestion[];

const LEARNING = [
  doc('Tóm tắt những ý chính của bài này'),
  doc('Quy trình EOD gồm những bước nào?'),
  screen('Mở trang Tiến độ học tập'),
] as const satisfies readonly Suggestion[];

const QUIZ = [
  doc('Làm bài kiểm tra có tính điểm như thế nào?'),
  screen('Mở trang Tiến độ học tập'),
  doc('Quy trình EOD gồm những bước nào?'),
] as const satisfies readonly Suggestion[];

const ADMIN_CONTENT = [
  doc('Cách soạn một khóa học mới'),
  doc('Cách tạo câu hỏi trong ngân hàng câu hỏi'),
  screen('Mở trang Quản lý khóa học'),
] as const satisfies readonly Suggestion[];

const COMMUNITY = [
  doc('Tìm trong cộng đồng bài viết về đối soát cuối ngày'),
  screen('Mở trang Hỏi đáp cộng đồng'),
  doc('Quy trình EOD gồm những bước nào?'),
] as const satisfies readonly Suggestion[];

/**
 * Where the user is, for the opening suggestions: the learning screens, a quiz, the screens that
 * edit content, the community, or anywhere else (the default three).
 */
export function suggestionsFor(path: string): readonly Suggestion[] {
  const first = path.split(/[?#]/)[0].split('/').filter(Boolean)[0];
  switch (first) {
    case 'learn':
    case 'course':
    case 'lesson':
    case 'catalog':
      return LEARNING;
    case 'quiz':
      return QUIZ;
    case 'admin': {
      const second = path.split(/[?#]/)[0].split('/').filter(Boolean)[1];
      return second === 'courses' ||
        second === 'lessons' ||
        second === 'questions' ||
        second === 'quizzes' ||
        second === 'catalog'
        ? ADMIN_CONTENT
        : DEFAULT_SUGGESTIONS;
    }
    case 'community':
      return COMMUNITY;
    default:
      return DEFAULT_SUGGESTIONS;
  }
}
