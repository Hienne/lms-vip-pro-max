# Rà soát UI/UX Core Banking Academy — 14/11/2026

## Phạm vi và cách đọc

Đã mở giao diện đang chạy trên `http://localhost:4200`, dùng tài khoản demo quản trị và học viên, đối chiếu source Angular. Kiểm tra desktop khoảng 1280 × 720; kiểm tra thêm màn học và danh mục ở 375 × 812; xem danh mục trên giao diện tối. Đã khôi phục kích thước, lựa chọn giao diện Hệ thống và phiên quản trị sau kiểm tra.

Các route đã xem: `/login`, `/admin/courses`, `/admin/courses/new`, `/admin/questions` và drawer thêm câu hỏi, `/admin/quizzes`, `/admin/lessons`, `/admin/assignments`, `/admin/gamification`, `/reports`, `/reports/results` và bộ lọc, `/learn`, `/catalog`, `/progress` (tiến độ và năng lực), `/saved`, `/certificates`, `/quiz`, `/notifications`, `/community/questions`, `/course/25`, `/lesson/25/70`, `/lesson/25/71`. Form phân hệ trong `/admin/catalog` được đối chiếu source, không thử lưu thêm dữ liệu trong đợt này.

Đây là rà soát các luồng chính và đối chiếu code, không phải xác nhận mọi màn, mọi vai trò, mọi kích thước hoặc toàn bộ WCAG đều đã được kiểm thử. Không tạo lượt thi, xuất bản, cấp quyền hay xóa nội dung. Mở bài học có thể cập nhật vị trí học tiếp bình thường của tài khoản demo.

- **P1:** nên xử lý trước vì ảnh hưởng tìm đúng nội dung hoặc hiểu đúng dữ liệu.
- **P2:** cải thiện rõ khả năng sử dụng, điều hướng và tính nhất quán.
- **P3:** hoàn thiện cách trình bày.
- **Đã thấy:** quan sát trực tiếp trên giao diện, có đối chiếu code khi cần.
- **Source:** nhận định từ implementation, chưa tái hiện trên dữ liệu lớn trong trình duyệt.
- **Cần tái hiện:** dấu hiệu cần kiểm chứng thêm, chưa kết luận là lỗi.

## Đã sửa trong đợt này

Các nút chuyển bước, bài học, câu hỏi và khóa học thống nhất **Quay lại / Tiếp theo**:

| Route / luồng                                                   | Nhãn cũ                       | Nhãn hiện tại            |
| --------------------------------------------------------------- | ----------------------------- | ------------------------ |
| `/lesson/:courseId/:lessonId`: bài trống và bài dạng quiz/SCORM | Bài trước / Bài tiếp theo     | Quay lại / Tiếp theo     |
| `/lesson/:courseId/:lessonId`: chuyển khối nội dung             | Quay lại / Tiếp theo          | Giữ thống nhất cùng nhãn |
| `/quiz/:id/take`: chuyển câu hỏi                                | Câu trước / Câu tiếp          | Quay lại / Tiếp theo     |
| `/admin/quizzes`: chọn khóa học liền kề                         | Khóa học trước / Khóa học sau | Quay lại / Tiếp theo     |
| `/admin/courses/new`, `/admin/courses/:id/edit`: chuyển bước    | Quay lại / Tiếp tục           | Quay lại / Tiếp theo     |

Lời hướng dẫn trong phần cấu hình bài thi được đổi theo tên nút. Hành vi điều hướng, điều kiện hoàn thành, validation và API giữ nguyên. Những hành động có mục đích riêng như Tiếp tục học, tiếp tục tải tệp, Về khóa học, Xuất bản, Nộp bài vẫn mô tả đúng hành động. Các nút icon phân trang giữ tên truy cập mô tả trang trước/sau.

Kiểm chứng: 282 test liên quan và design guard đã pass; kiểm tra trực tiếp hai nút trong màn học và quản lý bài thi. Lint, typecheck, build và bundle guard đều pass; lint còn cảnh báo hiện có, không có lỗi.

![Hai nút trong màn học](E:/final-mockup/tmp/qa-uiux-20261114/navigation-unified.png)

## Danh sách đề xuất

