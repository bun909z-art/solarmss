'use strict';

const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR, checkMaintenanceGate, serveThemedHtml, serveFile } = require('../lib/http-helpers');

function handlePagesAndStatic(req, res, pathname, parsedUrl) {
  if (pathname === '/' || pathname === '/home' || pathname === '/home.html') {
    if (parsedUrl.searchParams.get('preview') === '1') {
      return serveThemedHtml(res, path.join(PUBLIC_DIR, 'index.html')), true;
    }
    if (checkMaintenanceGate(req, res, pathname, parsedUrl)) return true;
    return serveThemedHtml(res, path.join(PUBLIC_DIR, 'home.html')), true;
  }

  if (pathname === '/tuvan' || pathname === '/tuvan/' || pathname === '/index.html') {
    if (checkMaintenanceGate(req, res, pathname, parsedUrl)) return true;
    return serveThemedHtml(res, path.join(PUBLIC_DIR, 'index.html')), true;
  }

  if (pathname === '/products' || pathname === '/products/' || pathname === '/products.html') {
    if (checkMaintenanceGate(req, res, pathname, parsedUrl)) return true;
    return serveThemedHtml(res, path.join(PUBLIC_DIR, 'products.html')), true;
  }

  if (pathname === '/news' || pathname === '/news/' || pathname === '/news.html') {
    if (checkMaintenanceGate(req, res, pathname, parsedUrl)) return true;
    return serveThemedHtml(res, path.join(PUBLIC_DIR, 'news.html')), true;
  }

  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin.html') {
    return serveFile(res, path.join(PUBLIC_DIR, 'admin.html')), true;
  }

  const safeRel = pathname.replace(/^\/+/, '');
  const candidate = path.join(PUBLIC_DIR, safeRel);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return serveFile(res, candidate), true;
  }

  return false;
}

module.exports = { handlePagesAndStatic };
