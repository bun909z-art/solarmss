/* Admin Config UI: Thương hiệu, Trang chủ, Giao diện, Bố cục, EVN, Chân trang & Logo */
'use strict';

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

  function populateForm() {
    const { branding: b, hero: h, theme: t, sections: s, defaults: d, tariffs: tar, footer: f } = CONFIG;

    if ($('logoPreview')) $('logoPreview').src = b.logoUrl || '/assets/logo-default.jpg';
    setVal('b_logoHeight', b.logoHeight || 54);
    if ($('logoHeightVal')) $('logoHeightVal').textContent = b.logoHeight || 54;
    setVal('b_siteTitle', b.siteTitle || '');
    setVal('b_companyName', b.companyName || '');
    setChk('b_showAdminLink', b.showAdminLink === true);
    setChk('b_showHotline', b.showHotline !== false);
    setVal('b_hotlineLabel', b.hotlineLabel || '');
    renderHotlineEditor();

    setChk('t_darkMode', Boolean(t.darkMode));
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
    setVal('t_shadowLevel', t.shadowLevel || 'medium');
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
      'showTierTable', 'showScenarioTable', 'showComboSection', 'showComboPrices',
      'showContactCta', 'showPrintButton', 'showFooterNotes'
    ].forEach(k => setChk('s_' + k, s[k] !== false));

    [
      'card1Title', 'card2Title', 'resultTitle', 'tierTableTitle',
      'scenarioTableTitle', 'comboTitle', 'printTitle', 'printButtonText'
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
    setVal('d_sunHours', d.sunHours ?? 4.0);
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
    
    const hm = CONFIG.home || (CONFIG.home = {
      showSlider: true, sliderKicker: '★ Nổi bật', sliderTitle: 'Tin tức & Dự án nổi bật',
      autoSlide: true, sliderIntervalSec: 4.5, sliderHeight: 430, showQuickCards: true,
      quickCards: [
        { icon: '⚡', title: 'Tư vấn & Tính Pin Hybrid', desc: 'Nhập hóa đơn EVN hoặc số kWh để tính dung lượng pin lưu trữ cần thiết và nhận 3 gợi ý Combo lắp đặt chi tiết.', cta: 'Tính ngay →', href: '/tuvan', primary: true },
        { icon: '🔋', title: 'Sản phẩm & Phụ kiện chính hãng', desc: 'Khám phá Inverter Hybrid, Tấm pin mặt trời, Pin Lithium LFP và trọn bộ Phụ kiện lắp đặt kèm thông số, Datasheet.', cta: 'Xem sản phẩm →', href: '/products', primary: false },
        { icon: '📰', title: 'Kiến thức & Dự án thực tế', desc: 'Cập nhật kinh nghiệm chọn cấu hình, quy định giá điện mới nhất và các công trình Hybrid đã bàn giao.', cta: 'Đọc tin tức →', href: '/news', primary: false }
      ],
      showFeaturedProducts: true, productsKicker: 'Thiết bị chính hãng', productsTitle: 'Sản phẩm tiêu biểu', productsCount: 4, showContactCta: true
    });
    setChk('hm_showSlider', hm.showSlider !== false);
    setChk('hm_autoSlide', hm.autoSlide !== false);
    setVal('hm_sliderKicker', hm.sliderKicker || '★ Nổi bật');
    setVal('hm_sliderTitle', hm.sliderTitle || 'Tin tức & Dự án nổi bật');
    setVal('hm_sliderIntervalSec', hm.sliderIntervalSec || 4.5);
    setVal('hm_sliderHeight', hm.sliderHeight || 430);
    if ($('hmSliderHVal')) $('hmSliderHVal').textContent = hm.sliderHeight || 430;
    setChk('hm_showQuickCards', hm.showQuickCards !== false);
    setChk('hm_showFeaturedProducts', hm.showFeaturedProducts !== false);
    setVal('hm_productsKicker', hm.productsKicker || 'Thiết bị chính hãng');
    setVal('hm_productsTitle', hm.productsTitle || 'Sản phẩm tiêu biểu');
    setVal('hm_productsCount', String(hm.productsCount || 4));
    setChk('hm_showContactCta', hm.showContactCta !== false);
    renderHomeQuickEditor();
    const mt = CONFIG.maintenance || (CONFIG.maintenance = {
      enabled: false, mode: 'error404', allowedRoute: '/tuvan',
      title: '404 — Hệ thống đang bảo trì',
      message: 'Website đang được nâng cấp và bảo trì định kỳ. Quý khách vui lòng quay lại sau ít phút hoặc liên hệ hotline bên dưới để được hỗ trợ ngay.'
    });
    setVal('m_mode', mt.mode || 'error404');
    setVal('m_allowedRoute', mt.allowedRoute || '/tuvan');
    updateMaintUI();

    renderNotesEditor();
    renderProdList();
    renderNewsList();
    renderLeadsList();
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
  function renderHotlineEditor() {
    const el = $('hotlineEditor');
    if (!el) return;
    const list = CONFIG.branding.hotlines || [];
    el.innerHTML = list.map((h, i) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;gap:6px">
          <input type="text" class="f-input" data-hl-lbl="${i}" value="${escapeAttr(h.label || '')}" placeholder="Nhãn (VD: Tư vấn kỹ thuật)">
          <button type="button" class="del-btn" data-del-hl="${i}" title="Xóa">×</button>
        </div>
        <div style="display:flex;gap:6px">
          <input type="text" class="f-input" data-hl="${i}" value="${escapeAttr(h.number)}" placeholder="SĐT (VD: 0913 350 597)">
          <input type="text" class="f-input" data-hl-zalo="${i}" value="${escapeAttr(h.zalo !== undefined ? h.zalo : (h.tel || ''))}" placeholder="Số Zalo (trống = ẩn)">
        </div>
      </div>
    `).join('');
    el.querySelectorAll('[data-hl]').forEach(inp => {
      inp.oninput = () => {
        const cur = CONFIG.branding.hotlines[+inp.dataset.hl];
        cur.number = inp.value;
        cur.tel = inp.value.replace(/[^\d+]/g, '');
        setDirty(true); pushPreview();
      };
    });
    el.querySelectorAll('[data-hl-lbl]').forEach(inp => {
      inp.oninput = () => { CONFIG.branding.hotlines[+inp.dataset.hlLbl].label = inp.value; setDirty(true); pushPreview(); };
    });
    el.querySelectorAll('[data-hl-zalo]').forEach(inp => {
      inp.oninput = () => { CONFIG.branding.hotlines[+inp.dataset.hlZalo].zalo = inp.value.replace(/[^\d]/g, ''); setDirty(true); pushPreview(); };
    });
    el.querySelectorAll('[data-del-hl]').forEach(btn => {
      btn.onclick = () => {
        CONFIG.branding.hotlines.splice(+btn.dataset.delHl, 1);
        renderHotlineEditor(); setDirty(true); pushPreview();
      };
    });
  }

  $('btnAddHotline').onclick = () => {
    CONFIG.branding.hotlines.push({ number: '0900 000 000', tel: '0900000000', zalo: '0900000000', label: 'Tư vấn viên' });
    renderHotlineEditor(); setDirty(true); pushPreview();
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



  // ---------- BIND INPUTS ----------
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
  ['primary', 'primaryDeep', 'gradientEnd', 'bg', 'cardBg', 'ink', 'inkMuted', 'dayColor', 'nightColor'].forEach(k => {
    bind('t_' + k, el => { CONFIG.theme[k] = el.value; CONFIG.theme.preset = 'custom'; renderPresets(); });
  });
  bind('t_radius', el => { CONFIG.theme.radius = Number(el.value); if ($('radiusVal')) $('radiusVal').textContent = el.value; });
  bind('t_maxWidth', el => { CONFIG.theme.maxWidth = Number(el.value); if ($('maxWidthVal')) $('maxWidthVal').textContent = el.value; });
  bind('t_shadowLevel', el => { CONFIG.theme.shadowLevel = el.value; });
  bind('t_fontFamily', el => { CONFIG.theme.fontFamily = el.value; });
  bind('t_stickyResult', el => { CONFIG.theme.stickyResult = el.checked; });

  
  bind('hm_showSlider', el => { CONFIG.home.showSlider = el.checked; });
  bind('hm_autoSlide', el => { CONFIG.home.autoSlide = el.checked; });
  bind('hm_sliderKicker', el => { CONFIG.home.sliderKicker = el.value; });
  bind('hm_sliderTitle', el => { CONFIG.home.sliderTitle = el.value; });
  bind('hm_sliderIntervalSec', el => { CONFIG.home.sliderIntervalSec = Math.max(2, Number(el.value) || 4.5); });
  bind('hm_sliderHeight', el => { CONFIG.home.sliderHeight = Number(el.value) || 430; if ($('hmSliderHVal')) $('hmSliderHVal').textContent = el.value; });
  bind('hm_showQuickCards', el => { CONFIG.home.showQuickCards = el.checked; });
  bind('hm_showFeaturedProducts', el => { CONFIG.home.showFeaturedProducts = el.checked; });
  bind('hm_productsKicker', el => { CONFIG.home.productsKicker = el.value; });
  bind('hm_productsTitle', el => { CONFIG.home.productsTitle = el.value; });
  bind('hm_productsCount', el => { CONFIG.home.productsCount = Number(el.value) || 4; });
  bind('hm_showContactCta', el => { CONFIG.home.showContactCta = el.checked; });

  document.querySelectorAll('[data-preview-page]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-preview-page]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if ($('previewFrame')) $('previewFrame').src = btn.dataset.previewPage;
    };
  });

  bind('h_show', el => { CONFIG.hero.show = el.checked; });
  bind('h_style', el => { CONFIG.hero.style = el.value; });
  bind('h_align', el => { CONFIG.hero.align = el.value; });
  bind('h_badge', el => { CONFIG.hero.badge = el.value; });
  bind('h_title', el => { CONFIG.hero.title = el.value; });
  bind('h_subtitle', el => { CONFIG.hero.subtitle = el.value; });

  [
    'showCustomerName', 'showCustomerPhone', 'showCustomerAddress', 'showQuickChips',
    'showSliders', 'showAdvancedSettings', 'showDayNightBar', 'showCalcSteps',
    'showTierTable', 'showScenarioTable', 'showComboSection', 'showComboPrices',
    'showContactCta', 'showPrintButton', 'showFooterNotes'
  ].forEach(k => bind('s_' + k, el => { CONFIG.sections[k] = el.checked; }));

  [
    'card1Title', 'card2Title', 'resultTitle', 'tierTableTitle',
    'scenarioTableTitle', 'comboTitle', 'printTitle', 'printButtonText'
  ].forEach(k => bind('s_' + k, el => { CONFIG.sections[k] = el.value; }));

  bind('d_mode', el => { CONFIG.defaults.mode = el.value; });
  ['bill', 'kwh', 'mod', 'eve', 'dod', 'eff', 'vat', 'days', 'sunHours'].forEach(k => {
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
        $('logoPreview').src = res.logoUrl;
        pushPreview();
        toast('Đã tải lên logo mới!');
      } catch (err) { toast(err.message); }
    };
    reader.readAsDataURL(file);
  });

  $('btnRestoreLogo').onclick = () => {
    CONFIG.branding.logoUrl = '/assets/logo-default.jpg';
    $('logoPreview').src = CONFIG.branding.logoUrl;
    setDirty(true); pushPreview();
  };

  // ---------- SAVE / RESET / PASSWORD / BACKUP ----------
  $('btnSave').onclick = async () => {
    try {
      const res = await api('/api/admin/config', { method: 'PUT', body: JSON.stringify(CONFIG) });
      CONFIG = res.config;
      setDirty(false);
      pushPreview();
      toast('Đã lưu cấu hình giao diện thành công!');
    } catch (err) { toast(err.message); }
  };

  $('btnReset').onclick = async () => {
    if (!confirm('Khôi phục toàn bộ giao diện và biểu giá về mặc định ban đầu?')) return;
    try {
      const res = await api('/api/admin/reset', { method: 'POST' });
      CONFIG = res.config;
      renderPresets(); populateForm(); setDirty(false); pushPreview();
      toast('Đã khôi phục cấu hình mặc định.');
    } catch (err) { toast(err.message); }
  };

  $('passForm').addEventListener('submit', async e => {
    e.preventDefault();
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
      toast(res.message || 'Đã đổi mật khẩu.');
    } catch (err) { toast(err.message); }
  });

  $('btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify(CONFIG, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hoangquan-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  $('importFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        CONFIG = { ...CONFIG, ...JSON.parse(reader.result) };
        renderPresets(); populateForm(); setDirty(true); pushPreview();
        toast('Đã nạp cấu hình từ tệp JSON. Bấm "Lưu cấu hình" để áp dụng.');
      } catch { toast('Tệp JSON không hợp lệ.'); }
    };
    reader.readAsText(file);
  });
