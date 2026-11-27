'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_PATH = path.join(DATA_DIR, 'leads.json');

const VALID_STATUSES = ['new', 'contacted', 'quoted', 'closed', 'cancelled'];
let memLeads = null;

function ensureDir() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}


function isCompleteLead(l) {
  if (!l || typeof l !== 'object') return false;
  const name = String(l.customerName || '').trim();
  const phoneDigits = String(l.customerPhone || '').replace(/\D/g, '');
  const addr = String(l.customerAddress || '').trim();
  return name.length >= 2 && phoneDigits.length >= 9 && addr.length >= 2;
}

function loadLeads() {
  if (memLeads) return memLeads;
  ensureDir();
  try {
    if (!fs.existsSync(LEADS_PATH)) {
      memLeads = [];
      return memLeads;
    }
    const parsed = JSON.parse(fs.readFileSync(LEADS_PATH, 'utf8'));
    memLeads = Array.isArray(parsed) ? parsed.filter(isCompleteLead) : [];
    return memLeads;
  } catch {
    memLeads = [];
    return memLeads;
  }
}

function persistLeads(list) {
  ensureDir();
  const tempPath = path.join(DATA_DIR, `leads-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(tempPath, LEADS_PATH);
  } catch (err) {
    try { fs.unlinkSync(tempPath); } catch {}
    throw err;
  }
  memLeads = list;
  return memLeads;
}

function sanitizeCombo(c) {
  if (!c || typeof c !== 'object') return null;
  return {
    key: String(c.key || '').slice(0, 60),
    badge: String(c.badge || '').slice(0, 60),
    title: String(c.title || '').slice(0, 140),
    inverterName: String(c.inverterName || '').slice(0, 140),
    panelSummary: String(c.panelSummary || '').slice(0, 180),
    batterySummary: String(c.batterySummary || '').slice(0, 180),
    accessoriesSummary: String(c.accessoriesSummary || '').slice(0, 300)
  };
}

function upsertLead(raw, { restoring = false } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const leads = loadLeads().slice();
  const now = new Date().toISOString();
  const id = String((restoring ? raw.id || raw.sessionId : raw.sessionId || raw.id) || `lead-${Date.now()}`).trim().slice(0, 80);

  const customerName = String(raw.customerName || '').trim().slice(0, 120);
  const customerPhone = String(raw.customerPhone || '').trim().slice(0, 40);
  const customerAddress = String(raw.customerAddress || '').trim().slice(0, 220);
  const selectedCombo = sanitizeCombo(raw.selectedCombo);

  // Strictly require full Name + valid Phone (>=9 digits) + Address (block anonymous leads)
  const phoneDigits = customerPhone.replace(/\D/g, '');
  if (customerName.length < 2 || phoneDigits.length < 9 || customerAddress.length < 2) {
    return null;
  }

  const idx = leads.findIndex(x => x.id === id);
  const prev = idx >= 0 ? leads[idx] : null;
  const meta = restoring ? raw : (prev || {});
  const evePct = Number(raw.evePct ?? 70);
  const entry = {
    id,
    createdAt: String(meta.createdAt || now),
    updatedAt: restoring ? String(meta.updatedAt || meta.createdAt || now) : now,
    customerName,
    customerPhone,
    customerAddress,
    billTotal: Math.max(0, Number(raw.billTotal) || 0),
    kwhUsed: Math.max(0, Number(raw.kwhUsed) || 0),
    evePct: Number.isFinite(evePct) ? Math.max(0, Math.min(100, evePct)) : 70,
    batNeededKwh: Math.max(0, Number(raw.batNeededKwh) || 0),
    modulesCount: Math.max(0, Number(raw.modulesCount) || 0),
    moduleKwh: Math.max(0, Number(raw.moduleKwh) || 5.12),
    selectedCombo: restoring ? selectedCombo : selectedCombo || prev?.selectedCombo || null,
    status: VALID_STATUSES.includes(meta.status) ? meta.status : 'new',
    assignedTo: String(meta.assignedTo || raw.assignedTo || 'admin').trim(),
    botSentAt: String(meta.botSentAt || ''),
    webhookSentAt: String(meta.webhookSentAt || ''),
    adminNote: String(meta.adminNote || '')
  };

  if (idx >= 0) leads[idx] = entry;
  else leads.unshift(entry);

  // Keep latest 500 leads max
  leads.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  persistLeads(leads.slice(0, 500));
  return entry;
}

function updateLead(id, patch) {
  const leads = loadLeads().slice();
  const idx = leads.findIndex(x => x.id === id);
  if (idx < 0) return null;
  const cur = { ...leads[idx] };
  if (patch.status && VALID_STATUSES.includes(patch.status)) cur.status = patch.status;
  if (patch.adminNote !== undefined) cur.adminNote = String(patch.adminNote).slice(0, 500);
  if (patch.assignedTo !== undefined) cur.assignedTo = String(patch.assignedTo || 'admin').trim().slice(0, 60);
  if (patch.botSentAt !== undefined) cur.botSentAt = String(patch.botSentAt || '');
  if (patch.webhookSentAt !== undefined) cur.webhookSentAt = String(patch.webhookSentAt || '');
  if (patch.customerName !== undefined) cur.customerName = String(patch.customerName).trim().slice(0, 120);
  if (patch.customerPhone !== undefined) cur.customerPhone = String(patch.customerPhone).trim().slice(0, 40);
  if (patch.customerAddress !== undefined) cur.customerAddress = String(patch.customerAddress).trim().slice(0, 220);
  leads[idx] = cur;
  persistLeads(leads);
  return cur;
}

function deleteLead(id) {
  const leads = loadLeads().filter(x => x.id !== id);
  persistLeads(leads);
  return leads;
}

function toLeadsCsv(leads) {
  const statusMap = { new: 'Mới', contacted: 'Đã liên hệ', quoted: 'Đã báo giá', closed: 'Đã chốt', cancelled: 'Hủy' };
  const header = 'Thời gian,Khách hàng,Số điện thoại,Địa chỉ,Hóa đơn (VNĐ),Sản lượng (kWh),Pin cần (kWh),Combo đã chọn,Inverter,Tấm pin,Pin lưu trữ,Phụ kiện,Phụ trách,Trạng thái,Ghi chú Admin';
  const rows = (leads || []).map(l => {
    const c = l.selectedCombo || {};
    const cols = [
      l.updatedAt || l.createdAt || '',
      l.customerName || '',
      l.customerPhone || '',
      l.customerAddress || '',
      Math.round(l.billTotal || 0),
      Math.round(l.kwhUsed || 0),
      Number(l.batNeededKwh || 0).toFixed(1),
      c.title ? `${c.title} (${c.badge || ''})` : '',
      c.inverterName || '',
      c.panelSummary || '',
      c.batterySummary || '',
      c.accessoriesSummary || '',
      l.assignedTo || 'admin',
      statusMap[l.status] || 'Mới',
      l.adminNote || ''
    ];
    return cols.map(v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  });
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

module.exports = {
  loadLeads,
  upsertLead,
  updateLead,
  deleteLead,
  toLeadsCsv
};
