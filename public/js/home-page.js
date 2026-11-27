(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const CAT_LABEL = {
    inverter: 'Inverter Hybrid',
    panel: 'Pin mặt trời',
    battery: 'Pin lưu trữ',
    accessory: 'Phụ kiện lắp đặt'
  };
  const DEMO_CARD = {
    icon: '🏡', title: 'Thiết kế điện mặt trời 3D',
    desc: 'Tự bố trí tấm pin trên mái, chọn thiết bị và mô phỏng lượng điện theo giờ.',
    cta: 'Mở Demo 3D', href: '/demo'
  };

  let CFG = null;
  let ALL_PRODUCTS = [];
  let SLIDES = [];
  let slideIdx = 0;
  let autoTimer = null;
  let scrollTimer;
  let pointerOverSlider = false;
  let touchingSlider = false;

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  
  function applyMaintenanceNav(cfg) {
    const allowed = HQLive.maintenanceRoutes(cfg);
    const isRestrict = Boolean(allowed?.length);
    const nav = document.querySelector('.main-nav');
    if (nav) {
      let visibleCount = 0;
      nav.querySelectorAll('a.nav-link').forEach(a => {
        const href = a.getAttribute('href') || '/';
        const show = !isRestrict || allowed.includes(href);
        a.hidden = !show;
        if (show) visibleCount++;
      });
      nav.hidden = isRestrict && visibleCount <= 1;
    }
    document.body.classList.toggle('maint-single-page', isRestrict && allowed.length <= 1);
    document.querySelectorAll('.home-hero-actions a, a.home-quick-card, a.home-more-link').forEach(el => {
      const href = el.getAttribute('href');
      if (href && ['/', '/tuvan', '/products', '/news', '/demo'].includes(href)) {
        el.hidden = (isRestrict && !allowed.includes(href)) || (href === '/demo' && cfg.sections?.showSolarDemo === false);
      }
    });
    const quickGrid = $('homeQuickGrid');
    if (!quickGrid.querySelector('a:not([hidden])')) quickGrid.hidden = true;
  }

  function applyTheme(cfg) {
    CFG = cfg;
    const b = cfg.branding || {}, f = cfg.footer || {};
    SiteTheme.apply(cfg);

    const company = b.companyName || 'Công Ty TNHH Mai Sơn Solar';
    document.title = `Trang chủ – ${company}`;
    $('brandLogo').src = b.logoUrl || '/assets/logo-default.jpg?v=mss';
    $('brandLogo').alt = company;
    $('docFavicon').href = b.faviconUrl || '/assets/favicon.png?v=mss';
    $('hotlineWrap').hidden = b.showHotline === false;
    $('hotlineLabel').textContent = b.hotlineLabel || 'Hotline tư vấn';
    const hotlines = Array.isArray(b.hotlines) ? b.hotlines : [];
    $('hotlineList').innerHTML = hotlines.map(x => `<a href="tel:${esc(x.tel || x.number)}">${esc(x.number)}</a>`).join('');

    renderSiteContact(f, cfg.home?.showContactCta !== false);
    $('footerCompany').textContent = f.companyLine || b.companyName || '';

    const hm = cfg.home || {};
    document.documentElement.style.setProperty('--hero-slide-h', (Number(hm.sliderHeight) || 430) + 'px');
    slider.hidden = hm.showSlider === false || SLIDES.length === 0;
    if ($('homeSliderKicker')) $('homeSliderKicker').textContent = hm.sliderKicker || '★ Nổi bật';
    if ($('homeSliderTitle')) $('homeSliderTitle').textContent = hm.sliderTitle || 'Tin tức & Dự án nổi bật';
    const quickGrid = $('homeQuickGrid');
    const cards = Array.isArray(hm.quickCards) ? hm.quickCards : [];
    const showDemoCard = hm.showQuickDemo === true && cfg.sections?.showSolarDemo !== false;
    const quickCards = showDemoCard && !cards.some(card => card.href === '/demo') ? [...cards, DEMO_CARD] : cards;
    quickGrid.hidden = hm.showQuickCards === false;
    quickGrid.innerHTML = quickCards.map((c, idx) => `
      <a href="${esc(c.href || (idx === 0 ? '/tuvan' : idx === 1 ? '/products' : '/news'))}" class="card home-quick-card">
        <div class="hq-icon" aria-hidden="true">${esc(c.icon || '⚡')}</div>
        <h3>${esc(c.title || '')}</h3>
        <p>${esc(c.desc || '')}</p>
        <span class="news-readmore">${esc((c.cta || 'Xem ngay').replace(/\s*→\s*$/, ''))}</span>
      </a>
    `).join('');
    if ($('homeProdsSection')) $('homeProdsSection').hidden = hm.showFeaturedProducts === false;
    if ($('homeProdsKicker')) $('homeProdsKicker').textContent = hm.productsKicker || 'Thiết bị chính hãng';
    if ($('homeProdsTitle')) $('homeProdsTitle').textContent = hm.productsTitle || 'Sản phẩm tiêu biểu';
    applyMaintenanceNav(cfg);
  }

  function scrollToSlide(idx, behavior = reducedMotion.matches ? 'instant' : 'smooth') {
    if (!SLIDES.length) return;
    slideIdx = ((idx % SLIDES.length) + SLIDES.length) % SLIDES.length;
    const card = track.children[slideIdx];
    if (card) {
      track.scrollTo({ left: card.offsetLeft, behavior });
    }
    updateDots();
  }

  function updateDots() {
    $('sliderDots').querySelectorAll('.slider-dot').forEach((d, i) => {
      if (i === slideIdx) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
  }

  function startAutoSlide() {
    stopAutoSlide();
    if (SLIDES.length <= 1 || reducedMotion.matches || slider.hidden || document.hidden ||
        pointerOverSlider || touchingSlider || slider.matches(':focus-within')) return;
    const hm = (CFG && CFG.home) || {};
    if (hm.autoSlide === false) return;
    const ms = Math.max(2000, Math.min(15000, (Number(hm.sliderIntervalSec) || 4.5) * 1000));
    autoTimer = setInterval(() => scrollToSlide(slideIdx + 1), ms);
  }
  function stopAutoSlide() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  function renderSlider(articles) {
    SLIDES = (articles || []).filter(a => a && a.published !== false && a.featured !== false);
    slideIdx = 0;
    slider.hidden = CFG?.home?.showSlider === false || !SLIDES.length;
    $('sliderControls').hidden = SLIDES.length <= 1;
    clearTimeout(scrollTimer);
    stopAutoSlide();

    track.innerHTML = SLIDES.map(a => `
      <a class="featured-slide-card" href="/news?id=${encodeURIComponent(a.id)}">
        <div class="fslide-img">
          <img src="${esc(a.imageUrl || '/assets/solar-home.jpg')}" alt="" loading="lazy">
        </div>
        <div class="fslide-body">
          <div class="fslide-badge-row"><span>${esc(a.category || 'Tin tức')}</span>${a.publishedAt ? `<span>${esc(fmtDate(a.publishedAt))}</span>` : ''}</div>
          <h3>${esc(a.title)}</h3>
          ${a.summary ? `<p>${esc(a.summary)}</p>` : ''}
          <span class="fslide-cta">Đọc bài viết</span>
        </div>
      </a>
    `).join('');

    $('sliderDots').innerHTML = SLIDES.map((_, i) =>
      `<button type="button" class="slider-dot" data-sdot="${i}" aria-label="Bài ${i + 1}"></button>`
    ).join('');
    $('sliderDots').querySelectorAll('[data-sdot]').forEach(btn => {
      btn.onclick = () => { scrollToSlide(+btn.dataset.sdot); startAutoSlide(); };
    });

    scrollToSlide(0, 'instant');
    startAutoSlide();
  }

  function renderFeaturedProducts(products) {
    const active = (products || []).filter(p => p && p.active !== false);
    const stockRank = product => {
      const status = getStockMeta(product);
      return status.out ? 2 : status.cls === 'contact-stock' ? 1 : 0;
    };
    const maxP = Number((CFG && CFG.home && CFG.home.productsCount) || 4);
    const picks = [];
    const categories = ['inverter', 'panel', 'battery', 'accessory'];
    for (const rank of [0, 1, 2]) {
      const ranked = active.filter(p => stockRank(p) === rank);
      for (const cat of categories) {
        const found = ranked.find(p => p.category === cat);
        if (found) picks.push(found);
      }
      for (const p of ranked) {
        if (picks.length >= maxP) break;
        if (!picks.some(x => x.id === p.id)) picks.push(p);
      }
      if (picks.length >= maxP) break;
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

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.addEventListener('change', startAutoSlide);
  const slider = $('homeSliderSection');
  document.addEventListener('visibilitychange', startAutoSlide);
  slider.addEventListener('pointerenter', e => {
    if (e.pointerType === 'touch') return;
    pointerOverSlider = true;
    stopAutoSlide();
  });
  slider.addEventListener('pointerleave', e => {
    if (e.pointerType === 'touch') return;
    pointerOverSlider = false;
    startAutoSlide();
  });
  slider.addEventListener('touchstart', () => {
    touchingSlider = true;
    stopAutoSlide();
  }, { passive: true });
  for (const eventName of ['touchend', 'touchcancel']) {
    slider.addEventListener(eventName, () => {
      touchingSlider = false;
      startAutoSlide();
    }, { passive: true });
  }
  slider.addEventListener('focusin', stopAutoSlide);
  slider.addEventListener('focusout', e => {
    if (!slider.contains(e.relatedTarget)) requestAnimationFrame(startAutoSlide);
  });
  const track = $('featuredSliderTrack');
  track.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (!SLIDES.length || !track.clientWidth) return;
      slideIdx = Math.max(0, Math.min(SLIDES.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
      updateDots();
    }, 120);
  }, { passive: true });
  $('slidePrev').onclick = () => { scrollToSlide(slideIdx - 1); startAutoSlide(); };
  $('slideNext').onclick = () => { scrollToSlide(slideIdx + 1); startAutoSlide(); };

  let previewConfig = null;
  HQLive.watch(['config', 'news', 'products'], ({ config, news, products }, changed) => {
    if (changed.has('products')) ALL_PRODUCTS = products;
    if (changed.has('config')) applyTheme(previewConfig || config);
    if (changed.has('news')) renderSlider(news);
    else if (changed.has('config')) startAutoSlide();
    if (changed.has('config') || changed.has('products')) renderFeaturedProducts(ALL_PRODUCTS);
  });

  window.addEventListener('message', e => {
    if (!new URLSearchParams(location.search).has('preview') || e.origin !== location.origin ||
        e.source !== window.parent || e.data?.type !== 'HQ_PREVIEW_CONFIG') return;
    if (e.data.config) {
      previewConfig = e.data.config;
      applyTheme(previewConfig);
      startAutoSlide();
      renderFeaturedProducts(ALL_PRODUCTS);
    }
  });
})();
