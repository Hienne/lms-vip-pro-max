/* ==========================================================================
   core/types.js — MÔ HÌNH DỮ LIỆU (JSDoc typedef)
   Mỗi typedef = 1 bảng DB (Phần B.XVI đề bài) = 1 interface TypeScript.
   Khi chuyển sang React/Angular: copy sang `models.ts` (đổi @typedef → interface).
   ========================================================================== */

/** @typedef {'learner'|'instructor'|'admin'|'viewer'} Role */
/** @typedef {'active'|'suspended'|'locked'} AccountStatus */
/** @typedef {'draft'|'published'|'paused'|'locked'} PublishStatus */

/**
 * @typedef {Object} Unit            Đơn vị (bảng units)
 * @property {string} id @property {string} code @property {string} name
 * @property {'active'|'paused'} status
 */
/**
 * @typedef {Object} Group           Phòng / nhóm (bảng groups)
 * @property {string} id @property {string} unitId @property {string} name @property {'department'|'team'} kind
 */
/**
 * @typedef {Object} User            Người dùng (bảng users + user_roles)
 * @property {string} id @property {string} email @property {string} name @property {string} staffCode
 * @property {Role} role
 * @property {string} unitId @property {string} groupId
 * @property {string|null} adminScope  null = toàn hệ thống; unitId = quản trị viên đơn vị
 * @property {AccountStatus} status @property {string} joinedAt @property {string|null} lastLoginAt
 * @property {string} title Chức danh
 */
/**
 * @typedef {Object} Domain          Lĩnh vực đào tạo
 * @property {string} id @property {string} code @property {string} name @property {PublishStatus} status @property {string} ownerUnitId
 */
/**
 * @typedef {Object} Program         Chương trình đào tạo
 * @property {string} id @property {string} domainId @property {string} code @property {string} name @property {string} desc @property {PublishStatus} status
 */
/**
 * @typedef {Object} Course          Khóa học
 * @property {string} id @property {string} programId @property {string} code @property {string} title @property {string} desc
 * @property {string} module Phân hệ nghiệp vụ @property {'Cơ bản'|'Trung cấp'|'Nâng cao'} level
 * @property {boolean} required @property {PublishStatus} status @property {string[]} outcomes
 * @property {{lessonsAll:boolean, quizId:string|null}} completion Điều kiện hoàn thành
 * @property {string} ownerUnitId @property {string[]} sharedUnitIds @property {number} rewardPoints
 * @property {string} updatedAt @property {string} cover
 */
/**
 * @typedef {Object} Chapter         Chương
 * @property {string} id @property {string} courseId @property {string} title @property {number} order
 */
/**
 * @typedef {Object} Lesson          Bài học
 * @property {string} id @property {string} courseId @property {string} chapterId @property {string} title
 * @property {number} order @property {number} minutes @property {string|null} quizId
 */
/**
 * @typedef {Object} ContentBlock    Khối nội dung trong bài học
 * @property {string} id @property {string} lessonId @property {number} order
 * @property {'pdf'|'video'|'text'|'process'|'image'|'attachment'} type
 * @property {string} title @property {string|null} fileId @property {Object} data  Nội dung theo loại
 */
/**
 * @typedef {Object} FileAsset       Tệp & đường dẫn tài nguyên (bảng files)
 * @property {string} id @property {string} name @property {string} mime @property {number} size
 * @property {string} url @property {'ok'|'missing'|'scanning'} state @property {string} uploadedBy @property {string} uploadedAt
 */
/**
 * @typedef {Object} Question        Câu hỏi
 * @property {string} id @property {string} code @property {string} text @property {'single'|'multiple'} type
 * @property {{id:string,text:string}[]} options  Phương án trả lời (bảng question_options)
 * @property {string[]} correct  CHỈ server đọc — không trả về client khi đang thi
 * @property {string} explanation @property {'Dễ'|'Trung bình'|'Khó'} difficulty
 * @property {string} domainId @property {string|null} lessonId @property {string} competency
 * @property {'active'|'inactive'} status
 */
/**
 * @typedef {Object} Quiz            Bài kiểm tra
 * @property {string} id @property {string} title @property {string} courseId
 * @property {number} minutes @property {number} questionCount @property {number} passPct
 * @property {number} maxAttempts @property {number} retakeWaitHours
 * @property {boolean} shuffleQuestions @property {boolean} shuffleOptions
 * @property {'manual'|'random'} source @property {string[]} questionIds Pool câu hỏi
 * @property {{competency:string,difficulty:string,count:number}[]} randomRules
 * @property {string} openAt @property {string} closeAt
 * @property {'never'|'after_submit'|'after_pass'|'after_close'} reviewPolicy
 * @property {PublishStatus} status
 */
/**
 * @typedef {Object} Attempt         Lần thi (bảng attempts + attempt_answers)
 * @property {string} id @property {string} quizId @property {string} userId
 * @property {string} startedAt @property {string|null} submittedAt @property {string} deadlineAt
 * @property {string[]} questionIds @property {Object<string,string[]>} answers
 * @property {number|null} score @property {boolean|null} passed @property {number} correctCount
 * @property {Object<string,{c:number,t:number}>} byCompetency @property {boolean} autoSubmitted
 */
/**
 * @typedef {Object} Assignment      Giao khóa học
 * @property {string} id @property {string} courseId
 * @property {'user'|'group'|'unit'} targetType @property {string} targetId
 * @property {string} startAt @property {string} dueAt @property {string} createdBy @property {boolean} remind
 */
/**
 * @typedef {Object} LessonProgress  Tiến độ bài học (bảng progress)
 * @property {string} userId @property {string} lessonId @property {'not_started'|'in_progress'|'completed'} status
 * @property {number} pct @property {number} lastPage @property {number} videoPos @property {number} watchedPct
 * @property {string|null} startedAt @property {string|null} lastAccessAt @property {string|null} completedAt
 */
/**
 * @typedef {Object} Feedback        Đánh giá & bình luận
 * @property {string} id @property {'rating'|'comment'|'question'|'report'} kind
 * @property {string} userId @property {string} lessonId @property {string} text @property {number|null} stars
 * @property {string|null} anchor  Vị trí: "Trang 7" / "12:34"
 * @property {'new'|'answered'|'resolved'|'dismissed'} status
 * @property {{userId:string,text:string,at:string}|null} reply @property {string} createdAt
 */
/**
 * @typedef {Object} AuditLog        Nhật ký hệ thống
 * @property {string} id @property {string} at @property {string} userId @property {string} action @property {string} target @property {string} detail
 */

window.LMS = window.LMS || {};
