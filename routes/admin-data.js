'use strict';


const fs = require('fs');
const path = require('path');
const store = require('../lib/store');
const leadStore = require('../lib/leads');
const telegram = require('../lib/telegram');
const { UPLOAD_DIR, sendJson, readJsonBody, requireAdmin } = require('../lib/http-helpers');


async function handleAdminData(req, res, pathname, method, authState) {
  // ---------- CUSTOMER LEADS ----------
  if (pathname === '/api/admin/leads' && method === 'GET') {
    if (!requireAdmin(req, res, authState, ['leads'])) return true;
    return sendJson(res, 200, { leads: leadStore.loadLeads() }), true;
  }
  if (pathname === '/api/admin/leads' && (method === 'PUT' || method === 'PATCH')) {
    const curUser = requireAdmin(req, res, authState, ['leads']);
    if (!curUser) return true;
    const body = await readJsonBody(req, 64 * 1024);
    if (curUser.role !== 'admin') delete body.assignedTo;
    const updated = leadStore.updateLead(String(body.id || ''), body);
    if (!updated) return sendJson(res, 404, { error: 'Không tìm thấy khách hàng.' }), true;
    return sendJson(res, 200, { ok: true, lead: updated }), true;
  }
  if (pathname === '/api/admin/leads' && method === 'DELETE') {
    if (!requireAdmin(req, res, authState, ['leads'])) return true;
    const body = await readJsonBody(req, 16 * 1024);
    return sendJson(res, 200, { ok: true, leads: leadStore.deleteLead(String(body.id || '')) }), true;
  }
  if (pathname === '/api/admin/leads/push' && method === 'POST') {
    if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return true;
    const body = await readJsonBody(req, 16 * 1024);
    const lead = leadStore.loadLeads().find(item => item.id === body?.id);
    if (!lead) return sendJson(res, 404, { error: 'Không tìm thấy khách hàng.' }), true;
    const { enabled, botToken, chatId } = authState.telegram || {};
    if (!enabled || !botToken || !chatId) {
      return sendJson(res, 400, { error: 'Hãy bật và lưu kết nối Telegram trong mục Phân quyền & dữ liệu.' }), true;
    }
    try {
      await telegram.sendTelegramMessage(botToken, chatId, telegram.formatLeadMessage(lead));
    } catch (err) {
      return sendJson(res, 502, { error: 'Không gửi được Telegram. ' + err.message }), true;
    }
    const updated = leadStore.updateLead(lead.id, { botSentAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true, lead: updated }), true;
  }
  if (pathname === '/api/admin/leads/export.csv' && (method === 'GET' || method === 'POST')) {
    if (!requireAdmin(req, res, authState, ['leads'])) return true;
    let leads = leadStore.loadLeads();
    if (method === 'POST') {
      const body = await readJsonBody(req, 64 * 1024);
      if (!Array.isArray(body?.ids) || body.ids.length > 500 || body.ids.some(id => typeof id !== 'string' || !id || id.length > 80)) {
        return sendJson(res, 400, { error: 'Danh sách khách hàng xuất CSV không hợp lệ.' }), true;
      }
      const ids = new Set(body.ids);
      leads = leads.filter(lead => ids.has(lead.id));
    }
    const csv = leadStore.toLeadsCsv(leads);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="khach-hang-tu-van-${new Date().toISOString().slice(0, 10)}.csv"`
    });
    res.end(csv);
    return true;
  }


  if (pathname === '/api/admin/upload-logo' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['branding'])) return true;
    const body = await readJsonBody(req, 3 * 1024 * 1024);
    const dataUrl = String(body.dataUrl || '');
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return sendJson(res, 400, { error: 'Chỉ hỗ trợ ảnh PNG, JPG, WebP hoặc SVG.' }), true;
    const extMap = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', 'svg+xml': 'svg' };
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 2 * 1024 * 1024) return sendJson(res, 400, { error: 'Ảnh logo tối đa 2MB.' }), true;
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const filename = `logo-${Date.now()}.${extMap[match[1]]}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
    const logoUrl = `/uploads/${filename}`;
    const updated = store.saveConfig({ branding: { logoUrl } });
    return sendJson(res, 200, { ok: true, logoUrl, config: store.getPublicConfig(updated) }), true;
  }

  return false;
}

module.exports = { handleAdminData };