Các mục dưới đây ghi lại hiện trạng lúc rà soát. **UX-01–04 đã được xử lý ở đợt tiếp theo**:

- UX-01: Xem tất cả giữ tab/trạng thái/phạm vi; thêm Đã tham gia để giữ khóa tự đăng ký.
- UX-02: BE cấp tên khóa, ID khóa/lần học và khả dụng theo recipient; FE mở đúng khóa, giữ tên lịch sử
  và bỏ liên kết khi lượt giao/khóa không còn hoạt động. BE cũ chưa cấp dữ liệu thì dùng liên kết danh sách.
- UX-03: SQL đặt lastAccessAt NULLS LAST cho cả hai chiều trước phân trang; giữ thứ tự phụ ổn định.
- UX-04: ghi rõ phạm vi chung cạnh KPI/biểu đồ và phạm vi riêng cạnh bộ lọc, bảng cùng CSV; không giả lập
  thống kê toàn bộ bằng dữ liệu một trang.

Đã bổ sung dropdown SCORM tìm kiếm bên trong, tự tải toàn bộ trang API, bỏ phân trang và nút tải lại
thường trực. Hướng dẫn lần đầu chia học viên/giảng viên, chỉ hiện các vùng có quyền và cho phép xem lại
từ menu tài khoản. Xem [hướng dẫn sử dụng](../guides/huong-dan-su-dung.md).

Kiểm chứng đợt tiếp: 388 test FE liên quan (gồm design guard) và 31 test tích hợp BE trên PostgreSQL riêng
đã pass. Lượt chạy toàn bộ Vitest chưa hoàn tất vì worker thoát đột ngột; không coi đó là toàn bộ suite đã pass.
Lint, typecheck, production build và bundle guard (cả production/staging) đã pass trên 4 project;
lint và build còn các cảnh báo của workspace. Không tăng design-drift baseline.
Đã chạy hết lộ trình giảng viên/học viên, xem lại từ menu tài khoản, Esc, hoàn tất rồi tải lại trang, và màn
điện thoại 375 × 812. Đã kiểm tra hướng dẫn tôn trọng hộp xác nhận bản soạn chưa lưu; dropdown SCORM chọn được
bằng bàn phím; bảng báo cáo 0 dòng vẫn giữ bộ lọc và phạm vi; Xem tất cả tab hoàn thành giữ cả khóa tự đăng ký.
Đã khôi phục kích thước và tài khoản giảng viên sau kiểm tra, không lưu thêm bài học/khóa học lên môi trường chung.
Cần deploy FE + BE tương ứng để dùng đầy đủ sửa UX dữ liệu; không có migration SQL mới.
Các mục UX-05 trở đi vẫn là đề xuất chưa xử lý trong đợt này.

