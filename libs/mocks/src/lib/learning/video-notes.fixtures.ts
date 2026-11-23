import type { TranscriptLine, VideoChapter } from '@lms/contracts';

/** What the mockup's video blocks (`seed.js`: `chapters` and `transcript`) carry, as the backend sends it. */
export interface VideoNotes {
  readonly videoChapters: readonly VideoChapter[];
  readonly transcript: readonly TranscriptLine[];
}

/** The mockup's `transcript()` helper: line `i` starts at `45 i + 5` seconds. */
const lines = (texts: readonly string[]): TranscriptLine[] =>
  texts.map((text, i) => ({ startSeconds: i * 45 + 5, text }));

export const ARCHITECTURE_VIDEO: VideoNotes = {
  videoChapters: [
    { startSeconds: 0, title: 'Giới thiệu' },
    { startSeconds: 240, title: 'Các lớp kiến trúc' },
    { startSeconds: 600, title: 'Tích hợp kênh' },
    { startSeconds: 900, title: 'Tổng kết' },
  ],
  transcript: lines([
    'Chào mừng các bạn đến với bài học về kiến trúc tổng thể hệ thống Core Banking.',
    'Core Banking là hệ thống lõi xử lý tập trung tài khoản, giao dịch và sổ cái.',
    'Kiến trúc gồm ba lớp chính: kênh giao dịch, lớp tích hợp và hệ thống lõi.',
    'Lớp tích hợp chuẩn hóa thông điệp và định tuyến yêu cầu tới phân hệ phù hợp.',
    'Sổ cái tổng hợp ghi nhận mọi bút toán theo nguyên tắc bút toán kép.',
    'Ngày làm việc của hệ thống chỉ chuyển sang ngày mới sau khi chạy xong cuối ngày.',
    'Môi trường kiểm thử phải dùng dữ liệu đã che giấu, không dùng dữ liệu thật.',
  ]),
};

export const CHANGE_VIDEO: VideoNotes = {
  videoChapters: [
    { startSeconds: 0, title: 'Vì sao cần quản lý thay đổi' },
    { startSeconds: 300, title: 'Các loại thay đổi' },
    { startSeconds: 600, title: 'Rollback' },
  ],
  transcript: lines([
    'Quản lý thay đổi giúp giảm rủi ro gián đoạn khi thay đổi hệ thống.',
    'Một yêu cầu thay đổi cần mô tả, lý do, đánh giá tác động và kế hoạch rollback.',
    'Có ba loại: thay đổi chuẩn, thay đổi thường và thay đổi khẩn cấp.',
    'Thay đổi khẩn cấp được phê duyệt rút gọn và bổ sung hồ sơ sau.',
    'Kế hoạch rollback được dùng khi triển khai thất bại.',
  ]),
};

export const EOD_VIDEO: VideoNotes = {
  videoChapters: [
    { startSeconds: 0, title: 'EOD là gì' },
    { startSeconds: 420, title: 'Chuỗi job' },
    { startSeconds: 720, title: 'Giám sát' },
  ],
  transcript: lines([
    'EOD là chuỗi xử lý batch cuối ngày: tính lãi, phí, khóa sổ và chuyển ngày làm việc.',
    'Trước EOD cần đảm bảo đã đóng ca, không còn giao dịch treo và đã sao lưu.',
    'Trong EOD cần giám sát thời gian chạy từng job và tài nguyên hệ thống.',
    'Khi job lỗi: xác định job, đọc log và thông báo theo quy trình sự cố.',
  ]),
};

export const WELCOME_VIDEO: VideoNotes = {
  videoChapters: [
    { startSeconds: 0, title: 'Chào mừng' },
    { startSeconds: 300, title: 'Cơ cấu tổ chức' },
  ],
  transcript: lines([
    'Chào mừng bạn đến với Ban Quản lý và Phát triển Core Banking.',
    'Ban gồm các nhóm: Tổng hợp & QA, Quản trị hệ thống, Phát triển nghiệp vụ.',
  ]),
};

export const DEPOSIT_VIDEO: VideoNotes = {
  videoChapters: [
    { startSeconds: 0, title: 'Mở tài khoản' },
    { startSeconds: 360, title: 'Tất toán' },
  ],
  // The one untimed Transcript of the mock tree: lines without a time, as an author uploads a plain .txt.
  transcript: [
    {
      startSeconds: null,
      text: 'Vòng đời tài khoản tiền gửi gồm mở, duy trì, tái tục và tất toán.',
    },
    {
      startSeconds: null,
      text: 'Khi tất toán, lãi được tính đến ngày trước ngày rút và chuyển về tài khoản thanh toán.',
    },
  ],
};
