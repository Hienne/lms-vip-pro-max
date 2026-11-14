# Rà soát logic, nghiệp vụ và UI/UX — Core Banking Academy

Ngày lập: **14/11/2026**. Mục đích: làm căn cứ chọn việc cần sửa hoặc nâng cấp. Mục 1–9 ghi nhận đợt rà soát trước khi triển khai; mục 10 cập nhật kết quả sau khi được chọn.

**Cập nhật sau quyết định triển khai:** đã sửa source của L-01 theo thời hạn **600 phút**, L-06,
U-01/02/03/06/07/08 và bộ đếm chuông. Các nhận xét bên dưới ghi nhận hiện trạng **trước khi sửa**;
chi tiết bàn giao và giới hạn kiểm chứng nằm ở mục 10. Chưa deploy hoặc chạy SQL trên database dùng chung.

## 1. Đánh giá tổng thể

Website đã có nền tảng của một hệ thống đào tạo thực sự: khóa học có phiên bản, giao học theo đối tượng, học tiếp theo vị trí, ngân hàng câu hỏi dùng chung theo chương trình, thi có điều kiện/lượt thi, SCORM, báo cáo và chứng nhận. Phần cần đầu tư tiếp nằm nhiều ở **sự nhất quán giữa các trạng thái, xử lý ngoại lệ và chỉ dẫn hành động tiếp theo**.

Học viên hiện đã tìm được nội dung và kết quả, nhưng vẫn có lúc phải tự suy luận: “100% mà sao chưa xong?”, “hết lượt thì phải bấm gì?”, “hai thông báo cùng khóa nhưng hạn khác nhau nghĩa là sao?”. Phía quản trị có nhiều công cụ, nhưng cần làm rõ thời điểm công bố, ảnh hưởng của hủy kết quả và các bước phục hồi khi một phần quy trình thất bại.

Nếu muốn tạo điểm nhấn, nên ưu tiên **học gắn với tình huống Core Banking và hành động cần làm**, thay vì bổ sung thêm nhiều biểu đồ hoặc khối AI trên trang chủ.

### Cách đọc và phạm vi kiểm tra

- **UI:** đã quan sát lại trên giao diện đang chạy bằng tài khoản demo.
- **Code:** đã đối chiếu implementation FE/BE; chưa tái hiện đầy đủ bằng dữ liệu đặc biệt.
- **Chốt nghiệp vụ:** hành vi hiện tại có chủ đích hoặc có nhiều cách hợp lệ; chưa gọi là lỗi.
- **Đề xuất:** ý tưởng sản phẩm, không phải khẳng định hệ thống đang thiếu một yêu cầu đã cam kết.
- **P1:** nên giải quyết/chốt trước khi dùng cho kỳ thi hoặc xác nhận hoàn thành chính thức.
- **P2:** nên làm trong đợt cải tiến kế tiếp.
- **P3:** thuận tiện, hoàn thiện trải nghiệm.
- Độ lớn **Nhỏ / Vừa / Lớn** là ước lượng tương đối về phạm vi thay đổi, không phải cam kết timeline.

Nguồn chính: FE tại `E:/lms-vip-pro-max`, BE tại `E:/corebanking-academy`; giao diện Angular đang chạy tại `http://localhost:4200`. Đã xem lại `/learn`, `/course/25`, `/catalog` ở 375 × 812, `/notifications` và chuông, `/progress` và tab Năng lực, `/admin/courses`, `/admin/courses/new`, `/admin/questions` và drawer thêm câu hỏi, `/reports/results` với bộ lọc không có kết quả, `/admin/gamification`.

Không tạo lượt thi, nhập file, xuất bản khóa, hủy điểm, đổi quyền hoặc sửa dữ liệu để chứng minh các tình huống đặc biệt. Không chạy lại toàn bộ test suite trong đợt chỉ lập báo cáo này. Chưa kiểm thử chờ hết phiên 60 phút, dữ liệu trên 100 danh mục, tải lớn, toàn bộ phân quyền âm hay resume PDF sau mọi kiểu đổi kích thước. Source hiện hành và phiên bản BE đang triển khai cần được phân biệt khi nghiệm thu.

## 2. Những phần nên giữ, không làm lại

