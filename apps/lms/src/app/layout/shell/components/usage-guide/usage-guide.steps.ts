import type { FunctionCode } from '@lms/contracts';

export type GuideAudience = 'learner' | 'instructor' | 'admin';
export interface UsageGuideStep {
  readonly title: string;
  readonly text: string;
  readonly path: string;
  readonly target: string;
  readonly permission: FunctionCode;
}

const header = 'main ui-page-header';
type StepContent = readonly [title: string, text: string, target?: string];

function screen(
  path: string,
  permission: FunctionCode,
  steps: readonly StepContent[],
): UsageGuideStep[] {
  return steps.map(([title, text, target = header]) => ({
    path,
    permission,
    title,
    text,
    target,
  }));
}

const courseEditor: readonly StepContent[] = [
  [
    'Nhập thông tin cơ bản',
    'Nhập tên và mã khóa, chọn chương trình, phân hệ nếu có và mức độ. Kiểm tra trường báo đỏ rồi bấm Tiếp theo. Bấm Lưu nháp nếu muốn dừng và soạn tiếp sau.',
    'app-course-info',
  ],
  [
    'Tạo chương và soạn bài học',
    'Ở Nội dung khóa học, thêm chương rồi thêm bài trong chương đó. Với bài nội dung, chọn văn bản, video, PDF hoặc tệp đính kèm. Với SCORM, tải ZIP 1.2 hoặc tìm gói ngay trong dropdown thư viện. Bấm Lưu ở form bài học rồi kiểm tra thứ tự trên cây.',
    'ui-stepper',
  ],
  [
    'Gắn bài kiểm tra vào bài học',
    'Khi loại bài là Bài kiểm tra, chọn đề đã tồn tại trong khóa hoặc Tạo mới bài kiểm tra. Chọn câu hỏi của chương trình, nhập số câu và điểm đạt rồi bấm Lưu bài học để ghi nhận cấu hình nháp.',
    'ui-stepper',
  ],
  [
    'Chọn điều kiện cuối khóa',
    'Ở Bài thi & điều kiện, chọn Không yêu cầu, dùng đề có sẵn hoặc tạo bài thi cuối khóa. Với đề mới, chọn câu hỏi, kiểm tra điểm đạt, thời lượng và số lượt rồi bấm Tiếp theo.',
    'ui-stepper',
  ],
  [
    'Chọn đối tượng và xuất bản',
    'Ở Đối tượng & xuất bản, chọn phạm vi phát hành và các đơn vị hoặc nhóm, đặt hạn bằng lịch nếu cần. Kiểm tra nội dung và điều kiện hoàn thành rồi bấm Xuất bản. Bài kiểm tra tạo kèm được phát hành cùng khóa.',
    'ui-stepper',
  ],
];

const reportSteps: readonly StepContent[] = [
  [
    'Mở nhóm số liệu cần xem',
    'Tổng quan cho biết kết quả chung. Học tập theo dõi tiến độ và hoàn thành. Đánh giá cho xem kết quả thi theo từng loại báo cáo. Tương tác tổng hợp hoạt động và điểm thưởng.',
    'nav[aria-label="Nhóm báo cáo"]',
  ],
  [
    'Chọn thời gian',
    'Chọn 30 ngày qua hoặc 90 ngày qua để xem khoảng gần đây. Chọn Tùy chọn rồi mở bộ lọc để nhập ngày bắt đầu và ngày kết thúc. Với báo cáo Học tập, khoảng ngày lọc theo ngày ghi danh.',
  ],
  [
    'Khoanh đúng phạm vi',
    'Bấm Bộ lọc, chọn Đơn vị rồi Phòng / nhóm, Khóa học và Bài kiểm tra nếu nhóm báo cáo có trường này. Bấm Áp dụng. Thay đổi lựa chọn cấp trên sẽ làm mới danh sách cấp dưới.',
    '#report-filters',
  ],
  [
    'Đối chiếu bảng và xuất CSV',
    'Đọc phạm vi cạnh biểu đồ. Một số bộ lọc trong Đánh giá chỉ áp dụng cho bảng. Khi bảng ra đúng dữ liệu, bấm Xuất CSV để lấy toàn bộ bản ghi khớp bộ lọc.',
  ],
];

