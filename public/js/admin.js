(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  let CONFIG = null;
  let PRESETS = {};
  let PRODUCTS = [];
  let prodFilter = 'all';
  let dirty = false;

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function setDirty(val) {
    dirty = val;
    $('dirtyPill').hidden = !val;
  }

  function pushPreview() {
    const frame = $('previewFrame');
    if (frame && frame.contentWindow && CONFIG) {
      frame.contentWindow.postMessage({ type: 'HQ_PREVIEW_CONFIG', config: CONFIG, products: PRODUCTS }, '*');
    }
  }

  async function api(url, opts = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Yêu cầu thất bại.');
    return data;
  }

  // ---------- AUTH ----------
  async function checkSession() {
    try {
      const me = await api('/api/admin/me');
      if (me.authenticated) {
        $('loginScreen').hidden = true;
        $('adminApp').hidden = false;
        await loadAdminData();
      } else {
        $('loginScreen').hidden = false;
        $('adminApp').hidden = true;
      }
    } catch {
      $('loginScreen').hidden = false;
      $('adminApp').hidden = true;
    }
  }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('loginErr').textContent = '';
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: $('loginPass').value })
      });
      $('loginPass').value = '';
      await checkSession();
    } catch (err) {
      $('loginErr').textContent = err.message;
    }
  });

  $('btnLogout').onclick = async () => {
    await api('/api/admin/logout', { method: 'POST' });
  
  // ---------- PRODUCT CATALOG MANAGER ----------
  function renderProdList() {
    const el = $('prodListEditor');
    if (!el) return;
    $('prodCount').textContent = PRODUCTS.length;
    const filtered = PRODUCTS.map((p, idx) => ({ p, idx })).filter(x => prodFilter === 'all' || x.p.category === prodFilter);
    const catLabel = { inverter: 'Inverter', panel: 'Pin MT', battery: 'Lưu trữ' };
    el.innerHTML = filtered.map(({ p, idx }) => {
      const specText = p.category === 'inverter' ? `${p.powerKw} kW (${p.phase || '1 pha'})`
        : p.category === 'panel' ? `${p.wattWp} Wp`
        : `${p.capacityKwh} kWh`;
      return `<div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <img src="${escapeAttr(p.imageUrl || '/assets/prod-' + p.category + '.jpg')}" alt="" style="width:36px;height:36px;border-radius:7px;object-fit:cover;border:1px solid #E2E8F0;flex:none">
          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;flex:1;min-width:0">
            <input type="checkbox" data-p-act="${idx}" ${p.active !== false ? 'checked' : ''}>
            <span style="color:#D9560B">[${catLabel[p.category] || p.category}]</span> <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeAttr(p.name)}</span>
          </label>
          <label class="btn-ghost small" style="padding:4px 7px;font-size:11px;cursor:pointer;white-space:nowrap" title="Tải ảnh sản phẩm">
            Đổi ảnh<input type="file" accept="image/*" data-p-img="${idx}" hidden>
          </label>
          <button type="button" class="del-btn" data-p-del="${idx}" title="Xóa">×</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <input type="text" class="f-input" data-p-name="${idx}" value="${escapeAttr(p.name)}" placeholder="Tên sản phẩm">
          <input type="text" class="f-input" data-p-brand="${idx}" value="${escapeAttr(p.brand || '')}" placeholder="Hãng">
          <input type="number" class="f-input" data-p-spec="${idx}" value="${p.category === 'inverter' ? p.powerKw : p.category === 'panel' ? p.wattWp : p.capacityKwh}" step="0.01" title="Công suất / Dung lượng">
          <input type="number" class="f-input" data-p-price="${idx}" value="${p.price || 0}" step="100000" title="Giá nội bộ (tính Combo)">
          <input type="text" class="f-input" data-p-war="${idx}" value="${escapeAttr(p.warranty || '')}" placeholder="Bảo hành">
          <input type="text" class="f-input" data-p-note="${idx}" value="${escapeAttr(p.note || '')}" placeholder="Ghi chú ngắn">
        </div>
      </div>`;
    }).join('') || '<p class="hint">Chưa có sản phẩm nào trong nhóm này.</p>';

    el.querySelectorAll('[data-p-act]').forEach(cb => cb.onchange = () => { PRODUCTS[+cb.dataset.pAct].active = cb.checked; pushPreview(); });
    el.querySelectorAll('[data-p-name]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pName].name = inp.value; pushPreview(); });
    el.querySelectorAll('[data-p-brand]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pBrand].brand = inp.value; pushPreview(); });
    el.querySelectorAll('[data-p-spec]').forEach(inp => inp.oninput = () => {
      const p = PRODUCTS[+inp.dataset.pSpec], v = Math.max(0.1, Number(inp.value) || 0);
      if (p.category === 'inverter') p.powerKw = v; else if (p.category === 'panel') p.wattWp = v; else p.capacityKwh = v;
      pushPreview();
    });
    el.querySelectorAll('[data-p-war]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pWar].warranty = inp.value; });
    el.querySelectorAll('[data-p-note]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pNote].note = inp.value; });
    el.querySelectorAll('[data-p-price]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pPrice].price = Math.max(0, Number(inp.value) || 0); pushPreview(); });
    
    el.querySelectorAll('[data-p-img]').forEach(inp => {
      inp.onchange = () => {
        const file = inp.files[0]; if (!file) return;
        const idx = +inp.dataset.pImg;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const res = await api('/api/admin/upload-product-image', { method: 'POST', body: JSON.stringify({ dataUrl: reader.result }) });
            PRODUCTS[idx].imageUrl = res.imageUrl;
            renderProdList(); pushPreview();
            toast('Đã cập nhật ảnh sản phẩm! Nhớ bấm Lưu danh mục sản phẩm.');
          } catch (err) { toast(err.message); }
        };
        reader.readAsDataURL(file);
      };
    });
    el.querySelectorAll('[data-p-del]').forEach(btn => btn.onclick = () => { PRODUCTS.splice(+btn.dataset.pDel, 1); renderProdList(); pushPreview(); });
  }

  if ($('prodFilterTabs')) {
    $('prodFilterTabs').querySelectorAll('[data-pcat]').forEach(btn => {
      btn.onclick = () => {
        $('prodFilterTabs').querySelectorAll('[data-pcat]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        prodFilter = btn.dataset.pcat;
        renderProdList();
      };
    });
  }

  if ($('btnAddProd')) {
    $('btnAddProd').onclick = () => {
      const cat = $('np_cat').value;
      const name = $('np_name').value.trim();
      const spec = Number($('np_spec').value) || 0;
      if (!name || spec <= 0) return toast('Nhập tên sản phẩm và công suất/dung lượng hợp lệ.');
      const item = {
        id: `${cat}-${Date.now()}`,
        category: cat,
        brand: $('np_brand').value.trim(),
        name,
        price: Math.max(0, Number($('np_price').value) || 0),
        warranty: cat === 'inverter' ? '5 năm' : ($('np_phase').value.trim() || '10 năm'),
        note: '',
        active: true
      };
      if (cat === 'inverter') { item.powerKw = spec; item.phase = $('np_phase').value.trim() || '1 pha'; }
      else if (cat === 'panel') item.wattWp = spec;
      else item.capacityKwh = spec;
      PRODUCTS.unshift(item);
      $('np_name').value = ''; $('np_spec').value = ''; $('np_price').value = '';
      renderProdList(); pushPreview();
      toast('Đã thêm sản phẩm. Bấm "Lưu danh mục sản phẩm" để ghi lên máy chủ.');
    };
  }

  if ($('btnSaveProds')) {
    $('btnSaveProds').onclick = async () => {
      try {
        const res = await api('/api/admin/products', { method: 'PUT', body: JSON.stringify({ products: PRODUCTS }) });
        PRODUCTS = res.products;
        renderProdList(); pushPreview();
        toast(`Đã lưu ${PRODUCTS.length} sản phẩm lên máy chủ!`);
      } catch (err) { toast(err.message); }
    };
  }

  if ($('btnResetProds')) {
    $('btnResetProds').onclick = async () => {
      try {
        const res = await api('/api/admin/products/reset', { method: 'POST' });
        PRODUCTS = res.products;
        renderProdList(); pushPreview();
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
          PRODUCTS = res.products;
          renderProdList(); pushPreview();
          toast(`Đã cập nhật ${res.count} sản phẩm từ tệp ${file.name}!`);
        } catch (err) { toast(err.message || 'Tệp Excel/CSV/JSON không hợp lệ.'); }
        e.target.value = '';
      };
      if (lower.endsWith('.xlsx')) reader.readAsArrayBuffer(file);
      else reader.readAsText(file, 'utf-8');
    });
  }

  checkSession();
  };

  // ---------- LOAD & POPULATE ----------
  async function loadAdminData() {
    const [data, prodData] = await Promise.all([api('/api/config'), api('/api/products')]);
    CONFIG = data.config;
    PRODUCTS = prodData.products || [];
    PRESETS = data.presets || {};
    renderPresets();
    populateForm();
    setDirty(false);
    pushPreview();
  }

  function renderPresets() {
    $('presetGrid').innerHTML = Object.entries(PRESETS).map(([key, p]) => `
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

    $('presetGrid').querySelectorAll('[data-preset]').forEach(btn => {
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

  function populateForm() {
    const { branding: b, hero: h, theme: t, sections: s, defaults: d, tariffs: tar, footer: f } = CONFIG;

    // Branding
    $('logoPreview').src = b.logoUrl || '/assets/logo-default.jpg';
    $('b_logoHeight').value = b.logoHeight || 54;
    $('logoHeightVal').textContent = b.logoHeight || 54;
    $('b_siteTitle').value = b.siteTitle || '';
    $('b_companyName').value = b.companyName || '';
    $('b_showAdminLink').checked = b.showAdminLink !== false;
    $('b_showHotline').checked = b.showHotline !== false;
    $('b_hotlineLabel').value = b.hotlineLabel || '';
    renderHotlineEditor();

    // Theme & Hero
    $('t_darkMode').checked = Boolean(t.darkMode);
    $('t_primary').value = t.primary || '#F26A1B';
    $('t_primaryDeep').value = t.primaryDeep || '#D9560B';
    $('t_gradientEnd').value = t.gradientEnd || '#FFB400';
    $('t_bg').value = t.bg || '#F3F5F9';
    $('t_cardBg').value = t.cardBg || '#FFFFFF';
    $('t_ink').value = t.ink || '#111827';
    $('t_inkMuted').value = t.inkMuted || '#4B5563';
    $('t_dayColor').value = t.dayColor || '#F59E0B';
    $('t_nightColor').value = t.nightColor || '#1E293B';
    $('t_radius').value = t.radius ?? 18;
    $('radiusVal').textContent = t.radius ?? 18;
    $('t_maxWidth').value = t.maxWidth ?? 1160;
    $('maxWidthVal').textContent = t.maxWidth ?? 1160;
    $('t_shadowLevel').value = t.shadowLevel || 'medium';
    $('t_fontFamily').value = t.fontFamily || 'system';
    $('t_stickyResult').checked = t.stickyResult !== false;

    $('h_show').checked = h.show !== false;
    $('h_style').value = h.style || 'gradient';
    $('h_align').value = h.align || 'left';
    $('h_badge').value = h.badge || '';
    $('h_title').value = h.title || '';
    $('h_subtitle').value = h.subtitle || '';

    // Layout & Sections
    const secBools = [
      'showCustomerName', 'showCustomerPhone', 'showCustomerAddress', 'showContactCta', 'showQuickChips', 'showSliders', 'showAdvancedSettings',
      'showDayNightBar', 'showCalcSteps', 'showTierTable', 'showScenarioTable', 'showComboSection', 'showComboPrices',
      'showPrintButton', 'showFooterNotes'
    ];
    secBools.forEach(k => { $('s_' + k).checked = s[k] !== false; });
    const secTexts = [
      'card1Title', 'card2Title', 'resultTitle', 'tierTableTitle',
      'scenarioTableTitle', 'comboTitle', 'printTitle', 'printButtonText'
    ];
    secTexts.forEach(k => { $('s_' + k).value = s[k] || ''; });

    // Defaults & EVN
    $('d_mode').value = d.mode || 'bill';
    $('d_bill').value = d.bill ?? 2000000;
    $('d_kwh').value = d.kwh ?? 625;
    $('d_mod').value = d.mod ?? 5.12;
    $('d_eve').value = d.eve ?? 70;
    $('d_dod').value = d.dod ?? 90;
    $('d_eff').value = d.eff ?? 95;
    $('d_vat').value = d.vat ?? 8;
    $('d_days').value = d.days ?? 30;
    $('d_billChips').value = (d.billChips || []).join(', ');
    $('d_kwhChips').value = (d.kwhChips || []).join(', ');
    $('d_scenarios').value = (d.scenarios || []).join(', ');
    $('tar_note').value = tar.note || '';
    renderTierEditor();

    // Footer
    $('f_companyLine').value = f.companyLine || '';
    $('f_notesTitle').value = f.notesTitle || '';
    if ($('f_ctaTitle')) $('f_ctaTitle').value = f.ctaTitle || '';
    if ($('f_ctaSubtitle')) $('f_ctaSubtitle').value = f.ctaSubtitle || '';
    if ($('f_ctaAddress')) $('f_ctaAddress').value = f.ctaAddress || '';
    if ($('f_callBtnText')) $('f_callBtnText').value = f.callBtnText || 'Gọi ngay';
    if ($('f_zaloBtnText')) $('f_zaloBtnText').value = f.zaloBtnText || 'Chat Zalo';
    renderNotesEditor();
    if ($('d_sunHours')) $('d_sunHours').value = d.sunHours ?? 4.0;
    if ($('s_comboTitle')) $('s_comboTitle').value = s.comboTitle || '';
    renderProdList();
  }

  // ---------- DYNAMIC LIST EDITORS ----------
  function renderHotlineEditor() {
    const list = CONFIG.branding.hotlines || [];
    $('hotlineEditor').innerHTML = list.map((h, i) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;gap:6px">
          <input type="text" class="f-input" data-hl-lbl="${i}" value="${escapeAttr(h.label || '')}" placeholder="Nhãn (VD: Tư vấn kỹ thuật)">
          <button type="button" class="del-btn" data-del-hl="${i}" title="Xóa">×</button>
        </div>
        <div style="display:flex;gap:6px">
          <input type="text" class="f-input" data-hl="${i}" value="${escapeAttr(h.number)}" placeholder="SĐT (VD: 0913 350 597)">
          <input type="text" class="f-input" data-hl-zalo="${i}" value="${escapeAttr(h.zalo !== undefined ? h.zalo : (h.tel || ''))}" placeholder="Số Zalo (để trống = ẩn)">
        </div>
      </div>
    `).join('');
    $('hotlineEditor').querySelectorAll('[data-hl]').forEach(inp => {
      inp.oninput = () => {
        const idx = +inp.dataset.hl;
        const cur = CONFIG.branding.hotlines[idx];
        cur.number = inp.value;
        cur.tel = inp.value.replace(/[^\d+]/g, '');
        setDirty(true); pushPreview();
      };
    });
    $('hotlineEditor').querySelectorAll('[data-hl-lbl]').forEach(inp => {
      inp.oninput = () => { CONFIG.branding.hotlines[+inp.dataset.hlLbl].label = inp.value; setDirty(true); pushPreview(); };
    });
    $('hotlineEditor').querySelectorAll('[data-hl-zalo]').forEach(inp => {
      inp.oninput = () => { CONFIG.branding.hotlines[+inp.dataset.hlZalo].zalo = inp.value.replace(/[^\d]/g, ''); setDirty(true); pushPreview(); };
    });
    $('hotlineEditor').querySelectorAll('[data-del-hl]').forEach(btn => {
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
    const tiers = CONFIG.tariffs.tiers || [];
    $('tierEditor').innerHTML = tiers.map((t, i) => `
      <div class="list-item">
        <input type="text" class="f-input" style="flex:1.2" data-t-label="${i}" value="${escapeAttr(t.label)}" placeholder="Nhãn bậc">
        <input type="number" class="f-input" style="flex:0.8" data-t-size="${i}" value="${t.size ?? ''}" placeholder="∞">
        <input type="number" class="f-input" style="flex:1" data-t-price="${i}" value="${t.price}" placeholder="Giá đ">
        <button type="button" class="del-btn" data-del-tier="${i}" title="Xóa bậc">×</button>
      </div>
    `).join('');
    $('tierEditor').querySelectorAll('[data-t-label]').forEach(inp => {
      inp.oninput = () => { CONFIG.tariffs.tiers[+inp.dataset.tLabel].label = inp.value; setDirty(true); pushPreview(); };
    });
    $('tierEditor').querySelectorAll('[data-t-size]').forEach(inp => {
      inp.oninput = () => {
        const v = inp.value.trim();
        CONFIG.tariffs.tiers[+inp.dataset.tSize].size = v === '' ? null : Math.max(1, Number(v) || 100);
        setDirty(true); pushPreview();
      };
    });
    $('tierEditor').querySelectorAll('[data-t-price]').forEach(inp => {
      inp.oninput = () => {
        CONFIG.tariffs.tiers[+inp.dataset.tPrice].price = Math.max(0, Number(inp.value) || 0);
        setDirty(true); pushPreview();
      };
    });
    $('tierEditor').querySelectorAll('[data-del-tier]').forEach(btn => {
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
    const notes = CONFIG.footer.notes || [];
    $('notesEditor').innerHTML = notes.map((n, i) => `
      <div class="list-item">
        <input type="text" class="f-input" data-note="${i}" value="${escapeAttr(n)}">
        <button type="button" class="del-btn" data-del-note="${i}" title="Xóa">×</button>
      </div>
    `).join('');
    $('notesEditor').querySelectorAll('[data-note]').forEach(inp => {
      inp.oninput = () => { CONFIG.footer.notes[+inp.dataset.note] = inp.value; setDirty(true); pushPreview(); };
    });
    $('notesEditor').querySelectorAll('[data-del-note]').forEach(btn => {
      btn.onclick = () => {
        CONFIG.footer.notes.splice(+btn.dataset.delNote, 1);
        renderNotesEditor();
    if ($('d_sunHours')) $('d_sunHours').value = d.sunHours ?? 4.0;
    if ($('s_comboTitle')) $('s_comboTitle').value = s.comboTitle || '';
    renderProdList(); setDirty(true); pushPreview();
      };
    });
  }

  $('btnAddNote').onclick = () => {
    CONFIG.footer.notes.push('Ghi chú mới...');
    renderNotesEditor();
    if ($('d_sunHours')) $('d_sunHours').value = d.sunHours ?? 4.0;
    if ($('s_comboTitle')) $('s_comboTitle').value = s.comboTitle || '';
    renderProdList(); setDirty(true); pushPreview();
  };

  function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

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

  bind('b_logoHeight', el => { CONFIG.branding.logoHeight = Number(el.value); $('logoHeightVal').textContent = el.value; });
  bind('b_siteTitle', el => { CONFIG.branding.siteTitle = el.value; });
  bind('b_companyName', el => { CONFIG.branding.companyName = el.value; });
  bind('b_showAdminLink', el => { CONFIG.branding.showAdminLink = el.checked; });
  bind('b_showHotline', el => { CONFIG.branding.showHotline = el.checked; });
  bind('b_hotlineLabel', el => { CONFIG.branding.hotlineLabel = el.value; });

  bind('t_darkMode', el => {
    CONFIG.theme.darkMode = el.checked;
    if (el.checked && CONFIG.theme.bg === '#F3F5F9') {
      CONFIG.theme.bg = '#0B1120';
      CONFIG.theme.cardBg = '#111827';
      CONFIG.theme.ink = '#F9FAFB';
      CONFIG.theme.inkMuted = '#9CA3AF';
      populateForm();
    } else if (!el.checked && CONFIG.theme.bg === '#0B1120') {
      CONFIG.theme.bg = '#F3F5F9';
      CONFIG.theme.cardBg = '#FFFFFF';
      CONFIG.theme.ink = '#111827';
      CONFIG.theme.inkMuted = '#4B5563';
      populateForm();
    }
  });
  ['primary', 'primaryDeep', 'gradientEnd', 'bg', 'cardBg', 'ink', 'inkMuted', 'dayColor', 'nightColor'].forEach(k => {
    bind('t_' + k, el => { CONFIG.theme[k] = el.value; CONFIG.theme.preset = 'custom'; renderPresets(); });
  });
  bind('t_radius', el => { CONFIG.theme.radius = Number(el.value); $('radiusVal').textContent = el.value; });
  bind('t_maxWidth', el => { CONFIG.theme.maxWidth = Number(el.value); $('maxWidthVal').textContent = el.value; });
  bind('t_shadowLevel', el => { CONFIG.theme.shadowLevel = el.value; });
  bind('t_fontFamily', el => { CONFIG.theme.fontFamily = el.value; });
  bind('t_stickyResult', el => { CONFIG.theme.stickyResult = el.checked; });

  bind('h_show', el => { CONFIG.hero.show = el.checked; });
  bind('h_style', el => { CONFIG.hero.style = el.value; });
  bind('h_align', el => { CONFIG.hero.align = el.value; });
  bind('h_badge', el => { CONFIG.hero.badge = el.value; });
  bind('h_title', el => { CONFIG.hero.title = el.value; });
  bind('h_subtitle', el => { CONFIG.hero.subtitle = el.value; });

  [
    'showCustomerName', 'showCustomerPhone', 'showCustomerAddress', 'showContactCta', 'showQuickChips', 'showSliders', 'showAdvancedSettings',
    'showDayNightBar', 'showCalcSteps', 'showTierTable', 'showScenarioTable', 'showComboSection', 'showComboPrices',
    'showPrintButton', 'showFooterNotes'
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
  $('logoUpload').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
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
      } catch (err) {
        toast(err.message);
      }
    };
    reader.readAsDataURL(file);
  });

  $('btnRestoreLogo').onclick = () => {
    CONFIG.branding.logoUrl = '/assets/logo-default.jpg';
    $('logoPreview').src = CONFIG.branding.logoUrl;
    setDirty(true);
    pushPreview();
  };

  // ---------- SAVE / RESET / PASSWORD / BACKUP ----------
  $('btnSave').onclick = async () => {
    try {
      const res = await api('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify(CONFIG)
      });
      CONFIG = res.config;
      setDirty(false);
      pushPreview();
      toast('Đã lưu cấu hình giao diện thành công!');
    } catch (err) {
      toast(err.message);
    }
  };

  $('btnReset').onclick = async () => {
    if (!confirm('Khôi phục toàn bộ giao diện và biểu giá về mặc định ban đầu?')) return;
    try {
      const res = await api('/api/admin/reset', { method: 'POST' });
      CONFIG = res.config;
      renderPresets();
      populateForm();
      setDirty(false);
      pushPreview();
      toast('Đã khôi phục cấu hình mặc định.');
    } catch (err) {
      toast(err.message);
    }
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
    } catch (err) {
      toast(err.message);
    }
  });

  $('btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify(CONFIG, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hoangquan-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  $('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        CONFIG = { ...CONFIG, ...parsed };
        renderPresets();
        populateForm();
        setDirty(true);
        pushPreview();
        toast('Đã nạp cấu hình từ tệp JSON. Bấm "Lưu cấu hình" để áp dụng.');
      } catch {
        toast('Tệp JSON không hợp lệ.');
      }
    };
    reader.readAsText(file);
  });

  // ---------- TABS & VIEWPORT ----------
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.add('active');
    };
  });

  document.querySelectorAll('.vp-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.vp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('previewFrame').style.width = btn.dataset.vp;
    };
  });

  $('previewFrame').addEventListener('load', () => {
    if (CONFIG) pushPreview();
  });


  // ---------- PRODUCT CATALOG MANAGER ----------
  function renderProdList() {
    const el = $('prodListEditor');
    if (!el) return;
    $('prodCount').textContent = PRODUCTS.length;
    const filtered = PRODUCTS.map((p, idx) => ({ p, idx })).filter(x => prodFilter === 'all' || x.p.category === prodFilter);
    const catLabel = { inverter: 'Inverter', panel: 'Pin MT', battery: 'Lưu trữ' };
    el.innerHTML = filtered.map(({ p, idx }) => {
      const specText = p.category === 'inverter' ? `${p.powerKw} kW (${p.phase || '1 pha'})`
        : p.category === 'panel' ? `${p.wattWp} Wp`
        : `${p.capacityKwh} kWh`;
      return `<div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700">
            <input type="checkbox" data-p-act="${idx}" ${p.active !== false ? 'checked' : ''}>
            <span style="color:#D9560B">[${catLabel[p.category] || p.category}]</span> ${escapeAttr(p.name)}
          </label>
          <button type="button" class="del-btn" data-p-del="${idx}" title="Xóa">×</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center;font-size:12px;color:#64748B">
          <span style="flex:1">${escapeAttr(p.brand || '')} · <b>${specText}</b></span>
          <input type="number" class="f-input" style="width:130px" data-p-price="${idx}" value="${p.price || 0}" step="100000" title="Giá VNĐ">
        </div>
      </div>`;
    }).join('') || '<p class="hint">Chưa có sản phẩm nào trong nhóm này.</p>';

    el.querySelectorAll('[data-p-act]').forEach(cb => cb.onchange = () => { PRODUCTS[+cb.dataset.pAct].active = cb.checked; pushPreview(); });
    el.querySelectorAll('[data-p-price]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pPrice].price = Math.max(0, Number(inp.value) || 0); pushPreview(); });
    el.querySelectorAll('[data-p-del]').forEach(btn => btn.onclick = () => { PRODUCTS.splice(+btn.dataset.pDel, 1); renderProdList(); pushPreview(); });
  }

  if ($('prodFilterTabs')) {
    $('prodFilterTabs').querySelectorAll('[data-pcat]').forEach(btn => {
      btn.onclick = () => {
        $('prodFilterTabs').querySelectorAll('[data-pcat]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        prodFilter = btn.dataset.pcat;
        renderProdList();
      };
    });
  }

  if ($('btnAddProd')) {
    $('btnAddProd').onclick = () => {
      const cat = $('np_cat').value;
      const name = $('np_name').value.trim();
      const spec = Number($('np_spec').value) || 0;
      if (!name || spec <= 0) return toast('Nhập tên sản phẩm và công suất/dung lượng hợp lệ.');
      const item = {
        id: `${cat}-${Date.now()}`,
        category: cat,
        brand: $('np_brand').value.trim(),
        name,
        price: Math.max(0, Number($('np_price').value) || 0),
        warranty: cat === 'inverter' ? '5 năm' : ($('np_phase').value.trim() || '10 năm'),
        note: '',
        active: true
      };
      if (cat === 'inverter') { item.powerKw = spec; item.phase = $('np_phase').value.trim() || '1 pha'; }
      else if (cat === 'panel') item.wattWp = spec;
      else item.capacityKwh = spec;
      PRODUCTS.unshift(item);
      $('np_name').value = ''; $('np_spec').value = ''; $('np_price').value = '';
      renderProdList(); pushPreview();
      toast('Đã thêm sản phẩm. Bấm "Lưu danh mục sản phẩm" để ghi lên máy chủ.');
    };
  }

  if ($('btnSaveProds')) {
    $('btnSaveProds').onclick = async () => {
      try {
        const res = await api('/api/admin/products', { method: 'PUT', body: JSON.stringify({ products: PRODUCTS }) });
        PRODUCTS = res.products;
        renderProdList(); pushPreview();
        toast(`Đã lưu ${PRODUCTS.length} sản phẩm lên máy chủ!`);
      } catch (err) { toast(err.message); }
    };
  }

  if ($('btnResetProds')) {
    $('btnResetProds').onclick = async () => {
      try {
        const res = await api('/api/admin/products/reset', { method: 'POST' });
        PRODUCTS = res.products;
        renderProdList(); pushPreview();
        toast('Đã khôi phục kho sản phẩm mẫu.');
      } catch (err) { toast(err.message); }
    };
  }

  if ($('prodUploadFile')) {
    $('prodUploadFile').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const mode = $('importProdMode').value;
          const isCsv = file.name.toLowerCase().endsWith('.csv');
          const payload = isCsv
            ? { format: 'csv', mode, content: reader.result }
            : { format: 'json', mode, products: JSON.parse(reader.result) };
          const res = await api('/api/admin/products/import', { method: 'POST', body: JSON.stringify(payload) });
          PRODUCTS = res.products;
          renderProdList(); pushPreview();
          toast(`Đã nhập thành công ${res.count} sản phẩm từ tệp!`);
        } catch (err) { toast(err.message || 'Tệp danh mục không hợp lệ.'); }
        e.target.value = '';
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  checkSession();
})();
