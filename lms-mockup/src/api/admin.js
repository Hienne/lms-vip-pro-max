/* ==========================================================================
   api/admin.js — AdminService / ContentService / InstructorService
   Kiểm tra quyền + phạm vi đơn vị cho MỌI thao tác (chống vượt quyền qua URL).
   ========================================================================== */
(function (LMS) {
  const C = LMS.apiCore;
  const { call, E, byId, audit } = C;
  const nowIso = () => new Date().toISOString();
  const STATUS_TEXT = { draft: 'Nháp', published: 'Đã xuất bản', paused: 'Tạm dừng', locked: 'Đã khóa' };

  function ownCourse(u, c) {
    if (!c) throw E.notFound('Khóa học');
    const s = C.unitScope(u);
    if (u.role === 'admin' && s != null && c.ownerUnitId !== s) throw E.forbidden(`chỉnh sửa khóa học thuộc đơn vị khác (phạm vi của bạn: ${byId(LMS.store.db.units, s).name})`);
  }
  const required = (obj, fields) => { const errs = {}; fields.forEach(([k, label]) => { if (!String(obj[k] ?? '').trim()) errs[k] = `${label} là bắt buộc.`; }); return errs; };
  const fail = (errs) => { if (Object.keys(errs).length) throw E.invalid('Vui lòng kiểm tra lại các trường được đánh dấu.', errs); };

  LMS.api.admin = {
    /* ================= Tổng quan ================= */
    overview: () => call((db) => {
      const u = C.require('reports.read', 'xem tổng quan quản trị');
      const s = C.unitScope(u);
      const learners = db.users.filter((x) => x.role === 'learner' && (s == null || x.unitId === s));
      const pairs = []; learners.forEach((l) => C.myCourseIds(l).forEach((cid) => pairs.push(C.courseProgress(l.id, cid))));
      const atts = db.attempts.filter((a) => a.submittedAt && learners.some((l) => l.id === a.userId));
      return {
        scope: s ? byId(db.units, s).name : 'Toàn hệ thống',
        kpi: { learners: learners.length, active: learners.filter((l) => l.status === 'active').length, completion: pairs.length ? Math.round(pairs.reduce((a, p) => a + p.pct, 0) / pairs.length) : 0, overdue: pairs.filter((p) => p.overdue).length, avgScore: atts.length ? Math.round(atts.reduce((a, b) => a + b.score, 0) / atts.length) : 0, passRate: atts.length ? Math.round((atts.filter((a) => a.passed).length / atts.length) * 100) : 0, courses: db.courses.filter((c) => c.status === 'published').length, drafts: db.courses.filter((c) => c.status === 'draft').length },
        byGroup: db.groups.filter((g) => s == null || g.unitId === s).map((g) => { const gl = learners.filter((l) => l.groupId === g.id); const gp = []; gl.forEach((l) => C.myCourseIds(l).forEach((cid) => gp.push(C.courseProgress(l.id, cid)))); return { id: g.id, name: g.name, pct: gp.length ? Math.round(gp.reduce((a, p) => a + p.pct, 0) / gp.length) : 0, learners: gl.length, overdue: gp.filter((p) => p.overdue).length }; }),
        attention: [
          ...learners.map((l) => ({ l, ps: C.myCourseIds(l).map((cid) => C.courseProgress(l.id, cid)) })).filter((x) => x.ps.some((p) => p.overdue)).map((x) => ({ kind: 'overdue', text: `${x.l.name} có ${x.ps.filter((p) => p.overdue).length} khóa quá hạn`, href: `#/admin/users/${x.l.id}` })),
          ...db.feedback.filter((f) => f.kind === 'report' && f.status === 'new').map((f) => ({ kind: 'report', text: `Báo cáo nội dung: "${f.text}"`, href: '#/instructor/inbox?kind=report' })),
          ...db.files.filter((f) => f.state === 'missing').map((f) => ({ kind: 'file', text: `Tệp "${f.name}" bị thiếu hoặc lỗi`, href: '#/admin/system?tab=files' })),
        ].slice(0, 6),
        recent: db.audit.slice(0, 6).map((a) => ({ ...a, userName: (byId(db.users, a.userId) || {}).name })),
      };
    }),

    /* ================= Cây nội dung ================= */
    tree: () => call((db) => {
      C.require('content.write', 'quản lý cây nội dung');
      return db.domains.map((d) => ({ ...d, type: 'domain', children: db.programs.filter((p) => p.domainId === d.id).map((p) => ({ ...p, type: 'program', children: db.courses.filter((c) => c.programId === p.id).map((c) => ({ id: c.id, name: c.title, code: c.code, status: c.status, type: 'course', ownerUnitId: c.ownerUnitId })) })) }));
    }),
    saveNode: (type, data) => call((db) => {
      const u = C.require('content.write', 'sửa lĩnh vực/chương trình');
      const table = type === 'domain' ? db.domains : db.programs;
      fail(required(data, [['name', 'Tên'], ['code', 'Mã']]));
      if (table.some((x) => x.code.toLowerCase() === data.code.trim().toLowerCase() && x.id !== data.id)) fail({ code: 'Mã đã tồn tại.' });
      if (data.id) { const ex = byId(table, data.id); if (!ex) throw E.notFound(); Object.assign(ex, { name: data.name.trim(), code: data.code.trim(), desc: data.desc || ex.desc || '' }); audit(u.id, 'update', `${type === 'domain' ? 'Lĩnh vực' : 'Chương trình'} ${data.code}`, 'Cập nhật thông tin'); return ex; }
      const rec = type === 'domain' ? { id: LMS.uid('d'), code: data.code.trim(), name: data.name.trim(), status: 'draft', ownerUnitId: u.unitId } : { id: LMS.uid('p'), domainId: data.domainId, code: data.code.trim(), name: data.name.trim(), desc: data.desc || '', status: 'draft' };
      table.push(rec); audit(u.id, 'create', `${type === 'domain' ? 'Lĩnh vực' : 'Chương trình'} ${rec.code}`, 'Tạo mới'); return rec;
    }, { write: true }),
    setStatus: (type, id, status) => call((db) => {
      const u = C.require('content.write', 'đổi trạng thái');
      const table = { domain: db.domains, program: db.programs, course: db.courses }[type];
      const rec = byId(table, id); if (!rec) throw E.notFound();
      if (type === 'course') ownCourse(u, rec);
      if (type === 'course' && status === 'published') { const ls = C.lessonsOf(id); if (!ls.length) throw E.invalid('Khóa học cần ít nhất 1 bài học trước khi xuất bản.'); }
      rec.status = status; if (type === 'course') rec.updatedAt = nowIso();
      audit(u.id, status === 'published' ? 'publish' : status, `${type} ${rec.code}`, `Đổi trạng thái → ${STATUS_TEXT[status]}`);
      return rec;
    }, { write: true }),
    duplicate: (type, id) => call((db) => {
      const u = C.require('content.write', 'sao chép');
      if (type === 'program') {
        const p = byId(db.programs, id); if (!p) throw E.notFound();
        const np = { ...p, id: LMS.uid('p'), code: p.code + '-COPY', name: p.name + ' (bản sao)', status: 'draft' }; db.programs.push(np);
        db.courses.filter((c) => c.programId === id).forEach((c) => copyCourse(db, c, np.id));
        audit(u.id, 'copy', `Chương trình ${p.code}`, 'Sao chép kèm khóa học'); return np;
      }
      const c = byId(db.courses, id); ownCourse(u, c);
      const nc = copyCourse(db, c, c.programId); audit(u.id, 'copy', `Khóa học ${c.code}`, `Sao chép thành ${nc.code}`); return nc;
    }, { write: true }),
    deleteNode: (type, id) => call((db) => {
      const u = C.require('content.write', 'xóa');
      if (type === 'domain' && db.programs.some((p) => p.domainId === id)) throw E.invalid('Không thể xóa lĩnh vực còn chương trình. Hãy chuyển hoặc xóa chương trình trước.');
      if (type === 'program' && db.courses.some((c) => c.programId === id)) throw E.invalid('Không thể xóa chương trình còn khóa học. Hãy tạm dừng thay vì xóa.');
      if (type === 'course') { const c = byId(db.courses, id); ownCourse(u, c); if (db.progress.some((p) => (byId(db.lessons, p.lessonId) || {}).courseId === id)) throw E.invalid('Khóa học đã có học viên tham gia — chỉ có thể Tạm dừng hoặc Khóa để giữ lịch sử.'); }
      const table = { domain: db.domains, program: db.programs, course: db.courses }[type];
      const i = table.findIndex((x) => x.id === id); if (i < 0) throw E.notFound(); const [rec] = table.splice(i, 1);
      audit(u.id, 'delete', `${type} ${rec.code}`, 'Xóa'); return true;
    }, { write: true }),

    /* ================= Khóa học ================= */
    courses: () => call((db) => {
      const u = C.require('content.write', 'quản lý khóa học');
      const s = C.unitScope(u);
      return db.courses.map((c) => { const p = byId(db.programs, c.programId); const learners = new Set(); db.users.filter((x) => x.role === 'learner').forEach((x) => { if (C.assignmentFor(x, c.id)) learners.add(x.id); }); return { id: c.id, code: c.code, title: c.title, status: c.status, required: c.required, level: c.level, module: c.module, program: p ? p.name : '—', programId: c.programId, domainId: p ? p.domainId : null, lessons: C.lessonsOf(c.id).length, learners: learners.size, updatedAt: c.updatedAt, ownerUnitId: c.ownerUnitId, editable: s == null || c.ownerUnitId === s, shared: (c.sharedUnitIds || []).map((id) => (byId(db.units, id) || {}).name) }; });
    }),
    courseFull: (id) => call((db) => {
      const u = C.require('content.write', 'sửa khóa học');
      const c = byId(db.courses, id); ownCourse(u, c);
      const chapters = db.chapters.filter((ch) => ch.courseId === id).sort((a, b) => a.order - b.order).map((ch) => ({ ...ch, lessons: db.lessons.filter((l) => l.chapterId === ch.id).sort((a, b) => a.order - b.order).map((l) => ({ ...l, blocks: db.blocks.filter((b) => b.lessonId === l.id).sort((a, b) => a.order - b.order).map((b) => ({ ...b, file: b.fileId ? byId(db.files, b.fileId) : null, files: b.type === 'attachment' ? (b.data.items || []).map((fid) => byId(db.files, fid)).filter(Boolean) : null })) })) }));
      return { course: c, chapters, assignments: db.assignments.filter((a) => a.courseId === id) };
    }),
    meta: () => call((db) => { const u = C.requireUser(); const s = C.unitScope(u); return { domains: db.domains, programs: db.programs, modules: db.modules, competencies: db.competencies, units: db.units.filter((x) => s == null || x.id === s || u.role !== 'admin'), allUnits: db.units, groups: db.groups.filter((g) => s == null || g.unitId === s || u.role !== 'admin'), quizzes: db.quizzes.map((q) => ({ id: q.id, title: q.title, courseId: q.courseId })), settings: db.settings, users: db.users.filter((x) => x.role === 'learner' && (s == null || x.unitId === s)).map((x) => ({ id: x.id, name: x.name, email: x.email, unitId: x.unitId, groupId: x.groupId })), lessons: db.lessons.map((l) => ({ id: l.id, title: l.title, courseId: l.courseId })) }; }, { latency: [60, 120] }),

    /** Lưu khóa học từ wizard (tạo mới hoặc cập nhật), kèm chương/bài/khối */
    saveCourse: (draft, { publish = false } = {}) => call((db) => {
      const u = C.require('content.write', 'lưu khóa học');
      const c0 = draft.course;
      fail(required(c0, [['title', 'Tên khóa học'], ['code', 'Mã khóa học'], ['programId', 'Chương trình']]));
      if (db.courses.some((x) => x.code.toLowerCase() === c0.code.trim().toLowerCase() && x.id !== c0.id)) fail({ code: 'Mã khóa học đã tồn tại.' });
      let c = c0.id && byId(db.courses, c0.id);
      if (c) ownCourse(u, c);
      if (!c) { c = { id: LMS.uid('c'), ownerUnitId: C.unitScope(u) || u.unitId, sharedUnitIds: [], status: 'draft', cover: 'layers', completion: { lessonsAll: true, quizId: null }, rewardPoints: 50 }; db.courses.push(c); }
      Object.assign(c, { programId: c0.programId, code: c0.code.trim(), title: c0.title.trim(), desc: c0.desc || '', module: c0.module || 'Tổng quan', level: c0.level || 'Cơ bản', required: !!c0.required, outcomes: (c0.outcomes || []).filter((x) => x.trim()), rewardPoints: +c0.rewardPoints || 0, completion: { lessonsAll: true, quizId: c0.quizId || null }, sharedUnitIds: c0.sharedUnitIds || c.sharedUnitIds, updatedAt: nowIso() });
      // Thay thế cấu trúc chương/bài/khối theo bản nháp (giữ id cũ để không mất tiến độ)
      const keepCh = new Set(), keepL = new Set(), keepB = new Set();
      (draft.chapters || []).forEach((ch, ci) => {
        let rec = ch.id && byId(db.chapters, ch.id);
        if (!rec) { rec = { id: LMS.uid('ch'), courseId: c.id }; db.chapters.push(rec); }
        Object.assign(rec, { title: ch.title || `Chương ${ci + 1}`, order: ci + 1 }); keepCh.add(rec.id);
        (ch.lessons || []).forEach((l, li) => {
          let lr = l.id && byId(db.lessons, l.id);
          if (!lr) { lr = { id: LMS.uid('ls'), courseId: c.id }; db.lessons.push(lr); }
          Object.assign(lr, { chapterId: rec.id, title: l.title || `Bài ${li + 1}`, order: li + 1, minutes: +l.minutes || 10, quizId: l.quizId || null }); keepL.add(lr.id);
          (l.blocks || []).forEach((b, bi) => {
            let br = b.id && byId(db.blocks, b.id);
            if (!br) { br = { id: LMS.uid('b'), lessonId: lr.id }; db.blocks.push(br); }
            let fileId = b.fileId || null;
            if (b.newFile) { const f = { id: LMS.uid('f'), name: b.newFile.name, mime: b.newFile.mime, size: b.newFile.size, url: `/storage/${b.newFile.name}`, state: 'ok', uploadedBy: u.id, uploadedAt: nowIso() }; db.files.push(f); fileId = f.id; audit(u.id, 'upload', `Tệp ${f.name}`, `Tải lên ${LMS.fmt.bytes(f.size)}`); }
            const data = b.type === 'attachment' && fileId ? { items: [...new Set([...((b.data || {}).items || []), fileId])] } : (b.data || {});
            Object.assign(br, { lessonId: lr.id, order: bi + 1, type: b.type, title: b.title || '', fileId: b.type === 'attachment' ? null : fileId, data }); keepB.add(br.id);
          });
        });
      });
      db.chapters = db.chapters.filter((x) => x.courseId !== c.id || keepCh.has(x.id));
      const removedL = db.lessons.filter((x) => x.courseId === c.id && !keepL.has(x.id)).map((x) => x.id);
      db.lessons = db.lessons.filter((x) => !removedL.includes(x.id));
      db.blocks = db.blocks.filter((x) => !(removedL.includes(x.lessonId)) && (!db.lessons.some((l) => l.id === x.lessonId && l.courseId === c.id) || keepB.has(x.id)));
      // Giao học (bước 4)
      (draft.newAssignments || []).forEach((a) => { if (!a.targetId) return; db.assignments.push({ id: LMS.uid('as'), courseId: c.id, targetType: a.targetType, targetId: a.targetId, startAt: a.startAt || nowIso(), dueAt: a.dueAt, createdBy: u.id, remind: a.remind !== false }); });
      if (publish) {
        const issues = publishIssues(db, c.id);
        if (issues.length) throw E.invalid('Chưa thể xuất bản: ' + issues.join('; '));
        c.status = 'published';
        db.users.filter((x) => x.role === 'learner' && C.assignmentFor(x, c.id)).forEach((x) => C.notify(x.id, 'assigned', `Bạn được giao khóa "${c.title}".`, `#/course/${c.id}`));
      }
      audit(u.id, publish ? 'publish' : (c0.id ? 'update' : 'create'), `Khóa học ${c.code}`, publish ? 'Xuất bản' : 'Lưu nháp');
      return { id: c.id, status: c.status };
    }, { write: true }),
    publishCheck: (courseId) => call((db) => { C.require('content.write'); return publishIssues(db, courseId); }),

    /* ================= Ngân hàng câu hỏi ================= */
    questions: () => call((db) => {
      C.require('question.write', 'quản lý ngân hàng câu hỏi');
      return db.questions.map((q) => ({ ...q, usedIn: db.quizzes.filter((z) => z.questionIds.includes(q.id)).map((z) => z.title), lessonTitle: (byId(db.lessons, q.lessonId) || {}).title || '—', domainName: (byId(db.domains, q.domainId) || {}).name || '—' }));
    }),
    saveQuestion: (q) => call((db) => {
      const u = C.require('question.write', 'lưu câu hỏi');
      const errs = required(q, [['text', 'Nội dung câu hỏi'], ['domainId', 'Lĩnh vực'], ['competency', 'Nhóm kiến thức']]);
      const opts = (q.options || []).filter((o) => String(o.text || '').trim());
      if (opts.length < 2) errs.options = 'Cần ít nhất 2 phương án có nội dung.';
      const corr = (q.correct || []).filter((id) => opts.some((o) => o.id === id));
      if (!corr.length) errs.correct = 'Chọn ít nhất 1 đáp án đúng.';
      else if (q.type === 'single' && corr.length !== 1) errs.correct = 'Câu một đáp án chỉ được có đúng 1 đáp án đúng.';
      else if (q.type === 'multiple' && corr.length < 2) errs.correct = 'Câu nhiều đáp án cần ít nhất 2 đáp án đúng.';
      const code = String(q.code || '').trim();
      if (code && db.questions.some((x) => x.code === code && x.id !== q.id)) errs.code = 'Mã câu hỏi đã tồn tại.';
      fail(errs);
      let rec = q.id && byId(db.questions, q.id);
      if (!rec) { rec = { id: LMS.uid('qs') }; db.questions.push(rec); }
      Object.assign(rec, { code: code || `CH-${String(db.questions.length).padStart(3, '0')}`, text: q.text.trim(), type: q.type, options: opts.map((o) => ({ id: o.id, text: o.text.trim() })), correct: corr, explanation: q.explanation || '', difficulty: q.difficulty || 'Trung bình', domainId: q.domainId, lessonId: q.lessonId || null, competency: q.competency, status: q.status || 'active', updatedAt: nowIso() });
      audit(u.id, q.id ? 'update' : 'create', `Câu hỏi ${rec.code}`, q.id ? 'Cập nhật' : 'Tạo mới');
      return rec;
    }, { write: true }),
    bulkQuestions: (ids, action) => call((db) => {
      const u = C.require('question.write', 'thao tác hàng loạt');
      if (action === 'delete') {
        const used = ids.filter((id) => db.quizzes.some((z) => z.questionIds.includes(id)));
        if (used.length) throw E.invalid(`${used.length} câu đang được dùng trong bài kiểm tra — chỉ có thể "Ngưng sử dụng".`);
        db.questions = db.questions.filter((q) => !ids.includes(q.id));
      } else db.questions.filter((q) => ids.includes(q.id)).forEach((q) => (q.status = action));
      audit(u.id, 'bulk', `${ids.length} câu hỏi`, action === 'delete' ? 'Xóa' : `Đổi trạng thái → ${action === 'active' ? 'Đang dùng' : 'Ngưng'}`);
      return ids.length;
    }, { write: true }),

    /* ================= Bài kiểm tra ================= */
    quizzes: () => call((db) => { C.require('content.write', 'quản lý bài kiểm tra'); return db.quizzes.map((q) => ({ ...q, course: (byId(db.courses, q.courseId) || {}).title, attempts: db.attempts.filter((a) => a.quizId === q.id && a.submittedAt).length, passRate: (() => { const l = db.attempts.filter((a) => a.quizId === q.id && a.submittedAt); return l.length ? Math.round((l.filter((a) => a.passed).length / l.length) * 100) : null; })() })); }),
    quiz: (id) => call((db) => { C.require('content.write'); const q = byId(db.quizzes, id); if (!q) throw E.notFound('Bài kiểm tra'); return q; }),
    saveQuiz: (q) => call((db) => {
      const u = C.require('content.write', 'cấu hình bài kiểm tra');
      const errs = required(q, [['title', 'Tên bài kiểm tra'], ['courseId', 'Khóa học']]);
      const n = (k, label, min, max) => { const v = Number(q[k]); if (!Number.isFinite(v) || v < min || v > max) errs[k] = `${label} phải từ ${min} đến ${max}.`; };
      n('minutes', 'Thời gian', 1, 240); n('questionCount', 'Số câu', 1, 200); n('passPct', 'Điểm đạt', 1, 100); n('maxAttempts', 'Số lần thi', 1, 20); n('retakeWaitHours', 'Thời gian chờ', 0, 720);
      const pool = (q.questionIds || []).filter((id) => (byId(db.questions, id) || {}).status === 'active');
      if (!pool.length) errs.questionIds = 'Chọn ít nhất 1 câu hỏi đang dùng.';
      else if (Number(q.questionCount) > pool.length) errs.questionCount = `Ngân hàng chỉ có ${pool.length} câu đang dùng — giảm số câu hoặc bổ sung câu hỏi.`;
      if (q.openAt && q.closeAt && new Date(q.openAt) >= new Date(q.closeAt)) errs.closeAt = 'Thời gian đóng phải sau thời gian mở.';
      fail(errs);
      let rec = q.id && byId(db.quizzes, q.id);
      if (!rec) { rec = { id: LMS.uid('q'), status: 'published', randomRules: [] }; db.quizzes.push(rec); }
      Object.assign(rec, { title: q.title.trim(), courseId: q.courseId, minutes: +q.minutes, questionCount: +q.questionCount, passPct: +q.passPct, maxAttempts: +q.maxAttempts, retakeWaitHours: +q.retakeWaitHours, shuffleQuestions: !!q.shuffleQuestions, shuffleOptions: !!q.shuffleOptions, source: q.source, questionIds: q.questionIds, openAt: q.openAt, closeAt: q.closeAt, reviewPolicy: q.reviewPolicy });
      audit(u.id, 'update', `Bài kiểm tra "${rec.title}"`, `Thời gian ${rec.minutes}p · ${rec.questionCount} câu · đạt ${rec.passPct}% · ${rec.maxAttempts} lượt`);
      return rec;
    }, { write: true }),

    /* ================= Nhập dữ liệu hàng loạt ================= */
    previewImport: (type, text) => call((db) => {
      C.require(type === 'questions' ? 'question.write' : 'users.manage', 'nhập dữ liệu');
      const rows = parseCSV(text);
      if (!rows.length) throw E.invalid('Tệp không có dữ liệu. Hãy dùng đúng tệp mẫu.');
      const head = rows.shift().map((h) => h.trim().toLowerCase());
      const need = type === 'questions' ? ['ma', 'noi_dung', 'loai', 'phuong_an', 'dap_an_dung', 'giai_thich', 'do_kho', 'nhom_kien_thuc'] : type === 'users' ? ['ho_ten', 'email', 'don_vi', 'nhom', 'vai_tro'] : ['ma_don_vi', 'ten_don_vi', 'ten_nhom'];
      const missing = need.filter((h) => !head.includes(h));
      if (missing.length) throw E.invalid(`Thiếu cột: ${missing.join(', ')}. Hãy tải tệp mẫu.`);
      const get = (r, k) => (r[head.indexOf(k)] || '').trim();
      const seen = new Set();
      return rows.filter((r) => r.some((c) => c.trim())).map((r, i) => {
        const errs = []; let rec;
        if (type === 'questions') {
          const opts = get(r, 'phuong_an').split('|').map((x) => x.trim()).filter(Boolean);
          const corr = get(r, 'dap_an_dung').split('|').map((x) => x.trim().toUpperCase()).filter(Boolean);
          const kind = get(r, 'loai').toLowerCase();
          const code = get(r, 'ma');
          if (!get(r, 'noi_dung')) errs.push('Thiếu nội dung');
          if (!['single', 'multiple', 'mot', 'nhieu'].includes(kind)) errs.push('Loại phải là "mot" hoặc "nhieu"');
          if (opts.length < 2) errs.push('Cần ≥ 2 phương án (phân tách bằng |)');
          if (!corr.length || corr.some((c) => c.charCodeAt(0) - 65 >= opts.length)) errs.push('Đáp án đúng không hợp lệ (A|B…)');
          if ((kind === 'mot' || kind === 'single') && corr.length !== 1) errs.push('Câu một đáp án chỉ có 1 đáp án đúng');
          if (!db.competencies.includes(get(r, 'nhom_kien_thuc'))) errs.push('Nhóm kiến thức không tồn tại');
          const dup = code && (db.questions.some((q) => q.code === code) || seen.has(code)); if (code) seen.add(code);
          rec = { code, text: get(r, 'noi_dung'), type: kind === 'nhieu' || kind === 'multiple' ? 'multiple' : 'single', options: opts, correct: corr, explanation: get(r, 'giai_thich'), difficulty: get(r, 'do_kho') || 'Trung bình', competency: get(r, 'nhom_kien_thuc'), duplicate: !!dup };
        } else if (type === 'users') {
          const email = get(r, 'email').toLowerCase();
          if (!get(r, 'ho_ten')) errs.push('Thiếu họ tên');
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.push('Email không hợp lệ');
          const unit = db.units.find((x) => x.code.toLowerCase() === get(r, 'don_vi').toLowerCase() || x.name.toLowerCase() === get(r, 'don_vi').toLowerCase());
          if (!unit) errs.push(`Đơn vị "${get(r, 'don_vi')}" chưa có — tạo đơn vị trước`);
          const group = unit && db.groups.find((g) => g.unitId === unit.id && g.name.toLowerCase() === get(r, 'nhom').toLowerCase());
          if (unit && get(r, 'nhom') && !group) errs.push(`Nhóm "${get(r, 'nhom')}" không thuộc đơn vị`);
          const role = { 'hoc_vien': 'learner', 'giang_vien': 'instructor', 'quan_tri': 'admin', 'lanh_dao': 'viewer' }[get(r, 'vai_tro').toLowerCase()];
          if (!role) errs.push('Vai trò: hoc_vien | giang_vien | quan_tri | lanh_dao');
          const dup = db.users.some((x) => x.email === email) || seen.has(email); seen.add(email);
          rec = { name: get(r, 'ho_ten'), email, unitId: unit && unit.id, unitName: unit ? unit.name : get(r, 'don_vi'), groupId: group && group.id, groupName: get(r, 'nhom'), role, duplicate: dup };
        } else {
          if (!get(r, 'ma_don_vi') || !get(r, 'ten_don_vi')) errs.push('Thiếu mã hoặc tên đơn vị');
          rec = { code: get(r, 'ma_don_vi'), name: get(r, 'ten_don_vi'), group: get(r, 'ten_nhom'), duplicate: db.units.some((x) => x.code === get(r, 'ma_don_vi')) && !get(r, 'ten_nhom') };
        }
        return { line: i + 2, ok: !errs.length, errors: errs, data: rec };
      });
    }, { latency: [500, 800] }),
    commitImport: (type, rows, { overwrite = false } = {}) => call((db) => {
      const u = C.require(type === 'questions' ? 'question.write' : 'users.manage', 'nhập dữ liệu');
      let added = 0, updated = 0, skipped = 0;
      rows.filter((r) => r.ok).forEach((r) => {
        const d = r.data;
        if (type === 'questions') {
          const options = d.options.map((t, i) => ({ id: LMS.uid('o'), text: t }));
          const correct = d.correct.map((c) => options[c.charCodeAt(0) - 65].id);
          const ex = d.code && db.questions.find((q) => q.code === d.code);
          if (ex && !overwrite) { skipped++; return; }
          const rec = { code: d.code || `IMP-${String(db.questions.length + 1).padStart(3, '0')}`, text: d.text, type: d.type, options, correct, explanation: d.explanation, difficulty: d.difficulty, domainId: 'd1', lessonId: null, competency: d.competency, status: 'active', updatedAt: nowIso() };
          if (ex) { Object.assign(ex, rec); updated++; } else { db.questions.push({ id: LMS.uid('qs'), ...rec }); added++; }
        } else if (type === 'users') {
          if (C.unitScope(u) && d.unitId !== C.unitScope(u)) { skipped++; return; }
          const ex = db.users.find((x) => x.email === d.email);
          if (ex && !overwrite) { skipped++; return; }
          const rec = { name: d.name, email: d.email, role: d.role, unitId: d.unitId, groupId: d.groupId || db.groups.find((g) => g.unitId === d.unitId).id };
          if (ex) { Object.assign(ex, rec); updated++; } else { db.users.push({ id: LMS.uid('u'), staffCode: 'CB' + (2000 + db.users.length), title: 'Cán bộ', adminScope: null, status: 'active', joinedAt: nowIso(), lastLoginAt: null, ...rec }); added++; }
        } else {
          let unit = db.units.find((x) => x.code === d.code);
          if (!unit) { unit = { id: LMS.uid('u'), code: d.code, name: d.name, status: 'active' }; db.units.push(unit); added++; }
          if (d.group && !db.groups.some((g) => g.unitId === unit.id && g.name === d.group)) { db.groups.push({ id: LMS.uid('g'), unitId: unit.id, name: d.group, kind: 'team' }); added++; }
        }
      });
      audit(u.id, 'import', { questions: 'Ngân hàng câu hỏi', users: 'Người dùng', org: 'Đơn vị/nhóm' }[type], `Thêm ${added}, cập nhật ${updated}, bỏ qua ${skipped}`);
      return { added, updated, skipped, failed: rows.filter((r) => !r.ok).length };
    }, { write: true, latency: [600, 900] }),

    /* ================= Người dùng ================= */
    users: () => call((db) => {
      const u = C.require('users.manage', 'quản lý người dùng');
      return db.users.filter((x) => C.inScope(u, x.unitId)).map((x) => ({ ...x, unitName: (byId(db.units, x.unitId) || {}).name, groupName: (byId(db.groups, x.groupId) || {}).name }));
    }),
    user: (id) => call((db) => {
      const u = C.require('users.manage', 'xem người dùng');
      const x = byId(db.users, id); if (!x) throw E.notFound('Người dùng');
      if (!C.inScope(u, x.unitId)) throw E.forbidden('xem người dùng thuộc đơn vị khác');
      const courses = C.myCourseIds(x).map((cid) => { const c = byId(db.courses, cid); return { id: cid, title: c.title, code: c.code, required: c.required, ...C.courseProgress(x.id, cid), states: undefined }; });
      return { user: { ...x, unitName: (byId(db.units, x.unitId) || {}).name, groupName: (byId(db.groups, x.groupId) || {}).name }, courses, attempts: db.attempts.filter((a) => a.userId === id && a.submittedAt).map((a) => ({ id: a.id, title: byId(db.quizzes, a.quizId).title, score: a.score, passed: a.passed, at: a.submittedAt })).sort((a, b) => b.at.localeCompare(a.at)), competency: C.competency(id), perms: C.PERMS[x.role], audit: db.audit.filter((a) => a.userId === id).slice(0, 8) };
    }),
    saveUser: (data) => call((db) => {
      const u = C.require('users.manage', 'lưu người dùng');
      const errs = required(data, [['name', 'Họ tên'], ['email', 'Email'], ['unitId', 'Đơn vị'], ['groupId', 'Phòng/nhóm'], ['role', 'Vai trò']]);
      if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) errs.email = 'Email không đúng định dạng.';
      if (db.users.some((x) => x.email.toLowerCase() === String(data.email).toLowerCase() && x.id !== data.id)) errs.email = 'Email đã được dùng cho tài khoản khác.';
      fail(errs);
      if (!C.inScope(u, data.unitId)) throw E.forbidden('tạo/sửa người dùng ngoài đơn vị bạn quản lý');
      if (data.role === 'admin' && C.unitScope(u) != null && data.adminScope == null) throw E.forbidden('cấp quyền quản trị toàn hệ thống');
      if (data.id === u.id && data.role !== u.role) throw E.invalid('Không thể tự thay đổi vai trò của chính mình.');
      let rec = data.id && byId(db.users, data.id);
      if (rec && !C.inScope(u, rec.unitId)) throw E.forbidden('sửa người dùng thuộc đơn vị khác');
      if (!rec) { rec = { id: LMS.uid('u'), staffCode: 'CB' + (2000 + db.users.length), status: 'active', joinedAt: nowIso(), lastLoginAt: null }; db.users.push(rec); }
      Object.assign(rec, { name: data.name.trim(), email: data.email.trim().toLowerCase(), unitId: data.unitId, groupId: data.groupId, role: data.role, title: data.title || rec.title || 'Cán bộ', adminScope: data.role === 'admin' ? (data.adminScope || null) : null });
      audit(u.id, data.id ? 'update' : 'create', `Tài khoản ${rec.email}`, `Vai trò ${C.ROLE_LABEL[rec.role]}${rec.adminScope ? ' (phạm vi ' + byId(db.units, rec.adminScope).name + ')' : ''}`);
      return rec;
    }, { write: true }),
    setUserStatus: (id, status) => call((db) => {
      const u = C.require('users.manage', 'đổi trạng thái tài khoản');
      const x = byId(db.users, id); if (!x) throw E.notFound('Người dùng');
      if (!C.inScope(u, x.unitId)) throw E.forbidden('khóa tài khoản thuộc đơn vị khác');
      if (x.id === u.id) throw E.invalid('Không thể tự khóa tài khoản của chính mình.');
      x.status = status; audit(u.id, status === 'active' ? 'unlock' : 'lock', `Tài khoản ${x.email}`, { active: 'Mở khóa', suspended: 'Tạm dừng', locked: 'Khóa' }[status]);
      return x;
    }, { write: true }),
    resetPassword: (id) => call((db) => { const u = C.require('users.manage'); const x = byId(db.users, id); if (!x || !C.inScope(u, x.unitId)) throw E.forbidden('đặt lại mật khẩu'); audit(u.id, 'reset', `Tài khoản ${x.email}`, 'Gửi liên kết đặt lại mật khẩu'); return { sentTo: x.email }; }, { write: true }),

    /* ================= Tổ chức ================= */
    org: () => call((db) => {
      const u = C.require('org.manage', 'quản lý đơn vị');
      return db.units.filter((x) => C.inScope(u, x.id)).map((un) => ({ ...un, admins: db.users.filter((x) => x.role === 'admin' && (x.adminScope === un.id || (x.adminScope == null && x.unitId === un.id))).map((x) => ({ id: x.id, name: x.name, scope: x.adminScope ? 'Đơn vị' : 'Toàn hệ thống' })), members: db.users.filter((x) => x.unitId === un.id).length, groups: db.groups.filter((g) => g.unitId === un.id).map((g) => ({ ...g, members: db.users.filter((x) => x.groupId === g.id).map((x) => ({ id: x.id, name: x.name, role: x.role, email: x.email })) })), sharedCourses: db.courses.filter((c) => (c.sharedUnitIds || []).includes(un.id) && c.ownerUnitId !== un.id).map((c) => ({ id: c.id, title: c.title })) }));
    }),
    saveUnit: (data) => call((db) => {
      const u = C.require('org.manage', 'tạo/sửa đơn vị');
      if (C.unitScope(u) != null && !data.id) throw E.forbidden('tạo đơn vị mới (chỉ quản trị toàn hệ thống)');
      fail(required(data, [['code', 'Mã đơn vị'], ['name', 'Tên đơn vị']]));
      if (db.units.some((x) => x.code.toLowerCase() === data.code.toLowerCase() && x.id !== data.id)) fail({ code: 'Mã đơn vị đã tồn tại.' });
      let rec = data.id && byId(db.units, data.id);
      if (rec && !C.inScope(u, rec.id)) throw E.forbidden('sửa đơn vị khác');
      if (!rec) { rec = { id: LMS.uid('u'), status: 'active' }; db.units.push(rec); }
      Object.assign(rec, { code: data.code.trim(), name: data.name.trim() });
      audit(u.id, data.id ? 'update' : 'create', `Đơn vị ${rec.code}`, rec.name); return rec;
    }, { write: true }),
    setUnitStatus: (id, status) => call((db) => { const u = C.require('org.manage'); const rec = byId(db.units, id); if (!rec || !C.inScope(u, id)) throw E.forbidden('đổi trạng thái đơn vị'); rec.status = status; audit(u.id, status, `Đơn vị ${rec.code}`, status === 'paused' ? 'Tạm dừng' : 'Kích hoạt'); return rec; }, { write: true }),
    saveGroup: (data) => call((db) => {
      const u = C.require('org.manage', 'tạo/sửa nhóm');
      fail(required(data, [['name', 'Tên phòng/nhóm'], ['unitId', 'Đơn vị']]));
      if (!C.inScope(u, data.unitId)) throw E.forbidden('tạo nhóm ở đơn vị khác');
      let rec = data.id && byId(db.groups, data.id);
      if (!rec) { rec = { id: LMS.uid('g') }; db.groups.push(rec); }
      Object.assign(rec, { unitId: data.unitId, name: data.name.trim(), kind: data.kind || 'team' });
      audit(u.id, data.id ? 'update' : 'create', `Nhóm ${rec.name}`, ''); return rec;
    }, { write: true }),
    deleteGroup: (id) => call((db) => { const u = C.require('org.manage'); const g = byId(db.groups, id); if (!g || !C.inScope(u, g.unitId)) throw E.forbidden('xóa nhóm'); if (db.users.some((x) => x.groupId === id)) throw E.invalid('Nhóm còn thành viên — hãy chuyển thành viên sang nhóm khác trước.'); db.groups = db.groups.filter((x) => x.id !== id); audit(u.id, 'delete', `Nhóm ${g.name}`, ''); return true; }, { write: true }),
    shareCourse: (courseId, unitIds) => call((db) => { const u = C.require('content.write', 'chia sẻ khóa học'); const c = byId(db.courses, courseId); ownCourse(u, c); c.sharedUnitIds = unitIds.filter((x) => x !== c.ownerUnitId); audit(u.id, 'share', `Khóa học ${c.code}`, `Chia sẻ cho: ${c.sharedUnitIds.map((id) => byId(db.units, id).name).join(', ') || '(không)'}`); return c; }, { write: true }),

    /* ================= Giao học ================= */
    assignments: () => call((db) => {
      const u = C.require('assign.manage', 'quản lý giao học');
      const s = C.unitScope(u);
      const targetUnit = (a) => a.targetType === 'unit' ? a.targetId : a.targetType === 'group' ? (byId(db.groups, a.targetId) || {}).unitId : (byId(db.users, a.targetId) || {}).unitId;
      return db.assignments.filter((a) => s == null || targetUnit(a) === s).map((a) => {
        const c = byId(db.courses, a.courseId);
        const people = db.users.filter((x) => x.role === 'learner' && x.status === 'active' && ((a.targetType === 'unit' && x.unitId === a.targetId) || (a.targetType === 'group' && x.groupId === a.targetId) || (a.targetType === 'user' && x.id === a.targetId)));
        const ps = people.map((x) => ({ user: x, p: C.courseProgress(x.id, a.courseId) }));
        const tName = a.targetType === 'unit' ? (byId(db.units, a.targetId) || {}).name : a.targetType === 'group' ? (byId(db.groups, a.targetId) || {}).name : (byId(db.users, a.targetId) || {}).name;
        return { ...a, courseTitle: c ? c.title : '—', courseCode: c ? c.code : '', targetName: tName, people: ps.length, completed: ps.filter((x) => x.p.status === 'completed').length, overdue: ps.filter((x) => x.p.overdue).length, pct: ps.length ? Math.round(ps.reduce((s2, x) => s2 + x.p.pct, 0) / ps.length) : 0, members: ps.map((x) => ({ id: x.user.id, name: x.user.name, pct: x.p.pct, status: x.p.status, overdue: x.p.overdue })) };
      });
    }),
    saveAssignment: (data) => call((db) => {
      const u = C.require('assign.manage', 'giao khóa học');
      const errs = required(data, [['courseId', 'Khóa học'], ['targetId', 'Đối tượng'], ['dueAt', 'Hạn hoàn thành']]);
      if (data.startAt && data.dueAt && new Date(data.startAt) > new Date(data.dueAt)) errs.dueAt = 'Hạn hoàn thành phải sau ngày bắt đầu.';
      fail(errs);
      const unitOf = data.targetType === 'unit' ? data.targetId : data.targetType === 'group' ? (byId(db.groups, data.targetId) || {}).unitId : (byId(db.users, data.targetId) || {}).unitId;
      if (!C.inScope(u, unitOf)) throw E.forbidden('giao khóa học cho đối tượng ngoài đơn vị');
      const c = byId(db.courses, data.courseId); if (!c) throw E.notFound('Khóa học');
      if (c.ownerUnitId !== unitOf && !(c.sharedUnitIds || []).includes(unitOf)) throw E.invalid('Khóa học chưa được chia sẻ cho đơn vị của đối tượng này.');
      let rec = data.id && byId(db.assignments, data.id);
      if (!rec) { rec = { id: LMS.uid('as'), createdBy: u.id }; db.assignments.push(rec); }
      Object.assign(rec, { courseId: data.courseId, targetType: data.targetType, targetId: data.targetId, startAt: data.startAt || nowIso(), dueAt: new Date(data.dueAt).toISOString(), remind: data.remind !== false });
      db.users.filter((x) => x.role === 'learner' && C.assignmentFor(x, c.id) && C.assignmentFor(x, c.id).id === rec.id).forEach((x) => C.notify(x.id, 'assigned', `${data.id ? 'Cập nhật hạn' : 'Bạn được giao'} khóa "${c.title}" — hạn ${LMS.fmt.date(rec.dueAt)}.`, `#/course/${c.id}`));
      audit(u.id, 'assign', `Khóa học ${c.code}`, `${data.id ? 'Cập nhật' : 'Giao'} · hạn ${LMS.fmt.date(rec.dueAt)}`);
      return rec;
    }, { write: true }),
    revokeAssignment: (id) => call((db) => { const u = C.require('assign.manage', 'thu hồi giao học'); const a = byId(db.assignments, id); if (!a) throw E.notFound(); db.assignments = db.assignments.filter((x) => x.id !== id); audit(u.id, 'revoke', `Giao học ${id}`, 'Thu hồi'); return true; }, { write: true }),
    remind: (id) => call((db) => {
      const u = C.require('assign.manage', 'gửi nhắc học');
      const a = byId(db.assignments, id); if (!a) throw E.notFound(); const c = byId(db.courses, a.courseId);
      const targets = db.users.filter((x) => x.role === 'learner' && x.status === 'active' && C.assignmentFor(x, a.courseId) && C.courseProgress(x.id, a.courseId).status !== 'completed');
      targets.forEach((x) => C.notify(x.id, 'due', `Nhắc học: khóa "${c.title}" hạn ${LMS.fmt.date(a.dueAt)}.`, `#/course/${c.id}`));
      audit(u.id, 'remind', `Khóa học ${c.code}`, `Gửi nhắc ${targets.length} học viên`); return targets.length;
    }, { write: true }),

    /* ================= Hệ thống ================= */
    system: () => call((db) => { const u = C.require('system.manage', 'xem cấu hình hệ thống'); return { audit: db.audit.filter((a) => C.unitScope(u) == null || C.inScope(u, (byId(db.users, a.userId) || {}).unitId)).map((a) => ({ ...a, userName: (byId(db.users, a.userId) || {}).name || a.userId })), settings: db.settings, files: db.files.map((f) => ({ ...f, usedIn: db.blocks.filter((b) => b.fileId === f.id || (b.type === 'attachment' && b.data.items.includes(f.id))).map((b) => (byId(db.lessons, b.lessonId) || {}).title) })), stats: Object.fromEntries(['users', 'courses', 'lessons', 'blocks', 'questions', 'quizzes', 'attempts', 'progress', 'feedback'].map((k) => [k, db[k].length])), global: C.unitScope(u) == null }; }),
    saveSettings: (s) => call((db) => {
      const u = C.require('system.manage'); if (C.unitScope(u) != null) throw E.forbidden('đổi cấu hình toàn hệ thống');
      const errs = {}; ['maxPdfMB', 'maxVideoMB', 'maxImageMB', 'maxAttachMB'].forEach((k) => { if (!(+s.upload[k] > 0)) errs[k] = 'Phải lớn hơn 0.'; }); if (!(+s.remindDaysBefore >= 0)) errs.remindDaysBefore = 'Không hợp lệ.'; fail(errs);
      db.settings.upload = { ...db.settings.upload, ...Object.fromEntries(Object.entries(s.upload).map(([k, v]) => [k, Array.isArray(v) ? v : +v])) }; db.settings.remindDaysBefore = +s.remindDaysBefore; db.settings.sessionMinutes = +s.sessionMinutes;
      audit(u.id, 'config', 'Cấu hình hệ thống', 'Cập nhật giới hạn tệp & nhắc học'); return db.settings;
    }, { write: true }),
    backup: () => call((db) => { const u = C.require('system.manage'); db.settings.lastBackupAt = nowIso(); audit(u.id, 'backup', 'Cơ sở dữ liệu', 'Sao lưu thủ công thành công'); return db.settings.lastBackupAt; }, { write: true, latency: [800, 1200] }),
    exportAll: () => call((db) => { const u = C.require('system.manage'); audit(u.id, 'export', 'Toàn bộ dữ liệu', 'Xuất JSON'); const out = LMS.clone(db); out.questions.forEach((q) => q); return out; }, { write: true }),
    replaceFile: (fileId) => call((db) => { const u = C.require('content.write'); const f = byId(db.files, fileId); if (!f) throw E.notFound('Tệp'); f.state = 'ok'; f.uploadedAt = nowIso(); f.uploadedBy = u.id; db.feedback.filter((x) => x.kind === 'report' && x.status === 'new' && db.blocks.some((b) => b.fileId === fileId && b.lessonId === x.lessonId)).forEach((x) => (x.status = 'resolved')); audit(u.id, 'upload', `Tệp ${f.name}`, 'Thay thế tệp lỗi'); return f; }, { write: true }),

    /* ================= Giảng viên ================= */
    inbox: () => call((db) => {
      C.require('feedback.reply', 'xem hộp phản hồi');
      return db.feedback.filter((f) => f.kind !== 'rating').map((f) => { const l = byId(db.lessons, f.lessonId); const c = l && byId(db.courses, l.courseId); return { ...f, userName: (byId(db.users, f.userId) || {}).name, lessonTitle: l ? l.title : '—', courseTitle: c ? c.title : '—', courseId: c && c.id, replyName: f.reply ? (byId(db.users, f.reply.userId) || {}).name : null }; }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),
    reply: (id, text) => call((db) => {
      const u = C.require('feedback.reply', 'trả lời học viên');
      text = String(text || '').trim(); if (text.length < 2) throw E.invalid('Nội dung trả lời không được để trống.', { reply: 'Nhập nội dung trả lời.' });
      const f = byId(db.feedback, id); if (!f) throw E.notFound('Phản hồi');
      f.reply = { userId: u.id, text, at: nowIso() }; f.status = 'answered';
      const l = byId(db.lessons, f.lessonId);
      C.notify(f.userId, 'reply', `${u.name} đã trả lời câu hỏi của bạn ở bài "${l.title}".`, `#/lesson/${l.courseId}/${l.id}?tab=qa`);
      return f;
    }, { write: true }),
    setFeedbackStatus: (id, status) => call((db) => { C.require('feedback.reply'); const f = byId(db.feedback, id); if (!f) throw E.notFound(); f.status = status; return f; }, { write: true }),
    instructor: () => call((db) => {
      C.require('feedback.reply', 'xem trang giảng viên');
      const courses = db.courses.filter((c) => c.status !== 'draft').map((c) => {
        const ls = C.lessonsOf(c.id).map((l) => l.id);
        const learners = db.users.filter((x) => x.role === 'learner' && C.myCourseIds(x).includes(c.id));
        const ps = learners.map((x) => C.courseProgress(x.id, c.id));
        const r = db.feedback.filter((f) => f.kind === 'rating' && ls.includes(f.lessonId));
        const atts = c.completion.quizId ? db.attempts.filter((a) => a.quizId === c.completion.quizId && a.submittedAt) : [];
        return { id: c.id, title: c.title, code: c.code, learners: learners.length, pct: ps.length ? Math.round(ps.reduce((s, p) => s + p.pct, 0) / ps.length) : 0, avgScore: atts.length ? Math.round(atts.reduce((s, a) => s + a.score, 0) / atts.length) : null, rating: r.length ? Math.round((r.reduce((s, x) => s + x.stars, 0) / r.length) * 10) / 10 : null, ratings: r.length };
      });
      const stat = {}; db.attempts.filter((a) => a.submittedAt).forEach((a) => a.questionIds.forEach((qid) => { const q = byId(db.questions, qid); const mine = a.answers[qid] || []; const ok = mine.length === q.correct.length && mine.every((x) => q.correct.includes(x)); stat[qid] = stat[qid] || { w: 0, t: 0 }; stat[qid].t++; if (!ok) stat[qid].w++; }));
      const hardest = Object.entries(stat).filter(([, v]) => v.t >= 2).map(([qid, v]) => { const q = byId(db.questions, qid); return { id: qid, code: q.code, text: q.text, wrongPct: Math.round((v.w / v.t) * 100), answered: v.t, lessonTitle: (byId(db.lessons, q.lessonId) || {}).title }; }).sort((a, b) => b.wrongPct - a.wrongPct).slice(0, 5);
      const pending = db.feedback.filter((f) => (f.kind === 'question' || f.kind === 'report') && f.status === 'new').length;
      return { courses, hardest, pending };
    }),
  };

  function copyCourse(db, c, programId) {
    const nc = { ...LMS.clone(c), id: LMS.uid('c'), programId, code: c.code + '-COPY', title: c.title + ' (bản sao)', status: 'draft', updatedAt: nowIso() };
    db.courses.push(nc);
    const chMap = {};
    db.chapters.filter((x) => x.courseId === c.id).forEach((ch) => { const n = { ...ch, id: LMS.uid('ch'), courseId: nc.id }; chMap[ch.id] = n.id; db.chapters.push(n); });
    db.lessons.filter((x) => x.courseId === c.id).forEach((l) => { const nl = { ...l, id: LMS.uid('ls'), courseId: nc.id, chapterId: chMap[l.chapterId], quizId: null }; db.lessons.push(nl); db.blocks.filter((b) => b.lessonId === l.id).forEach((b) => db.blocks.push({ ...LMS.clone(b), id: LMS.uid('b'), lessonId: nl.id })); });
    nc.completion = { lessonsAll: true, quizId: null };
    return nc;
  }
  function publishIssues(db, courseId) {
    const ls = C.lessonsOf(courseId); const issues = [];
    if (!ls.length) issues.push('chưa có bài học nào');
    ls.forEach((l) => { const bs = db.blocks.filter((b) => b.lessonId === l.id); if (!l.quizId && !bs.length) issues.push(`bài "${l.title}" chưa có nội dung`); bs.forEach((b) => { if (b.fileId && (byId(db.files, b.fileId) || {}).state !== 'ok') issues.push(`tệp của bài "${l.title}" bị lỗi`); }); });
    return issues;
  }
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true; else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  LMS.STATUS_TEXT = STATUS_TEXT;
})(window.LMS);
