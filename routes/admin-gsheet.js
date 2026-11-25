'use strict';

const store = require('../lib/store');
const productStore = require('../lib/products');
const newsStore = require('../lib/news');
const leadStore = require('../lib/leads');
const gsheet = require('../lib/gsheet');
const { sendJson, readJsonBody, requireAdmin } = require('../lib/http-helpers');

let gsheetPullTimer = null;

function refreshGsheetAutoPull() {
  if (gsheetPullTimer) { clearInterval(gsheetPullTimer); gsheetPullTimer = null; }
  const cfg = store.loadConfig();
  const gs = cfg && cfg.gsheet;
  if (!gs || !gs.enabled || !gs.autoPullProducts || !gs.webhookUrl) return;
  const ms = Math.max(15, Math.min(3600, Number(gs.pullIntervalSec) || 60)) * 1000;
  gsheetPullTimer = setInterval(async () => {
    const cur = store.loadConfig();
    if (!cur.gsheet || !cur.gsheet.enabled || !cur.gsheet.autoPullProducts) return;
    const res = await gsheet.pullProductsFromSheet(cur.gsheet);
    if (res.ok && Array.isArray(res.products) && res.products.length) {
      productStore.saveProducts(res.products);
    }
  }, ms);
  if (gsheetPullTimer.unref) gsheetPullTimer.unref();
}

function triggerRealtimeSheetPush(type, data) {
  const cfg = store.loadConfig();
  const gs = cfg && cfg.gsheet;
  if (!gs || !gs.enabled || !gs.webhookUrl) return;
  if (type === 'lead' && gs.syncLeads !== false && data) {
    gsheet.postToSheet(gs, { action: 'upsert_lead', lead: data }, `Khách hàng: ${data.customerName || data.customerPhone || data.id}`).catch(() => {});
  } else if (type === 'products' && gs.syncProducts !== false) {
    gsheet.postToSheet(gs, { action: 'sync_products', products: data || [] }, `Kho sản phẩm (${(data || []).length} SP)`).catch(() => {});
  } else if (type === 'news' && gs.syncNews !== false) {
    gsheet.postToSheet(gs, { action: 'sync_news', articles: data || [] }, `Tin tức (${(data || []).length} bài)`).catch(() => {});
  }
}

async function handleAdminGsheet(req, res, pathname, method, authState) {
  if (pathname === '/api/admin/gsheet/status' && method === 'GET') {
    if (!requireAdmin(req, res, authState, ['gsheet'])) return true;
    const cfg = store.loadConfig();
    return sendJson(res, 200, {
      status: gsheet.getStatus(cfg),
      scriptTemplate: gsheet.APPS_SCRIPT_TEMPLATE
    }), true;
  }

  if (pathname === '/api/admin/gsheet/config' && (method === 'PUT' || method === 'POST')) {
    if (!requireAdmin(req, res, authState, ['gsheet'])) return true;
    const body = await readJsonBody(req, 32 * 1024);
    const updated = store.saveConfig({
      gsheet: {
        enabled: Boolean(body.enabled),
        webhookUrl: String(body.webhookUrl || '').trim(),
        secretKey: String(body.secretKey || '').trim(),
        syncLeads: body.syncLeads !== false,
        syncProducts: body.syncProducts !== false,
        syncNews: body.syncNews !== false,
        autoPullProducts: Boolean(body.autoPullProducts),
        pullIntervalSec: Math.max(15, Math.min(3600, Number(body.pullIntervalSec) || 60))
      }
    });
    refreshGsheetAutoPull();
    return sendJson(res, 200, { ok: true, config: updated, status: gsheet.getStatus(updated) }), true;
  }

  if (pathname === '/api/admin/gsheet/test' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['gsheet'])) return true;
    const body = await readJsonBody(req, 16 * 1024);
    const cfg = store.loadConfig();
    const testCfg = {
      webhookUrl: String(body.webhookUrl || (cfg.gsheet && cfg.gsheet.webhookUrl) || '').trim(),
      secretKey: String(body.secretKey !== undefined ? body.secretKey : ((cfg.gsheet && cfg.gsheet.secretKey) || '')).trim()
    };
    const result = await gsheet.postToSheet(testCfg, { action: 'ping' }, 'Kiểm tra kết nối');
    return sendJson(res, result.ok ? 200 : 400, { ...result, status: gsheet.getStatus(store.loadConfig()) }), true;
  }

  if (pathname === '/api/admin/gsheet/sync-all' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['gsheet'])) return true;
    const cfg = store.loadConfig();
    const gs = cfg.gsheet || {};
    const results = {};
    if (gs.syncLeads !== false) results.leads = await gsheet.postToSheet(gs, { action: 'sync_leads', leads: leadStore.loadLeads() }, 'Đồng bộ toàn bộ Khách hàng');
    if (gs.syncProducts !== false) results.products = await gsheet.postToSheet(gs, { action: 'sync_products', products: productStore.loadProducts() }, 'Đồng bộ toàn bộ Sản phẩm');
    if (gs.syncNews !== false) results.news = await gsheet.postToSheet(gs, { action: 'sync_news', articles: newsStore.loadNews() }, 'Đồng bộ toàn bộ Tin tức');
    const allOk = Object.values(results).every(r => r && r.ok);
    return sendJson(res, allOk ? 200 : 400, { ok: allOk, results, status: gsheet.getStatus(cfg) }), true;
  }

  if (pathname === '/api/admin/gsheet/pull-products' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['gsheet'])) return true;
    const cfg = store.loadConfig();
    const resPull = await gsheet.pullProductsFromSheet(cfg.gsheet || {});
    if (!resPull.ok) return sendJson(res, 400, { ok: false, error: resPull.error, status: gsheet.getStatus(cfg) }), true;
    const saved = resPull.products.length ? productStore.saveProducts(resPull.products) : productStore.loadProducts();
    return sendJson(res, 200, { ok: true, count: resPull.products.length, products: saved, status: gsheet.getStatus(cfg) }), true;
  }

  return false;
}

module.exports = {
  handleAdminGsheet,
  triggerRealtimeSheetPush,
  refreshGsheetAutoPull
};
