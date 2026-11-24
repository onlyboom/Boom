import {
  clearAdminCookie,
  createSessionToken,
  getAdminSession,
  setAdminCookie,
  verifyPasscode
} from '../_lib/auth.js';
import { getServerDb } from '../_lib/db.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

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

      // 1. Xác thực trực tiếp trên PostgreSQL (hàm RPC verify_zaloshop_admin dùng bcrypt)
      const { data: rpcData, error: rpcError } = await db.rpc('verify_zaloshop_admin', {
        p_username: username,
        p_password: password
      });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        verifiedUsername = rpcData[0].username || username;
      } else if (rpcError) {
        // Nếu người dùng chưa chạy SQL tạo hàm verify_zaloshop_admin, báo rõ nguyên nhân
        const msg = rpcError.message || '';
        if (/Could not find the function|does not exist/i.test(msg)) {
          // Cho phép fallback bằng ADMIN_PASSCODE khi chưa chạy SQL
          if (verifyPasscode(password)) {
            verifiedUsername = username;
          } else {
            return sendJson(res, 401, {
              ok: false,
              error: 'Chưa chạy lệnh SQL tạo tài khoản admin trên Supabase (hoặc sai mật khẩu).'
            });
          }
        } else {
          return sendJson(res, 500, { ok: false, error: `Lỗi xác thực máy chủ: ${msg}` });
        }
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

  if (req.method === 'DELETE') {
    clearAdminCookie(res);
    return sendJson(res, 200, { ok: true, authenticated: false });
  }

  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}
