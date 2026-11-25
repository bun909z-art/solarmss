'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const store = require('./lib/store');
const auth = require('./lib/auth');
const calc = require('./lib/calculator');
const productStore = require('./lib/products');
const newsStore = require('./lib/news');
const leadStore = require('./lib/leads');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
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
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip'
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

function readJsonBody(req, maxBytes = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}


const SSR_SHADOW_MAP = {
  none: 'none',
  soft: '0 1px 3px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.04)',
  medium: '0 2px 6px rgba(15,23,42,.04), 0 12px 28px rgba(15,23,42,.07)',
  strong: '0 4px 12px rgba(15,23,42,.08), 0 20px 44px rgba(15,23,42,.14)'
};

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

function checkMaintenanceGate(req, res, pathname, parsedUrl) {
  if (parsedUrl.searchParams.get('preview') === '1') return false;
  const cfg = store.loadConfig();
  const m = cfg && cfg.maintenance;
  if (!m || !m.enabled) return false;
  const norm = pathname === '/home' || pathname === '/home.html' ? '/' :
               pathname === '/tuvan/' || pathname === '/index.html' ? '/tuvan' :
               pathname === '/products/' || pathname === '/products.html' ? '/products' :
               pathname === '/news/' || pathname === '/news.html' ? '/news' : pathname;
  if (m.mode === 'allow_page') {
    const allowed = m.allowedRoute || '/tuvan';
    if (norm === allowed) return false;
    res.writeHead(302, { Location: allowed, 'Cache-Control': 'no-store' });
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
    const styleTag = buildServerThemeCss(cfg);
    let out = html.replace('</head>', `${styleTag}
</head>`);
    if (t.primary) {
      out = out.replace(/<meta name="theme-color" content="[^"]*"/, `<meta name="theme-color" content="${t.primary}"`);
    }
    if (t.darkMode) {
      out = out.replace('<body>', '<body class="dark-mode">');
    }
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
    res.writeHead(403);
    res.end('Forbidden');
    return;
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
      'Cache-Control': noCache ? 'no-cache, must-revalidate' : 'public, max-age=3600'
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

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();
    const authState = store.loadAuth();

    // ---------- PUBLIC API ----------
    if (pathname === '/api/config' && method === 'GET') {
      return sendJson(res, 200, {
        config: store.loadConfig(),
        presets: store.THEME_PRESETS
      });
    }

    if (pathname === '/api/calculate' && method === 'POST') {
      const body = await readJsonBody(req, 64 * 1024);
      const cfg = store.loadConfig();
  productStore.loadProducts();
  newsStore.loadNews();
  leadStore.loadLeads();
      const tiers = Array.isArray(body.tiers) ? body.tiers : cfg.tariffs.tiers;
      const mode = body.mode === 'kwh' ? 'kwh' : 'bill';
      const vat = (Number(body.vat ?? cfg.defaults.vat) || 0) / 100;
      const days = Math.min(31, Math.max(1, parseInt(body.days ?? cfg.defaults.days, 10) || 30));
      const eve = (Number(body.eve ?? cfg.defaults.eve) || 0) / 100;
      const dod = (Number(body.dod ?? cfg.defaults.dod) || 90) / 100;
      const eff = (Number(body.eff ?? cfg.defaults.eff) || 95) / 100;
      const mod = Number(body.mod ?? cfg.defaults.mod) || 5.12;

      let kwhExact = 0;
      let kwhUsed = 0;
      let billTotal = 0;
      if (mode === 'bill') {
        billTotal = Math.max(0, Number(body.bill) || 0);
        const pre = billTotal / (1 + vat);
        kwhExact = calc.kwhFromPreVat(pre, tiers);
        kwhUsed = Math.round(kwhExact);
      } else {
        kwhExact = Math.max(0, Number(body.kwh) || 0);
        kwhUsed = kwhExact;
        const pre = calc.preVatFromKwh(kwhUsed, tiers);
        billTotal = pre + Math.round(pre * vat);
      }

      const bat = calc.batteryKwh(kwhUsed, eve, dod, eff, days);
      const modules = kwhUsed > 0 && mod > 0 ? Math.max(1, Math.ceil(bat / mod - 1e-9)) : 0;
      const breakdown = calc.tierBreakdown(kwhUsed, tiers);
      return sendJson(res, 200, {
        mode,
        kwhExact,
        kwhUsed,
        billTotal,
        batteryKwh: bat,
        modules,
        totalModuleKwh: modules * mod,
        breakdown
      });
    }

    
    
    
    // ---------- CUSTOMER LEADS API ----------
    if (pathname === '/api/leads' && method === 'POST') {
      const body = await readJsonBody(req, 64 * 1024);
      const saved = leadStore.upsertLead(body);
      return sendJson(res, 200, { ok: true, lead: saved });
    }

    if (pathname === '/api/admin/leads' && method === 'GET') {
      if (!requireAdmin(req, res, authState, ['leads'])) return;
      return sendJson(res, 200, { leads: leadStore.loadLeads() });
    }

    if (pathname === '/api/admin/leads' && (method === 'PUT' || method === 'PATCH')) {
      if (!requireAdmin(req, res, authState, ['leads'])) return;
      const body = await readJsonBody(req, 64 * 1024);
      const updated = leadStore.updateLead(String(body.id || ''), body);
      if (!updated) return sendJson(res, 404, { error: 'Không tìm thấy khách hàng.' });
      return sendJson(res, 200, { ok: true, lead: updated });
    }

    if (pathname === '/api/admin/leads' && method === 'DELETE') {
      if (!requireAdmin(req, res, authState, ['leads'])) return;
      const body = await readJsonBody(req, 16 * 1024);
      const next = leadStore.deleteLead(String(body.id || ''));
      return sendJson(res, 200, { ok: true, leads: next });
    }

    if (pathname === '/api/admin/leads/export.csv' && method === 'GET') {
      if (!requireAdmin(req, res, authState, ['leads'])) return;
      const csv = leadStore.toLeadsCsv(leadStore.loadLeads());
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="khach-hang-tu-van-${new Date().toISOString().slice(0, 10)}.csv"`
      });
      res.end(csv);
      return;
    }

    // ---------- NEWS / ARTICLES API ----------
    if (pathname === '/api/news' && method === 'GET') {
      const all = newsStore.loadNews();
  leadStore.loadLeads();
      return sendJson(res, 200, { articles: all.filter(a => a.published !== false) });
    }

    if (pathname === '/api/admin/news' && method === 'GET') {
      if (!requireAdmin(req, res, authState, ['news'])) return;
      return sendJson(res, 200, { articles: newsStore.loadNews() });
    }

    if (pathname === '/api/admin/news' && (method === 'PUT' || method === 'POST')) {
      if (!requireAdmin(req, res, authState, ['news'])) return;
      const body = await readJsonBody(req, 3 * 1024 * 1024);
      const saved = newsStore.saveNews(body.articles || []);
      return sendJson(res, 200, { ok: true, articles: saved });
    }

    if (pathname === '/api/admin/news/reset' && method === 'POST') {
      if (!requireAdmin(req, res, authState, ['news'])) return;
      return sendJson(res, 200, { ok: true, articles: newsStore.resetNews() });
    }

    // ---------- PRODUCT CATALOG API ----------
    if (pathname === '/api/products' && method === 'GET') {
      return sendJson(res, 200, { products: productStore.loadProducts() });
    }

    if (pathname === '/api/admin/products' && (method === 'PUT' || method === 'POST')) {
      if (!requireAdmin(req, res, authState, ['products'])) return;
      const body = await readJsonBody(req, 2 * 1024 * 1024);
      const saved = productStore.saveProducts(body.products || []);
      return sendJson(res, 200, { ok: true, products: saved });
    }

    if (pathname === '/api/admin/products/import' && method === 'POST') {
      if (!requireAdmin(req, res, authState, ['products'])) return;
      const body = await readJsonBody(req, 2 * 1024 * 1024);
      const mode = body.mode === 'append' ? 'append' : 'replace';
      let incoming = [];
      if (body.format === 'xlsx') {
        incoming = productStore.parseProductsXlsx(body.base64 || '');
      } else if (body.format === 'csv') {
        incoming = productStore.parseProductsCsv(body.content || '');
      } else if (Array.isArray(body.products)) {
        incoming = body.products.map((p, i) => productStore.sanitizeProduct(p, i)).filter(Boolean);
      }
      if (!incoming.length) {
        return sendJson(res, 400, { error: 'Không tìm thấy sản phẩm hợp lệ trong tệp tải lên.' });
      }
      const next = mode === 'append' ? [...productStore.loadProducts(), ...incoming] : incoming;
      const saved = productStore.saveProducts(next);
      return sendJson(res, 200, { ok: true, count: incoming.length, products: saved });
    }

    if (pathname === '/api/admin/products/reset' && method === 'POST') {
      if (!requireAdmin(req, res, authState, ['products'])) return;
      return sendJson(res, 200, { ok: true, products: productStore.resetProducts() });
    }

    
    if (pathname === '/api/admin/products/template.xlsx' && method === 'GET') {
      const buf = productStore.toXlsxTemplate(productStore.loadProducts());
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="danh-muc-san-pham-mau.xlsx"',
        'Content-Length': buf.length
      });
      res.end(buf);
      return;
    }

    if (pathname === '/api/admin/products/template.csv' && method === 'GET') {
      const csv = productStore.toCsvTemplate(productStore.loadProducts());
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="danh-muc-san-pham-mau.csv"'
      });
      res.end(csv);
      return;
    }

    // ---------- ADMIN AUTH & USER MANAGEMENT API ----------
    if (pathname === '/api/admin/me' && method === 'GET') {
      const user = auth.getSessionUser(req, authState);
      return sendJson(res, 200, {
        authenticated: Boolean(user),
        username: user ? user.username : null,
        user: user || null
      });
    }

    if (pathname === '/api/admin/login' && method === 'POST') {
      const body = await readJsonBody(req, 16 * 1024);
      const username = String(body.username || 'admin').trim().toLowerCase();
      const password = String(body.password || '');
      const found = (authState.users || []).find(u => u && String(u.username).toLowerCase() === username);
      if (!found || !auth.verifyPassword(password, found.passwordHash)) {
        return sendJson(res, 401, { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
      }
      if (found.active === false) {
        return sendJson(res, 403, { error: 'Tài khoản này đang bị tạm khóa. Liên hệ Admin.' });
      }
      const token = auth.createSessionToken(authState.sessionSecret, found.username);
      auth.setSessionCookie(res, token, req);
      const safeUser = {
        username: found.username,
        displayName: found.displayName || found.username,
        role: found.role === 'admin' ? 'admin' : 'staff',
        permissions: found.role === 'admin' ? auth.ALL_PERMISSIONS.slice() : (Array.isArray(found.permissions) ? found.permissions : [])
      };
      return sendJson(res, 200, { ok: true, username: safeUser.username, user: safeUser, token });
    }

    if (pathname === '/api/admin/logout' && method === 'POST') {
      auth.clearSessionCookie(res, req);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/password' && method === 'POST') {
      const curUser = requireAdmin(req, res, authState);
      if (!curUser) return;
      const body = await readJsonBody(req, 16 * 1024);
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      const record = (authState.users || []).find(u => u && String(u.username).toLowerCase() === curUser.username.toLowerCase());
      if (!record || !auth.verifyPassword(currentPassword, record.passwordHash)) {
        return sendJson(res, 400, { error: 'Mật khẩu hiện tại không đúng.' });
      }
      if (newPassword.length < 6) {
        return sendJson(res, 400, { error: 'Mật khẩu mới cần tối thiểu 6 ký tự.' });
      }
      record.passwordHash = auth.hashPassword(newPassword);
      if (record.username === 'admin') authState.passwordHash = record.passwordHash;
      store.saveAuth(authState);
      return sendJson(res, 200, { ok: true, message: 'Đã cập nhật mật khẩu thành công.' });
    }

    // SUPER ADMIN ONLY: Manage user accounts & permissions
    if (pathname === '/api/admin/users' && method === 'GET') {
      if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return;
      const list = (authState.users || []).map(u => ({
        username: u.username,
        displayName: u.displayName || u.username,
        role: u.role === 'admin' ? 'admin' : 'staff',
        permissions: u.role === 'admin' ? auth.ALL_PERMISSIONS.slice() : (Array.isArray(u.permissions) ? u.permissions : []),
        active: u.active !== false,
        protected: Boolean(u.protected || String(u.username).toLowerCase() === 'admin'),
        createdAt: u.createdAt || ''
      }));
      return sendJson(res, 200, { users: list });
    }

    if (pathname === '/api/admin/users' && method === 'POST') {
      if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return;
      const body = await readJsonBody(req, 32 * 1024);
      const username = String(body.username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const displayName = String(body.displayName || username).trim().slice(0, 80);
      const password = String(body.password || '');
      const role = body.role === 'admin' ? 'admin' : 'staff';
      const permissions = role === 'admin'
        ? auth.ALL_PERMISSIONS.slice()
        : (Array.isArray(body.permissions) ? body.permissions.filter(p => auth.ALL_PERMISSIONS.includes(p)) : []);

      if (username.length < 3) return sendJson(res, 400, { error: 'Tên đăng nhập tối thiểu 3 ký tự (chữ thường, số, ., _, -).' });
      if (password.length < 6) return sendJson(res, 400, { error: 'Mật khẩu tối thiểu 6 ký tự.' });
      if ((authState.users || []).some(u => String(u.username).toLowerCase() === username)) {
        return sendJson(res, 400, { error: 'Tên đăng nhập đã tồn tại.' });
      }
      authState.users.push({
        username,
        displayName: displayName || username,
        passwordHash: auth.hashPassword(password),
        role,
        permissions,
        active: true,
        protected: false,
        createdAt: new Date().toISOString()
      });
      store.saveAuth(authState);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/users' && (method === 'PUT' || method === 'PATCH')) {
      if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return;
      const body = await readJsonBody(req, 32 * 1024);
      const target = String(body.username || '').trim().toLowerCase();
      const record = (authState.users || []).find(u => String(u.username).toLowerCase() === target);
      if (!record) return sendJson(res, 404, { error: 'Không tìm thấy tài khoản.' });
      const isRoot = Boolean(record.protected || target === 'admin');
      if (body.displayName !== undefined) record.displayName = String(body.displayName).trim().slice(0, 80) || record.username;
      if (!isRoot) {
        if (body.role !== undefined) record.role = body.role === 'admin' ? 'admin' : 'staff';
        if (body.active !== undefined) record.active = Boolean(body.active);
        if (Array.isArray(body.permissions)) {
          record.permissions = record.role === 'admin'
            ? auth.ALL_PERMISSIONS.slice()
            : body.permissions.filter(p => auth.ALL_PERMISSIONS.includes(p));
        }
      }
      if (body.newPassword && String(body.newPassword).length >= 6) {
        record.passwordHash = auth.hashPassword(String(body.newPassword));
        if (isRoot) authState.passwordHash = record.passwordHash;
      }
      store.saveAuth(authState);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/users' && method === 'DELETE') {
      const curUser = requireAdmin(req, res, authState, 'SUPER_ADMIN');
      if (!curUser) return;
      const body = await readJsonBody(req, 16 * 1024);
      const target = String(body.username || '').trim().toLowerCase();
      if (target === 'admin' || target === curUser.username.toLowerCase()) {
        return sendJson(res, 400, { error: 'Không thể xóa tài khoản Admin gốc hoặc tài khoản đang đăng nhập.' });
      }
      authState.users = (authState.users || []).filter(u => String(u.username).toLowerCase() !== target);
      store.saveAuth(authState);
      return sendJson(res, 200, { ok: true });
    }

    
    // ---------- FULL BACKUP & RESTORE + MAINTENANCE API ----------
    if (pathname === '/api/admin/backup-full' && method === 'GET') {
      if (!requireAdmin(req, res, authState, ['security'])) return;
      const payload = {
        version: 'hoangquan-full-backup-v1',
        exportedAt: new Date().toISOString(),
        config: store.loadConfig(),
        products: productStore.loadProducts(),
        news: newsStore.loadNews(),
        leads: leadStore.loadLeads()
      };
      const buf = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="hoangquan-full-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        'Content-Length': buf.length
      });
      res.end(buf);
      return;
    }

    if (pathname === '/api/admin/restore-full' && method === 'POST') {
      if (!requireAdmin(req, res, authState, ['security'])) return;
      const body = await readJsonBody(req, 12 * 1024 * 1024);
      if (body.config && typeof body.config === 'object') store.saveConfig(body.config);
      if (Array.isArray(body.products)) productStore.saveProducts(body.products);
      if (Array.isArray(body.news)) newsStore.saveNews(body.news);
      if (Array.isArray(body.leads)) {
        for (const l of body.leads) leadStore.upsertLead(l);
      }
      return sendJson(res, 200, {
        ok: true,
        config: store.loadConfig(),
        productsCount: productStore.loadProducts().length,
        newsCount: newsStore.loadNews().length,
        leadsCount: leadStore.loadLeads().length
      });
    }

    if (pathname === '/api/admin/maintenance' && (method === 'PUT' || method === 'POST')) {
      if (!requireAdmin(req, res, authState, ['security'])) return;
      const body = await readJsonBody(req, 32 * 1024);
      const updated = store.saveConfig({
        maintenance: {
          enabled: Boolean(body.enabled),
          mode: body.mode === 'allow_page' ? 'allow_page' : 'error404',
          allowedRoute: ['/', '/tuvan', '/products', '/news'].includes(body.allowedRoute) ? body.allowedRoute : '/tuvan',
          title: String(body.title || '404 — Hệ thống đang bảo trì').trim(),
          message: String(body.message || '').trim()
        }
      });
      return sendJson(res, 200, { ok: true, config: updated });
    }

    // ---------- ADMIN CONFIG API ----------
    if (pathname === '/api/admin/config' && (method === 'PUT' || method === 'POST')) {
      if (!requireAdmin(req, res, authState, ['branding', 'home', 'theme', 'layout', 'tariffs', 'footer'])) return;
      const body = await readJsonBody(req, 1024 * 1024);
      const updated = store.saveConfig(body);
      return sendJson(res, 200, { ok: true, config: updated });
    }

    if (pathname === '/api/admin/reset' && method === 'POST') {
      if (!requireAdmin(req, res, authState, ['branding', 'home', 'theme', 'layout', 'tariffs', 'footer'])) return;
      const updated = store.resetConfig();
      return sendJson(res, 200, { ok: true, config: updated });
    }

    
    
    if (pathname === '/api/admin/upload-document' && method === 'POST') {
      if (!requireAdmin(req, res, authState, ['products'])) return;
      const body = await readJsonBody(req, 16 * 1024 * 1024);
      const dataUrl = String(body.dataUrl || '');
      const origName = String(body.filename || 'tai-lieu.pdf').trim();
      const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return sendJson(res, 400, { error: 'Định dạng tệp tải lên không hợp lệ.' });
      const extFromName = (origName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const allowed = ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'webp', 'zip', 'txt'];
      const ext = allowed.includes(extFromName) ? extFromName : 'pdf';
      const buf = Buffer.from(match[2], 'base64');
      if (buf.length > 12 * 1024 * 1024) return sendJson(res, 400, { error: 'Tài liệu tối đa 12MB.' });
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const safeStem = origName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'doc';
      const fname = `doc-${Date.now()}-${safeStem}.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
      return sendJson(res, 200, { ok: true, url: `/uploads/${fname}`, name: origName });
    }

    if (pathname === '/api/admin/upload-product-image' && method === 'POST') {
      if (!requireAdmin(req, res, authState, ['products', 'news'])) return;
      const body = await readJsonBody(req, 3 * 1024 * 1024);
      const dataUrl = String(body.dataUrl || '');
      const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return sendJson(res, 400, { error: 'Chỉ hỗ trợ ảnh PNG, JPG, WebP hoặc SVG.' });
      const extMap = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', 'svg+xml': 'svg' };
      const buf = Buffer.from(match[2], 'base64');
      if (buf.length > 2 * 1024 * 1024) return sendJson(res, 400, { error: 'Ảnh sản phẩm tối đa 2MB.' });
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const fname = `prod-${Date.now()}.${extMap[match[1]]}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
      return sendJson(res, 200, { ok: true, imageUrl: `/uploads/${fname}` });
    }

    if (pathname === '/api/admin/upload-logo' && method === 'POST') {
      if (!requireAdmin(req, res, authState, ['branding'])) return;
      const body = await readJsonBody(req, 3 * 1024 * 1024);
      const dataUrl = String(body.dataUrl || '');
      const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        return sendJson(res, 400, { error: 'Chỉ hỗ trợ ảnh PNG, JPG, WebP hoặc SVG.' });
      }
      const extMap = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', 'svg+xml': 'svg' };
      const ext = extMap[match[1]];
      const buf = Buffer.from(match[2], 'base64');
      if (buf.length > 2 * 1024 * 1024) {
        return sendJson(res, 400, { error: 'Ảnh logo tối đa 2MB.' });
      }
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const filename = `logo-${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
      const logoUrl = `/uploads/${filename}`;
      const updated = store.saveConfig({ branding: { logoUrl } });
      return sendJson(res, 200, { ok: true, logoUrl, config: updated });
    }

    // ---------- PAGE & STATIC ROUTES ----------
    if (pathname === '/' || pathname === '/home' || pathname === '/home.html') {
      if (parsedUrl.searchParams.get('preview') === '1') {
        return serveThemedHtml(res, path.join(PUBLIC_DIR, 'index.html'));
      }
      if (checkMaintenanceGate(req, res, pathname, parsedUrl)) return;
      return serveThemedHtml(res, path.join(PUBLIC_DIR, 'home.html'));
    }
    if (pathname === '/tuvan' || pathname === '/tuvan/' || pathname === '/index.html') {
      if (checkMaintenanceGate(req, res, pathname, parsedUrl)) return;
      return serveThemedHtml(res, path.join(PUBLIC_DIR, 'index.html'));
    }
    if (pathname === '/products' || pathname === '/products/' || pathname === '/products.html') {
      if (checkMaintenanceGate(req, res, pathname, parsedUrl)) return;
      return serveThemedHtml(res, path.join(PUBLIC_DIR, 'products.html'));
    }
    if (pathname === '/news' || pathname === '/news/' || pathname === '/news.html') {
      if (checkMaintenanceGate(req, res, pathname, parsedUrl)) return;
      return serveThemedHtml(res, path.join(PUBLIC_DIR, 'news.html'));
    }
    if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin.html') {
      return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'));
    }

    const safeRel = pathname.replace(/^\/+/, '');
    const candidate = path.join(PUBLIC_DIR, safeRel);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return serveFile(res, candidate);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 - Không tìm thấy trang');
  } catch (err) {
    if (err.message === 'PAYLOAD_TOO_LARGE') {
      return sendJson(res, 413, { error: 'Dữ liệu tải lên quá lớn.' });
    }
    if (err.message === 'INVALID_JSON') {
      return sendJson(res, 400, { error: 'Dữ liệu JSON không hợp lệ.' });
    }
    console.error('[Server Error]', err);
    return sendJson(res, 500, { error: 'Lỗi máy chủ nội bộ.' });
  }
});

if (require.main === module) {
  store.loadAuth();
  store.loadConfig();
  productStore.loadProducts();
  newsStore.loadNews();
  leadStore.loadLeads();
  server.listen(PORT, HOST, () => {
    console.log(`Hoàng Quân Pin Hybrid Server đang chạy tại:`);
    console.log(`  • Trang chủ:      http://localhost:${PORT}/`);
    console.log(`  • Trang tư vấn:  http://localhost:${PORT}/tuvan`);
    console.log(`  • Trang quản trị: http://localhost:${PORT}/admin (Mật khẩu mặc định: admin123)`);
  });
}

module.exports = server;
