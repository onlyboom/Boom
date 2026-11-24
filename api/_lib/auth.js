import crypto from 'node:crypto';
import { sendJson } from './http.js';

const COOKIE_NAME = 'ag_admin_session';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

function getPasscode() {
  return (process.env.ADMIN_PASSCODE || 'agstore2026').trim();
}

function getSecret() {
  return (
    process.env.ADMIN_TOKEN_SECRET ||
    `${process.env.SUPABASE_SERVICE_ROLE_KEY || 'local-dev'}:${getPasscode()}:agstore-v2`
  );
}

function signPayload(payloadB64) {
  return crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
}

export function createSessionToken() {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signPayload(b64);
  return `${b64}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [b64, sig] = parts;
  const expected = signPayload(b64);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    return parsed?.role === 'admin' && Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

export function verifyPasscode(input) {
  const expected = getPasscode();
  const a = Buffer.from(String(input || '').trim(), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of String(cookieHeader).split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

export function isAdminRequest(req) {
  const cookies = parseCookies(req.headers?.cookie);
  if (verifySessionToken(cookies[COOKIE_NAME])) return true;
  const auth = String(req.headers?.authorization || '');
  if (auth.startsWith('Bearer ')) {
    return verifySessionToken(auth.slice(7).trim());
  }
  return false;
}

export function setAdminCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const maxAge = Math.floor(TOKEN_TTL_MS / 1000);
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ];
  if (isProd) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearAdminCookie(res) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const attrs = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (isProd) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function requireAdmin(req, res) {
  if (!isAdminRequest(req)) {
    sendJson(res, 401, { ok: false, error: 'Chưa đăng nhập quản trị hoặc phiên đã hết hạn.' });
    return false;
  }
  return true;
}