| Mã    | Ưu tiên | Route / bằng chứng                                                                                 | Điểm chưa hợp lý và ảnh hưởng                                                                                                                                                                    | Đề xuất / điều kiện nghiệm thu                                                                                                                                                                                                                      |
| ----- | ------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-01 | P1      | `/learn` → Xem tất cả. Đã thấy + source.                                                           | Đang ở tab Đang học/Đã hoàn thành nhưng Xem tất cả luôn đi `/catalog?scope=assigned`. Phạm vi và trạng thái bị đổi; khóa tự đăng ký có thể biến mất.                                             | Giữ ngữ cảnh tab, requirement và phạm vi của danh sách nguồn; kiểm tra cả khóa tự đăng ký. Nếu cần trang riêng cho toàn bộ khóa đã tham gia, chốt API/phạm vi rõ ràng thay vì chỉ đổi tên link.                                                     |
| UX-02 | P1      | `/notifications`. Đã thấy + source.                                                                | Nhắc hạn không nói tên khóa học; CTA dẫn tới `/progress` chung. Có nhiều hạn thì học viên phải tự dò xem thông báo nói đến khóa nào.                                                             | Cấp `courseId`, `courseTitle` và khi cần `enrollmentId` trong dữ liệu thông báo; hiển thị tên khóa và mở trực tiếp đúng khóa/lần học. Kiểm tra cả khóa bị thu hồi hoặc không còn quyền truy cập.                                                    |
| UX-03 | P1      | `/progress`, mặc định Truy cập gần nhất. Đã thấy; cần kiểm tra query thực tế trên môi trường chạy. | Các dòng chưa truy cập, thời gian `—`, xuất hiện trước các khóa vừa học. Nhãn sắp xếp không khớp cảm nhận người dùng.                                                                            | Kiểm tra `lastAccessAt,desc`, đặt giá trị null cuối danh sách và thêm thứ tự phụ ổn định trước phân trang. Kiểm thử cả trang 1 và trang kế tiếp.                                                                                                    |
| UX-04 | P1      | `/reports/results`. Đã thấy + source.                                                              | Mã cán bộ và trạng thái áp dụng cho bảng, còn biểu đồ/KPI dùng phạm vi tổng hợp rộng hơn. Có câu giải thích nhưng ở phía dưới biểu đồ; người xem dễ tưởng mọi con số đã được lọc giống nhau.     | Phân biệt rõ bộ lọc dùng chung với bộ lọc bảng ngay tại vị trí nhập. Hiển thị phạm vi của KPI/biểu đồ và phạm vi bảng cạnh tiêu đề. Nếu muốn thống nhất toàn bộ số liệu, cần chốt hợp đồng BE; không lọc một trang dữ liệu ở FE để giả lập số tổng. |
| UX-05 | P2      | Menu Nhật ký hệ thống → `/admin/gamification`. Đã thấy + source.                                   | Tên menu dẫn tới màn Cấu hình điểm thưởng: XP, cấp độ, huy hiệu và lịch làm việc. Người tìm audit log bị đưa tới chức năng khác.                                                                 | Đặt lại tên menu theo chức năng thực tế, hoặc tách nhật ký hệ thống thành route có dữ liệu audit phù hợp. Đồng bộ metadata menu BE, bảng route FE và tìm kiếm điều hướng.                                                                           |
| UX-06 | P2      | `/course/25`, bài thi còn 0 lượt. Đã thấy.                                                         | CTA chính vẫn là Đến bài thi cuối khóa mặc dù phần dưới nói đã hết lượt. Học viên phải đi thêm bước để gặp tình trạng bị chặn.                                                                   | CTA theo khả năng thực tế: xem kết quả/lịch sử, hoặc chỉ dẫn liên hệ giảng viên khi hết lượt. Giữ quyền cấp thêm lượt tại BE; không tự mở lượt từ FE.                                                                                               |
| UX-07 | P2      | `/learn`, `/catalog`, thẻ khóa đã học đủ nội dung nhưng trượt bài cuối. Đã thấy.                   | Trên cùng thẻ có 100%, Đang học và Chưa đạt. Màn chi tiết đã giải thích đúng, nhưng thẻ chưa nói 100% là nội dung hay điều kiện hoàn thành khóa.                                                 | Ghi rõ 100% nội dung; còn bài thi bắt buộc chưa đạt. Hiển thị hành động tiếp theo phù hợp. Không đổi trạng thái khóa thành hoàn thành chỉ vì phần trăm nội dung đạt 100%.                                                                           |
| UX-08 | P2      | `/catalog` ở 375 × 812. Đã thấy.                                                                   | Sáu dropdown, tìm kiếm và phạm vi chiếm gần hết màn hình; tên khóa đầu tiên nằm dưới vùng nhìn thấy. Thanh tìm kiếm toàn cục trên header cũng quá hẹp.                                           | Trên điện thoại, ưu tiên tìm tên khóa và nút Bộ lọc có số điều kiện; mở các điều kiện trong sheet đầy đủ. Tìm kiếm toàn cục mở ô nhập đủ rộng khi cần. Bộ lọc đã chọn phải luôn có cách xem/xóa dễ thấy.                                            |
| UX-09 | P2      | `/admin/questions` ở desktop. Đã thấy.                                                             | Thống kê, tìm chương trình, chọn chương trình và nhiều bộ lọc đẩy danh sách xuống thấp. Tìm chương trình và tìm nội dung là hai thao tác gần nhau, dễ nhập nhầm ô.                               | Giữ chương trình là phạm vi nổi bật; phân biệt rõ ô tìm chương trình với tìm câu hỏi. Gom lọc phụ gọn hơn, giữ số kết quả và các bộ lọc đang dùng gần danh sách. Không bỏ thống kê một dòng đã thống nhất.                                          |
| UX-10 | P2      | `/admin/questions`: bộ lọc và drawer thêm câu hỏi. Đã thấy + source.                               | Cùng một khái niệm được gọi Nhóm kiến thức ở danh sách nhưng Nhóm năng lực trong form. Một số chỗ còn dùng xen kẽ bài thi/bài kiểm tra.                                                          | Chốt từ điển thuật ngữ theo nghiệp vụ rồi dùng đồng nhất cho label, tooltip, lỗi và hướng dẫn. Với các loại bài khác nhau, giải thích rõ Luyện tập / Thi cuối khóa.                                                                                 |
| UX-11 | P2      | `/admin/lessons`. Đã thấy.                                                                         | Khối nhập SCORM và hướng dẫn dài luôn nằm trước thư viện. Người chỉ muốn tìm/chọn bài có sẵn phải cuộn qua thao tác nhập mỗi lần.                                                                | Đưa danh sách/tìm kiếm lên trước; mở form nhập qua nút Nhập bài giảng. Giữ hướng dẫn định dạng và giới hạn dung lượng ở đúng lúc chọn tệp.                                                                                                          |
| UX-12 | P2      | Form lĩnh vực `/admin/catalog`. Source.                                                            | Nhiều phân hệ được trình bày thành các fieldset dọc. Khi có hàng chục dòng, khó tìm, nhận biết dòng đã sửa hoặc dòng sắp xóa.                                                                    | Giữ CRUD bên trong Sửa lĩnh vực theo yêu cầu; thêm danh sách có mã/tên/trạng thái và tìm kiếm trong form, mở chi tiết dòng khi cần. Hiển thị tổng số thay đổi và các dòng sắp xóa trước khi Lưu. Cần thử với ít nhất 30 phân hệ.                    |
| UX-13 | P2      | `/catalog`, các khóa không có ảnh riêng. Đã thấy.                                                  | Ảnh bìa dự phòng giống nhau, kích thước lớn; ảnh chiếm nhiều diện tích hơn thông tin phân biệt khóa. Danh mục trông lặp và mất thời gian quét tên.                                               | Dùng thumbnail gọn, đồng nhất tỷ lệ; ưu tiên tên, chương trình, hạn và hành động. Cho phép danh sách gọn trên điện thoại. Không thêm hình trang trí hoặc ảnh AI không liên quan nghiệp vụ.                                                          |
| UX-14 | P2      | `/progress` → Năng lực. Đã thấy.                                                                   | Nhãn radar dài tràn ra ngoài vùng biểu đồ. Giá trị 100% với rất ít câu trả lời cũng dễ bị hiểu là đã vững toàn bộ năng lực.                                                                      | Rút gọn nhãn có cách xem tên đầy đủ; kiểm tra bố cục với tên dài. Đưa số câu/lượt làm cơ sở đánh giá cạnh kết quả và gợi ý nội dung ôn tập khi có dữ liệu liên kết. Không tự suy ra mức năng lực chưa được BE định nghĩa.                           |
| UX-15 | P3      | `/certificates`. Đã thấy.                                                                          | Thumbnail chứa toàn bộ chữ trên chứng nhận, mã dài bị xuống nhiều dòng, chiều cao giữa các thẻ lệch nhau; đọc nội dung nhỏ khó hơn đọc metadata bên ngoài.                                       | Giữ mẫu chứng nhận Core Banking Academy hiện tại. Khóa tỷ lệ thumbnail và kích thước preview; tên khóa/ngày/mã đầy đủ ở metadata hoặc màn chi tiết. Có thể bổ sung tải trực tiếp nếu đã có quyền và endpoint.                                       |
| UX-16 | P2      | Header `/lesson/:courseId/:lessonId`. Đã thấy + source.                                            | Đã lưu tiến độ vẫn xuất hiện, trong khi yêu cầu trước là chạy ngầm. Phản hồi kỹ thuật chiếm chỗ đọc trên điện thoại.                                                                             | Bỏ text trạng thái lưu thành công/đang lưu thường kỳ. Giữ thông báo có hành động khi thực sự không lưu được, mất phiên hoặc cần mở lại phiên học. Không ẩn lỗi dữ liệu quan trọng.                                                                  |
| UX-17 | P2      | Chuông và `/notifications`. Đã thấy + source.                                                      | Chuông báo 2 chưa đọc, trang thông báo học tập báo 1. Shell cộng cả câu hỏi/phản hồi nên hai nơi khác phạm vi; người dùng khó biết còn mục nào chưa xử lý.                                       | Ghi rõ loại và số lượng trong popover, dẫn tới đúng danh sách; hoặc thống nhất inbox. Đồng bộ bộ đếm sau đánh dấu đọc/xóa và ghi rõ tổng nào bao gồm phản hồi.                                                                                      |
| UX-18 | P2      | `/admin/courses`, `/admin/courses/new`. Đã thấy + source.                                          | Mô tả Thay đổi có hiệu lực ngay không phân biệt nháp/xuất bản; hướng dẫn AI nói hoàn thành thông tin ở trên nhưng form lại ở dưới. Copy làm người soạn hiểu sai thời điểm nội dung tới học viên. | Mô tả rõ Lưu nháp giữ riêng; Xuất bản mới cập nhật cho học viên theo quy tắc revision. Đổi chỉ dẫn AI thành Hoàn thành thông tin cơ bản ở bước 1, tránh chỉ vị trí trên/dưới.                                                                       |

