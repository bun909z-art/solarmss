'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PROTECTED_PREFIXES = ['data/', 'public/uploads/', 'node_modules/', '.git/'];
const PROTECTED_FILES = new Set(['.env', '.env.local']);

function isProtectedPath(rel) {
  const norm = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm || norm.includes('..') || path.isAbsolute(norm)) return true;
  if (PROTECTED_FILES.has(norm)) return true;
  return PROTECTED_PREFIXES.some(p => norm === p.slice(0, -1) || norm.startsWith(p));
}

function extractZipEntries(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) {
    throw new Error('Tệp ZIP không hợp lệ hoặc bị hỏng.');
  }
  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  const minOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Không tìm thấy cấu trúc ZIP hợp lệ (thiếu EOCD).');
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let pos = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error('Cấu trúc thư mục trung tâm của tệp ZIP bị lỗi.');
    }
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOff = buf.readUInt32LE(pos + 42);
    const rawName = buf.slice(pos + 46, pos + 46 + nameLen).toString('utf8').replace(/\\/g, '/');
    pos += 46 + nameLen + extraLen + commentLen;

    if (rawName.endsWith('/')) continue; // skip directory entries

    if (localOff + 30 > buf.length || buf.readUInt32LE(localOff) !== 0x04034b50) {
      throw new Error(`Lỗi giải nén mục: ${rawName}`);
    }
    const lhNameLen = buf.readUInt16LE(localOff + 26);
    const lhExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    const compData = buf.slice(dataStart, dataStart + compSize);

    let data;
    if (method === 0) data = compData;
    else if (method === 8) data = zlib.inflateRawSync(compData);
    else throw new Error(`Không hỗ trợ phương thức nén ZIP (${method}) cho tệp ${rawName}.`);

    entries.push({ name: rawName, data });
  }
  return entries;
}

function stripCommonPrefix(entries) {
  const names = entries.map(e => e.name.replace(/^\/+/, ''));
  if (!names.length) return entries;
  const firstSlash = names[0].indexOf('/');
  if (firstSlash <= 0) return entries.map((e, i) => ({ name: names[i], data: e.data }));
  const prefix = names[0].slice(0, firstSlash + 1);
  const allShare = names.every(n => n.startsWith(prefix));
  if (!allShare) return entries.map((e, i) => ({ name: names[i], data: e.data }));
  return entries.map((e, i) => ({ name: names[i].slice(prefix.length), data: e.data })).filter(e => e.name);
}

function walkManagedFiles(appRoot, relBase, out = []) {
  const abs = path.join(appRoot, relBase);
  if (!fs.existsSync(abs)) return out;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    const norm = relBase.replace(/\\/g, '/');
    if (!isProtectedPath(norm)) out.push(norm);
    return out;
  }
  for (const item of fs.readdirSync(abs)) {
    const childRel = path.posix.join(relBase.replace(/\\/g, '/'), item);
    if (isProtectedPath(childRel)) continue;
    walkManagedFiles(appRoot, childRel, out);
  }
  return out;
}

function savePreUpdateSnapshot(appRoot, stores) {
  const backupDir = path.join(appRoot, 'data', 'backups');
  try { fs.mkdirSync(backupDir, { recursive: true }); } catch {}
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = `pre-update-${stamp}.json`;
  const snapshot = {
    version: 'hoangquan-pre-update-snapshot',
    createdAt: new Date().toISOString(),
    config: stores.store.loadConfig(),
    products: stores.productStore.loadProducts(),
    news: stores.newsStore.loadNews(),
    leads: stores.leadStore.loadLeads()
  };
  try {
    fs.writeFileSync(path.join(backupDir, fname), JSON.stringify(snapshot, null, 2), 'utf8');
    // Keep only 5 most recent snapshots
    const existing = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('pre-update-') && f.endsWith('.json'))
      .sort()
      .reverse();
    for (const old of existing.slice(5)) {
      try { fs.unlinkSync(path.join(backupDir, old)); } catch {}
    }
  } catch {}
  return { fname, snapshot };
}

