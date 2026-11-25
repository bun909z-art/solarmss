'use strict';

const http = require('http');
const { URL } = require('url');

const store = require('./lib/store');
const productStore = require('./lib/products');
const newsStore = require('./lib/news');
const leadStore = require('./lib/leads');
const { sendJson } = require('./lib/http-helpers');

const { handlePublicApi } = require('./routes/public-api');
const { handleAdminAuth } = require('./routes/admin-auth');
const { handleAdminConfig } = require('./routes/admin-config');
const { handleAdminCatalog } = require('./routes/admin-catalog');
const { handlePagesAndStatic } = require('./routes/pages');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();
    const authState = store.loadAuth();

    if (await handlePublicApi(req, res, pathname, method)) return;
    if (await handleAdminAuth(req, res, pathname, method, authState)) return;
    if (await handleAdminConfig(req, res, pathname, method, authState)) return;
    if (await handleAdminCatalog(req, res, pathname, method, authState)) return;
    if (handlePagesAndStatic(req, res, pathname, parsedUrl)) return;

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 - Không tìm thấy trang');
  } catch (err) {
    if (err.message === 'PAYLOAD_TOO_LARGE') return sendJson(res, 413, { error: 'Dữ liệu tải lên quá lớn.' });
    if (err.message === 'INVALID_JSON') return sendJson(res, 400, { error: 'Dữ liệu JSON không hợp lệ.' });
    console.error('[Server Error]', err);
    return sendJson(res, 500, { error: 'Lỗi máy chủ nội bộ.' });
  }
});

if (require.main === module) {
  store.loadAuth();
  store.loadConfig();
  productStore.loadProducts();
  newsStore.loadNews();
  leadStore.loadLeads();
  server.listen(PORT, HOST, () => {
    console.log(`Hoàng Quân Pin Hybrid Server đang chạy tại:`);
    console.log(`  • Trang chủ:      http://localhost:${PORT}/`);
    console.log(`  • Trang tư vấn:   http://localhost:${PORT}/tuvan`);
    console.log(`  • Sản phẩm:       http://localhost:${PORT}/products`);
    console.log(`  • Tin tức:        http://localhost:${PORT}/news`);
    console.log(`  • Trang quản trị: http://localhost:${PORT}/admin`);
  });
}

module.exports = server;
