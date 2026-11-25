'use strict';

const http = require('http');
const https = require('https');

const nf0 = new Intl.NumberFormat('vi-VN');

function postJson(urlStr, payload, extraHeaders = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch { return reject(new Error('URL không hợp lệ')); }
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': body.length,
        ...extraHeaders
      },
      timeout: timeoutMs
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ ok: true, status: res.statusCode, body: data });
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 160)}`));
      });
    });
    req.on('timeout', () => { req.destroy(new Error('Quá thời gian kết nối (timeout)')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function formatTelegramMessage(lead) {
  const c = lead.selectedCombo || null;
  const lines = [
    '⚡ KHÁCH HÀNG TƯ VẤN PIN HYBRID MỚI',
    `👤 Khách hàng: ${lead.customerName || 'Khách vãng lai'}`,
    lead.customerPhone ? `📞 SĐT: ${lead.customerPhone}` : null,
    lead.customerAddress ? `📍 Địa chỉ: ${lead.customerAddress}` : null,
    `🧾 Hóa đơn: ${nf0.format(lead.billTotal || 0)} đ/tháng (${nf0.format(lead.kwhUsed || 0)} kWh)`,
    `🔋 Pin cần lưu trữ: ${Number(lead.batNeededKwh || 0).toFixed(1)} kWh (${lead.modulesCount || 0} × ${lead.moduleKwh || 5.12} kWh)`,
    lead.assignedTo ? `🧑‍💼 Phụ trách: @${lead.assignedTo}` : null
  ];
  if (c) {
    lines.push(`★ Combo đã chọn: ${c.title || ''}${c.badge ? ` (${c.badge})` : ''}`);
    if (c.inverterName) lines.push(`  • Inverter: ${c.inverterName}`);
    if (c.panelSummary) lines.push(`  • Tấm pin: ${c.panelSummary}`);
    if (c.batterySummary) lines.push(`  • Pin lưu trữ: ${c.batterySummary}`);
    if (c.accessoriesSummary) lines.push(`  • Phụ kiện: ${c.accessoriesSummary}`);
  }
  return lines.filter(Boolean).join('\n');
}

async function pushLeadToIntegrations(lead, cfg) {
  const integ = (cfg && cfg.integrations) || {};
  const result = { telegramOk: false, webhookOk: false, errors: [] };

  if (integ.telegramEnabled && integ.telegramBotToken && integ.telegramChatId) {
    try {
      const url = `https://api.telegram.org/bot${encodeURIComponent(integ.telegramBotToken.trim())}/sendMessage`;
      await postJson(url, {
        chat_id: String(integ.telegramChatId).trim(),
        text: formatTelegramMessage(lead)
      });
      result.telegramOk = true;
    } catch (err) {
      result.errors.push('Telegram: ' + (err.message || err));
    }
  }

  if (integ.webhookEnabled && integ.webhookUrl) {
    try {
      const headers = {};
      if (integ.webhookSecret) headers['X-HQ-Secret'] = String(integ.webhookSecret).trim();
      await postJson(integ.webhookUrl.trim(), {
        event: 'customer_lead',
        sentAt: new Date().toISOString(),
        lead
      }, headers);
      result.webhookOk = true;
    } catch (err) {
      result.errors.push('Webhook/CSDL: ' + (err.message || err));
    }
  }

  return result;
}

module.exports = {
  formatTelegramMessage,
  pushLeadToIntegrations
};
