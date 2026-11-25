(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const SHADOW_MAP = {
    none: 'none',
    soft: '0 1px 3px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.04)',
    medium: '0 2px 6px rgba(15,23,42,.04), 0 12px 28px rgba(15,23,42,.07)',
    strong: '0 4px 12px rgba(15,23,42,.08), 0 20px 44px rgba(15,23,42,.14)'
  };
  const CAT_LABEL = { inverter: 'Inverter Hybrid', panel: 'Pin mặt trời', battery: 'Pin lưu trữ', accessory: 'Phụ kiện lắp đặt' };

  let CFG = null;
  let PRODUCTS = [];
  let activeCat = 'all';
  let searchQ = '';

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#F26A1B').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const n = parseInt(full, 16);
    if (isNaN(n)) return `rgba(242,106,27,${alpha})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  function getPrimaryContact() {
    const hotlines = (CFG && CFG.branding && CFG.branding.hotlines) || [];
    const primaryHl = hotlines[0] || { tel: '0913350597', zalo: '0913350597' };
    const tel = esc(primaryHl.tel || String(primaryHl.number || '').replace(/[^\d+]/g, ''));
    const zalo = esc(primaryHl.zalo !== undefined ? primaryHl.zalo : tel.replace(/[^\d]/g, ''));
    return { tel, zalo };
  }

  function applyTheme(cfg) {
    CFG = cfg;
    const t = cfg.theme || {}, b = cfg.branding || {}, f = cfg.footer || {};
    const r = document.documentElement.style;
    r.setProperty('--primary', t.primary || '#F26A1B');
    r.setProperty('--primary-deep', t.primaryDeep || '#D9560B');
    r.setProperty('--grad-end', t.gradientEnd || '#FFB400');
    r.setProperty('--primary-soft', hexToRgba(t.primary || '#F26A1B', t.darkMode ? 0.18 : 0.1));
    r.setProperty('--primary-line', hexToRgba(t.primary || '#F26A1B', t.darkMode ? 0.42 : 0.28));
    r.setProperty('--bg', t.bg || '#F3F5F9');
    r.setProperty('--card', t.cardBg || '#FFFFFF');
    r.setProperty('--ink', t.ink || '#111827');
    r.setProperty('--ink-2', t.inkMuted || '#4B5563');
    r.setProperty('--radius', (Number(t.radius) || 18) + 'px');
    r.setProperty('--max-width', (Number(t.maxWidth) || 1160) + 'px');
    r.setProperty('--logo-h', (Number(b.logoHeight) || 54) + 'px');
    r.setProperty('--shadow', SHADOW_MAP[t.shadowLevel] || SHADOW_MAP.medium);
    document.body.classList.toggle('dark-mode', Boolean(t.darkMode));

    if (b.logoUrl) $('brandLogo').src = b.logoUrl;
    if (b.faviconUrl) $('docFavicon').href = b.faviconUrl;
    $('hotlineWrap').hidden = b.showHotline === false;
    $('hotlineLabel').textContent = b.hotlineLabel || 'Hotline tư vấn';
    const hotlines = Array.isArray(b.hotlines) ? b.hotlines : [];
    $('hotlineList').innerHTML = hotlines.map(x => `<a href="tel:${esc(x.tel || x.number)}">${esc(x.number)}</a>`).join('');

    $('ctaTitle').textContent = f.ctaTitle || 'Liên hệ ngay để được tư vấn & khảo sát miễn phí';
    $('ctaSubtitle').textContent = f.ctaSubtitle || '';
    const hasAddr = Boolean((f.ctaAddress || '').trim());
    $('ctaAddress').hidden = !hasAddr;
    $('ctaAddress').textContent = hasAddr ? '📍 ' + f.ctaAddress : '';
    const callLbl = f.callBtnText || 'Gọi ngay';
    const zaloLbl = f.zaloBtnText || 'Chat Zalo';
    $('ctaList').innerHTML = hotlines.map(item => {
      const tel = esc(item.tel || String(item.number || '').replace(/[^\d+]/g, ''));
      const zalo = esc(item.zalo !== undefined ? item.zalo : tel.replace(/[^\d]/g, ''));
      return `<div class="cta-row">
        <div class="cta-info">
          ${item.label ? `<span class="cta-role">${esc(item.label)}</span>` : ''}
          <a class="cta-phone" href="tel:${tel}">${esc(item.number)}</a>
        </div>
        <div class="cta-btns">
          <a class="cta-btn call" href="tel:${tel}">📞 ${esc(callLbl)}</a>
          ${zalo ? `<a class="cta-btn zalo" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">💬 ${esc(zaloLbl)}</a>` : ''}
        </div>
      </div>`;
    }).join('');
    $('footerCompany').textContent = f.companyLine || b.companyName || '';
  }

  function getStockMeta(p) {
    const st = p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock');
    if (st === 'out_of_stock') return { cls: 'out-stock', label: 'Hết hàng', badge: '● Hết hàng', out: true };
    if (st === 'contact') return { cls: 'contact-stock', label: 'Liên hệ', badge: '● Liên hệ', out: false };
    return { cls: 'in-stock', label: 'Còn hàng', badge: '● Còn hàng', out: false };
  }

  function openProductModal(p) {
    if (!p) return;
    const specPill = p.category === 'inverter'
      ? `${p.powerKw} kW · ${p.phase || '1 pha'}`
      : p.category === 'panel' ? `${p.wattWp} Wp`
      : p.category === 'battery' ? `${p.capacityKwh} kWh`
      : (p.specText || 'Phụ kiện lắp đặt');
    $('pmImg').src = p.imageUrl || `/assets/prod-${p.category}.jpg`;
    $('pmImg').alt = p.name || '';
    $('pmBrand').textContent = `${CAT_LABEL[p.category] || p.category}${p.brand ? ' · ' + p.brand : ''}`;
    $('pmSpecPill').textContent = specPill;
    const sm = getStockMeta(p);
    if ($('pmStockPill')) {
      $('pmStockPill').textContent = sm.badge;
      $('pmStockPill').className = 'pm-stock-pill ' + sm.cls;
    }
    $('pmTitle').textContent = p.name || '';
    $('pmDesc').textContent = p.description || p.note || '';
    $('pmDesc').hidden = !(p.description || p.note);

    // Build Technical Specs rows
    const rows = [];
    if (p.brand) rows.push(['Hãng sản xuất', p.brand]);
    rows.push(['Phân loại', CAT_LABEL[p.category] || p.category]);
    if (p.category === 'inverter') {
      rows.push(['Công suất định mức', `${p.powerKw} kW`]);
      if (p.phase) rows.push(['Số pha', p.phase]);
    } else if (p.category === 'panel') {
      rows.push(['Công suất đỉnh', `${p.wattWp} Wp`]);
    } else if (p.category === 'battery') {
      rows.push(['Dung lượng lưu trữ', `${p.capacityKwh} kWh`]);
    } else if (p.specText) {
      rows.push(['Quy cách / Thông số chính', p.specText]);
    }
    rows.push(['Trạng thái', sm.label]);
    if (p.warranty) rows.push(['Bảo hành', p.warranty]);
    if (p.specs) {
      String(p.specs).split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(line => {
        const idx = line.indexOf(':');
        if (idx > 0) rows.push([line.slice(0, idx).trim(), line.slice(idx + 1).trim()]);
        else rows.push(['Thông số', line]);
      });
    }
    $('pmSpecsBody').innerHTML = rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');

    // Build Datasheet & Attachments
    const docs = [];
    if (p.datasheetUrl) {
      docs.push({ label: p.datasheetName || 'Tải Datasheet (Thông số kỹ thuật)', url: p.datasheetUrl, primary: true });
    }
    if (Array.isArray(p.attachments)) {
      p.attachments.forEach(a => {
        if (a && a.url) docs.push({ label: a.name || 'Tài liệu đính kèm', url: a.url, primary: false });
      });
    }
    $('pmDocsWrap').hidden = !docs.length;
    $('pmDocsList').innerHTML = docs.length
      ? docs.map(d =>
          `<a class="doc-dl-btn${d.primary ? '' : ' secondary'}" href="${esc(d.url)}" download target="_blank" rel="noopener">${d.primary ? '📄' : '📎'} ${esc(d.label)}</a>`
        ).join('')
      : '';

    const { tel, zalo } = getPrimaryContact();
    $('pmActions').innerHTML = `
      <a class="cta-btn call" style="flex:1;justify-content:center" href="tel:${tel}">📞 Gọi ngay</a>
      ${zalo ? `<a class="cta-btn zalo" style="flex:1;justify-content:center" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">💬 Báo giá Zalo</a>` : ''}
    `;

    $('prodModal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('prodModal').hidden = true;
    document.body.style.overflow = '';
  }
  $('pmClose').onclick = closeModal;
  $('prodModal').addEventListener('click', e => { if (e.target === $('prodModal')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('prodModal').hidden) closeModal(); });

  function renderCatalog() {
    const active = PRODUCTS.filter(p => p && p.active !== false);
    $('cntAll').textContent = active.length;
    $('cntInv').textContent = active.filter(p => p.category === 'inverter').length;
    $('cntPan').textContent = active.filter(p => p.category === 'panel').length;
    $('cntBat').textContent = active.filter(p => p.category === 'battery').length;
    if ($('cntAcc')) $('cntAcc').textContent = active.filter(p => p.category === 'accessory').length;

    const q = searchQ.trim().toLowerCase();
    const list = active.filter(p => {
      if (activeCat !== 'all' && p.category !== activeCat) return false;
      if (q && !(`${p.name} ${p.brand} ${p.note} ${p.description}`.toLowerCase().includes(q))) return false;
      return true;
    });

    const { tel, zalo } = getPrimaryContact();

    if (!list.length) {
      $('catalogGrid').innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--ink-3)">Không tìm thấy sản phẩm phù hợp.</div>';
      return;
    }

    $('catalogGrid').innerHTML = list.map((p, idx) => {
      const spec = p.category === 'inverter'
        ? `${p.powerKw} kW · ${esc(p.phase || '1 pha')}`
        : p.category === 'panel' ? `${p.wattWp} Wp`
        : p.category === 'battery' ? `${p.capacityKwh} kWh`
        : esc(p.specText || 'Phụ kiện');
      const img = esc(p.imageUrl || `/assets/prod-${p.category}.jpg`);
      const hasDocs = Boolean(p.datasheetUrl || (p.attachments && p.attachments.length));
      const sm = getStockMeta(p);
      return `<article class="card prod-card${sm.out ? ' out-of-stock' : ''}" data-open-prod="${idx}">
        <div class="prod-img-wrap">
          <img src="${img}" alt="${esc(p.name)}" loading="lazy">
          <span class="prod-cat-tag">${esc(CAT_LABEL[p.category] || p.category)}</span>
          ${hasDocs ? '<span class="prod-doc-badge">📄 Datasheet</span>' : ''}
          <span class="prod-stock-badge ${sm.cls}">${sm.badge}</span>
        </div>
        <div class="prod-body">
          <div class="prod-meta-top">
            ${p.brand ? `<span class="prod-brand">${esc(p.brand)}</span>` : '<span></span>'}
            <span class="prod-spec-pill">${spec}</span>
          </div>
          <h3 class="prod-name">${esc(p.name)}</h3>
          ${p.warranty ? `<div class="prod-detail">Bảo hành: <b>${esc(p.warranty)}</b></div>` : ''}
          ${p.description ? `<p class="prod-desc">${esc(p.description)}</p>` : (p.note ? `<div class="prod-detail">${esc(p.note)}</div>` : '')}
          <div class="prod-price-contact">
            <span>Giá bán:</span>
            <strong>Liên hệ để báo giá</strong>
          </div>
          <div class="prod-actions">
            <a class="cta-btn call" style="flex:1;justify-content:center" href="tel:${tel}" onclick="event.stopPropagation()">📞 Gọi ngay</a>
            ${zalo ? `<a class="cta-btn zalo" style="flex:1;justify-content:center" href="https://zalo.me/${zalo}" target="_blank" rel="noopener" onclick="event.stopPropagation()">💬 Zalo</a>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');

    $('catalogGrid').querySelectorAll('[data-open-prod]').forEach(card => {
      card.onclick = () => openProductModal(list[+card.dataset.openProd]);
    });
  }

  $('catPills').querySelectorAll('[data-cat]').forEach(btn => {
    btn.onclick = () => {
      $('catPills').querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.cat;
      renderCatalog();
    };
  });
  $('prodSearch').addEventListener('input', e => { searchQ = e.target.value; renderCatalog(); });

  Promise.all([
    fetch('/api/config').then(r => r.json()),
    fetch('/api/products').then(r => r.json())
  ]).then(([cfgData, prodData]) => {
    applyTheme(cfgData.config);
    PRODUCTS = Array.isArray(prodData.products) ? prodData.products : [];
    renderCatalog();
  }).catch(err => console.error(err));
})();
