(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const TOKEN_KEY = 'hq_admin_token_v1';
  const EDITOR_KEYS = ['branding', 'theme', 'hero', 'sections', 'defaults', 'tariffs', 'footer'];
  const TAB_INFO = {
    overview: ['Tổng quan', 'Theo dõi khách mới và yêu cầu báo giá.'],
    leads: ['Khách hàng', 'Theo dõi yêu cầu tư vấn và trạng thái chăm sóc.'],
    branding: ['Thương hiệu', 'Cập nhật logo, tên doanh nghiệp và thông tin liên hệ.', '/?preview=1'],
    theme: ['Màu sắc & banner', 'Tùy chỉnh bảng màu, kiểu chữ và banner tư vấn.', '/?preview=1'],
    layout: ['Bố cục & tiêu đề', 'Chọn thông tin hiển thị trên công cụ tính pin.', '/?preview=1'],
    tariffs: ['Thông số & biểu giá', 'Thiết lập thông số tính pin và các bậc giá điện.', '/?preview=1'],
    footer: ['Chân trang', 'Sửa phần liên hệ và lưu ý cho khách hàng.', '/?preview=1'],
    gsheet: ['Google Sheets', 'Thiết lập đồng bộ và theo dõi các lần kết nối.'],
    security: ['Sao lưu & bảo trì', 'Bảo trì trang tư vấn và sao lưu hồ sơ.'],
    users: ['Phân quyền & dữ liệu', 'Cấp quyền cho nhân viên và quản lý kết nối hệ thống.'],
    account: ['Tài khoản của tôi', 'Xem thông tin và đổi mật khẩu.']
  };

  let CONFIG = null;
  let savedEditorConfig = null;
  let PRESETS = {};
  let LEADS = [];
  let USERS = [];
  let datasetReady = {};
  let CURRENT_USER = null;
  const PERM_LABELS = [
    ['branding', 'Thương hiệu'],
    ['theme', 'Giao diện'],
    ['layout', 'Bố cục'],
    ['tariffs', 'EVN & Mặc định'],
    ['leads', 'Khách hàng'],
    ['footer', 'Chân trang'],
    ['gsheet', 'Google Sheets'],
    ['security', 'Sao lưu & Bảo trì']
  ];
  let leadRecordId = '';
  let dirty = false;
  let editRevision = 0;
  let configSaving = false;
  let activeTab = '';
  let previewOpen = !window.matchMedia('(max-width: 980px)').matches;

  function can(permission) {
    return Boolean(CURRENT_USER && (CURRENT_USER.role === 'admin' || CURRENT_USER.permissions?.includes(permission)));
  }

  function normalizeSearch(value) {
    return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/đ/g, 'd').trim();
  }

  function editorConfig() {
    return Object.fromEntries(EDITOR_KEYS.map(key => [key, CONFIG[key]]));
  }

  function snapshotEditorConfig() {
    return JSON.parse(JSON.stringify(editorConfig()));
  }

  function configChanges(before, after) {
    const patch = {}, expectedConfig = {};
    for (const key of EDITOR_KEYS) {
      for (const [field, value] of Object.entries(after[key] || {})) {
        const previous = before[key]?.[field];
        if (JSON.stringify(value) === JSON.stringify(previous)) continue;
        (patch[key] ||= {})[field] = value;
        (expectedConfig[key] ||= {})[field] = previous;
      }
    }
    return { patch, expectedConfig };
  }

  function authHeaders(headers = {}) {
    const token = getStoredToken();
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  }

  function downloadFile(blob, filename) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function openOverviewList(filter, lead) {
    leadRecordId = lead?.id || '';
    $('leadSearch').value = lead?.customerName || '';
    $('leadStatusFilter').value = filter;
    $('leadAssigneeFilter').value = 'all';
    $('leadAgeFilter').value = 'all';
    renderLeadsList();
    const button = tabs.find(item => item.dataset.tab === 'leads');
    selectTab(button);
    button.focus();
  }

  function renderOverview() {
    const cards = [
      ['leads', 'new', LEADS.filter(lead => !lead.status || lead.status === 'new').length, 'Khách mới', 'Chờ liên hệ'],
      ['leads', 'quoted', LEADS.filter(lead => lead.status === 'quoted').length, 'Đã báo giá', 'Theo dõi phản hồi'],
      ['leads', 'quote_requested', LEADS.filter(lead => lead.quoteRequestedAt).length, 'Yêu cầu báo giá', 'Hồ sơ khách gửi']
    ];
    const actions = $('overviewActions');
    actions.innerHTML = cards.filter(([tab]) => can(tab)).map(([tab, filter, count, title, note]) => `
      <button type="button" class="overview-card" data-overview-tab="${tab}" data-overview-filter="${filter}">
        <span>${title}</span><strong>${datasetReady[tab] ? count : '—'}</strong><small>${datasetReady[tab] ? note : 'Chưa tải được dữ liệu'}</small>
      </button>`).join('');
    actions.querySelectorAll('[data-overview-tab]').forEach(btn => {
      btn.onclick = () => openOverviewList(btn.dataset.overviewFilter);
    });

    const recent = $('overviewRecent');
    recent.hidden = !can('leads');
    if (recent.hidden) return;
    const statusNames = { new: 'Mới', contacted: 'Đã liên hệ', quoted: 'Đã báo giá', closed: 'Đã chốt', cancelled: 'Đã hủy' };
    const latest = [...LEADS].sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))).slice(0, 5);
    const list = $('overviewRecentList');
    list.innerHTML = latest.map((lead, index) => `
      <button type="button" class="overview-row" data-overview-lead="${index}">
        <strong>${escapeAttr(lead.customerName)}</strong><span>${escapeAttr(fmtLeadTime(lead.updatedAt || lead.createdAt))}</span><span class="adm-tag">${statusNames[lead.status] || 'Mới'}</span>
      </button>`).join('') || `<p class="hint adm-empty">${datasetReady.leads ? 'Chưa có hồ sơ tư vấn.' : 'Không tải được hồ sơ tư vấn.'}</p>`;
    list.querySelectorAll('[data-overview-lead]').forEach(btn => {
      btn.onclick = () => openOverviewList('all', latest[Number(btn.dataset.overviewLead)]);
    });
  }

  function getStoredToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  }
  function setStoredToken(t) {
    try {
      if (t) { sessionStorage.setItem(TOKEN_KEY, t); localStorage.setItem(TOKEN_KEY, t); }
      else { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); }
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
    if (val) editRevision++;
    $('dirtyPill').hidden = !val;
    $('btnSave').disabled = !dirty || configSaving;
  }

  function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function pushPreview() {
    const frame = $('previewFrame');
    if (frame.contentWindow && CONFIG && !$('adminPreview').hidden) {
      const config = { ...editorConfig(), maintenance: CONFIG.maintenance, updatedAt: CONFIG.updatedAt };
      frame.contentWindow.postMessage({ type: 'HQ_PREVIEW_CONFIG', config }, window.location.origin);
    }
  }

  async function api(url, opts = {}) {
    const headers = authHeaders({ 'Content-Type': 'application/json', ...opts.headers });
    const res = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      ...opts,
      headers
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Lỗi máy chủ (${res.status}).`);
    return data;
  }

  // ---------- AUTH ----------
  function setAuthView(authed) {
    $('loginScreen').hidden = authed;
    $('adminApp').hidden = !authed;
  }

  async function checkSession() {
    try {
      const me = await api('/api/admin/me');
      if (me.authenticated && me.user) {
        CURRENT_USER = me.user;
        setAuthView(true);
        await loadAdminData();
      } else {
        CURRENT_USER = null;
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
    if ($('btnLogin').disabled) return;
    setStoredToken('');
    CURRENT_USER = null;
    const unameVal = $('loginUser') ? $('loginUser').value.trim() : '';
    if (!unameVal) { $('loginErr').textContent = 'Vui lòng nhập tên đăng nhập.'; return; }
    $('btnLogin').disabled = true;
    $('btnLogin').textContent = 'Đang đăng nhập…';
    try {
      const res = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: unameVal, password: $('loginPass').value })
      });
      if (res.token) setStoredToken(res.token);
      CURRENT_USER = res.user || null;
      $('loginPass').value = '';
      setAuthView(true);
      await loadAdminData();
    } catch (err) {
      $('loginErr').textContent = err.message || 'Đăng nhập thất bại.';
    } finally {
      $('btnLogin').disabled = false;
      $('btnLogin').textContent = 'Đăng nhập';
    }
  });

  $('btnLogout').onclick = async () => {
    $('btnLogout').disabled = true;
    try {
      await api('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      toast('Không thể đăng xuất. ' + err.message);
      $('btnLogout').disabled = false;
      return;
    }
    CURRENT_USER = null;
    USERS = [];
    setStoredToken('');
    if ($('loginErr')) $('loginErr').textContent = '';
    if ($('loginUser')) $('loginUser').value = '';
    if ($('loginPass')) $('loginPass').value = '';
    setAuthView(false);
    try { window.location.replace('/admin'); } catch {}
  };

  // ---------- LOAD & POPULATE ----------
  async function loadAdminData() {
    try {
      if (!CURRENT_USER) {
        const me = await api('/api/admin/me').catch(() => null);
        if (me && me.user) CURRENT_USER = me.user;
      }
      const isSuper = Boolean(CURRENT_USER && CURRENT_USER.role === 'admin');

      const [data, leadsData, usersData, tgData] = await Promise.all([
        api('/api/config'),
        can('leads') ? api('/api/admin/leads').catch(() => null) : null,
        isSuper ? api('/api/admin/users').catch(() => ({ users: [] })) : Promise.resolve({ users: [] }),
        isSuper ? api('/api/admin/telegram').catch(() => ({ telegram: {} })) : Promise.resolve({ telegram: {} })
      ]);
      CONFIG = data.config;
      savedEditorConfig = snapshotEditorConfig();
      const brand = CONFIG.branding;
      document.title = `Quản trị website – ${brand.companyName || 'Công Ty TNHH Mai Sơn Solar'}`;
      $('adminBrandLogo').src = brand.logoUrl || '/assets/logo-default.jpg?v=mss';
      $('adminBrandLogo').alt = brand.companyName || 'Công Ty TNHH Mai Sơn Solar';
      $('adminFavicon').href = brand.faviconUrl || '/assets/favicon.png?v=mss';
      PRESETS = data.presets || {};
      datasetReady = { leads: Array.isArray(leadsData?.leads) };
      LEADS = datasetReady.leads ? leadsData.leads : [];
      USERS = Array.isArray(usersData.users) ? usersData.users : [];
      const tg = (tgData && tgData.telegram) || {};
      setChk('tg_enabled', Boolean(tg.enabled));
      setVal('tg_botToken', tg.botToken || '');
      setVal('tg_chatId', tg.chatId || '');
      applyPermissionsUI();
      renderPresets();
      populateForm();
      renderLeadsList();
      updateMaintUI();
      setDirty(false);
      pushPreview();
      if (can('gsheet')) {
        loadGsheetSettings();
        fetchGsheetStatus();
      }
      return true;
    } catch (err) {
      toast('Lỗi tải dữ liệu cấu hình: ' + (err.message || err));
      return false;
    }
  }

  function renderPresets() {
    const grid = $('presetGrid');
    if (!grid || !CONFIG) return;
    grid.innerHTML = Object.entries(PRESETS).map(([key, p]) => `
      <button type="button" class="preset-card${CONFIG.theme.preset === key ? ' active' : ''}" data-preset="${key}">
        <div class="preset-swatches">
          <span style="background:${p.primary}"></span>
          <span style="background:${p.gradientEnd}"></span>
          <span style="background:${p.bg}"></span>
          <span style="background:${p.ink}"></span>
        </div>
        <span class="preset-name">${p.name}</span>
      </button>
    `).join('');

    grid.querySelectorAll('[data-preset]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.preset;
        const p = PRESETS[key];
        if (!p) return;
        CONFIG.theme = {
          ...CONFIG.theme,
          preset: key,
          primary: p.primary,
          primaryDeep: p.primaryDeep,
          gradientEnd: p.gradientEnd,
          bg: p.bg,
          cardBg: p.cardBg,
          ink: p.ink,
          inkMuted: p.inkMuted,
          dayColor: p.dayColor,
          nightColor: p.nightColor,
          accentGood: p.accentGood,
          darkMode: Boolean(p.darkMode)
        };
        renderPresets();
        populateForm();
        setDirty(true);
        pushPreview();
      };
    });
  }

  function setVal(id, v) { if ($(id)) $(id).value = v ?? ''; }
  function setChk(id, v) { if ($(id)) $(id).checked = Boolean(v); }

  function syncPaletteControls() {
    ['t_darkMode', 't_cardBg', 't_ink', 't_inkMuted'].forEach(id => {
      $(id).disabled = CONFIG.theme.autoPalette === true;
    });
  }

  function populateForm() {
    const { branding: b, hero: h, theme: t, sections: s, defaults: d, tariffs: tar, footer: f } = CONFIG;

    if ($('logoPreview')) $('logoPreview').src = b.logoUrl || '/assets/logo-default.jpg?v=mss';
    setVal('b_logoHeight', b.logoHeight || 54);
    if ($('logoHeightVal')) $('logoHeightVal').textContent = b.logoHeight || 54;
    setVal('b_siteTitle', b.siteTitle || '');
    setVal('b_companyName', b.companyName || '');
    setChk('b_showAdminLink', b.showAdminLink === true);
    setChk('b_showHotline', b.showHotline !== false);
    setVal('b_hotlineLabel', b.hotlineLabel || '');
    renderHotlineEditor();

    setChk('t_darkMode', Boolean(t.darkMode));
    setChk('t_autoPalette', t.autoPalette === true);
    syncPaletteControls();
    setVal('t_primary', t.primary || '#F26A1B');
    setVal('t_primaryDeep', t.primaryDeep || '#D9560B');
    setVal('t_gradientEnd', t.gradientEnd || '#FFB400');
    setVal('t_bg', t.bg || '#F3F5F9');
    setVal('t_cardBg', t.cardBg || '#FFFFFF');
    setVal('t_ink', t.ink || '#111827');
    setVal('t_inkMuted', t.inkMuted || '#4B5563');
    setVal('t_dayColor', t.dayColor || '#F59E0B');
    setVal('t_nightColor', t.nightColor || '#1E293B');
    setVal('t_radius', t.radius ?? 18);
    if ($('radiusVal')) $('radiusVal').textContent = t.radius ?? 18;
    setVal('t_maxWidth', t.maxWidth ?? 1160);
    if ($('maxWidthVal')) $('maxWidthVal').textContent = t.maxWidth ?? 1160;
    setVal('t_fontFamily', t.fontFamily || 'system');
    setChk('t_stickyResult', t.stickyResult !== false);

    setChk('h_show', h.show !== false);
    setVal('h_style', h.style || 'gradient');
    setVal('h_align', h.align || 'left');
    setVal('h_badge', h.badge || '');
    setVal('h_title', h.title || '');
    setVal('h_subtitle', h.subtitle || '');

    [
      'showCustomerName', 'showCustomerPhone', 'showCustomerAddress', 'showQuickChips',
      'showSliders', 'showAdvancedSettings', 'showDayNightBar', 'showCalcSteps',
      'showTierTable', 'showScenarioTable',
      'showContactCta', 'showFooterNotes'
    ].forEach(k => setChk('s_' + k, s[k] !== false));

    [
      'card1Title', 'card2Title', 'resultTitle', 'tierTableTitle',
      'scenarioTableTitle'
    ].forEach(k => setVal('s_' + k, s[k] || ''));

    setVal('d_mode', d.mode || 'bill');
    setVal('d_bill', d.bill ?? 2000000);
    setVal('d_kwh', d.kwh ?? 625);
    setVal('d_mod', d.mod ?? 5.12);
    setVal('d_eve', d.eve ?? 70);
    setVal('d_dod', d.dod ?? 90);
    setVal('d_eff', d.eff ?? 95);
    setVal('d_vat', d.vat ?? 8);
    setVal('d_days', d.days ?? 30);
    setVal('d_billChips', (d.billChips || []).join(', '));
    setVal('d_kwhChips', (d.kwhChips || []).join(', '));
    setVal('d_scenarios', (d.scenarios || []).join(', '));
    setVal('tar_note', tar.note || '');
    renderTierEditor();

    setVal('f_companyLine', f.companyLine || '');
    setVal('f_notesTitle', f.notesTitle || '');
    setVal('f_ctaTitle', f.ctaTitle || '');
    setVal('f_ctaSubtitle', f.ctaSubtitle || '');
    setVal('f_ctaAddress', f.ctaAddress || '');
    setVal('f_callBtnText', f.callBtnText || 'Gọi ngay');
    setVal('f_zaloBtnText', f.zaloBtnText || 'Chat Zalo');
    renderSalesContacts();
    
    renderNotesEditor();
  }

  
  // ---------- DYNAMIC LIST EDITORS ----------
  function renderContactEditor(id, contacts, namePlaceholder) {
    const editor = $(id);
    editor.innerHTML = contacts.map((contact, i) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px" data-contact-index="${i}">
        <div style="display:flex;gap:6px">
          <input type="text" class="f-input" data-contact-field="label" value="${escapeAttr(contact.label)}" aria-label="Tên hoặc vai trò" placeholder="${namePlaceholder}">
          <button type="button" class="del-btn" data-delete-contact aria-label="Xóa liên hệ ${i + 1}">×</button>
        </div>
        <div class="two-col">
          <input type="tel" class="f-input" data-contact-field="number" value="${escapeAttr(contact.number)}" aria-label="Số điện thoại" placeholder="Số điện thoại">
          <input type="tel" class="f-input" data-contact-field="zalo" value="${escapeAttr(contact.zalo ?? contact.tel)}" aria-label="Số Zalo" placeholder="Số Zalo (tùy chọn)">
        </div>
      </div>
    `).join('');

    editor.querySelectorAll('[data-contact-index]').forEach(row => {
      const index = Number(row.dataset.contactIndex);
      row.querySelectorAll('[data-contact-field]').forEach(input => {
        input.oninput = () => {
          const contact = contacts[index];
          const field = input.dataset.contactField;
          contact[field] = field === 'zalo' ? input.value.replace(/\D/g, '') : input.value;
          if (field === 'number') contact.tel = input.value.replace(/[^\d+]/g, '');
          setDirty(true);
          pushPreview();
        };
      });
      row.querySelector('[data-delete-contact]').onclick = () => {
        contacts.splice(index, 1);
        renderContactEditor(id, contacts, namePlaceholder);
        setDirty(true);
        pushPreview();
      };
    });
  }

  function renderHotlineEditor() {
    if (!Array.isArray(CONFIG.branding.hotlines)) CONFIG.branding.hotlines = [];
    renderContactEditor('hotlineEditor', CONFIG.branding.hotlines, 'VD: Tư vấn kỹ thuật');
  }

  function renderSalesContacts() {
    if (!Array.isArray(CONFIG.footer.salesContacts)) CONFIG.footer.salesContacts = [];
    renderContactEditor('salesContactEditor', CONFIG.footer.salesContacts, 'VD: Mai – Báo giá & lắp đặt');
  }

  $('btnAddHotline').onclick = () => {
    CONFIG.branding.hotlines.push({ number: '', tel: '', zalo: '', label: '' });
    renderHotlineEditor();
    $('hotlineEditor').lastElementChild.querySelector('input').focus();
    setDirty(true);
    pushPreview();
  };

  $('btnAddSalesContact').onclick = () => {
    CONFIG.footer.salesContacts.push({ number: '', tel: '', zalo: '', label: '' });
    renderSalesContacts();
    $('salesContactEditor').lastElementChild.querySelector('input').focus();
    setDirty(true);
    pushPreview();
  };


  function renderTierEditor() {
    const el = $('tierEditor');
    if (!el) return;
    const tiers = CONFIG.tariffs.tiers || [];
    el.innerHTML = tiers.map((t, i) => `
      <div class="list-item">
        <input type="text" class="f-input" style="flex:1.2" data-t-label="${i}" value="${escapeAttr(t.label)}" placeholder="Nhãn bậc">
        <input type="number" class="f-input" style="flex:0.8" data-t-size="${i}" value="${t.size ?? ''}" placeholder="∞">
        <input type="number" class="f-input" style="flex:1" data-t-price="${i}" value="${t.price}" placeholder="Giá đ">
        <button type="button" class="del-btn" data-del-tier="${i}" title="Xóa bậc">×</button>
      </div>
    `).join('');
    el.querySelectorAll('[data-t-label]').forEach(inp => {
      inp.oninput = () => { CONFIG.tariffs.tiers[+inp.dataset.tLabel].label = inp.value; setDirty(true); pushPreview(); };
    });
    el.querySelectorAll('[data-t-size]').forEach(inp => {
      inp.oninput = () => {
        const v = inp.value.trim();
        CONFIG.tariffs.tiers[+inp.dataset.tSize].size = v === '' ? null : Math.max(1, Number(v) || 100);
        setDirty(true); pushPreview();
      };
    });
    el.querySelectorAll('[data-t-price]').forEach(inp => {
      inp.oninput = () => {
        CONFIG.tariffs.tiers[+inp.dataset.tPrice].price = Math.max(0, Number(inp.value) || 0);
        setDirty(true); pushPreview();
      };
    });
    el.querySelectorAll('[data-del-tier]').forEach(btn => {
      btn.onclick = () => {
        if (CONFIG.tariffs.tiers.length <= 1) return toast('Cần ít nhất 1 bậc giá điện.');
        CONFIG.tariffs.tiers.splice(+btn.dataset.delTier, 1);
        renderTierEditor(); setDirty(true); pushPreview();
      };
    });
  }

  $('btnAddTier').onclick = () => {
    CONFIG.tariffs.tiers.push({ label: `Bậc ${CONFIG.tariffs.tiers.length + 1}`, size: null, price: 4000 });
    renderTierEditor(); setDirty(true); pushPreview();
  };

  function renderNotesEditor() {
    const el = $('notesEditor');
    if (!el) return;
    const notes = CONFIG.footer.notes || [];
    el.innerHTML = notes.map((n, i) => `
      <div class="list-item">
        <input type="text" class="f-input" data-note="${i}" value="${escapeAttr(n)}">
        <button type="button" class="del-btn" data-del-note="${i}" title="Xóa">×</button>
      </div>
    `).join('');
    el.querySelectorAll('[data-note]').forEach(inp => {
      inp.oninput = () => { CONFIG.footer.notes[+inp.dataset.note] = inp.value; setDirty(true); pushPreview(); };
    });
    el.querySelectorAll('[data-del-note]').forEach(btn => {
      btn.onclick = () => {
        CONFIG.footer.notes.splice(+btn.dataset.delNote, 1);
        renderNotesEditor(); setDirty(true); pushPreview();
      };
    });
  }

  $('btnAddNote').onclick = () => {
    CONFIG.footer.notes.push('Ghi chú mới...');
    renderNotesEditor(); setDirty(true); pushPreview();
  };

  // ---------- CUSTOMER LEADS CRM ----------
  const nfLead = new Intl.NumberFormat('vi-VN');
  function fmtLeadTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('vi-VN');
    } catch { return iso; }
  }

  function getFilteredLeads() {
    const q = normalizeSearch($('leadSearch').value);
    const status = $('leadStatusFilter').value;
    const assignee = $('leadAssigneeFilter').value;
    const days = Number($('leadAgeFilter').value);
    const cutoff = Date.now() - days * 86400000;
    const phoneQuery = /^[+\d .()-]+$/.test(q) ? q.replace(/\D/g, '') : '';
    return LEADS.filter(lead => {
      if (leadRecordId && lead.id !== leadRecordId) return false;
      if (status === 'quote_requested' ? !lead.quoteRequestedAt : status !== 'all' && (lead.status || 'new') !== status) return false;
      if (assignee !== 'all' && (lead.assignedTo || 'admin') !== assignee) return false;
      if (days && !(Date.parse(lead.createdAt || lead.updatedAt) >= cutoff)) return false;
      if (!q) return true;
      const text = normalizeSearch([lead.customerName, lead.customerPhone, lead.customerAddress, lead.adminNote].join(' '));
      return text.includes(q) || Boolean(phoneQuery && String(lead.customerPhone || '').replace(/\D/g, '').includes(phoneQuery));
    });
  }

  function refreshLeadAssignees() {
    const select = $('leadAssigneeFilter');
    const selected = select.value;
    const names = new Map(USERS.map(user => [user.username, user.displayName || user.username]));
    const usernames = [...new Set(LEADS.map(lead => lead.assignedTo || 'admin'))].sort();
    select.replaceChildren(new Option('Mọi người phụ trách', 'all'), ...usernames.map(username => new Option(names.get(username) || '@' + username, username)));
    select.value = usernames.includes(selected) ? selected : 'all';
  }

  function renderLeadsList() {
    const el = $('leadsListEditor');
    if (!el) return;
    if ($('leadsTabCount')) $('leadsTabCount').textContent = LEADS.length;
    if ($('leadsCount')) $('leadsCount').textContent = LEADS.length;
    if ($('kpiLeadTotal')) $('kpiLeadTotal').textContent = LEADS.length;
    if ($('kpiLeadNew')) $('kpiLeadNew').textContent = LEADS.filter(x => (x.status || 'new') === 'new').length;
    if ($('kpiLeadClosed')) $('kpiLeadClosed').textContent = LEADS.filter(x => x.status === 'closed').length;

    refreshLeadAssignees();
    const list = getFilteredLeads();
    $('leadResults').textContent = datasetReady.leads ? `${list.length} / ${LEADS.length} khách hàng` : 'Không tải được khách hàng. Bấm Tải lại để thử lại.';
    $('btnExportLeads').disabled = !datasetReady.leads || !list.length;

    el.innerHTML = list.map(l => {
      const phoneClean = String(l.customerPhone || '').replace(/[^\d+]/g, '');
      const zaloClean = phoneClean.replace(/[^\d]/g, '');
      const st = l.status || 'new';
      const stColor = st === 'closed' ? '#047857' : st === 'cancelled' ? '#B91C1C' : st === 'new' ? '#EA580C' : '#1D4ED8';
      return `<article class="list-item lead-record">
        <div class="lead-record-head">
          <div style="min-width:0">
            <h4>${escapeAttr(l.customerName)}</h4>
            <span class="lead-record-date">${escapeAttr(fmtLeadTime(l.updatedAt || l.createdAt))}</span>
          </div>
          <button type="button" class="del-btn" data-l-del="${escapeAttr(l.id)}" aria-label="Xóa khách hàng">×</button>
        </div>
        ${(l.customerPhone || l.customerAddress) ? `<div style="font-size:12px;color:#334155;display:flex;flex-direction:column;gap:3px">
          ${l.customerPhone ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span>📞 <b>${escapeAttr(l.customerPhone)}</b></span>${phoneClean ? `<a href="tel:${phoneClean}" style="font-size:11px;font-weight:700;color:#047857;text-decoration:none;background:#ECFDF5;padding:2px 7px;border-radius:99px">Gọi</a>` : ''}${zaloClean ? `<a href="https://zalo.me/${zaloClean}" target="_blank" rel="noopener" style="font-size:11px;font-weight:700;color:#0369A1;text-decoration:none;background:#E0F2FE;padding:2px 7px;border-radius:99px">Zalo</a>` : ''}</div>` : ''}
          ${l.customerAddress ? `<div>📍 ${escapeAttr(l.customerAddress)}</div>` : ''}
        </div>` : ''}
        <div class="lead-record-energy">
          <div>⚡ Hóa đơn: <b>${nfLead.format(l.billTotal || 0)} đ/tháng</b> (${nfLead.format(l.kwhUsed || 0)} kWh)</div>
          <div>🔋 Pin lưu trữ cần: <b>${Number(l.batNeededKwh || 0).toFixed(1)} kWh</b> (${l.modulesCount || 0} × ${l.moduleKwh ?? 5.12} kWh · tối ${l.evePct ?? 70}%)</div>
        </div>
        ${l.quoteRequestedAt ? `<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:7px 9px;font-size:12px;color:#9A3412">
          <strong>Khách yêu cầu báo giá</strong> · ${escapeAttr(fmtLeadTime(l.quoteRequestedAt))}
        </div>` : ''}
        ${(!CURRENT_USER || CURRENT_USER.role === 'admin') ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;font-size:11.5px">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
            <span style="font-weight:700;color:#475569">👤 Phụ trách:</span>
            <select class="f-input" data-l-assign="${escapeAttr(l.id)}" style="width:auto;padding:3px 7px;font-size:11.5px">
              ${(USERS && USERS.length ? USERS : [{ username: 'admin', displayName: 'admin' }]).map(u => `<option value="${escapeAttr(u.username)}" ${(l.assignedTo || 'admin') === u.username ? 'selected' : ''}>@${escapeAttr(u.username)}</option>`).join('')}
            </select>
            ${l.botSentAt ? '<span style="background:#DCFCE7;color:#166534;padding:2px 6px;border-radius:99px;font-weight:700">🤖 Bot OK</span>' : ''}
          </div>
          <button type="button" class="btn-ghost small" data-l-push="${escapeAttr(l.id)}">Gửi Telegram</button>
        </div>` : ''}
        <div class="lead-record-edit">
          <select class="f-input" aria-label="Trạng thái chăm sóc" data-l-status="${escapeAttr(l.id)}" style="font-weight:700;color:${stColor}">
            <option value="new" ${st === 'new' ? 'selected' : ''}>🆕 Mới</option>
            <option value="contacted" ${st === 'contacted' ? 'selected' : ''}>📞 Đã liên hệ</option>
            <option value="quoted" ${st === 'quoted' ? 'selected' : ''}>📋 Đã báo giá</option>
            <option value="closed" ${st === 'closed' ? 'selected' : ''}>✅ Đã chốt</option>
            <option value="cancelled" ${st === 'cancelled' ? 'selected' : ''}>❌ Hủy</option>
          </select>
          <input type="text" class="f-input" aria-label="Ghi chú chăm sóc" data-l-note="${escapeAttr(l.id)}" value="${escapeAttr(l.adminNote || '')}" placeholder="Ghi chú chăm sóc khách">
        </div>
      </article>`;
    }).join('') || `<p class="hint adm-empty">${LEADS.length ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có yêu cầu tư vấn nào.'}</p>`;

    
    el.querySelectorAll('[data-l-assign]').forEach(sel => sel.onchange = async () => {
      const id = sel.dataset.lAssign, assignedTo = sel.value;
      sel.disabled = true;
      try {
        const { lead } = await api('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, assignedTo }) });
        const item = LEADS.find(x => x.id === id);
        if (item) item.assignedTo = lead.assignedTo;
        toast(`Đã chuyển khách cho tài khoản @${assignedTo}.`);
      } catch (err) { toast(err.message); }
      renderLeadsList();
    });
    el.querySelectorAll('[data-l-push]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Gửi thông tin khách hàng này tới nhóm Telegram đã cấu hình?')) return;
      btn.disabled = true;
      try {
        const res = await api('/api/admin/leads/push', { method: 'POST', body: JSON.stringify({ id: btn.dataset.lPush }) });
        if (res.lead) LEADS = LEADS.map(lead => lead.id === res.lead.id ? res.lead : lead);
        renderLeadsList();
        toast('Đã gửi thông tin khách hàng qua Telegram.');
      } catch (err) { toast(err.message); }
      finally { btn.disabled = false; }
    });

    el.querySelectorAll('[data-l-status]').forEach(sel => sel.onchange = async () => {
      const id = sel.dataset.lStatus;
      const status = sel.value;
      sel.disabled = true;
      try {
        const { lead } = await api('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, status }) });
        const item = LEADS.find(x => x.id === id);
        if (item) item.status = lead.status;
        toast('Đã cập nhật trạng thái khách hàng.');
      } catch (err) { toast(err.message); }
      renderLeadsList();
    });

    el.querySelectorAll('[data-l-note]').forEach(inp => inp.onchange = async () => {
      const id = inp.dataset.lNote;
      const adminNote = inp.value;
      try {
        const { lead } = await api('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, adminNote }) });
        const item = LEADS.find(x => x.id === id);
        if (item) item.adminNote = lead.adminNote;
        toast('Đã lưu ghi chú khách hàng.');
      } catch (err) { toast(err.message); }
    });

    el.querySelectorAll('[data-l-del]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Xóa bản ghi khách hàng này?')) return;
      try {
        const res = await api('/api/admin/leads', { method: 'DELETE', body: JSON.stringify({ id: btn.dataset.lDel }) });
        LEADS = res.leads || [];
        renderLeadsList();
        toast('Đã xóa dữ liệu khách hàng.');
      } catch (err) { toast(err.message); }
    });
  }

  function changeLeadFilter() { leadRecordId = ''; renderLeadsList(); }
  $('leadSearch').oninput = changeLeadFilter;
  ['leadStatusFilter', 'leadAssigneeFilter', 'leadAgeFilter'].forEach(id => { $(id).onchange = changeLeadFilter; });
  if ($('btnRefreshLeads')) {
    $('btnRefreshLeads').onclick = async () => {
      try {
        const res = await api('/api/admin/leads');
        if (!Array.isArray(res.leads)) throw new Error('Danh sách khách hàng không hợp lệ.');
        LEADS = res.leads;
        datasetReady.leads = true;
        renderLeadsList();
        toast(`Đã làm mới (${LEADS.length} khách hàng).`);
      } catch (err) { toast(err.message); }
    };
  }
  if ($('btnExportLeads')) {
    $('btnExportLeads').onclick = async () => {
      try {
        const ids = getFilteredLeads().map(lead => lead.id);
        if (!ids.length) return;
        const resp = await fetch('/api/admin/leads/export.csv', {
          method: 'POST', credentials: 'include', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ ids })
        });
        if (!resp.ok) throw new Error('Không thể xuất CSV.');
        downloadFile(await resp.blob(), `khach-hang-tu-van-${new Date().toISOString().slice(0, 10)}.csv`);
      } catch (err) { toast(err.message); }
    };
  }

  
  // ---------- RBAC PERMISSIONS & USER MANAGEMENT ----------
  function applyPermissionsUI() {
    const isSuper = Boolean(CURRENT_USER && CURRENT_USER.role === 'admin');
    if ($('currentUserBadge')) {
      $('currentUserBadge').textContent = CURRENT_USER?.displayName || CURRENT_USER?.username || 'Quản trị viên';
      $('currentUserBadge').title = isSuper ? 'Quản trị viên' : 'Nhân viên';
    }
    if ($('myAccUser')) $('myAccUser').textContent = CURRENT_USER ? '@' + CURRENT_USER.username : '@admin';
    if ($('myAccName')) $('myAccName').textContent = CURRENT_USER ? (CURRENT_USER.displayName || CURRENT_USER.username) : 'Quản trị viên';
    if ($('myAccRole')) $('myAccRole').textContent = isSuper ? 'Admin (Full tính năng)' : 'Nhân viên phân quyền';
    $('adminMore').hidden = !isSuper;
    $('gsheetHeaderBadge').hidden = !can('gsheet');
    tabs.forEach(btn => {
      const tab = btn.dataset.tab;
      if (tab === 'overview') btn.hidden = !can('leads');
      else btn.hidden = !(tab === 'users' ? isSuper : tab === 'account' || can(tab));
    });
    document.querySelectorAll('.adm-nav-group').forEach(group => { group.hidden = !group.querySelector('[data-tab]:not([hidden])'); });
    const available = tabs.filter(btn => !btn.hidden);
    selectTab(available.find(btn => btn.dataset.tab === activeTab) || available[0]);

    renderNewUserPerms();
    if (isSuper) renderUsersList();
  }

  function renderNewUserPerms() {
    const grid = $('nuPermsGrid');
    if (!grid) return;
    grid.innerHTML = PERM_LABELS.map(([k, lbl]) => `
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;cursor:pointer">
        <input type="checkbox" data-nu-perm="${k}" ${k === 'leads' ? 'checked' : ''}>
        <span>${lbl}</span>
      </label>
    `).join('');
    if ($('nu_role')) {
      $('nu_role').onchange = () => {
        if ($('nuPermsWrap')) $('nuPermsWrap').hidden = $('nu_role').value === 'admin';
      };
    }
  }

  function renderUsersList() {
    const el = $('usersListEditor');
    if (!el) return;
    if ($('usersCount')) $('usersCount').textContent = USERS.length;
    el.innerHTML = USERS.map(u => {
      const isRoot = Boolean(u.protected || u.username === 'admin');
      const isAdm = u.role === 'admin';
      return `<div class="list-item" style="flex-direction:column;align-items:stretch;gap:7px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
          <div>
            <div style="font-weight:800;font-size:13.5px">${escapeAttr(u.displayName || u.username)} <span style="font-weight:600;color:#64748B">(@${escapeAttr(u.username)})</span></div>
            <div style="font-size:11.5px;font-weight:700;color:${isAdm ? '#EA580C' : '#0369A1'}">${isAdm ? '👑 Admin (Full tính năng)' : '👤 Nhân viên phân quyền'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${!isRoot ? `<label style="font-size:11.5px;font-weight:700;display:flex;align-items:center;gap:4px"><input type="checkbox" data-u-act="${escapeAttr(u.username)}" ${u.active !== false ? 'checked' : ''}> Hoạt động</label>` : '<span style="font-size:11px;font-weight:800;color:#047857;background:#ECFDF5;padding:2px 8px;border-radius:99px">Gốc</span>'}
            ${!isRoot ? `<button type="button" class="del-btn" data-u-del="${escapeAttr(u.username)}" title="Xóa tài khoản">×</button>` : ''}
          </div>
        </div>
        ${!isRoot ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <select class="f-input" data-u-role="${escapeAttr(u.username)}">
            <option value="staff" ${!isAdm ? 'selected' : ''}>Nhân viên (phân quyền)</option>
            <option value="admin" ${isAdm ? 'selected' : ''}>Admin (Full tính năng)</option>
          </select>
          <input type="password" class="f-input" data-u-newpass="${escapeAttr(u.username)}" placeholder="Đặt lại mật khẩu mới...">
        </div>
        ${!isAdm ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:8px">
          ${PERM_LABELS.map(([k, lbl]) => `<label style="display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;cursor:pointer"><input type="checkbox" data-u-perm="${escapeAttr(u.username)}:${k}" ${(u.permissions || []).includes(k) ? 'checked' : ''}><span>${lbl}</span></label>`).join('')}
        </div>` : ''}
        <button type="button" class="btn-ghost small" data-u-save="${escapeAttr(u.username)}">💾 Lưu phân quyền / mật khẩu</button>
        ` : ''}
      </div>`;
    }).join('');

    el.querySelectorAll('[data-u-save]').forEach(btn => btn.onclick = async () => {
      const uname = btn.dataset.uSave;
      const roleEl = el.querySelector(`[data-u-role="${uname}"]`);
      const actEl = el.querySelector(`[data-u-act="${uname}"]`);
      const passEl = el.querySelector(`[data-u-newpass="${uname}"]`);
      const perms = Array.from(el.querySelectorAll(`[data-u-perm^="${uname}:"]`)).filter(c => c.checked).map(c => c.dataset.uPerm.split(':')[1]);
      try {
        await api('/api/admin/users', {
          method: 'PUT',
          body: JSON.stringify({
            username: uname,
            role: roleEl ? roleEl.value : 'staff',
            active: actEl ? actEl.checked : true,
            permissions: perms,
            newPassword: passEl && passEl.value.trim() ? passEl.value.trim() : undefined
          })
        });
        const res = await api('/api/admin/users');
        USERS = res.users || [];
        renderUsersList();
        toast(`Đã cập nhật tài khoản @${uname}!`);
      } catch (err) { toast(err.message); }
    });

    el.querySelectorAll('[data-u-del]').forEach(btn => btn.onclick = async () => {
      const uname = btn.dataset.uDel;
      if (!confirm(`Xóa tài khoản @${uname}?`)) return;
      try {
        await api('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ username: uname }) });
        const res = await api('/api/admin/users');
        USERS = res.users || [];
        renderUsersList();
        toast(`Đã xóa tài khoản @${uname}.`);
      } catch (err) { toast(err.message); }
    });
  }

  
  if ($('btnCreateUser')) {
    $('btnCreateUser').onclick = async () => {
      const username = $('nu_username').value.trim();
      const displayName = $('nu_display').value.trim();
      const password = $('nu_password').value;
      const role = $('nu_role').value;
      const permissions = Array.from(document.querySelectorAll('[data-nu-perm]')).filter(c => c.checked).map(c => c.dataset.nuPerm);
      try {
        await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ username, displayName, password, role, permissions }) });
        $('nu_username').value = ''; $('nu_display').value = ''; $('nu_password').value = '';
        const res = await api('/api/admin/users');
        USERS = res.users || [];
        renderUsersList();
        toast(`Đã tạo tài khoản @${username} thành công!`);
      } catch (err) { toast(err.message); }
    };
  }

  
  
  // ---------- GOOGLE SHEETS REAL-TIME SYNC UI ----------
  let GS_SCRIPT_TEMPLATE = '';
  let gsPollTimer = null;

  async function loadGsheetSettings() {
    $('btnSaveGsheet').disabled = true;
    try {
      const { settings } = await api('/api/admin/gsheet/config');
      setChk('gs_enabled', settings.enabled);
      setVal('gs_webhookUrl', settings.webhookUrl || '');
      setVal('gs_secretKey', settings.secretKey || '');
      setChk('gs_syncLeads', settings.syncLeads !== false);
      $('btnSaveGsheet').disabled = false;
    } catch (err) {
      toast('Không tải được cài đặt Google Sheets. ' + err.message);
    }
  }

  function renderGsheetStatus(st) {
    if (!st) return;
    const badge = $('gsheetHeaderBadge');
    const card = $('gsStatusCard');
    const stateEl = $('gsStateText');
    const lastEl = $('gsLastSyncText');
    const okEl = $('gsOkCnt');
    const errEl = $('gsErrCnt');
    const errMsg = $('gsErrMsg');
    const logsEl = $('gsLogsList');

    const fmtT = iso => {
      if (!iso) return 'Chưa có';
      try { const d = new Date(iso); return d.toLocaleTimeString('vi-VN') + ' · ' + d.toLocaleDateString('vi-VN'); } catch { return iso; }
    };

    if (st.state === 'connected') {
      if (badge) { badge.textContent = '🟢 Sheets: Đang đồng bộ Real-time'; badge.style.background = '#ECFDF5'; badge.style.color = '#047857'; badge.style.borderColor = '#A7F3D0'; }
      if (card) { card.style.background = '#ECFDF5'; card.style.borderColor = '#A7F3D0'; }
      if (stateEl) { stateEl.textContent = '🟢 Đã kết nối Google Sheets' + (st.sheetName ? ` (${st.sheetName})` : ''); stateEl.style.color = '#047857'; }
    } else if (st.state === 'syncing') {
      if (badge) { badge.textContent = '🟡 Sheets: Đang đồng bộ...'; badge.style.background = '#FFFBEB'; badge.style.color = '#B45309'; badge.style.borderColor = '#FDE68A'; }
      if (stateEl) { stateEl.textContent = '🟡 Đang gửi dữ liệu lên Google Sheets...'; stateEl.style.color = '#B45309'; }
    } else if (st.state === 'error') {
      if (badge) { badge.textContent = '🔴 Sheets: Lỗi đồng bộ'; badge.style.background = '#FEF2F2'; badge.style.color = '#B91C1C'; badge.style.borderColor = '#FECACA'; }
      if (card) { card.style.background = '#FEF2F2'; card.style.borderColor = '#FECACA'; }
      if (stateEl) { stateEl.textContent = '🔴 Lỗi đồng bộ Google Sheets'; stateEl.style.color = '#B91C1C'; }
    } else {
      if (badge) { badge.textContent = '⚪ Sheets: Chưa kết nối'; badge.style.background = '#F1F5F9'; badge.style.color = '#475569'; badge.style.borderColor = '#CBD5E1'; }
      if (card) { card.style.background = '#F8FAFC'; card.style.borderColor = '#E2E8F0'; }
      if (stateEl) { stateEl.textContent = '⚪ Chưa kết nối Google Sheets'; stateEl.style.color = '#475569'; }
    }

    if (lastEl) lastEl.textContent = `Lần đồng bộ cuối: ${fmtT(st.lastSyncAt)}${st.lastAction ? ' (' + st.lastAction + ')' : ''}`;
    if (okEl) okEl.textContent = st.successCount || 0;
    if (errEl) errEl.textContent = st.errorCount || 0;
    if (errMsg) { errMsg.hidden = !st.lastError; errMsg.textContent = st.lastError ? 'Chi tiết lỗi: ' + st.lastError : ''; }

    if (logsEl) {
      const logs = Array.isArray(st.logs) ? st.logs : [];
      logsEl.innerHTML = logs.map(l => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;background:${l.ok ? '#F8FAFC' : '#FEF2F2'};border:1px solid ${l.ok ? '#E2E8F0' : '#FECACA'}">
          <span style="font-weight:700;color:${l.ok ? '#0F172A' : '#B91C1C'}">${l.ok ? '✅' : '❌'} ${escapeAttr(l.action || '')} — <span style="font-weight:500;color:#64748B">${escapeAttr(l.detail || '')}</span></span>
          <span style="white-space:nowrap;color:#64748B;font-size:11px">${fmtT(l.time)}${l.ms ? ' · ' + l.ms + 'ms' : ''}</span>
        </div>
      `).join('') || '<p class="hint">Chưa có lịch sử đồng bộ nào.</p>';
    }
  }

  async function fetchGsheetStatus() {
    if (!can('gsheet')) return;
    try {
      const res = await api('/api/admin/gsheet/status');
      if (res.scriptTemplate) GS_SCRIPT_TEMPLATE = res.scriptTemplate;
      if (res.status) renderGsheetStatus(res.status);
    } catch {}
    if (!gsPollTimer) {
      gsPollTimer = setInterval(() => {
        if (!$('adminApp').hidden && can('gsheet')) {
          api('/api/admin/gsheet/status').then(r => renderGsheetStatus(r.status)).catch(() => {});
        }
      }, 10000);
    }
  }

  if ($('gsheetHeaderBadge')) {
    $('gsheetHeaderBadge').onclick = () => {
      const btn = document.querySelector('.adm-tabs .tab-btn[data-tab="gsheet"]');
      if (btn && !btn.hidden) btn.click();
    };
  }

  if ($('btnSaveGsheet')) {
    $('btnSaveGsheet').onclick = async () => {
      try {
        const res = await api('/api/admin/gsheet/config', {
          method: 'PUT',
          body: JSON.stringify({
            enabled: $('gs_enabled').checked,
            webhookUrl: $('gs_webhookUrl').value.trim(),
            secretKey: $('gs_secretKey').value.trim(),
            syncLeads: $('gs_syncLeads').checked
          })
        });
        renderGsheetStatus(res.status);
        toast('Đã lưu cấu hình đồng bộ Google Sheets!');
      } catch (err) { toast(err.message); }
    };
  }

  if ($('btnTestGsheet')) {
    $('btnTestGsheet').onclick = async () => {
      try {
        toast('Đang kiểm tra kết nối Google Sheets...');
        const res = await api('/api/admin/gsheet/test', {
          method: 'POST',
          body: JSON.stringify({ webhookUrl: $('gs_webhookUrl').value.trim(), secretKey: $('gs_secretKey').value.trim() })
        });
        renderGsheetStatus(res.status);
        toast(`Kết nối thành công${res.data && res.data.sheetName ? ' tới "' + res.data.sheetName + '"' : ''} (${res.ms}ms)!`);
      } catch (err) {
        fetchGsheetStatus();
        toast(err.message || 'Kết nối Google Sheets thất bại.');
      }
    };
  }

  if ($('btnPushAllGsheet')) {
    $('btnPushAllGsheet').onclick = async () => {
      try {
        toast('Đang đẩy toàn bộ dữ liệu lên Google Sheets...');
        const res = await api('/api/admin/gsheet/sync-all', { method: 'POST' });
        renderGsheetStatus(res.status);
        toast('Đã đồng bộ toàn bộ dữ liệu lên Google Sheets!');
      } catch (err) {
        fetchGsheetStatus();
        toast(err.message || 'Lỗi đồng bộ Google Sheets.');
      }
    };
  }

  if ($('btnCopyAppsScript')) {
    $('btnCopyAppsScript').onclick = () => {
      if (!GS_SCRIPT_TEMPLATE) return toast('Đang tải mã script, vui lòng thử lại sau giây lát.');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(GS_SCRIPT_TEMPLATE).then(() => toast('Đã sao chép mã Google Apps Script!')).catch(() => toast('Không thể sao chép tự động.'));
      }
    };
  }

  // ---------- MAINTENANCE & FULL BACKUP ----------
  function updateMaintUI() {
    const enabled = Boolean(CONFIG?.maintenance?.enabled);
    $('maintStatusBox').textContent = enabled ? 'Trang tư vấn đang bảo trì.' : 'Trang tư vấn đang mở.';
    $('btnToggleMaint').textContent = enabled ? 'Tắt bảo trì' : 'Bật bảo trì';
  }

  $('btnToggleMaint').onclick = async () => {
    const button = $('btnToggleMaint');
    if (!CONFIG || button.disabled) return;
    button.disabled = true;
    try {
      const enabled = !CONFIG.maintenance?.enabled;
      const res = await api('/api/admin/maintenance', { method: 'PUT', body: JSON.stringify({ enabled }) });
      CONFIG.maintenance = res.config.maintenance;
      updateMaintUI();
      pushPreview();
      toast(enabled ? 'Đã bật bảo trì.' : 'Đã mở lại trang tư vấn.');
    } catch (err) { toast(err.message); }
    finally { button.disabled = false; }
  };

  if ($('btnFullBackup')) {
    $('btnFullBackup').onclick = async () => {
      try {
        const resp = await fetch('/api/admin/backup-full', { credentials: 'include', headers: authHeaders() });
        if (!resp.ok) throw new Error('Không thể tải bản sao lưu toàn bộ.');
        downloadFile(await resp.blob(), `mai-son-solar-backup-${new Date().toISOString().slice(0, 10)}.json`);
        toast('Đã tải xuống bản sao lưu toàn bộ dữ liệu!');
      } catch (err) { toast(err.message); }
    };
  }
  
  $('fullRestoreFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file || !confirm('Khôi phục cấu hình và hồ sơ tư vấn từ tệp này?')) return;
    try {
      const data = JSON.parse(await file.text());
      const res = await api('/api/admin/restore-full', { method: 'POST', body: JSON.stringify(data) });
      const refreshed = await loadAdminData();
      toast('Đã khôi phục: ' + res.updatedSections.join(', ') + (refreshed ? '.' : '. Tải lại để xem.'));
    } catch (err) { toast(err.message || 'Không thể khôi phục tệp JSON.'); }
  });

  // ---------- TELEGRAM BOT SETTINGS (IN TAB TÀI KHOẢN) ----------
  if ($('btnSaveTelegram')) {
    $('btnSaveTelegram').onclick = async () => {
      try {
        await api('/api/admin/telegram', {
          method: 'PUT',
          body: JSON.stringify({
            enabled: $('tg_enabled').checked,
            botToken: $('tg_botToken').value.trim(),
            chatId: $('tg_chatId').value.trim()
          })
        });
        toast('Đã lưu cấu hình Telegram Bot!');
      } catch (err) { toast(err.message); }
    };
  }
  if ($('btnTestTelegram')) {
    $('btnTestTelegram').onclick = async () => {
      const botToken = $('tg_botToken').value.trim();
      const chatId = $('tg_chatId').value.trim();
      if (!botToken || !chatId) return toast('Nhập đủ Bot Token và Chat ID trước khi gửi thử.');
      try {
        const res = await api('/api/admin/telegram/test', { method: 'POST', body: JSON.stringify({ botToken, chatId }) });
        toast(res.message || 'Đã gửi tin nhắn thử tới Telegram!');
      } catch (err) { toast(err.message); }
    };
  }

  
  function bind(id, setter) {
    const el = $(id);
    if (!el) return;
    const evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, () => {
      if (!CONFIG) return;
      setter(el);
      setDirty(true);
      pushPreview();
    });
  }

  bind('b_logoHeight', el => { CONFIG.branding.logoHeight = Number(el.value); if ($('logoHeightVal')) $('logoHeightVal').textContent = el.value; });
  bind('b_siteTitle', el => { CONFIG.branding.siteTitle = el.value; });
  bind('b_companyName', el => { CONFIG.branding.companyName = el.value; });
  bind('b_showAdminLink', el => { CONFIG.branding.showAdminLink = el.checked; });
  bind('b_showHotline', el => { CONFIG.branding.showHotline = el.checked; });
  bind('b_hotlineLabel', el => { CONFIG.branding.hotlineLabel = el.value; });

  bind('t_darkMode', el => {
    CONFIG.theme.darkMode = el.checked;
    if (el.checked && CONFIG.theme.bg === '#F3F5F9') {
      CONFIG.theme.bg = '#0B1120'; CONFIG.theme.cardBg = '#111827'; CONFIG.theme.ink = '#F9FAFB'; CONFIG.theme.inkMuted = '#9CA3AF';
      populateForm();
    } else if (!el.checked && CONFIG.theme.bg === '#0B1120') {
      CONFIG.theme.bg = '#F3F5F9'; CONFIG.theme.cardBg = '#FFFFFF'; CONFIG.theme.ink = '#111827'; CONFIG.theme.inkMuted = '#4B5563';
      populateForm();
    }
  });
  bind('t_autoPalette', el => {
    CONFIG.theme.autoPalette = el.checked;
    syncPaletteControls();
  });
  ['primary', 'primaryDeep', 'gradientEnd', 'bg', 'cardBg', 'ink', 'inkMuted', 'dayColor', 'nightColor'].forEach(k => {
    bind('t_' + k, el => { CONFIG.theme[k] = el.value; CONFIG.theme.preset = 'custom'; renderPresets(); });
  });
  bind('t_radius', el => { CONFIG.theme.radius = Number(el.value); if ($('radiusVal')) $('radiusVal').textContent = el.value; });
  bind('t_maxWidth', el => { CONFIG.theme.maxWidth = Number(el.value); if ($('maxWidthVal')) $('maxWidthVal').textContent = el.value; });
  bind('t_fontFamily', el => { CONFIG.theme.fontFamily = el.value; });
  bind('t_stickyResult', el => { CONFIG.theme.stickyResult = el.checked; });

  
  [
    'showCustomerName', 'showCustomerPhone', 'showCustomerAddress', 'showQuickChips',
    'showSliders', 'showAdvancedSettings', 'showDayNightBar', 'showCalcSteps',
    'showTierTable', 'showScenarioTable',
    'showContactCta', 'showFooterNotes'
  ].forEach(k => bind('s_' + k, el => { CONFIG.sections[k] = el.checked; }));

  [
    'card1Title', 'card2Title', 'resultTitle', 'tierTableTitle',
    'scenarioTableTitle'
  ].forEach(k => bind('s_' + k, el => { CONFIG.sections[k] = el.value; }));

  bind('d_mode', el => { CONFIG.defaults.mode = el.value; });
  ['bill', 'kwh', 'mod', 'eve', 'dod', 'eff', 'vat', 'days'].forEach(k => {
    bind('d_' + k, el => { CONFIG.defaults[k] = Number(el.value) || 0; });
  });
  function parseNumList(str) {
    return str.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
  }
  bind('d_billChips', el => { CONFIG.defaults.billChips = parseNumList(el.value); });
  bind('d_kwhChips', el => { CONFIG.defaults.kwhChips = parseNumList(el.value); });
  bind('d_scenarios', el => { CONFIG.defaults.scenarios = parseNumList(el.value).filter(n => n <= 100); });
  bind('tar_note', el => { CONFIG.tariffs.note = el.value; });

  bind('f_companyLine', el => { CONFIG.footer.companyLine = el.value; });
  bind('f_notesTitle', el => { CONFIG.footer.notesTitle = el.value; });
  bind('f_ctaTitle', el => { CONFIG.footer.ctaTitle = el.value; });
  bind('f_ctaSubtitle', el => { CONFIG.footer.ctaSubtitle = el.value; });
  bind('f_ctaAddress', el => { CONFIG.footer.ctaAddress = el.value; });
  bind('f_callBtnText', el => { CONFIG.footer.callBtnText = el.value; });
  bind('f_zaloBtnText', el => { CONFIG.footer.zaloBtnText = el.value; });

  // ---------- LOGO UPLOAD ----------
  $('logoUpload').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('Ảnh logo tối đa 2MB.');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api('/api/admin/upload-logo', {
          method: 'POST',
          body: JSON.stringify({ dataUrl: reader.result, filename: file.name })
        });
        CONFIG.branding.logoUrl = res.logoUrl;
        savedEditorConfig.branding.logoUrl = res.logoUrl;
        $('logoPreview').src = res.logoUrl;
        pushPreview();
        toast('Đã tải lên logo mới!');
      } catch (err) { toast(err.message); }
    };
    reader.readAsDataURL(file);
  });

  $('btnRestoreLogo').onclick = () => {
    CONFIG.branding.logoUrl = '/assets/logo-default.jpg?v=mss';
    $('logoPreview').src = CONFIG.branding.logoUrl;
    setDirty(true); pushPreview();
  };

  // ---------- SAVE / RESET / PASSWORD / BACKUP ----------
  $('btnSave').onclick = async () => {
    if (!CONFIG || configSaving || !dirty) return;
    const baseConfig = savedEditorConfig;
    const sentConfig = snapshotEditorConfig();
    const { patch, expectedConfig } = configChanges(baseConfig, sentConfig);
    if (!Object.keys(patch).length) {
      setDirty(false);
      return;
    }
    const revision = editRevision;
    configSaving = true;
    $('btnSave').disabled = true;
    $('btnSave').textContent = 'Đang lưu…';
    try {
      const res = await api('/api/admin/config', {
        method: 'PUT', body: JSON.stringify({ ...patch, expectedConfig })
      });
      const pending = editRevision === revision ? {} : configChanges(sentConfig, snapshotEditorConfig()).patch;
      CONFIG = res.config;
      savedEditorConfig = snapshotEditorConfig();
      for (const [key, fields] of Object.entries(pending)) {
        Object.assign(CONFIG[key], fields);
        for (const field of Object.keys(fields)) {
          if (!Object.hasOwn(patch[key] || {}, field)) savedEditorConfig[key][field] = baseConfig[key]?.[field];
        }
      }
      renderPresets();
      populateForm();
      setDirty(Object.keys(pending).length > 0);
      pushPreview();
      toast(dirty ? 'Đã lưu bản trước. Bạn vẫn có thay đổi chưa lưu.' : 'Đã lưu cấu hình giao diện.');
    } catch (err) { toast(err.message); }
    finally {
      configSaving = false;
      $('btnSave').disabled = !dirty;
      $('btnSave').textContent = 'Lưu giao diện';
    }
  };

  $('btnReset').onclick = async () => {
    if (configSaving || !confirm('Khôi phục toàn bộ giao diện và biểu giá về mặc định ban đầu?')) return;
    try {
      const res = await api('/api/admin/reset', { method: 'POST' });
      CONFIG = res.config;
      savedEditorConfig = snapshotEditorConfig();
      $('adminMore').open = false;
      renderPresets(); populateForm(); setDirty(false); pushPreview();
      toast('Đã khôi phục cấu hình mặc định.');
    } catch (err) { toast(err.message); }
  };

  $('passForm').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('confirmPass') && $('newPass').value !== $('confirmPass').value) return toast('Mật khẩu nhập lại không khớp.');
    try {
      const res = await api('/api/admin/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: $('curPass').value,
          newPassword: $('newPass').value
        })
      });
      $('curPass').value = '';
      $('newPass').value = '';
      if ($('confirmPass')) $('confirmPass').value = '';
      toast(res.message || 'Đã đổi mật khẩu.');
    } catch (err) { toast(err.message); }
  });

  $('btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify(editorConfig(), null, 2)], { type: 'application/json' });
    downloadFile(blob, `mai-son-solar-config-${new Date().toISOString().slice(0, 10)}.json`);
  };

  $('importFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        CONFIG = { ...CONFIG, ...imported, footer: { ...CONFIG.footer, ...imported.footer } };
        renderPresets(); populateForm(); setDirty(true); pushPreview();
        toast('Đã nạp cấu hình từ tệp JSON. Bấm "Lưu cấu hình" để áp dụng.');
      } catch { toast('Tệp JSON không hợp lệ.'); }
    };
    reader.readAsText(file);
  });

  // ---------- TABS & VIEWPORT ----------
  const tabs = [...document.querySelectorAll('.adm-navigation [data-tab]')];
  const previewSizes = [...document.querySelectorAll('[data-vp]')];

  function highlightButton(buttons, selected) {
    buttons.forEach(button => {
      button.classList.toggle('active', button === selected);
      button.setAttribute('aria-pressed', button === selected);
    });
  }

  function renderPreview() {
    const open = Boolean(previewOpen && TAB_INFO[activeTab]?.[2]);
    $('adminPreview').hidden = !open;
    $('btnToggleMobilePreview').textContent = open ? 'Đóng xem trước' : 'Xem trước';
    $('btnToggleMobilePreview').setAttribute('aria-expanded', open);
    if (!open) return;
    const source = '/?preview=1';
    if ($('previewFrame').getAttribute('src') !== source) $('previewFrame').src = source;
    else pushPreview();
  }

  function selectTab(button) {
    if (!button || button.hidden) return;
    const next = button.dataset.tab;
    const [title, description, page] = TAB_INFO[next];
    if (activeTab !== next) {
      document.querySelector('.adm-panel-scroll').scrollTop = 0;
      $('adminMore').open = false;
    }
    activeTab = next;
    $('workspaceTitle').textContent = title;
    $('workspaceDescription').textContent = description;
    $('workspaceActions').hidden = !page;
    tabs.forEach(btn => {
      const selected = btn === button;
      const pane = $('tab-' + btn.dataset.tab);
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-selected', selected);
      btn.tabIndex = selected ? 0 : -1;
      pane.classList.toggle('active', selected);
      pane.hidden = !selected;
    });
    if (next === 'overview') renderOverview();
    renderPreview();
  }

  tabs.forEach(button => {
    const pane = $('tab-' + button.dataset.tab);
    button.id ||= 'admin-nav-' + button.dataset.tab;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', pane.id);
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', button.id);
    button.onclick = () => selectTab(button);
    button.onkeydown = e => {
      const visibleTabs = tabs.filter(tab => !tab.hidden);
      const index = visibleTabs.indexOf(button);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? visibleTabs.length - 1
        : ['ArrowDown', 'ArrowRight'].includes(e.key) ? (index + 1) % visibleTabs.length
          : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? (index - 1 + visibleTabs.length) % visibleTabs.length : null;
      if (next === null) return;
      e.preventDefault();
      selectTab(visibleTabs[next]);
      visibleTabs[next].focus();
    };
  });

  $('btnToggleMobilePreview').onclick = () => {
    previewOpen = !previewOpen;
    renderPreview();
    if (previewOpen && window.matchMedia('(max-width: 980px)').matches) $('adminPreview').scrollIntoView({ block: 'start' });
  };
  $('btnClosePreview').onclick = () => {
    previewOpen = false;
    renderPreview();
    $('btnToggleMobilePreview').focus();
  };
  previewSizes.forEach(btn => {
    btn.onclick = () => {
      highlightButton(previewSizes, btn);
      $('previewFrame').style.width = btn.dataset.vp;
    };
  });

  $('previewFrame').addEventListener('load', () => {
    if (CONFIG) pushPreview();
  });

  checkSession();
})();