export const PAGE_GUIDE_STEPS: readonly UsageGuideStep[] = [
  ...screen('/learn', 'COURSE_LEARNING', [
    [
      'Đọc số liệu của bạn',
      'Dải số liệu cho biết khóa được giao, tỷ lệ hoàn thành, điểm gần nhất và điểm cao nhất. Nếu có khóa quá hạn, xem Hạn hoàn thành ở bên dưới để chọn việc cần làm trước.',
      '.learn__kpis',
    ],
    [
      'Học tiếp từ vị trí đã lưu',
      'Bấm Tiếp tục học để quay lại nội dung đang dở. Tên bài và thanh tiến độ cho biết bạn sẽ mở phần nào.',
      '.learn-hero__continue',
    ],
    [
      'Tìm các khóa của mình',
      'Trong Khóa học của tôi, chọn Đang học, Chưa bắt đầu, Đã hoàn thành, Bắt buộc hoặc Được giao. Bấm một thẻ để vào chi tiết. Bấm Xem tất cả để mở danh sách rộng hơn.',
      '.learn__courses',
    ],
  ]),
  ...screen('/catalog', 'COURSE_LEARNING', [
    [
      'Tìm thêm khóa học',
      'Nhập tên hoặc mã khóa vào ô tìm kiếm. Nếu chưa thấy khóa cần tìm, xóa từ khóa rồi mở Bộ lọc.',
      '.catalog__filters',
    ],
    [
      'Lọc theo nhu cầu học',
      'Chọn lĩnh vực, chương trình và phân hệ để thu hẹp kết quả. Dùng trạng thái để xem các khóa đã tham gia hoặc đang được giao. Bấm dấu × trên điều kiện đang áp dụng để bỏ riêng điều kiện đó.',
      '.catalog__filters',
    ],
    [
      'Mở khóa và xem điều kiện',
      'Bấm vào một thẻ khóa để xem nội dung, hạn và bài kiểm tra bắt buộc. Nếu có quyền tham gia, bấm Bắt đầu học hoặc Tiếp tục học ở trang chi tiết.',
    ],
  ]),
  ...screen('/course/:id', 'COURSE_LEARNING', [
    [
      'Chọn việc cần làm tiếp theo',
      'Bấm Bắt đầu học hoặc Tiếp tục học để vào bài. Khi đã học đủ, nút chính sẽ dẫn đến bài kiểm tra hoặc kết quả theo điều kiện thực tế.',
    ],
    [
      'Kiểm tra điều kiện hoàn thành',
      'Đối chiếu số bài bắt buộc đã hoàn thành, hạn và điểm đạt. Khóa có bài kiểm tra bắt buộc chỉ hoàn thành khi bạn đạt điểm yêu cầu.',
      '.course__status, .course__outline',
    ],
    [
      'Mở một bài trong mục lục',
      'Mở chương rồi chọn bài trong Nội dung khóa học. Quay lại trang này để xem phần nào đã hoàn thành và phần nào còn cần học.',
      '.course__outline',
    ],
  ]),
  ...screen('/lesson/:courseId/:lessonId', 'COURSE_LEARNING', [
    [
      'Đi giữa các nội dung',
      'Chọn chương, bài hoặc khối trong Mục lục. Dùng Quay lại và Tiếp theo ở cuối bài để chuyển theo thứ tự. Bật Chế độ tập trung để mở rộng nội dung và bấm Hiện mục lục để trở lại.',
      '.lesson__bar',
    ],
    [
      'Học theo định dạng của bài',
      'Với PDF, cuộn hoặc dùng nút chuyển trang. Với video, xem đến hết để cập nhật hoàn thành. Với SCORM, làm theo các bước trong trình phát và dùng Học lại nếu lượt trước chưa đạt. LMS lưu vị trí tự động.',
      '.lesson__block-body',
    ],
    [
      'Lưu nội dung cần xem lại',
      'Mở Ghi chú, viết nội dung rồi lưu. Nếu có nút đánh dấu, dùng nó để lưu trang PDF hoặc mốc video hiện tại. Mở Đã lưu & ghi chú từ Công cụ học để xem lại.',
      '.lesson__side',
    ],
  ]),
  ...screen('/progress', 'LEARNING_PROGRESS', [
    [
      'Đọc từng dòng tiến độ',
      'Ở Tiến độ khóa học, đối chiếu trạng thái, phần trăm nội dung, hạn và kết quả thi của từng khóa. Bấm tên khóa để xem điều kiện còn thiếu.',
      'main ui-tabs',
    ],
    [
      'Xem năng lực và nhịp học',
      'Mở Năng lực để xem kết quả theo nhóm và hoạt động học theo thời gian. Đọc cùng số bài kiểm tra đã làm để hiểu mức độ dữ liệu.',
      'main ui-tabs',
    ],
    [
      'Đối chiếu lịch sử thi',
      'Mở Lịch sử thi để kiểm tra từng lượt và điểm đã ghi nhận. Chọn lượt thi khi muốn xem kết quả chi tiết.',
      'main ui-tabs',
    ],
  ]),
  ...screen('/quiz', 'QUIZ_TAKING', [
    [
      'Tìm bài kiểm tra phù hợp',
      'Dùng các tab Còn thi được, Đã đạt hoặc Chưa đạt rồi chọn tên bài trong danh sách.',
    ],
    [
      'Kiểm tra quyền vào thi',
      'Xem điểm đạt, điểm cao nhất và lượt còn lại. Nếu đề chưa mở, còn thời gian chờ hoặc có bài bắt buộc chưa học, xem điều kiện trước khi thử lại.',
    ],
    [
      'Mở bài hoặc xem lượt cũ',
      'Bấm Vào thi để đọc quy tắc. Trong Lịch sử làm bài, chọn một lượt để xem kết quả. Nếu hết lượt, liên hệ giảng viên để được xem xét cấp thêm.',
    ],
  ]),
  ...screen('/quiz/:id', 'QUIZ_TAKING', [
    [
      'Đọc quy định của đề',
      'Xem thời lượng, điểm đạt, số câu và số lượt trước khi bấm Bắt đầu. Hoàn thành các bài bắt buộc nếu đây là điều kiện vào thi.',
    ],
    [
      'Làm bài theo thứ tự bạn chọn',
      'Trong màn thi, chọn đáp án, dùng Quay lại / Tiếp theo hoặc bảng số câu để kiểm tra các câu chưa trả lời. Theo dõi đồng hồ và giữ cửa sổ thi mở.',
    ],
    [
      'Xác nhận nộp bài',
      'Bấm Nộp bài, kiểm tra số câu đã trả lời rồi xác nhận. Sau khi nộp, xem điểm, trạng thái và lịch sử lượt thi.',
    ],
  ]),
  ...screen('/quiz/:id/result/:attemptId', 'QUIZ_TAKING', [
    [
      'Đọc kết quả đã ghi nhận',
      'Đối chiếu điểm của lượt này với điểm đạt, trạng thái và thời gian nộp. Mở Lịch sử nếu muốn xem các lượt khác.',
    ],
    [
      'Ôn lại câu hỏi',
      'Nếu giảng viên cho phép, mở phần xem lại để đọc đáp án và giải thích. Xem trạng thái lượt tiếp theo trước khi bấm Thi lại.',
    ],
  ]),
  ...screen('/quiz/:id/attempts', 'QUIZ_TAKING', [
    [
      'Chọn lượt muốn đối chiếu',
      'Xem số thứ tự, thời điểm nộp, điểm và trạng thái từng lượt. Bấm vào lượt đã nộp để mở kết quả chi tiết.',
    ],
    [
      'Kiểm tra điều kiện thi lại',
      'Quay lại trang bài kiểm tra để xem lượt còn lại và thời gian chờ. Khi đã hết lượt, liên hệ giảng viên để được xem xét cấp thêm.',
    ],
  ]),
  ...screen('/saved', 'COURSE_LEARNING', [
    [
      'Tìm một ghi chú hoặc đánh dấu',
      'Nhập tên bài học hoặc từ trong ghi chú. Chọn bài trong danh sách rồi xem các ghi chú và mốc đã lưu của bài đó.',
    ],
    [
      'Quay lại đúng vị trí',
      'Bấm ghi chú hoặc mốc đánh dấu để mở đúng trang PDF hoặc mốc video. Nếu cần chỉnh hoặc xóa ghi chú, chọn thao tác tại mục tương ứng.',
    ],
  ]),
  ...screen('/certificates', 'COURSE_LEARNING', [
    [
      'Tìm chứng nhận',
      'Nhập tên khóa hoặc mã chứng nhận. Có thể đổi thứ tự sắp xếp để xem chứng nhận cũ hơn.',
    ],
    [
      'Xem và tải chứng nhận',
      'Bấm Xem chứng nhận, đối chiếu tên, khóa học và ngày hoàn thành. Bấm Tải về để lưu bản dùng khi cần đối chiếu, cùng mã xác thực hiển thị trên chứng nhận.',
    ],
  ]),
  ...screen('/notifications', 'PROFILE', [
    [
      'Xử lý thông báo chưa đọc trước',
      'Thông báo chưa đọc được làm nổi bật và ưu tiên hiển thị. Bấm một thông báo để mở nội dung hoặc đi tới khóa học liên quan.',
    ],
    [
      'Dọn thông báo đã xử lý',
      'Bấm Đánh dấu đã đọc để đổi trạng thái. Di chuột hoặc đưa bàn phím tới thông báo để hiện thao tác xóa, rồi xác nhận nếu muốn bỏ thông báo.',
    ],
  ]),
  ...screen('/profile', 'PROFILE', [
    [
      'Kiểm tra hồ sơ và vai trò',
      'Đối chiếu họ tên, đơn vị, phòng / nhóm và danh sách vai trò. Phạm vi của từng vai trò quyết định các mục được mở.',
    ],
    [
      'Cập nhật thông tin',
      'Sửa các trường tài khoản cho phép rồi bấm Lưu. Đổi mật khẩu ở mục tương ứng, hoặc mở menu tài khoản để vào Hướng dẫn sử dụng.',
    ],
  ]),
  ...['/admin', '/instructor'].flatMap((path) =>
    screen(path, 'PROFILE', [
      [
        'Đọc tình hình đào tạo',
        'Xem số học viên, lượt ghi danh, tỷ lệ hoàn thành và số lượt quá hạn ở đầu trang. Các số liệu dựa trên những khóa bạn quản lý.',
        'main ui-stat-strip',
      ],
      [
        'Chọn khoảng hoạt động',
        'Chọn Toàn thời gian, 7, 14 hoặc 30 ngày ở đầu trang. Kỳ đã chọn áp dụng cho số liệu ghi danh, trạng thái học tập và hoạt động. Biểu đồ ở chế độ Toàn thời gian hiển thị tối đa 30 ngày gần nhất.',
        'main .dashboard__period',
      ],
      [
        'Xem top 5 học viên theo XP',
        'Bảng dưới Trạng thái học tập hiển thị top 5 học viên theo XP tháng này. Bấm Xem bảng để mở bảng xếp hạng toàn hệ thống.',
        'main .dashboard__ranking',
      ],
    ]),
  ),
  ...screen('/admin/courses', 'COURSE_MANAGEMENT', [
    [
      'Tìm khóa cần quản lý',
      'Nhập tên hoặc mã khóa; dùng lĩnh vực, chương trình và trạng thái để giới hạn danh sách theo phạm vi của bạn.',
    ],
    [
      'Soạn mới hoặc chỉnh bản nháp',
      'Bấm Tạo khóa học để đi qua các bước soạn. Với khóa có sẵn, chọn Sửa và làm việc trên bản nháp của khóa.',
    ],
    [
      'Kiểm tra trước khi phát hành',
      'Mở chi tiết hoặc xem trước để đối chiếu bài học, đề thi và đối tượng. Nếu đang chỉnh một khóa đã công bố, xuất bản bản nháp khi các nội dung đã sẵn sàng.',
    ],
  ]),
  ...screen('/admin/courses/new', 'COURSE_MANAGEMENT', courseEditor),
  ...screen('/admin/courses/:id/edit', 'COURSE_MANAGEMENT', courseEditor),
  ...screen('/admin/catalog', 'TRAINING_CATALOG', [
    [
      'Chọn lĩnh vực hoặc chương trình',
      'Mở nhánh lĩnh vực trên cây rồi chọn chương trình. Khu vực chi tiết cho biết nội dung và các khóa thuộc chương trình trong phạm vi của bạn.',
      'main ui-tree',
    ],
    [
      'Thêm hoặc sửa phân hệ nghiệp vụ',
      'Chọn Thêm lĩnh vực để khai báo lĩnh vực cùng các phân hệ. Với lĩnh vực hiện có, bấm Sửa lĩnh vực để thêm, đổi tên hoặc xóa phân hệ nếu chưa được sử dụng.',
    ],
    [
      'Quản lý chương trình bên dưới lĩnh vực',
      'Chọn đúng lĩnh vực rồi bấm Thêm chương trình. Kiểm tra mã, tên và trạng thái trước khi lưu. Mục mới được xếp cuối nhánh để dễ tìm lại.',
      'main ui-tree',
    ],
  ]),
  ...screen('/admin/questions', 'QUESTION_BANK', [
    [
      'Chọn ngân hàng theo chương trình',
      'Chọn chương trình ở đầu trang. Dùng bộ lọc loại câu hỏi, độ khó, năng lực và trạng thái để tìm câu đã có.',
      '.assessment__scope',
    ],
    [
      'Nhập một câu hỏi và đáp án',
      'Bấm Thêm câu hỏi. Chọn loại câu, nhập nội dung, các phương án, đánh dấu đáp án đúng và thêm giải thích. Với câu một đáp án, chọn đúng một phương án.',
    ],
    [
      'Nhập nhiều câu từ Excel',
      'Bấm Nhập từ Excel, tải mẫu, dùng mã nhóm năng lực của chương trình và điền từng câu một dòng. Tải tệp lên, bấm Kiểm tra, sửa lỗi theo dòng rồi bấm Nhập câu hỏi.',
    ],
  ]),
  ...screen('/admin/quizzes', 'QUIZ_MANAGEMENT', [
    [
      'Chọn chương trình và khóa học',
      'Dùng hộp chọn ở đầu trang để tìm đúng khóa. Quay lại và Tiếp theo đổi một khóa theo thứ tự trong hộp chọn.',
      '.assessment__scope',
    ],
    [
      'Thiết lập đề thi',
      'Bấm Tạo bài kiểm tra hoặc mở một đề. Chọn câu hỏi của chương trình rồi điền thời lượng, số câu mỗi lượt và điểm đạt. Đọc mục cấu hình nâng cao để đặt lịch và điều kiện học trước.',
    ],
    [
      'Chọn chính sách thi lại',
      'Nhập số lượt, thời gian chờ và chính sách thi lại sau khi đạt. Kiểm tra thời gian mở, đóng và quyền xem đáp án trước khi lưu đề.',
    ],
  ]),
  ...screen('/admin/quizzes/:id', 'QUIZ_MANAGEMENT', [
    [
      'Cấu hình hoặc rà soát đề',
      'Kiểm tra khóa liên kết, bộ câu hỏi và cách lấy câu. Dùng Quản lý câu hỏi của chương trình nếu cần chuẩn bị thêm câu trước khi lưu.',
    ],
    [
      'Đặt lịch và số lượt',
      'Chọn giờ mở, giờ đóng, điểm đạt, số lần thi tối đa và thời gian chờ. Kiểm tra điều kiện hoàn thành bài học và phần học viên được xem sau khi nộp.',
    ],
    [
      'Cấp lượt cho học viên đã hết lượt',
      'Mở khu vực cấp lượt thi, chọn đúng học viên, số lượt bổ sung và xác nhận. Kiểm tra lại số lượt còn lại của học viên sau khi lưu.',
    ],
  ]),
  ...screen('/admin/lessons', 'LESSON_MANAGEMENT', [
    [
      'Nhập gói bài giảng',
      'Bấm nhập gói SCORM, chọn tệp ZIP chuẩn 1.2 và chờ xử lý. Giữ nguyên cấu trúc trong ZIP và kiểm tra thông báo nếu không đọc được gói.',
    ],
    [
      'Xem thử nội dung',
      'Mở gói vừa nhập để kiểm tra trình phát. Làm thử bài, xem điểm và trạng thái, sau đó thoát và mở lại để kiểm tra vị trí được lưu.',
    ],
    [
      'Dùng lại khi soạn khóa',
      'Trong Nội dung khóa học, chọn loại SCORM rồi mở thư viện. Tìm gói theo tên ngay trong dropdown và lưu bài học.',
    ],
  ]),
  ...screen('/admin/assignments', 'COURSE_ASSIGNMENT', [
    [
      'Chọn khóa và người nhận',
      'Bấm Giao khóa học, chọn khóa đã xuất bản rồi thêm đơn vị, phòng / nhóm hoặc người học thuộc phạm vi. Kiểm tra danh sách trước khi tiếp tục.',
    ],
    [
      'Đặt hạn và thông báo',
      'Chọn thời gian bắt đầu, hạn hoàn thành, mức độ bắt buộc và nhắc hạn nếu cần. Rà soát rồi lưu đợt giao.',
    ],
    [
      'Theo dõi đợt đã giao',
      'Mở đợt giao để xem ai chưa bắt đầu, đang học hoặc đã hoàn thành. Sửa hạn hoặc thu hồi theo quyền và ngữ cảnh của đợt.',
    ],
  ]),
  ...screen('/reports', 'REPORTING', reportSteps),
  ...screen('/reports/:dim', 'REPORTING', reportSteps),
  ...screen('/reports/gamification', 'REPORTING', [
    reportSteps[0],
    [
      'Chọn khoảng thời gian và đơn vị',
      'Chọn ngày bắt đầu, ngày kết thúc và đơn vị nếu cần, rồi bấm Áp dụng. Đọc khoảng thời gian hiển thị cùng kết quả để kiểm tra bộ lọc.',
    ],
    [
      'Đọc hoạt động và điểm thưởng',
      'Dùng các biểu đồ và bảng phía dưới để xem hoạt động học, nguồn điểm và các số liệu tổng hợp. Bấm Xuất CSV để tải kết quả đang lọc.',
    ],
  ]),
  ...screen('/admin/users', 'USER_MANAGEMENT', [
    [
      'Tìm tài khoản',
      'Tìm theo họ tên, mã cán bộ hoặc tên đăng nhập. Lọc theo đơn vị và trạng thái để thu hẹp danh sách.',
    ],
    [
      'Quản lý thông tin và trạng thái',
      'Mở tài khoản để kiểm tra đơn vị, vai trò và trạng thái. Nếu tạo mới hoặc cập nhật, rà lại mã cán bộ, quyền và phạm vi trước khi lưu.',
    ],
  ]),
  ...screen('/admin/roles', 'ROLE_MANAGEMENT', [
    [
      'Chọn vai trò cần kiểm tra',
      'Mở vai trò để xem các chức năng được gán. Đọc mô tả chức năng để biết màn và thao tác được mở.',
    ],
    [
      'Kiểm tra phạm vi cấp quyền',
      'Khi cấp vai trò cho người dùng, chọn đúng phạm vi đơn vị, nhóm hoặc cá nhân. Rà lại các quyền trước khi lưu hoặc thu hồi.',
    ],
  ]),
  ...screen('/admin/org', 'ORGANIZATION_MANAGEMENT', [
    [
      'Mở nhánh đơn vị',
      'Chọn đơn vị cha và mở nhánh trên cây để xem các đơn vị con hoặc nhóm trực thuộc.',
    ],
    [
      'Thêm hoặc cập nhật tổ chức',
      'Chọn đúng đơn vị cha khi tạo mới. Kiểm tra mã, tên, cấp và trạng thái trước khi lưu; sau đó xem mục mới trong cây.',
    ],
  ]),
  ...screen('/community/questions', 'COMMUNITY', [
    [
      'Tìm câu hỏi đã có',
      'Dùng ô tìm kiếm và nhóm chủ đề để tìm trao đổi liên quan. Mở câu hỏi để đọc nội dung và các trả lời.',
    ],
    [
      'Đặt câu hỏi mới',
      'Bấm đặt câu hỏi, viết tiêu đề rõ và nêu bối cảnh hoặc ví dụ. Chọn chủ đề, rà soát rồi đăng để đồng nghiệp có thể trả lời.',
    ],
  ]),
  ...screen('/community/articles', 'COMMUNITY', [
    [
      'Tìm bài viết liên quan',
      'Lọc hoặc tìm theo tiêu đề, rồi mở bài để đọc và phản hồi.',
    ],
    [
      'Chia sẻ bài viết',
      'Bấm tạo bài viết, nhập tiêu đề, nội dung và chủ đề. Xem lại thông tin hiển thị trước khi đăng.',
    ],
  ]),
  ...screen('/community/reviews', 'COMMUNITY', [
    [
      'Tìm đề xuất cần xem',
      'Lọc danh sách rồi mở một đề xuất để xem mô tả, bối cảnh và phản hồi đã có.',
    ],
    [
      'Gửi ý kiến rà soát',
      'Viết góp ý tại mục phù hợp. Nêu tình huống cụ thể và lý do để người gửi dễ đối chiếu.',
    ],
  ]),
  ...screen('/community/moderation', 'COMMUNITY_MODERATION', [
    [
      'Lọc nội dung cần điều phối',
      'Chọn tab và dùng bộ lọc để tìm bài hoặc phản hồi cần xem xét. Mở chi tiết để đọc toàn bộ trao đổi.',
    ],
    [
      'Áp dụng và kiểm tra thao tác',
      'Chọn thao tác phù hợp, kiểm tra phạm vi và nhập lý do nếu được yêu cầu. Xác nhận, sau đó xem lại trạng thái trong danh sách.',
    ],
  ]),
  ...screen('/admin/competencies', 'QUESTION_BANK', [
    [
      'Mở nhóm năng lực',
      'Tìm theo tên hoặc mã và mở nhánh để xem các mục con. Dùng mã đúng nhóm khi biên soạn hoặc nhập câu hỏi từ Excel.',
    ],
    [
      'Thêm hoặc sửa nhóm',
      'Chọn nhóm cha nếu cần, nhập tên và mã rồi lưu. Kiểm tra trạng thái trước khi sử dụng nhóm trong ngân hàng câu hỏi.',
    ],
  ]),
  ...screen('/flashcards', 'QUIZ_TAKING', [
    [
      'Chọn bộ thẻ để ôn',
      'Mở bộ thẻ phù hợp rồi bắt đầu ôn. Đọc mặt trước và tự trả lời trước khi lật thẻ.',
    ],
    [
      'Đánh giá mức ghi nhớ',
      'Sau khi lật và đối chiếu đáp án, chọn mức độ ghi nhớ để chuyển sang thẻ tiếp theo. Xem lại các thẻ còn khó sau lượt ôn.',
    ],
  ]),
  ...screen('/admin/flashcards', 'QUESTION_BANK', [
    [
      'Tìm bộ thẻ cần chỉnh',
      'Dùng danh sách để tìm bộ thẻ. Mở bộ thẻ để xem nội dung và trạng thái trước khi sửa.',
    ],
    [
      'Soạn thẻ để học viên ôn',
      'Thêm nội dung mặt trước và mặt sau, kiểm tra thứ tự rồi lưu. Mở thử một lượt ôn để đối chiếu cách hiển thị.',
    ],
  ]),
  ...screen('/admin/gamification', 'SYSTEM_AUDIT', [
    [
      'Chọn mục cấu hình',
      'Mở quy tắc XP, cấp độ hoặc huy hiệu. Đối chiếu điều kiện hiện hành và thời điểm áp dụng trước khi sửa.',
    ],
    [
      'Rà soát và lưu',
      'Điền giá trị cần đổi, kiểm tra cách tính và trạng thái rồi lưu. Mở Báo cáo đào tạo, tab Tương tác, để theo dõi kết quả tổng hợp.',
    ],
  ]),
  ...screen('/community/me', 'COMMUNITY', [
    [
      'Tìm nội dung của bạn',
      'Dùng các tab để lọc câu hỏi, bài viết hoặc đề xuất bạn đã đăng. Mở một mục để xem phản hồi và trạng thái.',
    ],
    [
      'Cập nhật nội dung',
      'Từ mục chi tiết, chọn sửa nếu có. Rà soát lại tiêu đề và nội dung trước khi lưu.',
    ],
  ]),
  ...screen('/certificate/:id', 'LEARNING_PROGRESS', [
    [
      'Đối chiếu chứng nhận',
      'Kiểm tra tên học viên, tên khóa, ngày hoàn thành và mã xác thực trên chứng nhận.',
    ],
    [
      'Lưu bản chứng nhận',
      'Dùng nút tải về để lưu tệp. Quay về Chứng nhận hoàn thành để tìm chứng nhận của khóa khác.',
    ],
  ]),
  ...screen('/admin/users/:id', 'USER_MANAGEMENT', [
    [
      'Đối chiếu đúng tài khoản',
      'Kiểm tra tên, mã cán bộ, trạng thái, đơn vị và nhóm trước khi thao tác.',
    ],
    [
      'Điều chỉnh thông tin và quyền',
      'Cập nhật hồ sơ ở phần thông tin. Ở phần vai trò, chọn quyền và phạm vi đúng với công việc; rà soát lại danh sách quyền sau khi lưu.',
    ],
  ]),
  ...screen('/admin/courses/ai-drafts/:jobId', 'COURSE_MANAGEMENT', [
    [
      'Theo dõi việc tạo bản nháp',
      'Đọc trạng thái xử lý. Nếu tạo bản nháp thất bại, kiểm tra thông báo trước khi thử lại.',
    ],
    [
      'Rà soát nội dung được tạo',
      'Khi bản nháp sẵn sàng, mở khóa để kiểm tra từng chương, bài học và điều kiện hoàn thành. Chỉnh nội dung sai trước khi xuất bản.',
    ],
  ]),
  ...screen('/assistant', 'AI_ASSISTANT', [
    [
      'Đặt câu hỏi có bối cảnh',
      'Nhập câu hỏi vào ô trò chuyện. Nêu rõ bài, khóa hoặc nghiệp vụ muốn tìm hiểu để trợ lý trả lời đúng trọng tâm.',
    ],
    [
      'Đọc và mở nguồn',
      'Khi có trích dẫn, bấm nguồn để đối chiếu nội dung. Tiếp tục hỏi ngắn trong cùng cuộc trò chuyện nếu cần làm rõ.',
    ],
    [
      'Quản lý tài liệu',
      'Mở Tài liệu để xem các tệp của bạn. Chọn tệp muốn dùng và kiểm tra trạng thái xử lý trước khi hỏi về nội dung tệp.',
    ],
  ]),
  ...screen('/community/contents/:id', 'COMMUNITY', [
    [
      'Đọc nội dung và phản hồi',
      'Đọc bài và kiểm tra nhóm chủ đề, rồi xem các bình luận hoặc câu trả lời phía dưới.',
    ],
    [
      'Tham gia trao đổi',
      'Viết phản hồi ở mục thích hợp rồi gửi. Nếu là nội dung của bạn, mở thao tác sửa để cập nhật khi cần.',
    ],
  ]),
  ...[
    '/community/questions/new',
    '/community/articles/new',
    '/community/contents/:id/edit',
  ].flatMap((path) =>
    screen(path, 'COMMUNITY', [
      [
        'Soạn nội dung rõ ràng',
        'Nhập tiêu đề và nội dung, chọn đúng chủ đề. Nêu bối cảnh hoặc ví dụ để người đọc dễ theo dõi.',
      ],
      [
        'Kiểm tra trước khi lưu hoặc đăng',
        'Đọc lại nội dung, tệp đính kèm nếu có và các trường còn lỗi. Bấm nút lưu hoặc đăng, rồi mở chi tiết để xem nội dung hiển thị.',
      ],
    ]),
  ),
  ...screen('/community/reviews/:id', 'COMMUNITY', [
    [
      'Đọc phương án cần góp ý',
      'Mở mô tả, bối cảnh và tệp kèm theo nếu có. Xem các phản hồi trước khi đưa ra ý kiến.',
    ],
    [
      'Nêu góp ý có căn cứ',
      'Ghi rõ phần cần thay đổi, tình huống và lý do. Đọc lại rồi gửi phản hồi.',
    ],
  ]),
  ...['/community/reviews/new', '/community/reviews/:id/edit'].flatMap((path) =>
    screen(path, 'COMMUNITY', [
      [
        'Mô tả vấn đề và phương án',
        'Nhập tiêu đề, bối cảnh, phương án muốn được review và nội dung cần góp ý. Thêm tài liệu minh họa nếu có.',
      ],
      [
        'Lưu và theo dõi phản hồi',
        'Kiểm tra các trường bắt buộc trước khi lưu. Mở chi tiết đề xuất để theo dõi các ý kiến sau khi gửi.',
      ],
    ]),
  ),
  ...screen('/chat-room', 'PROFILE', [
    [
      'Vào phòng',
      'Chọn tên hiển thị rồi vào phòng. Dùng Mời bạn học để lấy đường dẫn của phòng khi cần.',
    ],
    [
      'Tương tác trong phòng',
      'Dùng khu vực trò chuyện để gửi tin hoặc chọn trò chơi trên bản đồ. Có thể xem điểm ở Bảng CPoint và bấm Rời phòng khi kết thúc.',
    ],
  ]),
  ...screen('/leaderboard', 'PROFILE', [
    [
      'Đọc bảng xếp hạng',
      'Chọn phạm vi thời gian để xem điểm và vị trí trong bảng. Mở thông tin thành tích để hiểu cách điểm được ghi nhận.',
    ],
    [
      'Theo dõi thành tích cá nhân',
      'Xem cấp độ, huy hiệu và chuỗi ngày học. Mở chi tiết huy hiệu để xem điều kiện còn thiếu.',
    ],
  ]),
];

