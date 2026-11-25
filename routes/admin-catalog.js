'use strict';

const fs = require('fs');
const path = require('path');
const store = require('../lib/store');
const productStore = require('../lib/products');
const newsStore = require('../lib/news');
const leadStore = require('../lib/leads');
const { UPLOAD_DIR, sendJson, readJsonBody, requireAdmin } = require('../lib/http-helpers');

async function handleAdminCatalog(req, res, pathname, method, authState) {
  // ---------- CUSTOMER LEADS ----------
  if (pathname === '/api/admin/leads' && method === 'GET') {
    if (!requireAdmin(req, res, authState, ['leads'])) return true;
    return sendJson(res, 200, { leads: leadStore.loadLeads() }), true;
  }
  if (pathname === '/api/admin/leads' && (method === 'PUT' || method === 'PATCH')) {
    if (!requireAdmin(req, res, authState, ['leads'])) return true;
    const body = await readJsonBody(req, 64 * 1024);
    const updated = leadStore.updateLead(String(body.id || ''), body);
    if (!updated) return sendJson(res, 404, { error: 'Không tìm thấy khách hàng.' }), true;
    return sendJson(res, 200, { ok: true, lead: updated }), true;
  }
  if (pathname === '/api/admin/leads' && method === 'DELETE') {
    if (!requireAdmin(req, res, authState, ['leads'])) return true;
    const body = await readJsonBody(req, 16 * 1024);
    return sendJson(res, 200, { ok: true, leads: leadStore.deleteLead(String(body.id || '')) }), true;
  }
  if (pathname === '/api/admin/leads/export.csv' && method === 'GET') {
    if (!requireAdmin(req, res, authState, ['leads'])) return true;
    const csv = leadStore.toLeadsCsv(leadStore.loadLeads());
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="khach-hang-tu-van-${new Date().toISOString().slice(0, 10)}.csv"`
    });
    res.end(csv);
    return true;
  }

  // ---------- NEWS / ARTICLES ----------
  if (pathname === '/api/admin/news' && method === 'GET') {
    if (!requireAdmin(req, res, authState, ['news'])) return true;
    return sendJson(res, 200, { articles: newsStore.loadNews() }), true;
  }
  if (pathname === '/api/admin/news' && (method === 'PUT' || method === 'POST')) {
    if (!requireAdmin(req, res, authState, ['news'])) return true;
    const body = await readJsonBody(req, 3 * 1024 * 1024);
    return sendJson(res, 200, { ok: true, articles: newsStore.saveNews(body.articles || []) }), true;
  }
  if (pathname === '/api/admin/news/reset' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['news'])) return true;
    return sendJson(res, 200, { ok: true, articles: newsStore.resetNews() }), true;
  }

  // ---------- PRODUCTS & EXCEL IMPORT/EXPORT ----------
  if (pathname === '/api/admin/products' && (method === 'PUT' || method === 'POST')) {
    if (!requireAdmin(req, res, authState, ['products'])) return true;
    const body = await readJsonBody(req, 2 * 1024 * 1024);
    return sendJson(res, 200, { ok: true, products: productStore.saveProducts(body.products || []) }), true;
  }
  if (pathname === '/api/admin/products/import' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['products'])) return true;
    const body = await readJsonBody(req, 2 * 1024 * 1024);
    const mode = body.mode === 'append' ? 'append' : 'replace';
    let incoming = [];
    if (body.format === 'xlsx') incoming = productStore.parseProductsXlsx(body.base64 || '');
    else if (body.format === 'csv') incoming = productStore.parseProductsCsv(body.content || '');
    else if (Array.isArray(body.products)) incoming = body.products.map((p, i) => productStore.sanitizeProduct(p, i)).filter(Boolean);
    if (!incoming.length) return sendJson(res, 400, { error: 'Không tìm thấy sản phẩm hợp lệ trong tệp tải lên.' }), true;
    const next = mode === 'append' ? [...productStore.loadProducts(), ...incoming] : incoming;
    return sendJson(res, 200, { ok: true, count: incoming.length, products: productStore.saveProducts(next) }), true;
  }
  if (pathname === '/api/admin/products/reset' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['products'])) return true;
    return sendJson(res, 200, { ok: true, products: productStore.resetProducts() }), true;
  }
  if (pathname === '/api/admin/products/template.xlsx' && method === 'GET') {
    const buf = productStore.toXlsxTemplate(productStore.loadProducts());
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="danh-muc-san-pham-mau.xlsx"',
      'Content-Length': buf.length
    });
    res.end(buf);
    return true;
  }
  if (pathname === '/api/admin/products/template.csv' && method === 'GET') {
    const csv = productStore.toCsvTemplate(productStore.loadProducts());
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="danh-muc-san-pham-mau.csv"'
    });
    res.end(csv);
    return true;
  }

  // ---------- FILE UPLOADS (LOGO, IMAGES, DATASHEETS/DOCS) ----------
  if (pathname === '/api/admin/upload-document' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['products'])) return true;
    const body = await readJsonBody(req, 16 * 1024 * 1024);
    const dataUrl = String(body.dataUrl || '');
    const origName = String(body.filename || 'tai-lieu.pdf').trim();
    const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return sendJson(res, 400, { error: 'Định dạng tệp tải lên không hợp lệ.' }), true;
    const extFromName = (origName.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const allowed = ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'webp', 'zip', 'txt'];
    const ext = allowed.includes(extFromName) ? extFromName : 'pdf';
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 12 * 1024 * 1024) return sendJson(res, 400, { error: 'Tài liệu tối đa 12MB.' }), true;
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const safeStem = origName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'doc';
    const fname = `doc-${Date.now()}-${safeStem}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
    return sendJson(res, 200, { ok: true, url: `/uploads/${fname}`, name: origName }), true;
  }

  if (pathname === '/api/admin/upload-product-image' && method === 'POST') {
    if (!requireAdmin(req, res, authState, ['products', 'news'])) return true;
    const body = await readJsonBody(req, 3 * 1024 * 1024);
    const dataUrl = String(body.dataUrl || '');
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return sendJson(res, 400, { error: 'Chỉ hỗ trợ ảnh PNG, JPG, WebP hoặc SVG.' }), true;
    const extMap = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', 'svg+xml': 'svg' };
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 2 * 1024 * 1024) return sendJson(res, 400, { error: 'Ảnh tối đa 2MB.' }), true;
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const fname = `prod-${Date.now()}.${extMap[match[1]]}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
    return sendJson(res, 200, { ok: true, imageUrl: `/uploads/${fname}` }), true;
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
    return sendJson(res, 200, { ok: true, logoUrl, config: updated }), true;
  }

  return false;
}

module.exports = { handleAdminCatalog };
