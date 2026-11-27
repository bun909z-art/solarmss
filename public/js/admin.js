(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const TOKEN_KEY = 'hq_admin_token_v1';
  const EDITOR_KEYS = ['branding', 'home', 'theme', 'hero', 'sections', 'defaults', 'tariffs', 'footer'];
  const TAB_INFO = {
    overview: ['Tổng quan', 'Mở nhanh khách hàng cần theo dõi, thiết bị hết hàng và bài chưa công khai.'],
    leads: ['Khách hàng', 'Theo dõi yêu cầu tư vấn và trạng thái chăm sóc.'],
    products: ['Kho sản phẩm', 'Quản lý thiết bị, tồn kho và tài liệu kỹ thuật.'],
    news: ['Tin tức', 'Soạn bài, cập nhật nội dung và chọn bài nổi bật.'],
    branding: ['Thương hiệu', 'Cập nhật logo, tên doanh nghiệp và thông tin liên hệ.', '/?preview=1'],
    home: ['Trang chủ', 'Sắp xếp các mục nổi bật trên trang chủ.', '/?preview=home'],
    theme: ['Màu sắc & banner', 'Tùy chỉnh bảng màu, kiểu chữ và banner tư vấn.', '/?preview=1'],
    layout: ['Bố cục & tiêu đề', 'Chọn thông tin hiển thị trên công cụ tính pin.', '/?preview=1'],
    tariffs: ['Thông số & biểu giá', 'Thiết lập thông số tính pin và các bậc giá điện.', '/?preview=1'],
    footer: ['Chân trang', 'Sửa phần liên hệ và lưu ý cho khách hàng.', '/?preview=1'],
    gsheet: ['Google Sheets', 'Thiết lập đồng bộ và theo dõi các lần kết nối.'],
    security: ['Sao lưu & bảo trì', 'Quản lý chế độ bảo trì, cập nhật và sao lưu.'],
    users: ['Phân quyền & dữ liệu', 'Cấp quyền cho nhân viên và quản lý kết nối hệ thống.'],
    account: ['Tài khoản của tôi', 'Xem thông tin và đổi mật khẩu.']
  };

  let CONFIG = null;
  let savedEditorConfig = null;
  let PRESETS = {};
  let PRODUCTS = [];
  let savedProductStates = new Map();
  let NEWS = [];
  let LEADS = [];
  let USERS = [];
  let datasetReady = {};
  let CURRENT_USER = null;
  const PERM_LABELS = [
    ['branding', 'Thương hiệu'],
    ['home', 'Trang chủ'],
    ['theme', 'Giao diện'],
    ['layout', 'Bố cục'],
    ['tariffs', 'EVN & Mặc định'],
    ['products', 'Kho sản phẩm'],
    ['news', 'Tin tức'],
    ['leads', 'Khách hàng'],
    ['footer', 'Chân trang'],
    ['gsheet', 'Google Sheets'],
    ['security', 'Bảo trì & Cập nhật']
  ];
  let newNewsImgUrl = '';
  let prodFilter = 'all';
  const selectedProducts = new Set();
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

  function productStock(product) {
    return product.stockStatus || (product.inStock === false ? 'out_of_stock' : 'in_stock');
  }

  function editorConfig() {
    return Object.fromEntries(EDITOR_KEYS.map(key => [key, CONFIG[key]]));
  }

  function snapshotEditorConfig() {
    const snapshot = JSON.parse(JSON.stringify(editorConfig()));
    delete snapshot.sections.showSolarDemo;
    return snapshot;
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

  function openOverviewList(tab, filter, lead) {
    if (tab === 'leads') {
      leadRecordId = lead?.id || '';
      $('leadSearch').value = lead?.customerName || '';
      $('leadStatusFilter').value = filter;
      $('leadAssigneeFilter').value = 'all';
      $('leadAgeFilter').value = 'all';
      renderLeadsList();
    } else if (tab === 'products') {
      $('prodSearch').value = '';
      $('prodStockFilter').value = filter;
      $('prodVisibility').value = 'all';
      $('prodFilterTabs').querySelector('[data-pcat="all"]').click();
    } else {
      $('newsSearch').value = '';
      $('newsStateFilter').value = filter;
      renderNewsList();
    }
    const button = tabs.find(item => item.dataset.tab === tab);
    selectTab(button);
    button.focus();
  }

  function renderOverview() {
    const cards = [
      ['leads', 'new', LEADS.filter(lead => !lead.status || lead.status === 'new').length, 'Khách mới', 'Chờ liên hệ'],
      ['leads', 'quoted', LEADS.filter(lead => lead.status === 'quoted').length, 'Đã báo giá', 'Theo dõi phản hồi'],
      ['products', 'out_of_stock', PRODUCTS.filter(product => productStock(product) === 'out_of_stock').length, 'Thiết bị hết hàng', 'Xem tình trạng kho'],
      ['news', 'draft', NEWS.filter(article => article.published === false).length, 'Bài chưa công khai', 'Mở danh sách bản nháp']
    ];
    const actions = $('overviewActions');
    actions.innerHTML = cards.filter(([tab]) => can(tab)).map(([tab, filter, count, title, note]) => `
      <button type="button" class="overview-card" data-overview-tab="${tab}" data-overview-filter="${filter}">
        <span>${title}</span><strong>${datasetReady[tab] ? count : '—'}</strong><small>${datasetReady[tab] ? note : 'Chưa tải được dữ liệu'}</small>
      </button>`).join('');
    actions.querySelectorAll('[data-overview-tab]').forEach(btn => {
      btn.onclick = () => openOverviewList(btn.dataset.overviewTab, btn.dataset.overviewFilter);
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
      btn.onclick = () => openOverviewList('leads', 'all', latest[Number(btn.dataset.overviewLead)]);
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

  function renderDemoStatus(updating = false) {
    if (!CONFIG) return;
    const enabled = CONFIG.sections.showSolarDemo !== false;
    const status = $('maintenanceDemoStatus');
    status.textContent = enabled ? 'Đang bật' : 'Đang tắt';
    status.dataset.enabled = String(enabled);
    $('adminDemoLink').hidden = !enabled;
    const button = $('btnToggleMaintenanceDemo');
    button.textContent = updating ? 'Đang cập nhật…' : (enabled ? 'Tắt Demo 3D' : 'Bật Demo 3D');
    button.disabled = configSaving || !can('layout');
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

      const [data, prodData, newsData, leadsData, usersData, tgData] = await Promise.all([
        api('/api/config'),
        api(can('products') ? '/api/admin/products' : '/api/products').catch(() => null),
        can('news') ? api('/api/admin/news').catch(() => null) : null,
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
      datasetReady = { products: Array.isArray(prodData?.products), news: Array.isArray(newsData?.articles), leads: Array.isArray(leadsData?.leads) };
      setLoadedProducts(datasetReady.products ? prodData.products : []);
      NEWS = datasetReady.news ? newsData.articles : [];
      LEADS = datasetReady.leads ? leadsData.leads : [];
      $('btnSaveProds').disabled = !datasetReady.products;
      $('btnSaveNews').disabled = !datasetReady.news;
      USERS = Array.isArray(usersData.users) ? usersData.users : [];
      const tg = (tgData && tgData.telegram) || {};
      setChk('tg_enabled', Boolean(tg.enabled));
      setVal('tg_botToken', tg.botToken || '');
      setVal('tg_chatId', tg.chatId || '');
      applyPermissionsUI();
      if ($('nn_date') && !$('nn_date').value) $('nn_date').value = new Date().toISOString().slice(0, 10);
      renderPresets();
      populateForm();
      renderProdList();
      renderNewsList();
      renderLeadsList();
      const gs = CONFIG.sheetSync || {};
      setVal('gs_url', gs.url || '');
      if (gs.lastSummary) {
        $('gs_status').innerHTML = `✅ Lần đồng bộ gần nhất (${escapeAttr(fmtLeadTime(gs.lastSyncedAt))}): <b>${escapeAttr(gs.lastSummary)}</b>`;
      }
      populateMaintForm();
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
    renderDemoStatus();

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
    
    const hm = CONFIG.home || (CONFIG.home = {
      showSlider: true, sliderKicker: '★ Nổi bật', sliderTitle: 'Tin tức & Dự án nổi bật',
      autoSlide: true, sliderIntervalSec: 4.5, sliderHeight: 430, showQuickCards: true,
      quickCards: [
        { icon: '⚡', title: 'Tư vấn & Tính Pin Hybrid', desc: 'Nhập hóa đơn EVN hoặc số kWh để ước tính dung lượng pin lưu trữ và gửi yêu cầu báo giá.', cta: 'Tính ngay →', href: '/tuvan', primary: true },
        { icon: '🔋', title: 'Sản phẩm & Phụ kiện chính hãng', desc: 'Khám phá Inverter Hybrid, Tấm pin mặt trời, Pin Lithium LFP và trọn bộ Phụ kiện lắp đặt kèm thông số, Datasheet.', cta: 'Xem sản phẩm →', href: '/products', primary: false },
        { icon: '📰', title: 'Kiến thức & Dự án thực tế', desc: 'Cập nhật kinh nghiệm chọn cấu hình, quy định giá điện mới nhất và các công trình Hybrid đã bàn giao.', cta: 'Đọc tin tức →', href: '/news', primary: false }
      ],
      showFeaturedProducts: true, productsKicker: 'Thiết bị chính hãng', productsTitle: 'Sản phẩm tiêu biểu', productsCount: 4, showContactCta: true
    });
    setChk('hm_showSlider', hm.showSlider !== false);
    setChk('hm_autoSlide', hm.autoSlide !== false);
    syncSliderControls();
    setVal('hm_sliderKicker', hm.sliderKicker || '★ Nổi bật');
    setVal('hm_sliderTitle', hm.sliderTitle || 'Tin tức & Dự án nổi bật');
    setVal('hm_sliderIntervalSec', hm.sliderIntervalSec || 4.5);
    setVal('hm_sliderHeight', hm.sliderHeight || 430);
    if ($('hmSliderHVal')) $('hmSliderHVal').textContent = hm.sliderHeight || 430;
    setChk('hm_showQuickCards', hm.showQuickCards !== false);
    setChk('hm_showQuickDemo', hm.showQuickDemo === true);
    setChk('hm_showFeaturedProducts', hm.showFeaturedProducts !== false);
    setVal('hm_productsKicker', hm.productsKicker || 'Thiết bị chính hãng');
    setVal('hm_productsTitle', hm.productsTitle || 'Sản phẩm tiêu biểu');
    setVal('hm_productsCount', String(hm.productsCount || 4));
    setChk('hm_showContactCta', hm.showContactCta !== false);
    renderHomeQuickEditor();
    renderNotesEditor();
  }

  
  function renderHomeQuickEditor() {
    const el = $('homeQuickEditor');
    if (!el || !CONFIG || !CONFIG.home) return;
    const cards = Array.isArray(CONFIG.home.quickCards) ? CONFIG.home.quickCards : [];
    el.innerHTML = cards.map((c, idx) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:5px">
        <div style="display:grid;grid-template-columns:56px 1fr;gap:5px">
          <input type="text" class="f-input" data-hq-icon="${idx}" value="${escapeAttr(c.icon || '')}" placeholder="Icon" style="text-align:center">
          <input type="text" class="f-input" data-hq-title="${idx}" value="${escapeAttr(c.title || '')}" placeholder="Tiêu đề thẻ">
        </div>
        <textarea class="f-input" rows="2" data-hq-desc="${idx}" placeholder="Mô tả ngắn...">${escapeAttr(c.desc || '')}</textarea>
        <input type="text" class="f-input" data-hq-cta="${idx}" value="${escapeAttr(c.cta || '')}" placeholder="Nhãn nút (VD: Tính ngay →)">
      </div>
    `).join('');
    el.querySelectorAll('[data-hq-icon]').forEach(inp => inp.oninput = () => { CONFIG.home.quickCards[+inp.dataset.hqIcon].icon = inp.value; setDirty(true); pushPreview(); });
    el.querySelectorAll('[data-hq-title]').forEach(inp => inp.oninput = () => { CONFIG.home.quickCards[+inp.dataset.hqTitle].title = inp.value; setDirty(true); pushPreview(); });
    el.querySelectorAll('[data-hq-desc]').forEach(inp => inp.oninput = () => { CONFIG.home.quickCards[+inp.dataset.hqDesc].desc = inp.value; setDirty(true); pushPreview(); });
    el.querySelectorAll('[data-hq-cta]').forEach(inp => inp.oninput = () => { CONFIG.home.quickCards[+inp.dataset.hqCta].cta = inp.value; setDirty(true); pushPreview(); });
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

  // ---------- PRODUCT CATALOG MANAGER ----------
  function setLoadedProducts(products) {
    PRODUCTS = products;
    savedProductStates = new Map(products.map(product => [product.id, {
      active: product.active !== false, stock: productStock(product)
    }]));
  }

  function publicationChanged(product, saved = savedProductStates.get(product.id)) {
    return !saved || saved.active !== (product.active !== false) || saved.stock !== productStock(product);
  }

  function productPublication(product) {
    const saved = savedProductStates.get(product.id);
    if (!saved) return 'Sản phẩm mới · chờ lưu';
    if (publicationChanged(product, saved)) return 'Có thay đổi · chờ lưu';
    return saved.active ? 'Đã đăng' : 'Đang ẩn';
  }

  function updateProductPublication() {
    if (!datasetReady.products) {
      $('prodPublicationSummary').textContent = '';
      $('btnHiddenInStock').hidden = true;
      return;
    }
    const saved = [...savedProductStates.values()];
    const published = saved.filter(state => state.active).length;
    const hiddenInStock = saved.filter(state => !state.active && state.stock === 'in_stock').length;
    const pending = savedProductStates.size !== PRODUCTS.length ||
      PRODUCTS.some(product => publicationChanged(product));
    $('prodPublicationSummary').textContent = `${published} đã đăng · ${hiddenInStock} còn hàng nhưng đang ẩn${pending ? ' · Bấm Lưu danh mục sản phẩm để áp dụng thay đổi' : ''}`;
    $('btnHiddenInStock').hidden = !PRODUCTS.some(product => product.active === false && productStock(product) === 'in_stock');
  }

  function filteredProducts() {
    const query = normalizeSearch($('prodSearch').value);
    const stock = $('prodStockFilter').value;
    const visibility = $('prodVisibility').value;
    return PRODUCTS.map((p, idx) => ({ p, idx })).filter(({ p }) => (
      (prodFilter === 'all' || p.category === prodFilter) &&
      (stock === 'all' || productStock(p) === stock) &&
      (visibility === 'all' || (p.active !== false) === (visibility === 'visible')) &&
      normalizeSearch([p.name, p.brand, p.id].join(' ')).includes(query)
    ));
  }

  function updateProductSelection() {
    const count = selectedProducts.size;
    $('productBulkBar').hidden = count === 0;
    $('productSelectionCount').textContent = `Đã chọn ${count} sản phẩm`;
    $('btnClearProducts').disabled = count === 0;
    $('btnApplyProductBulk').disabled = !count || !$('productBulkAction').value;
  }

  function renderProdList() {
    const el = $('prodListEditor');
    if (!el) return;
    updateProductPublication();
    if ($('prodCount')) $('prodCount').textContent = PRODUCTS.length;
    const filtered = filteredProducts();
    const visible = new Set(filtered.map(({ p }) => p));
    for (const product of selectedProducts) if (!visible.has(product)) selectedProducts.delete(product);
    $('prodResults').textContent = datasetReady.products ? `${filtered.length} / ${PRODUCTS.length} sản phẩm` : 'Không tải được kho. Tải lại trang trước khi lưu.';
    $('btnSelectProducts').disabled = filtered.length === 0;
    updateProductSelection();
    const catLabel = { inverter: 'Inverter', panel: 'Pin MT', battery: 'Lưu trữ', accessory: 'Phụ kiện' };

    el.innerHTML = filtered.map(({ p, idx }) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <label class="adm-check"><input type="checkbox" data-p-select="${idx}" aria-label="Chọn ${escapeAttr(p.name)}" ${selectedProducts.has(p) ? 'checked' : ''}> Chọn để cập nhật hàng loạt</label>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <img src="${escapeAttr(p.imageUrl || '/assets/prod-' + p.category + '.jpg')}" alt="" style="width:36px;height:36px;border-radius:7px;object-fit:cover;border:1px solid #E2E8F0;flex:none">
          <div style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;flex:1;min-width:0">
            <span style="color:#D9560B;white-space:nowrap">[${catLabel[p.category] || p.category}]</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeAttr(p.name)}</span>
          </div>
          <label class="btn-ghost small" style="padding:4px 7px;font-size:11px;cursor:pointer;white-space:nowrap" title="Tải ảnh sản phẩm">
            Đổi ảnh<input type="file" accept="image/*" data-p-img="${idx}" hidden>
          </label>
          <button type="button" class="del-btn" data-p-del="${idx}" title="Xóa">×</button>
        </div>
        <div class="adm-product-publication">
          <label><input type="checkbox" data-p-act="${idx}" aria-label="Hiện trên trang khách: ${escapeAttr(p.name)}" ${p.active !== false ? 'checked' : ''}> Hiện trên trang khách</label>
          <span data-p-publication="${idx}">${productPublication(p)}</span>
          ${savedProductStates.get(p.id)?.active ? `<a href="/products?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Xem trang khách</a>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <input type="text" class="f-input" data-p-name="${idx}" value="${escapeAttr(p.name)}" placeholder="Tên sản phẩm">
          <input type="text" class="f-input" data-p-brand="${idx}" value="${escapeAttr(p.brand || '')}" placeholder="Hãng">
          ${p.category === 'accessory'
            ? `<input type="text" class="f-input" data-p-spec="${idx}" value="${escapeAttr(p.specText || '')}" placeholder="Quy cách (VD: IP65, 4mm²...)" title="Quy cách / Thông số chính">`
            : `<input type="number" class="f-input" data-p-spec="${idx}" value="${p.category === 'inverter' ? p.powerKw : p.category === 'panel' ? p.wattWp : p.capacityKwh}" step="0.01" title="Công suất / Dung lượng">`}
          <input type="number" class="f-input" data-p-price="${idx}" value="${p.price || 0}" step="100000" title="Giá nội bộ">
          <input type="text" class="f-input" data-p-war="${idx}" value="${escapeAttr(p.warranty || '')}" placeholder="Bảo hành">
          <select class="f-input" data-p-stock="${idx}" style="font-weight:700;color:${(p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock')) === 'out_of_stock' ? '#B91C1C' : (p.stockStatus === 'contact' ? '#B45309' : '#047857')}">
            <option value="in_stock" ${(p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock')) === 'in_stock' ? 'selected' : ''}>✅ Còn hàng</option>
            <option value="contact" ${p.stockStatus === 'contact' ? 'selected' : ''}>📞 Liên hệ</option>
            <option value="out_of_stock" ${(p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock')) === 'out_of_stock' ? 'selected' : ''}>⛔ Hết hàng</option>
          </select>
          <input type="text" class="f-input" style="grid-column:1/-1" data-p-note="${idx}" value="${escapeAttr(p.note || '')}" placeholder="Ghi chú ngắn">
          <textarea class="f-input" style="grid-column:1/-1" rows="2" data-p-desc="${idx}" placeholder="Mô tả chi tiết sản phẩm...">${escapeAttr(p.description || '')}</textarea>
          <textarea class="f-input" style="grid-column:1/-1" rows="3" data-p-specs="${idx}" placeholder="Thông số kỹ thuật (mỗi dòng dạng Tên: Giá trị)">${escapeAttr(p.specs || '')}</textarea>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding-top:4px;border-top:1px dashed #E2E8F0">
          <input type="text" class="f-input" style="flex:1;min-width:140px;font-size:12px" data-p-ds-url="${idx}" value="${escapeAttr(p.datasheetUrl || '')}" placeholder="Link Datasheet (hoặc bấm tải lên)">
          <label class="btn-ghost small" style="padding:5px 8px;font-size:11.5px;cursor:pointer">
            📄 Tải Datasheet<input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip" data-p-ds-file="${idx}" hidden>
          </label>
          <label class="btn-ghost small" style="padding:5px 8px;font-size:11.5px;cursor:pointer">
            📎 + Tài liệu<input type="file" accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg,.zip" data-p-att-file="${idx}" hidden>
          </label>
        </div>
        ${(Array.isArray(p.attachments) && p.attachments.length) ? `<div style="display:flex;flex-wrap:wrap;gap:5px">${p.attachments.map((a, ai) => `<span style="display:inline-flex;align-items:center;gap:4px;background:#EEF2FF;color:#3730A3;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700">📎 ${escapeAttr(a.name)} <button type="button" data-p-del-att="${idx}:${ai}" style="border:0;background:none;color:#DC2626;cursor:pointer;font-weight:900;padding:0">×</button></span>`).join('')}</div>` : ''}
      </div>
    `).join('') || '<p class="hint adm-empty">Không có sản phẩm phù hợp với bộ lọc.</p>';

    el.querySelectorAll('[data-p-select]').forEach(cb => cb.onchange = () => {
      const product = PRODUCTS[Number(cb.dataset.pSelect)];
      if (cb.checked) selectedProducts.add(product);
      else selectedProducts.delete(product);
      updateProductSelection();
    });
    el.querySelectorAll('[data-p-act]').forEach(cb => cb.onchange = () => {
      const idx = Number(cb.dataset.pAct);
      PRODUCTS[idx].active = cb.checked;
      if ($('prodVisibility').value !== 'all') renderProdList();
      else {
        el.querySelector(`[data-p-publication="${idx}"]`).textContent = productPublication(PRODUCTS[idx]);
        updateProductPublication();
      }
    });
    el.querySelectorAll('[data-p-name]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pName].name = inp.value; });
    el.querySelectorAll('[data-p-brand]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pBrand].brand = inp.value; });
    el.querySelectorAll('[data-p-spec]').forEach(inp => inp.oninput = () => {
      const p = PRODUCTS[+inp.dataset.pSpec];
      if (p.category === 'accessory') { p.specText = inp.value; }
      else {
        const v = Math.max(0.1, Number(inp.value) || 0);
        if (p.category === 'inverter') p.powerKw = v; else if (p.category === 'panel') p.wattWp = v; else p.capacityKwh = v;
      }
    });
    el.querySelectorAll('[data-p-war]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pWar].warranty = inp.value; });
    el.querySelectorAll('[data-p-stock]').forEach(sel => sel.onchange = () => {
      const st = sel.value;
      PRODUCTS[+sel.dataset.pStock].stockStatus = st;
      PRODUCTS[+sel.dataset.pStock].inStock = st !== 'out_of_stock';
      PRODUCTS[+sel.dataset.pStock].manualStockOverride = true;
      sel.style.color = st === 'out_of_stock' ? '#B91C1C' : (st === 'contact' ? '#B45309' : '#047857');
      if ($('prodStockFilter').value !== 'all') renderProdList();
      else {
        const idx = Number(sel.dataset.pStock);
        el.querySelector(`[data-p-publication="${idx}"]`).textContent = productPublication(PRODUCTS[idx]);
        updateProductPublication();
      }
    });
    el.querySelectorAll('[data-p-note]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pNote].note = inp.value; });
    el.querySelectorAll('[data-p-desc]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pDesc].description = inp.value; });
    el.querySelectorAll('[data-p-specs]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pSpecs].specs = inp.value; });
    el.querySelectorAll('[data-p-ds-url]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pDsUrl].datasheetUrl = inp.value.trim(); });
    el.querySelectorAll('[data-p-ds-file]').forEach(inp => inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const idx = +inp.dataset.pDsFile;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const res = await api('/api/admin/upload-document', { method: 'POST', body: JSON.stringify({ dataUrl: rd.result, filename: f.name }) });
          PRODUCTS[idx].datasheetUrl = res.url;
          PRODUCTS[idx].datasheetName = 'Datasheet: ' + f.name;
          renderProdList();
          toast('Đã tải lên Datasheet! Bấm "Lưu danh mục sản phẩm" để ghi lại.');
        } catch (err) { toast(err.message); }
      };
      rd.readAsDataURL(f);
    });
    el.querySelectorAll('[data-p-att-file]').forEach(inp => inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const idx = +inp.dataset.pAttFile;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const res = await api('/api/admin/upload-document', { method: 'POST', body: JSON.stringify({ dataUrl: rd.result, filename: f.name }) });
          if (!Array.isArray(PRODUCTS[idx].attachments)) PRODUCTS[idx].attachments = [];
          PRODUCTS[idx].attachments.push({ name: f.name, url: res.url });
          renderProdList();
          toast('Đã đính kèm tài liệu! Bấm "Lưu danh mục sản phẩm" để ghi lại.');
        } catch (err) { toast(err.message); }
      };
      rd.readAsDataURL(f);
    });
    el.querySelectorAll('[data-p-del-att]').forEach(btn => btn.onclick = () => {
      const [pi, ai] = btn.dataset.pDelAtt.split(':').map(Number);
      PRODUCTS[pi].attachments.splice(ai, 1);
      renderProdList();
    });
    el.querySelectorAll('[data-p-price]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pPrice].price = Math.max(0, Number(inp.value) || 0); });
    el.querySelectorAll('[data-p-img]').forEach(inp => {
      inp.onchange = () => {
        const file = inp.files[0]; if (!file) return;
        const idx = +inp.dataset.pImg;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const res = await api('/api/admin/upload-product-image', { method: 'POST', body: JSON.stringify({ dataUrl: reader.result }) });
            PRODUCTS[idx].imageUrl = res.imageUrl;
            renderProdList();
            toast('Đã cập nhật ảnh sản phẩm! Nhớ bấm Lưu danh mục sản phẩm.');
          } catch (err) { toast(err.message); }
        };
        reader.readAsDataURL(file);
      };
    });
    el.querySelectorAll('[data-p-del]').forEach(btn => btn.onclick = () => { PRODUCTS.splice(+btn.dataset.pDel, 1); renderProdList(); });
  }

  if ($('prodFilterTabs')) {
    $('prodFilterTabs').querySelectorAll('[data-pcat]').forEach(btn => {
      btn.onclick = () => {
        prodFilter = btn.dataset.pcat;
        highlightButton([...$('prodFilterTabs').querySelectorAll('[data-pcat]')], btn);
        renderProdList();
      };
    });
  }

  $('prodSearch').oninput = renderProdList;
  $('prodStockFilter').onchange = renderProdList;
  $('prodVisibility').onchange = renderProdList;
  $('btnHiddenInStock').onclick = () => {
    $('prodSearch').value = '';
    $('prodStockFilter').value = 'in_stock';
    $('prodVisibility').value = 'hidden';
    $('prodFilterTabs').querySelector('[data-pcat="all"]').click();
  };
  $('btnSelectProducts').onclick = () => {
    for (const { p } of filteredProducts()) selectedProducts.add(p);
    renderProdList();
  };
  $('btnClearProducts').onclick = () => { selectedProducts.clear(); renderProdList(); };
  $('productBulkAction').onchange = updateProductSelection;
  $('btnApplyProductBulk').onclick = () => {
    const action = $('productBulkAction').value;
    if (!action || !selectedProducts.size) return;
    const count = selectedProducts.size;
    for (const product of selectedProducts) {
      if (action === 'show' || action === 'hide') product.active = action === 'show';
      else Object.assign(product, { stockStatus: action, inStock: action !== 'out_of_stock', manualStockOverride: true });
    }
    selectedProducts.clear();
    $('productBulkAction').value = '';
    renderProdList();
    toast(`Đã chỉnh ${count} sản phẩm. Bấm Lưu danh mục sản phẩm để áp dụng.`);
  };

  if ($('btnAddProd')) {
    $('btnAddProd').onclick = () => {
      const cat = $('np_cat').value;
      const name = $('np_name').value.trim();
      const specRaw = $('np_spec').value.trim();
      const spec = Number(specRaw) || 0;
      if (!name || (cat !== 'accessory' && spec <= 0)) return toast('Nhập tên sản phẩm và công suất/dung lượng hợp lệ.');
      const item = {
        id: `${cat}-${Date.now()}`,
        category: cat,
        brand: $('np_brand').value.trim(),
        name,
        price: Math.max(0, Number($('np_price').value) || 0),
        warranty: cat === 'inverter' ? '5 năm' : ($('np_phase').value.trim() || (cat === 'accessory' ? '2 năm' : '10 năm')),
        note: '',
        description: $('np_desc') ? $('np_desc').value.trim() : '',
        specs: '',
        datasheetUrl: '',
        datasheetName: '',
        attachments: [],
        imageUrl: `/assets/prod-${cat}.jpg`,
        stockStatus: $('np_stock') ? $('np_stock').value : 'in_stock',
        inStock: $('np_stock') ? $('np_stock').value !== 'out_of_stock' : true,
        active: true
      };
      if (cat === 'inverter') { item.powerKw = spec; item.phase = $('np_phase').value.trim() || '1 pha'; }
      else if (cat === 'panel') item.wattWp = spec;
      else if (cat === 'battery') item.capacityKwh = spec;
      else item.specText = specRaw;
      PRODUCTS.unshift(item);
      $('np_name').value = ''; $('np_spec').value = ''; $('np_price').value = ''; if ($('np_desc')) $('np_desc').value = '';
      renderProdList();
      toast('Đã thêm sản phẩm. Bấm "Lưu danh mục sản phẩm" để ghi lên máy chủ.');
    };
  }

  if ($('btnSaveProds')) {
    $('btnSaveProds').onclick = async () => {
      const pane = $('tab-products');
      if (!datasetReady.products || pane.inert) return;
      pane.inert = true;
      pane.setAttribute('aria-busy', 'true');
      try {
        const res = await api('/api/admin/products', { method: 'PUT', body: JSON.stringify({ products: PRODUCTS }) });
        setLoadedProducts(res.products);
        renderProdList();
        toast(`Đã lưu ${PRODUCTS.length} sản phẩm lên máy chủ!`);
      } catch (err) { toast(err.message); }
      finally { pane.inert = false; pane.removeAttribute('aria-busy'); }
    };
  }

  if ($('btnResetProds')) {
    $('btnResetProds').onclick = async () => {
      if (!confirm('Thay thế kho sản phẩm hiện tại bằng kho mẫu?')) return;
      try {
        const res = await api('/api/admin/products/reset', { method: 'POST' });
        setLoadedProducts(res.products);
        renderProdList();
        toast('Đã khôi phục kho sản phẩm mẫu.');
      } catch (err) { toast(err.message); }
    };
  }

  if ($('prodUploadFile')) {
    $('prodUploadFile').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const lower = file.name.toLowerCase();
      const mode = $('importProdMode').value;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          let payload;
          if (lower.endsWith('.xlsx')) {
            const bytes = new Uint8Array(reader.result);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            payload = { format: 'xlsx', mode, base64: btoa(bin) };
          } else if (lower.endsWith('.csv')) {
            payload = { format: 'csv', mode, content: reader.result };
          } else {
            payload = { format: 'json', mode, products: JSON.parse(reader.result) };
          }
          const res = await api('/api/admin/products/import', { method: 'POST', body: JSON.stringify(payload) });
          setLoadedProducts(res.products);
          renderProdList();
          toast(`Đã cập nhật ${res.count} sản phẩm từ tệp ${file.name}!`);
        } catch (err) { toast(err.message || 'Tệp Excel/CSV/JSON không hợp lệ.'); }
        e.target.value = '';
      };
      if (lower.endsWith('.xlsx')) reader.readAsArrayBuffer(file);
      else reader.readAsText(file, 'utf-8');
    });
  }

  
  // ---------- NEWS MANAGER ----------
  function renderNewsList() {
    const el = $('newsListEditor');
    if (!el) return;
    if ($('newsCount')) $('newsCount').textContent = NEWS.length;
    const query = normalizeSearch($('newsSearch').value);
    const state = $('newsStateFilter').value;
    const filtered = NEWS.map((a, idx) => ({ a, idx })).filter(({ a }) => {
      const published = a.published !== false;
      return normalizeSearch([a.title, a.author, a.category].join(' ')).includes(query) &&
        (state === 'all' || (state === 'draft' && !published) || (state === 'published' && published) ||
          (state === 'featured' && published && a.featured !== false));
    });
    $('newsResults').textContent = datasetReady.news ? `${filtered.length} / ${NEWS.length} bài viết` : 'Không tải được tin tức. Tải lại trang trước khi lưu.';
    el.innerHTML = filtered.map(({ a, idx }) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <img src="${escapeAttr(a.imageUrl || '/assets/prod-panel.jpg')}" alt="" style="width:42px;height:32px;border-radius:6px;object-fit:cover;border:1px solid #E2E8F0;flex:none">
          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;flex:1;min-width:0">
            <input type="checkbox" data-n-pub="${idx}" ${a.published !== false ? 'checked' : ''} title="Hiển thị trên trang khách">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeAttr(a.title)}</span>
          </label>
          <label class="btn-ghost small" style="padding:4px 7px;font-size:11px;cursor:pointer;white-space:nowrap">
            Đổi ảnh<input type="file" accept="image/*" data-n-img="${idx}" hidden>
          </label>
          <button type="button" class="del-btn" data-n-del="${idx}" title="Xóa bài">×</button>
        </div>
        <span class="adm-tag ${a.published === false ? 'adm-tag-draft' : ''}">${a.published === false ? 'Chưa công khai' : 'Đã công khai'}</span>
        <input type="text" class="f-input" data-n-title="${idx}" value="${escapeAttr(a.title)}" placeholder="Tiêu đề bài viết">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <select class="f-input" data-n-cat="${idx}">
            ${['Kiến thức Hybrid', 'Dự án thực tế', 'Tin ngành điện', 'Khuyến mãi'].map(c => `<option value="${c}" ${a.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <input type="date" class="f-input" data-n-date="${idx}" value="${escapeAttr(a.publishedAt || '')}">
        </div>
        <input type="text" class="f-input" data-n-author="${idx}" value="${escapeAttr(a.author || '')}" placeholder="Tác giả">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#B45309"><input type="checkbox" data-n-feat="${idx}" ${a.featured !== false ? 'checked' : ''}> ⭐ Nổi bật Trang chủ (trượt ngang)</label>
        <textarea class="f-input" rows="2" data-n-sum="${idx}" placeholder="Mô tả ngắn...">${escapeAttr(a.summary || '')}</textarea>
        <textarea class="f-input" rows="4" data-n-content="${idx}" placeholder="Nội dung bài viết đầy đủ...">${escapeAttr(a.content || '')}</textarea>
      </div>
    `).join('') || '<p class="hint adm-empty">Không có bài viết phù hợp với bộ lọc.</p>';

    el.querySelectorAll('[data-n-pub]').forEach(cb => cb.onchange = () => { NEWS[+cb.dataset.nPub].published = cb.checked; renderNewsList(); });
    el.querySelectorAll('[data-n-feat]').forEach(cb => cb.onchange = () => {
      NEWS[+cb.dataset.nFeat].featured = cb.checked;
      if (state === 'featured') renderNewsList();
    });
    el.querySelectorAll('[data-n-title]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nTitle].title = inp.value; });
    el.querySelectorAll('[data-n-cat]').forEach(sel => sel.onchange = () => { NEWS[+sel.dataset.nCat].category = sel.value; });
    el.querySelectorAll('[data-n-date]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nDate].publishedAt = inp.value; });
    el.querySelectorAll('[data-n-author]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nAuthor].author = inp.value; });
    el.querySelectorAll('[data-n-sum]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nSum].summary = inp.value; });
    el.querySelectorAll('[data-n-content]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nContent].content = inp.value; });
    el.querySelectorAll('[data-n-img]').forEach(inp => inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const idx = +inp.dataset.nImg;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const res = await api('/api/admin/upload-product-image', { method: 'POST', body: JSON.stringify({ dataUrl: rd.result }) });
          NEWS[idx].imageUrl = res.imageUrl;
          renderNewsList();
          toast('Đã cập nhật ảnh bìa! Bấm "Lưu danh sách tin tức" để lưu lại.');
        } catch (err) { toast(err.message); }
      };
      rd.readAsDataURL(f);
    });
    el.querySelectorAll('[data-n-del]').forEach(btn => btn.onclick = () => {
      NEWS.splice(+btn.dataset.nDel, 1);
      renderNewsList();
    });
  }

  $('newsSearch').oninput = renderNewsList;
  $('newsStateFilter').onchange = renderNewsList;

  if ($('nn_img_file')) {
    $('nn_img_file').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const res = await api('/api/admin/upload-product-image', { method: 'POST', body: JSON.stringify({ dataUrl: rd.result }) });
          newNewsImgUrl = res.imageUrl;
          toast('Đã tải ảnh bìa sẵn sàng cho bài viết mới!');
        } catch (err) { toast(err.message); }
      };
      rd.readAsDataURL(f);
    });
  }

  if ($('btnAddNews')) {
    $('btnAddNews').onclick = () => {
      const title = $('nn_title').value.trim();
      if (!title) return toast('Vui lòng nhập tiêu đề bài viết.');
      NEWS.unshift({
        id: 'news-' + Date.now(),
        title,
        category: $('nn_cat').value,
        publishedAt: $('nn_date').value || new Date().toISOString().slice(0, 10),
        author: $('nn_author').value.trim() || 'Mai Sơn Solar',
        imageUrl: newNewsImgUrl || '/assets/prod-panel.jpg',
        summary: $('nn_summary').value.trim(),
        content: $('nn_content').value.trim(),
        published: !$('nn_draft').checked,
        featured: $('nn_featured') ? $('nn_featured').checked : true
      });
      $('nn_title').value = ''; $('nn_summary').value = ''; $('nn_content').value = '';
      newNewsImgUrl = '';
      $('newsSearch').value = '';
      $('newsStateFilter').value = $('nn_draft').checked ? 'draft' : 'all';
      renderNewsList();
      toast('Đã thêm bài viết. Bấm Lưu danh sách tin tức để ghi lại.');
    };
  }

  if ($('btnSaveNews')) {
    $('btnSaveNews').onclick = async () => {
      const pane = $('tab-news');
      if (!datasetReady.news || pane.inert) return;
      pane.inert = true;
      pane.setAttribute('aria-busy', 'true');
      try {
        const res = await api('/api/admin/news', { method: 'PUT', body: JSON.stringify({ articles: NEWS }) });
        NEWS = res.articles;
        renderNewsList();
        toast(`Đã lưu ${NEWS.length} bài viết tin tức lên máy chủ!`);
      } catch (err) { toast(err.message); }
      finally { pane.inert = false; pane.removeAttribute('aria-busy'); }
    };
  }

  if ($('btnResetNews')) {
    $('btnResetNews').onclick = async () => {
      if (!confirm('Thay thế các bài viết hiện tại bằng nội dung mẫu?')) return;
      try {
        const res = await api('/api/admin/news/reset', { method: 'POST' });
        NEWS = res.articles;
        renderNewsList();
        toast('Đã khôi phục các bài viết mẫu.');
      } catch (err) { toast(err.message); }
    };
  }

  
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
          <div>🔋 Pin lưu trữ cần: <b>${Number(l.batNeededKwh || 0).toFixed(1)} kWh</b> (${l.modulesCount || 0} × ${l.moduleKwh || 5.12} kWh · tối ${l.evePct ?? 70}%)</div>
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
            ${l.webhookSentAt ? '<span style="background:#DBEAFE;color:#1E40AF;padding:2px 6px;border-radius:99px;font-weight:700">🗄 CSDL OK</span>' : ''}
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
      if (tab === 'overview') btn.hidden = !['leads', 'products', 'news'].some(can);
      else btn.hidden = !(tab === 'users' || tab === 'security' ? isSuper : tab === 'account' || can(tab));
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
        <input type="checkbox" data-nu-perm="${k}" ${['products', 'news', 'leads'].includes(k) ? 'checked' : ''}>
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

  
  if ($('btnSyncSheet')) {
    $('btnSyncSheet').onclick = async () => {
      const url = $('gs_url') ? $('gs_url').value.trim() : '';
      if (!url) return toast('Vui lòng dán link Google Sheet trước.');
      const btn = $('btnSyncSheet');
      btn.disabled = true; btn.textContent = '⏳ Đang đồng bộ từ Google Sheet...';
      try {
        const res = await api('/api/admin/products/sync-sheet', { method: 'POST', body: JSON.stringify({ url }) });
        if (Array.isArray(res.products)) setLoadedProducts(res.products);
        if (res.config) CONFIG.sheetSync = res.config.sheetSync;
        renderProdList();
        if ($('gs_status')) $('gs_status').innerHTML = `✅ Đồng bộ xong (${escapeAttr(fmtLeadTime(res.lastSyncedAt))}): <b>${escapeAttr(res.summary)}</b>`;
        toast('Đồng bộ Google Sheet thành công: ' + res.summary);
      } catch (err) {
        toast(err.message || 'Lỗi đồng bộ Google Sheet.');
      } finally {
        btn.disabled = false; btn.textContent = '🔄 Đồng bộ sản phẩm từ Google Sheet';
      }
    };
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
      setChk('gs_syncProducts', settings.syncProducts !== false);
      setChk('gs_syncNews', settings.syncNews !== false);
      setChk('gs_autoPullProducts', settings.autoPullProducts);
      setVal('gs_pullIntervalSec', settings.pullIntervalSec || 60);
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
            syncLeads: $('gs_syncLeads').checked,
            syncProducts: $('gs_syncProducts').checked,
            syncNews: $('gs_syncNews').checked,
            autoPullProducts: $('gs_autoPullProducts').checked,
            pullIntervalSec: Number($('gs_pullIntervalSec').value) || 60
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

  if ($('btnPullProdGsheet')) {
    $('btnPullProdGsheet').onclick = async () => {
      try {
        toast('Đang kéo Kho sản phẩm từ Google Sheets...');
        const res = await api('/api/admin/gsheet/pull-products', { method: 'POST' });
        if (Array.isArray(res.products)) { setLoadedProducts(res.products); renderProdList(); }
        renderGsheetStatus(res.status);
        toast(`Đã kéo ${res.count} sản phẩm từ Google Sheets!`);
      } catch (err) {
        fetchGsheetStatus();
        toast(err.message || 'Không thể kéo dữ liệu từ Google Sheets.');
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
    if (!CONFIG) return;
    const mt = CONFIG.maintenance || { enabled: false, mode: 'error404', allowedRoute: '/tuvan' };
    const isAllow = ($('m_mode') ? $('m_mode').value : mt.mode) === 'allow_page';
    if ($('mAllowedWrap')) $('mAllowedWrap').hidden = !isAllow;
    if ($('maintStatusBox')) {
      if (mt.enabled) {
        const rMap = { '/': 'Trang chủ', '/tuvan': 'Tư vấn', '/products': 'Sản phẩm', '/news': 'Tin tức', '/demo': 'Demo 3D' };
        const configured = Array.isArray(mt.allowedRoutes) && mt.allowedRoutes.length ? mt.allowedRoutes : (mt.allowedRoute ? [mt.allowedRoute] : []);
        const ar = configured.filter(route => route !== '/demo' || CONFIG.sections.showSolarDemo !== false);
        const names = ar.map(r => rMap[r] || r).join(', ');
        $('maintStatusBox').style.background = '#FEF2F2';
        $('maintStatusBox').style.color = '#B91C1C';
        $('maintStatusBox').style.borderColor = '#FECACA';
        $('maintStatusBox').textContent = (mt.mode === 'allow_page' && ar.length)
          ? `🔴 ĐANG BẢO TRÌ — Chỉ mở: ${names}`
          : '🔴 ĐANG BẢO TRÌ — Toàn bộ trang khách đang báo 404 Error';
      } else {
        $('maintStatusBox').style.background = '#ECFDF5';
        $('maintStatusBox').style.color = '#047857';
        $('maintStatusBox').style.borderColor = '#A7F3D0';
        $('maintStatusBox').textContent = '🟢 Website đang hoạt động bình thường';
      }
    }
    if ($('btnToggleMaint')) {
      $('btnToggleMaint').textContent = mt.enabled ? '✅ Tắt bảo trì (Mở lại web)' : '🔧 Bật bảo trì ngay';
      $('btnToggleMaint').style.background = mt.enabled ? '#059669' : '';
    }
  }

  function populateMaintForm() {
    const maintenance = CONFIG.maintenance || {};
    const routes = Array.isArray(maintenance.allowedRoutes) && maintenance.allowedRoutes.length
      ? maintenance.allowedRoutes : [maintenance.allowedRoute || '/tuvan'];
    setVal('m_mode', maintenance.mode || 'error404');
    document.querySelectorAll('[data-m-route]').forEach(box => { box.checked = routes.includes(box.dataset.mRoute); });
    updateMaintUI();
  }

  async function saveMaintState(enabledVal) {
    const payload = {
      enabled: enabledVal,
      mode: $('m_mode') ? $('m_mode').value : 'error404',
      allowedRoutes: Array.from(document.querySelectorAll('[data-m-route]')).filter(c => c.checked).map(c => c.dataset.mRoute),
      title: '404 — Hệ thống đang bảo trì',
      message: 'Website đang được nâng cấp và bảo trì định kỳ. Quý khách vui lòng quay lại sau ít phút hoặc liên hệ hotline bên dưới để được hỗ trợ ngay.'
    };
    if (payload.mode === 'allow_page' && !payload.allowedRoutes.length) {
      toast('Chọn ít nhất một trang được mở trong thời gian bảo trì.');
      return;
    }
    try {
      const res = await api('/api/admin/maintenance', { method: 'PUT', body: JSON.stringify(payload) });
      CONFIG.maintenance = res.config.maintenance;
      updateMaintUI();
      pushPreview();
      toast(payload.enabled ? 'Đã BẬT chế độ bảo trì ngay lập tức!' : 'Đã TẮT chế độ bảo trì — website hoạt động lại bình thường!');
    } catch (err) { toast(err.message); }
  }

  $('m_mode').onchange = updateMaintUI;
  if ($('btnToggleMaint')) {
    $('btnToggleMaint').onclick = () => {
      const cur = Boolean(CONFIG && CONFIG.maintenance && CONFIG.maintenance.enabled);
      saveMaintState(!cur);
    };
  }
  if ($('btnSaveMaint')) {
    $('btnSaveMaint').onclick = () => {
      const cur = Boolean(CONFIG && CONFIG.maintenance && CONFIG.maintenance.enabled);
      saveMaintState(cur);
    };
  }
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
  
  function setUpdateProgress(pct, text, state = 'working', filename = null) {
    const box = $('updateProgressBox');
    if (!box) return;
    box.hidden = false;
    if (filename !== null && $('updFileName')) $('updFileName').textContent = filename;
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    if ($('updPercent')) {
      $('updPercent').textContent = p + '%';
      $('updPercent').style.color = state === 'error' ? '#DC2626' : state === 'done' ? '#059669' : '#EA580C';
    }
    if ($('updBarFill')) {
      $('updBarFill').style.width = p + '%';
      $('updBarFill').style.background = state === 'error' ? '#EF4444' : state === 'done' ? 'linear-gradient(90deg,#10B981,#059669)' : 'linear-gradient(90deg,#F26A1B,#FFB400)';
    }
    if ($('updStatusText')) {
      $('updStatusText').textContent = text;
      $('updStatusText').style.color = state === 'error' ? '#B91C1C' : state === 'done' ? '#047857' : '#475569';
    }
  }

  function postWithProgress(url, jsonBody, onUploadPct) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', 'application/json');
      const token = getStoredToken();
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.upload.onprogress = ev => {
        if (ev.lengthComputable && onUploadPct) onUploadPct(ev.loaded / ev.total);
      };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `Lỗi máy chủ (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Mất kết nối máy chủ khi tải tệp lên.'));
      xhr.send(jsonBody);
    });
  }

  if ($('siteUpdateZipFile')) {
    $('siteUpdateZipFile').addEventListener('change', async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const box = $('updateStatusBox');
      if (box) box.hidden = true;
      const kb = Math.max(1, Math.round(file.size / 1024));
      setUpdateProgress(8, 'Đang đọc gói cập nhật từ máy tính...', 'working', `📦 ${file.name} (${kb} KB)`);

      try {
        if (!file.name.toLowerCase().endsWith('.zip')) {
          throw new Error('Vui lòng chọn tệp gói cập nhật định dạng .zip.');
        }
        if (file.size > 24 * 1024 * 1024) {
          throw new Error('Gói cập nhật ZIP tối đa 24MB.');
        }
        const buf = await file.arrayBuffer();
        setUpdateProgress(22, 'Đang kiểm tra chữ ký & cấu trúc gói ZIP...', 'working');
        const bytes = new Uint8Array(buf);
        if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
          throw new Error('Tệp không phải định dạng ZIP hợp lệ hoặc bị hỏng.');
        }
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        const b64 = btoa(bin);
        const autoRestart = $('updAutoRestart') ? $('updAutoRestart').checked : true;
        setUpdateProgress(35, 'Đang tải gói cập nhật lên máy chủ...', 'working');
        const res = await postWithProgress(
          '/api/admin/update-package',
          JSON.stringify({ filename: file.name, base64: b64, autoRestart }),
          ratio => setUpdateProgress(35 + ratio * 45, `Đang tải gói cập nhật lên máy chủ (${Math.round(ratio * 100)}%)...`, 'working')
        );
        setUpdateProgress(92, 'Đang giải nén, kiểm tra & đồng bộ dữ liệu...', 'working');
        await new Promise(r => setTimeout(r, 250));
        setUpdateProgress(100, `✅ Hoàn tất cập nhật ${res.updatedCount} tệp mã nguồn!`, 'done');
        if (box) {
          box.hidden = false;
          box.style.background = '#ECFDF5'; box.style.color = '#047857'; box.style.borderColor = '#A7F3D0';
          const pr = res.preserved || {};
          box.innerHTML = `✅ <b>Cập nhật hoàn tất!</b><br>• Đã cập nhật <b>${res.updatedCount}</b> tệp mới (bỏ qua ${res.skippedCount || 0} tệp hệ thống).<br>• Đã bảo toàn 100%: <b>${pr.products || 0}</b> sản phẩm, <b>${pr.news || 0}</b> tin tức, <b>${pr.leads || 0}</b> khách hàng, <b>${pr.uploads || 0}</b> tệp tải lên.<br>• Bản sao lưu an toàn: <code>${escapeAttr(res.backupFile || '')}</code>${(autoRestart && res.needsRestart) ? '<br>🔄 Đang tự khởi động lại server và tải lại trang...' : (res.needsRestart ? '<br>👉 Khởi động lại <code>node server.js</code> để áp dụng bản mới.' : '<br>🔄 Đang tải lại giao diện...')}`;
        }
        toast('Cập nhật trang web thành công!');
        if (autoRestart || !res.needsRestart) {
          setTimeout(() => { window.location.reload(); }, 3000);
        }
      } catch (err) {
        setUpdateProgress(100, '❌ Lỗi: ' + (err.message || 'Cập nhật thất bại.'), 'error');
        if (box) {
          box.hidden = false;
          box.style.background = '#FEF2F2'; box.style.color = '#B91C1C'; box.style.borderColor = '#FECACA';
          box.textContent = '❌ Lỗi cập nhật: ' + (err.message || 'Gói ZIP không hợp lệ.');
        }
        toast(err.message || 'Cập nhật thất bại.');
      }
    });
  }

  if ($('fullRestoreFile')) {
    $('fullRestoreFile').addEventListener('change', async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f || !confirm('Khôi phục dữ liệu từ tệp này có thể thay thế dữ liệu hiện tại. Tiếp tục?')) return;
      const kb = Math.max(1, Math.round(f.size / 1024));
      setUpdateProgress(12, 'Đang đọc tệp sao lưu JSON...', 'working', `📄 ${f.name} (${kb} KB)`);
      try {
        const text = await f.text();
        setUpdateProgress(32, 'Đang kiểm tra tính hợp lệ của dữ liệu JSON...', 'working');
        let parsed;
        try { parsed = JSON.parse(text); } catch { throw new Error('Tệp JSON bị lỗi cú pháp.'); }
        setUpdateProgress(48, 'Đang tải dữ liệu khôi phục lên máy chủ...', 'working');
        const res = await postWithProgress(
          '/api/admin/restore-full',
          JSON.stringify(parsed),
          ratio => setUpdateProgress(48 + ratio * 36, `Đang tải dữ liệu (${Math.round(ratio * 100)}%)...`, 'working')
        );
        setUpdateProgress(92, 'Đang đồng bộ lại giao diện quản trị...', 'working');
        const refreshed = await loadAdminData();
        const sec = Array.isArray(res.updatedSections) ? res.updatedSections.join(', ') : 'toàn bộ dữ liệu';
        const msg = `Đã khôi phục: ${sec}.${refreshed ? '' : ' Tải lại trang để xem dữ liệu mới.'}`;
        setUpdateProgress(100, msg, 'done');
        toast(msg);
      } catch (err) {
        setUpdateProgress(100, '❌ ' + (err.message || 'Tệp sao lưu JSON không hợp lệ.'), 'error');
        toast(err.message || 'Tệp sao lưu JSON không hợp lệ.');
      }
    });
  }

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

  
  function syncSliderControls() {
    const sliderEnabled = $('hm_showSlider').checked;
    $('hm_autoSlide').disabled = !sliderEnabled;
    $('hm_sliderIntervalSec').disabled = !sliderEnabled || !$('hm_autoSlide').checked;
  }

  bind('hm_showSlider', el => { CONFIG.home.showSlider = el.checked; syncSliderControls(); });
  bind('hm_autoSlide', el => { CONFIG.home.autoSlide = el.checked; syncSliderControls(); });
  bind('hm_sliderKicker', el => { CONFIG.home.sliderKicker = el.value; });
  bind('hm_sliderTitle', el => { CONFIG.home.sliderTitle = el.value; });
  bind('hm_sliderIntervalSec', el => { CONFIG.home.sliderIntervalSec = Math.max(2, Number(el.value) || 4.5); });
  bind('hm_sliderHeight', el => { CONFIG.home.sliderHeight = Number(el.value) || 430; if ($('hmSliderHVal')) $('hmSliderHVal').textContent = el.value; });
  bind('hm_showQuickCards', el => { CONFIG.home.showQuickCards = el.checked; });
  bind('hm_showQuickDemo', el => { CONFIG.home.showQuickDemo = el.checked; });
  bind('hm_showFeaturedProducts', el => { CONFIG.home.showFeaturedProducts = el.checked; });
  bind('hm_productsKicker', el => { CONFIG.home.productsKicker = el.value; });
  bind('hm_productsTitle', el => { CONFIG.home.productsTitle = el.value; });
  bind('hm_productsCount', el => { CONFIG.home.productsCount = Number(el.value) || 4; });
  bind('hm_showContactCta', el => { CONFIG.home.showContactCta = el.checked; });

  bind('h_show', el => { CONFIG.hero.show = el.checked; });
  bind('h_style', el => { CONFIG.hero.style = el.value; });
  bind('h_align', el => { CONFIG.hero.align = el.value; });
  bind('h_badge', el => { CONFIG.hero.badge = el.value; });
  bind('h_title', el => { CONFIG.hero.title = el.value; });
  bind('h_subtitle', el => { CONFIG.hero.subtitle = el.value; });

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
  async function toggleDemo() {
    if (!CONFIG || configSaving || !can('layout')) return;
    const showSolarDemo = CONFIG.sections.showSolarDemo === false;
    configSaving = true;
    $('btnSave').disabled = true;
    renderDemoStatus(true);
    try {
      const { config } = await api('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ sections: { showSolarDemo } })
      });
      CONFIG.sections.showSolarDemo = config.sections.showSolarDemo;
      CONFIG.updatedAt = config.updatedAt;
      updateMaintUI();
      pushPreview();
      toast(showSolarDemo ? 'Đã bật Demo 3D.' : 'Đã tắt Demo 3D.');
    } catch (err) { toast(err.message); }
    finally {
      configSaving = false;
      $('btnSave').disabled = !dirty;
      renderDemoStatus();
    }
  }
  $('btnToggleMaintenanceDemo').addEventListener('click', toggleDemo);

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
    renderDemoStatus();
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
      renderDemoStatus();
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
  const previewPages = [...document.querySelectorAll('[data-preview-page]')];
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
    const source = previewPages.find(btn => btn.classList.contains('active')).dataset.previewPage;
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
      if (page) highlightButton(previewPages, previewPages.find(btn => btn.dataset.previewPage === page));
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
  previewPages.forEach(btn => {
    btn.onclick = () => { highlightButton(previewPages, btn); renderPreview(); };
  });
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
