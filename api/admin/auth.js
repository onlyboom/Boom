import crypto from 'crypto';
import {
  clearAdminCookie,
  createSessionToken,
  getAdminSession,
  setAdminCookie,
  verifyPasscode
} from '../_lib/auth.js';
import { getServerDb } from '../_lib/db.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

function hashPasswordScrypt(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyScryptHash(password, storedHash) {
  if (!storedHash || !String(storedHash).startsWith('scrypt$')) return false;
  const parts = String(storedHash).split('$');
  if (parts.length !== 3) return false;
  const [, salt, hexHash] = parts;
  const derived = crypto.scryptSync(String(password), salt, 64);
  const target = Buffer.from(hexHash, 'hex');
  if (derived.length !== target.length) return false;
  return crypto.timingSafeEqual(derived, target);
}

async function verifyAdminCredentials(db, username, password) {
  // 1. Kiểm tra trước nếu mật khẩu trong bảng zaloshop_admins đã được đổi sang dạng scrypt$
  const { data: rows } = await db
    .from('zaloshop_admins')
    .select('id, username, password_hash, is_active')
    .ilike('username', username)
    .limit(1);
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (row && row.is_active !== false && String(row.password_hash || '').startsWith('scrypt$')) {
    return verifyScryptHash(password, row.password_hash) ? row.username : '';
  }

  // 2. Fallback xác thực bcrypt gốc qua PostgreSQL RPC verify_zaloshop_admin
  const { data: rpcData, error: rpcError } = await db.rpc('verify_zaloshop_admin', {
    p_username: username,
    p_password: password
  });
  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    return rpcData[0].username || username;
  }
  if (rpcError) {
    const msg = rpcError.message || '';
    if (/Could not find the function|does not exist/i.test(msg)) {
      if (verifyPasscode(password)) return username;
      throw new Error('Chưa chạy lệnh SQL tạo tài khoản admin trên Supabase (hoặc sai mật khẩu).');
    }
    throw new Error(`Lỗi xác thực máy chủ: ${msg}`);
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const session = getAdminSession(req);
    const { hasServiceRole } = getServerDb();
    return sendJson(res, 200, {
      ok: true,
      authenticated: Boolean(session),
      username: session?.username || '',
      serverDbReady: hasServiceRole
    });
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || body.passcode || '').trim();

      if (!username || !password) {
        return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu!' });
      }

      const { db, hasServiceRole } = getServerDb();
      let verifiedUsername = '';
      try {
        verifiedUsername = await verifyAdminCredentials(db, username, password);
      } catch (verErr) {
        return sendJson(res, 500, { ok: false, error: verErr.message });
      }

      if (!verifiedUsername) {
        return sendJson(res, 401, { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu!' });
      }

      const token = createSessionToken(verifiedUsername);
      setAdminCookie(res, token);
      return sendJson(res, 200, {
        ok: true,
        authenticated: true,
        username: verifiedUsername,
        serverDbReady: hasServiceRole
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err?.message || 'Dữ liệu đăng nhập không hợp lệ' });
    }
  }

  if (req.method === 'PUT') {
    const session = getAdminSession(req);
    if (!session || !session.username) {
      return sendJson(res, 401, { ok: false, error: 'Vui lòng đăng nhập quản trị trước khi đổi tài khoản / mật khẩu.' });
    }
    try {
      const body = await readJsonBody(req);
      const currentPassword = String(body.currentPassword || '').trim();
      const newUsernameRaw = String(body.newUsername || '').trim();
      const newPassword = String(body.newPassword || '').trim();
      if (!currentPassword) {
        return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập mật khẩu hiện tại để xác nhận!' });
      }
      if (!newUsernameRaw && !newPassword) {
        return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập Tên đăng nhập mới hoặc Mật khẩu mới!' });
      }
      if (newUsernameRaw && !/^[a-zA-Z0-9._-]{3,32}$/.test(newUsernameRaw)) {
        return sendJson(res, 400, { ok: false, error: 'Tên đăng nhập mới phải từ 3–32 ký tự (chữ không dấu, số, dấu . _ -).' });
      }
      if (newPassword && newPassword.length < 6) {
        return sendJson(res, 400, { ok: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự!' });
      }
      const { db } = getServerDb();
      const verified = await verifyAdminCredentials(db, session.username, currentPassword);
      if (!verified) {
        return sendJson(res, 401, { ok: false, error: 'Mật khẩu hiện tại không đúng!' });
      }
      const updates = { updated_at: new Date().toISOString() };
      const finalUsername = newUsernameRaw || session.username;
      if (newUsernameRaw && newUsernameRaw.toLowerCase() !== session.username.toLowerCase()) {
        updates.username = newUsernameRaw;
      }
      if (newPassword) {
        updates.password_hash = hashPasswordScrypt(newPassword);
      }
      const { error: upErr } = await db
        .from('zaloshop_admins')
        .update(updates)
        .ilike('username', session.username);
      if (upErr) {
        return sendJson(res, 500, { ok: false, error: `Lỗi cập nhật: ${upErr.message}` });
      }
      const newToken = createSessionToken(finalUsername);
      setAdminCookie(res, newToken);
      return sendJson(res, 200, {
        ok: true,
        username: finalUsername,
        message: 'Đã cập nhật tài khoản & mật khẩu thành công!'
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err?.message || 'Không thể cập nhật thông tin đăng nhập' });
    }
  }

  if (req.method === 'DELETE') {
    clearAdminCookie(res);
    return sendJson(res, 200, { ok: true, authenticated: false });
  }

  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}
