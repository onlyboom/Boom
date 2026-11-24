import crypto from 'node:crypto';
import { formatDbWriteError, getServerDb } from './_lib/db.js';
import { readJsonBody, sendJson } from './_lib/http.js';
import { validateRealVnPhone } from './_lib/phoneValidator.js';

const COOKIE_NAME = 'ag_customer_session';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

function getSecret() {
  return (
    process.env.ADMIN_TOKEN_SECRET ||
    `${process.env.SUPABASE_SERVICE_ROLE_KEY || 'local-dev'}:agstore-customer-v1`
  );
}

function sign(b64) {
  return crypto.createHmac('sha256', getSecret()).update(b64).digest('base64url');
}

function createCustomerToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    phone: user.phone,
    full_name: user.full_name || user.username,
    address: user.address || '',
    exp: Date.now() + TOKEN_TTL_MS
  };
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${b64}.${sign(b64)}`;
}

function parseCustomerSession(req) {
  const header = String(req.headers?.cookie || '');
  let token = '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === COOKIE_NAME) {
      token = decodeURIComponent(part.slice(idx + 1).trim());
      break;
    }
  }
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = sign(b64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    return Number(parsed?.exp) > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function setCustomerCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const maxAge = Math.floor(TOKEN_TTL_MS / 1000);
  const attrs = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (isProd) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearCustomerCookie(res) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const attrs = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isProd) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export default async function handler(req, res) {
  // GET /api/account -> Kiểm tra phiên đăng nhập khách hàng
  if (req.method === 'GET') {
    const session = parseCustomerSession(req);
    return sendJson(res, 200, {
      ok: true,
      authenticated: Boolean(session),
      user: session
        ? {
            id: session.id,
            username: session.username,
            phone: session.phone,
            full_name: session.full_name,
            address: session.address
          }
        : null
    });
  }

  // DELETE /api/account -> Đăng xuất khách hàng
  if (req.method === 'DELETE') {
    clearCustomerCookie(res);
    return sendJson(res, 200, { ok: true, authenticated: false });
  }

  // POST /api/account -> action: 'register' | 'login'
  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const action = String(body.action || 'login').trim().toLowerCase();
      const { db, hasServiceRole } = getServerDb();

      if (action === 'register') {
        const username = String(body.username || '').trim();
        const fullName = String(body.full_name || body.fullName || username).trim();
        const address = String(body.address || '').trim();
        const password = String(body.password || '');

        if (!/^[a-zA-Z0-9_.-]{4,24}$/.test(username)) {
          return sendJson(res, 400, {
            ok: false,
            error: 'Tên đăng nhập từ 4–24 ký tự, chỉ gồm chữ không dấu, số và dấu gạch dưới (_).'
          });
        }
        const phoneCheck = validateRealVnPhone(body.phone);
        if (!phoneCheck.valid) {
          return sendJson(res, 400, { ok: false, error: phoneCheck.error });
        }
        if (address.length < 8) {
          return sendJson(res, 400, {
            ok: false,
            error: 'Vui lòng nhập địa chỉ chi tiết đầy đủ (số nhà/đường, phường/xã, quận/huyện, tỉnh/TP).'
          });
        }
        if (password.length < 6) {
          return sendJson(res, 400, { ok: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
        }

        const { data, error } = await db.rpc('register_zaloshop_customer', {
          p_username: username,
          p_phone: phoneCheck.phone,
          p_address: address,
          p_password: password,
          p_full_name: fullName
        });

        if (error) {
          const msg = error.message || '';
          if (/unique|already exists|duplicate|23505/i.test(msg)) {
            return sendJson(res, 409, {
              ok: false,
              error: 'Tên đăng nhập hoặc số điện thoại này đã được đăng ký trước đó!'
            });
          }
          return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
        }

        const user = Array.isArray(data) ? data[0] : data;
        if (!user) {
          return sendJson(res, 500, { ok: false, error: 'Không tạo được tài khoản trên máy chủ.' });
        }

        // Đồng bộ ngay vào bảng zaloshop_customers để Admin & Localhost thấy lập tức
        try {
          await db.from('zaloshop_customers').upsert(
            [
              {
                phone: user.phone,
                customer_name: user.full_name || user.username,
                address: user.address,
                note: `Tài khoản web: @${user.username} (đăng ký mới)`,
                updated_at: new Date().toISOString()
              }
            ],
            { onConflict: 'phone' }
          );
        } catch {}

        const token = createCustomerToken(user);
        setCustomerCookie(res, token);
        return sendJson(res, 200, { ok: true, authenticated: true, user });
      }

      // LOGIN (bằng username hoặc SĐT + mật khẩu)
      const identifier = String(body.identifier || body.username || body.phone || '').trim();
      const password = String(body.password || '');
      if (!identifier || !password) {
        return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập tên đăng nhập (hoặc SĐT) và mật khẩu.' });
      }

      const { data, error } = await db.rpc('verify_zaloshop_customer', {
        p_identifier: identifier,
        p_password: password
      });

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }

      const user = Array.isArray(data) ? data[0] : data;
      if (!user) {
        return sendJson(res, 401, { ok: false, error: 'Sai tên đăng nhập/SĐT hoặc mật khẩu!' });
      }

      const token = createCustomerToken(user);
      setCustomerCookie(res, token);
      return sendJson(res, 200, { ok: true, authenticated: true, user });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi máy chủ xử lý tài khoản' });
    }
  }

  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}
