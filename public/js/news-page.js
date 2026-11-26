(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const LIKES_KEY = 'hq_news_likes_v1';

  let CFG = null;

  function pageTitle(label) {
    return `${label} – ${CFG?.branding?.companyName || 'Công Ty TNHH Mai Sơn Solar'}`;
  }
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

    if ($('newsArticleView').hidden) document.title = pageTitle('Tin tức & Kiến thức');
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

  function updateReadProgress() {
    if ($('newsArticleView').hidden) return;
    const article = $('newsArticleView').querySelector('.article-full').getBoundingClientRect();
    const headerHeight = document.querySelector('.topbar').offsetHeight;
    const maxScroll = Math.max(1, article.height - (window.innerHeight - headerHeight));
    const pct = Math.min(100, Math.max(0, ((headerHeight - article.top) / maxScroll) * 100));
    $('readProgressBar').style.width = pct.toFixed(1) + '%';
  }
  window.addEventListener('scroll', updateReadProgress, { passive: true });
  window.addEventListener('resize', updateReadProgress);

  function updateLikeUI(artId) {
    const map = getLikesMap();
    const entry = map[artId] || { liked: false, count: 12 };
    $('btnLikeArt').classList.toggle('liked', Boolean(entry.liked));
    $('btnLikeArt').setAttribute('aria-pressed', Boolean(entry.liked));
    $('artLikeCount').textContent = entry.count;
  }

  function renderArticleGrid(grid, articles, showSummary) {
    grid.innerHTML = articles.map((article, index) => `
      <article class="card news-card" data-article-index="${index}">
        <div class="news-cover">
          <img src="${esc(article.imageUrl || '/assets/prod-panel.jpg')}" alt="" loading="lazy">
          <span class="prod-cat-tag">${esc(article.category || 'Tin tức')}</span>
        </div>
        <div class="news-card-body">
          <div class="news-meta-line">
            ${article.publishedAt ? `<time datetime="${esc(article.publishedAt)}">${esc(formatDate(article.publishedAt))}</time>` : ''}
            ${article.author ? `<span>${esc(article.author)}</span>` : ''}
          </div>
          <h3 class="news-title"><a href="/news?id=${encodeURIComponent(article.id)}">${esc(article.title)}</a></h3>
          ${showSummary && article.summary ? `<p class="news-summary">${esc(article.summary)}</p>` : ''}
        </div>
      </article>
    `).join('');
    grid.onclick = event => {
      const card = event.target.closest('[data-article-index]');
      if (!card || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openStandaloneArticle(articles[Number(card.dataset.articleIndex)]);
    };
  }

  function openStandaloneArticle(a, pushUrl = true, keepPosition = false) {
    if (!a) return;
    currentArticle = a;
    $('newsListView').hidden = true;
    $('newsArticleView').hidden = false;
    $('readProgressTrack').hidden = false;
    $('readProgressBar').style.width = '0%';

    document.title = pageTitle(a.title);
    $('artCat').textContent = a.category || 'Tin tức';
    $('artDate').textContent = a.publishedAt ? formatDate(a.publishedAt) : '';
    $('artDate').dateTime = a.publishedAt || '';
    $('artDate').hidden = !a.publishedAt;
    $('artAuthor').textContent = a.author || '';
    $('artAuthor').hidden = !a.author;
    $('artReadTime').textContent = `${estimateReadMins(a.content)} phút đọc`;
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
      <a class="cta-btn call" href="tel:${tel}">Gọi kỹ thuật</a>
      ${zalo ? `<a class="cta-btn zalo" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">Nhắn Zalo</a>` : ''}
    `;

    // Related articles
    const related = ARTICLES.filter(x => x && x.published !== false && x.id !== a.id).slice(0, 3);
    $('relatedNewsWrap').hidden = !related.length;
    renderArticleGrid($('relatedNewsGrid'), related, false);

    if (pushUrl && window.history && window.history.pushState) {
      window.history.pushState({ articleId: a.id }, '', `/news?id=${encodeURIComponent(a.id)}`);
    }
    if (pushUrl) $('artTitle').focus({ preventScroll: true });
    if (!keepPosition) window.scrollTo({ top: 0, behavior: 'instant' });
    updateReadProgress();
  }

  function showNewsList(pushUrl = true) {
    currentArticle = null;
    $('newsArticleView').hidden = true;
    $('readProgressTrack').hidden = true;
    $('newsListView').hidden = false;
    document.title = pageTitle('Tin tức & Kiến thức');
    if (pushUrl && window.history && window.history.pushState) {
      window.history.pushState({}, '', '/news');
    }
    if (pushUrl) $('newsResultsTitle').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
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

    $('newsResultsTitle').textContent = activeCat === 'all' ? 'Tất cả bài viết' : activeCat;
    $('newsCount').textContent = `${list.length} bài viết`;
    $('newsCatPills').querySelectorAll('[data-ncat]').forEach(btn => {
      const selected = btn.dataset.ncat === activeCat;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-pressed', selected);
    });
    const grid = $('newsGrid');
    grid.classList.toggle('journal-featured', activeCat === 'all' && !q);
    renderArticleGrid(grid, list, true);
    if (!list.length) grid.innerHTML = '<p class="card subpage-empty">Không tìm thấy bài viết phù hợp. Thử từ khóa hoặc chủ đề khác.</p>';
  }

  $('newsCatPills').querySelectorAll('[data-ncat]').forEach(btn => {
    btn.onclick = () => {
      activeCat = btn.dataset.ncat;
      renderNews();
    };
  });
  $('newsSearch').addEventListener('input', e => { searchQ = e.target.value; renderNews(); });

  HQLive.watch(['config', 'news'], ({ config, news }, changed) => {
    if (changed.has('config')) applyTheme(config);
    if (!news) return;
    ARTICLES = news;
    renderNews();
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return;
    const found = ARTICLES.find(a => a.id === id);
    if (found) openStandaloneArticle(found, false, !$('newsArticleView').hidden);
    else {
      history.replaceState({}, '', '/news');
      showNewsList(false);
    }
  }, (failures, snapshot) => {
    if (failures.includes('news') && !snapshot.news) $('newsCount').textContent = 'Chưa tải được bài viết. Đang thử lại…';
  });
})();
