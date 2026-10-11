# Core Banking Academy — Mockup v2

Mockup liền mạch (HTML/CSS/JS thuần, không cần build) cho cuộc thi **Thiết kế ứng dụng Đào tạo nội bộ Ban QL&PT Core Banking**.
Toàn bộ dữ liệu là **giả lập**. "Backend" được mô phỏng trong trình duyệt (localStorage) nhưng **kiểm tra quyền, chấm điểm, tính tiến độ ở lớp API** — đúng kiến trúc sẽ dùng khi có backend thật.

## Chạy thử

- Mở trực tiếp `index.html` (chạy được với `file://`), hoặc
- `python3 -m http.server 8080` trong thư mục này rồi mở `http://localhost:8080`.

**Tài khoản demo** (mỗi vai trò một tài khoản, bấm chọn ở màn đăng nhập; mật khẩu bất kỳ ≥ 6 ký tự):

| Vai trò | Email | Ghi chú |
|---|---|---|
| Quản trị viên (toàn hệ thống) | admin@demo.cb | |
| Quản trị viên đơn vị | qtdonvi@demo.cb | Chỉ thấy dữ liệu "Trung tâm Vận hành CNTT" |
| Giảng viên | giangvien@demo.cb | |
| Lãnh đạo (xem báo cáo) | lanhdao@demo.cb | Chỉ đọc |
| Học viên | hocvien@demo.cb | Đang học, chưa đạt 2 lần, còn 1 lượt thi |
| Học viên (chưa đạt, quá hạn) | dung.bq@demo.cb | |
| Tài khoản bị khóa | long.pd@demo.cb | Để thử đăng nhập bị từ chối |

**Menu "Demo"** trên header: đổi vai trò nhanh · mô phỏng mất mạng · mô phỏng hết phiên · thử URL vượt quyền · đặt lại dữ liệu mẫu.
Video có tốc độ **20× (demo)** để Ban giám khảo xem đủ 80% nhanh.

## Đối chiếu checklist → màn hình

| Checklist | Route | Tiêu chí |
|---|---|---|
| A.1 Đăng nhập | `#/login` | A1, D1 |
| A.2 Hồ sơ | `#/profile` | A1 |
| A.3 403 / 404 / hết phiên / mất mạng / tệp lỗi | `#/403`, URL sai, menu Demo, bài "Tham số sản phẩm tiền gửi" | E5, D2 |
| B.1 Lĩnh vực → Chương trình → Khóa học | `#/admin/catalog` | A3, B2 |
| B.2 Danh sách khóa học | `#/admin/courses` | A3 |
| B.3 Wizard 4 bước (khối nội dung, upload kiểm tra tệp, kéo thả) | `#/admin/courses/new` | A3, A4, B2 |
| B.4–B.5 Ngân hàng câu hỏi + form | `#/admin/questions` | A6, B1 |
| B.6 Cấu hình bài kiểm tra | `#/admin/quizzes/:id` | A6, G.7 |
| B.7 Nhập dữ liệu hàng loạt (câu hỏi, người dùng, đơn vị) | `#/admin/import` | G.2 |
| B.8–B.9 Người dùng & phân quyền | `#/admin/users`, `#/admin/users/:id` | A1, A7, D2 |
| B.10 Đơn vị, phòng, nhóm | `#/admin/org` | B4 |
| B.11 Giao học & hạn | `#/admin/assignments` | A3, G.6 |
| B.12 Hệ thống, nhật ký, sao lưu, xuất dữ liệu | `#/admin/system` | C4, D5 |
| C.1–C.2 Giảng viên | `#/instructor`, `#/instructor/inbox` | A4 |
| D.1–D.2 Báo cáo (8 chiều, xuất CSV/in PDF) | `#/reports`, `#/reports/:dim` | A8, B5 |
| E.1 Lịch sử thi | `#/quiz/:id/attempts` | A6 |
| E.3 Thông báo | `#/notifications` | F3 |
| E.4 Chứng nhận | `#/certificates` | F3 |
| F.1 Dashboard (radar năng lực, tiếp tục học) | `#/learn` | A2 |
| F.2 Danh mục + bộ lọc | `#/catalog` | A2 |
| F.3–F.6 Trình học bài (PDF, video, quy trình, tương tác) | `#/lesson/:course/:lesson` | A4, A5 |
| F.7 Thi (đếm giờ, nhiều đáp án, tự nộp) | `#/quiz/:id`, `/take`, `/result/:id` | A6 |
| F.8 Tiến độ của tôi | `#/progress` | A5 |
| F.9 Bảng xếp hạng | `#/leaderboard` | F3 |
| G.1 Trợ lý AI có trích nguồn | `#/assistant` + tab trong bài học | F1 |
| G.2 Ghi chú, bookmark, transcript, flashcard | `#/saved`, `#/flashcards` | F2 |
| H. Design System v2 | `#/design-system` | E1–E3 |

Dữ liệu mẫu đủ Phần E: 1 QTV + 1 QTV đơn vị, 1 giảng viên, 1 lãnh đạo, 8 học viên, 2 đơn vị, 4 phòng/nhóm, 6 khóa, 15 bài, 4 PDF, 5 video, 3 quy trình, 3 bài kiểm tra, 32 câu hỏi; học viên ở đủ 7 trạng thái (chưa bắt đầu, đang học, hoàn thành, chưa đạt, đã đạt, quá hạn, thi nhiều lần).