| Phần                      | Nhận xét hiện tại                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hoàn thành khóa           | BE kiểm tra bài bắt buộc và bài thi cuối khóa; không coi 100% nội dung là đủ. Các bài quiz bắt buộc trong nội dung cũng tham gia điều kiện. [S01]                                                                                                                              |
| Phiên bản và lần học      | Có cơ chế tách revision/lần học, chuyển phiên bản hoặc học lại có chủ đích. Nên giữ lịch sử thay vì ghi đè nội dung và điểm đã học. [S02]                                                                                                                                      |
| Lưu khóa kèm bài thi      | API lưu cấu hình khóa, đề và pool câu hỏi đã có transaction chung. Không kết luận rằng bước tạo bài thi đang luôn tạo dữ liệu mồ côi. Điểm còn cần xem là **xuất bản**, tại L-05. [S03]                                                                                        |
| Thi và lưu đáp án         | Có hàng đợi lưu rồi mới nộp; thời gian dựa trên deadline của server. Đây là nền tốt để xử lý mất mạng/hết phiên. [S04]                                                                                                                                                         |
| Phân quyền                | BE xét role và scope trên cùng grant; FE không phải nơi quyết định quyền cuối cùng. Chưa có bằng chứng để kết luận đang vượt quyền. [S05]                                                                                                                                      |
| Các sửa UX-01–04 trước đó | Giữ ngữ cảnh Xem tất cả; nhắc hạn đã có tên/link khóa; source có NULLS LAST; báo cáo đã ghi rõ phạm vi tổng hợp và bảng. Đợt này thấy link đúng trên UI, tiến độ gần nhất hợp lý ở trang đầu, báo cáo 0 dòng vẫn giữ loại báo cáo. Không đưa lại bốn mục này như lỗi chưa sửa. |
| Form câu hỏi              | Vừa mở drawer không còn lỗi “chọn đáp án” ngay lập tức; đã có xem trước như học viên.                                                                                                                                                                                          |
| Năng lực                  | Đã có số câu đúng/tổng câu và giải thích tỷ lệ điểm trong bảng. Không cần bổ sung lại những thứ đã có; vấn đề còn lại là cách diễn giải và bố cục biểu đồ.                                                                                                                     |
| SCORM                     | Đã có nhúng trong bài học, báo trạng thái/điểm, học lại khi trượt và xử lý lỗi lưu/hết vé. Thư viện đã ghi rõ SCORM 1.2 Single SCO. [S06]                                                                                                                                      |
| Hướng dẫn sử dụng         | Đã có học viên, giảng viên và quản trị viên; lọc bước theo quyền, xem lại từ menu, có khoảng đệm vùng đánh dấu.                                                                                                                                                                |

## 3. Logic và nghiệp vụ cần quyết định

### L-01 — Phiên đăng nhập 60 phút và bài thi tới 240 phút

**P1 · Code · FE + BE · Vừa/Lớn.**

Cấu hình mặc định JWT là 60 phút; cấu hình đề cho phép tới 240 phút. FE chưa có refresh token; khi nhận lỗi hết phiên thì giữ các draft đã đăng ký và đưa về đăng nhập. Đáp án đã gửi thành công vẫn nằm ở server, nhưng cần nghiệm thu riêng đáp án đang chờ gửi và cách quay lại lượt thi. Không có cơ sở kết luận rằng toàn bộ bài sẽ bị mất. [S07]

**Nên làm:** chốt cơ chế xác thực lại an toàn trong kỳ thi dài, cảnh báo phù hợp và quay về đúng lượt đang làm. Không tự kéo dài phiên vượt quy định 60 phút chỉ để che vấn đề.

**Điều kiện nghiệm thu:** đăng nhập trước khi thi một thời gian, làm đề dài; phiên hết khi đang lưu đáp án; đăng nhập lại vẫn đúng lượt, đáp án đã lưu và deadline. Không được khởi tạo lượt mới hoặc cộng thêm thời gian.

### L-02 — Giới hạn rời màn thi cần lưu tại server và có lý do nộp bài

**P1 · Code + chốt nghiệp vụ · FE + BE · Vừa.**

Số lần rời màn hiện được lưu bằng `sessionStorage`; các tín hiệu chuột/ẩn trang/mất focus liên tục được gộp thành một lần, lần thứ tư sẽ tự nộp. Tuy nhiên bộ đếm không phải dữ liệu bền vững ở server. FE tự nộp bằng cùng endpoint nộp thường; nếu chưa hết giờ, BE chấm với `SUBMITTED / MANUAL`. Báo cáo vì thế không phân biệt được nộp tay với bị buộc nộp do rời màn. [S04] [S08]

**Nên làm:** giữ mặc định “quá 3 lần” theo yêu cầu hiện hành, bổ sung sự kiện rời màn gắn với lượt thi, bộ đếm và lý do nộp ở BE. Chốt cách xử lý các tín hiệu hợp lệ như mất focus do hộp thoại hệ điều hành; tín hiệu trình duyệt không nên tự được diễn giải thành kết luận gian lận.

**Điều kiện nghiệm thu:** tải lại/tiếp tục lượt thi không làm sai bộ đếm; một lần chuyển tab không bị đếm ba lần; lần thứ tư có kết quả và lý do nộp đúng; mất mạng khi buộc nộp có đường phục hồi, không nới deadline. Không thể coi cơ chế này là hệ thống giám sát chống gian lận tuyệt đối.

### L-03 — Hủy kết quả đã dùng để hoàn thành khóa thì chứng nhận xử lý thế nào?

**P1 · Chốt nghiệp vụ, có bằng chứng Code · BE + FE · Vừa/Lớn.**

Hủy lượt thi cập nhật trạng thái lượt và kết quả tổng hợp. Tiến độ khóa hiện tăng một chiều, giữ hoàn thành khi đã có `completedAt`. Chứng nhận được suy từ enrollment hoàn thành, chưa là một hồ sơ cấp/thu hồi độc lập. Vì vậy không nên mặc định rằng hủy lượt thi sẽ tự thu hồi chứng nhận. [S09]

**Cần bạn chọn chính sách:**

1. Chứng nhận ghi nhận thành tích tại thời điểm cấp; giữ lịch sử, bổ sung trạng thái cần rà soát khi chứng cứ kết quả thay đổi.
2. Có quy trình thu hồi/cấp lại chứng nhận riêng, nêu lý do và người xử lý; không xóa lịch sử đã cấp.

Nếu chứng nhận chỉ để động viên nội bộ, có thể giữ mô hình hiện tại và diễn giải rõ. Nếu dùng làm xác nhận đào tạo chính thức, nên chọn quy trình có hồ sơ cấp/thu hồi và snapshot thông tin tại thời điểm cấp.

