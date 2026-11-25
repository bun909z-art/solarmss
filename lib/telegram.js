'use strict';

const https = require('https');

const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const lastSentSigBySession = new Map();

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sendTelegramMessage(botToken, chatId, textHtml) {
  return new Promise((resolve, reject) => {
    const token = String(botToken || '').trim();
    const cid = String(chatId || '').trim();
    if (!token || !cid) return reject(new Error('Thiếu Bot Token hoặc Chat ID.'));

    const payload = JSON.stringify({
      chat_id: cid,
      text: textHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${encodeURIComponent(token)}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.ok) {
            return resolve(parsed);
          }
          return reject(new Error(parsed.description || `Telegram lỗi HTTP ${res.statusCode}`));
        } catch {
          return reject(new Error(`Telegram phản hồi không hợp lệ (HTTP ${res.statusCode})`));
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Kết nối Telegram bị quá thời gian (timeout).')); });
    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

function formatLeadMessage(lead) {
  const c = lead.selectedCombo;
  const lines = [
    '⚡ <b>KHÁCH HÀNG TƯ VẤN PIN HYBRID</b>',
    `👤 <b>Khách hàng:</b> ${escHtml(lead.customerName || 'Khách vãng lai')}`,
    lead.customerPhone ? `📞 <b>SĐT:</b> <code>${escHtml(lead.customerPhone)}</code>` : null,
    lead.customerAddress ? `📍 <b>Địa chỉ:</b> ${escHtml(lead.customerAddress)}` : null,
    `💰 <b>Hóa đơn:</b> ${nf0.format(lead.billTotal || 0)} đ/tháng (≈ ${nf0.format(lead.kwhUsed || 0)} kWh)`,
    `🔋 <b>Pin cần lưu trữ:</b> ${Number(lead.batNeededKwh || 0).toFixed(1)} kWh (${lead.modulesCount || 0} × ${lead.moduleKwh || 5.12} kWh · tối ${lead.evePct || 70}%)`
  ];
  if (c) {
    lines.push('');
    lines.push(`★ <b>Combo đã chọn:</b> ${escHtml(c.title || '')}${c.badge ? ' (' + escHtml(c.badge) + ')' : ''}`);
    if (c.inverterName) lines.push(`• Inverter: ${escHtml(c.inverterName)}`);
    if (c.panelSummary) lines.push(`• Tấm pin: ${escHtml(c.panelSummary)}`);
    if (c.batterySummary) lines.push(`• Pin lưu trữ: ${escHtml(c.batterySummary)}`);
    if (c.accessoriesSummary) lines.push(`• Phụ kiện: ${escHtml(c.accessoriesSummary)}`);
  }
  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  lines.push(`\n🕒 <i>${escHtml(timeStr)}</i>`);
  return lines.filter(x => x !== null).join('\n');
}

async function notifyLeadIfEnabled(tgCfg, lead) {
  if (!tgCfg || !tgCfg.enabled || !tgCfg.botToken || !tgCfg.chatId || !lead) return false;
  if (tgCfg.onlyWithContactOrCombo !== false) {
    const ok = Boolean((lead.customerPhone && lead.customerPhone.trim()) || lead.selectedCombo);
    if (!ok) return false;
  }
  const sig = JSON.stringify([
    lead.customerName, lead.customerPhone, lead.customerAddress,
    lead.selectedCombo ? [lead.selectedCombo.key, lead.selectedCombo.inverterName, lead.selectedCombo.panelSummary, lead.selectedCombo.batterySummary] : null
  ]);
  if (lastSentSigBySession.get(lead.id) === sig) return false;
  lastSentSigBySession.set(lead.id, sig);
  if (lastSentSigBySession.size > 500) {
    const firstKey = lastSentSigBySession.keys().next().value;
    lastSentSigBySession.delete(firstKey);
  }
  try {
    await sendTelegramMessage(tgCfg.botToken, tgCfg.chatId, formatLeadMessage(lead));
    return true;
  } catch (err) {
    console.error('[Telegram Notify Error]', err.message);
    return false;
  }
}

module.exports = {
  sendTelegramMessage,
  formatLeadMessage,
  notifyLeadIfEnabled
};
