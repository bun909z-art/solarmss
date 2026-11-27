'use strict';

const http = require('http');
const { URL } = require('url');

const store = require('./lib/store');
const leadStore = require('./lib/leads');
const { sendJson } = require('./lib/http-helpers');

const { handlePublicApi } = require('./routes/public-api');
const { handleAdminAuth } = require('./routes/admin-auth');
const { handleAdminConfig } = require('./routes/admin-config');
const { handleAdminData } = require('./routes/admin-data');
const { handleAdminGsheet } = require('./routes/admin-gsheet');
const { handlePagesAndStatic } = require('./routes/pages');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();
    if (await handlePublicApi(req, res, pathname, method)) return;
    const authState = store.loadAuth();
    if (await handleAdminAuth(req, res, pathname, method, authState)) return;
    if (await handleAdminConfig(req, res, pathname, method, authState)) return;
    if (await handleAdminData(req, res, pathname, method, authState)) return;
    if (await handleAdminGsheet(req, res, pathname, method, authState)) return;
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
  leadStore.loadLeads();
  server.listen(PORT, HOST, () => {
    console.log(`Máy chủ Mai Sơn Solar đang chạy tại:`);
    console.log(`  • Trang tư vấn: http://localhost:${PORT}/`);
    console.log(`  • Trang quản trị: http://localhost:${PORT}/admin`);
  });
}

module.exports = server;
