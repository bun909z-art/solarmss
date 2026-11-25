(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const SHADOW_MAP = {
    none: 'none',
    soft: '0 1px 3px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.04)',
    medium: '0 2px 6px rgba(15,23,42,.04), 0 12px 28px rgba(15,23,42,.07)',
    strong: '0 4px 12px rgba(15,23,42,.08), 0 20px 44px rgba(15,23,42,.14)'
  };
  const CAT_LABEL = {
    inverter: 'Inverter Hybrid',
    panel: 'Pin mặt trời',
    battery: 'Pin lưu trữ',
    accessory: 'Phụ kiện lắp đặt'
  };

  let CFG = null;
  let ALL_ARTICLES = [];
  let ALL_PRODUCTS = [];
  let SLIDES = [];
  let slideIdx = 0;
  let autoTimer = null;

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

  function fmtDate(d) {
    if (!d) return '';
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  }

  function getStockMeta(p) {
    const st = p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock');
    if (st === 'out_of_stock') return { cls: 'out-stock', badge: '● Hết hàng', out: true };
    if (st === 'contact') return { cls: 'contact-stock', badge: '● Liên hệ', out: false };
    return { cls: 'in-stock', badge: '● Còn hàng', out: false };
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
    r.setProperty('--primary-glow', hexToRgba(t.primary || '#F26A1B', t.darkMode ? 0.45 : 0.30));
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

    const hm = cfg.home || {};
    r.setProperty('--hero-slide-h', (Number(hm.sliderHeight) || 430) + 'px');
    if ($('homeSliderSection')) $('homeSliderSection').hidden = hm.showSlider === false;
    if ($('homeSliderKicker')) $('homeSliderKicker').textContent = hm.sliderKicker || '★ Nổi bật';
    if ($('homeSliderTitle')) $('homeSliderTitle').textContent = hm.sliderTitle || 'Tin tức & Dự án nổi bật';
    if ($('homeQuickGrid')) {
      $('homeQuickGrid').hidden = hm.showQuickCards === false;
      if (Array.isArray(hm.quickCards) && hm.quickCards.length) {
        $('homeQuickGrid').innerHTML = hm.quickCards.map((c, idx) => `
          <a href="${esc(c.href || (idx === 0 ? '/tuvan' : idx === 1 ? '/products' : '/news'))}" class="card home-quick-card${c.primary || idx === 0 ? ' primary-card' : ''}">
            <div class="hq-icon">${esc(c.icon || '⚡')}</div>
            <h3>${esc(c.title || '')}</h3>
            <p>${esc(c.desc || '')}</p>
            <span class="news-readmore">${esc(c.cta || 'Xem ngay →')}</span>
          </a>
        `).join('');
      }
    }
    if ($('homeProdsSection')) $('homeProdsSection').hidden = hm.showFeaturedProducts === false;
    if ($('homeProdsKicker')) $('homeProdsKicker').textContent = hm.productsKicker || 'Thiết bị chính hãng';
    if ($('homeProdsTitle')) $('homeProdsTitle').textContent = hm.productsTitle || 'Sản phẩm tiêu biểu';
    if ($('contactCtaCard')) $('contactCtaCard').hidden = hm.showContactCta === false;
  }

  function scrollToSlide(idx) {
    const track = $('featuredSliderTrack');
    if (!track || !SLIDES.length) return;
    slideIdx = ((idx % SLIDES.length) + SLIDES.length) % SLIDES.length;
    const card = track.children[slideIdx];
    if (card) {
      track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    }
    updateDots();
  }

  function updateDots() {
    $('sliderDots').querySelectorAll('.slider-dot').forEach((d, i) => {
      d.classList.toggle('active', i === slideIdx);
    });
  }

  function startAutoSlide() {
    stopAutoSlide();
    if (SLIDES.length <= 1) return;
    const hm = (CFG && CFG.home) || {};
    if (hm.autoSlide === false) return;
    const ms = Math.max(2000, Math.min(15000, (Number(hm.sliderIntervalSec) || 4.5) * 1000));
    autoTimer = setInterval(() => scrollToSlide(slideIdx + 1), ms);
  }
  function stopAutoSlide() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  function renderSlider(articles) {
    const pub = (articles || []).filter(a => a && a.published !== false);
    const featured = pub.filter(a => a.featured !== false);
    SLIDES = featured.length ? featured : pub.slice(0, 6);
    const track = $('featuredSliderTrack');
    if (!SLIDES.length) {
      track.innerHTML = '<div class="card" style="width:100%;text-align:center;color:var(--ink-3)">Chưa có bài viết nổi bật nào.</div>';
      $('sliderDots').innerHTML = '';
      return;
    }

    track.innerHTML = SLIDES.map(a => `
      <a class="featured-slide-card" href="/news?id=${encodeURIComponent(a.id)}">
        <div class="fslide-img">
          <img src="${esc(a.imageUrl || '/assets/prod-panel.jpg')}" alt="${esc(a.title)}">
          <span class="prod-cat-tag">${esc(a.category || 'Tin tức')}</span>
        </div>
        <div class="fslide-body">
          <div class="fslide-badge-row"><span>★ ${esc(a.category || 'Tin tức')}</span><span>·</span><span>📅 ${esc(fmtDate(a.publishedAt))}</span></div>
          <h3>${esc(a.title)}</h3>
          ${a.summary ? `<p>${esc(a.summary)}</p>` : ''}
          <span class="fslide-cta">Đọc bài viết →</span>
        </div>
      </a>
    `).join('');

    $('sliderDots').innerHTML = SLIDES.map((_, i) =>
      `<button type="button" class="slider-dot${i === 0 ? ' active' : ''}" data-sdot="${i}" aria-label="Bài ${i + 1}"></button>`
    ).join('');
    $('sliderDots').querySelectorAll('[data-sdot]').forEach(btn => {
      btn.onclick = () => { scrollToSlide(+btn.dataset.sdot); startAutoSlide(); };
    });

    track.addEventListener('mouseenter', stopAutoSlide);
    track.addEventListener('mouseleave', startAutoSlide);
    track.addEventListener('touchstart', stopAutoSlide, { passive: true });
    track.addEventListener('scroll', () => {
      const cards = Array.from(track.children);
      if (!cards.length) return;
      const curLeft = track.scrollLeft;
      let best = 0, bestDist = Infinity;
      cards.forEach((c, i) => {
        const dist = Math.abs((c.offsetLeft - track.offsetLeft) - curLeft);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      if (best !== slideIdx) { slideIdx = best; updateDots(); }
    }, { passive: true });

    startAutoSlide();
  }

  function renderFeaturedProducts(products) {
    const active = (products || []).filter(p => p && p.active !== false);
    const maxP = Number((CFG && CFG.home && CFG.home.productsCount) || 4);
    const picks = [];
    for (const cat of ['inverter', 'panel', 'battery', 'accessory']) {
      const found = active.find(p => p.category === cat);
      if (found) picks.push(found);
    }
    for (const p of active) {
      if (picks.length >= maxP) break;
      if (!picks.some(x => x.id === p.id)) picks.push(p);
    }
    picks.splice(maxP);
    const grid = $('homeProdsGrid');
    if (!picks.length) {
      grid.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--ink-3)">Chưa có sản phẩm nào.</div>';
      return;
    }
    grid.innerHTML = picks.map(p => {
      const spec = p.category === 'inverter' ? `${p.powerKw} kW · ${esc(p.phase || '1 pha')}`
        : p.category === 'panel' ? `${p.wattWp} Wp`
        : p.category === 'battery' ? `${p.capacityKwh} kWh`
        : esc(p.specText || 'Phụ kiện');
      const sm = getStockMeta(p);
      return `<a class="card prod-card${sm.out ? ' out-of-stock' : ''}" href="/products?id=${encodeURIComponent(p.id)}" style="text-decoration:none;color:inherit">
        <div class="prod-img-wrap">
          <img src="${esc(p.imageUrl || '/assets/prod-' + p.category + '.jpg')}" alt="${esc(p.name)}" loading="lazy">
          <span class="prod-cat-tag">${esc(CAT_LABEL[p.category] || p.category)}</span>
          <span class="prod-stock-badge ${sm.cls}">${sm.badge}</span>
        </div>
        <div class="prod-body">
          <div class="prod-meta-top">
            <span class="prod-brand">${esc(p.brand || '')}</span>
            <span class="prod-spec-pill">${spec}</span>
          </div>
          <h3 class="prod-name">${esc(p.name)}</h3>
          <div class="prod-price-contact"><span>Giá bán:</span><strong>Liên hệ để báo giá</strong></div>
        </div>
      </a>`;
    }).join('');
  }

  $('slidePrev').onclick = () => { scrollToSlide(slideIdx - 1); startAutoSlide(); };
  $('slideNext').onclick = () => { scrollToSlide(slideIdx + 1); startAutoSlide(); };

  Promise.all([
    fetch('/api/config').then(r => r.json()),
    fetch('/api/news').then(r => r.json()),
    fetch('/api/products').then(r => r.json())
  ]).then(([cfgData, newsData, prodData]) => {
    ALL_ARTICLES = newsData.articles || [];
    ALL_PRODUCTS = prodData.products || [];
    applyTheme(cfgData.config);
    renderSlider(ALL_ARTICLES);
    renderFeaturedProducts(ALL_PRODUCTS);
  }).catch(err => console.error(err));

  window.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'HQ_PREVIEW_CONFIG') return;
    if (e.data.config) {
      applyTheme(e.data.config);
      renderSlider(ALL_ARTICLES);
      renderFeaturedProducts(ALL_PRODUCTS);
    }
  });
})();
