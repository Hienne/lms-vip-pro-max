/* ==========================================================================
   data/seed.js — DỮ LIỆU MẪU GIẢ LẬP (Phần E đề bài)
   Toàn bộ tên người, nội dung đều là dữ liệu giả lập, không dùng dữ liệu thật.
   Thời gian tính tương đối từ "hôm nay" để trạng thái quá hạn luôn đúng khi demo.
   Khi có backend: file này = script seed DB (seed.sql / seed.ts).
   ========================================================================== */
(function (LMS) {
  const DAY = 86400000;
  const D = (days, hour = 9, min = 0) => { const d = new Date(Date.now() + days * DAY); d.setHours(hour, min, 0, 0); return d.toISOString(); };

  function build() {
    /* ---------------- Tổ chức ---------------- */
    const units = [
      { id: 'u1', code: 'QLPTCB', name: 'Ban QL&PT Core Banking', status: 'active' },
      { id: 'u2', code: 'TTVH', name: 'Trung tâm Vận hành CNTT (giả lập)', status: 'active' },
    ];
    const groups = [
      { id: 'g1', unitId: 'u1', name: 'Nhóm Tổng hợp & QA', kind: 'team' },
      { id: 'g2', unitId: 'u1', name: 'Nhóm Quản trị hệ thống Core Banking', kind: 'team' },
      { id: 'g3', unitId: 'u1', name: 'Nhóm Phát triển nghiệp vụ', kind: 'team' },
      { id: 'g4', unitId: 'u2', name: 'Phòng Vận hành hạ tầng', kind: 'department' },
    ];

    /* ---------------- Người dùng (4 vai trò, tài khoản riêng) ---------------- */
    const U = (id, name, email, role, unitId, groupId, title, extra = {}) => ({
      id, name, email, role, unitId, groupId, title, staffCode: 'CB' + (1000 + parseInt(id.replace(/\D/g, '') || '0', 10)),
      adminScope: null, status: 'active', joinedAt: D(-200), lastLoginAt: D(-1, 8, 30), ...extra,
    });
    const users = [
      U('a1', 'Phạm Thu Trang', 'admin@demo.cb', 'admin', 'u1', 'g1', 'Quản trị hệ thống đào tạo'),
      U('a2', 'Đặng Quốc Bảo', 'qtdonvi@demo.cb', 'admin', 'u2', 'g4', 'Quản trị viên đơn vị', { adminScope: 'u2' }),
      U('i1', 'Lê Hoàng Nam', 'giangvien@demo.cb', 'instructor', 'u1', 'g2', 'Chuyên gia Core Banking'),
      U('v1', 'Trần Minh Đức', 'lanhdao@demo.cb', 'viewer', 'u1', 'g1', 'Lãnh đạo Ban'),
      U('l1', 'Nguyễn Ngọc Anh', 'hocvien@demo.cb', 'learner', 'u1', 'g2', 'Chuyên viên vận hành', { joinedAt: D(-28) }),
      U('l2', 'Vũ Minh Khoa', 'khoa.vm@demo.cb', 'learner', 'u1', 'g1', 'Chuyên viên QA', { joinedAt: D(-60) }),
      U('l3', 'Hoàng Thu Hà', 'ha.ht@demo.cb', 'learner', 'u1', 'g3', 'Chuyên viên phân tích nghiệp vụ', { joinedAt: D(-6), lastLoginAt: null }),
      U('l4', 'Bùi Quang Dũng', 'dung.bq@demo.cb', 'learner', 'u1', 'g2', 'Chuyên viên vận hành', { joinedAt: D(-40), lastLoginAt: D(-9) }),
      U('l5', 'Đỗ Phương Thảo', 'thao.dp@demo.cb', 'learner', 'u2', 'g4', 'Kỹ sư hạ tầng', { joinedAt: D(-20) }),
      U('l6', 'Ngô Anh Khôi', 'khoi.na@demo.cb', 'learner', 'u2', 'g4', 'Kỹ sư hạ tầng', { joinedAt: D(-30) }),
      U('l7', 'Lý Mai Chi', 'chi.lm@demo.cb', 'learner', 'u1', 'g1', 'Chuyên viên QA', { joinedAt: D(-75), status: 'active' }),
      U('l8', 'Phan Đức Long', 'long.pd@demo.cb', 'learner', 'u1', 'g3', 'Chuyên viên (đã nghỉ việc)', { status: 'locked', lastLoginAt: D(-90) }),
    ];

    /* ---------------- Phân cấp nội dung ---------------- */
    const competencies = ['Kiến trúc hệ thống', 'Dữ liệu khách hàng', 'Giao dịch & hạch toán', 'Quản lý thay đổi', 'Vận hành EOD', 'An toàn thông tin'];
    const modules = ['Tổng quan', 'Khách hàng (CIF)', 'Tiền gửi', 'Giao dịch & hạch toán', 'Vận hành EOD', 'Quản lý thay đổi', 'Hội nhập'];
    const domains = [
      { id: 'd1', code: 'NV', name: 'Nghiệp vụ Core Banking', status: 'published', ownerUnitId: 'u1' },
      { id: 'd2', code: 'CN', name: 'Công nghệ & hạ tầng', status: 'published', ownerUnitId: 'u1' },
      { id: 'd3', code: 'VH', name: 'Vận hành & quy trình', status: 'published', ownerUnitId: 'u1' },
      { id: 'd4', code: 'HN', name: 'Hội nhập & văn hóa', status: 'published', ownerUnitId: 'u1' },
    ];
    const programs = [
      { id: 'p1', domainId: 'd4', code: 'HN-01', name: 'Hội nhập cán bộ mới', desc: 'Lộ trình 30 ngày đầu cho cán bộ mới và cán bộ luân chuyển.', status: 'published' },
      { id: 'p2', domainId: 'd1', code: 'NV-01', name: 'Nền tảng nghiệp vụ Core Banking', desc: 'Kiến thức nền về kiến trúc, dữ liệu và giao dịch trên Core.', status: 'published' },
      { id: 'p3', domainId: 'd3', code: 'VH-01', name: 'Vận hành hệ thống Core Banking', desc: 'Quy trình vận hành, quản lý thay đổi và xử lý cuối ngày.', status: 'published' },
      { id: 'p4', domainId: 'd2', code: 'CN-01', name: 'An toàn thông tin', desc: 'Chuẩn an toàn thông tin cho cán bộ công nghệ.', status: 'draft' },
    ];

    const C = (id, programId, code, title, module, level, required, status, desc, outcomes, quizId, reward, cover) => ({
      id, programId, code, title, module, level, required, status, desc, outcomes,
      completion: { lessonsAll: true, quizId }, ownerUnitId: 'u1', sharedUnitIds: ['u2'], rewardPoints: reward, updatedAt: D(-3), cover,
    });
    const courses = [
      C('c1', 'p2', 'NV-101', 'Tổng quan hệ thống Core Banking', 'Tổng quan', 'Cơ bản', true, 'published',
        'Hiểu kiến trúc tổng thể, mô hình dữ liệu khách hàng và luồng giao dịch từ kênh đến hệ thống lõi.',
        ['Mô tả được các thành phần chính của hệ thống Core Banking', 'Giải thích vai trò của mã CIF và hồ sơ khách hàng', 'Theo dõi được luồng một giao dịch từ kênh đến sổ cái', 'Nhận diện các điểm kiểm soát maker–checker'], 'q1', 80, 'layers'),
      C('c2', 'p3', 'VH-201', 'Quy trình quản lý thay đổi (Change Management)', 'Quản lý thay đổi', 'Trung cấp', true, 'published',
        'Nắm vòng đời một yêu cầu thay đổi, vai trò CAB, kế hoạch rollback và rà soát sau triển khai.',
        ['Lập được một yêu cầu thay đổi đầy đủ', 'Phân biệt thay đổi thường, chuẩn và khẩn cấp', 'Xây dựng kế hoạch rollback'], 'q2', 60, 'process'),
      C('c3', 'p3', 'VH-301', 'Vận hành cuối ngày (EOD/COB)', 'Vận hành EOD', 'Nâng cao', true, 'published',
        'Quy trình batch cuối ngày, kiểm tra trước EOD, giám sát và xử lý sự cố.',
        ['Thực hiện checklist trước EOD', 'Giám sát tiến trình batch', 'Xử lý sự cố EOD theo quy trình leo thang'], 'q3', 100, 'clock'),
      C('c4', 'p1', 'HN-101', 'Văn hóa & quy chế làm việc tại Ban', 'Hội nhập', 'Cơ bản', true, 'published',
        'Giới thiệu cơ cấu tổ chức, quy chế làm việc và các kênh hỗ trợ cho cán bộ mới.',
        ['Biết cơ cấu tổ chức và đầu mối liên hệ', 'Nắm quy chế làm việc và bảo mật thông tin'], null, 40, 'building'),
      C('c5', 'p2', 'NV-102', 'Phân hệ Tiền gửi', 'Tiền gửi', 'Trung cấp', false, 'published',
        'Sản phẩm tiền gửi, tham số lãi suất và vòng đời tài khoản tiền gửi trên Core.',
        ['Hiểu tham số sản phẩm tiền gửi', 'Theo dõi vòng đời tài khoản'], null, 50, 'database'),
      C('c6', 'p4', 'CN-101', 'An toàn thông tin cho cán bộ CNTT', 'Tổng quan', 'Cơ bản', false, 'draft',
        'Nguyên tắc an toàn thông tin khi làm việc với hệ thống lõi.',
        ['Áp dụng nguyên tắc quyền tối thiểu'], null, 40, 'shield'),
    ];
    courses[4].ownerUnitId = 'u1'; courses[4].sharedUnitIds = [];
    courses[5].sharedUnitIds = [];

    const chapters = [
      { id: 'ch1', courseId: 'c1', title: 'Kiến trúc & dữ liệu', order: 1 },
      { id: 'ch2', courseId: 'c1', title: 'Giao dịch & kiểm tra', order: 2 },
      { id: 'ch3', courseId: 'c2', title: 'Vòng đời thay đổi', order: 1 },
      { id: 'ch4', courseId: 'c3', title: 'Batch cuối ngày', order: 1 },
      { id: 'ch5', courseId: 'c4', title: 'Làm quen với Ban', order: 1 },
      { id: 'ch6', courseId: 'c5', title: 'Sản phẩm tiền gửi', order: 1 },
      { id: 'ch7', courseId: 'c6', title: 'Nguyên tắc cơ bản', order: 1 },
    ];
    const L = (id, courseId, chapterId, order, title, minutes, quizId = null) => ({ id, courseId, chapterId, order, title, minutes, quizId });
    const lessons = [
      L('ls1', 'c1', 'ch1', 1, 'Kiến trúc tổng thể hệ thống Core Banking', 18),
      L('ls2', 'c1', 'ch1', 2, 'Mô hình dữ liệu khách hàng (CIF)', 20),
      L('ls3', 'c1', 'ch2', 3, 'Luồng giao dịch từ kênh đến sổ cái', 15),
      L('ls4', 'c1', 'ch2', 4, 'Kiểm tra cuối khóa: Tổng quan Core Banking', 15, 'q1'),
      L('ls5', 'c2', 'ch3', 1, 'Vòng đời một yêu cầu thay đổi', 14),
      L('ls6', 'c2', 'ch3', 2, 'Phê duyệt thay đổi & CAB', 20),
      L('ls7', 'c2', 'ch3', 3, 'Kiểm tra: Quản lý thay đổi', 12, 'q2'),
      L('ls8', 'c3', 'ch4', 1, 'Tổng quan batch cuối ngày', 16),
      L('ls9', 'c3', 'ch4', 2, 'Sổ tay xử lý sự cố EOD', 25),
      L('ls10', 'c3', 'ch4', 3, 'Kiểm tra: Vận hành EOD', 10, 'q3'),
      L('ls11', 'c4', 'ch5', 1, 'Cơ cấu tổ chức & đầu mối hỗ trợ', 10),
      L('ls12', 'c4', 'ch5', 2, 'Quy chế làm việc & bảo mật', 12),
      L('ls13', 'c5', 'ch6', 1, 'Tham số sản phẩm tiền gửi', 15),
      L('ls14', 'c5', 'ch6', 2, 'Vòng đời tài khoản tiền gửi', 18),
      L('ls15', 'c6', 'ch7', 1, 'Nguyên tắc quyền tối thiểu', 10),
    ];

    /* ---------------- Tệp ---------------- */
    const F = (id, name, mime, size, state = 'ok') => ({ id, name, mime, size, url: `/storage/demo/${name}`, state, uploadedBy: 'i1', uploadedAt: D(-14) });
    const files = [
      F('f1', 'kien-truc-core-banking.mp4', 'video/mp4', 186_000_000),
      F('f2', 'mo-hinh-du-lieu-cif.pdf', 'application/pdf', 2_400_000),
      F('f3', 'so-do-luong-giao-dich.png', 'image/png', 640_000),
      F('f4', 'bieu-mau-yeu-cau-thay-doi.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 84_000),
      F('f5', 'vong-doi-thay-doi.mp4', 'video/mp4', 142_000_000),
      F('f6', 'quy-che-cab.pdf', 'application/pdf', 1_100_000),
      F('f7', 'tong-quan-eod.mp4', 'video/mp4', 168_000_000),
      F('f8', 'so-tay-su-co-eod.pdf', 'application/pdf', 3_800_000),
      F('f9', 'gioi-thieu-ban.mp4', 'video/mp4', 96_000_000),
      F('f10', 'tham-so-tien-gui.pdf', 'application/pdf', 1_900_000, 'missing'), // tệp lỗi — demo xử lý tệp bị xóa
      F('f11', 'checklist-truoc-eod.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 46_000),
      F('f12', 'vong-doi-tai-khoan.mp4', 'video/mp4', 120_000_000),
    ];

    /* ---------------- Khối nội dung ---------------- */
    const B = (id, lessonId, order, type, title, fileId, data) => ({ id, lessonId, order, type, title, fileId, data });
    const transcript = (lines) => lines.map((text, i) => ({ t: i * 45 + 5, text }));
    const blocks = [
      B('b1', 'ls1', 1, 'video', 'Bài giảng: Kiến trúc tổng thể', 'f1', {
        duration: 1080, chapters: [{ t: 0, title: 'Giới thiệu' }, { t: 240, title: 'Các lớp kiến trúc' }, { t: 600, title: 'Tích hợp kênh' }, { t: 900, title: 'Tổng kết' }],
        transcript: transcript(['Chào mừng các bạn đến với bài học về kiến trúc tổng thể hệ thống Core Banking.', 'Core Banking là hệ thống lõi xử lý tập trung tài khoản, giao dịch và sổ cái.', 'Kiến trúc gồm ba lớp chính: kênh giao dịch, lớp tích hợp và hệ thống lõi.', 'Lớp tích hợp chuẩn hóa thông điệp và định tuyến yêu cầu tới phân hệ phù hợp.', 'Sổ cái tổng hợp ghi nhận mọi bút toán theo nguyên tắc bút toán kép.', 'Ngày làm việc của hệ thống chỉ chuyển sang ngày mới sau khi chạy xong cuối ngày.', 'Môi trường kiểm thử phải dùng dữ liệu đã che giấu, không dùng dữ liệu thật.']),
      }),
      B('b2', 'ls1', 2, 'text', 'Tóm tắt kiến trúc', null, {
        markdown: '## Ba lớp kiến trúc\nHệ thống Core Banking thường được tổ chức thành **ba lớp**:\n\n- **Kênh giao dịch**: quầy, ATM/POS, Internet/Mobile banking.\n- **Lớp tích hợp** (middleware/ESB): chuẩn hóa thông điệp, định tuyến, kiểm soát lưu lượng.\n- **Hệ thống lõi**: khách hàng (CIF), tiền gửi, tiền vay, thanh toán và sổ cái tổng hợp (GL).\n\n> Mọi thay đổi trên hệ thống lõi phải qua quy trình quản lý thay đổi và kiểm thử trên môi trường SIT/UAT trước khi lên Production.',
      }),
      B('b3', 'ls2', 1, 'pdf', 'Tài liệu: Mô hình dữ liệu khách hàng', 'f2', {
        pages: 12, outline: ['Mục đích tài liệu', 'Khái niệm CIF', 'Cấu trúc hồ sơ khách hàng', 'Quan hệ CIF – tài khoản', 'Quy tắc định danh duy nhất', 'Thông tin bắt buộc', 'Kiểm soát maker–checker', 'Lịch sử thay đổi hồ sơ', 'Che giấu dữ liệu khi kiểm thử', 'Câu hỏi thường gặp', 'Tình huống mẫu', 'Phụ lục thuật ngữ'],
      }),
      B('b4', 'ls2', 2, 'attachment', 'Tệp đính kèm', null, { items: ['f4'] }),
      B('b5', 'ls3', 1, 'process', 'Quy trình: Luồng một giao dịch chuyển khoản', null, {
        steps: [
          { title: 'Khởi tạo tại kênh', text: 'Khách hàng hoặc giao dịch viên nhập lệnh chuyển khoản trên kênh (quầy, Internet banking…).' },
          { title: 'Xác thực & kiểm tra hạn mức', text: 'Lớp tích hợp xác thực phiên, kiểm tra hạn mức và định dạng thông điệp.' },
          { title: 'Hạch toán trên Core', text: 'Hệ thống lõi ghi Nợ tài khoản chuyển, ghi Có tài khoản nhận theo nguyên tắc bút toán kép; nếu lỗi ở bất kỳ bước nào, toàn bộ giao dịch được hoàn trả.' },
          { title: 'Phê duyệt (nếu vượt hạn mức)', text: 'Giao dịch vượt thẩm quyền chuyển sang người kiểm soát (checker) phê duyệt.' },
          { title: 'Phản hồi & đối chiếu', text: 'Kết quả trả về kênh; cuối ngày đối chiếu số liệu giữa phân hệ chi tiết và sổ cái.' },
        ],
        links: [{ label: 'Sơ đồ luồng giao dịch (hình bên dưới)', href: '#block-b6' }, { label: 'Tài liệu: Mô hình dữ liệu khách hàng', href: '#/lesson/c1/ls2' }],
      }),
      B('b6', 'ls3', 2, 'image', 'Sơ đồ luồng giao dịch', 'f3', { caption: 'Hình 1. Luồng chuyển khoản qua 3 lớp: kênh → tích hợp → lõi' }),
      B('b7', 'ls5', 1, 'video', 'Bài giảng: Vòng đời thay đổi', 'f5', {
        duration: 840, chapters: [{ t: 0, title: 'Vì sao cần quản lý thay đổi' }, { t: 300, title: 'Các loại thay đổi' }, { t: 600, title: 'Rollback' }],
        transcript: transcript(['Quản lý thay đổi giúp giảm rủi ro gián đoạn khi thay đổi hệ thống.', 'Một yêu cầu thay đổi cần mô tả, lý do, đánh giá tác động và kế hoạch rollback.', 'Có ba loại: thay đổi chuẩn, thay đổi thường và thay đổi khẩn cấp.', 'Thay đổi khẩn cấp được phê duyệt rút gọn và bổ sung hồ sơ sau.', 'Kế hoạch rollback được dùng khi triển khai thất bại.']),
      }),
      B('b8', 'ls6', 1, 'process', 'Quy trình phê duyệt thay đổi', null, {
        steps: [
          { title: 'Đăng ký yêu cầu (RFC)', text: 'Người yêu cầu lập RFC theo biểu mẫu, đính kèm đánh giá tác động.' },
          { title: 'Đánh giá rủi ro', text: 'Nhóm kỹ thuật đánh giá rủi ro, khung giờ triển khai và kế hoạch rollback.' },
          { title: 'Họp CAB', text: 'Hội đồng phê duyệt thay đổi xem xét và ra quyết định.' },
          { title: 'Triển khai', text: 'Người triển khai (tách biệt người phát triển) thực hiện trong khung giờ đã duyệt.' },
          { title: 'Rà soát sau triển khai (PIR)', text: 'Ghi nhận kết quả, bài học và đóng yêu cầu.' },
        ], links: [],
      }),
      B('b9', 'ls6', 2, 'pdf', 'Quy chế hoạt động CAB', 'f6', { pages: 6, outline: ['Phạm vi', 'Thành phần CAB', 'Lịch họp', 'Tiêu chí phê duyệt', 'Thay đổi khẩn cấp', 'Biểu mẫu'] }),
      B('b10', 'ls8', 1, 'video', 'Bài giảng: Batch cuối ngày', 'f7', {
        duration: 960, chapters: [{ t: 0, title: 'EOD là gì' }, { t: 420, title: 'Chuỗi job' }, { t: 720, title: 'Giám sát' }],
        transcript: transcript(['EOD là chuỗi xử lý batch cuối ngày: tính lãi, phí, khóa sổ và chuyển ngày làm việc.', 'Trước EOD cần đảm bảo đã đóng ca, không còn giao dịch treo và đã sao lưu.', 'Trong EOD cần giám sát thời gian chạy từng job và tài nguyên hệ thống.', 'Khi job lỗi: xác định job, đọc log và thông báo theo quy trình sự cố.']),
      }),
      B('b11', 'ls9', 1, 'pdf', 'Sổ tay xử lý sự cố EOD', 'f8', { pages: 18, outline: ['Giới thiệu', 'Phân loại sự cố', 'Ma trận leo thang', 'Checklist trước EOD', 'Giám sát job', 'Lỗi thường gặp', 'Chạy lại job', 'Khôi phục từ bản sao lưu', 'Báo cáo sự cố', 'Phụ lục'] }),
      B('b12', 'ls9', 2, 'process', 'Quy trình leo thang sự cố EOD', null, {
        steps: [
          { title: 'Phát hiện', text: 'Hệ thống giám sát cảnh báo job lỗi hoặc chạy quá thời gian.' },
          { title: 'Phân loại', text: 'Xác định mức độ ảnh hưởng tới giờ mở cửa ngày làm việc mới.' },
          { title: 'Leo thang', text: 'Thông báo trưởng ca và cấp quản lý theo ma trận leo thang.' },
          { title: 'Khắc phục', text: 'Chạy lại job theo hướng dẫn hoặc khôi phục từ bản sao lưu trước EOD.' },
        ], links: [{ label: 'Checklist trước EOD (tệp đính kèm)', href: '#block-b13' }],
      }),
      B('b13', 'ls9', 3, 'attachment', 'Tệp đính kèm', null, { items: ['f11'] }),
      B('b14', 'ls11', 1, 'video', 'Giới thiệu Ban QL&PT Core Banking', 'f9', { duration: 600, chapters: [{ t: 0, title: 'Chào mừng' }, { t: 300, title: 'Cơ cấu tổ chức' }], transcript: transcript(['Chào mừng bạn đến với Ban Quản lý và Phát triển Core Banking.', 'Ban gồm các nhóm: Tổng hợp & QA, Quản trị hệ thống, Phát triển nghiệp vụ.']) }),
      B('b15', 'ls12', 1, 'text', 'Quy chế làm việc', null, { markdown: '## Nguyên tắc chung\n1. Tuân thủ giờ làm việc và lịch trực vận hành.\n2. **Không** chia sẻ tài khoản, mật khẩu dưới mọi hình thức.\n3. Dữ liệu khách hàng chỉ được truy cập khi có nhiệm vụ và đúng quyền.\n\n## Kênh hỗ trợ\n- Đầu mối đào tạo: Nhóm Tổng hợp & QA\n- Sự cố hệ thống: trực ca vận hành 24/7' }),
      B('b16', 'ls13', 1, 'pdf', 'Tham số sản phẩm tiền gửi', 'f10', { pages: 8, outline: ['Tổng quan'] }),
      B('b17', 'ls14', 1, 'video', 'Vòng đời tài khoản tiền gửi', 'f12', { duration: 720, chapters: [{ t: 0, title: 'Mở tài khoản' }, { t: 360, title: 'Tất toán' }], transcript: transcript(['Vòng đời tài khoản tiền gửi gồm mở, duy trì, tái tục và tất toán.']) }),
      B('b18', 'ls15', 1, 'text', 'Quyền tối thiểu', null, { markdown: 'Mỗi tài khoản chỉ được cấp **quyền tối thiểu** cần thiết để thực hiện nhiệm vụ.' }),
    ];

    /* ---------------- Ngân hàng câu hỏi (32 câu) ---------------- */
    const Q = [];
    const addQ = (domainId, lessonId, competency, difficulty, type, text, opts, correctIdx, explanation) => {
      const n = Q.length + 1;
      const options = opts.map((t, i) => ({ id: `o${n}_${i}`, text: t }));
      Q.push({ id: `qs${n}`, code: `${domainId === 'd1' ? 'NV' : 'VH'}-${String(n).padStart(3, '0')}`, text, type, options, correct: correctIdx.map((i) => options[i].id), explanation, difficulty, domainId, lessonId, competency, status: 'active', updatedAt: D(-5 - (n % 7)) });
    };
    const K = competencies;
    // Quiz 1 — Tổng quan Core Banking
    addQ('d1', 'ls1', K[0], 'Dễ', 'single', 'Core Banking đóng vai trò gì trong kiến trúc hệ thống ngân hàng?', ['Hệ thống lõi xử lý tập trung tài khoản, giao dịch và sổ cái', 'Ứng dụng di động dành cho khách hàng', 'Hệ thống thư điện tử nội bộ', 'Phần mềm quản lý nhân sự'], [0], 'Core Banking là hệ thống lõi; các kênh như mobile banking chỉ kết nối vào Core thông qua lớp tích hợp.');
    addQ('d1', 'ls1', K[0], 'Dễ', 'single', 'Thành phần nào KHÔNG thuộc phạm vi hệ thống Core Banking?', ['Quản lý tài khoản tiền gửi', 'Sổ cái kế toán tổng hợp', 'Website tuyển dụng nhân sự', 'Xử lý khoản vay'], [2], 'Website tuyển dụng không liên quan đến xử lý nghiệp vụ lõi.');
    addQ('d1', 'ls2', K[1], 'Dễ', 'single', 'Mã CIF được dùng để làm gì?', ['Định danh duy nhất một khách hàng trên toàn hệ thống', 'Định danh một tài khoản tiền gửi', 'Mã chi nhánh mở tài khoản', 'Mã giao dịch viên'], [0], 'CIF (Customer Information File) định danh khách hàng; một khách hàng có thể có nhiều tài khoản gắn với cùng một CIF.');
    addQ('d1', 'ls2', K[1], 'Trung bình', 'multiple', 'Những thông tin nào thuộc hồ sơ khách hàng (CIF)?', ['Họ tên, ngày sinh', 'Giấy tờ định danh', 'Mật khẩu ngân hàng điện tử của khách hàng', 'Địa chỉ liên hệ'], [0, 1, 3], 'Mật khẩu của khách hàng không bao giờ được lưu trong hồ sơ CIF và không ai được phép biết.');
    addQ('d1', 'ls2', K[1], 'Trung bình', 'single', 'Một khách hàng nên có bao nhiêu mã CIF trên cùng một hệ thống Core?', ['Một', 'Mỗi tài khoản một CIF', 'Mỗi chi nhánh một CIF', 'Không giới hạn'], [0], 'Nguyên tắc định danh duy nhất: mỗi khách hàng chỉ có một CIF để tránh trùng lặp dữ liệu.');
    addQ('d1', 'ls3', K[2], 'Trung bình', 'multiple', 'Những kênh nào kết nối vào Core Banking thông qua lớp tích hợp?', ['Internet/Mobile banking', 'ATM/POS', 'Quầy giao dịch', 'Máy in văn phòng'], [0, 1, 2], 'Máy in văn phòng không phải kênh giao dịch.');
    addQ('d1', 'ls3', K[2], 'Khó', 'single', 'Khi giao dịch chuyển khoản lỗi giữa chừng, nguyên tắc xử lý đúng là gì?', ['Đảm bảo tính toàn vẹn: hoàn tất tất cả hoặc hoàn trả toàn bộ', 'Ghi Nợ trước, xử lý phần còn lại vào hôm sau', 'Bỏ qua lỗi nếu số tiền nhỏ', 'Xóa log để tránh sai lệch'], [0], 'Giao dịch phải mang tính nguyên tử (atomic) để không phát sinh chênh lệch số dư.');
    addQ('d1', 'ls3', K[2], 'Trung bình', 'single', 'Bút toán kép (double-entry) nghĩa là gì?', ['Mỗi giao dịch ghi Nợ và ghi Có với tổng giá trị bằng nhau', 'Ghi mỗi giao dịch hai lần cho chắc chắn', 'Hai người cùng nhập một giao dịch', 'Ghi sổ vào hai ngày khác nhau'], [0], 'Nguyên tắc kế toán cơ bản giúp sổ cái luôn cân.');
    addQ('d1', 'ls1', K[0], 'Trung bình', 'multiple', 'Môi trường nào được dùng để kiểm thử trước khi đưa thay đổi lên Production?', ['DEV', 'SIT/UAT', 'Production', 'Pre-production/Staging'], [0, 1, 3], 'Không kiểm thử trực tiếp trên Production.');
    addQ('d1', 'ls1', K[5], 'Trung bình', 'single', 'Dữ liệu khách hàng trên môi trường kiểm thử cần được xử lý thế nào?', ['Che giấu hoặc giả lập (masking)', 'Sao chép nguyên vẹn từ Production', 'Gửi cho đối tác để kiểm thử', 'Không cần xử lý'], [0], 'Dùng dữ liệu thật trên môi trường kiểm thử là vi phạm an toàn thông tin.');
    addQ('d1', 'ls1', K[0], 'Khó', 'single', 'Ngày làm việc (business date) của Core khác ngày hệ thống ở điểm nào?', ['Chỉ chuyển sang ngày mới sau khi chạy xong cuối ngày (EOD)', 'Luôn trùng ngày hệ thống', 'Chỉ thay đổi vào cuối tháng', 'Do từng giao dịch viên tự chọn'], [0], 'Business date được điều khiển bởi quy trình EOD.');
    addQ('d1', 'ls3', K[2], 'Khó', 'multiple', 'Thao tác nào cần cơ chế 4 mắt (maker–checker)?', ['Sửa thông tin quan trọng trong CIF', 'Duyệt giao dịch vượt hạn mức', 'Xem báo cáo số dư của chính mình', 'Thay đổi tham số sản phẩm'], [0, 1, 3], 'Xem báo cáo là thao tác chỉ đọc, không cần phê duyệt.');
    // Quiz 2 — Quản lý thay đổi
    addQ('d3', 'ls5', K[3], 'Dễ', 'single', 'Mục tiêu chính của quy trình quản lý thay đổi là gì?', ['Giảm rủi ro gián đoạn khi thay đổi hệ thống', 'Tăng số lượng thay đổi mỗi tuần', 'Rút ngắn thời gian họp', 'Giảm số người tham gia'], [0], 'Quản lý thay đổi kiểm soát rủi ro, không nhằm tăng số lượng thay đổi.');
    addQ('d3', 'ls5', K[3], 'Trung bình', 'multiple', 'Một yêu cầu thay đổi (RFC) tối thiểu cần có những nội dung nào?', ['Mô tả và lý do thay đổi', 'Đánh giá tác động, rủi ro', 'Kế hoạch rollback', 'Thông tin người thân của người yêu cầu'], [0, 1, 2], 'RFC tập trung vào nội dung kỹ thuật và rủi ro.');
    addQ('d3', 'ls6', K[3], 'Dễ', 'single', 'CAB là gì?', ['Hội đồng xem xét và phê duyệt thay đổi', 'Công cụ sao lưu dữ liệu', 'Một phân hệ của Core', 'Biểu mẫu báo cáo sự cố'], [0], 'CAB — Change Advisory Board.');
    addQ('d3', 'ls5', K[3], 'Khó', 'single', 'Thay đổi khẩn cấp (emergency change) cần được xử lý thế nào?', ['Phê duyệt rút gọn bởi người có thẩm quyền và bổ sung hồ sơ sau', 'Bỏ qua phê duyệt', 'Chờ phiên họp CAB tháng sau', 'Chỉ cần báo miệng cho đồng nghiệp'], [0], 'Khẩn cấp không có nghĩa là bỏ qua kiểm soát.');
    addQ('d3', 'ls6', K[3], 'Trung bình', 'single', 'Thứ tự đúng trong vòng đời một thay đổi là?', ['Đăng ký → Đánh giá → Phê duyệt → Triển khai → Rà soát', 'Triển khai → Đăng ký → Phê duyệt', 'Phê duyệt → Đăng ký → Triển khai', 'Đánh giá → Triển khai → Đăng ký'], [0], 'Rà soát sau triển khai (PIR) là bước cuối.');
    addQ('d3', 'ls5', K[3], 'Dễ', 'single', 'Kế hoạch rollback được dùng khi nào?', ['Khi triển khai thất bại hoặc phát sinh lỗi nghiêm trọng', 'Sau mỗi lần họp CAB', 'Khi muốn thêm tính năng', 'Khi hết giờ làm việc'], [0], '');
    addQ('d3', 'ls6', K[3], 'Trung bình', 'single', 'Khung giờ triển khai thay đổi lên Production thường được chọn thế nào?', ['Ngoài giờ cao điểm giao dịch, đã thông báo trước', 'Giữa giờ cao điểm để kiểm tra tải', 'Bất kỳ lúc nào', 'Trong lúc đang chạy EOD'], [0], 'Giảm tác động tới khách hàng và nghiệp vụ.');
    addQ('d3', 'ls6', K[3], 'Trung bình', 'single', 'Bước rà soát sau triển khai (PIR) nhằm mục đích gì?', ['Rà soát kết quả và ghi nhận bài học', 'Xóa toàn bộ log triển khai', 'Tính thưởng cho người triển khai', 'Mở lại yêu cầu thay đổi'], [0], '');
    addQ('d3', 'ls6', K[5], 'Khó', 'multiple', 'Nguyên tắc phân quyền nào cần áp dụng khi triển khai thay đổi?', ['Tách biệt người phát triển và người triển khai lên Production', 'Ghi log đầy đủ thao tác', 'Dùng chung tài khoản quản trị cho cả nhóm', 'Cấp quyền tối thiểu cần thiết'], [0, 1, 3], 'Tài khoản dùng chung làm mất khả năng truy vết.');
    addQ('d3', 'ls5', K[5], 'Dễ', 'single', 'Mật khẩu tài khoản kỹ thuật nên được lưu ở đâu?', ['Kho quản lý bí mật (vault) có phân quyền', 'File Excel dùng chung', 'Trong mã nguồn', 'Giấy ghi chú dán màn hình'], [0], '');
    // Quiz 3 — Vận hành EOD
    addQ('d3', 'ls8', K[4], 'Dễ', 'single', 'EOD (End of Day) là gì?', ['Chuỗi batch cuối ngày: tính lãi, phí, khóa sổ, chuyển ngày làm việc', 'Báo cáo doanh thu cuối ngày', 'Giờ kết thúc ca làm việc', 'Quy trình nghỉ phép'], [0], '');
    addQ('d3', 'ls8', K[4], 'Trung bình', 'multiple', 'Trước khi chạy EOD cần kiểm tra những gì?', ['Tất cả giao dịch viên đã đóng ca', 'Không còn giao dịch treo', 'Đã sao lưu dữ liệu trước EOD', 'Tắt hệ thống giám sát'], [0, 1, 2], 'Không bao giờ tắt giám sát trong EOD.');
    addQ('d3', 'ls9', K[4], 'Khó', 'single', 'Khi một job EOD bị lỗi, bước đầu tiên nên làm là gì?', ['Xác định job lỗi, đọc log và thông báo theo quy trình sự cố', 'Chạy lại toàn bộ EOD ngay', 'Bỏ qua job lỗi', 'Khởi động lại máy chủ'], [0], '');
    addQ('d3', 'ls8', K[4], 'Trung bình', 'single', 'Tính lãi dự thu (accrual) thường diễn ra ở đâu?', ['Trong batch cuối ngày', 'Khi khách hàng yêu cầu', 'Cuối năm tài chính', 'Khi mở tài khoản'], [0], '');
    addQ('d3', 'ls9', K[4], 'Trung bình', 'single', 'Báo cáo đối chiếu sau EOD dùng để làm gì?', ['Đảm bảo số liệu sổ cái khớp với phân hệ chi tiết', 'Tính lương nhân viên', 'Gửi khách hàng', 'Thay thế sao lưu'], [0], '');
    addQ('d3', 'ls8', K[4], 'Trung bình', 'multiple', 'Trong EOD cần theo dõi những chỉ số nào?', ['Thời gian chạy từng job', 'Tài nguyên CPU/IO', 'Lượt tương tác mạng xã hội', 'Trạng thái hàng đợi'], [0, 1, 3], '');
    addQ('d3', 'ls9', K[4], 'Dễ', 'single', 'Vì sao phải sao lưu trước EOD?', ['Để có điểm khôi phục nếu EOD lỗi', 'Để giảm dung lượng ổ đĩa', 'Để tăng tốc EOD', 'Không cần thiết'], [0], '');
    addQ('d3', 'ls9', K[0], 'Khó', 'single', 'RTO là gì?', ['Thời gian tối đa chấp nhận được để khôi phục dịch vụ', 'Lượng dữ liệu tối đa có thể mất', 'Tên một phân hệ Core', 'Tần suất sao lưu'], [0], 'RPO mới là lượng dữ liệu tối đa có thể mất.');
    addQ('d3', 'ls9', K[4], 'Khó', 'single', 'EOD chạy quá khung giờ, ảnh hưởng mở cửa ngày mới. Ưu tiên xử lý?', ['Báo cáo theo quy trình leo thang và phối hợp xử lý', 'Chờ EOD tự xong', 'Dừng EOD giữa chừng không báo ai', 'Mở cửa giao dịch bỏ qua EOD'], [0], '');
    addQ('d3', 'ls8', K[0], 'Trung bình', 'single', 'Trung tâm dự phòng (DR site) nhằm mục đích gì?', ['Duy trì hoạt động khi site chính gặp sự cố', 'Lưu trữ tài liệu đào tạo', 'Chạy thử nghiệm tính năng mới', 'Giảm chi phí điện'], [0], '');
    const questions = Q;
    const pool = (from, to) => questions.slice(from, to).map((q) => q.id);

    /* ---------------- Bài kiểm tra ---------------- */
    const quizzes = [
      { id: 'q1', title: 'Kiểm tra cuối khóa: Tổng quan Core Banking', courseId: 'c1', minutes: 15, questionCount: 10, passPct: 70, maxAttempts: 3, retakeWaitHours: 0, shuffleQuestions: true, shuffleOptions: true, source: 'random', questionIds: pool(0, 12), randomRules: [], openAt: D(-30), closeAt: D(30), reviewPolicy: 'after_submit', status: 'published' },
      { id: 'q2', title: 'Kiểm tra: Quản lý thay đổi', courseId: 'c2', minutes: 12, questionCount: 8, passPct: 80, maxAttempts: 2, retakeWaitHours: 24, shuffleQuestions: true, shuffleOptions: false, source: 'random', questionIds: pool(12, 22), randomRules: [], openAt: D(-20), closeAt: D(25), reviewPolicy: 'after_pass', status: 'published' },
      { id: 'q3', title: 'Kiểm tra: Vận hành EOD', courseId: 'c3', minutes: 10, questionCount: 8, passPct: 70, maxAttempts: 3, retakeWaitHours: 0, shuffleQuestions: true, shuffleOptions: true, source: 'manual', questionIds: pool(22, 32), randomRules: [], openAt: D(-3), closeAt: D(40), reviewPolicy: 'after_close', status: 'published' },
    ];

    /* ---------------- Giao học ---------------- */
    const A = (id, courseId, targetType, targetId, start, due) => ({ id, courseId, targetType, targetId, startAt: D(start), dueAt: D(due, 17), createdBy: 'a1', remind: true });
    const assignments = [
      A('as1', 'c4', 'unit', 'u1', -20, -2),
      A('as2', 'c1', 'unit', 'u1', -15, 12),
      A('as3', 'c2', 'unit', 'u1', -10, 18),
      A('as4', 'c3', 'group', 'g2', -3, 25),
      A('as5', 'c1', 'unit', 'u2', -12, 5),
      A('as6', 'c4', 'unit', 'u2', -5, 20),
    ];
    const enrollments = [{ userId: 'l1', courseId: 'c5', at: D(-4) }]; // tự đăng ký khóa tự chọn

    /* ---------------- Tiến độ & lần thi ---------------- */
    const progress = [];
    const P = (userId, lessonId, status, pct, opts = {}) => progress.push({
      userId, lessonId, status, pct, lastPage: opts.page || 0, videoPos: opts.pos || 0, watchedPct: opts.watched ?? (status === 'completed' ? 100 : pct),
      startedAt: status === 'not_started' ? null : D(opts.start ?? -10), lastAccessAt: status === 'not_started' ? null : D(opts.last ?? -1, 20), completedAt: status === 'completed' ? D(opts.done ?? -5) : null,
    });
    const done = (u, ids, d = -5) => ids.forEach((id) => P(u, id, 'completed', 100, { done: d, last: d }));
    // l1 — Ngọc Anh: đang học, chưa đạt Q1 sau 2 lần (còn 1 lượt), C4 hoàn thành
    done('l1', ['ls11', 'ls12'], -12);
    done('l1', ['ls1', 'ls2'], -4);
    P('l1', 'ls3', 'in_progress', 40, { last: -1 });
    P('l1', 'ls5', 'in_progress', 46, { pos: 384, watched: 46, last: 0 });
    P('l1', 'ls13', 'in_progress', 10, { page: 1, last: -3 });
    // l2 — Minh Khoa: hoàn thành, đạt
    done('l2', ['ls1', 'ls2', 'ls3', 'ls4', 'ls11', 'ls12'], -8);
    done('l2', ['ls5', 'ls6', 'ls7'], -2);
    // l3 — Thu Hà: chưa bắt đầu (và quá hạn C4)
    // l4 — Quang Dũng: chưa đạt sau 3 lần, quá hạn C4
    done('l4', ['ls1', 'ls2', 'ls3'], -9);
    P('l4', 'ls11', 'in_progress', 50, { pos: 300, watched: 50, last: -9 });
    // l5 — Phương Thảo (đơn vị 2): đang học
    done('l5', ['ls1'], -6);
    P('l5', 'ls2', 'in_progress', 58, { page: 7, last: -2 });
    // l6 — Anh Khôi (đơn vị 2): đạt sau nhiều lần
    done('l6', ['ls1', 'ls2', 'ls3', 'ls4'], -3);
    // l7 — Mai Chi: hoàn thành C1 điểm tuyệt đối, chưa đạt Q2
    done('l7', ['ls1', 'ls2', 'ls3', 'ls4', 'ls11', 'ls12'], -15);
    done('l7', ['ls5', 'ls6'], -2);

    const attempts = [];
    const pickAnswers = (quiz, qids, correctN) => {
      const ans = {}; const byC = {}; let c = 0;
      qids.forEach((qid, i) => {
        const q = questions.find((x) => x.id === qid);
        const ok = i < correctN;
        ans[qid] = ok ? q.correct.slice() : [q.options.find((o) => !q.correct.includes(o.id)).id];
        byC[q.competency] = byC[q.competency] || { c: 0, t: 0 }; byC[q.competency].t++; if (ok) { byC[q.competency].c++; c++; }
      });
      return { ans, byC, c };
    };
    const AT = (id, quizId, userId, days, correctN) => {
      const quiz = quizzes.find((q) => q.id === quizId);
      const qids = quiz.questionIds.slice(0, quiz.questionCount);
      const { ans, byC, c } = pickAnswers(quiz, qids, correctN);
      const score = Math.round((c / qids.length) * 100);
      attempts.push({ id, quizId, userId, startedAt: D(days, 14), submittedAt: D(days, 14, quiz.minutes - 3), deadlineAt: D(days, 14, quiz.minutes), questionIds: qids, answers: ans, score, passed: score >= quiz.passPct, correctCount: c, byCompetency: byC, autoSubmitted: false });
    };
    AT('at1', 'q1', 'l1', -3, 5); AT('at2', 'q1', 'l1', -1, 6);
    AT('at3', 'q1', 'l2', -8, 9); AT('at4', 'q2', 'l2', -2, 7);
    AT('at5', 'q1', 'l4', -9, 4); AT('at6', 'q1', 'l4', -8, 5); AT('at7', 'q1', 'l4', -7, 6);
    AT('at8', 'q1', 'l6', -5, 5); AT('at9', 'q1', 'l6', -3, 8);
    AT('at10', 'q1', 'l7', -15, 10); AT('at11', 'q2', 'l7', -1, 5);
    attempts.find((a) => a.id === 'at7').autoSubmitted = true;

    /* ---------------- Tương tác ---------------- */
    const feedback = [
      { id: 'fb1', kind: 'question', userId: 'l1', lessonId: 'ls2', text: 'Trường hợp khách hàng đổi CCCD thì CIF có phải tạo mới không ạ?', stars: null, anchor: 'Trang 5', status: 'answered', reply: { userId: 'i1', text: 'Không tạo CIF mới. Cập nhật giấy tờ định danh trên CIF hiện có và qua bước kiểm soát (checker).', at: D(-2) }, createdAt: D(-3) },
      { id: 'fb2', kind: 'question', userId: 'l5', lessonId: 'ls2', text: 'Có tài liệu mô tả chi tiết các trường bắt buộc của CIF không?', stars: null, anchor: 'Trang 7', status: 'new', reply: null, createdAt: D(-1, 10) },
      { id: 'fb3', kind: 'comment', userId: 'l2', lessonId: 'ls1', text: 'Phần sơ đồ 3 lớp rất dễ hiểu, cảm ơn anh/chị.', stars: null, anchor: '04:10', status: 'resolved', reply: null, createdAt: D(-7) },
      { id: 'fb4', kind: 'report', userId: 'l4', lessonId: 'ls13', text: 'Tài liệu PDF không mở được.', stars: null, anchor: null, status: 'new', reply: null, createdAt: D(-2, 15) },
      { id: 'fb5', kind: 'rating', userId: 'l2', lessonId: 'ls1', text: '', stars: 5, anchor: null, status: 'resolved', reply: null, createdAt: D(-7) },
      { id: 'fb6', kind: 'rating', userId: 'l7', lessonId: 'ls1', text: '', stars: 4, anchor: null, status: 'resolved', reply: null, createdAt: D(-14) },
      { id: 'fb7', kind: 'rating', userId: 'l1', lessonId: 'ls2', text: '', stars: 4, anchor: null, status: 'resolved', reply: null, createdAt: D(-4) },
      { id: 'fb8', kind: 'question', userId: 'l7', lessonId: 'ls6', text: 'Thay đổi chuẩn (standard change) có cần qua CAB mỗi lần không?', stars: null, anchor: 'Bước 3', status: 'new', reply: null, createdAt: D(0, 8) },
      { id: 'fb9', kind: 'comment', userId: 'l1', lessonId: 'ls1', text: 'Mong có thêm ví dụ về lớp tích hợp ESB.', stars: null, anchor: '10:20', status: 'new', reply: null, createdAt: D(-1, 16) },
    ];

    const notes = [
      { id: 'n1', userId: 'l1', lessonId: 'ls1', anchor: { type: 'video', value: 250 }, text: 'Lớp tích hợp = chuẩn hóa thông điệp + định tuyến', at: D(-4) },
      { id: 'n2', userId: 'l1', lessonId: 'ls2', anchor: { type: 'pdf', value: 5 }, text: 'Đổi CCCD → cập nhật CIF, không tạo mới', at: D(-3) },
    ];
    const bookmarks = [{ id: 'bm1', userId: 'l1', lessonId: 'ls2', anchor: { type: 'pdf', value: 7 }, label: 'Kiểm soát maker–checker', at: D(-3) }];
    const flashState = {};

    const notifications = [
      { id: 'nt1', userId: 'l1', kind: 'due', text: 'Khóa "Tổng quan hệ thống Core Banking" còn 12 ngày đến hạn.', link: '#/course/c1', at: D(0, 7), read: false },
      { id: 'nt2', userId: 'l1', kind: 'reply', text: 'Giảng viên Lê Hoàng Nam đã trả lời câu hỏi của bạn ở bài "Mô hình dữ liệu khách hàng".', link: '#/lesson/c1/ls2?tab=qa', at: D(-2), read: false },
      { id: 'nt3', userId: 'l1', kind: 'assigned', text: 'Bạn được giao khóa "Vận hành cuối ngày (EOD/COB)".', link: '#/course/c3', at: D(-3), read: true },
      { id: 'nt4', userId: 'l1', kind: 'result', text: 'Kết quả lần thi 2: 60% — chưa đạt. Bạn còn 1 lượt thi.', link: '#/quiz/q1/attempts', at: D(-1, 15), read: true },
      { id: 'nt5', userId: 'i1', kind: 'question', text: 'Có 2 câu hỏi mới từ học viên đang chờ trả lời.', link: '#/instructor/inbox', at: D(0, 8), read: false },
      { id: 'nt6', userId: 'a1', kind: 'report', text: 'Học viên báo tệp "tham-so-tien-gui.pdf" không mở được.', link: '#/admin/system?tab=files', at: D(-2, 15), read: false },
    ];

    const audit = [
      ['a1', 'publish', 'Khóa học NV-101', 'Xuất bản khóa học', -15], ['a1', 'assign', 'Khóa học NV-101', 'Giao cho đơn vị Ban QL&PT Core Banking, hạn ' + new Date(D(12)).toLocaleDateString('vi-VN'), -15],
      ['i1', 'update', 'Câu hỏi NV-007', 'Sửa giải thích đáp án', -6], ['a2', 'assign', 'Khóa học NV-101', 'Giao cho đơn vị Trung tâm Vận hành CNTT', -12],
      ['a1', 'lock', 'Tài khoản long.pd@demo.cb', 'Khóa tài khoản (nghỉ việc)', -20], ['i1', 'upload', 'Tệp so-tay-su-co-eod.pdf', 'Tải lên 3.8 MB', -14],
      ['a1', 'backup', 'Cơ sở dữ liệu', 'Sao lưu định kỳ thành công', -1], ['l1', 'login', 'Phiên đăng nhập', 'Đăng nhập thành công', 0],
    ].map(([userId, action, target, detail, d], i) => ({ id: 'au' + i, at: D(d, 9 + i), userId, action, target, detail }));

    const activity = { l1: [0, -1, -2, -3, -4, -5, -6, -8, -9].map((d) => D(d).slice(0, 10)), l2: [-1, -2, -3, -8].map((d) => D(d).slice(0, 10)), l7: [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11].map((d) => D(d).slice(0, 10)) };

    const settings = {
      upload: { maxPdfMB: 20, maxVideoMB: 500, maxImageMB: 5, maxAttachMB: 10, allowed: ['pdf', 'mp4', 'webm', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx', 'pptx'] },
      remindDaysBefore: 3, sessionMinutes: 30, points: { lesson: 5, quizPass: 30, streakDay: 10 },
      lastBackupAt: D(-1, 2), backupRetentionDays: 30,
    };

    return { version: 2, units, groups, users, competencies, modules, domains, programs, courses, chapters, lessons, blocks, files, questions, quizzes, assignments, enrollments, progress, attempts, feedback, notes, bookmarks, flashState, notifications, audit, activity, settings };
  }

  LMS.seed = build;
})(window.LMS);
