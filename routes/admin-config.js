'use strict';

const store = require('../lib/store');
const productStore = require('../lib/products');
const newsStore = require('../lib/news');
const path = require('path');
const leadStore = require('../lib/leads');
const updater = require('../lib/updater');
const { sendJson, readJsonBody, requireAdmin } = require('../lib/http-helpers');

async function handleAdminConfig(req, res, pathname, method, authState) {
  if (pathname === '/api/admin/config' && (method === 'PUT' || method === 'POST')) {
    const user = requireAdmin(req, res, authState, ['branding', 'home', 'theme', 'layout', 'tariffs', 'footer']);
    if (!user) return true;
    const body = await readJsonBody(req, 1024 * 1024);
    let patch = body;
    if (user.role !== 'admin') {
      const perms = Array.isArray(user.permissions) ? user.permissions : [];
      patch = {};
      if (perms.includes('branding') && body.branding) patch.branding = body.branding;
      if (perms.includes('home') && body.home) patch.home = body.home;
      if (perms.includes('theme') && body.theme) patch.theme = body.theme;
      if ((perms.includes('theme') || perms.includes('layout')) && body.hero) patch.hero = body.hero;
      if (perms.includes('layout') && body.sections) patch.sections = body.sections;
      if (perms.includes('tariffs')) {
        if (body.defaults) patch.defaults = body.defaults;
        if (body.tariffs) patch.tariffs = body.tariffs;
      }
      if (perms.includes('footer') && body.footer) patch.footer = body.footer;
    }
    const updated = store.saveConfig(patch);
    return sendJson(res, 200, { ok: true, config: store.getPublicConfig(updated) }), true;
  }

  if (pathname === '/api/admin/reset' && method === 'POST') {
    if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return true;
    const updated = store.resetConfig();
    return sendJson(res, 200, { ok: true, config: store.getPublicConfig(updated) }), true;
  }

  if (pathname === '/api/admin/maintenance' && (method === 'PUT' || method === 'POST')) {
    if (!requireAdmin(req, res, authState, ['security'])) return true;
    const body = await readJsonBody(req, 32 * 1024);
    const valid = ['/', '/tuvan', '/products', '/news'];
    const allowedRoutes = Array.isArray(body.allowedRoutes)
      ? body.allowedRoutes.filter(r => valid.includes(r))
      : (valid.includes(body.allowedRoute) ? [body.allowedRoute] : []);
    const mode = (body.mode === 'allow_page' && allowedRoutes.length > 0) ? 'allow_page' : 'error404';
    const updated = store.saveConfig({
      maintenance: {
        enabled: Boolean(body.enabled),
        mode,
        allowedRoute: allowedRoutes[0] || '/tuvan',
        allowedRoutes,
        title: '404 — Hệ thống đang bảo trì',
        message: 'Website đang được nâng cấp và bảo trì định kỳ. Quý khách vui lòng quay lại sau ít phút hoặc liên hệ hotline bên dưới để được hỗ trợ ngay.'
      }
    });
    return sendJson(res, 200, { ok: true, config: store.getPublicConfig(updated) }), true;
  }

  if (pathname === '/api/admin/backup-full' && method === 'GET') {
    if (!requireAdmin(req, res, authState, ['security'])) return true;
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
    return true;
  }

  if (pathname === '/api/admin/update-package' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['security'])) return true;
    const body = await readJsonBody(req, 30 * 1024 * 1024);
    if (!body || !body.base64) {
      return sendJson(res, 400, { error: 'Thiếu dữ liệu tệp ZIP tải lên.' }), true;
    }
    try {
      const appRoot = path.resolve(__dirname, '..');
      const result = updater.applyZipUpdate(body.base64, appRoot, { store, productStore, newsStore, leadStore });
      sendJson(res, 200, { ok: true, ...result });
      if (body.autoRestart && result.needsRestart && process.env.HQ_DISABLE_AUTO_EXIT !== '1') {
        setTimeout(() => { process.exit(0); }, 1200);
      }
      return true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Gói ZIP không hợp lệ hoặc không thể giải nén.' }), true;
    }
  }

  if (pathname === '/api/admin/restore-full' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['security'])) return true;
    const body = await readJsonBody(req, 25 * 1024 * 1024);
    const updatedSections = [];
    if (Array.isArray(body)) {
      productStore.saveProducts(body);
      updatedSections.push(`Kho sản phẩm (${body.length})`);
    } else if (body && typeof body === 'object') {
      if (body.config && typeof body.config === 'object') {
        store.saveConfig(body.config);
        updatedSections.push('Cấu hình giao diện');
      } else if (body.branding || body.theme || body.hero || body.home || body.tariffs || body.sections || body.footer) {
        store.saveConfig(body);
        updatedSections.push('Cấu hình giao diện');
      }
      if (Array.isArray(body.products)) {
        productStore.saveProducts(body.products);
        updatedSections.push(`Kho sản phẩm (${body.products.length})`);
      }
      if (Array.isArray(body.news)) {
        newsStore.saveNews(body.news);
        updatedSections.push(`Tin tức (${body.news.length})`);
      }
      if (Array.isArray(body.leads)) {
        const restored = body.leads.filter(lead => leadStore.upsertLead(lead, { restoring: true })).length;
        updatedSections.push(`Khách hàng (${restored})`);
      }
    }
    if (!updatedSections.length) {
      return sendJson(res, 400, { error: 'Tệp JSON không chứa dữ liệu cấu hình, sản phẩm, tin tức hay khách hàng hợp lệ.' }), true;
    }
    return sendJson(res, 200, {
      ok: true,
      updatedSections,
      config: store.loadConfig(),
      productsCount: productStore.loadProducts().length,
      newsCount: newsStore.loadNews().length,
      leadsCount: leadStore.loadLeads().length
    }), true;
  }

  return false;
}

module.exports = { handleAdminConfig };
