'use strict';

const store = require('../lib/store');
const { isDeepStrictEqual } = require('node:util');
const leadStore = require('../lib/leads');
const { sendJson, readJsonBody, requireAdmin } = require('../lib/http-helpers');

function configHasConflict(current, patch, expected) {
  return Object.entries(expected).some(([section, fields]) => {
    const update = patch[section];
    if (!update || !fields || typeof fields !== 'object') return false;
    return Object.entries(fields).some(([field, previous]) => {
      if (!Object.hasOwn(update, field)) return false;
      const currentValue = current[section]?.[field];
      return !isDeepStrictEqual(currentValue, previous) && !isDeepStrictEqual(currentValue, update[field]);
    });
  });
}

function salesContactsError(footer, current) {
  if (!footer || !Object.hasOwn(footer, 'salesContacts')) return '';
  const contacts = footer.salesContacts;
  if (!Array.isArray(contacts)) return 'Danh sách tư vấn bán hàng không hợp lệ.';
  if (isDeepStrictEqual(contacts, current.footer?.salesContacts)) return '';
  const invalid = contacts.findIndex(contact => {
    const number = String(contact?.number || '').trim();
    if (!number && !String(contact?.label || '').trim() && !String(contact?.zalo || '').trim()) return false;
    const digits = number.replace(/\D/g, '').length;
    return !/^\+?[\d\s().-]+$/.test(number) || digits < 9 || digits > 15;
  });
  return invalid < 0 ? '' : `Số điện thoại của liên hệ bán hàng #${invalid + 1} không hợp lệ. Vui lòng nhập từ 9 đến 15 chữ số.`;
}

async function handleAdminConfig(req, res, pathname, method, authState) {
  if (pathname === '/api/admin/config' && (method === 'PUT' || method === 'POST')) {
    const user = requireAdmin(req, res, authState, ['branding', 'theme', 'layout', 'tariffs', 'footer']);
    if (!user) return true;
    const input = await readJsonBody(req, 1024 * 1024);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return sendJson(res, 400, { error: 'Dữ liệu cấu hình không hợp lệ.' }), true;
    }
    const { expectedConfig, ...body } = input;
    let patch = body;
    if (user.role !== 'admin') {
      const perms = Array.isArray(user.permissions) ? user.permissions : [];
      patch = {};
      if (perms.includes('branding') && body.branding) patch.branding = body.branding;
      if (perms.includes('theme') && body.theme) patch.theme = body.theme;
      if ((perms.includes('theme') || perms.includes('layout')) && body.hero) patch.hero = body.hero;
      if (perms.includes('layout') && body.sections) patch.sections = body.sections;
      if (perms.includes('tariffs')) {
        if (body.defaults) patch.defaults = body.defaults;
        if (body.tariffs) patch.tariffs = body.tariffs;
      }
      if (perms.includes('footer') && body.footer) patch.footer = body.footer;
    }
    const current = store.loadConfig();
    if (expectedConfig && configHasConflict(current, patch, expectedConfig)) {
      return sendJson(res, 409, { error: 'Mục bạn đang lưu đã được thay đổi ở phiên Admin khác. Hãy tải lại trang để xem bản mới trước khi sửa tiếp.' }), true;
    }
    const contactError = salesContactsError(patch.footer, current);
    if (contactError) return sendJson(res, 400, { error: contactError }), true;
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
    const updated = store.saveConfig({ maintenance: { enabled: Boolean(body?.enabled) } });
    return sendJson(res, 200, { ok: true, config: store.getPublicConfig(updated) }), true;
  }

  if (pathname === '/api/admin/backup-full' && method === 'GET') {
    if (!requireAdmin(req, res, authState, ['security'])) return true;
    const payload = {
      version: 'hoangquan-full-backup-v1',
      exportedAt: new Date().toISOString(),
      config: store.loadConfig(),
      leads: leadStore.loadLeads()
    };
    const buf = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="mai-son-solar-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      'Content-Length': buf.length
    });
    res.end(buf);
    return true;
  }

  if (pathname === '/api/admin/restore-full' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['security'])) return true;
    const body = await readJsonBody(req, 25 * 1024 * 1024);
    const updatedSections = [];
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const config = body.config && typeof body.config === 'object' ? body.config : body;
      const patch = Object.fromEntries(store.CONFIG_KEYS.filter(key => key !== 'updatedAt' && config[key]).map(key => [key, config[key]]));
      const contactError = salesContactsError(patch.footer, store.loadConfig());
      if (contactError) return sendJson(res, 400, { error: contactError }), true;
      if (Object.keys(patch).length) {
        store.saveConfig(patch);
        updatedSections.push('Cấu hình tư vấn');
      }
      if (Array.isArray(body.leads)) {
        const restored = body.leads.filter(lead => leadStore.upsertLead(lead, { restoring: true })).length;
        updatedSections.push(`Khách hàng (${restored})`);
      }
    }
    if (!updatedSections.length) {
      return sendJson(res, 400, { error: 'Tệp JSON không chứa dữ liệu cấu hình tư vấn hoặc khách hàng hợp lệ.' }), true;
    }
    return sendJson(res, 200, {
      ok: true,
      updatedSections,
      config: store.getPublicConfig(),
      leadsCount: leadStore.loadLeads().length
    }), true;
  }

  return false;
}

module.exports = { handleAdminConfig };