**Điều kiện nghiệm thu:** hủy lượt đạt duy nhất; có một lượt đạt khác; học viên có nhiều lần học/phiên bản; báo cáo và chứng nhận phải theo cùng chính sách đã chốt. Không tự hạ trạng thái toàn bộ khóa cũ trong một bản vá giao diện.

### L-04 — Một số dropdown soạn khóa vẫn chỉ lấy trang đầu 100 mục

**P2; nâng ưu tiên nếu danh mục thực tế đã lớn · Code · FE, có thể thêm hỗ trợ tìm kiếm BE · Nhỏ/Vừa.**

Bộ chọn chương trình và phân hệ trong `CourseEditorStore` gọi `size: 100` và sử dụng trực tiếp `items`; chưa đi hết các trang như bộ chọn SCORM/câu hỏi. Với hơn 100 kết quả trong phạm vi, mục ở trang sau có nguy cơ không chọn/hiển thị được. Chưa tái hiện trên bộ dữ liệu 101 mục trong lượt này. [S10]

**Nên làm:** rà các bộ chọn danh mục cùng loại; thống nhất tìm kiếm trong dropdown và lấy đủ dữ liệu trong scope. Danh sách lớn có thể tải qua nhiều trang API và chỉ render vùng đang nhìn; vẫn giữ trải nghiệm một danh sách liên tục, không thêm phân trang UI trái yêu cầu trước.

**Điều kiện nghiệm thu:** chọn được mục 101+, giữ lựa chọn khi tìm kiếm/đổi trang API, sửa khóa đang tham chiếu mục ở cuối danh sách và không lẫn dữ liệu ngoài phạm vi.

### L-05 — Xuất bản đề và xuất bản khóa còn là hai bước ghi riêng

**P2 · Code + chốt nghiệp vụ · FE + BE · Vừa.**

Lưu nháp khóa kèm đề đã có transaction chung. Nhưng luồng xuất bản ở FE xuất bản đề trước, rồi mới xuất bản khóa; code có thông báo riêng “Bài thi đã xuất bản, khóa học chưa xuất bản” khi bước sau thất bại. Đây là trạng thái trung gian đã được nhận biết, không phải bằng chứng mất transaction ở API lưu nháp. [S03] [S11]

**Nên làm:** chọn một trong hai cách: giữ quy trình hiện tại nhưng có màn trạng thái/tiếp tục công bố rõ; hoặc gộp xuất bản thành nghiệp vụ nguyên tử nếu quy định bắt buộc khóa và đề phải cùng được công bố. Cần kiểm tra quyền nhìn thấy đề trong giai đoạn trung gian trước khi chọn cách gộp.

**Điều kiện nghiệm thu:** mô phỏng đề công bố thành công nhưng xuất bản khóa bị từ chối; người soạn biết phần nào đã xong và thử lại được mà không nhân bản đề hoặc công bố nhầm phiên bản.

### L-06 — Chốt ý nghĩa “hoàn thành” đối với SCORM có bài kiểm tra

**P2 · Chốt nghiệp vụ · FE + BE nếu thêm chính sách · Vừa.**

Hiện LMS đồng bộ bài SCORM lên hoàn thành khi SCO báo `completed` **hoặc** `passed`; không dùng điểm raw để tự suy trạng thái. Đây là cách xử lý có chủ đích. Gói báo `failed` dù có 73 điểm thì vẫn không được LMS tự sửa thành đạt. [S06]

**Cần phân biệt:** SCORM chỉ yêu cầu học xong nội dung hay SCORM phải đạt bài đánh giá bên trong? Nếu cả hai đều được sử dụng, nên có chính sách theo bài học/gói, thay vì quy đổi tất cả về một điều kiện.

**Nên làm:** hiển thị rõ trạng thái do gói gửi, điểm theo thang của gói và điều kiện được công bố. Chỉ dùng ngưỡng/điểm phần trăm khi có hợp đồng chính xác; không tự lấy mốc 70 cho mọi SCORM. Giữ học lại khi trượt theo cơ chế đã có.

**Điều kiện nghiệm thu:** gói chỉ có nội dung; gói báo passed/failed; gói báo completed nhưng có điểm; score max không phải 100; thoát và mở lại; một gói dùng ở hai bài hoặc hai lần học không lẫn kết quả.

### L-07 — Cùng khóa có nhiều nguồn giao/hạn cần được giải thích rõ

**P2 · UI + Code · FE, có thể cần metadata BE · Vừa.**

Danh sách khóa tổng hợp hạn sớm nhất từ các nghĩa vụ giao đang hiệu lực. Lịch sử thông báo lại giữ hạn tại thời điểm tạo thông báo. Đợt xem này có hai thông báo đã đọc cho cùng một khóa với hạn 16/11 và 17/11. Chưa xác định đó là đổi lịch hay hai nguồn giao; không gọi chúng là thông báo sai. [S12]

**Nên làm:** tách “Hạn hiện tại cần hoàn thành” với “Hạn tại thời điểm thông báo”; trong chi tiết khóa cho xem nguồn giao/đơn vị giao và nghĩa vụ còn hiệu lực. Thông báo cũ vẫn giữ làm lịch sử nhưng không tạo cảm giác có hai hạn hiện hành.

**Điều kiện nghiệm thu:** một người nhận cùng khóa từ đơn vị và nhóm; đổi hạn một nguồn; thu hồi một nguồn; quyền tự đăng ký còn hiệu lực. Hạn và quyền học cuối cùng phải do BE tính.

## 4. UI/UX nên cập nhật