## Bốn việc nên làm trước

1. **UX-01:** đi từ từng tab trên trang học tập sang danh sách đầy đủ mà không đổi ngữ cảnh. Đặc biệt thử tài khoản có cả khóa tự đăng ký và khóa được giao.
2. **UX-02:** nhắc hạn phải chỉ ra đúng khóa và mở được đúng khóa. Đây là tình huống người học cần quyết định ngay.
3. **UX-03:** kiểm tra sắp xếp truy cập gần nhất với dữ liệu thời gian null và phân trang.
4. **UX-04:** làm rõ phạm vi của báo cáo trước khi người dùng xuất CSV hoặc dùng con số để đánh giá học viên.

Các mục ảnh, radar và chứng nhận nên thực hiện sau những việc ảnh hưởng ý nghĩa dữ liệu/điều hướng.

## Dấu hiệu cần kiểm chứng thêm

### R-01 — vị trí PDF khi thay đổi kích thước

Ở `/lesson/25/71?block=105`, sau khi đổi desktop sang 375 px, thông báo ghi Đã mở lại tại trang 25 nhưng bộ đếm hiện Trang 27/27; vùng xem có các trang cuối tài liệu. Mở lại sau đó nhận trang 27. Đây là quan sát trong một lần chuyển kích thước, **chưa đủ kết luận luồng resume thông thường bị lỗi**.

