(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const LOCAL_KEY = 'hq_pin_tuvan_node_v1';

  const SHADOW_MAP = {
    none: 'none',
    soft: '0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.04)',
    medium: '0 2px 6px rgba(15, 23, 42, 0.04), 0 12px 28px rgba(15, 23, 42, 0.07)',
    strong: '0 4px 12px rgba(15, 23, 42, 0.08), 0 20px 44px rgba(15, 23, 42, 0.14)'
  };

  const FONT_MAP = {
    system: '"Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif',
    inter: '"Inter", "Segoe UI", Roboto, system-ui, sans-serif',
    roboto: 'Roboto, "Segoe UI", Arial, sans-serif',
    segoe: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
  };

  let CFG = null;
  let PRODUCTS = [];
  let selectedComboKey = 'recommended';
  let comboMixSeeds = [0, 0, 0];
  let S = {
    name: '',
    phone: '',
    address: '',
    mode: 'bill',
    bill: 2000000,
    kwh: 625,
    eve: 70,
    dod: 90,
    eff: 95,
    mod: 5.12,
    vat: 8,
    days: 30,
    tiers: HQCalc.DEFAULT_TIERS.map(t => ({ ...t }))
  };

  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#F26A1B').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const num = parseInt(full, 16);
    if (isNaN(num)) return `rgba(242,106,27,${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function showToast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function applyConfig(cfg, resetStateToDefaults) {
    CFG = cfg;
    const root = document.documentElement.style;
    const t = cfg.theme || {};
    const b = cfg.branding || {};
    const h = cfg.hero || {};
    const sec = cfg.sections || {};
    const def = cfg.defaults || {};
    const tar = cfg.tariffs || {};
    const ft = cfg.footer || {};

    // Theme variables
    root.setProperty('--primary', t.primary || '#F26A1B');
    root.setProperty('--primary-deep', t.primaryDeep || '#D9560B');
    root.setProperty('--grad-end', t.gradientEnd || '#FFB400');
    root.setProperty('--primary-soft', hexToRgba(t.primary || '#F26A1B', t.darkMode ? 0.18 : 0.1));
    root.setProperty('--primary-line', hexToRgba(t.primary || '#F26A1B', t.darkMode ? 0.42 : 0.28));
    root.setProperty('--bg', t.bg || '#F3F5F9');
    root.setProperty('--card', t.cardBg || '#FFFFFF');
    root.setProperty('--ink', t.ink || '#111827');
    root.setProperty('--ink-2', t.inkMuted || '#4B5563');
    root.setProperty('--day', t.dayColor || '#F59E0B');
    root.setProperty('--night', t.nightColor || '#1E293B');
    root.setProperty('--good', t.accentGood || '#15803D');
    root.setProperty('--radius', (Number(t.radius) || 18) + 'px');
    root.setProperty('--max-width', (Number(t.maxWidth) || 1160) + 'px');
    root.setProperty('--logo-h', (Number(b.logoHeight) || 54) + 'px');
    root.setProperty('--shadow', SHADOW_MAP[t.shadowLevel] || SHADOW_MAP.medium);
    root.setProperty('--font', FONT_MAP[t.fontFamily] || FONT_MAP.system);
    document.body.classList.toggle('dark-mode', Boolean(t.darkMode));
    $('metaTheme').setAttribute('content', t.primary || '#F26A1B');
    $('stickyCol').classList.toggle('is-sticky', t.stickyResult !== false);

    // Branding
    document.title = b.siteTitle || 'Hoàng Quân – Tư vấn Pin lưu trữ Hybrid';
    if (b.logoUrl) $('brandLogo').src = b.logoUrl;
    $('brandLogo').alt = b.companyName || 'Logo';
    if (b.faviconUrl) $('docFavicon').href = b.faviconUrl;
    $('hotlineWrap').hidden = b.showHotline === false;
    $('hotlineLabel').textContent = b.hotlineLabel || 'Hotline tư vấn';
    const hotlines = Array.isArray(b.hotlines) ? b.hotlines : [];
    $('hotlineList').innerHTML = hotlines.map(item =>
      `<a href="tel:${escapeHtml(item.tel || item.number)}">${escapeHtml(item.number)}</a>`
    ).join('');
    $('adminLink').hidden = isPreview || b.showAdminLink === false;

    // Hero
    const showHero = h.show !== false;
    $('heroSection').hidden = !showHero;
    $('mainWrap').classList.toggle('no-hero', !showHero);
    $('heroSection').className = `hero-banner style-${h.style || 'gradient'}`;
    $('heroInner').className = `wrap hero-inner align-${h.align || 'left'}`;
    $('heroBadge').hidden = !h.badge;
    $('heroBadgeText').textContent = h.badge || '';
    $('heroTitle').textContent = h.title || '';
    $('heroSubtitle').textContent = h.subtitle || '';

    // Section toggles & titles
    $('customerNameWrap').hidden = sec.showCustomerName === false;
    if ($('customerPhoneWrap')) $('customerPhoneWrap').hidden = sec.showCustomerPhone === false;
    if ($('customerAddressWrap')) $('customerAddressWrap').hidden = sec.showCustomerAddress === false;
    if ($('customerExtraWrap')) $('customerExtraWrap').hidden = (sec.showCustomerPhone === false && sec.showCustomerAddress === false);
    if ($('contactCtaCard')) {
      $('contactCtaCard').hidden = sec.showContactCta === false || !hotlines.length;
      $('ctaTitle').textContent = ft.ctaTitle || 'Liên hệ ngay để được tư vấn & khảo sát miễn phí';
      $('ctaSubtitle').textContent = ft.ctaSubtitle || '';
      const hasAddr = Boolean((ft.ctaAddress || '').trim());
      $('ctaAddress').hidden = !hasAddr;
      $('ctaAddress').textContent = hasAddr ? '📍 ' + ft.ctaAddress : '';
      const callLbl = ft.callBtnText || 'Gọi ngay';
      const zaloLbl = ft.zaloBtnText || 'Chat Zalo';
      $('ctaList').innerHTML = hotlines.map(item => {
        const tel = escapeHtml(item.tel || String(item.number || '').replace(/[^\d+]/g, ''));
        const zalo = escapeHtml(item.zalo !== undefined ? item.zalo : tel.replace(/[^\d]/g, ''));
        return `<div class="cta-row">
          <div class="cta-info">
            ${item.label ? `<span class="cta-role">${escapeHtml(item.label)}</span>` : ''}
            <a class="cta-phone" href="tel:${tel}">${escapeHtml(item.number)}</a>
          </div>
          <div class="cta-btns">
            <a class="cta-btn call" href="tel:${tel}">📞 ${escapeHtml(callLbl)}</a>
            ${zalo ? `<a class="cta-btn zalo" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">💬 ${escapeHtml(zaloLbl)}</a>` : ''}
          </div>
        </div>`;
      }).join('');
    }
    $('billChips').hidden = sec.showQuickChips === false;
    $('kwhChips').hidden = sec.showQuickChips === false;
    $('modChips').hidden = sec.showQuickChips === false;
    $('slidersWrap').hidden = sec.showSliders === false;
    $('advCard').hidden = sec.showAdvancedSettings === false;
    $('dayNightWrap').hidden = sec.showDayNightBar === false;
    $('stepsWrap').hidden = sec.showCalcSteps === false;
    $('tierCard').hidden = sec.showTierTable === false;
    $('scenarioCard').hidden = sec.showScenarioTable === false;
    if ($('comboCard')) $('comboCard').hidden = sec.showComboSection === false;
    if ($('comboTitle') && sec.comboTitle) $('comboTitle').textContent = sec.comboTitle;
    $('actionsWrap').hidden = sec.showPrintButton === false;
    $('footerNotesWrap').hidden = sec.showFooterNotes === false;

    $('card1Title').textContent = sec.card1Title || 'Mức tiêu thụ điện của khách';
    $('card2Title').textContent = sec.card2Title || 'Thông số tính pin lưu trữ';
    $('resultTitle').textContent = sec.resultTitle || 'Dung lượng pin cần lưu trữ';
    $('tierTableTitle').textContent = sec.tierTableTitle || 'Chi tiết hóa đơn theo bậc thang';
    $('scenarioTableTitle').textContent = sec.scenarioTableTitle || 'So sánh theo tỷ lệ dùng điện buổi tối';
    $('pTitle').textContent = sec.printTitle || 'PHIẾU TƯ VẤN PIN LƯU TRỮ HYBRID';
    $('printBtnText').textContent = sec.printButtonText || 'In / Lưu PDF phiếu tư vấn';

    // Chips
    const billChips = Array.isArray(def.billChips) ? def.billChips : [1000000, 2000000, 3000000, 5000000, 8000000];
    const kwhChips = Array.isArray(def.kwhChips) ? def.kwhChips : [300, 500, 625, 1000, 1500];
    $('billChips').innerHTML = billChips.map(v =>
      `<button type="button" class="chip" data-bill="${v}">${nf0.format(v)} đ</button>`
    ).join('');
    $('kwhChips').innerHTML = kwhChips.map(v =>
      `<button type="button" class="chip" data-kwh="${v}">${v} kWh</button>`
    ).join('');

    // Footer
    $('footerNotesTitle').textContent = ft.notesTitle || 'Lưu ý sử dụng';
    $('footerNotesList').innerHTML = (Array.isArray(ft.notes) ? ft.notes : [])
      .map(n => `<li>${escapeHtml(n)}</li>`).join('');
    $('footerCompany').textContent = ft.companyLine || b.companyName || '';
    $('tariffNote').textContent = tar.note || '';

    // State initialization / sync
    if (resetStateToDefaults || isPreview) {
      S = {
        name: S.name || '',
        mode: def.mode === 'kwh' ? 'kwh' : 'bill',
        bill: Number(def.bill) || 2000000,
        kwh: Number(def.kwh) || 625,
        eve: Number(def.eve ?? 70),
        dod: Number(def.dod ?? 90),
        eff: Number(def.eff ?? 95),
        mod: Number(def.mod ?? 5.12),
        vat: Number(def.vat ?? 8),
        days: Number(def.days ?? 30),
        tiers: (Array.isArray(tar.tiers) && tar.tiers.length ? tar.tiers : HQCalc.DEFAULT_TIERS).map(x => ({ ...x }))
      };
    }

    buildPriceGrid();
    syncInputs();
    update();
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildPriceGrid() {
    $('priceGrid').innerHTML = S.tiers.map((t, i) =>
      `<div><div class="tl">Bậc ${i + 1} (${escapeHtml(t.label)})</div><div class="field"><input type="number" inputmode="numeric" min="0" step="1" data-price="${i}" value="${t.price}"></div></div>`
    ).join('');
    document.querySelectorAll('[data-price]').forEach(el => {
      el.addEventListener('input', () => {
        S.tiers[+el.dataset.price].price = Math.max(0, parseFloat(el.value) || 0);
        update();
      });
    });
  }

  function formatDigits(str) {
    const d = String(str).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    return d ? nf0.format(Number(d)) : '';
  }

  function setBillField(v) {
    $('bill').value = v ? nf0.format(v) : '';
  }

  function syncInputs() {
    $('name').value = S.name || '';
    if ($('custPhone')) $('custPhone').value = S.phone || '';
    if ($('custAddress')) $('custAddress').value = S.address || '';
    setBillField(S.bill);
    $('kwh').value = S.kwh || '';
    $('eve').value = S.eve;
    $('dod').value = S.dod;
    $('eff').value = S.eff;
    $('mod').value = S.mod;
    $('vat').value = S.vat;
    $('days').value = S.days;
  }

  function setRange(id, outId) {
    const el = $(id);
    const min = +el.min;
    const max = +el.max;
    el.style.setProperty('--p', ((el.value - min) / (max - min) * 100) + '%');
    $(outId).textContent = el.value + '%';
  }

  function saveLocal() {
    if (isPreview) return;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({
        ...S,
        _cfgUpdatedAt: CFG ? CFG.updatedAt : null
      }));
    } catch {}
  }

  function update() {
    saveLocal();
    const isBill = S.mode === 'bill';
    $('modeBill').setAttribute('aria-pressed', isBill);
    $('modeKwh').setAttribute('aria-pressed', !isBill);
    $('billBox').hidden = !isBill;
    $('kwhBox').hidden = isBill;

    setRange('eve', 'eveOut');
    setRange('dod', 'dodOut');
    setRange('eff', 'effOut');
    $('pName').textContent = S.name || '—';
    if ($('pPhone')) $('pPhone').textContent = S.phone || '—';
    if ($('pAddress')) $('pAddress').textContent = S.address || '—';

    const vat = S.vat / 100;
    const eve = S.eve / 100;
    const dod = S.dod / 100;
    const eff = S.eff / 100;

    let kwhExact, kwhUsed, billTotal, noteKwh = '&nbsp;', noteBill = '&nbsp;';
    if (isBill) {
      const pre = S.bill / (1 + vat);
      kwhExact = HQCalc.kwhFromPreVat(pre, S.tiers);
      kwhUsed = Math.round(kwhExact);
      billTotal = S.bill;
      noteKwh = S.bill > 0 ? `Quy đổi ≈ ${nf2.format(kwhExact)} → làm tròn` : '&nbsp;';
      noteBill = 'Số tiền khách cung cấp';
    } else {
      kwhExact = S.kwh;
      kwhUsed = S.kwh;
      const pre = HQCalc.preVatFromKwh(S.kwh, S.tiers);
      billTotal = pre + Math.round(pre * vat);
      noteKwh = 'Số khách cung cấp';
      noteBill = S.kwh > 0 ? `Trước VAT ${nf0.format(pre)} đ` : '&nbsp;';
    }
    const has = kwhUsed > 0;

    $('sKwh').textContent = has ? nf0.format(kwhUsed) : '—';
    $('sKwhNote').innerHTML = noteKwh;
    $('sBill').textContent = billTotal > 0 ? nf0.format(billTotal) : '—';
    $('sBillNote').innerHTML = noteBill;

    const bat = HQCalc.batteryKwh(kwhUsed, eve, dod, eff, S.days);
    const perDay = kwhUsed / S.days;
    const eveDay = perDay * eve;
    const modules = has && S.mod > 0 ? Math.max(1, Math.ceil(bat / S.mod - 1e-9)) : 0;

    $('rBat').textContent = has ? nf1.format(bat) : '—';
    if (has && S.mod > 0) {
      $('rMods').innerHTML = `Gợi ý cấu hình: <b>${modules} module × ${nf2.format(S.mod)} kWh = ${nf2.format(modules * S.mod)} kWh</b>`;
    } else {
      $('rMods').textContent = has ? 'Nhập dung lượng module để xem gợi ý cấu hình.' : 'Nhập hóa đơn hoặc số kWh để bắt đầu.';
    }

    $('barDay').textContent = (100 - S.eve) + '%';
    $('barEve').textContent = S.eve + '%';
    $('barDay').style.width = (100 - S.eve) + '%';
    $('barEve').style.width = S.eve + '%';
    $('barHint').textContent = has
      ? `Buổi tối ≈ ${nf2.format(eveDay)} kWh/ngày ≈ ${nf0.format(eveDay * S.days)} kWh/tháng`
      : '\u00A0';

    $('v1').textContent = has ? nf2.format(perDay) + ' kWh' : '—';
    $('e1').textContent = has ? `${nf0.format(kwhUsed)} kWh ÷ ${S.days} ngày` : 'kWh tháng ÷ số ngày';
    $('v2').textContent = has ? nf2.format(eveDay) + ' kWh' : '—';
    $('e2').textContent = has ? `${nf2.format(perDay)} × ${S.eve}%` : '× tỷ lệ buổi tối';
    $('v3').textContent = has ? nf2.format(bat) + ' kWh' : '—';
    $('e3').textContent = has ? `${nf2.format(eveDay)} ÷ (${S.dod}% × ${S.eff}%)` : '\u00A0';

    // EVN Tier table
    const rows = HQCalc.tierBreakdown(kwhUsed, S.tiers);
    const totKwh = rows.reduce((a, r) => a + r.kwh, 0);
    const totAmt = rows.reduce((a, r) => a + r.amount, 0);
    $('tierBody').innerHTML = rows.map((r, i) => {
      const dim = r.kwh <= 0 ? ' class="dim"' : '';
      return `<tr>
        <td><span class="bdg">${i + 1}</span>Bậc ${i + 1}</td>
        <td>${escapeHtml(r.label)}</td>
        <td>${nf0.format(r.price)}</td>
        <td${dim}>${nf0.format(Math.round(r.kwh * 100) / 100)}</td>
        <td${dim}>${nf0.format(Math.round(r.amount))}</td>
      </tr>`;
    }).join('') + `<tr class="total">
      <td colspan="3">Cộng tiền điện (chưa VAT)</td>
      <td>${nf0.format(Math.round(totKwh * 100) / 100)}</td>
      <td>${nf0.format(Math.round(totAmt))}</td>
    </tr>`;

    const preV = HQCalc.preVatFromKwh(kwhUsed, S.tiers);
    $('tierNote').textContent = has
      ? `Tiền điện ${nf0.format(preV)} đ + VAT ${S.vat}% (${nf0.format(Math.round(preV * vat))} đ) = ${nf0.format(preV + Math.round(preV * vat))} đ cho ${nf0.format(kwhUsed)} kWh.`
      : 'Nhập số liệu để xem chi tiết từng bậc.';

    // Scenarios table
    const scenarios = (CFG && CFG.defaults && Array.isArray(CFG.defaults.scenarios) && CFG.defaults.scenarios.length)
      ? CFG.defaults.scenarios
      : [50, 60, 70, 80, 90];
    $('scBody').innerHTML = scenarios.map(p => {
      const b = HQCalc.batteryKwh(kwhUsed, p / 100, dod, eff, S.days);
      const e = (kwhUsed / S.days) * p / 100;
      const n = has && S.mod > 0 ? Math.max(1, Math.ceil(b / S.mod - 1e-9)) : null;
      return `<tr${p === S.eve ? ' class="cur"' : ''}>
        <td>${p}%</td>
        <td>${has ? nf2.format(e) : '—'}</td>
        <td>${has ? nf1.format(b) : '—'}</td>
        <td>${n ? `${n} × ${nf2.format(S.mod)} kWh` : '—'}</td>
      </tr>`;
    }).join('');

    window._hqLastResult = { kwhUsed, billTotal, bat, modules, eveDay };
    renderCombos(kwhUsed, bat);
  }


  function renderCombos(kwhUsed, bat) {
    const grid = $('comboGrid');
    if (!grid || !window.HQCombo) return;
    if (!kwhUsed || kwhUsed <= 0) {
      grid.innerHTML = '<p class="note">Nhập hóa đơn hoặc số kWh để hệ thống gợi ý Combo lắp đặt phù hợp.</p>';
      return;
    }
    const sunHours = (CFG && CFG.defaults && Number(CFG.defaults.sunHours)) || 4.0;
    const showPrices = Boolean(CFG && CFG.sections && CFG.sections.showComboPrices === true);
    const combos = window.HQCombo.recommendCombos({
      kwhMonth: kwhUsed,
      batNeededKwh: bat,
      days: S.days,
      sunHours,
      products: PRODUCTS,
      mixSeeds: comboMixSeeds
    });
    window._hqCombos = combos;
    if (!combos.length) {
      grid.innerHTML = '<p class="note">Chưa đủ dữ liệu 3 nhóm sản phẩm (Inverter, Tấm pin, Pin lưu trữ) đang kích hoạt. Hãy tải lên danh mục sản phẩm tại trang Quản trị.</p>';
      return;
    }
    grid.innerHTML = combos.map((c, idx) => {
      const isSel = selectedComboKey === c.key;
      const isFeat = c.key === 'recommended';
      return `<div class="combo-item${isFeat ? ' featured' : ''}${isSel ? ' selected' : ''}">
        <div class="combo-top">
          <span class="combo-badge">${escapeHtml(c.badge)}</span>
          <span style="font-size:12px;font-weight:700;color:var(--ink-3)">${nf2.format(c.solarKwp)} kWp · ${nf2.format(c.batTotalKwh)} kWh</span>
        </div>
        <div>
          <h3 class="combo-title">${escapeHtml(c.title)}</h3>
          <p class="combo-desc">${escapeHtml(c.desc)}</p>
        </div>
        <div class="combo-price">
          ${showPrices ? nf0.format(c.totalPrice) + ' đ' : 'Liên hệ để báo giá'}
          <small>Trọn bộ thiết bị (Inverter + Tấm pin + Pin lưu trữ + Phụ kiện lắp đặt)</small>
        </div>
        <div class="combo-gallery${c.accessory ? ' cols-4' : ''}">
          <div class="combo-thumb"><img src="${escapeHtml(c.inverter.imageUrl || '/assets/prod-inverter.jpg')}" alt="Inverter"><span>Inverter ${c.inverter.powerKw}kW</span></div>
          <div class="combo-thumb"><img src="${escapeHtml(c.panel.imageUrl || '/assets/prod-panel.jpg')}" alt="Pin mặt trời"><span>${c.panelCount} tấm pin</span></div>
          <div class="combo-thumb"><img src="${escapeHtml(c.battery.imageUrl || '/assets/prod-battery.jpg')}" alt="Pin lưu trữ"><span>${c.batCount} pin lưu trữ</span></div>
          ${c.accessory ? `<div class="combo-thumb"><img src="${escapeHtml(c.accessory.imageUrl || '/assets/prod-accessory.jpg')}" alt="Phụ kiện lắp đặt"><span>Phụ kiện (${c.accessories.length})</span></div>` : ''}
        </div>
        <ul class="combo-specs">
          <li class="combo-spec-row">
            <img src="${escapeHtml(c.inverter.imageUrl || '/assets/prod-inverter.jpg')}" alt="Inverter">
            <div><span class="sp-cat">Inverter Hybrid</span><span class="sp-name">1 × ${escapeHtml(c.inverter.name)}</span><span class="sp-meta">${c.inverter.powerKw} kW (${escapeHtml(c.inverter.phase || '1 pha')})${showPrices ? ' · ' + nf0.format(c.invTotal) + ' đ' : ''}</span></div>
          </li>
          <li class="combo-spec-row">
            <img src="${escapeHtml(c.panel.imageUrl || '/assets/prod-panel.jpg')}" alt="Pin mặt trời">
            <div><span class="sp-cat">Pin năng lượng mặt trời</span><span class="sp-name">${c.panelCount} tấm × ${escapeHtml(c.panel.name)}</span><span class="sp-meta">Tổng ${nf2.format(c.solarKwp)} kWp${showPrices ? ' · ' + nf0.format(c.panelTotal) + ' đ' : ''}</span></div>
          </li>
          <li class="combo-spec-row">
            <img src="${escapeHtml(c.battery.imageUrl || '/assets/prod-battery.jpg')}" alt="Pin lưu trữ">
            <div><span class="sp-cat">Pin lưu trữ</span><span class="sp-name">${c.batCount} module × ${escapeHtml(c.battery.name)}</span><span class="sp-meta">Tổng ${nf2.format(c.batTotalKwh)} kWh${showPrices ? ' · ' + nf0.format(c.batTotal) + ' đ' : ''}</span></div>
          </li>
          ${(c.accessories && c.accessories.length) ? `<li class="combo-spec-row">
            <img src="${escapeHtml(c.accessory.imageUrl || '/assets/prod-accessory.jpg')}" alt="Phụ kiện lắp đặt">
            <div><span class="sp-cat">Phụ kiện thi công &amp; lắp đặt</span><span class="sp-name">Trọn bộ phụ kiện (${c.accessories.length} hạng mục)</span><span class="sp-meta">${escapeHtml(c.accessories.map(a => a.name).join(' · '))}</span></div>
          </li>` : ''}
        </ul>
        <div class="combo-card-actions noprint">
          <button type="button" class="combo-btn" data-select-combo="${c.key}">${isSel ? '✓ Đã chọn' : 'Chọn gói này'}</button>
          <button type="button" class="combo-mix-one" data-mix-idx="${idx}" title="Phối ghép ngẫu nhiên riêng gói này">🔀 Mix</button>
        </div>
      </div>`;
    }).join('');
    grid.querySelectorAll('[data-select-combo]').forEach(btn => {
      btn.onclick = () => {
        selectedComboKey = btn.dataset.selectCombo;
        renderCombos(kwhUsed, bat);
        showToast('Đã chọn gói Combo vào phiếu tư vấn!');
      };
    });
    grid.querySelectorAll('[data-mix-idx]').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.mixIdx;
        comboMixSeeds[i] = (comboMixSeeds[i] || 0) + 1 + Math.floor(Math.random() * 97);
        renderCombos(kwhUsed, bat);
        showToast(`Đã Mix lại Combo #${i + 1}!`);
      };
    });
  }

  // Event bindings
  $('pDate').textContent = new Date().toLocaleDateString('vi-VN');

  $('bill').addEventListener('input', e => {
    const el = e.target;
    const pos = el.selectionStart;
    const digitsBefore = el.value.slice(0, pos).replace(/\D/g, '').length;
    el.value = formatDigits(el.value);
    let seen = 0, np = 0;
    while (np < el.value.length && seen < digitsBefore) {
      if (/\d/.test(el.value[np])) seen++;
      np++;
    }
    try { el.setSelectionRange(np, np); } catch {}
    S.bill = Number(el.value.replace(/\D/g, '')) || 0;
    update();
  });

  $('kwh').addEventListener('input', e => {
    S.kwh = Math.max(0, parseFloat(e.target.value) || 0);
    update();
  });
  $('name').addEventListener('input', e => { S.name = e.target.value; update(); });
  if ($('custPhone')) $('custPhone').addEventListener('input', e => { S.phone = e.target.value; update(); });
  if ($('custAddress')) $('custAddress').addEventListener('input', e => { S.address = e.target.value; update(); });
  ['eve', 'dod', 'eff'].forEach(id => {
    $(id).addEventListener('input', e => {
      S[id] = Number(e.target.value);
      update();
    });
  });
  $('mod').addEventListener('input', e => {
    S.mod = parseFloat(e.target.value) || 0;
    update();
  });
  $('vat').addEventListener('input', e => {
    S.vat = Math.max(0, parseFloat(e.target.value) || 0);
    update();
  });
  $('days').addEventListener('input', e => {
    S.days = Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 30));
    update();
  });

  $('modeBill').onclick = () => { S.mode = 'bill'; update(); };
  $('modeKwh').onclick = () => { S.mode = 'kwh'; update(); };

  document.body.addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    if (c.dataset.bill) { S.bill = +c.dataset.bill; setBillField(S.bill); update(); }
    if (c.dataset.kwh) { S.kwh = +c.dataset.kwh; $('kwh').value = S.kwh; update(); }
    if (c.dataset.mod) { S.mod = +c.dataset.mod; $('mod').value = S.mod; update(); }
  });

  $('reset').onclick = () => {
    if (CFG) {
      localStorage.removeItem(LOCAL_KEY);
      applyConfig(CFG, true);
      showToast('Đã khôi phục biểu giá và thông số mặc định.');
    }
  };

  $('print').onclick = () => window.print();

  $('copySummary').onclick = async () => {
    const r = window._hqLastResult || {};
    const company = (CFG && CFG.branding && CFG.branding.companyName) || 'HOÀNG QUÂN';
    const lines = [
      `[${company}] TƯ VẤN PIN LƯU TRỮ HYBRID`,
      S.name ? `• Khách hàng: ${S.name}` : null,
      S.phone ? `• Điện thoại: ${S.phone}` : null,
      S.address ? `• Địa chỉ: ${S.address}` : null,
      `• Hóa đơn điện: ${nf0.format(r.billTotal || 0)} đ/tháng (≈ ${nf0.format(r.kwhUsed || 0)} kWh)`,
      `• Tỷ lệ dùng buổi tối: ${S.eve}% (≈ ${nf2.format(r.eveDay || 0)} kWh/tối)`,
      `• Dung lượng pin cần: ${nf1.format(r.bat || 0)} kWh (DoD ${S.dod}%, hiệu suất ${S.eff}%)`,
      r.modules ? `• Gợi ý cấu hình pin: ${r.modules} module × ${nf2.format(S.mod)} kWh = ${nf2.format(r.modules * S.mod)} kWh` : null,
      ...(function(){ const c = (window._hqCombos || []).find(x => x.key === selectedComboKey); if (!c) return []; const sp = Boolean(CFG && CFG.sections && CFG.sections.showComboPrices === true); return [`• Combo đề xuất (${c.badge}):`, `  - Inverter: 1 × ${c.inverter.name}`, `  - Pin MT: ${c.panelCount} tấm × ${c.panel.name} (${nf2.format(c.solarKwp)} kWp)`, `  - Lưu trữ: ${c.batCount} × ${c.battery.name} (${nf2.format(c.batTotalKwh)} kWh)`, sp ? `  - Dự kiến thiết bị: ${nf0.format(c.totalPrice)} đ` : '  - Giá bán: Liên hệ để báo giá']; })()
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      showToast('Đã sao chép kết quả tư vấn!');
    } catch {
      showToast('Không thể sao chép tự động trên trình duyệt này.');
    }
  };

  // Live preview listener from Admin iframe
  window.addEventListener('message', ev => {
    if (ev.data && ev.data.type === 'HQ_PREVIEW_CONFIG' && ev.data.config) {
      if (Array.isArray(ev.data.products)) PRODUCTS = ev.data.products;
      applyConfig(ev.data.config, true);
    }
  });

  // Boot
  Promise.all([fetch('/api/config').then(r => r.json()), fetch('/api/products').then(r => r.json()).catch(() => ({ products: [] }))])
    .then(([data, prodData]) => {
      PRODUCTS = Array.isArray(prodData.products) ? prodData.products : [];
      const cfg = data.config;
      let restored = false;
      if (!isPreview) {
        try {
          const raw = localStorage.getItem(LOCAL_KEY);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved._cfgUpdatedAt === cfg.updatedAt) {
              S = Object.assign(S, saved);
              restored = true;
            }
          }
        } catch {}
      }
      applyConfig(cfg, !restored);
    })
    .catch(err => {
      console.error('Không tải được cấu hình:', err);
      buildPriceGrid();
      syncInputs();
      update();
    });
})();
