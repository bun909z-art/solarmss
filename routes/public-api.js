'use strict';

const store = require('../lib/store');
const calculator = require('../lib/calculator');
const productStore = require('../lib/products');
const newsStore = require('../lib/news');
const leadStore = require('../lib/leads');
const { sendJson, readJsonBody } = require('../lib/http-helpers');

async function handlePublicApi(req, res, pathname, method) {
  if (pathname === '/api/config' && method === 'GET') {
    return sendJson(res, 200, {
      config: store.loadConfig(),
      presets: store.THEME_PRESETS
    }), true;
  }

  if (pathname === '/api/calculate' && method === 'POST') {
    const body = await readJsonBody(req, 64 * 1024);
    const cfg = store.loadConfig();
    const result = calculator.calculateRecommendation({
      mode: body.mode || cfg.defaults.mode,
      bill: Number(body.bill) || 0,
      kwh: Number(body.kwh) || 0,
      eve: body.eve ?? cfg.defaults.eve,
      dod: body.dod ?? cfg.defaults.dod,
      eff: body.eff ?? cfg.defaults.eff,
      mod: body.mod ?? cfg.defaults.mod,
      vat: body.vat ?? cfg.defaults.vat,
      days: body.days ?? cfg.defaults.days,
      tiers: cfg.tariffs.tiers
    });
    return sendJson(res, 200, result), true;
  }

  if (pathname === '/api/products' && method === 'GET') {
    return sendJson(res, 200, { products: productStore.loadProducts() }), true;
  }

  if (pathname === '/api/news' && method === 'GET') {
    const all = newsStore.loadNews();
    return sendJson(res, 200, { articles: all.filter(a => a.published !== false) }), true;
  }

  if (pathname === '/api/leads' && method === 'POST') {
    const body = await readJsonBody(req, 64 * 1024);
    const saved = leadStore.upsertLead(body);
    return sendJson(res, 200, { ok: true, lead: saved }), true;
  }

  return false;
}

module.exports = { handlePublicApi };
