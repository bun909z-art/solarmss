'use strict';

const store = require('../lib/store');
const productStore = require('../lib/products');
const newsStore = require('../lib/news');
const leadStore = require('../lib/leads');
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
    return sendJson(res, 200, { ok: true, config: updated }), true;
  }

  if (pathname === '/api/admin/reset' && method === 'POST') {
    if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return true;
    const updated = store.resetConfig();
    return sendJson(res, 200, { ok: true, config: updated }), true;
  }

  if (pathname === '/api/admin/maintenance' && (method === 'PUT' || method === 'POST')) {
    if (!requireAdmin(req, res, authState, ['security'])) return true;
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
    return sendJson(res, 200, { ok: true, config: updated }), true;
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

  if (pathname === '/api/admin/restore-full' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['security'])) return true;
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
    }), true;
  }

  return false;
}

module.exports = { handleAdminConfig };
