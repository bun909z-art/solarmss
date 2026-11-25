'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const store = require('./store');

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

const SSR_SHADOW_MAP = {
  none: 'none',
  soft: '0 1px 3px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.04)',
  medium: '0 2px 6px rgba(15,23,42,.04), 0 12px 28px rgba(15,23,42,.07)',
  strong: '0 4px 12px rgba(15,23,42,.08), 0 20px 44px rgba(15,23,42,.14)'
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

function hexRgba(hex, alpha) {
  const clean = String(hex || '#F26A1B').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (isNaN(n)) return `rgba(242,106,27,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function buildServerThemeCss(cfg) {
  const t = (cfg && cfg.theme) || {};
  const b = (cfg && cfg.branding) || {};
  const pri = t.primary || '#F26A1B';
  const dark = Boolean(t.darkMode);
  const vars = [
    `--primary:${pri}`,
    `--primary-deep:${t.primaryDeep || '#D9560B'}`,
    `--grad-end:${t.gradientEnd || '#FFB400'}`,
    `--primary-soft:${hexRgba(pri, dark ? 0.18 : 0.10)}`,
    `--primary-line:${hexRgba(pri, dark ? 0.42 : 0.28)}`,
    `--primary-glow:${hexRgba(pri, dark ? 0.45 : 0.30)}`,
    `--bg:${t.bg || '#F3F5F9'}`,
    `--card:${t.cardBg || '#FFFFFF'}`,
    `--ink:${t.ink || '#111827'}`,
    `--ink-2:${t.inkMuted || '#4B5563'}`,
    `--day:${t.dayColor || '#F59E0B'}`,
    `--night:${t.nightColor || '#1D4ED8'}`,
    `--radius:${Number(t.radius) || 18}px`,
    `--max-width:${Number(t.maxWidth) || 1160}px`,
    `--logo-h:${Number(b.logoHeight) || 54}px`,
    `--shadow:${SSR_SHADOW_MAP[t.shadowLevel] || SSR_SHADOW_MAP.medium}`
  ];
  return `<style id="hqServerTheme">:root{${vars.join(';')}}</style>`;
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
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.title || '404 — Hệ thống đang bảo trì')}</title>
  <style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:radial-gradient(circle at 20% 20%,rgba(242,106,27,.12),transparent 40%),#0F172A;color:#F8FAFC}
  .box{width:100%;max-width:520px;background:rgba(30,41,59,.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:36px 28px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.45)}
  .code{font-size:64px;font-weight:900;line-height:1;background:linear-gradient(135deg,${pri},${gradEnd});-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px}
  .badge{display:inline-block;padding:5px 14px;border-radius:999px;background:rgba(242,106,27,.18);border:1px solid rgba(242,106,27,.4);color:#FDBA74;font-size:12px;font-weight:800;margin-bottom:14px}
  h1{margin:0 0 12px;font-size:23px;font-weight:900}p{margin:0 0 22px;font-size:14.5px;line-height:1.65;color:#CBD5E1}.co{margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);font-size:12.5px;color:#94A3B8;font-weight:700}</style></head>
  <body><div class="box"><div class="code">404</div><div class="badge">🔧 ĐANG BẢO TRÌ HỆ THỐNG</div><h1>${esc(m.title || 'Hệ thống đang bảo trì')}</h1><p>${esc(m.message || 'Website đang được nâng cấp. Vui lòng quay lại sau ít phút.')}</p>${hlHtml}<div class="co">${esc(b.companyName || 'CTY HOÀNG QUÂN – Electronics & Energy')}</div></div></body></html>`;
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
  if (parsedUrl.searchParams.has('preview')) return false;
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
    const t = (cfg && cfg.theme) || {};
    let out = html.replace('</head>', `${buildServerThemeCss(cfg)}\n</head>`);
    if (t.primary) out = out.replace(/<meta name="theme-color" content="[^"]*"/, `<meta name="theme-color" content="${t.primary}"`);
    const mt = cfg && cfg.maintenance;
    const allowed = getAllowedMaintenanceRoutes(mt);
    const isRestrict = Boolean(allowed && allowed.length > 0);
    if (isRestrict) {
      const blocked = ['/', '/tuvan', '/products', '/news'].filter(r => !allowed.includes(r));
      let mCssRules = blocked.map(r => `.main-nav a[href="${r}"]{display:none!important}`).join('');
      if (allowed.length <= 1) {
        mCssRules += '.main-nav{display:none!important}.topbar-inner{justify-content:space-between!important}#homeQuickGrid,.home-more-link{display:none!important}';
      }
      out = out.replace('</head>', `<style id="hqMaintCss">${mCssRules}</style>\n</head>`);
    }
    const bodyClasses = [t.darkMode ? 'dark-mode' : '', (isRestrict && allowed.length <= 1) ? 'maint-single-page' : ''].filter(Boolean).join(' ');
    if (bodyClasses) out = out.replace('<body>', `<body class="${bodyClasses}">`);
    const buf = Buffer.from(out, 'utf8');
    res.writeHead(200, {
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
