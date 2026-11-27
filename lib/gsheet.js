'use strict';

const APPS_SCRIPT_TEMPLATE = `// Dán mã này vào Google Sheets -> Tiện ích mở rộng -> Apps Script -> Triển khai -> Ứng dụng web (Ai cũng có quyền truy cập)
const SECRET = ''; // Nếu đặt Mã bảo mật trong Admin thì điền giống hệt vào đây

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FFF7ED');
    sh.setFrozenRows(1);
  }
  return sh;
}

const LEAD_HEADERS = ['ID', 'Thời gian', 'Khách hàng', 'SĐT', 'Địa chỉ', 'Hóa đơn (VNĐ)', 'Sản lượng (kWh)', 'Pin cần (kWh)', 'Yêu cầu báo giá lúc', 'Trạng thái', 'Ghi chú Admin'];

function writeLeads(ss, leads) {
  const sh = ensureSheet(ss, 'KhachHang', LEAD_HEADERS);
  const data = sh.getDataRange().getValues();
  const headers = data[0].some(Boolean) ? data[0].slice() : [];
  for (const header of LEAD_HEADERS) {
    if (!headers.includes(header)) headers.push(header);
  }
  if (headers.length > sh.getMaxColumns()) {
    sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  }
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  const columns = LEAD_HEADERS.map(header => headers.indexOf(header));
  const rowsById = new Map(data.slice(1).map((row, i) => [String(row[columns[0]]), i + 2]));
  for (const lead of leads) {
    const values = [
      lead.id, lead.updatedAt || lead.createdAt || '', lead.customerName || '', lead.customerPhone || '', lead.customerAddress || '',
      Math.round(lead.billTotal || 0), Math.round(lead.kwhUsed || 0), Number(lead.batNeededKwh || 0),
      lead.quoteRequestedAt || '', lead.status || 'new', lead.adminNote || ''
    ];
    const rowNumber = rowsById.get(String(lead.id));
    if (rowNumber) {
      const range = sh.getRange(rowNumber, 1, 1, headers.length);
      const formulas = range.getFormulas()[0];
      const row = range.getValues()[0].map((value, i) => formulas[i] || value);
      columns.forEach((column, i) => { row[column] = values[i]; });
      range.setValues([row]);
    } else {
      const row = Array(headers.length).fill('');
      columns.forEach((column, i) => { row[column] = values[i]; });
      sh.appendRow(row);
      rowsById.set(String(lead.id), sh.getLastRow());
    }
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (SECRET && body.secret !== SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Invalid secret' })).setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = body.action || 'ping';

    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, sheetName: ss.getName(), time: new Date().toISOString() })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'upsert_lead' && body.lead) {
      writeLeads(ss, [body.lead]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'sync_leads' && Array.isArray(body.leads)) {
      writeLeads(ss, body.leads);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, count: body.leads.length })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unknown action' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (SECRET && p.secret !== SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Invalid secret' })).setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({ ok: true, sheetName: ss.getName(), time: new Date().toISOString() })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

const status = {
  state: 'idle', // idle | syncing | connected | error
  sheetName: '',
  lastSyncAt: null,
  lastAction: '',
  lastError: '',
  successCount: 0,
  errorCount: 0,
  logs: []
};

function pushLog(entry) {
  status.logs.unshift({
    time: new Date().toISOString(),
    ...entry
  });
  if (status.logs.length > 15) status.logs.length = 15;
}

function getStatus(cfg) {
  const gs = (cfg && cfg.gsheet) || {};
  const configured = Boolean(gs.enabled && gs.webhookUrl && /^https?:\/\//i.test(gs.webhookUrl));
  return {
    configured,
    enabled: Boolean(gs.enabled),
    pullIntervalSec: Number(gs.pullIntervalSec) || 60,
    state: !configured ? 'disconnected' : status.state === 'idle' ? 'connected' : status.state,
    sheetName: status.sheetName,
    lastSyncAt: status.lastSyncAt,
    lastAction: status.lastAction,
    lastError: status.lastError,
    successCount: status.successCount,
    errorCount: status.errorCount,
    logs: status.logs
  };
}

async function postToSheet(gsCfg, payload, label) {
  if (!gsCfg || !gsCfg.webhookUrl || !/^https?:\/\//i.test(gsCfg.webhookUrl)) {
    return { ok: false, skipped: true, error: 'Chưa cấu hình URL Google Apps Script.' };
  }
  const t0 = Date.now();
  status.state = 'syncing';
  status.lastAction = label || payload.action || 'sync';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(gsCfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, secret: gsCfg.secretKey || '' }),
      redirect: 'follow',
      signal: controller.signal
    });
    const data = await resp.json().catch(() => null);
    const ms = Date.now() - t0;
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
    if (data?.ok !== true) throw new Error(data?.error || 'URL không trả về phản hồi hợp lệ từ Google Apps Script.');
    status.state = 'connected';
    status.lastSyncAt = new Date().toISOString();
    status.lastError = '';
    status.successCount += 1;
    if (data.sheetName) status.sheetName = data.sheetName;
    pushLog({ ok: true, action: label || payload.action, detail: data.sheetName ? `Sheet: ${data.sheetName}` : 'Thành công', ms });
    return { ok: true, data, ms };
  } catch (err) {
    const ms = Date.now() - t0;
    status.state = 'error';
    status.lastError = err.message || String(err);
    status.errorCount += 1;
    pushLog({ ok: false, action: label || payload.action, detail: status.lastError, ms });
    return { ok: false, error: status.lastError, ms };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  APPS_SCRIPT_TEMPLATE,
  getStatus,
  postToSheet
};
