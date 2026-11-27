(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const LOCAL_KEY = 'hq_pin_tuvan_node_v1';

  let CFG = null;
  const S = {
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

  function showToast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function defaultInputs(def = {}) {
    return {
      mode: def.mode === 'kwh' ? 'kwh' : 'bill',
      bill: Number(def.bill ?? 2000000), kwh: Number(def.kwh ?? 625),
      eve: Number(def.eve ?? 70), dod: Number(def.dod ?? 90), eff: Number(def.eff ?? 95),
      mod: Number(def.mod ?? 5.12), vat: Number(def.vat ?? 8), days: Number(def.days ?? 30)
    };
  }

  function defaultTiers(cfg) {
    return cfg.tariffs?.tiers?.length ? cfg.tariffs.tiers : HQCalc.DEFAULT_TIERS;
  }

  function restoreLocal(config) {
    const defaults = defaultInputs(config.defaults);
    const tiers = defaultTiers(config).map(tier => ({ ...tier }));
    Object.assign(S, defaults, { tiers });
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      if (!saved) return;
      const legacyDraft = Boolean(saved._cfgUpdatedAt && saved._cfgUpdatedAt === config.updatedAt);
      const inputs = saved.inputs || (legacyDraft ? saved : {});
      for (const [key, value] of Object.entries(defaults)) {
        const input = inputs[key];
        if (key === 'mode' ? input === 'bill' || input === 'kwh' : Number.isFinite(input) && input >= 0) {
          S[key] = input;
        }
      }
      const prices = saved.baseTiers === JSON.stringify(defaultTiers(config)) ? saved.prices
        : legacyDraft && Array.isArray(saved.tiers) ? saved.tiers.map(tier => tier?.price) : [];
      if (Array.isArray(prices)) {
        tiers.forEach((tier, index) => {
          const price = prices[index];
          if (Number.isFinite(price) && price >= 0) tier.price = price;
        });
      }
      return legacyDraft;
    } catch {}
  }

  function applyConfig(cfg, resetStateToDefaults) {
    const previous = CFG;
    CFG = cfg;
    const t = cfg.theme || {};
    const b = cfg.branding || {};
    const h = cfg.hero || {};
    const sec = cfg.sections || {};
    const def = cfg.defaults || {};
    const tar = cfg.tariffs || {};
    const ft = cfg.footer || {};

    SiteTheme.apply(cfg);
    $('stickyCol').classList.toggle('is-sticky', t.stickyResult !== false);

    // Branding
    document.title = b.siteTitle || 'Tư vấn Pin lưu trữ Hybrid – Công Ty TNHH Mai Sơn Solar';
    $('brandLogo').src = b.logoUrl || '/assets/logo-default.jpg?v=mss';
    $('brandLogo').alt = b.companyName || 'Công Ty TNHH Mai Sơn Solar';
    $('docFavicon').href = b.faviconUrl || '/assets/favicon.png?v=mss';
    $('hotlineWrap').hidden = b.showHotline === false;
    $('hotlineLabel').textContent = b.hotlineLabel || 'Hotline tư vấn';
    const hotlines = Array.isArray(b.hotlines) ? b.hotlines : [];
    $('hotlineList').innerHTML = hotlines.map(item =>
      `<a href="tel:${escapeHtml(item.tel || item.number)}">${escapeHtml(item.number)}</a>`
    ).join('');

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
    renderSiteContact(ft, sec.showContactCta !== false);
    $('billChips').hidden = sec.showQuickChips === false;
    $('kwhChips').hidden = sec.showQuickChips === false;
    $('modChips').hidden = sec.showQuickChips === false;
    $('slidersWrap').hidden = sec.showSliders === false;
    $('advCard').hidden = sec.showAdvancedSettings === false;
    $('dayNightWrap').hidden = sec.showDayNightBar === false;
    $('stepsWrap').hidden = sec.showCalcSteps === false;
    $('tierCard').hidden = sec.showTierTable === false;
    $('scenarioCard').hidden = sec.showScenarioTable === false;
    $('footerNotesWrap').hidden = sec.showFooterNotes === false;

    $('card1Title').textContent = sec.card1Title || 'Mức tiêu thụ điện của khách';
    $('card2Title').textContent = sec.card2Title || 'Thông số tính pin lưu trữ';
    $('resultTitle').textContent = sec.resultTitle || 'Dung lượng pin cần lưu trữ';
    $('tierTableTitle').textContent = sec.tierTableTitle || 'Chi tiết hóa đơn theo bậc thang';
    $('scenarioTableTitle').textContent = sec.scenarioTableTitle || 'So sánh theo tỷ lệ dùng điện buổi tối';

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
      Object.assign(S, defaultInputs(def));
    } else if (previous) {
      const oldInputs = defaultInputs(previous.defaults);
      for (const [key, value] of Object.entries(defaultInputs(def))) {
        if (S[key] === oldInputs[key]) S[key] = value;
      }
    }
    if (resetStateToDefaults || isPreview || (previous && JSON.stringify(defaultTiers(cfg)) !== JSON.stringify(defaultTiers(previous)))) {
      S.tiers = defaultTiers(cfg).map(tier => ({ ...tier }));
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
        update(true);
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
    if (isPreview || !CFG) return;
    try {
      const defaults = defaultInputs(CFG.defaults);
      const inputs = Object.fromEntries(Object.keys(defaults).filter(key => S[key] !== defaults[key]).map(key => [key, S[key]]));
      const tiers = defaultTiers(CFG);
      const settings = { inputs };
      if (S.tiers.some((tier, index) => tier.price !== tiers[index]?.price)) {
        settings.baseTiers = JSON.stringify(tiers);
        settings.prices = S.tiers.map(tier => tier.price);
      }
      localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
    } catch {}
  }

  function update(saveDraft = false) {
    if (saveDraft) saveLocal();
    const isBill = S.mode === 'bill';
    $('modeBill').setAttribute('aria-pressed', isBill);
    $('modeKwh').setAttribute('aria-pressed', !isBill);
    $('billBox').hidden = !isBill;
    $('kwhBox').hidden = isBill;

    setRange('eve', 'eveOut');
    setRange('dod', 'dodOut');
    setRange('eff', 'effOut');

    const vat = S.vat / 100;
    const dod = S.dod / 100;
    const eff = S.eff / 100;

    const { kwhExact, kwhUsed, preVat, billTotal, bat, modules, eveDay } = HQCalc.calculateRecommendation(S);
    let noteKwh, noteBill;
    if (isBill) {
      noteKwh = S.bill > 0 ? `Quy đổi ≈ ${nf2.format(kwhExact)} → làm tròn` : '&nbsp;';
      noteBill = 'Số tiền khách cung cấp';
    } else {
      noteKwh = 'Số khách cung cấp';
      noteBill = kwhUsed > 0 ? `Trước VAT ${nf0.format(preVat)} đ` : '&nbsp;';
    }
    const has = kwhUsed > 0;

    $('sKwh').textContent = has ? nf0.format(kwhUsed) : '—';
    $('sKwhNote').innerHTML = noteKwh;
    $('sBill').textContent = billTotal > 0 ? nf0.format(billTotal) : '—';
    $('sBillNote').innerHTML = noteBill;

    const perDay = kwhUsed / S.days;

    $('rBat').textContent = has ? nf1.format(bat) : '—';
    if (has && bat === 0) {
      $('rMods').textContent = 'Không cần pin lưu trữ với mức sử dụng điện buổi tối này.';
    } else if (has && S.mod > 0) {
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
      const n = HQCalc.countModules(b, S.mod);
      return `<tr${p === S.eve ? ' class="cur"' : ''}>
        <td>${p}%</td>
        <td>${has ? nf2.format(e) : '—'}</td>
        <td>${has ? nf1.format(b) : '—'}</td>
        <td>${n ? `${n} × ${nf2.format(S.mod)} kWh` : has && b === 0 ? '0' : '—'}</td>
      </tr>`;
    }).join('');

    window._hqLastResult = { kwhUsed, billTotal, bat, modules, eveDay };
    scheduleLeadSave();
  }


  
  // ---------- CUSTOMER DATA AND QUOTE REQUEST ----------
  let leadSessionId = '';
  try {
    leadSessionId = sessionStorage.getItem('hq_lead_sid') || '';
    if (!leadSessionId) {
      leadSessionId = 'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      sessionStorage.setItem('hq_lead_sid', leadSessionId);
    }
  } catch {
    leadSessionId = 'lead-' + Date.now();
  }
  let leadSaveTimer = null;
  let lastLeadSig = '';
  let leadSaveQueue = Promise.resolve();
  let quoteRequestedAt = '';
  let quoteSaving = false;
  const quoteButton = $('requestQuote');
  const quoteFeedback = $('quoteFeedback');

  function buildLeadPayload(contact = S) {
    const r = window._hqLastResult || {};
    return {
      sessionId: leadSessionId,
      customerName: contact.name.trim(),
      customerPhone: contact.phone.trim(),
      customerAddress: contact.address.trim(),
      billTotal: Math.round(r.billTotal || 0),
      kwhUsed: Math.round(r.kwhUsed || 0),
      evePct: S.eve,
      batNeededKwh: Number((r.bat || 0).toFixed(2)),
      modulesCount: r.modules || 0,
      moduleKwh: S.mod
    };
  }

  function saveLead(payload) {
    const sig = JSON.stringify(payload);
    const request = leadSaveQueue.then(async () => {
      if (sig === lastLeadSig) return;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: sig,
          keepalive: true,
          signal: controller.signal
        });
        if (payload.autosave && response.status === 404) {
          lastLeadSig = sig;
          return;
        }
        const result = await response.json();
        if (!response.ok || result.ok !== true || (payload.requestQuote && !result.lead?.quoteRequestedAt)) {
          throw new Error(result.error || 'Không thể lưu thông tin tư vấn.');
        }
        if (result.lead?.quoteRequestedAt) quoteRequestedAt = result.lead.quoteRequestedAt;
      } finally {
        clearTimeout(timer);
      }
      lastLeadSig = sig;
      try {
        sessionStorage.setItem('hq_cust_info', JSON.stringify({
          name: payload.customerName, phone: payload.customerPhone, address: payload.customerAddress,
          quoteRequestedAt
        }));
      } catch {}
      if (quoteRequestedAt) renderQuote();
    });
    leadSaveQueue = request.catch(() => {});
    return request;
  }

  function scheduleLeadSave() {
    if (isPreview || !isLeadUnlocked) return;
    clearTimeout(leadSaveTimer);
    leadSaveTimer = setTimeout(() => {
      const payload = buildLeadPayload();
      if (payload.customerName.length < 2 || payload.customerPhone.replace(/\D/g, '').length < 9 ||
          payload.customerAddress.length < 2) return;
      saveLead({ ...payload, autosave: true }).catch(() => showToast('Không thể lưu thay đổi tư vấn. Vui lòng kiểm tra kết nối.'));
    }, 1200);
  }

  function renderQuote(error = '') {
    quoteButton.disabled = isPreview || quoteSaving || Boolean(quoteRequestedAt);
    quoteButton.textContent = quoteRequestedAt ? 'Đã gửi yêu cầu' : quoteSaving ? 'Đang gửi…' : 'Yêu cầu báo giá';
    quoteFeedback.hidden = !quoteRequestedAt && !error;
    quoteFeedback.dataset.error = String(Boolean(error));
    quoteFeedback.textContent = quoteRequestedAt
      ? 'Cảm ơn quý khách đã để lại thông tin. Bộ phận kinh doanh sẽ liên hệ với quý khách.'
      : error;
  }

  quoteButton.onclick = async () => {
    if (isPreview || !isLeadUnlocked || quoteSaving || quoteRequestedAt) return;
    quoteSaving = true;
    renderQuote();
    clearTimeout(leadSaveTimer);
    let error = '';
    try {
      await saveLead({ ...buildLeadPayload(), requestQuote: true });
    } catch {
      error = 'Chưa gửi được yêu cầu báo giá. Vui lòng kiểm tra thông tin liên hệ và thử lại.';
    } finally {
      quoteSaving = false;
      renderQuote(error);
    }
  };

  // Event bindings

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
    update(true);
  });

  $('kwh').addEventListener('input', e => {
    S.kwh = Math.max(0, parseFloat(e.target.value) || 0);
    update(true);
  });
  $('name').addEventListener('input', e => { S.name = e.target.value; update(); });
  if ($('custPhone')) $('custPhone').addEventListener('input', e => { S.phone = e.target.value; update(); });
  if ($('custAddress')) $('custAddress').addEventListener('input', e => { S.address = e.target.value; update(); });
  ['eve', 'dod', 'eff'].forEach(id => {
    $(id).addEventListener('input', e => {
      S[id] = Number(e.target.value);
      update(true);
    });
  });
  $('mod').addEventListener('input', e => {
    S.mod = Math.max(0, parseFloat(e.target.value) || 0);
    update(true);
  });
  $('vat').addEventListener('input', e => {
    S.vat = Math.max(0, parseFloat(e.target.value) || 0);
    update(true);
  });
  $('days').addEventListener('input', e => {
    S.days = Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 30));
    update(true);
  });

  $('modeBill').onclick = () => { S.mode = 'bill'; update(true); };
  $('modeKwh').onclick = () => { S.mode = 'kwh'; update(true); };

  document.body.addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    if (c.dataset.bill) { S.bill = +c.dataset.bill; setBillField(S.bill); update(true); }
    if (c.dataset.kwh) { S.kwh = +c.dataset.kwh; $('kwh').value = S.kwh; update(true); }
    if (c.dataset.mod) { S.mod = +c.dataset.mod; $('mod').value = S.mod; update(true); }
  });

  $('reset').onclick = () => {
    if (CFG) {
      localStorage.removeItem(LOCAL_KEY);
      applyConfig(CFG, true);
      showToast('Đã khôi phục biểu giá và thông số mặc định.');
    }
  };


  // Live preview listener from Admin iframe
  let receivedPreview = false;
  window.addEventListener('message', ev => {
    if (isPreview && ev.origin === location.origin && ev.source === window.parent && ev.data?.type === 'HQ_PREVIEW_CONFIG' && ev.data.config) {
      receivedPreview = true;
      applyConfig(ev.data.config, true);
    }
  });

  HQLive.watch(config => {
    if (receivedPreview) return;
    const migrateDraft = !CFG && !isPreview && restoreLocal(config);
    applyConfig(config, isPreview);
    if (migrateDraft) saveLocal();
  }, () => {
    if (!CFG && !receivedPreview && !window._hqLastResult) {
      buildPriceGrid();
      syncInputs();
      update();
    }
  });

  // ---------- MANDATORY CUSTOMER INFO GATE ----------
  let isLeadUnlocked = false;
  function unlockConsultation() {
    isLeadUnlocked = true;
    if ($('leadGateCard')) $('leadGateCard').hidden = true;
    if ($('calcUnlockedWrap')) $('calcUnlockedWrap').hidden = false;
  }
  if (isPreview) {
    unlockConsultation();
  } else {
    try {
      const saved = JSON.parse(sessionStorage.getItem('hq_cust_info') || 'null');
      if (saved && saved.name && String(saved.phone || '').replace(/\D/g, '').length >= 9 && saved.address) {
        S.name = saved.name; S.phone = saved.phone; S.address = saved.address;
        quoteRequestedAt = saved.quoteRequestedAt || '';
        syncInputs();
        unlockConsultation();
      }
    } catch {}
  }
  renderQuote();
  if ($('leadGateForm')) {
    $('leadGateForm').addEventListener('submit', async e => {
      e.preventDefault();
      const submit = e.currentTarget.querySelector('button[type="submit"]');
      if (submit.disabled) return;
      const name = ($('gateName').value || '').trim();
      const phone = ($('gatePhone').value || '').trim();
      const addr = ($('gateAddress').value || '').trim();
      const digits = phone.replace(/\D/g, '');
      if (name.length < 2) { $('gateErr').textContent = 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự).'; $('gateName').focus(); return; }
      if (digits.length < 9 || digits.length > 12) { $('gateErr').textContent = 'Vui lòng nhập số điện thoại hợp lệ (9–12 chữ số).'; $('gatePhone').focus(); return; }
      if (addr.length < 2) { $('gateErr').textContent = 'Vui lòng nhập địa chỉ lắp đặt / liên hệ.'; $('gateAddress').focus(); return; }
      $('gateErr').textContent = '';
      submit.disabled = true;
      try {
        await saveLead(buildLeadPayload({ name, phone, address: addr }));
      } catch {
        $('gateErr').textContent = 'Chưa lưu được thông tin. Vui lòng kiểm tra kết nối và gửi lại.';
        return;
      } finally {
        submit.disabled = false;
      }
      Object.assign(S, { name, phone, address: addr });
      syncInputs();
      unlockConsultation();
      update();
      $('calcWorkspaceTitle').focus();
      showToast('Đã xác nhận thông tin! Mời bạn tính dung lượng Pin Hybrid.');
    });
  }

})();
