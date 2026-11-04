-- Dọn dữ liệu tạo ra trong lúc review UX ngày 2026-11-04 (schema learning_hub).
-- Bảng không có FK (service kiểm tra toàn vẹn), nên thứ tự xoá đi từ con lên cha.
-- Cách chạy: chạy cả file trong một phiên psql. Xem kết quả các SELECT ở phần 0,
-- nếu đúng thì đổi ROLLBACK cuối file thành COMMIT và chạy lại.
--
-- Định danh dùng ở đây:
--   khóa nháp id 15, mã 'REVIEW-0411'
--   đợt giao id 12 (title 'REVIEW-0411', khóa 7), người nhận id 19, học viên '000007'
--   feedback của '000007' trên bài 7 (nhận xét + đánh giá 4 sao)
--   tiến độ khối 10 trong lần học 4 của '000007'
-- Câu hỏi Trợ lý AI (/knowledge/chat/stream) không được lưu vào DB, nên không cần dọn.

BEGIN;

-- ===================== 0. XEM TRƯỚC =====================
SELECT 'course' AS t, course_id, code, lifecycle_status, create_time
  FROM learning_hub.courses WHERE course_id = 15 AND code = 'REVIEW-0411';
SELECT 'revisions' AS t, revision_id, revision_no, state, title
  FROM learning_hub.course_revisions WHERE course_id = 15;
SELECT 'assignment' AS t, assignment_id, course_id, title, status, create_time
  FROM learning_hub.course_assignments WHERE assignment_id = 12 AND title = 'REVIEW-0411';
SELECT 'recipients' AS t, recipient_id, user_id, enrollment_id, status, revoked_at
  FROM learning_hub.assignment_recipients WHERE assignment_id = 12;
-- Lần học sinh ra từ đợt giao. Chỉ xoá nếu origin là assignment và tạo hôm nay.
SELECT 'enrollment' AS t, e.enrollment_id, e.course_id, e.user_id, e.enrollment_origin,
       e.status, e.create_time,
       (SELECT count(*) FROM learning_hub.assignment_recipients r2
         WHERE r2.enrollment_id = e.enrollment_id AND r2.assignment_id <> 12) AS other_recipients
  FROM learning_hub.course_enrollments e
 WHERE e.enrollment_id IN (SELECT enrollment_id FROM learning_hub.assignment_recipients WHERE assignment_id = 12);
SELECT 'feedback' AS t, feedback_id, kind, stars, body, create_time
  FROM learning_hub.lesson_feedback
 WHERE user_id = '000007' AND lesson_id = 7 AND create_time >= DATE '2026-11-04';
SELECT 'block_progress' AS t, block_progress_id, status, progress_percent, create_time, update_time
  FROM learning_hub.block_progress WHERE enrollment_id = 4 AND block_id = 10;
SELECT 'lesson_progress' AS t, lesson_progress_id, status, progress_percent, create_time, update_time
  FROM learning_hub.lesson_progress WHERE enrollment_id = 4 AND lesson_id = 7;
SELECT 'activity_day' AS t, activity_id, activity_date, first_source, create_time
  FROM learning_hub.learning_activity_days WHERE user_id = '000007' AND activity_date = DATE '2026-11-04';
SELECT 'audit' AS t, audit_id, action, entity_type, entity_id, create_time
  FROM learning_hub.audit_log
 WHERE create_time >= DATE '2026-11-04'
   AND ((entity_type ILIKE '%course%' AND entity_id = '15')
     OR (entity_type ILIKE '%assign%' AND entity_id = '12')
     OR details::text LIKE '%REVIEW-0411%');

-- ===================== 1. ĐỢT GIAO 12 =====================
DELETE FROM learning_hub.learning_reminders
 WHERE recipient_id IN (SELECT recipient_id FROM learning_hub.assignment_recipients WHERE assignment_id = 12);
DELETE FROM learning_hub.recipient_target_sources
 WHERE recipient_id IN (SELECT recipient_id FROM learning_hub.assignment_recipients WHERE assignment_id = 12);

-- Lần học do đợt giao tạo (chỉ khi không có đợt giao khác dùng chung và tạo hôm nay)
CREATE TEMP TABLE tmp_enr ON COMMIT DROP AS
SELECT e.enrollment_id
  FROM learning_hub.course_enrollments e
 WHERE e.enrollment_id IN (SELECT enrollment_id FROM learning_hub.assignment_recipients WHERE assignment_id = 12)
   AND e.enrollment_origin ILIKE 'assign%'
   AND e.create_time >= DATE '2026-11-04'
   AND NOT EXISTS (SELECT 1 FROM learning_hub.assignment_recipients r2
                    WHERE r2.enrollment_id = e.enrollment_id AND r2.assignment_id <> 12);
DELETE FROM learning_hub.video_watch_ranges
 WHERE block_progress_id IN (SELECT block_progress_id FROM learning_hub.block_progress
                              WHERE enrollment_id IN (SELECT enrollment_id FROM tmp_enr));