| Mã   | Ưu tiên / bằng chứng                     | Vấn đề hiện tại                                                                                                                                                                                                                              | Hướng xử lý và nghiệm thu                                                                                                                                                                                                              | Phạm vi / độ lớn                                             |
| ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| U-01 | P2 · UI + Code                           | Thẻ `/learn`, `/catalog` có thể đồng thời ghi **100%**, **Đang học**, **Chưa đạt**. Màn chi tiết giải thích đúng, nhưng thẻ chưa nói rõ 100% là nội dung.                                                                                    | Ghi “100% nội dung · Còn bài thi bắt buộc chưa đạt”; giữ trạng thái khóa từ server. Người học đọc thẻ biết còn thiếu điều kiện gì. [S13]                                                                                               | FE; cần metadata bổ sung nếu dữ liệu thẻ chưa đủ / Nhỏ–Vừa   |
| U-02 | P2 · UI + Code                           | `/course/25` có CTA chính **Đến bài thi cuối khóa**, trong khi phía dưới ghi **Còn 0 lượt** và cần liên hệ giảng viên.                                                                                                                       | CTA theo tình trạng thực: xem kết quả/lịch sử hoặc hướng dẫn xin thêm lượt. Khi còn lượt nhưng đang chờ/lịch chưa mở thì nói thời điểm được thi. Không cấp lượt từ FE. [S13]                                                           | FE / Nhỏ                                                     |
| U-03 | P2 · UI, đã thử 375 × 812                | Bộ lọc danh mục gồm nhiều dropdown chiếm gần trọn màn hình; khó nhìn thấy tên khóa đầu tiên.                                                                                                                                                 | Giữ ô tìm tên/mã và nút Bộ lọc có số điều kiện; điều kiện chi tiết mở trong sheet. Hiện/xóa được điều kiện đang dùng; giữ URL và phạm vi.                                                                                              | FE / Vừa                                                     |
| U-04 | P2 · UI + Code                           | Menu **Nhật ký hệ thống** dẫn tới màn **Cấu hình điểm thưởng**. Tên chức năng và nội dung không khớp.                                                                                                                                        | Trước mắt đổi nhãn đúng nghiệp vụ và đồng bộ metadata/menu/tìm kiếm. Nếu cần nhật ký thật, tạo luồng đọc audit có lọc tác nhân, đối tượng, thời điểm và phạm vi riêng; không chỉ đổi tiêu đề màn điểm thưởng thành nhật ký. [S14]      | FE + metadata BE; màn audit mới là việc riêng / Nhỏ hoặc Lớn |
| U-05 | P2 · UI + Code                           | Trang khóa nói “Thay đổi có hiệu lực ngay” nhưng nháp/xuất bản/revision là các trạng thái khác nhau. Ở tạo khóa, nút AI yêu cầu hoàn thành thông tin “ở trên” trong khi form ở dưới; khối AI lớn cũng xuất hiện trong bước thông tin cơ bản. | Copy nói rõ lưu nháp, công bố và ảnh hưởng phiên bản. Đưa AI thành thao tác chủ động khi đủ ngữ cảnh; kế thừa chương trình/mức độ/đơn vị phù hợp để giảm nhập trùng. Giữ tác giả duyệt nội dung AI trước xuất bản. [S15]               | FE / Nhỏ–Vừa                                                 |
| U-06 | P2 · UI + Code                           | Ngân hàng câu hỏi dùng **Nhóm kiến thức** ở bộ lọc, **Nhóm năng lực** trong form; nhiều nơi xen kẽ bài thi/bài kiểm tra.                                                                                                                     | Chốt từ điển thuật ngữ: chương trình, khóa, bài học, bài kiểm tra, thi cuối khóa, năng lực. Đổi thống nhất label, tooltip, lỗi, mẫu Excel và hướng dẫn; giữ phân biệt đúng các khái niệm khác nhau. [S16]                              | FE + hợp đồng nội dung / Nhỏ                                 |
| U-07 | P2 · Code                                | Header bài học vẫn có **Đã lưu tiến độ** trên desktop; điện thoại còn icon và text cho trợ năng. Khác yêu cầu chạy lưu ngầm trước đó.                                                                                                        | Bỏ phản hồi thành công thường kỳ; giữ thông báo có hành động khi chưa lưu, mất phiên, hoặc cần mở lại. Không ẩn lỗi quan trọng. Chưa mở lại bài học để tránh ghi hoạt động học trong đợt này. [S17]                                    | FE / Nhỏ                                                     |
| U-08 | P3 · UI + Code, phản hồi sử dụng thực tế | Hướng dẫn có mở lại từ menu nhưng người dùng vẫn hỏi cách bật/tắt. Tour dài là giới thiệu toàn hệ thống; người đang mắc ở một màn cần trợ giúp ngắn hơn.                                                                                     | Có điểm “Hướng dẫn màn này” dễ tìm; giới thiệu lần đầu ngắn, phần chi tiết mở theo nhu cầu. Có thể thêm lựa chọn tự hiện lần đầu/xem lại; chỉ lưu server nếu cần đồng bộ nhiều thiết bị. Không ép xem lại sau mỗi lần đăng nhập. [S18] | FE; BE tùy chọn đồng bộ / Nhỏ–Vừa                            |

### Lưu ý riêng về biểu đồ năng lực

Ở `/progress?tab=competency`, bảng đã có **Câu đúng** và giải thích tỷ lệ điểm. Tuy nhiên trên giao diện đang xem, nhãn radar bên trái vẫn sát/tràn mép khung. Cần kiểm tra tên dài khi sửa U-03 hoặc hoàn thiện biểu đồ.