Cần tái hiện bằng PDF có chiều cao trang khác nhau: lưu trang 5, rời bài, mở lại, đổi kích thước/xoay điện thoại rồi mở lại lần nữa. Đối chiếu trang thực sự đang nhìn thấy, lựa chọn của scroll observer và sự kiện lưu gửi BE. Không dùng riêng thông báo đã mở lại làm bằng chứng trang hiện tại đúng.

![Màn PDF ở điện thoại](E:/final-mockup/tmp/qa-uiux-20261114/lesson-mobile.png)

### R-02 — đối chiếu phiên bản BE đang chạy

Trong danh mục đang chạy, các khóa hoàn thành có hạn cũ vẫn xuất hiện trước các khóa chưa hoàn thành. Source BE tại `E:/corebanking-academy` đã có thay đổi ưu tiên khóa chưa hoàn thành từ đợt trước, nhưng lần xem này chưa chứng minh môi trường đang dùng bản đó. Cần kiểm tra phiên bản triển khai và request thực tế trước khi kết luận là lỗi mới hoặc bổ sung cách sort cục bộ ở FE.

## Điểm đang làm tốt nên giữ

- Menu học viên chia Học tập / Công cụ học / Cộng đồng, tách rõ khỏi thanh bên quản trị.
- Form tạo khóa báo lỗi tại từng trường sau khi bấm bước tiếp và đưa focus tới lỗi đầu tiên.
- Màn chi tiết khóa đã tách đủ nội dung bài học với điều kiện đạt bài thi cuối khóa.
- Thông báo đã đọc/chưa đọc có phân biệt; thao tác xóa không nằm lộ giữa nội dung.
- Đã lưu & ghi chú có ngữ cảnh khóa/bài và vị trí PDF/video.
- Danh sách cộng đồng khá dễ quét: tiêu đề, tác giả, trạng thái và số trả lời được tách rõ.
- Giao diện tối của danh mục vẫn giữ thứ bậc nội dung; chưa đo tương phản để kết luận đạt chuẩn WCAG.

