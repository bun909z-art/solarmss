(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const SHADOW_MAP = {
    none: 'none',
    soft: '0 1px 3px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.04)',
    medium: '0 2px 6px rgba(15,23,42,.04), 0 12px 28px rgba(15,23,42,.07)',
    strong: '0 4px 12px rgba(15,23,42,.08), 0 20px 44px rgba(15,23,42,.14)'
  };
  const LIKES_KEY = 'hq_news_likes_v1';

  let CFG = null;
  let ARTICLES = [];
  let activeCat = 'all';
  let searchQ = '';
  let currentArticle = null;

  function getLikesMap() {
    try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}') || {}; } catch { return {}; }
  }
  function saveLikesMap(m) {
    try { localStorage.setItem(LIKES_KEY, JSON.stringify(m)); } catch {}
  }

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

  function formatDate(d) {
    if (!d) return '';
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  }

  function estimateReadMins(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 180));
  }

  function getPrimaryContact() {
    const hotlines = (CFG && CFG.branding && CFG.branding.hotlines) || [];
    const primaryHl = hotlines[0] || { tel: '0913350597', zalo: '0913350597' };
    const tel = esc(primaryHl.tel || String(primaryHl.number || '').replace(/[^\d+]/g, ''));
    const zalo = esc(primaryHl.zalo !== undefined ? primaryHl.zalo : tel.replace(/[^\d]/g, ''));
    return { tel, zalo };
  }

  
  function applyMaintenanceNav(cfg) {
    const mt = cfg && cfg.maintenance;
    const isRestrict = Boolean(mt && mt.enabled && mt.mode === 'allow_page');
    const allowed = (mt && Array.isArray(mt.allowedRoutes) && mt.allowedRoutes.length)
      ? mt.allowedRoutes
      : (mt && mt.allowedRoute ? [mt.allowedRoute] : ['/tuvan']);
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
      if (href && ['/', '/tuvan', '/products', '/news'].includes(href)) {
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
    if ($('heroSection') && cfg.hero && cfg.hero.style) $('heroSection').className = 'hero-banner style-' + cfg.hero.style;

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

  function updateReadProgress() {
    if ($('newsArticleView').hidden) return;
    const h = document.documentElement;
    const maxScroll = Math.max(1, h.scrollHeight - window.innerHeight);
    const pct = Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100));
    $('readProgressBar').style.width = pct.toFixed(1) + '%';
  }
  window.addEventListener('scroll', updateReadProgress, { passive: true });

  function updateLikeUI(artId) {
    const map = getLikesMap();
    const entry = map[artId] || { liked: false, count: 12 };
    $('btnLikeArt').classList.toggle('liked', Boolean(entry.liked));
    $('artLikeCount').textContent = entry.count;
  }

  function openStandaloneArticle(a, pushUrl = true) {
    if (!a) return;
    currentArticle = a;
    $('newsListView').hidden = true;
    $('newsArticleView').hidden = false;
    $('readProgressTrack').hidden = false;
    $('readProgressBar').style.width = '0%';

    document.title = `${a.title} – Hoàng Quân Electronics & Energy`;
    $('artCat').textContent = a.category || 'Tin tức';
    $('artDate').textContent = a.publishedAt ? '📅 ' + formatDate(a.publishedAt) : '';
    $('artAuthor').textContent = a.author ? '✍️ ' + a.author : '';
    $('artReadTime').textContent = `⏱ ~${estimateReadMins(a.content)} phút đọc`;
    $('artTitle').textContent = a.title || '';
    $('artSummary').textContent = a.summary || '';
    $('artSummary').hidden = !a.summary;
    $('artCover').src = a.imageUrl || '/assets/prod-panel.jpg';
    $('artCover').alt = a.title || '';

    const paras = String(a.content || '').split(/\r?\n\r?\n+/).map(p => p.trim()).filter(Boolean);
    $('artContent').innerHTML = paras.map(p => `<p>${esc(p).replace(/\r?\n/g, '<br>')}</p>`).join('') || '<p>Nội dung đang được cập nhật.</p>';

    updateLikeUI(a.id);

    const { tel, zalo } = getPrimaryContact();
    $('artActions').innerHTML = `
      <a class="cta-btn call" style="flex:1;justify-content:center" href="tel:${tel}">📞 Gọi ngay</a>
      ${zalo ? `<a class="cta-btn zalo" style="flex:1;justify-content:center" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">💬 Tư vấn Zalo</a>` : ''}
    `;

    // Related articles
    const related = ARTICLES.filter(x => x && x.published !== false && x.id !== a.id).slice(0, 3);
    $('relatedNewsWrap').hidden = !related.length;
    $('relatedNewsGrid').innerHTML = related.map((r, idx) => `
      <article class="card news-card" data-open-rel="${idx}">
        <div class="news-cover">
          <img src="${esc(r.imageUrl || '/assets/prod-panel.jpg')}" alt="${esc(r.title)}" loading="lazy">
          <span class="prod-cat-tag">${esc(r.category || 'Tin tức')}</span>
        </div>
        <div class="news-card-body">
          <div class="news-meta-line"><span>📅 ${esc(formatDate(r.publishedAt))}</span></div>
          <h3 class="news-title">${esc(r.title)}</h3>
          <div class="news-readmore">Đọc bài viết →</div>
        </div>
      </article>
    `).join('');
    $('relatedNewsGrid').querySelectorAll('[data-open-rel]').forEach(c => {
      c.onclick = () => openStandaloneArticle(related[+c.dataset.openRel], true);
    });

    if (pushUrl && window.history && window.history.pushState) {
      window.history.pushState({ articleId: a.id }, '', `/news?id=${encodeURIComponent(a.id)}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showNewsList(pushUrl = true) {
    currentArticle = null;
    $('newsArticleView').hidden = true;
    $('readProgressTrack').hidden = true;
    $('newsListView').hidden = false;
    document.title = 'Tin tức & Kiến thức – Hoàng Quân Electronics & Energy';
    if (pushUrl && window.history && window.history.pushState) {
      window.history.pushState({}, '', '/news');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('btnBackNews').onclick = () => showNewsList(true);
  if ($('navNewsLink')) {
    $('navNewsLink').addEventListener('click', e => {
      if (!$('newsArticleView').hidden) {
        e.preventDefault();
        showNewsList(true);
      }
    });
  }
  $('btnLikeArt').onclick = () => {
    if (!currentArticle) return;
    const map = getLikesMap();
    const entry = map[currentArticle.id] || { liked: false, count: 12 };
    entry.liked = !entry.liked;
    entry.count = Math.max(0, entry.count + (entry.liked ? 1 : -1));
    map[currentArticle.id] = entry;
    saveLikesMap(map);
    updateLikeUI(currentArticle.id);
  };

  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) {
      const found = ARTICLES.find(a => a.id === id);
      if (found) return openStandaloneArticle(found, false);
    }
    showNewsList(false);
  });

  function renderNews() {
    const pub = ARTICLES.filter(a => a && a.published !== false);
    if ($('ncntAll')) $('ncntAll').textContent = pub.length;

    const q = searchQ.trim().toLowerCase();
    const list = pub.filter(a => {
      if (activeCat !== 'all' && a.category !== activeCat) return false;
      if (q && !(`${a.title} ${a.summary} ${a.content} ${a.category}`.toLowerCase().includes(q))) return false;
      return true;
    });

    if (!list.length) {
      $('newsGrid').innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--ink-3)">Chưa có bài viết phù hợp.</div>';
      return;
    }

    $('newsGrid').innerHTML = list.map((a, idx) => `
      <article class="card news-card" data-open-news="${idx}">
        <div class="news-cover">
          <img src="${esc(a.imageUrl || '/assets/prod-panel.jpg')}" alt="${esc(a.title)}" loading="lazy">
          <span class="prod-cat-tag">${esc(a.category || 'Tin tức')}</span>
        </div>
        <div class="news-card-body">
          <div class="news-meta-line">
            <span>📅 ${esc(formatDate(a.publishedAt))}</span>
            ${a.author ? `<span>· ${esc(a.author)}</span>` : ''}
          </div>
          <h3 class="news-title">${esc(a.title)}</h3>
          ${a.summary ? `<p class="news-summary">${esc(a.summary)}</p>` : ''}
          <div class="news-readmore">Đọc bài viết →</div>
        </div>
      </article>
    `).join('');

    $('newsGrid').querySelectorAll('[data-open-news]').forEach(card => {
      card.onclick = () => openStandaloneArticle(list[+card.dataset.openNews], true);
    });
  }

  $('newsCatPills').querySelectorAll('[data-ncat]').forEach(btn => {
    btn.onclick = () => {
      $('newsCatPills').querySelectorAll('[data-ncat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.ncat;
      renderNews();
    };
  });
  $('newsSearch').addEventListener('input', e => { searchQ = e.target.value; renderNews(); });

  Promise.all([
    fetch('/api/config').then(r => r.json()),
    fetch('/api/news').then(r => r.json())
  ]).then(([cfgData, newsData]) => {
    applyTheme(cfgData.config);
    ARTICLES = Array.isArray(newsData.articles) ? newsData.articles : [];
    renderNews();
    const initialId = new URLSearchParams(window.location.search).get('id');
    if (initialId) {
      const found = ARTICLES.find(a => a.id === initialId);
      if (found) openStandaloneArticle(found, false);
    }
  }).catch(err => console.error(err));
})();
