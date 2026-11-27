'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ALLOWED_EXACT = new Set(['server.js', 'package.json', 'README.md']);
const ALLOWED_PREFIXES = ['public/', 'lib/', 'routes/'];
const PROTECTED_PREFIXES = ['data/', 'public/uploads/'];

function parseZipEntries(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) {
    throw new Error('Tệp ZIP không hợp lệ hoặc bị hỏng.');
  }
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('Không tìm thấy cấu trúc ZIP hợp lệ (EOCD).');

  const cdCount = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = [];
  let pos = cdOffset;

  for (let i = 0; i < cdCount; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error('Cấu trúc thư mục trung tâm ZIP bị lỗi.');
    }
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const lfhOffset = buf.readUInt32LE(pos + 42);
    const rawName = buf.slice(pos + 46, pos + 46 + nameLen).toString('utf8').replace(/\\/g, '/');
    pos += 46 + nameLen + extraLen + commentLen;

    if (rawName.endsWith('/')) continue;
    if (lfhOffset + 30 > buf.length || buf.readUInt32LE(lfhOffset) !== 0x04034b50) {
      throw new Error(`Dữ liệu tệp "${rawName}" trong ZIP bị lỗi.`);
    }
    const lNameLen = buf.readUInt16LE(lfhOffset + 26);
    const lExtraLen = buf.readUInt16LE(lfhOffset + 28);
    const dataStart = lfhOffset + 30 + lNameLen + lExtraLen;
    const compData = buf.slice(dataStart, dataStart + compSize);

    let data;
    if (method === 0) data = compData;
    else if (method === 8) data = zlib.inflateRawSync(compData);
    else throw new Error(`Phương thức nén ZIP (${method}) không được hỗ trợ cho "${rawName}".`);

    entries.push({ name: rawName, data });
  }
  return entries;
}

function normalizeRelPath(rawName) {
  let rel = String(rawName || '').replace(/^\/+/, '');
  // Strip any single top-level wrapper folder (e.g., "hoangquan-pin-hybrid/")
  const parts = rel.split('/');
  if (parts.length > 1 && !ALLOWED_PREFIXES.some(p => rel.startsWith(p)) && !ALLOWED_EXACT.has(rel)) {
    const sub = parts.slice(1).join('/');
    if (ALLOWED_EXACT.has(sub) || ALLOWED_PREFIXES.some(p => sub.startsWith(p))) {
      rel = sub;
    }
  }
  if (!rel || rel.includes('..') || path.isAbsolute(rel) || rel.includes('\0')) return null;
  return rel;
}

function isAllowedTarget(rel) {
  if (!rel) return false;
  if (PROTECTED_PREFIXES.some(p => rel.startsWith(p))) return false;
  if (ALLOWED_EXACT.has(rel)) return true;
  return ALLOWED_PREFIXES.some(p => rel.startsWith(p));
}

function createSafetyBackup(rootResolved, stores) {
  const backupName = `backup-before-update-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const backupDir = path.join(rootResolved, 'data', 'backups');
  const payload = {
    createdAt: new Date().toISOString(),
    config: stores.store ? stores.store.loadConfig() : null,
    products: stores.productStore ? stores.productStore.loadProducts() : [],
    news: stores.newsStore ? stores.newsStore.loadNews() : [],
    leads: stores.leadStore ? stores.leadStore.loadLeads() : []
  };
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, backupName), JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    throw new Error('Không tạo được bản sao lưu trước khi cập nhật. Vui lòng kiểm tra quyền ghi và dung lượng lưu trữ.');
  }
  let uploadsCount = 0;
  try {
    const upDir = path.join(rootResolved, 'public', 'uploads');
    if (fs.existsSync(upDir)) uploadsCount = fs.readdirSync(upDir).filter(f => !f.startsWith('.')).length;
  } catch {}
  return {
    backupFile: `data/backups/${backupName}`,
    preserved: {
      products: Array.isArray(payload.products) ? payload.products.length : 0,
      news: Array.isArray(payload.news) ? payload.news.length : 0,
      leads: Array.isArray(payload.leads) ? payload.leads.length : 0,
      uploads: uploadsCount
    }
  };
}

function applyZipUpdate(base64Str, appRootDir, stores = {}) {
  const buf = Buffer.from(String(base64Str || ''), 'base64');
  const entries = parseZipEntries(buf);
  if (!entries.length) throw new Error('Tệp ZIP trống, không có tệp nào để cập nhật.');

  const staged = [];
  let skippedCount = 0;
  for (const e of entries) {
    const rel = normalizeRelPath(e.name);
    if (!isAllowedTarget(rel)) { skippedCount++; continue; }
    staged.push({ rel, data: e.data });
  }

  if (!staged.length) {
    throw new Error('Gói ZIP không chứa mã nguồn hợp lệ (cần có public/, lib/, routes/ hoặc server.js).');
  }

  const rootResolved = path.resolve(appRootDir);
  const { backupFile, preserved } = createSafetyBackup(rootResolved, stores);

  let needsRestart = false;
  const updatedFiles = [];

  for (const item of staged) {
    const dest = path.resolve(rootResolved, item.rel);
    if (!dest.startsWith(rootResolved + path.sep)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, item.data);
    updatedFiles.push(item.rel);
    if (item.rel === 'server.js' || item.rel.startsWith('lib/') || item.rel.startsWith('routes/')) {
      needsRestart = true;
    }
  }

  return {
    updatedCount: updatedFiles.length,
    removedCount: 0,
    skippedCount,
    needsRestart,
    backupFile,
    preserved,
    updatedFiles
  };
}

module.exports = {
  parseZipEntries,
  applyZipUpdate
};
