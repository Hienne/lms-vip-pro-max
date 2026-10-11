/* ==========================================================================
   main.js — khởi động ứng dụng + xử lý lỗi toàn cục
   ========================================================================== */
(function (LMS) {
  const { html } = LMS;

  /** Xử lý lỗi API thống nhất: hết phiên / mất mạng / thiếu quyền / dữ liệu sai */
  LMS.handleError = (err, scope) => {
    if (!err) return;
    if (err.status === 401) return LMS.sessionExpired();
    if (err.status === 0) return LMS.ui.notify.warning('Mất kết nối mạng', 'Thao tác chưa được lưu. Hãy thử lại khi có mạng.');
    if (err.status === 403) return LMS.ui.notify.error('Không đủ quyền', err.message);
    if (err.status === 422) {
      const form = scope && scope.querySelector ? (scope.matches && scope.matches('form') ? scope : scope.querySelector('form')) : null;
      if (form && err.details) LMS.ui.showErrors(form, err.details, err.message);
      else LMS.ui.notify.warning('Chưa thể thực hiện', err.message);
      return;
    }
    if (err.status === 404) return LMS.ui.notify.error('Không tìm thấy', err.message);
    console.error(err);
    LMS.ui.notify.error('Đã có lỗi xảy ra', err.message || 'Vui lòng thử lại.');
  };

  let expiredOpen = false;
  LMS.sessionExpired = async () => {
    if (expiredOpen) return; expiredOpen = true;
    const back = location.hash.slice(1);
    await LMS.ui.modal({ title: 'Phiên đăng nhập đã hết hạn', icon: 'clock', tone: 'warning', dismissible: false, body: html`<p>Để bảo mật, phiên làm việc tự kết thúc sau một thời gian không hoạt động. Tiến độ đã được lưu — đăng nhập lại để tiếp tục đúng trang đang xem.</p>`, actions: [{ label: 'Đăng nhập lại', variant: 'primary', value: true }] });
    expiredOpen = false;
    LMS.store.session.clear(); LMS.store.net.sessionExpired = false; LMS.shell.invalidate();
    location.hash = '#/login?next=' + encodeURIComponent(back);
  };

  window.addEventListener('online', () => { LMS.store.net.offline = false; LMS.shell.invalidate(); LMS.router.resolve(); });
  window.addEventListener('offline', () => { LMS.store.net.offline = true; LMS.shell.invalidate(); LMS.router.resolve(); });

  function boot() {
    const theme = LMS.store.prefs.get().theme;
    if (theme) document.documentElement.dataset.theme = theme;
    LMS.store.load();
    if (!location.hash) location.replace('#/');
    LMS.router.resolve();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.LMS);