## Cấu trúc mã

```
index.html                 Shell + thứ tự nạp script
assets/css/
  tokens.css               Design tokens (màu, chữ, spacing, motion) + dark mode
  base.css                 Reset, typography, focus, utility
  layout.css               AppShell: sidebar, header, responsive drawer
  components.css           Mỗi block BEM = 1 component
  pages.css                Bố cục riêng từng màn
src/
  core/html.js             Template tự escape (chống XSS), định dạng số/ngày
  core/icons.js            Bộ icon nét phong cách Lucide (một số tên cần map — xem docs/angular-migration/mapping.md)
  core/types.js            Mô hình dữ liệu (JSDoc) = bảng DB = interface TS
  core/store.js            "DB" mô phỏng + phiên + mô phỏng mạng
  core/ui.js               toast, modal/confirm, drawer, menu, lỗi form
  core/router.js           Bảng route + guard vai trò + vòng đời page
  core/shell.js            Sidebar theo vai trò, header, menu Demo
  data/seed.js             Dữ liệu mẫu giả lập (= script seed DB)
  api/core.js              call(): độ trễ, lỗi, quyền, phạm vi đơn vị; hàm tính tiến độ/năng lực/điểm
  api/auth.js              AuthService
  api/learner.js           LearnerService (học, tiến độ, thi — chấm điểm phía server)
  api/admin.js             Content/Admin/InstructorService
  api/reports.js           ReportService
  components/*.js          Component thuần (props) => HTML
  pages/*.js               Page: load → view → actions
```

**Hợp đồng của page:** `LMS.page(key, { title, layout, initState, load(ctx), view(data, ctx), mount(ctx), actions })`.
Sự kiện dùng `data-action="tên"` (click), `data-input` (gõ, có debounce), `data-change`, `form[data-submit]`, router tự gọi `actions[tên](el, ctx)`.

## Chuyển sang React hoặc Angular

Giữ nguyên **toàn bộ CSS** (`assets/css`) và **tên class**. Mỗi thành phần có chỗ tương ứng:

| Mockup | React | Angular |
|---|---|---|
| `tokens.css` … `pages.css` | import global | `styles` trong `angular.json` |
| `core/types.js` | `models.ts` (interface) | `models.ts` (interface) |
| `api/*.js` (chữ ký hàm giữ nguyên) | `services/*.ts` + TanStack Query hooks | `@Injectable()` service + `HttpClient` |
| `core/store.js` (session, prefs) | Context hoặc Zustand | service + `signal()` |
| `core/router.js` `routes[]` | React Router + `<RequireRole roles>` + loader | `Routes` + `canActivate: [roleGuard]` + `resolve` |
| `UI.X({...props})` | `<X {...props}/>` | `<app-x [prop]="...">` |
| `html\`...${v}\`` | JSX `{v}` | `{{ v }}` |
| `data-action="enroll"` + `actions.enroll` | `onClick={enroll}` | `(click)="enroll()"` |
| `ctx.state` + `ctx.rerender()` | `useState` | `signal()` |
| `ui.modal/confirm/drawer/toast` | Radix/shadcn Dialog, Sheet, Toast | CDK Dialog/Overlay, MatSnackBar |
| `PdfViewer` / `VideoPlayer` | thay stage bằng pdf.js / `<video>` | như React |
| `icon('book')` | `<BookOpen/>` (lucide-react) | `<lucide-icon name="book-open">` — bảng map tên trong `docs/angular-migration/mapping.md` |

Ví dụ (KPI):

```js
// Mockup
UI.Kpi({ icon: 'book', value: 6, label: 'Khóa được giao' })
// React
<Kpi icon="book" value={6} label="Khóa được giao" />
// Angular
<app-kpi icon="book" [value]="6" label="Khóa được giao"></app-kpi>
```

Thứ tự gợi ý: (1) copy `assets/css` + `types.js` thành `models.ts`; (2) viết lại `api/*` gọi backend thật, giữ chữ ký hàm; (3) chuyển `components/*` (thuần, không state) → (4) chuyển `pages/*` theo bảng route.

## Ghi chú về backend thật (bước tiếp theo)

Đặc tả đầy đủ để giao cho người/agent khác: `../docs/angular-migration/README.md` (tech stack, thứ tự làm, tiêu chí xong), `mapping.md` (frontend), `backend.md` (Supabase).


- `core/types.js` liệt kê đủ nhóm dữ liệu mục XVI: users, roles, units, groups, domains, programs, courses, chapters, lessons, content_blocks, files, questions, question_options, quizzes, attempts, attempt_answers, assignments, progress, feedback, audit_logs.
- Các quy tắc trong `api/core.js` (`require`, `unitScope`, `inScope`) chính là chính sách cần chuyển thành **RLS/policy ở CSDL** hoặc middleware API.
- `submitAttempt` và `saveProgress` minh họa nguyên tắc "không tin dữ liệu từ trình duyệt": client chỉ gửi đáp án/vị trí, server tự chấm và tính %.
- Mockup **không phải** sản phẩm dự thi cuối cùng: dữ liệu nằm trong trình duyệt; PDF/video/AI được mô phỏng.