Chữ Bản mockup v2 ở login đang nằm dưới điều kiện `devTools`; không coi ảnh chụp môi trường phát triển là bằng chứng production bị lộ nội dung demo. Tương tự, tên khóa QA/test và ảnh do tài khoản demo tải lên không được coi riêng là lỗi thiết kế hệ thống.

## Nguồn đối chiếu chính

- [Link Xem tất cả trên trang học tập](E:/lms-vip-pro-max/apps/lms/src/app/features/learning/learn/learn.html:21).
- [Trang thông báo và CTA](E:/lms-vip-pro-max/apps/lms/src/app/features/account/notifications/notifications.html:45), [hợp đồng LearningReminder](E:/lms-vip-pro-max/libs/contracts/src/lib/learner/learner.schema.ts), [bộ đếm shell](E:/lms-vip-pro-max/apps/lms/src/app/layout/shell/data-access/shell.store.ts:269).
- [Sort tiến độ học](E:/lms-vip-pro-max/apps/lms/src/app/features/achievements/progress/data-access/progress.store.ts:51), [thực thi sort SQL](E:/corebanking-academy/src/main/java/vn/com/coreacademy/common/persistence/NativeSearchQuery.java:96).
- [Giải thích phạm vi báo cáo](E:/lms-vip-pro-max/apps/lms/src/app/features/reports/report-screen/report-screen.html:453).
- [Màn cấu hình điểm thưởng](E:/lms-vip-pro-max/apps/lms/src/app/features/admin-gamification/gamification-admin/gamification-admin.html:1).
- [Header màn học](E:/lms-vip-pro-max/apps/lms/src/app/features/lesson/lesson/lesson.html:33), [PDF viewer](E:/lms-vip-pro-max/apps/lms/src/app/features/lesson/lesson/components/pdf-block/pdf-block.ts).
- [Form phân hệ trong lĩnh vực](E:/lms-vip-pro-max/apps/lms/src/app/features/admin-content/training-catalog/components/catalog-item-form/catalog-item-form.html).

## Ảnh kiểm tra

- [Nút Quay lại / Tiếp theo ở quản lý bài thi](E:/final-mockup/tmp/qa-uiux-20261114/admin-navigation-unified.png).
- [Bộ lọc danh mục trên điện thoại](E:/final-mockup/tmp/qa-uiux-20261114/catalog-mobile.png).
- [Danh mục trên điện thoại, giao diện tối](E:/final-mockup/tmp/qa-uiux-20261114/catalog-mobile-dark.png).
- [Tên menu Nhật ký hệ thống và màn Cấu hình điểm thưởng](E:/final-mockup/tmp/qa-uiux-20261114/menu-log-mismatch.png).

## Kiểm chứng code của thay đổi nhãn nút

- 282 test pass trong 6 file: màn học, trình tạo khóa, quản lý bài thi, làm bài thi, template scan và design drift.
- Kiểm tra trình duyệt: Quay lại / Tiếp theo hiển thị cùng nhau và điều hướng đúng trong bài có nhiều khối; hai nút đổi khóa vẫn xuất hiện ở quản lý bài thi.
- Chưa kiểm thử bắt đầu/nộp một lượt thi thật trong lần rà soát này; nhãn và luồng chuyển câu được kiểm tra bằng bộ test hiện có.
- Lint, typecheck, build và bundle guard: pass. Lint có 659 cảnh báo, 0 lỗi; chưa xử lý các cảnh báo ngoài phạm vi thay đổi nhãn nút.
