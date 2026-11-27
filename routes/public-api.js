'use strict';

const store = require('../lib/store');
const calculator = require('../lib/calculator');
const leadStore = require('../lib/leads');
const telegram = require('../lib/telegram');
const liveUpdates = require('../lib/live-updates');
const { triggerRealtimeSheetPush } = require('./admin-gsheet');
const { sendJson, readJsonBody } = require('../lib/http-helpers');

async function handlePublicApi(req, res, pathname, method) {
  if (pathname === '/api/live' && method === 'GET') {
    liveUpdates.subscribe(res);
    return true;
  }

  if (pathname === '/api/config' && method === 'GET') {
    return sendJson(res, 200, {
      config: store.getPublicConfig(),
      presets: store.THEME_PRESETS
    }), true;
  }

  if (method === 'POST' && ['/api/calculate', '/api/leads'].includes(pathname) && store.loadConfig().maintenance?.enabled) {
    return sendJson(res, 503, { error: 'Trang tư vấn đang tạm bảo trì.' }), true;
  }

  if (pathname === '/api/calculate' && method === 'POST') {
    const body = await readJsonBody(req, 64 * 1024);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendJson(res, 400, { error: 'Dữ liệu tính toán phải là một đối tượng JSON.' }), true;
    }
    const cfg = store.loadConfig();
    const mode = body.mode || cfg.defaults.mode;
    if (mode !== 'bill' && mode !== 'kwh') {
      return sendJson(res, 400, { error: 'Chế độ tính phải là bill hoặc kwh.' }), true;
    }
    const inputs = {
      bill: body.bill ?? 0,
      kwh: body.kwh ?? 0,
      eve: body.eve ?? cfg.defaults.eve,
      dod: body.dod ?? cfg.defaults.dod,
      eff: body.eff ?? cfg.defaults.eff,
      mod: body.mod ?? cfg.defaults.mod,
      vat: body.vat ?? cfg.defaults.vat,
      days: body.days ?? cfg.defaults.days
    };
    for (const [key, value] of Object.entries(inputs)) {
      const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
      if (!Number.isFinite(number) || number < 0) {
        return sendJson(res, 400, { error: `Thông số ${key} phải là số không âm.` }), true;
      }
      inputs[key] = number;
    }
    if (inputs.days <= 0 || inputs.dod <= 0 || inputs.dod > 100 ||
        inputs.eff <= 0 || inputs.eff > 100 || inputs.eve > 100) {
      return sendJson(res, 400, { error: 'Số ngày phải lớn hơn 0. Kiểm tra tỷ lệ dùng điện buổi tối, DoD và hiệu suất.' }), true;
    }
    const result = calculator.calculateRecommendation({ mode, ...inputs, tiers: cfg.tariffs.tiers });
    if (!Object.values(result).every(Number.isFinite)) {
      return sendJson(res, 400, { error: 'Thông số vượt quá phạm vi tính toán.' }), true;
    }
    return sendJson(res, 200, result), true;
  }

  if (pathname === '/api/leads' && method === 'POST') {
    const body = await readJsonBody(req, 64 * 1024);
    const saved = leadStore.upsertLead(body);
    if (!saved) {
      return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập họ tên, số điện thoại hợp lệ và địa chỉ.' }), true;
    }
    const tgCfg = (store.loadAuth().telegram) || (store.loadConfig().telegram);
    telegram.notifyLeadIfEnabled(tgCfg, saved).catch(() => {});
    triggerRealtimeSheetPush(saved);
    return sendJson(res, 200, { ok: true, lead: saved }), true;
  }

  return false;
}

module.exports = { handlePublicApi };
