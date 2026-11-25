(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const SHADOW_MAP = {
    none: 'none',
    soft: '0 1px 3px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.04)',
    medium: '0 2px 6px rgba(15,23,42,.04), 0 12px 28px rgba(15,23,42,.07)',
    strong: '0 4px 12px rgba(15,23,42,.08), 0 20px 44px rgba(15,23,42,.14)'
  };

  let CFG = null;
  let ARTICLES = [];
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

  function formatDate(d) {
    if (!d) return '';
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
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

  function openArticleModal(a) {
    if (!a) return;
    $('nmCover').src = a.imageUrl || '/assets/prod-panel.jpg';
    $('nmCover').alt = a.title || '';
    $('nmCat').textContent = a.category || 'Tin tức';
    $('nmDate').textContent = a.publishedAt ? '📅 ' + formatDate(a.publishedAt) : '';
    $('nmAuthor').textContent = a.author ? '✍️ ' + a.author : '';
    $('nmTitle').textContent = a.title || '';
    $('nmSummary').textContent = a.summary || '';
    $('nmSummary').hidden = !a.summary;
    const paras = String(a.content || '').split(/\r?\n\r?\n+/).map(p => p.trim()).filter(Boolean);
    $('nmContent').innerHTML = paras.map(p => `<p>${esc(p).replace(/\r?\n/g, '<br>')}</p>`).join('') || '<p>Nội dung đang được cập nhật.</p>';

    const { tel, zalo } = getPrimaryContact();
    $('nmActions').innerHTML = `
      <a class="cta-btn call" style="flex:1;justify-content:center" href="tel:${tel}">📞 Gọi ngay</a>
      ${zalo ? `<a class="cta-btn zalo" style="flex:1;justify-content:center" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">💬 Tư vấn Zalo</a>` : ''}
    `;
    $('newsModal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeNewsModal() {
    $('newsModal').hidden = true;
    document.body.style.overflow = '';
  }
  $('nmClose').onclick = closeNewsModal;
  $('newsModal').addEventListener('click', e => { if (e.target === $('newsModal')) closeNewsModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('newsModal').hidden) closeNewsModal(); });

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
      card.onclick = () => openArticleModal(list[+card.dataset.openNews]);
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
  }).catch(err => console.error(err));
})();
