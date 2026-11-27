'use strict';

const store = require('../lib/store');
const leadStore = require('../lib/leads');
const gsheet = require('../lib/gsheet');
const { sendJson, readJsonBody, requireAdmin } = require('../lib/http-helpers');

function triggerRealtimeSheetPush(lead) {
  const gs = store.loadConfig().gsheet;
  if (!gs?.enabled || !gs.webhookUrl || gs.syncLeads === false) return;
  gsheet.postToSheet(gs, { action: 'upsert_lead', lead }, 'Hồ sơ tư vấn').catch(() => {});
}

async function handleAdminGsheet(req, res, pathname, method, authState) {
  if (pathname === '/api/admin/gsheet/config' && method === 'GET') {
    if (!requireAdmin(req, res, authState, ['gsheet'])) return true;
    return sendJson(res, 200, { settings: store.loadConfig().gsheet }), true;
  }

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
        syncLeads: body.syncLeads !== false
      }
    });
    return sendJson(res, 200, { ok: true, config: store.getPublicConfig(updated), settings: updated.gsheet, status: gsheet.getStatus(updated) }), true;
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
    results.leads = await gsheet.postToSheet(gs, { action: 'sync_leads', leads: leadStore.loadLeads() }, 'Đồng bộ toàn bộ Khách hàng');
    const allOk = Object.values(results).every(r => r && r.ok);
    return sendJson(res, allOk ? 200 : 400, { ok: allOk, results, status: gsheet.getStatus(cfg) }), true;
  }

  return false;
}

module.exports = {
  handleAdminGsheet,
  triggerRealtimeSheetPush
};