Quan trọng hơn hình thức: kết quả 100% từ 2/2 câu không nên được diễn giải thành “đã thành thạo toàn bộ năng lực”. Nên trình bày là **kết quả đánh giá theo nhóm**, cho biết lượng dữ liệu và khoảng thời gian đánh giá. Nếu muốn có mức “chưa đủ dữ liệu/thành thạo”, phải chốt quy tắc nghiệp vụ và nguồn dữ liệu ở BE trước. Không tự đổi điểm trong FE. [S19]

### Bằng chứng bố cục điện thoại

Ảnh bên dưới là danh mục ở 375 × 812; bộ lọc chiếm phần lớn vùng nhìn thấy trước thông tin khóa.

![Bộ lọc danh mục trên điện thoại](E:/final-mockup/tmp/qa-business-review-20261114/catalog-mobile.jpg)

## 5. Các điểm nhấn đáng đầu tư

Đây là **ý tưởng nâng cấp**, chưa phải task sửa lỗi được duyệt. Có thể chọn một hoặc hai ý tưởng làm rõ thay vì triển khai đồng thời tất cả.

| Mã   | Điểm nhấn                                                   | Giá trị và bản đầu tiên nên làm                                                                                                                                                                                                                                                 | Tận dụng hiện có / việc cần bổ sung                                                                                                                                                                      |
| ---- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | **Hôm nay tôi cần làm gì?**                                 | Một danh sách ngắn trên trang học: khóa gần hạn, việc còn thiếu để hoàn thành, bài đang học tiếp. Ví dụ “Đã đủ nội dung; còn bài thi cuối; hết lượt — xem hướng dẫn xin thêm”. Mỗi dòng có đúng hành động phù hợp.                                                              | Dùng deadline, resume, completion và eligibility hiện có. Nếu thiếu tổng hợp, thêm API gọn; không tải toàn bộ khóa/lượt thi rồi suy luật ở FE. Ưu tiên cao nhất trong nhóm điểm nhấn.                    |
| D-02 | **Sai ở đâu → ôn đúng phần đó**                             | Từ kết quả thi, nhóm các phần cần ôn và dẫn về đúng bài/trang hoặc kiến thức liên quan. Có thể tạo một buổi ôn ngắn theo nhóm câu sai, tách khỏi lượt thi chính thức.                                                                                                           | Đã có giải thích đáp án, competency và liên kết bài học ở một số dữ liệu. Cần rà độ phủ mapping, quyền xem đáp án và điều kiện thi lại; không mở đáp án bị khóa hoặc tự tăng lượt.                       |
| D-03 | **Tình huống thực hành Core Banking có nguồn và phiên bản** | Chọn một tình huống mẫu như rà soát dữ liệu CIF, đối soát hoặc xử lý lỗi EOD. Học viên đi từng bước, quyết định và đọc giải thích; nội dung gắn người chịu trách nhiệm, ngày rà soát và tài liệu nguồn/phiên bản. Đây là điểm riêng của Academy so với một kho PDF/video chung. | Tận dụng bài quy trình, văn bản, SCORM và quiz. Ban đầu dùng dữ liệu giả lập phục vụ đào tạo; không cần tích hợp giao dịch Core Banking thật. AI hỗ trợ soạn nhưng không tự công bố quy trình nghiệp vụ. |
| D-04 | **Báo cáo dẫn tới hành động của người quản lý**             | Các danh sách “sắp quá hạn”, “học xong nội dung nhưng chưa đạt”, “hết lượt”, “chưa bắt đầu”. Từ đó mở đúng đợt giao hoặc học viên, nhắc học/cấp lượt theo quyền và xác nhận của người quản lý.                                                                                  | Đã có báo cáo, giao khóa và cấp lượt chỉ định. Cần thống nhất scope, mẫu số và đường dẫn thao tác; lưu bộ lọc dùng thường xuyên nếu được duyệt. Không tự coi điểm bài thi là kết luận năng lực nhân sự.  |
| D-05 | **Hành trình theo chương trình**                            | Một trang chi tiết chương trình cho biết tổng số khóa cần học, đã xong, còn thiếu và bước nên tiếp tục. Hữu ích cho hội nhập và luân chuyển. Không cần thêm một dãy KPI lớn lên Dashboard.                                                                                      | Đã có endpoint dashboard theo chương trình. Cần thiết kế phạm vi và thứ tự hiển thị; nếu bổ sung điều kiện học trước/thứ tự bắt buộc thì đó là nghiệp vụ BE riêng, không suy từ thứ tự danh sách. [S20]  |

## 6. Những việc cần kiểm chứng, chưa đưa thành lỗi đã xác nhận

