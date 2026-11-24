import { requireAdmin } from '../_lib/auth.js';
import { formatDbWriteError, getServerDb } from '../_lib/db.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const dataUrl = String(body.dataUrl || '');
    const fileName = String(body.fileName || 'upload.jpg');
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return sendJson(res, 400, { ok: false, error: 'Định dạng ảnh không hợp lệ.' });
    }

    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return sendJson(res, 400, { ok: false, error: 'Ảnh vượt quá 5MB.' });
    }

    const ext =
      (fileName.split('.').pop() || mimeType.split('/')[1] || 'jpg')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'jpg';
    const filePath = `admin/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const { db, hasServiceRole } = getServerDb();
    const { error } = await db.storage.from('zaloshop-images').upload(filePath, buffer, {
      upsert: true,
      contentType: mimeType
    });

    if (error) {
      return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
    }

    const { data } = db.storage.from('zaloshop-images').getPublicUrl(filePath);
    return sendJson(res, 200, { ok: true, url: data.publicUrl });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi server khi upload ảnh' });
  }
}