DELETE FROM learning_hub.block_progress  WHERE enrollment_id IN (SELECT enrollment_id FROM tmp_enr);
DELETE FROM learning_hub.lesson_progress WHERE enrollment_id IN (SELECT enrollment_id FROM tmp_enr);

DELETE FROM learning_hub.assignment_recipients WHERE assignment_id = 12;
DELETE FROM learning_hub.course_enrollments WHERE enrollment_id IN (SELECT enrollment_id FROM tmp_enr);
DELETE FROM learning_hub.assignment_targets WHERE assignment_id = 12;
DELETE FROM learning_hub.course_assignments WHERE assignment_id = 12 AND title = 'REVIEW-0411';

-- ===================== 2. KHÓA NHÁP 15 =====================
CREATE TEMP TABLE tmp_rev ON COMMIT DROP AS
SELECT revision_id FROM learning_hub.course_revisions
 WHERE course_id IN (SELECT course_id FROM learning_hub.courses WHERE course_id = 15 AND code = 'REVIEW-0411');

DELETE FROM learning_hub.block_assets
 WHERE block_id IN (SELECT b.block_id FROM learning_hub.lesson_blocks b
                      JOIN learning_hub.course_lessons l ON l.lesson_id = b.lesson_id
                      JOIN learning_hub.course_chapters c ON c.chapter_id = l.chapter_id
                     WHERE c.revision_id IN (SELECT revision_id FROM tmp_rev));
DELETE FROM learning_hub.lesson_blocks
 WHERE lesson_id IN (SELECT l.lesson_id FROM learning_hub.course_lessons l
                       JOIN learning_hub.course_chapters c ON c.chapter_id = l.chapter_id
                      WHERE c.revision_id IN (SELECT revision_id FROM tmp_rev));
DELETE FROM learning_hub.course_lessons
 WHERE chapter_id IN (SELECT chapter_id FROM learning_hub.course_chapters
                       WHERE revision_id IN (SELECT revision_id FROM tmp_rev));
DELETE FROM learning_hub.course_chapters         WHERE revision_id IN (SELECT revision_id FROM tmp_rev);
DELETE FROM learning_hub.course_objectives       WHERE revision_id IN (SELECT revision_id FROM tmp_rev);
DELETE FROM learning_hub.course_completion_rules WHERE revision_id IN (SELECT revision_id FROM tmp_rev);
DELETE FROM learning_hub.course_revisions        WHERE revision_id IN (SELECT revision_id FROM tmp_rev);
DELETE FROM learning_hub.course_shares           WHERE course_id = 15;
DELETE FROM learning_hub.courses                 WHERE course_id = 15 AND code = 'REVIEW-0411';

-- ===================== 3. NHẬN XÉT + ĐÁNH GIÁ BÀI 7 =====================
DELETE FROM learning_hub.lesson_feedback
 WHERE user_id = '000007' AND lesson_id = 7 AND create_time >= DATE '2026-11-04'
   AND ((kind = 'comment' AND body = 'REVIEW-0411 test nhận xét bài học')
     OR (kind = 'rating'  AND stars = 4));

-- ===================== 4. TIẾN ĐỘ KHỐI 10 + NGÀY HỌC (tuỳ chọn) =====================
-- Chỉ xoá khi dòng được tạo hôm nay (trước đó chưa có tiến độ). Nếu dòng có từ trước,
-- câu lệnh không làm gì và phải sửa tay theo kết quả SELECT ở phần 0.
DELETE FROM learning_hub.video_watch_ranges
 WHERE block_progress_id IN (SELECT block_progress_id FROM learning_hub.block_progress
                              WHERE enrollment_id = 4 AND block_id = 10 AND create_time >= DATE '2026-11-04');
DELETE FROM learning_hub.block_progress
 WHERE enrollment_id = 4 AND block_id = 10 AND create_time >= DATE '2026-11-04';
-- lesson_progress của bài 7 và course_enrollments.progress_percent của lần học 4 không tự tính lại.
-- Nếu cần, xoá lesson_progress tạo hôm nay rồi để backend tính lại ở lần truy cập sau:
-- DELETE FROM learning_hub.lesson_progress
--  WHERE enrollment_id = 4 AND lesson_id = 7 AND create_time >= DATE '2026-11-04';

-- Ngày học 2026-11-04 của 000007 (đẩy chuỗi ngày lên). Bảng chỉ thêm, không sửa.
DELETE FROM learning_hub.learning_activity_days
 WHERE user_id = '000007' AND activity_date = DATE '2026-11-04';

-- ===================== 5. AUDIT LOG (tuỳ chọn) =====================
-- Nhật ký hệ thống thường nên giữ. Bỏ comment nếu muốn xoá dấu vết test.
-- DELETE FROM learning_hub.audit_log
--  WHERE create_time >= DATE '2026-11-04'
--    AND ((entity_type ILIKE '%course%' AND entity_id = '15')
--      OR (entity_type ILIKE '%assign%' AND entity_id = '12')
--      OR details::text LIKE '%REVIEW-0411%');

ROLLBACK;  -- đổi thành COMMIT sau khi đã kiểm tra kết quả phần 0
