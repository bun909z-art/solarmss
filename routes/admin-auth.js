'use strict';

const auth = require('../lib/auth');
const store = require('../lib/store');
const telegram = require('../lib/telegram');
const { sendJson, readJsonBody, requireAdmin } = require('../lib/http-helpers');

async function handleAdminAuth(req, res, pathname, method, authState) {
  if (pathname === '/api/admin/me' && method === 'GET') {
    const user = auth.getSessionUser(req, authState);
    return sendJson(res, 200, {
      authenticated: Boolean(user),
      username: user ? user.username : null,
      user: user || null
    }), true;
  }

  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await readJsonBody(req, 16 * 1024);
    const username = String(body.username !== undefined ? body.username : 'admin').trim().toLowerCase();
    if (!username) return sendJson(res, 400, { error: 'Vui lòng nhập tên đăng nhập.' }), true;
    const password = String(body.password || '');
    const found = (authState.users || []).find(u => u && String(u.username).toLowerCase() === username);
    if (!found || !auth.verifyPassword(password, found.passwordHash)) {
      return sendJson(res, 401, { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' }), true;
    }
    if (found.active === false) {
      return sendJson(res, 403, { error: 'Tài khoản này đang bị tạm khóa. Liên hệ Admin.' }), true;
    }
    const token = auth.createSessionToken(authState.sessionSecret, found.username);
    auth.setSessionCookie(res, token, req);
    const safeUser = {
      username: found.username,
      displayName: found.displayName || found.username,
      role: found.role === 'admin' ? 'admin' : 'staff',
      permissions: found.role === 'admin' ? auth.ALL_PERMISSIONS.slice() : (Array.isArray(found.permissions) ? found.permissions : [])
    };
    return sendJson(res, 200, { ok: true, username: safeUser.username, user: safeUser, token }), true;
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    auth.revokeSession(req);
    auth.clearSessionCookie(res, req);
    return sendJson(res, 200, { ok: true }), true;
  }

  if (pathname === '/api/admin/password' && method === 'POST') {
    const curUser = requireAdmin(req, res, authState);
    if (!curUser) return true;
    const body = await readJsonBody(req, 16 * 1024);
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const record = (authState.users || []).find(u => u && String(u.username).toLowerCase() === curUser.username.toLowerCase());
    if (!record || !auth.verifyPassword(currentPassword, record.passwordHash)) {
      return sendJson(res, 400, { error: 'Mật khẩu hiện tại không đúng.' }), true;
    }
    if (newPassword.length < 6) {
      return sendJson(res, 400, { error: 'Mật khẩu mới cần tối thiểu 6 ký tự.' }), true;
    }
    record.passwordHash = auth.hashPassword(newPassword);
    if (record.username === 'admin') authState.passwordHash = record.passwordHash;
    store.saveAuth(authState);
    return sendJson(res, 200, { ok: true, message: 'Đã cập nhật mật khẩu thành công.' }), true;
  }

  // SUPER ADMIN ONLY: Manage user accounts & RBAC permissions
  if (pathname === '/api/admin/users' && method === 'GET') {
    if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return true;
    const list = (authState.users || []).map(u => ({
      username: u.username,
      displayName: u.displayName || u.username,
      role: u.role === 'admin' ? 'admin' : 'staff',
      permissions: u.role === 'admin' ? auth.ALL_PERMISSIONS.slice() : (Array.isArray(u.permissions) ? u.permissions : []),
      active: u.active !== false,
      protected: Boolean(u.protected || String(u.username).toLowerCase() === 'admin'),
      createdAt: u.createdAt || ''
    }));
    return sendJson(res, 200, { users: list }), true;
  }

  if (pathname === '/api/admin/users' && method === 'POST') {
    if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return true;
    const body = await readJsonBody(req, 32 * 1024);
    const username = String(body.username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const displayName = String(body.displayName || username).trim().slice(0, 80);
    const password = String(body.password || '');
    const role = body.role === 'admin' ? 'admin' : 'staff';
    const permissions = role === 'admin'
      ? auth.ALL_PERMISSIONS.slice()
      : (Array.isArray(body.permissions) ? body.permissions.filter(p => auth.ALL_PERMISSIONS.includes(p)) : []);

    if (username.length < 3) return sendJson(res, 400, { error: 'Tên đăng nhập tối thiểu 3 ký tự (chữ thường, số, ., _, -).' }), true;
    if (password.length < 6) return sendJson(res, 400, { error: 'Mật khẩu tối thiểu 6 ký tự.' }), true;
    if ((authState.users || []).some(u => String(u.username).toLowerCase() === username)) {
      return sendJson(res, 400, { error: 'Tên đăng nhập đã tồn tại.' }), true;
    }
    authState.users.push({
      username,
      displayName: displayName || username,
      passwordHash: auth.hashPassword(password),
      role,
      permissions,
      active: true,
      protected: false,
      createdAt: new Date().toISOString()
    });
    store.saveAuth(authState);
    return sendJson(res, 200, { ok: true }), true;
  }

  if (pathname === '/api/admin/users' && (method === 'PUT' || method === 'PATCH')) {
    if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return true;
    const body = await readJsonBody(req, 32 * 1024);
    const target = String(body.username || '').trim().toLowerCase();
    const record = (authState.users || []).find(u => String(u.username).toLowerCase() === target);
    if (!record) return sendJson(res, 404, { error: 'Không tìm thấy tài khoản.' }), true;
    const isRoot = Boolean(record.protected || target === 'admin');
    if (body.displayName !== undefined) record.displayName = String(body.displayName).trim().slice(0, 80) || record.username;
    if (!isRoot) {
      if (body.role !== undefined) record.role = body.role === 'admin' ? 'admin' : 'staff';
      if (body.active !== undefined) record.active = Boolean(body.active);
      if (Array.isArray(body.permissions)) {
        record.permissions = record.role === 'admin'
          ? auth.ALL_PERMISSIONS.slice()
          : body.permissions.filter(p => auth.ALL_PERMISSIONS.includes(p));
      }
    }
    if (body.newPassword && String(body.newPassword).length >= 6) {
      record.passwordHash = auth.hashPassword(String(body.newPassword));
      if (isRoot) authState.passwordHash = record.passwordHash;
    }
    store.saveAuth(authState);
    return sendJson(res, 200, { ok: true }), true;
  }

  if (pathname === '/api/admin/users' && method === 'DELETE') {
    const curUser = requireAdmin(req, res, authState, 'SUPER_ADMIN');
    if (!curUser) return true;
    const body = await readJsonBody(req, 16 * 1024);
    const target = String(body.username || '').trim().toLowerCase();
    if (target === 'admin' || target === curUser.username.toLowerCase()) {
      return sendJson(res, 400, { error: 'Không thể xóa tài khoản Admin gốc hoặc tài khoản đang đăng nhập.' }), true;
    }
    authState.users = (authState.users || []).filter(u => String(u.username).toLowerCase() !== target);
    store.saveAuth(authState);
    return sendJson(res, 200, { ok: true }), true;
  }


  // SUPER ADMIN ONLY: Telegram Bot notification settings & test
  if (pathname === '/api/admin/telegram' && method === 'GET') {
    if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return true;
    return sendJson(res, 200, { telegram: authState.telegram || { enabled: false, botToken: '', chatId: '', onlyWithContactOrCombo: true } }), true;
  }

  if (pathname === '/api/admin/telegram' && (method === 'PUT' || method === 'POST')) {
    if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return true;
    const body = await readJsonBody(req, 16 * 1024);
    authState.telegram = {
      enabled: Boolean(body.enabled),
      botToken: String(body.botToken || '').trim(),
      chatId: String(body.chatId || '').trim(),
      onlyWithContactOrCombo: body.onlyWithContactOrCombo !== false
    };
    store.saveAuth(authState);
    return sendJson(res, 200, { ok: true, telegram: authState.telegram }), true;
  }

  if (pathname === '/api/admin/telegram/test' && method === 'POST') {
    if (!requireAdmin(req, res, authState, 'SUPER_ADMIN')) return true;
    const body = await readJsonBody(req, 16 * 1024);
    const token = String(body.botToken || (authState.telegram && authState.telegram.botToken) || '').trim();
    const chatId = String(body.chatId || (authState.telegram && authState.telegram.chatId) || '').trim();
    try {
      await telegram.sendTelegramMessage(token, chatId, '✅ <b>Kết nối Telegram thành công!</b>\nHệ thống Mai Sơn Solar sẽ tự động gửi thông tin khách hàng &amp; Combo về nhóm/chat này.');
      return sendJson(res, 200, { ok: true, message: 'Đã gửi tin nhắn thử tới Telegram thành công!' }), true;
    } catch (err) {
      return sendJson(res, 400, { error: 'Gửi Telegram thất bại: ' + (err.message || 'Kiểm tra lại Bot Token và Chat ID.') }), true;
    }
  }

  return false;
}

module.exports = { handleAdminAuth };
