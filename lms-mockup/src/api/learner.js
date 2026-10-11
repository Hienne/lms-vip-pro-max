/* ==========================================================================
   api/learner.js — LearnerService: dashboard, học, tiến độ, thi
   ========================================================================== */
(function (LMS) {
  const C = LMS.apiCore;
  const { call, E, byId } = C;

  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function courseCard(db, u, c) {
    const p = C.courseProgress(u.id, c.id);
    const prog = byId(db.programs, c.programId); const dom = prog && byId(db.domains, prog.domainId);
    const minutes = C.lessonsOf(c.id).reduce((s, l) => s + l.minutes, 0);
    return { id: c.id, code: c.code, title: c.title, desc: c.desc, module: c.module, level: c.level, required: c.required, cover: c.cover, program: prog && prog.name, programId: c.programId, domain: dom && dom.name, domainId: dom && dom.id, lessons: p.total, minutes, ...p, statusLabel: C.STATUS_LABEL[p.status] };
  }

  function continueTarget(db, u) {
    const ids = C.myCourseIds(u);
    const prs = db.progress.filter((p) => p.userId === u.id && p.status === 'in_progress').map((p) => ({ p, l: byId(db.lessons, p.lessonId) })).filter((x) => x.l && ids.includes(x.l.courseId));
    prs.sort((a, b) => new Date(b.p.lastAccessAt) - new Date(a.p.lastAccessAt));
    const pick = (l, p) => {
      const blocks = db.blocks.filter((b) => b.lessonId === l.id);
      const c = byId(db.courses, l.courseId);
      let where = 'Bắt đầu bài học';
      if (p && p.videoPos && blocks.some((b) => b.type === 'video')) where = `Video ${LMS.fmt.time(p.videoPos)}`;
      else if (p && p.lastPage && blocks.some((b) => b.type === 'pdf')) where = `Tài liệu trang ${p.lastPage}`;
      else if (l.quizId) where = 'Bài kiểm tra';
      return { courseId: c.id, courseTitle: c.title, lessonId: l.id, lessonTitle: l.title, where, href: l.quizId ? `#/quiz/${l.quizId}` : `#/lesson/${c.id}/${l.id}` };
    };
    if (prs.length) return pick(prs[0].l, prs[0].p);
    // Không có bài dở dang → nội dung tiếp theo cần hoàn thành của khóa gần hạn nhất
    const cps = ids.map((id) => C.courseProgress(u.id, id)).filter((p) => p.status !== 'completed' && p.status !== 'failed').sort((a, b) => new Date(a.dueAt || 8e15) - new Date(b.dueAt || 8e15));
    for (const cp of cps) { const next = cp.states.find((s) => s.status !== 'completed'); if (next) return pick(next.lesson, next.p); }
    return null;
  }

  LMS.api.learner = {
    dashboard: () => call((db) => {
      const u = C.require('learn', 'xem trang học tập');
      const ids = C.myCourseIds(u);
      const cards = ids.map((id) => courseCard(db, u, byId(db.courses, id)));
      const assignedCards = cards.filter((c) => c.assigned);
      const quizStats = db.quizzes.map((q) => C.quizSummary(u.id, q.id)).filter((s) => s && s.attempts);
      const lastAttempt = db.attempts.filter((a) => a.userId === u.id && a.submittedAt).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
      const deadlines = cards.filter((c) => c.dueAt && c.status !== 'completed').sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
      return {
        user: { id: u.id, name: u.name, title: u.title },
        counts: {
          assigned: assignedCards.length,
          notStarted: cards.filter((c) => c.status === 'not_started').length,
          inProgress: cards.filter((c) => c.status === 'in_progress').length,
          completed: cards.filter((c) => c.status === 'completed').length,
          required: cards.filter((c) => c.required).length,
          overdue: cards.filter((c) => c.overdue).length,
          failed: cards.filter((c) => c.status === 'failed').length,
        },
        completionPct: cards.length ? Math.round(cards.reduce((s, c) => s + c.pct, 0) / cards.length) : 0,
        lastScore: lastAttempt ? { score: lastAttempt.score, passed: lastAttempt.passed, quiz: byId(db.quizzes, lastAttempt.quizId).title, at: lastAttempt.submittedAt } : null,
        bestScore: quizStats.length ? Math.max(...quizStats.map((s) => s.best)) : null,
        passedQuizzes: quizStats.filter((s) => s.passed).length, totalQuizzes: db.quizzes.filter((q) => ids.includes(q.courseId)).length,
        cards, deadlines, continue: continueTarget(db, u),
        competency: C.competency(u.id), points: C.points(u.id), streak: C.streak(u.id),
        journey: db.programs.filter((p) => p.status === 'published').map((p) => {
          const cs = cards.filter((c) => c.programId === p.id);
          const pct = cs.length ? Math.round(cs.reduce((s, c) => s + c.pct, 0) / cs.length) : null;
          return { id: p.id, name: p.name, pct, courses: cs.length };
        }).filter((j) => j.pct != null),
      };
    }),

    catalog: () => call((db) => {
      const u = C.require('learn', 'xem danh mục');
      const list = db.courses.filter((c) => C.courseVisible(u, c)).map((c) => courseCard(db, u, c));
      return { courses: list, domains: db.domains.filter((d) => d.status === 'published'), programs: db.programs.filter((p) => p.status === 'published'), modules: db.modules, levels: ['Cơ bản', 'Trung cấp', 'Nâng cao'] };
    }),

    course: (id) => call((db) => {
      const u = C.require('learn', 'xem khóa học');
      const c = byId(db.courses, id); if (!c) throw E.notFound('Khóa học');
      if (!C.courseVisible(u, c)) throw E.forbidden('xem khóa học này (ngoài phạm vi đơn vị hoặc chưa xuất bản)');
      const card = courseCard(db, u, c);
      const chapters = db.chapters.filter((ch) => ch.courseId === id).sort((a, b) => a.order - b.order).map((ch) => ({
        ...ch, lessons: card.states.filter((s) => s.lesson.chapterId === ch.id).map((s) => ({ ...s.lesson, status: s.status, pct: s.pct, types: [...new Set(db.blocks.filter((b) => b.lessonId === s.lesson.id).map((b) => b.type))].concat(s.lesson.quizId ? ['quiz'] : []) })),
      }));
      const ratings = db.feedback.filter((f) => f.kind === 'rating' && C.lessonsOf(id).some((l) => l.id === f.lessonId));
      const enrolled = C.myCourseIds(u).includes(id);
      return { ...card, outcomes: c.outcomes, completion: c.completion, rewardPoints: c.rewardPoints, chapters, enrolled, saved: db.bookmarks.some((b) => b.userId === u.id && b.courseId === id), rating: ratings.length ? { avg: ratings.reduce((s, r) => s + r.stars, 0) / ratings.length, count: ratings.length } : null, continue: (() => { const n = card.states.find((s) => s.status !== 'completed'); return n ? { lessonId: n.lesson.id, quizId: n.lesson.quizId } : null; })() };
    }),

    enroll: (courseId) => call((db) => {
      const u = C.require('learn', 'đăng ký khóa học');
      const c = byId(db.courses, courseId); if (!c || !C.courseVisible(u, c)) throw E.notFound('Khóa học');
      if (!db.enrollments.some((e) => e.userId === u.id && e.courseId === courseId)) db.enrollments.push({ userId: u.id, courseId, at: new Date().toISOString() });
      return true;
    }, { write: true }),

    lesson: (courseId, lessonId) => call((db) => {
      const u = C.require('learn', 'xem bài học');
      const c = byId(db.courses, courseId); const l = byId(db.lessons, lessonId);
      if (!c || !l || l.courseId !== courseId) throw E.notFound('Bài học');
      if (!C.courseVisible(u, c)) throw E.forbidden('xem bài học này');
      let p = db.progress.find((x) => x.userId === u.id && x.lessonId === lessonId);
      const nowIso = new Date().toISOString();
      if (!p) { p = { userId: u.id, lessonId, status: 'in_progress', pct: 0, lastPage: 0, videoPos: 0, watchedPct: 0, startedAt: nowIso, lastAccessAt: nowIso, completedAt: null }; db.progress.push(p); }
      else p.lastAccessAt = nowIso;
      C.touchActivity(u.id);
      const blocks = db.blocks.filter((b) => b.lessonId === lessonId).sort((a, b) => a.order - b.order).map((b) => ({ ...b, file: b.fileId ? byId(db.files, b.fileId) : null, files: b.type === 'attachment' ? b.data.items.map((fid) => byId(db.files, fid)) : null }));
      const ls = C.lessonsOf(courseId); const idx = ls.findIndex((x) => x.id === lessonId);
      const toc = ls.map((x) => ({ id: x.id, title: x.title, minutes: x.minutes, quizId: x.quizId, chapterId: x.chapterId, ...C.lessonState(u.id, x), p: undefined }));
      const fb = db.feedback.filter((f) => f.lessonId === lessonId);
      const ratings = fb.filter((f) => f.kind === 'rating');
      const nameOf = (id) => (byId(db.users, id) || {}).name || 'Ẩn danh';
      return {
        course: { id: c.id, title: c.title }, lesson: l, chapter: byId(db.chapters, l.chapterId), blocks, progress: { ...p },
        prev: ls[idx - 1] || null, next: ls[idx + 1] || null, toc,
        comments: fb.filter((f) => f.kind === 'comment').map((f) => ({ ...f, userName: nameOf(f.userId) })),
        questions: fb.filter((f) => f.kind === 'question' && (f.userId === u.id || f.status === 'answered')).map((f) => ({ ...f, userName: nameOf(f.userId), replyName: f.reply ? nameOf(f.reply.userId) : null, mine: f.userId === u.id })),
        myRating: (ratings.find((r) => r.userId === u.id) || {}).stars || 0,
        rating: ratings.length ? { avg: ratings.reduce((s, r) => s + r.stars, 0) / ratings.length, count: ratings.length } : null,
        notes: db.notes.filter((n) => n.userId === u.id && n.lessonId === lessonId),
        bookmarks: db.bookmarks.filter((b) => b.userId === u.id && b.lessonId === lessonId),
        requirement: requirementFor(db, l, p),
      };
    }, { write: true }),

    /** Lưu vị trí học — server tự tính pct, không nhận pct/điểm từ client */
    saveProgress: (lessonId, { page, videoPos, watchedPct }) => call((db) => {
      const u = C.require('learn', 'cập nhật tiến độ');
      const l = byId(db.lessons, lessonId); if (!l) throw E.notFound('Bài học');
      const p = db.progress.find((x) => x.userId === u.id && x.lessonId === lessonId); if (!p) throw E.notFound('Tiến độ');
      const blocks = db.blocks.filter((b) => b.lessonId === lessonId);
      const pdf = blocks.find((b) => b.type === 'pdf'); const vid = blocks.find((b) => b.type === 'video');
      if (page != null && pdf) p.lastPage = Math.max(1, Math.min(pdf.data.pages, Math.round(page)));
      if (videoPos != null && vid) p.videoPos = Math.max(0, Math.min(vid.data.duration, Math.round(videoPos)));
      if (watchedPct != null && vid) p.watchedPct = Math.max(p.watchedPct || 0, Math.min(100, Math.round(watchedPct)));
      if (p.status !== 'completed') {
        const parts = [];
        if (pdf && byId(db.files, pdf.fileId).state === 'ok') parts.push(Math.min(100, (p.lastPage / pdf.data.pages) * 100));
        if (vid) parts.push(p.watchedPct || 0);
        p.pct = Math.round(parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : Math.max(p.pct, 50));
      }
      p.lastAccessAt = new Date().toISOString();
      return { ...p, requirement: requirementFor(db, l, p) };
    }, { write: true, latency: [60, 140] }),

    completeLesson: (lessonId) => call((db) => {
      const u = C.require('learn', 'đánh dấu hoàn thành');
      const l = byId(db.lessons, lessonId); if (!l) throw E.notFound('Bài học');
      if (l.quizId) throw E.invalid('Bài kiểm tra chỉ hoàn thành khi đạt điểm.');
      const p = db.progress.find((x) => x.userId === u.id && x.lessonId === lessonId); if (!p) throw E.notFound('Tiến độ');
      const req = requirementFor(db, l, p);
      if (!req.ok) throw E.invalid(req.message);
      p.status = 'completed'; p.pct = 100; p.completedAt = new Date().toISOString();
      const cp = C.courseProgress(u.id, l.courseId);
      if (cp.status === 'completed') C.notify(u.id, 'certificate', `Chúc mừng! Bạn đã hoàn thành khóa "${byId(db.courses, l.courseId).title}". Chứng nhận đã sẵn sàng.`, '#/certificates');
      return { ok: true, courseCompleted: cp.status === 'completed' };
    }, { write: true }),

    feedback: (lessonId, { kind, text, stars, anchor }) => call((db) => {
      const u = C.require('learn', 'gửi phản hồi');
      if (!byId(db.lessons, lessonId)) throw E.notFound('Bài học');
      if (kind === 'rating') {
        if (!(stars >= 1 && stars <= 5)) throw E.invalid('Số sao phải từ 1 đến 5.');
        const ex = db.feedback.find((f) => f.kind === 'rating' && f.userId === u.id && f.lessonId === lessonId);
        if (ex) ex.stars = stars; else db.feedback.push({ id: LMS.uid('fb'), kind, userId: u.id, lessonId, text: '', stars, anchor: null, status: 'resolved', reply: null, createdAt: new Date().toISOString() });
        return true;
      }
      text = String(text || '').trim();
      if (text.length < 5) throw E.invalid('Nội dung cần tối thiểu 5 ký tự.', { text: 'Nội dung cần tối thiểu 5 ký tự.' });
      if (text.length > 1000) throw E.invalid('Nội dung tối đa 1000 ký tự.', { text: 'Nội dung tối đa 1000 ký tự.' });
      db.feedback.push({ id: LMS.uid('fb'), kind, userId: u.id, lessonId, text, stars: null, anchor: anchor || null, status: kind === 'comment' ? 'resolved' : 'new', reply: null, createdAt: new Date().toISOString() });
      if (kind !== 'comment') db.users.filter((x) => x.role === 'instructor').forEach((ins) => C.notify(ins.id, kind, `${kind === 'report' ? 'Báo cáo nội dung' : 'Câu hỏi mới'} từ ${u.name}: "${text.slice(0, 60)}"`, '#/instructor/inbox'));
      return true;
    }, { write: true }),

    addNote: (lessonId, anchor, text) => call((db) => {
      const u = C.require('learn', 'ghi chú');
      text = String(text || '').trim(); if (!text) throw E.invalid('Ghi chú không được để trống.');
      const n = { id: LMS.uid('n'), userId: u.id, lessonId, anchor, text, at: new Date().toISOString() }; db.notes.push(n); return n;
    }, { write: true, latency: [80, 160] }),
    deleteNote: (id) => call((db) => { const u = C.require('learn'); const i = db.notes.findIndex((n) => n.id === id && n.userId === u.id); if (i < 0) throw E.notFound('Ghi chú'); db.notes.splice(i, 1); return true; }, { write: true, latency: [80, 160] }),
    toggleBookmark: (lessonId, anchor, label) => call((db) => {
      const u = C.require('learn');
      const i = db.bookmarks.findIndex((b) => b.userId === u.id && b.lessonId === lessonId && JSON.stringify(b.anchor) === JSON.stringify(anchor));
      if (i >= 0) { db.bookmarks.splice(i, 1); return { saved: false }; }
      db.bookmarks.push({ id: LMS.uid('bm'), userId: u.id, lessonId, anchor, label, at: new Date().toISOString() }); return { saved: true };
    }, { write: true, latency: [80, 160] }),
    saved: () => call((db) => {
      const u = C.require('learn');
      const deco = (x) => { const l = byId(db.lessons, x.lessonId); const c = l && byId(db.courses, l.courseId); return { ...x, lessonTitle: l ? l.title : '—', courseId: c && c.id, courseTitle: c ? c.title : '—' }; };
      return { notes: db.notes.filter((n) => n.userId === u.id).map(deco).sort((a, b) => b.at.localeCompare(a.at)), bookmarks: db.bookmarks.filter((b) => b.userId === u.id).map(deco).sort((a, b) => b.at.localeCompare(a.at)) };
    }),

    /* ---------------- Quiz ---------------- */
    quizIntro: (quizId) => call((db) => {
      const u = C.require('learn', 'xem bài kiểm tra');
      const q = byId(db.quizzes, quizId); if (!q || q.status !== 'published') throw E.notFound('Bài kiểm tra');
      const c = byId(db.courses, q.courseId); if (!C.courseVisible(u, c)) throw E.forbidden('làm bài kiểm tra này');
      const s = C.quizSummary(u.id, quizId);
      const list = C.attemptsOf(u.id, quizId);
      const open = new Date(q.openAt).getTime(), close = new Date(q.closeAt).getTime(), t = Date.now();
      const lastAt = list.length ? new Date(list[list.length - 1].submittedAt).getTime() : 0;
      const waitUntil = q.retakeWaitHours && lastAt ? lastAt + q.retakeWaitHours * 3600000 : 0;
      const pending = db.attempts.find((a) => a.userId === u.id && a.quizId === quizId && !a.submittedAt && new Date(a.deadlineAt).getTime() > t);
      let block = null;
      if (t < open) block = { code: 'not_open', message: `Bài kiểm tra mở lúc ${LMS.fmt.datetime(q.openAt)}.` };
      else if (t > close) block = { code: 'closed', message: `Bài kiểm tra đã đóng lúc ${LMS.fmt.datetime(q.closeAt)}.` };
      else if (s.passed) block = { code: 'passed', message: 'Bạn đã đạt bài kiểm tra này.' };
      else if (s.left <= 0) block = { code: 'no_attempts', message: 'Bạn đã dùng hết lượt thi. Liên hệ giảng viên để được xem xét cấp thêm lượt.' };
      else if (waitUntil > t) block = { code: 'wait', message: `Bạn có thể thi lại sau ${LMS.fmt.datetime(new Date(waitUntil))}.` };
      const lessonsDone = C.lessonsOf(q.courseId).filter((l) => !l.quizId).every((l) => C.lessonState(u.id, l).status === 'completed');
      return { quiz: { id: q.id, title: q.title, minutes: q.minutes, questionCount: q.questionCount, passPct: q.passPct, maxAttempts: q.maxAttempts, retakeWaitHours: q.retakeWaitHours, openAt: q.openAt, closeAt: q.closeAt, reviewPolicy: q.reviewPolicy, shuffleQuestions: q.shuffleQuestions, shuffleOptions: q.shuffleOptions, hasMultiple: q.questionIds.some((id) => byId(db.questions, id).type === 'multiple') }, course: { id: c.id, title: c.title }, summary: s, attempts: list.map((a) => ({ id: a.id, score: a.score, passed: a.passed, submittedAt: a.submittedAt, startedAt: a.startedAt, autoSubmitted: a.autoSubmitted })), block, pendingAttemptId: pending ? pending.id : null, lessonsDone };
    }),

    startAttempt: (quizId) => call((db) => {
      const u = C.require('learn', 'làm bài kiểm tra');
      const q = byId(db.quizzes, quizId); if (!q) throw E.notFound('Bài kiểm tra');
      const t = Date.now();
      let a = db.attempts.find((x) => x.userId === u.id && x.quizId === quizId && !x.submittedAt && new Date(x.deadlineAt).getTime() > t);
      if (!a) {
        const s = C.quizSummary(u.id, quizId);
        if (s.passed || s.left <= 0) throw E.forbidden('bắt đầu lượt thi mới');
        if (t < new Date(q.openAt).getTime() || t > new Date(q.closeAt).getTime()) throw E.invalid('Bài kiểm tra chưa mở hoặc đã đóng.');
        const poolIds = q.questionIds.filter((id) => (byId(db.questions, id) || {}).status === 'active');
        let qids = q.source === 'random' ? shuffle(poolIds).slice(0, q.questionCount) : poolIds.slice(0, q.questionCount);
        if (q.shuffleQuestions) qids = shuffle(qids);
        const optionOrder = {}; qids.forEach((id) => { const opts = byId(db.questions, id).options.map((o) => o.id); optionOrder[id] = q.shuffleOptions ? shuffle(opts) : opts; });
        a = { id: LMS.uid('at'), quizId, userId: u.id, startedAt: new Date().toISOString(), submittedAt: null, deadlineAt: new Date(t + q.minutes * 60000).toISOString(), questionIds: qids, optionOrder, answers: {}, flags: [], score: null, passed: null, correctCount: 0, byCompetency: {}, autoSubmitted: false };
        db.attempts.push(a);
        C.touchActivity(u.id);
      }
      // KHÔNG trả về đáp án đúng / giải thích khi đang thi
      const questions = a.questionIds.map((id) => { const qq = byId(db.questions, id); const order = (a.optionOrder && a.optionOrder[id]) || qq.options.map((o) => o.id); return { id: qq.id, code: qq.code, text: qq.text, type: qq.type, options: order.map((oid) => qq.options.find((o) => o.id === oid)) }; });
      return { attempt: { id: a.id, quizId, startedAt: a.startedAt, deadlineAt: a.deadlineAt, answers: a.answers, flags: a.flags || [] }, quiz: { id: q.id, title: q.title, passPct: q.passPct, courseId: q.courseId }, questions };
    }, { write: true }),

    saveAnswer: (attemptId, questionId, optionIds, flagged) => call((db) => {
      const u = C.require('learn');
      const a = byId(db.attempts, attemptId);
      if (!a || a.userId !== u.id) throw E.forbidden('sửa bài làm của người khác');
      if (a.submittedAt) throw E.invalid('Bài đã nộp, không thể sửa đáp án.');
      if (Date.now() > new Date(a.deadlineAt).getTime() + 5000) throw E.invalid('Đã hết giờ làm bài.');
      if (!a.questionIds.includes(questionId)) throw E.invalid('Câu hỏi không thuộc bài thi.');
      if (optionIds) a.answers[questionId] = optionIds;
      if (flagged != null) { a.flags = (a.flags || []).filter((x) => x !== questionId); if (flagged) a.flags.push(questionId); }
      return true;
    }, { write: true, latency: [40, 120] }),

    /** Chấm điểm phía server dựa trên đáp án đã lưu — client không gửi điểm */
    submitAttempt: (attemptId, { auto = false } = {}) => call((db) => {
      const u = C.require('learn');
      const a = byId(db.attempts, attemptId);
      if (!a || a.userId !== u.id) throw E.forbidden('nộp bài của người khác');
      if (a.submittedAt) return { id: a.id };
      const q = byId(db.quizzes, a.quizId);
      let correct = 0; const byC = {};
      a.questionIds.forEach((qid) => {
        const qq = byId(db.questions, qid); const ans = (a.answers[qid] || []).slice().sort(); const key = qq.correct.slice().sort();
        const ok = ans.length === key.length && ans.every((x, i) => x === key[i]);
        byC[qq.competency] = byC[qq.competency] || { c: 0, t: 0 }; byC[qq.competency].t++; if (ok) { byC[qq.competency].c++; correct++; }
      });
      a.correctCount = correct; a.byCompetency = byC; a.score = Math.round((correct / a.questionIds.length) * 100); a.passed = a.score >= q.passPct;
      a.submittedAt = new Date().toISOString(); a.autoSubmitted = !!auto || Date.now() > new Date(a.deadlineAt).getTime();
      const lesson = db.lessons.find((l) => l.quizId === q.id);
      if (lesson && a.passed) {
        let p = db.progress.find((x) => x.userId === u.id && x.lessonId === lesson.id);
        if (!p) { p = { userId: u.id, lessonId: lesson.id, status: 'completed', pct: 100, lastPage: 0, videoPos: 0, watchedPct: 0, startedAt: a.startedAt, lastAccessAt: a.submittedAt, completedAt: a.submittedAt }; db.progress.push(p); }
        else Object.assign(p, { status: 'completed', pct: 100, completedAt: a.submittedAt, lastAccessAt: a.submittedAt });
      }
      C.notify(u.id, 'result', `Kết quả "${q.title}": ${a.score}% — ${a.passed ? 'Đạt' : 'Chưa đạt'}.`, `#/quiz/${q.id}/result/${a.id}`);
      C.touchActivity(u.id);
      return { id: a.id };
    }, { write: true }),

    attemptResult: (attemptId) => call((db) => {
      const u = C.requireUser();
      const a = byId(db.attempts, attemptId); if (!a || !a.submittedAt) throw E.notFound('Kết quả thi');
      if (a.userId !== u.id && !C.can(u, 'reports.read')) throw E.forbidden('xem kết quả của người khác');
      const q = byId(db.quizzes, a.quizId); const s = C.quizSummary(a.userId, q.id);
      const closed = Date.now() > new Date(q.closeAt).getTime();
      const allowed = q.reviewPolicy === 'after_submit' || (q.reviewPolicy === 'after_pass' && s.passed) || (q.reviewPolicy === 'after_close' && closed) || C.can(u, 'reports.read');
      const reviewMsg = { never: 'Bài kiểm tra này không cho phép xem lại đáp án.', after_pass: 'Đáp án và giải thích sẽ hiển thị sau khi bạn đạt bài kiểm tra.', after_close: `Đáp án và giải thích hiển thị sau khi đóng đề (${LMS.fmt.datetime(q.closeAt)}).` }[q.reviewPolicy];
      const review = allowed ? a.questionIds.map((qid, i) => { const qq = byId(db.questions, qid); const mine = a.answers[qid] || []; const ok = mine.length === qq.correct.length && mine.every((x) => qq.correct.includes(x)); return { n: i + 1, code: qq.code, text: qq.text, type: qq.type, options: qq.options, correct: qq.correct, mine, ok, explanation: qq.explanation }; }) : null;
      const comp = Object.entries(a.byCompetency).map(([name, v]) => ({ name, c: v.c, t: v.t }));
      const nth = C.attemptsOf(a.userId, q.id).findIndex((x) => x.id === a.id) + 1;
      const course = byId(db.courses, q.courseId);
      return { attempt: { id: a.id, score: a.score, passed: a.passed, correct: a.correctCount, total: a.questionIds.length, submittedAt: a.submittedAt, startedAt: a.startedAt, autoSubmitted: a.autoSubmitted, nth }, quiz: { id: q.id, title: q.title, passPct: q.passPct, courseId: q.courseId }, course: { id: course.id, title: course.title, rewardPoints: course.rewardPoints }, summary: s, competency: comp, review, reviewMsg: allowed ? null : reviewMsg, courseCompleted: C.courseProgress(a.userId, q.courseId).status === 'completed' };
    }),

    /* ---------------- Tiến độ, thành tích ---------------- */
    progress: () => call((db) => {
      const u = C.require('learn');
      const ids = C.myCourseIds(u);
      const rows = ids.map((id) => courseCard(db, u, byId(db.courses, id)));
      const atts = db.attempts.filter((a) => a.userId === u.id && a.submittedAt).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((a) => ({ id: a.id, quizId: a.quizId, title: byId(db.quizzes, a.quizId).title, score: a.score, passed: a.passed, at: a.submittedAt, auto: a.autoSubmitted }));
      const minutesDone = db.progress.filter((p) => p.userId === u.id).reduce((s, p) => { const l = byId(db.lessons, p.lessonId); return s + (l ? (l.minutes * (p.status === 'completed' ? 100 : p.pct)) / 100 : 0); }, 0);
      const act = new Set(db.activity[u.id] || []);
      const weeks = Array.from({ length: 8 }, (_, i) => { const end = Date.now() - (7 - i) * 7 * 86400000; let days = 0; for (let k = 0; k < 7; k++) if (act.has(new Date(end - k * 86400000).toISOString().slice(0, 10))) days++; return { label: `T-${7 - i}`, days }; });
      weeks[7].label = 'Tuần này';
      const scores = atts.map((a) => a.score);
      return { rows, attempts: atts, competency: C.competency(u.id), badges: C.badges(u.id), points: C.points(u.id), streak: C.streak(u.id), hours: Math.round(minutesDone / 6) / 10, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, weeks };
    }),

    attempts: (quizId) => call((db) => {
      const u = C.require('learn');
      const q = byId(db.quizzes, quizId); if (!q) throw E.notFound('Bài kiểm tra');
      return { quiz: { id: q.id, title: q.title, passPct: q.passPct, courseId: q.courseId, reviewPolicy: q.reviewPolicy }, summary: C.quizSummary(u.id, quizId), attempts: C.attemptsOf(u.id, quizId).map((a, i) => ({ n: i + 1, id: a.id, score: a.score, passed: a.passed, correct: a.correctCount, total: a.questionIds.length, startedAt: a.startedAt, submittedAt: a.submittedAt, minutes: Math.max(1, Math.round((new Date(a.submittedAt) - new Date(a.startedAt)) / 60000)), auto: a.autoSubmitted })) };
    }),

    leaderboard: (scope = 'unit') => call((db) => {
      const u = C.require('learn');
      const pool = db.users.filter((x) => x.role === 'learner' && x.status === 'active' && (scope === 'all' || (scope === 'unit' ? x.unitId === u.unitId : x.groupId === u.groupId)));
      const rows = pool.map((x) => ({ id: x.id, name: x.name, group: (byId(db.groups, x.groupId) || {}).name, points: C.points(x.id).total, streak: C.streak(x.id), me: x.id === u.id })).sort((a, b) => b.points - a.points).map((r, i) => ({ ...r, rank: i + 1 }));
      return { rows, me: rows.find((r) => r.me), points: C.points(u.id), badges: C.badges(u.id) };
    }),

    certificates: () => call((db) => {
      const u = C.require('learn');
      return db.courses.filter((c) => C.courseProgress(u.id, c.id).status === 'completed').map((c) => { const p = C.courseProgress(u.id, c.id); return { id: `${u.id}-${c.id}`, courseId: c.id, title: c.title, code: c.code, completedAt: p.completedAt, score: p.quiz ? p.quiz.best : null, verify: `CBA-${c.code}-${u.staffCode}`.toUpperCase(), userName: u.name }; });
    }),

    flashcards: () => call((db) => {
      const u = C.require('learn');
      const ids = C.myCourseIds(u);
      const lessonIds = db.lessons.filter((l) => ids.includes(l.courseId)).map((l) => l.id);
      const st = db.flashState[u.id] || {};
      return db.questions.filter((q) => q.status === 'active' && lessonIds.includes(q.lessonId)).map((q) => ({ id: q.id, front: q.text, back: q.options.filter((o) => q.correct.includes(o.id)).map((o) => o.text), explanation: q.explanation, competency: q.competency, state: st[q.id] || 'new' }));
    }),
    rateFlashcard: (qid, state) => call((db) => { const u = C.require('learn'); db.flashState[u.id] = db.flashState[u.id] || {}; db.flashState[u.id][qid] = state; return true; }, { write: true, latency: [40, 90] }),

    /* ---------------- Trợ lý AI (mô phỏng RAG có trích nguồn) ---------------- */
    ask: (text, { lessonId } = {}) => call((db) => {
      const u = C.require('learn', 'dùng trợ lý AI');
      const ids = C.myCourseIds(u);
      const terms = String(text).toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
      const passages = [];
      db.blocks.forEach((b) => {
        const l = byId(db.lessons, b.lessonId); if (!l || !ids.includes(l.courseId)) return;
        const add = (txt, where) => passages.push({ txt, lessonId: l.id, courseId: l.courseId, lessonTitle: l.title, where, boost: l.id === lessonId ? 1.5 : 1 });
        if (b.type === 'text') b.data.markdown.split('\n').filter((x) => x.trim().length > 20).forEach((x) => add(x.replace(/[#>*]/g, '').trim(), 'Nội dung bài'));
        if (b.type === 'process') b.data.steps.forEach((s, i) => add(`${s.title}: ${s.text}`, `Quy trình · Bước ${i + 1}`));
        if (b.type === 'video') (b.data.transcript || []).forEach((t) => add(t.text, `Video ${LMS.fmt.time(t.t)}`));
        if (b.type === 'pdf') (b.data.outline || []).forEach((t, i) => add(`${t} — ${b.title}`, `Tài liệu trang ${i + 1}`));
      });
      db.questions.filter((q) => ids.includes((byId(db.lessons, q.lessonId) || {}).courseId) && q.explanation).forEach((q) => { const l = byId(db.lessons, q.lessonId); passages.push({ txt: `${q.options.filter((o) => q.correct.includes(o.id)).map((o) => o.text).join('; ')}. ${q.explanation}`, lessonId: l.id, courseId: l.courseId, lessonTitle: l.title, where: 'Giải thích câu hỏi', boost: 0.8 }); });
      const scored = passages.map((p) => ({ ...p, s: terms.reduce((s, t) => s + (p.txt.toLowerCase().includes(t) ? 1 : 0), 0) * p.boost })).filter((p) => p.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
      if (!scored.length) return { answer: 'Mình chưa tìm thấy nội dung liên quan trong các tài liệu bạn được giao. Hãy thử diễn đạt khác, hoặc gửi câu hỏi cho giảng viên ở tab "Hỏi giảng viên" của bài học.', citations: [], found: false };
      return { answer: scored.map((p) => p.txt).join(' '), citations: scored.map((p, i) => ({ n: i + 1, lessonTitle: p.lessonTitle, where: p.where, href: `#/lesson/${p.courseId}/${p.lessonId}` })), found: true };
    }, { latency: [700, 1200] }),
    summarize: (lessonId) => call((db) => {
      C.require('learn'); const l = byId(db.lessons, lessonId); if (!l) throw E.notFound('Bài học');
      const sents = C.lessonText(lessonId).replace(/[#>*]/g, '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 30);
      return { title: l.title, bullets: sents.slice(0, 5), source: l.title };
    }, { latency: [700, 1200] }),
    practice: (lessonId) => call((db) => {
      C.require('learn');
      const qs = db.questions.filter((q) => q.lessonId === lessonId && q.status === 'active');
      return shuffle(qs).slice(0, 3).map((q) => ({ id: q.id, text: q.text, type: q.type, options: q.options, correct: q.correct, explanation: q.explanation }));
    }, { latency: [700, 1200] }),

    /* ---------------- Thông báo ---------------- */
    notifications: () => call((db) => { const u = C.requireUser(); return db.notifications.filter((n) => n.userId === u.id).sort((a, b) => b.at.localeCompare(a.at)); }),
    unreadCount: () => call((db) => { const u = C.me(); return u ? db.notifications.filter((n) => n.userId === u.id && !n.read).length : 0; }, { latency: [10, 30] }),
    markRead: (id) => call((db) => { const u = C.requireUser(); db.notifications.filter((n) => n.userId === u.id && (id == null || n.id === id)).forEach((n) => (n.read = true)); return true; }, { write: true, latency: [40, 90] }),
  };

  function requirementFor(db, lesson, p) {
    if (lesson.quizId) return { ok: false, message: 'Hoàn thành bằng cách đạt bài kiểm tra.' };
    const blocks = db.blocks.filter((b) => b.lessonId === lesson.id);
    const vid = blocks.find((b) => b.type === 'video'); const pdf = blocks.find((b) => b.type === 'pdf');
    const msgs = [];
    if (vid && (p.watchedPct || 0) < 80) msgs.push(`xem tối thiểu 80% video (hiện ${p.watchedPct || 0}%)`);
    if (pdf && byId(db.files, pdf.fileId).state === 'ok' && (p.lastPage || 0) < pdf.data.pages) msgs.push(`đọc đến trang cuối tài liệu (hiện ${p.lastPage || 0}/${pdf.data.pages})`);
    return msgs.length ? { ok: false, message: 'Cần ' + msgs.join(' và ') + ' để hoàn thành.' } : { ok: true, message: 'Đã đủ điều kiện hoàn thành.' };
  }
})(window.LMS);
