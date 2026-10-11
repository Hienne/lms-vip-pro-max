/* ==========================================================================
   api/reports.js — ReportService: mọi số liệu tính từ dữ liệu, không viết cứng
   ========================================================================== */
(function (LMS) {
  const C = LMS.apiCore;
  const { call, byId } = C;

  function facts(db, u, f = {}) {
    const s = C.unitScope(u);
    const learners = db.users.filter((x) => x.role === 'learner' && (s == null || x.unitId === s) && (!f.unitId || x.unitId === f.unitId) && (!f.groupId || x.groupId === f.groupId));
    const rows = [];
    learners.forEach((l) => C.myCourseIds(l).forEach((cid) => {
      const c = byId(db.courses, cid); const prog = byId(db.programs, c.programId);
      if (f.programId && c.programId !== f.programId) return;
      if (f.courseId && cid !== f.courseId) return;
      const p = C.courseProgress(l.id, cid);
      if (f.from && p.lastAccessAt && new Date(p.lastAccessAt) < new Date(f.from)) return;
      rows.push({ user: l, course: c, program: prog, unit: byId(db.units, l.unitId), group: byId(db.groups, l.groupId), p });
    }));
    return { learners, rows };
  }
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const summarize = (rows) => ({
    enrolments: rows.length, completed: rows.filter((r) => r.p.status === 'completed').length, inProgress: rows.filter((r) => r.p.status === 'in_progress').length, notStarted: rows.filter((r) => r.p.status === 'not_started').length, failed: rows.filter((r) => r.p.status === 'failed').length, overdue: rows.filter((r) => r.p.overdue).length,
    pct: avg(rows.map((r) => r.p.pct)), avgScore: (() => { const s = rows.filter((r) => r.p.quiz && r.p.quiz.best != null).map((r) => r.p.quiz.best); return s.length ? avg(s) : null; })(),
    passRate: (() => { const q = rows.filter((r) => r.p.quiz && r.p.quiz.attempts); return q.length ? Math.round((q.filter((r) => r.p.quiz.passed).length / q.length) * 100) : null; })(),
  });

  LMS.api.reports = {
    overview: (f = {}) => call((db) => {
      const u = C.require('reports.read', 'xem báo cáo');
      const { learners, rows } = facts(db, u, f);
      const by = (keyFn, nameFn) => { const m = new Map(); rows.forEach((r) => { const k = keyFn(r); if (!m.has(k)) m.set(k, { id: k, name: nameFn(r), rows: [] }); m.get(k).rows.push(r); }); return [...m.values()].map((g) => ({ id: g.id, name: g.name, ...summarize(g.rows) })); };
      const comp = db.competencies.map((k) => { const vals = learners.map((l) => C.competency(l.id).find((x) => x.name === k)).filter((x) => x && x.answered); return { name: k, value: vals.length ? avg(vals.map((v) => v.value)) : 0, n: vals.length }; });
      const weeks = Array.from({ length: 8 }, (_, i) => { const end = Date.now() - (7 - i) * 7 * 86400000; const start = end - 7 * 86400000; const done = db.progress.filter((p) => learners.some((l) => l.id === p.userId) && p.completedAt && new Date(p.completedAt) > start && new Date(p.completedAt) <= end).length; return { label: i === 7 ? 'Tuần này' : `T-${7 - i}`, value: done }; });
      return {
        scope: C.unitScope(u) ? byId(db.units, C.unitScope(u)).name : 'Toàn hệ thống',
        total: { learners: learners.length, ...summarize(rows) },
        byUnit: by((r) => r.unit.id, (r) => r.unit.name), byGroup: by((r) => r.group.id, (r) => r.group.name), byCourse: by((r) => r.course.id, (r) => r.course.title), byProgram: by((r) => r.program.id, (r) => r.program.name),
        competency: comp, weeks,
        filters: { units: db.units.filter((x) => C.inScope(u, x.id)), groups: db.groups.filter((g) => C.inScope(u, g.unitId)), programs: db.programs, courses: db.courses.filter((c) => c.status === 'published') },
        canEdit: C.can(u, 'assign.manage'),
      };
    }),
    detail: (dim, f = {}) => call((db) => {
      const u = C.require('reports.read', 'xem báo cáo');
      const { learners, rows } = facts(db, u, f);
      if (dim === 'learners') return learners.map((l) => { const rs = rows.filter((r) => r.user.id === l.id); const best = rs.map((r) => r.p.quiz && r.p.quiz.best).filter((x) => x != null); return { id: l.id, name: l.name, email: l.email, unit: (byId(db.units, l.unitId) || {}).name, group: (byId(db.groups, l.groupId) || {}).name, status: l.status, courses: rs.length, completed: rs.filter((r) => r.p.status === 'completed').length, overdue: rs.filter((r) => r.p.overdue).length, failed: rs.filter((r) => r.p.status === 'failed').length, pct: avg(rs.map((r) => r.p.pct)), avgScore: best.length ? avg(best) : null, lastAccess: rs.map((r) => r.p.lastAccessAt).filter(Boolean).sort().pop() || null }; });
      if (dim === 'status') return rows.map((r) => ({ id: `${r.user.id}-${r.course.id}`, name: r.user.name, unit: r.unit.name, group: r.group.name, course: r.course.title, status: r.p.status, overdue: r.p.overdue, pct: r.p.pct, dueAt: r.p.dueAt, startedAt: r.p.startedAt, completedAt: r.p.completedAt, lastAccess: r.p.lastAccessAt }));
      if (dim === 'results') return db.attempts.filter((a) => a.submittedAt && learners.some((l) => l.id === a.userId)).map((a) => { const l = byId(db.users, a.userId); const q = byId(db.quizzes, a.quizId); return { id: a.id, name: l.name, unit: (byId(db.units, l.unitId) || {}).name, quiz: q.title, score: a.score, passed: a.passed, nth: C.attemptsOf(l.id, q.id).findIndex((x) => x.id === a.id) + 1, at: a.submittedAt, auto: a.autoSubmitted }; }).sort((a, b) => b.at.localeCompare(a.at));
      if (dim === 'competency') return learners.map((l) => ({ id: l.id, name: l.name, unit: (byId(db.units, l.unitId) || {}).name, ...Object.fromEntries(C.competency(l.id).map((c) => [c.name, c.answered ? c.value : null])) }));
      const key = { courses: 'course', programs: 'program', groups: 'group', units: 'unit' }[dim];
      const m = new Map(); rows.forEach((r) => { const k = r[key].id; if (!m.has(k)) m.set(k, { id: k, name: r[key].name || r[key].title, rows: [] }); m.get(k).rows.push(r); });
      return [...m.values()].map((g) => ({ id: g.id, name: g.name, learners: new Set(g.rows.map((r) => r.user.id)).size, ...summarize(g.rows) }));
    }),
  };
})(window.LMS);