| Mã   | Cần kiểm tra                                    | Cách nghiệm thu đề xuất                                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Request lặp vô hạn khi học/đổi bài              | Code có hàng đợi, chặn cùng target và retry/resync hữu hạn; video gửi tiến độ định kỳ 20 giây là hành vi có chủ đích. Đo request lúc đứng yên, next/back nhanh, chuyển video/PDF/SCORM, mất mạng và mở hai tab. Chỉ kết luận lỗi khi có nhịp bất thường hoặc không dừng sau rời màn. Không chặn mọi request định kỳ bằng debounce để che lỗi. |
| C-02 | PDF resume sau đổi kích thước                   | Dùng tài liệu kiểm thử, lưu ở một trang giữa, rời bài và mở lại; đổi desktop/điện thoại. So trang thật đang nhìn với sự kiện được lưu. Ghi chú cũ từng có dấu hiệu lệch trang khi resize, chưa đủ chứng minh mọi lần resume đều lỗi.                                                                                                          |
| C-03 | SCORM học dài hơn vé 60 phút/mất mạng lúc thoát | Hiện đã có cảnh báo hết vé và Mở lại. Kiểm tra commit đang chờ, vé mới, vị trí học tiếp và trạng thái trên LMS sau mở lại; không kết luận thiếu cơ chế resume chỉ từ một lỗi 403. [S06]                                                                                                                                                       |
| C-04 | Phân quyền và triển khai đồng bộ                | Nghiệm thu theo role **và** GLOBAL/ORG/TEAM/OWN, nội dung chia sẻ, tài khoản đổi đơn vị, thu hồi quyền và dữ liệu của đơn vị khác. Đối chiếu phiên bản đang chạy, không thấy source đã sửa là mặc định server đã dùng bản đó. Đây là kế hoạch kiểm tra bổ sung, không phải cáo buộc đang lộ dữ liệu.                                          |

## 7. Hai nhận xét cần tránh hiểu nhầm

**Bộ đếm chuông trong môi trường dev:** đợt này chuông báo 2 trong khi trang và danh sách nhắc đều đã đọc. Source cho thấy `/api/me/nav-counts` đang `served: 'mock'`, fixture LEARNER là 2; production có nhánh lấy từ dòng nhắc thực. Vì vậy không ghi nhận hiện tượng này thành lỗi bộ đếm production. Nên thử bằng cấu hình gần production và rà riêng phần phản hồi giảng viên trước khi tạo task đồng bộ inbox. [S21]

**Tỷ lệ năng lực và dữ liệu demo:** tên khóa QA/test hoặc ảnh không đúng nghiệp vụ do tài khoản demo nhập không đủ để kết luận thiết kế sản phẩm “do AI làm”. Cần nghiệm thu thêm với bộ nội dung đào tạo Core Banking được biên tập tốt. Ngược lại, số phần trăm phải được giải thích đúng dù dùng dữ liệu demo hay thật.

## 8. Thứ tự nên chọn

1. **Chốt ba P1:** L-01, L-02, L-03. Đây là chính sách và tính tin cậy của thi/chứng nhận.
2. **Sửa ít nhưng thấy rõ:** U-01, U-02, U-04, U-05, U-06, U-07. Phần lớn tận dụng dữ liệu hiện có; không đổi theme hay làm lại toàn bộ màn.
3. **Cải thiện dùng thực tế:** U-03 và L-04 cho điện thoại/danh mục lớn; L-05–07 theo kết quả chốt nghiệp vụ.
4. **Làm điểm nhấn:** ưu tiên D-01 + D-02. Nếu muốn thể hiện bản sắc Core Banking trong bản trình diễn/đào tạo, bổ sung một tình huống D-03 đủ sâu.
5. **Mở rộng sau:** D-04, D-05 và U-08 theo nhu cầu thực tế. C-01–04 là bộ kiểm chứng đi kèm các thay đổi liên quan.

### Mẫu quyết định

| Nhóm           | Bạn có thể trả lời                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Duyệt làm      | Liệt kê mã, ví dụ `U-01, U-02, U-04`                                                                                    |
| Cần chốt trước | `L-01: cách xác thực lại`; `L-02: chính sách ghi nhận rời màn`; `L-03: giữ lịch sử hay có quy trình thu hồi chứng nhận` |
| Chọn điểm nhấn | Ví dụ `D-01 trước, D-02 sau`                                                                                            |
| Tạm hoãn       | Liệt kê mã chưa cần triển khai                                                                                          |

## 9. Nguồn đối chiếu

