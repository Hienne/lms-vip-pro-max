/* ==========================================================================
   api/auth.js — AuthService (mô phỏng). Production: Supabase Auth / SSO nội bộ.
   Mockup không lưu mật khẩu: mọi mật khẩu ≥ 6 ký tự được chấp nhận cho tài khoản demo.
   ========================================================================== */
(function (LMS) {
  const C = LMS.apiCore;
  const { call, E, byId, audit } = C;

  LMS.api.auth = {
    login: (email, password) => call((db) => {
      const errs = {};
      if (!String(email || '').trim()) errs.email = 'Nhập email đăng nhập.';
      if (String(password || '').length < 6) errs.password = 'Mật khẩu tối thiểu 6 ký tự.';
      if (Object.keys(errs).length) throw E.invalid('Vui lòng kiểm tra lại thông tin đăng nhập.', errs);
      const u = db.users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!u) throw new C.ApiError(401, 'Email hoặc mật khẩu không đúng.');
      if (u.status === 'locked') throw new C.ApiError(423, 'Tài khoản đã bị khóa. Liên hệ quản trị viên đơn vị để được hỗ trợ.');
      if (u.status === 'suspended') throw new C.ApiError(423, 'Tài khoản đang tạm dừng. Liên hệ quản trị viên đơn vị.');
      return loginAs(db, u);
    }, { write: true, latency: [500, 800] }),
    loginDemo: (userId) => call((db) => { const u = byId(db.users, userId); if (!u) throw E.notFound('Tài khoản'); if (u.status !== 'active') throw new C.ApiError(423, 'Tài khoản đã bị khóa.'); return loginAs(db, u); }, { write: true, latency: [250, 400] }),
    logout: () => call(() => { const u = C.me(); if (u) audit(u.id, 'logout', 'Phiên đăng nhập', 'Đăng xuất'); LMS.store.session.clear(); return true; }, { write: true, latency: [100, 200] }),
    profile: () => call((db) => { const u = C.requireUser(); return { ...u, unitName: (byId(db.units, u.unitId) || {}).name, groupName: (byId(db.groups, u.groupId) || {}).name, roleLabel: C.ROLE_LABEL[u.role], perms: C.PERMS[u.role], scopeName: u.adminScope ? byId(db.units, u.adminScope).name : (u.role === 'admin' || u.role === 'viewer' ? 'Toàn hệ thống' : (byId(db.units, u.unitId) || {}).name) }; }),
    updateProfile: (data) => call((db) => {
      const u = C.requireUser();
      const name = String(data.name || '').trim(); if (name.length < 2) throw E.invalid('Họ tên không hợp lệ.', { name: 'Họ tên tối thiểu 2 ký tự.' });
      // Chỉ cho phép sửa trường cá nhân — vai trò/đơn vị bị bỏ qua dù client gửi lên
      const me = byId(db.users, u.id); me.name = name; me.title = String(data.title || me.title).trim();
      audit(u.id, 'update', 'Hồ sơ cá nhân', 'Cập nhật họ tên/chức danh'); return me;
    }, { write: true }),
    changePassword: (cur, next, confirm) => call(() => {
      const u = C.requireUser(); const errs = {};
      if (String(cur || '').length < 6) errs.cur = 'Nhập mật khẩu hiện tại.';
      if (String(next || '').length < 8 || !/[A-Z]/.test(next) || !/\d/.test(next)) errs.next = 'Tối thiểu 8 ký tự, gồm chữ hoa và chữ số.';
      if (next !== confirm) errs.confirm = 'Mật khẩu nhập lại không khớp.';
      if (Object.keys(errs).length) throw E.invalid('Vui lòng kiểm tra lại.', errs);
      audit(u.id, 'password', 'Tài khoản', 'Đổi mật khẩu'); return true;
    }, { write: true }),
    demoAccounts: () => call((db) => db.users.filter((u) => ['a1', 'a2', 'i1', 'v1', 'l1', 'l4'].includes(u.id)).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, roleLabel: C.ROLE_LABEL[u.role] + (u.adminScope ? ' đơn vị' : ''), unit: (byId(db.units, u.unitId) || {}).name })), { latency: [40, 80] }),
  };

  function loginAs(db, u) {
    u.lastLoginAt = new Date().toISOString();
    LMS.store.session.set({ userId: u.id, token: 'mock.' + Math.random().toString(36).slice(2), exp: Date.now() + db.settings.sessionMinutes * 60000 });
    LMS.store.net.sessionExpired = false;
    audit(u.id, 'login', 'Phiên đăng nhập', 'Đăng nhập thành công');
    C.touchActivity(u.id);
    return { id: u.id, role: u.role };
  }
})(window.LMS);
