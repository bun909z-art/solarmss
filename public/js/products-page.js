(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const SHADOW_MAP = {
    none: 'none',
    soft: '0 1px 3px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.04)',
    medium: '0 2px 6px rgba(15,23,42,.04), 0 12px 28px rgba(15,23,42,.07)',
    strong: '0 4px 12px rgba(15,23,42,.08), 0 20px 44px rgba(15,23,42,.14)'
  };
  const CAT_LABEL = { inverter: 'Inverter Hybrid', panel: 'Pin mặt trời', battery: 'Pin lưu trữ' };

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

  function renderCatalog() {
    const active = PRODUCTS.filter(p => p && p.active !== false);
    $('cntAll').textContent = active.length;
    $('cntInv').textContent = active.filter(p => p.category === 'inverter').length;
    $('cntPan').textContent = active.filter(p => p.category === 'panel').length;
    $('cntBat').textContent = active.filter(p => p.category === 'battery').length;

    const q = searchQ.trim().toLowerCase();
    const list = active.filter(p => {
      if (activeCat !== 'all' && p.category !== activeCat) return false;
      if (q && !(`${p.name} ${p.brand} ${p.note}`.toLowerCase().includes(q))) return false;
      return true;
    });

    const hotlines = (CFG && CFG.branding && CFG.branding.hotlines) || [];
    const primaryHl = hotlines[0] || { tel: '0913350597', zalo: '0913350597' };
    const tel = esc(primaryHl.tel || String(primaryHl.number || '').replace(/[^\d+]/g, ''));
    const zalo = esc(primaryHl.zalo !== undefined ? primaryHl.zalo : tel.replace(/[^\d]/g, ''));

    if (!list.length) {
      $('catalogGrid').innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--ink-3)">Không tìm thấy sản phẩm phù hợp.</div>';
      return;
    }

    $('catalogGrid').innerHTML = list.map(p => {
      const spec = p.category === 'inverter'
        ? `${p.powerKw} kW · ${esc(p.phase || '1 pha')}`
        : p.category === 'panel'
          ? `${p.wattWp} Wp`
          : `${p.capacityKwh} kWh`;
      const img = esc(p.imageUrl || `/assets/prod-${p.category}.jpg`);
      return `<article class="card prod-card">
        <div class="prod-img-wrap">
          <img src="${img}" alt="${esc(p.name)}" loading="lazy">
          <span class="prod-cat-tag">${esc(CAT_LABEL[p.category] || p.category)}</span>
        </div>
        <div class="prod-body">
          <div class="prod-meta-top">
            ${p.brand ? `<span class="prod-brand">${esc(p.brand)}</span>` : '<span></span>'}
            <span class="prod-spec-pill">${spec}</span>
          </div>
          <h3 class="prod-name">${esc(p.name)}</h3>
          ${p.warranty ? `<div class="prod-detail">Bảo hành: <b>${esc(p.warranty)}</b></div>` : ''}
          ${p.note ? `<div class="prod-detail">${esc(p.note)}</div>` : ''}
          ${p.description ? `<p class="prod-desc">${esc(p.description)}</p>` : ''}
          <div class="prod-price-contact">
            <span>Giá bán:</span>
            <strong>Liên hệ để báo giá</strong>
          </div>
          <div class="prod-actions">
            <a class="cta-btn call" style="flex:1;justify-content:center" href="tel:${tel}">📞 Gọi ngay</a>
            ${zalo ? `<a class="cta-btn zalo" style="flex:1;justify-content:center" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">💬 Báo giá Zalo</a>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
  }

  $('catPills').querySelectorAll('[data-cat]').forEach(btn => {
    btn.onclick = () => {
      $('catPills').querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.cat;
      renderCatalog();
    };
  });
  $('prodSearch').addEventListener('input', e => {
    searchQ = e.target.value;
    renderCatalog();
  });

  Promise.all([
    fetch('/api/config').then(r => r.json()),
    fetch('/api/products').then(r => r.json())
  ]).then(([cfgData, prodData]) => {
    applyTheme(cfgData.config);
    PRODUCTS = Array.isArray(prodData.products) ? prodData.products : [];
    renderCatalog();
  }).catch(err => console.error(err));
})();