function applyUpdateZip(zipBuffer, appRoot, stores) {
  const rawEntries = extractZipEntries(zipBuffer);
  const entries = stripCommonPrefix(rawEntries);
  if (!entries.length) {
    throw new Error('Gói ZIP rỗng, không có tệp nào để cập nhật.');
  }

  const entryMap = new Map();
  for (const e of entries) {
    const norm = e.name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!norm || norm.includes('..') || path.isAbsolute(norm)) {
      throw new Error(`Đường dẫn không an toàn trong gói ZIP: ${e.name}`);
    }
    entryMap.set(norm, e.data);
  }

  // Validate this is a genuine Hoàng Quân package
  const hasServer = entryMap.has('server.js');
  const hasPublic = Array.from(entryMap.keys()).some(k => k.startsWith('public/'));
  if (!hasServer || !hasPublic) {
    throw new Error('Gói ZIP không đúng cấu trúc mã nguồn Hoàng Quân (thiếu server.js hoặc thư mục public/).');
  }

  // 1. Save automatic pre-update snapshot of all live data
  const { fname: backupFile, snapshot } = savePreUpdateSnapshot(appRoot, stores);

  // 2. Collect existing managed code files to clean up obsolete old files
  const oldFiles = [
    ...walkManagedFiles(appRoot, 'lib'),
    ...walkManagedFiles(appRoot, 'public')
  ];
  for (const rootFile of ['server.js', 'package.json', 'README.md']) {
    if (fs.existsSync(path.join(appRoot, rootFile))) oldFiles.push(rootFile);
  }

  const incomingCodeFiles = new Set();
  let updatedCount = 0;

  // 3. Write all non-protected code files from the ZIP package
  for (const [rel, data] of entryMap.entries()) {
    if (isProtectedPath(rel)) continue; // NEVER overwrite data/, public/uploads/, .env, node_modules/
    incomingCodeFiles.add(rel);
    const dest = path.resolve(appRoot, rel);
    if (!dest.startsWith(path.resolve(appRoot) + path.sep)) {
      throw new Error(`Đường dẫn vượt phạm vi thư mục ứng dụng: ${rel}`);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    updatedCount++;
  }

  // 4. Delete obsolete old code files that are no longer in the new update package
  let removedCount = 0;
  for (const oldRel of oldFiles) {
    if (isProtectedPath(oldRel)) continue;
    if (!incomingCodeFiles.has(oldRel)) {
      try {
        fs.unlinkSync(path.join(appRoot, oldRel));
        removedCount++;
      } catch {}
    }
  }

  // 5. Sync & preserve all live data and settings (merge new config defaults without losing user edits)
  try {
    const storeModulePath = require.resolve(path.join(appRoot, 'lib', 'store.js'));
    delete require.cache[storeModulePath];
    const freshStore = require(storeModulePath);
    if (freshStore && typeof freshStore.saveConfig === 'function' && snapshot.config) {
      freshStore.saveConfig(snapshot.config);
    }
  } catch {}

  const uploadsDir = path.join(appRoot, 'public', 'uploads');
  let uploadsCount = 0;
  try {
    if (fs.existsSync(uploadsDir)) uploadsCount = fs.readdirSync(uploadsDir).length;
  } catch {}

  return {
    ok: true,
    updatedCount,
    removedCount,
    backupFile,
    preserved: {
      products: Array.isArray(snapshot.products) ? snapshot.products.length : 0,
      news: Array.isArray(snapshot.news) ? snapshot.news.length : 0,
      leads: Array.isArray(snapshot.leads) ? snapshot.leads.length : 0,
      uploads: uploadsCount
    }
  };
}

module.exports = {
  extractZipEntries,
  applyUpdateZip
};
