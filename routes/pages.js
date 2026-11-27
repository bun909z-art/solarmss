'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('../lib/auth');
const store = require('../lib/store');
const { PUBLIC_DIR, checkMaintenanceGate, serveThemedHtml, serveFile } = require('../lib/http-helpers');

const consultationPaths = new Set(['/', '/tuvan', '/tuvan/', '/index.html']);
const adminPaths = new Set(['/admin', '/admin/', '/admin.html']);

function handlePagesAndStatic(req, res, pathname, parsedUrl) {
  if (consultationPaths.has(pathname)) {
    const preview = parsedUrl.searchParams.get('preview') === '1';
    if (preview && !auth.getSessionUser(req, store.loadAuth())) {
      res.writeHead(302, { Location: pathname, 'Cache-Control': 'no-store' });
      res.end();
      return true;
    }
    const config = store.loadConfig();
    if (!preview && checkMaintenanceGate(res, config)) return true;
    serveThemedHtml(res, path.join(PUBLIC_DIR, 'index.html'), config);
    return true;
  }

  if (adminPaths.has(pathname)) {
    serveFile(res, path.join(PUBLIC_DIR, 'admin.html'));
    return true;
  }

  if (pathname.startsWith('/uploads/')) {
    const { logoUrl, faviconUrl } = store.loadConfig().branding;
    const brandAssets = [logoUrl, faviconUrl].map(url => String(url || '').split(/[?#]/, 1)[0]);
    if (!brandAssets.includes(pathname)) return false;
  }

  if (/^\/(assets|css|js|uploads)\//.test(pathname)) {
    const candidate = path.resolve(PUBLIC_DIR, '.' + pathname);
    if (candidate.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      serveFile(res, candidate);
      return true;
    }
  }
  return false;
}

module.exports = { handlePagesAndStatic };
