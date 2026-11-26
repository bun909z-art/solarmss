(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const CAT_LABEL = {
    inverter: 'Inverter Hybrid',
    panel: 'Pin mặt trời',
    battery: 'Pin lưu trữ',
    accessory: 'Phụ kiện lắp đặt'
  };

  let CFG = null;

  function pageTitle(label) {
    return `${label} – ${CFG?.branding?.companyName || 'Công Ty TNHH Mai Sơn Solar'}`;
  }
  let PRODUCTS = [];
  let activeCat = 'all';
  let searchQ = '';

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function normalizeSearch(value) {
    return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/đ/g, 'd').trim();
  }

  function getPrimaryContact() {
    const hotlines = (CFG && CFG.branding && CFG.branding.hotlines) || [];
    const primaryHl = hotlines[0] || { tel: '0913350597', zalo: '0913350597' };
    const tel = esc(primaryHl.tel || String(primaryHl.number || '').replace(/[^\d+]/g, ''));
    const zalo = esc(primaryHl.zalo !== undefined ? primaryHl.zalo : tel.replace(/[^\d]/g, ''));
    return { tel, zalo };
  }

  function getStockMeta(p) {
    const st = p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock');
    if (st === 'out_of_stock') return { cls: 'out-stock', label: 'Hết hàng', badge: '● Hết hàng', out: true };
    if (st === 'contact') return { cls: 'contact-stock', label: 'Liên hệ', badge: '● Liên hệ', out: false };
    return { cls: 'in-stock', label: 'Còn hàng', badge: '● Còn hàng', out: false };
  }

  function getSpecText(p) {
    if (p.category === 'inverter') return `${p.powerKw} kW · ${p.phase || '1 pha'}`;
    if (p.category === 'panel') return `${p.wattWp} Wp`;
    if (p.category === 'battery') return `${p.capacityKwh} kWh`;
    return p.specText || 'Phụ kiện lắp đặt';
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
    document.querySelectorAll('a.home-quick-card, a.home-more-link, a.art-tool-btn.primary-outline').forEach(el => {
      const href = el.getAttribute('href');
      if (href && ['/', '/tuvan', '/products', '/news', '/demo'].includes(href)) {
        el.hidden = isRestrict && !allowed.includes(href);
      }
    });
    const qg = document.getElementById('homeQuickGrid');
    if (qg && isRestrict) {
      const visCards = Array.from(qg.querySelectorAll('a.home-quick-card')).filter(x => !x.hidden);
      if (!visCards.length) qg.hidden = true;
      else qg.style.gridTemplateColumns = `repeat(${Math.min(3, visCards.length)}, minmax(0, 1fr))`;
    } else if (qg) {
      qg.style.gridTemplateColumns = '';
    }
  }

  function applyTheme(cfg) {
    applyMaintenanceNav(cfg);
    CFG = cfg;
    const b = cfg.branding || {}, f = cfg.footer || {};
    SiteTheme.apply(cfg);
    $('heroSection').dataset.style = cfg.hero?.style || 'gradient';

    if ($('prodDetailView').hidden) document.title = pageTitle('Sản phẩm tham khảo');
    $('brandLogo').src = b.logoUrl || '/assets/logo-default.jpg?v=mss';
    $('brandLogo').alt = b.companyName || 'Công Ty TNHH Mai Sơn Solar';
    $('docFavicon').href = b.faviconUrl || '/assets/favicon.png?v=mss';
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

  function renderCardHtml(p, index) {
    const { tel, zalo } = getPrimaryContact();
    const spec = esc(getSpecText(p));
    const img = esc(p.imageUrl || `/assets/prod-${p.category}.jpg`);
    const hasDocs = Boolean(p.datasheetUrl || (p.attachments && p.attachments.length));
    const sm = getStockMeta(p);
    return `<article class="card prod-card${sm.out ? ' out-of-stock' : ''}" data-product-index="${index}">
      <div class="prod-img-wrap">
        <img src="${img}" alt="" loading="lazy">
        <span class="prod-cat-tag">${esc(CAT_LABEL[p.category] || p.category)}</span>
        ${hasDocs ? '<span class="prod-doc-badge">Tài liệu kỹ thuật</span>' : ''}
        <span class="prod-stock-badge ${sm.cls}">${sm.badge}</span>
      </div>
      <div class="prod-body">
        <div class="prod-meta-top">
          ${p.brand ? `<span class="prod-brand">${esc(p.brand)}</span>` : '<span></span>'}
          <span class="prod-spec-pill">${spec}</span>
        </div>
        <h3 class="prod-name"><a class="product-detail-link" href="/products?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        ${p.warranty ? `<div class="prod-detail">Bảo hành: <b>${esc(p.warranty)}</b></div>` : ''}
        ${p.description ? `<p class="prod-desc">${esc(p.description)}</p>` : (p.note ? `<div class="prod-detail">${esc(p.note)}</div>` : '')}
        <div class="prod-price-contact">
          <span>Giá bán:</span>
          <strong>Liên hệ để báo giá</strong>
        </div>
        <div class="prod-actions">
          <a class="cta-btn call" href="tel:${tel}">Gọi báo giá</a>
          ${zalo ? `<a class="cta-btn zalo" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">Zalo</a>` : ''}
        </div>
      </div>
    </article>`;
  }

  function renderProductGrid(grid, products) {
    grid.innerHTML = products.map(renderCardHtml).join('');
    grid.onclick = event => {
      const card = event.target.closest('[data-product-index]');
      if (!card) return;
      const link = event.target.closest('a');
      if (link && (!link.matches('.product-detail-link') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
      event.preventDefault();
      openStandaloneProduct(products[Number(card.dataset.productIndex)]);
    };
  }

  function openStandaloneProduct(p, pushUrl = true, keepPosition = false) {
    if (!p) return;
    $('prodListView').hidden = true;
    $('prodDetailView').hidden = false;
    document.title = pageTitle(p.name);

    const sm = getStockMeta(p);
    $('pdBreadcrumb').textContent = `${CAT_LABEL[p.category] || p.category}${p.brand ? ' / ' + p.brand : ''}`;
    $('pdImg').src = p.imageUrl || `/assets/prod-${p.category}.jpg`;
    $('pdImg').alt = p.name || '';
    $('pdStockBadge').textContent = sm.badge;
    $('pdStockBadge').className = 'prod-stock-badge ' + sm.cls;
    $('pdBrand').textContent = `${CAT_LABEL[p.category] || p.category}${p.brand ? ' · ' + p.brand : ''}`;
    $('pdSpecPill').textContent = getSpecText(p);
    $('pdTitle').textContent = p.name || '';
    $('pdDesc').textContent = p.description || p.note || '';
    $('pdDesc').hidden = !(p.description || p.note);
    $('pdWarranty').textContent = p.warranty ? `Bảo hành ${p.warranty}` : '';
    $('pdWarranty').hidden = !p.warranty;

    // Specs table
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
    $('pdSpecsBody').innerHTML = rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');

    // Datasheet & Attachments (hidden if empty)
    const docs = [];
    if (p.datasheetUrl) docs.push({ label: p.datasheetName || 'Tải Datasheet (Thông số kỹ thuật)', url: p.datasheetUrl, primary: true });
    if (Array.isArray(p.attachments)) {
      p.attachments.forEach(a => { if (a && a.url) docs.push({ label: a.name || 'Tài liệu đính kèm', url: a.url, primary: false }); });
    }
    $('pdDocsWrap').hidden = !docs.length;
    $('pdDocsList').innerHTML = docs.length
      ? docs.map(d => `<a class="doc-dl-btn${d.primary ? '' : ' secondary'}" href="${esc(d.url)}" download target="_blank" rel="noopener">${d.primary ? '📄' : '📎'} ${esc(d.label)}</a>`).join('')
      : '';

    const { tel, zalo } = getPrimaryContact();
    $('pdActions').innerHTML = `
      <a class="cta-btn call" href="tel:${tel}">Gọi báo giá</a>
      ${zalo ? `<a class="cta-btn zalo" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">Nhắn Zalo</a>` : ''}
    `;

    // Related products in same category
    const related = PRODUCTS.filter(x => x && x.active !== false && x.id !== p.id && x.category === p.category).slice(0, 3);
    $('relatedProdsWrap').hidden = !related.length;
    renderProductGrid($('relatedProdsGrid'), related);

    if (pushUrl && window.history && window.history.pushState) {
      window.history.pushState({ prodId: p.id }, '', `/products?id=${encodeURIComponent(p.id)}`);
    }
    if (pushUrl) $('pdTitle').focus({ preventScroll: true });
    if (!keepPosition) window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function showProductList(pushUrl = true) {
    $('prodDetailView').hidden = true;
    $('prodListView').hidden = false;
    document.title = pageTitle('Sản phẩm tham khảo');
    if (pushUrl && window.history && window.history.pushState) {
      window.history.pushState({}, '', '/products');
    }
    if (pushUrl) $('catalogResultsTitle').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  $('btnBackProds').onclick = () => showProductList(true);
  if ($('navProductsLink')) {
    $('navProductsLink').addEventListener('click', e => {
      if (!$('prodDetailView').hidden) {
        e.preventDefault();
        showProductList(true);
      }
    });
  }

  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) {
      const found = PRODUCTS.find(p => p.id === id && p.active !== false);
      if (found) return openStandaloneProduct(found, false);
    }
    showProductList(false);
  });

  function renderCatalog() {
    const active = PRODUCTS.filter(p => p && p.active !== false);
    $('cntAll').textContent = active.length;
    $('cntInv').textContent = active.filter(p => p.category === 'inverter').length;
    $('cntPan').textContent = active.filter(p => p.category === 'panel').length;
    $('cntBat').textContent = active.filter(p => p.category === 'battery').length;
    if ($('cntAcc')) $('cntAcc').textContent = active.filter(p => p.category === 'accessory').length;

    const terms = normalizeSearch(searchQ).split(/\s+/).filter(Boolean);
    const list = active.filter(p => {
      if (activeCat !== 'all' && p.category !== activeCat) return false;
      if (!terms.length) return true;
      const text = normalizeSearch([p.id, p.name, p.brand, p.note, p.description, p.specs].join(' '));
      return terms.every(term => text.includes(term));
    });

    $('catalogResultsTitle').textContent = activeCat === 'all' ? 'Tất cả thiết bị' : CAT_LABEL[activeCat];
    $('catalogCount').textContent = `${list.length} sản phẩm`;
    $('catPills').querySelectorAll('[data-cat]').forEach(btn => {
      const selected = btn.dataset.cat === activeCat;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-pressed', selected);
    });
    const grid = $('catalogGrid');
    renderProductGrid(grid, list);
    if (!list.length) grid.innerHTML = '<p class="card subpage-empty">Không tìm thấy sản phẩm phù hợp. Thử từ khóa hoặc nhóm thiết bị khác.</p>';
  }

  $('catPills').querySelectorAll('[data-cat]').forEach(btn => {
    btn.onclick = () => {
      activeCat = btn.dataset.cat;
      renderCatalog();
    };
  });
  $('prodSearch').addEventListener('input', e => { searchQ = e.target.value; renderCatalog(); });

  HQLive.watch(['config', 'products'], ({ config, products }, changed) => {
    if (changed.has('config')) applyTheme(config);
    if (!products) return;
    PRODUCTS = products;
    renderCatalog();
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return;
    const found = PRODUCTS.find(p => p.id === id && p.active !== false);
    if (found) openStandaloneProduct(found, false, !$('prodDetailView').hidden);
    else {
      history.replaceState({}, '', '/products');
      showProductList(false);
    }
  }, (failures, snapshot) => {
    if (failures.includes('products') && !snapshot.products) $('catalogCount').textContent = 'Chưa tải được danh mục. Đang thử lại…';
  });
})();
