/* ==========================================================================
   core/store.js — "cơ sở dữ liệu" mô phỏng + trạng thái phiên
   Mockup: lưu localStorage để demo dữ liệu bền vững qua reload.
   Production: thay toàn bộ bằng DB thật (Supabase/PostgreSQL…) phía sau api.*
   React: Context/Zustand  ·  Angular: @Injectable() service với signals
   ========================================================================== */
(function (LMS) {
  const KEY = 'cbacademy.db.v2';
  const SESSION_KEY = 'cbacademy.session.v2';
  const PREF_KEY = 'cbacademy.prefs.v2';

  const safeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const safeDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* noop */ } };

  let db = null;
  function load() {
    const raw = safeGet(KEY);
    if (raw) { try { const parsed = JSON.parse(raw); if (parsed.version === 2) { db = parsed; return db; } } catch (e) { /* corrupt → reseed */ } }
    db = LMS.seed(); persist(); return db;
  }
  function persist() { safeSet(KEY, JSON.stringify(db)); }
  function reset() { db = LMS.seed(); persist(); }

  /* ---- Session (mock JWT) ---- */
  const session = {
    get() { try { return JSON.parse(safeGet(SESSION_KEY) || 'null'); } catch (e) { return null; } },
    set(s) { safeSet(SESSION_KEY, JSON.stringify(s)); },
    clear() { safeDel(SESSION_KEY); },
  };

  /* ---- Prefs (theme, sidebar) — tiện ích theo người xem ---- */
  const prefs = {
    get() { try { return JSON.parse(safeGet(PREF_KEY) || '{}'); } catch (e) { return {}; } },
    set(patch) { safeSet(PREF_KEY, JSON.stringify({ ...prefs.get(), ...patch })); },
  };

  /* ---- Pub/sub đơn giản cho UI (badge thông báo, user menu…) ---- */
  const subs = new Set();
  const emit = (evt) => subs.forEach((fn) => fn(evt));
  const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

  /* ---- Mô phỏng mạng (để demo trạng thái tải / lỗi / hết phiên) ---- */
  const net = { offline: false, sessionExpired: false, latency: [180, 420] };

  LMS.store = { load, persist, reset, get db() { return db || load(); }, session, prefs, subscribe, emit, net };
})(window.LMS);