- **S01:** [Tính hoàn thành khóa tại BE](E:/corebanking-academy/src/main/java/vn/com/coreacademy/learning/service/LearningProgressService.java:397); [các kịch bản bài thi bắt buộc đã có trong test](E:/corebanking-academy/src/test/java/vn/com/coreacademy/assessment/QuizLessonCompletionIT.java:138). Chỉ đọc test, không chạy lại trong đợt này.
- **S02:** [API chuyển phiên bản/lần học](E:/corebanking-academy/src/main/java/vn/com/coreacademy/learning/controller/LearningAssignmentController.java:115).
- **S03:** [Transaction lưu khóa và bài thi](E:/corebanking-academy/src/main/java/vn/com/coreacademy/assessment/service/CourseExamService.java:23).
- **S04:** [Hàng đợi lưu và nộp bài](E:/lms-vip-pro-max/apps/lms/src/app/features/quiz/learner-quiz/quiz-take/data-access/quiz-take.store.ts:468).
- **S05:** [Kiểm tra role và scope cùng grant](E:/corebanking-academy/src/main/java/vn/com/coreacademy/learning/service/LearningAccessPolicy.java:50).
- **S06:** [Đồng bộ trạng thái SCORM](E:/corebanking-academy/src/main/java/vn/com/coreacademy/scorm/service/ScormService.java:306); [giới hạn một SCO](E:/corebanking-academy/src/main/java/vn/com/coreacademy/scorm/service/ScormPackageReader.java:128); [vé SCORM mặc định](E:/corebanking-academy/src/main/java/vn/com/coreacademy/scorm/config/ScormProperties.java:35); [UI mở lại khi hết vé](E:/lms-vip-pro-max/apps/lms/src/app/features/lesson/lesson/components/scorm-block/scorm-block.html).
- **S07:** [Phiên 60 phút](E:/corebanking-academy/src/main/resources/application.yml:116); [đề tối đa 240 phút](E:/corebanking-academy/src/main/java/vn/com/coreacademy/assessment/constants/AssessmentLimits.java:11); [TokenStore chưa có refresh](E:/lms-vip-pro-max/apps/lms/src/app/core/session/token-store.ts:9); [xử lý hết phiên](E:/lms-vip-pro-max/apps/lms/src/app/core/session/session-expiry.ts:24).
- **S08:** [Lưu số lần rời màn tại trình duyệt](E:/lms-vip-pro-max/apps/lms/src/app/features/quiz/learner-quiz/quiz-take/data-access/quiz-take.store.ts:233); [xử lý presence](E:/lms-vip-pro-max/apps/lms/src/app/features/quiz/learner-quiz/quiz-take/data-access/quiz-take.store.ts:287); [phân loại nộp trước deadline](E:/corebanking-academy/src/main/java/vn/com/coreacademy/assessment/service/AttemptGrader.java:52).
- **S09:** [Hủy lượt thi](E:/corebanking-academy/src/main/java/vn/com/coreacademy/assessment/service/QuizAttemptAdminService.java:101); [giữ trạng thái hoàn thành](E:/corebanking-academy/src/main/java/vn/com/coreacademy/learning/service/LearningProgressService.java:414); [mô hình chứng nhận suy từ enrollment](E:/corebanking-academy/src/main/java/vn/com/coreacademy/learning/service/LearningCertificateService.java:24).
- **S10:** [Các bộ chọn chương trình/phân hệ](E:/lms-vip-pro-max/apps/lms/src/app/features/admin-content/course-editor/data-access/course-editor.store.ts:411).
- **S11:** [Xuất bản đề](E:/lms-vip-pro-max/apps/lms/src/app/features/admin-content/course-editor/data-access/course-editor.store.ts:1841); [xuất bản khóa và xử lý thất bại](E:/lms-vip-pro-max/apps/lms/src/app/features/admin-content/course-editor/data-access/course-editor.store.ts:1869).
- **S12:** [Tổng hợp hạn sớm nhất](E:/corebanking-academy/src/main/java/vn/com/coreacademy/learning/repository/custom/CourseRepositoryCustomImpl.java:81); [hiển thị nhắc hạn](E:/lms-vip-pro-max/apps/lms/src/app/shared/learning/reminder-item/reminder-item.html).
- **S13:** [Tỷ lệ trên thẻ khóa](E:/lms-vip-pro-max/apps/lms/src/app/shared/course/course-card.html:57); [điều kiện CTA bài cuối](E:/lms-vip-pro-max/apps/lms/src/app/features/learning/course/data-access/course.store.ts:234); [CTA trên giao diện](E:/lms-vip-pro-max/apps/lms/src/app/features/learning/course/course.html:38).
- **S14:** [SYSTEM_AUDIT dẫn tới cấu hình điểm thưởng](E:/lms-vip-pro-max/apps/lms/src/app/core/routing/screens.ts:430); đối chiếu nhãn menu và màn đang chạy.
- **S15:** [Mô tả trang khóa](E:/lms-vip-pro-max/apps/lms/src/app/features/admin-content/courses/courses.html:3); [copy hướng dẫn AI](E:/lms-vip-pro-max/apps/lms/src/app/features/admin-content/course-editor/course-editor.ts:134); quan sát form mới.
- **S16:** [Bộ lọc và form câu hỏi](E:/lms-vip-pro-max/apps/lms/src/app/features/quiz/assessment-screen/assessment-screen.html:228).
- **S17:** [Text lưu tiến độ](E:/lms-vip-pro-max/apps/lms/src/app/features/lesson/lesson/lesson.html:33); [hiển thị khác nhau theo kích thước](E:/lms-vip-pro-max/apps/lms/src/app/features/lesson/lesson/lesson.scss:79).
- **S18:** [Ghi nhớ hướng dẫn theo tài khoản, vai trò và trình duyệt](E:/lms-vip-pro-max/apps/lms/src/app/layout/shell/components/usage-guide/usage-guide.store.ts).
- **S19:** [Bảng và biểu đồ năng lực](E:/lms-vip-pro-max/apps/lms/src/app/shared/learning/competency/competency-view.html).
- **S20:** [Endpoint tổng hợp theo chương trình](E:/lms-vip-pro-max/libs/contracts/src/lib/learner/learner.endpoints.ts:94).
- **S21:** [Nav counts là mock](E:/lms-vip-pro-max/libs/contracts/src/lib/shell/shell.endpoints.ts:7); [fixture bộ đếm](E:/lms-vip-pro-max/libs/mocks/src/lib/shell/shell.fixtures.ts); [nhánh bộ đếm theo cấu hình](E:/lms-vip-pro-max/apps/lms/src/app/layout/shell/data-access/shell.store.ts:269).

Ghi chú UI/UX đợt trước nằm tại [uiux-review-2026-11-14.md](E:/lms-vip-pro-max/docs/reviews/uiux-review-2026-11-14.md). Bản này đối chiếu lại hiện trạng, mở rộng phần nghiệp vụ và tách các ý tưởng sản phẩm để chọn, không thay thế bằng một danh sách lỗi mặc định áp dụng hết.

## 10. Các mục đã triển khai sau khi được chọn

