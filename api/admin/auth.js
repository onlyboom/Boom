import {
  clearAdminCookie,
  createSessionToken,
  isAdminRequest,
  setAdminCookie,
  verifyPasscode
} from '../_lib/auth.js';
import { getServerDb } from '../_lib/db.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const authed = isAdminRequest(req);
    const { hasServiceRole } = getServerDb();
    return sendJson(res, 200, {
      ok: true,
      authenticated: authed,
      serverDbReady: hasServiceRole
    });
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (!verifyPasscode(body.passcode)) {
        return sendJson(res, 401, { ok: false, error: 'Sai mã quản trị!' });
      }
      const token = createSessionToken();
      setAdminCookie(res, token);
      const { hasServiceRole } = getServerDb();
      return sendJson(res, 200, {
        ok: true,
        authenticated: true,
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
