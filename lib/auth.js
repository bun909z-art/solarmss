'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'hq_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 ngày
const revokedTokens = new Set();

function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHex] = storedHash.split(':');
  const derived = crypto.scryptSync(String(password), salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

function createSessionToken(secret, username = 'admin') {
  const payload = Buffer.from(JSON.stringify({
    u: username,
    exp: Date.now() + SESSION_TTL_MS
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  });
  return out;
}

function extractToken(req) {
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] || null;
}

function isHttpsRequest(req) {
  if (!req) return false;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https' || Boolean(req.socket && req.socket.encrypted);
}

function setSessionCookie(res, token, req) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secureFlag = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=${maxAge}`
  );
}

function revokeSession(req) {
  const token = extractToken(req);
  if (token) {
    revokedTokens.add(token);
    if (revokedTokens.size > 500) {
      const first = revokedTokens.values().next().value;
      revokedTokens.delete(first);
    }
  }
}

function clearSessionCookie(res, req) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  ]);
}


const ALL_PERMISSIONS = [
  'branding', 'theme', 'layout', 'tariffs', 'leads', 'footer', 'security'
];

function getSessionUser(req, authState) {
  if (!authState || !authState.sessionSecret) return null;
  const token = extractToken(req);
  if (!token || revokedTokens.has(token)) return null;
  const data = verifySessionToken(token, authState.sessionSecret);
  if (!data || !data.u) return null;
  const users = Array.isArray(authState.users) ? authState.users : [];
  const found = users.find(u => u && String(u.username).toLowerCase() === String(data.u).toLowerCase() && u.active !== false);
  if (!found) return null;
  return {
    username: found.username,
    displayName: found.displayName || found.username,
    role: found.role === 'admin' ? 'admin' : 'staff',
    permissions: found.role === 'admin' ? ALL_PERMISSIONS.slice() : (Array.isArray(found.permissions) ? found.permissions.filter(permission => ALL_PERMISSIONS.includes(permission)) : [])
  };
}

function hasPermission(user, required) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!required) return true;
  if (required === 'SUPER_ADMIN') return false;
  const list = Array.isArray(required) ? required : [required];
  return list.some(p => user.permissions.includes(p));
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  revokeSession,
  ALL_PERMISSIONS,
  getSessionUser,
  hasPermission
};
