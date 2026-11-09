/** One question for each thing the assistant does: documents, screens, the profile. */
export const DEFAULT_SUGGESTIONS = [
  'Quy trình EOD gồm những bước nào?',
  'Mở trang Hồ sơ cá nhân',
  'Đổi chức danh của tôi',
] as const;

const LEARNING = [
  'Tóm tắt những ý chính của bài này',
  'Quy trình EOD gồm những bước nào?',
  'Mở trang Tiến độ học tập',
] as const;

const QUIZ = [
  'Làm bài kiểm tra có tính điểm như thế nào?',
  'Mở trang Tiến độ học tập',
  'Quy trình EOD gồm những bước nào?',
] as const;

const ADMIN_CONTENT = [
  'Cách soạn một khóa học mới',
  'Cách tạo câu hỏi trong ngân hàng câu hỏi',
  'Mở trang Quản lý khóa học',
] as const;

const COMMUNITY = [
  'Tìm trong cộng đồng bài viết về đối soát cuối ngày',
  'Mở trang Hỏi đáp cộng đồng',
  'Quy trình EOD gồm những bước nào?',
] as const;

/**
 * Where the user is, for the opening suggestions: the learning screens, a quiz, the screens that
 * edit content, the community, or anywhere else (the default three).
 */
export function suggestionsFor(path: string): readonly string[] {
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
