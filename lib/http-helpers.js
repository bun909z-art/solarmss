'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const store = require('./store');
const siteTheme = require('../public/js/site-theme');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function renderMaintenance404Html(cfg) {
  const m = (cfg && cfg.maintenance) || {};
  const b = (cfg && cfg.branding) || {};
  const t = (cfg && cfg.theme) || {};
  const pri = t.primary || '#F26A1B';
  const gradEnd = t.gradientEnd || '#FFB400';
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hotlines = Array.isArray(b.hotlines) ? b.hotlines : [];
  const hlHtml = hotlines.map(h => {
    const tel = esc(h.tel || String(h.number || '').replace(/[^\d+]/g, ''));
    const zalo = esc(h.zalo !== undefined ? h.zalo : tel.replace(/[^\d]/g, ''));
    return `<div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:8px">
      <a href="tel:${tel}" style="display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:999px;background:linear-gradient(135deg,${pri},${gradEnd});color:#fff;font-weight:800;font-size:14px;text-decoration:none">📞 ${esc(h.number)}</a>
      ${zalo ? `<a href="https://zalo.me/${zalo}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;background:#0068FF;color:#fff;font-weight:800;font-size:14px;text-decoration:none">💬 Chat Zalo</a>` : ''}
    </div>`;
  }).join('');
  const company = esc(b.companyName || 'Công Ty TNHH Mai Sơn Solar');
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.title || '404 — Hệ thống đang bảo trì')} – ${company}</title><link rel="icon" href="${esc(b.faviconUrl || '/assets/favicon.png?v=mss')}">
  <style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:radial-gradient(circle at 20% 20%,rgba(242,106,27,.12),transparent 40%),#0F172A;color:#F8FAFC}
  .box{width:100%;max-width:520px;background:rgba(30,41,59,.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:36px 28px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.45)}
  .code{font-size:64px;font-weight:900;line-height:1;background:linear-gradient(135deg,${pri},${gradEnd});-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px}
  .badge{display:inline-block;padding:5px 14px;border-radius:999px;background:rgba(242,106,27,.18);border:1px solid rgba(242,106,27,.4);color:#FDBA74;font-size:12px;font-weight:800;margin-bottom:14px}
  h1{margin:0 0 12px;font-size:23px;font-weight:900}p{margin:0 0 22px;font-size:14.5px;line-height:1.65;color:#CBD5E1}.co{margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);font-size:12.5px;color:#94A3B8;font-weight:700}</style></head>
  <body data-maintenance-page><div class="box"><div class="code">404</div><div class="badge">🔧 ĐANG BẢO TRÌ HỆ THỐNG</div><h1>${esc(m.title || 'Hệ thống đang bảo trì')}</h1><p>${esc(m.message || 'Website đang được nâng cấp. Vui lòng quay lại sau ít phút.')}</p>${hlHtml}<div class="co">${company}</div></div><script src="/js/live-updates.js?v=1"></script></body></html>`;
}

function getAllowedMaintenanceRoutes(m) {
  if (!m || !m.enabled) return null;
  if (m.mode === 'allow_page') {
    const valid = ['/', '/tuvan', '/products', '/news'];
    const arr = Array.isArray(m.allowedRoutes) && m.allowedRoutes.length
      ? m.allowedRoutes.filter(r => valid.includes(r))
      : (valid.includes(m.allowedRoute) ? [m.allowedRoute] : []);
    return arr;
  }
  return [];
}

function checkMaintenanceGate(req, res, pathname, parsedUrl) {
  if (pathname !== '/demo' && parsedUrl.searchParams.has('preview')) return false;
  const cfg = store.loadConfig();
  const m = cfg && cfg.maintenance;
  if (!m || !m.enabled) return false;
  const norm = pathname === '/home' || pathname === '/home.html' ? '/' :
               pathname === '/tuvan/' || pathname === '/index.html' ? '/tuvan' :
               pathname === '/products/' || pathname === '/products.html' ? '/products' :
               pathname === '/news/' || pathname === '/news.html' ? '/news' : pathname;
  const allowed = getAllowedMaintenanceRoutes(m);
  if (allowed && allowed.length > 0) {
    if (allowed.includes(norm)) return false;
    res.writeHead(302, { Location: allowed[0], 'Cache-Control': 'no-store' });
    res.end();
    return true;
  }
  const html = renderMaintenance404Html(cfg);
  const buf = Buffer.from(html, 'utf8');
  res.writeHead(404, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store'
  });
  res.end(buf);
  return true;
}

function serveThemedHtml(res, filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(resolved, 'utf8', (err, html) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    const cfg = store.loadConfig();
    const { variables, dark, coordinated } = siteTheme.resolve(cfg);
    const declarations = Object.entries(variables).map(([key, value]) => `${key}:${value}`).join(';');
    let out = html.replace('</head>', `<style id="hqServerTheme">:root{${declarations}}</style>\n</head>`);
    const metaColor = coordinated ? variables['--theme-band'] : variables['--primary'];
    out = out.replace(/<meta name="theme-color" content="[^"]*"/, `<meta name="theme-color" content="${metaColor}"`);
    const mt = cfg && cfg.maintenance;
    const allowed = getAllowedMaintenanceRoutes(mt);
    const isRestrict = Boolean(allowed && allowed.length > 0);
    if (isRestrict) {
      const blocked = ['/', '/tuvan', '/products', '/news', '/demo'].filter(r => !allowed.includes(r));
      let mCssRules = blocked.map(r => `.main-nav a[href="${r}"],.home-hero-actions a[href="${r}"],.home-more-link[href="${r}"]{display:none!important}`).join('');
      if (allowed.length <= 1) {
        mCssRules += '.main-nav{display:none!important}.topbar-inner{justify-content:space-between!important}#homeQuickGrid,.home-more-link{display:none!important}';
      }
      out = out.replace('</head>', `<style id="hqMaintCss">${mCssRules}</style>\n</head>`);
    }
    const demoOff = cfg.sections?.showSolarDemo === false;
    const bodyClasses = [dark && 'dark-mode', coordinated && 'coordinated-theme',
      demoOff && 'solar-demo-off', isRestrict && allowed.length <= 1 && 'maint-single-page'].filter(Boolean).join(' ');
    if (bodyClasses) out = out.replace('<body>', `<body class="${bodyClasses}">`);
    const buf = Buffer.from(out, 'utf8');
    res.writeHead(demoOff && path.basename(resolved) === 'demo.html' ? 404 : 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': buf.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(buf);
  });
}

function serveFile(res, filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(resolved, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const noCache = ['.html', '.css', '.js'].includes(ext);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': content.length,
      'Cache-Control': noCache ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
    });
    res.end(content);
  });
}

function requireAdmin(req, res, authState, requiredPerms = null) {
  const user = auth.getSessionUser(req, authState);
  if (!user) {
    sendJson(res, 401, { error: 'Vui lòng đăng nhập trang quản trị.' });
    return null;
  }
  if (requiredPerms && !auth.hasPermission(user, requiredPerms)) {
    sendJson(res, 403, { error: 'Tài khoản của bạn không có quyền thực hiện thao tác này.' });
    return null;
  }
  return user;
}

module.exports = {
  PUBLIC_DIR,
  UPLOAD_DIR,
  sendJson,
  readJsonBody,
  checkMaintenanceGate,
  serveThemedHtml,
  serveFile,
  requireAdmin
};