| Mục    | Hành vi sau thay đổi                                                                                                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-01   | `app.jwt.expiry-minutes: 600` (10 giờ). Token cũ giữ hạn đã cấp; đăng nhập lại sau khi deploy để nhận thời hạn mới. FE tiếp tục dùng hạn server, không tự gia hạn.                                                                                                                                            |
| L-06   | Từng bài SCORM có `scormCompletionRule`: `completed_or_passed` (mặc định, giữ tương thích) hoặc `passed`. Điều kiện được lưu cùng revision và do BE xét. Bài yêu cầu đạt được học lại khi gói báo completed/browsed mà chưa passed; failed vẫn học lại không giới hạn. Điểm không tự thay thế trạng thái gói. |
| U-01   | Thẻ ở cả Học tập và Danh mục ghi rõ `% nội dung`; giải thích bài kiểm tra cuối khóa chưa đạt hoặc còn điều kiện hoàn thành. Không suy hoàn thành khóa chỉ từ 100%.                                                                                                                                            |
| U-02   | Nút cuối khóa theo `canStart`, `blockReason`, thời điểm được thi và lượt đang chạy. Hết lượt dẫn tới kết quả/lịch sử, có hướng dẫn liên hệ giảng viên.                                                                                                                                                        |
| U-03   | Dưới 720px, bộ lọc chi tiết mở trong drawer; giữ scope/URL, có số điều kiện và bỏ từng điều kiện. Desktop giữ hàng dropdown. Tìm kiếm toàn cục trên điện thoại mở ô đủ rộng và chỉ điều hướng khi xác nhận.                                                                                                   |
| U-06   | Thống nhất Nhóm năng lực / Bài kiểm tra / Bài kiểm tra cuối khóa trong các màn liên quan, lỗi và hướng dẫn. Giữ lượt thi / thi lại / nộp bài cho hành động. Nhãn menu BE chuẩn được cập nhật qua migration, giữ nguyên tên tùy chỉnh và quyền.                                                                |
| U-07   | Bỏ phản hồi lưu thành công ở header bài học; lưu tiến độ chạy ngầm. Giữ lỗi lưu và nút Thử lại.                                                                                                                                                                                                               |
| U-08   | Có nút Hướng dẫn trên header để mở trợ giúp màn hiện tại, không rời trang. Giới thiệu tự động tối đa ba bước; menu tài khoản mở toàn bộ hướng dẫn và tùy chọn tự giới thiệu theo tài khoản/trình duyệt.                                                                                                       |
| Chuông | Đếm pending từ feed học viên thật, cộng phản hồi mới của giảng viên; bỏ số thông báo cố định từ nav-counts mock. Đọc/xóa làm mới bộ đếm; danh sách vẫn giữ các mục đã đọc.                                                                                                                                    |

### Cách sử dụng phần mới

1. Soạn khóa → Nội dung khóa học → bài loại SCORM → **Điều kiện hoàn thành bài SCORM**.
   Chọn yêu cầu đạt chỉ với gói có đánh giá và có thể gửi trạng thái `passed`; xem thử gói trước khi xuất bản.
2. Bấm **Hướng dẫn** ở đầu trang để xem trợ giúp ngắn. Chọn **Xem toàn bộ hướng dẫn** hoặc menu tài khoản →
   **Hướng dẫn sử dụng** để bật/tắt **Tự giới thiệu khi dùng vai trò mới**. Đóng/Bỏ qua luôn cho phép mở lại thủ công.

### Kiểm chứng và giới hạn

- Lint/typecheck bốn project FE, design guard và build production/staging kèm bundle guard đã qua.
- 533 test ứng dụng liên quan (gồm ca bổ sung đổi kích thước khi drawer đang mở); contracts 339, mocks 384, UI 563; design guard 28 đã qua.
- BE: `CourseCreateWithDraftIT` (13) và `LearningAiOwnershipTest` (6) đã qua trên PostgreSQL cục bộ.
  Kịch bản SCORM được chạy lại thành công với script cuối: migration lặp hai lần, giữ chính sách strict,
  completed không đủ với strict, passed hoàn thành, thang điểm 200, học lại và tách kết quả theo bài/lần học.
- Bộ BE mở rộng còn ca `QuizLessonCompletionIT.aRegradeThatTurnsFailIntoPassCompletesTheLesson` bị từ chối
  bởi `ASSESSMENT-QUIZ_REVISION_FROZEN`; không sửa quy tắc revision/đề trong phạm vi này. Toàn bộ `clean verify`
  cũng phụ thuộc các test cần Docker/pgvector, chưa xác nhận toàn bộ repository xanh trên máy này.
- Đã kiểm tra UI ở 375 × 812 và 1280 × 900, bộ lọc và tìm kiếm mobile, đổi kích thước, sáng/tối,
  hướng dẫn tại màn, khóa hết lượt và chuông có toàn mục đã đọc. Không tạo lượt thi, upload hoặc xuất bản trên server dùng chung.

### Triển khai

Chạy [2026-11-14-scorm-completion-rule.sql](E:/corebanking-academy/docs/sql/upgrade/2026-11-14-scorm-completion-rule.sql)
bằng `dev_user` sau migration SCORM 13/11, **trước khi deploy BE**. Sau đó deploy FE cùng bản và đăng nhập lại.
Script thêm cột trên bảng hiện có, không tạo bảng hoặc thay đổi role grant; không hạ tiến độ/chứng nhận đã hoàn thành.
SQL chỉ được thực thi trong database kiểm thử cục bộ trong lượt này.

![Bộ lọc trên điện thoại sau thay đổi](E:/final-mockup/tmp/qa-review-updates-20261114/catalog-mobile.jpg)
