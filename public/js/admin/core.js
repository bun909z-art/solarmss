/* Admin Core: API helper, xác thực phiên, toast & Live Preview */
'use strict';

'use strict';

  const $ = id => document.getElementById(id);
  var TOKEN_KEY = 'hq_admin_token_v1';

  var CONFIG = null;
  var PRESETS = {};
  var PRODUCTS = [];
  var NEWS = [];
  var LEADS = [];
  var USERS = [];
  var CURRENT_USER = null;
  var PERM_LABELS = [
    ['branding', 'Thương hiệu'],
    ['home', 'Trang chủ'],
    ['theme', 'Giao diện'],
    ['layout', 'Bố cục'],
    ['tariffs', 'EVN & Mặc định'],
    ['products', 'Kho sản phẩm'],
    ['news', 'Tin tức'],
    ['leads', 'Khách hàng'],
    ['footer', 'Chân trang'],
    ['security', 'Sao lưu & Bảo trì']
  ];
  var leadSearchQ = '';
  var leadStatusFilter = 'all';
  var newNewsImgUrl = '';
  var prodFilter = 'all';
  let dirty = false;

  function getStoredToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  }
  function setStoredToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function setDirty(val) {
    dirty = val;
    if ($('dirtyPill')) $('dirtyPill').hidden = !val;
  }

  function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function pushPreview() {
    const frame = $('previewFrame');
    if (frame && frame.contentWindow && CONFIG) {
      frame.contentWindow.postMessage({ type: 'HQ_PREVIEW_CONFIG', config: CONFIG, products: PRODUCTS }, '*');
    }
  }

  async function api(url, opts = {}) {
    const token = getStoredToken();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
      credentials: 'same-origin',
      ...opts,
      headers
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Lỗi máy chủ (${res.status}).`);
    return data;
  }

  // ---------- AUTH ----------
  function setAuthView(authed) {
    const ls = $('loginScreen'), app = $('adminApp');
    if (ls) { ls.hidden = authed; ls.style.display = authed ? 'none' : 'grid'; }
    if (app) { app.hidden = !authed; app.style.display = authed ? 'flex' : 'none'; }
  }

  async function checkSession() {
    try {
      const me = await api('/api/admin/me');
      if (me.authenticated) {
        setAuthView(true);
        await loadAdminData();
      } else {
        setStoredToken('');
        setAuthView(false);
      }
    } catch (err) {
      setAuthView(false);
      if ($('loginErr') && err && err.message) $('loginErr').textContent = err.message;
    }
  }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('loginErr').textContent = '';
    try {
      const res = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: ($('loginUser') ? $('loginUser').value.trim() : 'admin'), password: $('loginPass').value })
      });
      if (res.token) setStoredToken(res.token);
      $('loginPass').value = '';
      setAuthView(true);
      await loadAdminData();
    } catch (err) {
      $('loginErr').textContent = err.message || 'Đăng nhập thất bại.';
    }
  });

  $('btnLogout').onclick = async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
    setStoredToken('');
    if ($('loginErr')) $('loginErr').textContent = '';
    if ($('loginPass')) $('loginPass').value = '';
    setAuthView(false);
  };

  // ---------- LOAD & POPULATE ----------
  async function loadAdminData() {
    try {
      if (!CURRENT_USER) {
        const me = await api('/api/admin/me').catch(() => null);
        if (me && me.user) CURRENT_USER = me.user;
      }
      const isSuper = !CURRENT_USER || CURRENT_USER.role === 'admin';
      const perms = isSuper ? PERM_LABELS.map(x => x[0]) : (CURRENT_USER.permissions || []);
      const can = (p) => isSuper || perms.includes(p);

      const [data, prodData, newsData, leadsData, usersData] = await Promise.all([
        api('/api/config'),
        api('/api/products').catch(() => ({ products: [] })),
        can('news') ? api('/api/admin/news').catch(() => ({ articles: [] })) : Promise.resolve({ articles: [] }),
        can('leads') ? api('/api/admin/leads').catch(() => ({ leads: [] })) : Promise.resolve({ leads: [] }),
        isSuper ? api('/api/admin/users').catch(() => ({ users: [] })) : Promise.resolve({ users: [] })
      ]);
      CONFIG = data.config;
      PRESETS = data.presets || {};
      PRODUCTS = Array.isArray(prodData.products) ? prodData.products : [];
      NEWS = Array.isArray(newsData.articles) ? newsData.articles : [];
      LEADS = Array.isArray(leadsData.leads) ? leadsData.leads : [];
      USERS = Array.isArray(usersData.users) ? usersData.users : [];
      applyPermissionsUI();
      if ($('nn_date') && !$('nn_date').value) $('nn_date').value = new Date().toISOString().slice(0, 10);
      renderPresets();
      populateForm();
      setDirty(false);
      pushPreview();
    } catch (err) {
      toast('Lỗi tải dữ liệu cấu hình: ' + (err.message || err));
    }
  }