export const GUIDE_STEPS: Record<GuideAudience, readonly UsageGuideStep[]> = {
  admin: [
    {
      title: 'Không gian quản trị',
      path: '/profile',
      target: '.app-shell__sidebar, .header__menu',
      permission: 'PROFILE',
      text: 'Dùng menu bên trái để quản lý tổ chức, tài khoản và hoạt động đào tạo. Trên màn hình nhỏ, bấm nút menu ở đầu trang. Các danh sách và thao tác tuân theo phạm vi đơn vị/nhóm được cấp; quản trị đơn vị không mặc định có quyền toàn hệ thống.',
    },
    {
      title: 'Thiết lập đơn vị, phòng và nhóm',
      path: '/admin/org',
      target: 'main ui-tree, main ui-page-header',
      permission: 'ORGANIZATION_MANAGEMENT',
      text: 'Chọn đơn vị hoặc phòng trên cây để xem thông tin và nhóm trực thuộc. Bấm Thêm đơn vị / phòng để bổ sung tổ chức; chọn đúng đơn vị trước khi quản lý nhóm. Dùng Nhập từ tệp khi cần nhập nhiều dòng và kiểm tra kết quả trước khi xác nhận.',
    },
    {
      title: 'Quản lý tài khoản',
      path: '/admin/users',
      target: 'main ui-tabs',
      permission: 'USER_MANAGEMENT',
      text: 'Ở tab Người dùng, tìm theo tên, mã cán bộ hoặc tên đăng nhập, rồi chọn bộ lọc đơn vị và trạng thái. Bấm Thêm người dùng để tạo tài khoản; mở hồ sơ từ danh sách để sửa theo quyền được cấp. Các tab còn lại giúp xử lý đăng ký hoặc nhập danh sách theo chức năng được bật.',
    },
    {
      title: 'Vai trò và phạm vi phân quyền',
      path: '/admin/roles',
      target: 'main ui-page-header',
      permission: 'ROLE_MANAGEMENT',
      text: 'Chọn vai trò để xem các chức năng được mở. Khi phân quyền cho người dùng, kiểm tra đồng thời vai trò và phạm vi áp dụng như đơn vị hoặc nhóm; mở được menu không đồng nghĩa được sửa mọi dữ liệu. Rà soát các quyền đã chọn trước khi lưu hoặc thu hồi.',
    },
    {
      title: 'Tổ chức danh mục đào tạo',
      path: '/admin/catalog',
      target: 'main ui-tree',
      permission: 'TRAINING_CATALOG',
      text: 'Chọn lĩnh vực trên cây để quản lý chương trình. Thêm hoặc sửa lĩnh vực để quản lý các phân hệ nghiệp vụ bên trong. Chuẩn bị đúng chương trình/phân hệ trước khi tạo khóa; các mục mới nằm cuối cây theo thời gian tạo để dễ tìm lại.',
    },
    {
      title: 'Quản lý nội dung khóa học',
      path: '/admin/courses',
      target: 'main ui-page-header',
      permission: 'COURSE_MANAGEMENT',
      text: 'Tìm khóa theo tên/mã, lĩnh vực và trạng thái. Bấm Tạo khóa học để đi qua thông tin cơ bản, nội dung, điều kiện thi và đối tượng xuất bản. Với khóa đã xuất bản, mở bản nháp trước khi sửa. Để xem kỹ cách soạn từng bước, mở lại hướng dẫn và chọn Giảng viên.',
    },
    {
      title: 'Thư viện bài giảng',
      path: '/admin/lessons',
      target: 'main ui-page-header',
      permission: 'LESSON_MANAGEMENT',
      text: 'Nhập ZIP SCORM 1.2 và xem thử trước khi sử dụng. Bài giảng trong thư viện có thể được chọn lại khi soạn khóa; giảng viên cũng có thể tải ZIP ngay trong bài học. Điểm và tiến độ xem thử không thay cho kết quả học viên trong khóa.',
    },
    {
      title: 'Ngân hàng câu hỏi theo chương trình',
      path: '/admin/questions',
      target: '.assessment__scope',
      permission: 'QUESTION_BANK',
      text: 'Chọn chương trình trước khi thêm hoặc nhập câu hỏi từ Excel. Các khóa trong cùng chương trình có thể dùng chung bộ câu hỏi. Kiểm tra nội dung, loại câu, đáp án và nhóm năng lực; dùng mẫu Excel của màn hình để nhập đúng cấu trúc.',
    },
    {
      title: 'Quản lý bài kiểm tra và lượt thi',
      path: '/admin/quizzes',
      target: '.assessment__scope',
      permission: 'QUIZ_MANAGEMENT',
      text: 'Chọn chương trình và khóa rồi tạo hoặc cấu hình bài kiểm tra. Rà soát điểm đạt, thời gian, lịch mở/đóng, điều kiện hoàn thành bài học và số lượt thi lại. Khi học viên hết lượt, dùng chức năng cấp thêm lượt chỉ định theo quyền được cấp; không sửa kết quả cũ để thay thế lượt mới.',
    },
    {
      title: 'Giao khóa học và theo dõi hạn',
      path: '/admin/assignments',
      target: 'main ui-page-header',
      permission: 'COURSE_ASSIGNMENT',
      text: 'Bấm Giao khóa học, chọn khóa đã xuất bản và đơn vị/nhóm/người nhận phù hợp. Kiểm tra ngày bắt đầu, hạn và nhắc hạn trước khi lưu. Mở đợt giao để xem tiến độ, đổi lịch hoặc thu hồi theo quyền; giữ nguyên lịch sử học và kết quả đã có.',
    },
    {
      title: 'Đọc và xuất báo cáo đào tạo',
      path: '/reports',
      target: 'main ui-page-header',
      permission: 'REPORTING',
      text: 'Chọn Học tập hoặc Đánh giá, mở Bộ lọc và chọn lần lượt đơn vị, phòng/nhóm, khóa và bài kiểm tra. Bấm Áp dụng bộ lọc rồi đọc phạm vi cạnh từng khối. Mã cán bộ, trạng thái và kết quả trong báo cáo lượt thi chỉ lọc bảng cùng CSV; biểu đồ dùng phạm vi chung.',
    },
    {
      title: 'Điều phối nội dung cộng đồng',
      path: '/community/moderation',
      target: 'main ui-page-header',
      permission: 'COMMUNITY_MODERATION',
      text: 'Dùng các tab và bộ lọc để tìm nội dung cần xem xét. Mở chi tiết, đọc nội dung và phản hồi trước khi chọn thao tác điều phối. Kiểm tra đúng nội dung và lý do khi hệ thống yêu cầu xác nhận.',
    },
    {
      title: 'Cấu hình điểm thưởng và huy hiệu',
      path: '/admin/gamification',
      target: 'main ui-page-header',
      permission: 'SYSTEM_AUDIT',
      text: 'Tại màn cấu hình điểm thưởng, xem quy tắc XP, cấp độ, huy hiệu và lịch làm việc. Kiểm tra điều kiện và giá trị trước khi lưu để động lực học dựa trên hoạt động thực tế. Các thao tác được mở theo quyền quản trị của tài khoản.',
    },
    {
      title: 'Hồ sơ và xem lại hướng dẫn',
      path: '/profile',
      target: '[data-guide="account-menu"]',
      permission: 'PROFILE',
      text: 'Mở thông tin đăng nhập ở góc trên phải để xem hồ sơ, thông báo và Hướng dẫn sử dụng. Có thể chọn lại Quản trị viên, Giảng viên hoặc Học viên theo các chức năng của tài khoản. Bỏ qua hướng dẫn không thay đổi dữ liệu hay quyền truy cập.',
    },
  ],
  learner: [
    {
      title: 'Menu học tập',
      path: '/learn',
      target: '[data-guide="learner-navigation"]',
      permission: 'COURSE_LEARNING',
      text: 'Bấm Học tập để mở Khóa học của tôi, Danh mục khóa học, Tiến độ học tập hoặc Làm bài kiểm tra. Công cụ học chứa ghi chú và chứng nhận; Cộng đồng là nơi trao đổi với đồng nghiệp.',
    },
    {
      title: 'Chọn khóa cần học',
      path: '/learn',
      target: '.learn__courses',
      permission: 'COURSE_LEARNING',
      text: 'Chọn tab Đang học, Chưa bắt đầu, Bắt buộc hoặc Được giao. Bấm vào thẻ khóa để xem nội dung và điều kiện hoàn thành. Xem tất cả mở đầy đủ danh sách theo đúng tab bạn đang chọn.',
    },
    {
      title: 'Ưu tiên hạn hoàn thành',
      path: '/learn',
      target: '[aria-labelledby="learn-due"], #learn-due',
      permission: 'COURSE_LEARNING',
      text: 'Xem các khóa sắp đến hạn tại đây. Bấm tên khóa để học. Trong màn bài học, dùng Quay lại / Tiếp theo để chuyển nội dung; video, PDF và SCORM lưu tiến độ tự động. Khóa có bài kiểm tra bắt buộc còn cần đạt điểm yêu cầu.',
    },
    {
      title: 'Tìm thêm khóa học',
      path: '/catalog',
      target: '.catalog__filters',
      permission: 'COURSE_LEARNING',
      text: 'Nhập tên hoặc mã khóa. Trên điện thoại, bấm Bộ lọc để chọn lĩnh vực, chương trình, phân hệ và trạng thái; bấm dấu × ở điều kiện để bỏ lọc. Đã tham gia gồm cả khóa tự đăng ký; Được giao chỉ gồm khóa được giao. Chọn thẻ khóa để xem điều kiện và học.',
    },
    {
      title: 'Xem tiến độ và năng lực',
      path: '/progress',
      target: 'main ui-tabs',
      permission: 'LEARNING_PROGRESS',
      text: 'Tab Tiến độ khóa học cho biết nội dung đã học, kết quả thi và hạn. Chọn Năng lực để xem nhóm năng lực và nhịp học; chọn Lịch sử thi để xem các lần thi. 100% nội dung chưa thay thế điều kiện đạt bài kiểm tra bắt buộc.',
    },
    {
      title: 'Chuẩn bị trước khi làm bài',
      path: '/quiz',
      target: 'main ui-page-header',
      permission: 'QUIZ_TAKING',
      text: 'Chọn bài kiểm tra để xem điểm đạt, lượt còn lại và lịch sử. Bấm Vào thi để đọc quy tắc trước khi bắt đầu. Khi làm bài, theo dõi đồng hồ, chọn đáp án, dùng Quay lại / Tiếp theo và xác nhận nộp bài. Hết lượt thì liên hệ giảng viên để được xem xét cấp thêm.',
    },
    {
      title: 'Tìm lại ghi chú và đánh dấu',
      path: '/saved',
      target: 'main ui-page-header',
      permission: 'COURSE_LEARNING',
      text: 'Chọn bài học ở danh sách, rồi bấm ghi chú hoặc mốc đánh dấu để mở đúng vị trí. Khi đang học, bạn có thể ghi chú, đánh dấu trang PDF hoặc mốc video để quay lại sau.',
    },
    {
      title: 'Nhận chứng nhận',
      path: '/certificates',
      target: 'main ui-page-header',
      permission: 'COURSE_LEARNING',
      text: 'Khóa hoàn thành đủ điều kiện sẽ có chứng nhận tại đây. Tìm theo tên khóa hoặc mã, bấm Xem chứng nhận để xem đầy đủ và tải về. Mã xác thực giúp đối chiếu chứng nhận.',
    },
    {
      title: 'Thông báo và trợ giúp',
      path: '/learn',
      target: '[data-guide="account-menu"]',
      permission: 'COURSE_LEARNING',
      text: 'Bấm chuông để xem thông báo, mở đúng khóa sắp đến hạn và đánh dấu đã đọc. Bấm thông tin đăng nhập để mở Hồ sơ cá nhân. Bạn có thể mở lại toàn bộ hướng dẫn qua Hướng dẫn sử dụng trong menu này.',
    },
  ],
  instructor: [
    {
      title: 'Không gian giảng viên',
      path: '/admin/courses',
      target: '.app-shell__sidebar, .header__menu',
      permission: 'COURSE_MANAGEMENT',
      text: 'Dùng menu Nội dung để quản lý khóa học, lĩnh vực/chương trình, thư viện bài giảng, ngân hàng câu hỏi và bài kiểm tra. Trên điện thoại, bấm biểu tượng menu ở đầu trang để mở các mục này.',
    },
    {
      title: 'Chuẩn bị lĩnh vực và chương trình',
      path: '/admin/catalog',
      target: 'main ui-tree',
      permission: 'TRAINING_CATALOG',
      text: 'Chọn một lĩnh vực trên cây để xem các chương trình. Thêm lĩnh vực cho phép nhập nhiều phân hệ nghiệp vụ; mở Sửa lĩnh vực để sửa/xóa phân hệ. Tạo chương trình trong đúng lĩnh vực trước khi soạn khóa học.',
    },
    {
      title: 'Chuẩn bị câu hỏi dùng chung',
      path: '/admin/questions',
      target: '.assessment__scope',
      permission: 'QUESTION_BANK',
      text: 'Chọn chương trình, rồi bấm Thêm câu hỏi hoặc Nhập từ Excel. Các khóa trong cùng chương trình dùng chung ngân hàng. Khi soạn câu hỏi, nhập phương án, chọn đáp án đúng và bổ sung giải thích để học viên ôn tập.',
    },
    {
      title: 'Thư viện bài giảng SCORM',
      path: '/admin/lessons',
      target: 'main ui-page-header',
      permission: 'LESSON_MANAGEMENT',
      text: 'Nhập tệp ZIP SCORM 1.2 để xem thử. Bạn cũng có thể tải ZIP ngay khi soạn một bài học; dùng thư viện khi muốn tái sử dụng bài giảng đã có. Kiểm tra điểm, trạng thái hoàn thành và vị trí học tiếp trước khi xuất bản.',
    },
    {
      title: 'Bước 1: thông tin khóa học',
      path: '/admin/courses/new',
      target: 'app-course-info',
      permission: 'COURSE_MANAGEMENT',
      text: 'Nhập tên, mã, chương trình và mức độ; chọn phân hệ nếu cần. Lưu nháp giữ nội dung để làm tiếp. Bấm Tiếp theo khi đã điền đủ các trường bắt buộc; lỗi sẽ được chỉ rõ tại từng trường.',
    },
    {
      title: 'Bước 2: soạn nội dung',
      path: '/admin/courses/new',
      target: 'ui-stepper',
      permission: 'COURSE_MANAGEMENT',
      text: 'Sau khi hoàn thành bước 1, chọn Nội dung khóa học để thêm chương và bài. Mỗi bài có thể là văn bản, video, PDF, tệp đính kèm hoặc SCORM. Với SCORM, chọn từ thư viện rồi tìm ngay bên trong dropdown, hoặc tải ZIP trực tiếp.',
    },
    {
      title: 'Bước 3 và 4: bài kiểm tra, đối tượng, xuất bản',
      path: '/admin/courses/new',
      target: 'ui-stepper',
      permission: 'COURSE_MANAGEMENT',
      text: 'Ở Bài kiểm tra & điều kiện, chọn không yêu cầu, bài kiểm tra hiện có hoặc tạo bài kiểm tra cuối khóa mới rồi chọn câu hỏi. Ở Đối tượng & xuất bản, chọn đơn vị/nhóm/người học, thời hạn và rà soát trước khi xuất bản. Khóa có bài kiểm tra bắt buộc chỉ hoàn thành khi học viên đạt điểm yêu cầu.',
    },
    {
      title: 'Cấu hình và theo dõi bài kiểm tra',
      path: '/admin/quizzes',
      target: '.assessment__scope',
      permission: 'QUIZ_MANAGEMENT',
      text: 'Chọn chương trình và khóa học rồi tạo hoặc cấu hình bài kiểm tra. Quay lại / Tiếp theo chuyển đúng một khóa trong danh sách. Rà soát lịch mở/đóng, điểm đạt, điều kiện học trước, số lượt và thời gian chờ thi lại.',
    },
    {
      title: 'Giao khóa học và quản lý hạn',
      path: '/admin/assignments',
      target: 'main ui-page-header',
      permission: 'COURSE_ASSIGNMENT',
      text: 'Bấm Giao khóa học, chọn khóa đã xuất bản và các đối tượng phù hợp. Kiểm tra ngày bắt đầu, hạn hoàn thành và nhắc hạn. Trong danh sách lượt giao, xem tiến độ và sửa hạn theo quyền được cấp.',
    },
    {
      title: 'Đọc báo cáo đúng phạm vi',
      path: '/reports',
      target: 'main ui-page-header',
      permission: 'REPORTING',
      text: 'Chọn Học tập hoặc Đánh giá, rồi chọn đơn vị, phòng/nhóm, khóa và bài kiểm tra. Đọc phạm vi ghi cạnh số liệu: bộ lọc riêng của bảng có thể không áp dụng cho biểu đồ. Xuất CSV dùng cùng điều kiện của bảng chi tiết.',
    },
    {
      title: 'Xem lại hướng dẫn bất kỳ lúc nào',
      path: '/admin/courses',
      target: '[data-guide="account-menu"]',
      permission: 'COURSE_MANAGEMENT',
      text: 'Menu tài khoản ở góc phải có Hướng dẫn sử dụng để mở lại các bước này. Bạn có thể bỏ qua hướng dẫn và tiếp tục thao tác bình thường; tiến độ soạn và quyền truy cập vẫn do từng chức năng quản lý.',
    },
  ],
};
