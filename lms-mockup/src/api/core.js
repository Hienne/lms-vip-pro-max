/* ==========================================================================
   api/core.js — LỚP BACKEND MÔ PHỎNG
   - Mọi thao tác đi qua call(): có độ trễ, lỗi mạng, hết phiên, kiểm tra quyền.
   - Quyền được kiểm tra Ở ĐÂY (tương đương RLS/API), không chỉ ẩn nút trên UI.
   - Điểm, tiến độ do "server" tính — client không gửi điểm.
   Production: thay call() bằng fetch()/Supabase client; giữ nguyên chữ ký hàm.
   ========================================================================== */
(function (LMS) {
  const { store, sleep, clone } = LMS;

  class ApiError extends Error {
    constructor(status, message, details) { super(message); this.status = status; this.details = details; }
  }
  const E = {
    unauthorized: () => new ApiError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'),
    forbidden: (what = 'thực hiện thao tác này') => new ApiError(403, `Bạn không có quyền ${what}.`),
    notFound: (what = 'Dữ liệu') => new ApiError(404, `${what} không tồn tại hoặc đã bị xóa.`),
    invalid: (message, details) => new ApiError(422, message, details),
    offline: () => new ApiError(0, 'Không có kết nối mạng. Kiểm tra kết nối và thử lại.'),
  };

  /* ---- Quyền theo vai trò ---- */
  const PERMS = {
    learner: ['learn'],
    instructor: ['content.write', 'question.write', 'feedback.reply', 'reports.read'],
    admin: ['content.write', 'question.write', 'feedback.reply', 'reports.read', 'users.manage', 'org.manage', 'assign.manage', 'system.manage'],
    viewer: ['reports.read'],
  };
  const ROLE_LABEL = { learner: 'Học viên', instructor: 'Giảng viên', admin: 'Quản trị viên', viewer: 'Lãnh đạo' };

  function me() {
    const s = store.session.get();
    if (!s) return null;
    return store.db.users.find((u) => u.id === s.userId) || null;
  }
  function requireUser() {
    const u = me();
    if (!u) throw E.unauthorized();
    if (u.status !== 'active') throw new ApiError(401, 'Tài khoản đã bị khóa hoặc tạm dừng.');
    return u;
  }
  const can = (u, perm) => !!u && (PERMS[u.role] || []).includes(perm);
  function require(perm, what) { const u = requireUser(); if (!can(u, perm)) throw E.forbidden(what); return u; }
  /** Phạm vi đơn vị: null = toàn hệ thống. QTV đơn vị & giảng viên bị giới hạn. */
  function unitScope(u) {
    if (u.role === 'admin') return u.adminScope;
    if (u.role === 'viewer') return null;
    return u.unitId;
  }
  const inScope = (u, unitId) => { const s = unitScope(u); return s == null || s === unitId; };

  /** Bọc mọi request: mạng, phiên, persist, audit */
  async function call(fn, { write = false, latency } = {}) {
    const [a, b] = latency || store.net.latency;
    await sleep(a + Math.random() * (b - a));
    if (store.net.offline) throw E.offline();
    if (store.net.sessionExpired && store.session.get()) throw E.unauthorized();
    const result = await fn(store.db);
    if (write) { store.persist(); store.emit({ type: 'db' }); }
    return result === undefined ? undefined : clone(result);
  }
  function audit(userId, action, target, detail) {
    store.db.audit.unshift({ id: LMS.uid('au'), at: new Date().toISOString(), userId, action, target, detail });
  }
  function notify(userId, kind, text, link) {
    store.db.notifications.unshift({ id: LMS.uid('nt'), userId, kind, text, link, at: new Date().toISOString(), read: false });
  }

  /* ======================= Tính toán phía "server" ======================= */
  const db = () => store.db;
  const byId = (arr, id) => arr.find((x) => x.id === id);
  const now = () => Date.now();

  function lessonsOf(courseId) {
    const chs = db().chapters.filter((c) => c.courseId === courseId).sort((a, b) => a.order - b.order);
    const order = new Map(chs.map((c, i) => [c.id, i]));
    return db().lessons.filter((l) => l.courseId === courseId).sort((a, b) => (order.get(a.chapterId) - order.get(b.chapterId)) || (a.order - b.order));
  }
  const attemptsOf = (uid, quizId) => db().attempts.filter((a) => a.userId === uid && a.quizId === quizId && a.submittedAt).sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  function quizSummary(uid, quizId) {
    const quiz = byId(db().quizzes, quizId); if (!quiz) return null;
    const list = attemptsOf(uid, quizId);
    const best = list.length ? Math.max(...list.map((a) => a.score)) : null;
    const last = list.length ? list[list.length - 1].score : null;
    const passed = list.some((a) => a.passed);
    const used = list.length;
    return { quizId, title: quiz.title, attempts: used, maxAttempts: quiz.maxAttempts, left: Math.max(0, quiz.maxAttempts - used), best, last, passed, failedOut: !passed && used >= quiz.maxAttempts, passPct: quiz.passPct };
  }
  function lessonState(uid, lesson) {
    const p = db().progress.find((x) => x.userId === uid && x.lessonId === lesson.id);
    if (lesson.quizId) {
      const s = quizSummary(uid, lesson.quizId);
      if (s && s.passed) return { status: 'completed', pct: 100, p };
      if (s && s.attempts) return { status: 'in_progress', pct: 50, p };
    }
    return { status: p ? p.status : 'not_started', pct: p ? p.pct : 0, p };
  }
  function assignmentFor(u, courseId) {
    const list = db().assignments.filter((a) => a.courseId === courseId && ((a.targetType === 'user' && a.targetId === u.id) || (a.targetType === 'group' && a.targetId === u.groupId) || (a.targetType === 'unit' && a.targetId === u.unitId)));
    if (!list.length) return null;
    return list.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0];
  }
  function courseVisible(u, c) {
    return c.status === 'published' && (c.ownerUnitId === u.unitId || (c.sharedUnitIds || []).includes(u.unitId));
  }
  function courseProgress(uid, courseId) {
    const u = byId(db().users, uid); const c = byId(db().courses, courseId);
    const ls = lessonsOf(courseId);
    const states = ls.map((l) => ({ lesson: l, ...lessonState(uid, l) }));
    const done = states.filter((s) => s.status === 'completed').length;
    const pct = ls.length ? Math.round(states.reduce((s, x) => s + (x.status === 'completed' ? 100 : x.pct), 0) / ls.length) : 0;
    const ps = states.map((s) => s.p).filter(Boolean);
    const startedAt = ps.map((p) => p.startedAt).filter(Boolean).sort()[0] || null;
    const lastAccessAt = ps.map((p) => p.lastAccessAt).filter(Boolean).sort().pop() || null;
    const completed = ls.length > 0 && done === ls.length;
    const completedAt = completed ? ps.map((p) => p.completedAt).filter(Boolean).sort().pop() || lastAccessAt : null;
    const asg = u ? assignmentFor(u, courseId) : null;
    const dueAt = asg ? asg.dueAt : null;
    const overdue = !!dueAt && !completed && new Date(dueAt).getTime() < now();
    const quiz = c && c.completion.quizId ? quizSummary(uid, c.completion.quizId) : null;
    let status = completed ? 'completed' : (done || pct > 0 || (quiz && quiz.attempts)) ? 'in_progress' : 'not_started';
    if (quiz && quiz.failedOut) status = 'failed';
    return { courseId, total: ls.length, done, pct: completed ? 100 : pct, status, overdue, startedAt, lastAccessAt, completedAt, dueAt, assigned: !!asg, assignmentId: asg ? asg.id : null, quiz, states };
  }
  const STATUS_LABEL = { not_started: 'Chưa bắt đầu', in_progress: 'Đang học', completed: 'Đã hoàn thành', failed: 'Chưa đạt' };

  function myCourseIds(u) {
    const ids = new Set(db().assignments.filter((a) => (a.targetType === 'user' && a.targetId === u.id) || (a.targetType === 'group' && a.targetId === u.groupId) || (a.targetType === 'unit' && a.targetId === u.unitId)).map((a) => a.courseId));
    db().enrollments.filter((e) => e.userId === u.id).forEach((e) => ids.add(e.courseId));
    db().progress.filter((p) => p.userId === u.id).forEach((p) => { const l = byId(db().lessons, p.lessonId); if (l) ids.add(l.courseId); });
    return [...ids].filter((id) => { const c = byId(db().courses, id); return c && c.status === 'published'; });
  }

  /** Năng lực theo nhóm kiến thức = tỷ lệ đúng ở LẦN THI TỐT NHẤT của mỗi bài */
  function competency(uid) {
    const agg = {}; db().competencies.forEach((k) => (agg[k] = { c: 0, t: 0 }));
    db().quizzes.forEach((q) => {
      const list = attemptsOf(uid, q.id); if (!list.length) return;
      const best = list.reduce((a, b) => (b.score > a.score ? b : a));
      Object.entries(best.byCompetency).forEach(([k, v]) => { agg[k] = agg[k] || { c: 0, t: 0 }; agg[k].c += v.c; agg[k].t += v.t; });
    });
    return db().competencies.map((k) => ({ name: k, value: agg[k].t ? Math.round((agg[k].c / agg[k].t) * 100) : 0, answered: agg[k].t }));
  }
  function streak(uid) {
    const days = new Set((db().activity[uid] || []));
    let n = 0; const d = new Date();
    for (;;) { const key = new Date(d.getTime() - n * 86400000).toISOString().slice(0, 10); if (days.has(key)) n++; else break; if (n > 365) break; }
    return n;
  }
  function points(uid) {
    const s = db().settings.points;
    const doneLessons = db().progress.filter((p) => p.userId === uid && p.status === 'completed').length;
    const passed = new Set(db().attempts.filter((a) => a.userId === uid && a.passed).map((a) => a.quizId)).size;
    const courses = db().courses.filter((c) => courseProgress(uid, c.id).status === 'completed').reduce((sum, c) => sum + c.rewardPoints, 0);
    const parts = { lessons: doneLessons * s.lesson, quizzes: passed * s.quizPass, courses, streak: Math.min(streak(uid), 30) * s.streakDay };
    return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
  }
  function badges(uid) {
    const cps = db().courses.map((c) => courseProgress(uid, c.id));
    const atts = db().attempts.filter((a) => a.userId === uid && a.submittedAt);
    const st = streak(uid);
    const allRequired = db().courses.filter((c) => c.required && c.status === 'published' && byId(db().users, uid) && courseVisible(byId(db().users, uid), c));
    return [
      { id: 'first', name: 'Khởi đầu suôn sẻ', desc: 'Hoàn thành khóa học đầu tiên', earned: cps.some((c) => c.status === 'completed') },
      { id: 'culture', name: 'Hòa nhập nhanh', desc: 'Hoàn thành khóa Văn hóa & quy chế', earned: courseProgress(uid, 'c4').status === 'completed' },
      { id: 'streak7', name: 'Chuỗi 7 ngày', desc: 'Học liên tục 7 ngày', earned: st >= 7 },
      { id: 'pass1', name: 'Vượt qua thử thách', desc: 'Đạt một bài kiểm tra bất kỳ', earned: atts.some((a) => a.passed) },
      { id: 'perfect', name: 'Điểm tuyệt đối', desc: 'Đạt 100% một bài kiểm tra', earned: atts.some((a) => a.score === 100) },
      { id: 'persist', name: 'Bền bỉ', desc: 'Đạt sau khi thi lại', earned: db().quizzes.some((q) => { const l = attemptsOf(uid, q.id); return l.length > 1 && l[l.length - 1].passed && !l[0].passed; }) },
      { id: 'streak30', name: 'Chuỗi 30 ngày', desc: 'Học liên tục 30 ngày', earned: st >= 30 },
      { id: 'graduate', name: 'Tốt nghiệp hội nhập', desc: 'Hoàn thành mọi khóa bắt buộc', earned: allRequired.length > 0 && allRequired.every((c) => courseProgress(uid, c.id).status === 'completed') },
    ];
  }
  function touchActivity(uid) {
    const key = new Date().toISOString().slice(0, 10);
    const arr = db().activity[uid] = db().activity[uid] || [];
    if (!arr.includes(key)) arr.push(key);
  }
  function lessonText(lessonId) {
    return db().blocks.filter((b) => b.lessonId === lessonId).map((b) => {
      if (b.type === 'text') return b.data.markdown;
      if (b.type === 'process') return b.data.steps.map((s) => `${s.title}: ${s.text}`).join('\n');
      if (b.type === 'video') return (b.data.transcript || []).map((t) => t.text).join(' ');
      if (b.type === 'pdf') return (b.data.outline || []).join(', ');
      return '';
    }).join('\n');
  }

  LMS.api = LMS.api || {};
  LMS.apiCore = { ApiError, E, PERMS, ROLE_LABEL, STATUS_LABEL, me, requireUser, require, can, unitScope, inScope, call, audit, notify, byId, lessonsOf, attemptsOf, quizSummary, lessonState, assignmentFor, courseVisible, courseProgress, myCourseIds, competency, streak, points, badges, touchActivity, lessonText };
})(window.LMS);
