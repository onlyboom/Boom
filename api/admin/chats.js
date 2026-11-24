import { requireAdmin } from '../_lib/auth.js';
import { formatDbWriteError, getServerDb } from '../_lib/db.js';
import { getQuery, readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  const { db, hasServiceRole } = getServerDb();

  try {
    // GET /api/admin/chats -> Danh sách phiên chat; hoặc ?sessionId=... để lấy chi tiết tin nhắn
    if (req.method === 'GET') {
      const { sessionId = '' } = getQuery(req);
      const sid = String(sessionId || '').trim();

      if (sid) {
        const { data: messages, error } = await db
          .from('zaloshop_chat_messages')
          .select('*')
          .eq('session_id', sid)
          .order('created_at', { ascending: true })
          .limit(200);

        if (error) {
          if (/Could not find the table|relation .* does not exist/i.test(error.message || '')) {
            return sendJson(res, 200, { ok: true, messages: [], tableReady: false });
          }
          return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
        }

        // Đánh dấu đã đọc khi Admin mở xem phiên chat
        await db.from('zaloshop_chat_sessions').update({ unread_admin: 0 }).eq('session_id', sid).catch(() => {});
        return sendJson(res, 200, { ok: true, messages: messages || [] });
      }

      const { data: sessions, error } = await db
        .from('zaloshop_chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) {
        if (/Could not find the table|relation .* does not exist/i.test(error.message || '')) {
          return sendJson(res, 200, { ok: true, sessions: [], tableReady: false });
        }
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }

      return sendJson(res, 200, { ok: true, sessions: sessions || [], tableReady: true });
    }

    // POST /api/admin/chats -> Admin nhắn tin trả lời trực tiếp cho khách (tự động tạm dừng AI để nhân viên tư vấn)
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const sessionId = String(body.sessionId || '').trim();
      const content = String(body.content || '').trim();
      if (!sessionId || !content) {
        return sendJson(res, 400, { ok: false, error: 'Thiếu sessionId hoặc nội dung trả lời.' });
      }

      const { data: msg, error } = await db
        .from('zaloshop_chat_messages')
        .insert([
          {
            session_id: sessionId,
            sender: 'admin',
            content
          }
        ])
        .select()
        .single();

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }

      await db
        .from('zaloshop_chat_sessions')
        .update({
          last_message: content.slice(0, 300),
          last_sender: 'admin',
          unread_admin: 0,
          ai_paused: body.pauseAi !== false,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);

      return sendJson(res, 200, { ok: true, message: msg });
    }

    // PATCH /api/admin/chats -> Bật/tắt AI tự trả lời, đổi trạng thái phiên hoặc cập nhật tên/SĐT khách
    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const sessionId = String(body.sessionId || '').trim();
      if (!sessionId) return sendJson(res, 400, { ok: false, error: 'Thiếu sessionId.' });

      const patch = { updated_at: new Date().toISOString() };
      if (body.ai_paused !== undefined) patch.ai_paused = Boolean(body.ai_paused);
      if (body.status !== undefined) patch.status = String(body.status);
      if (body.needs_human !== undefined) patch.needs_human = Boolean(body.needs_human);
      if (body.customer_name !== undefined) patch.customer_name = String(body.customer_name).trim();
      if (body.phone !== undefined) patch.phone = String(body.phone).trim();

      const { data, error } = await db
        .from('zaloshop_chat_sessions')
        .update(patch)
        .eq('session_id', sessionId)
        .select()
        .single();

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, session: data });
    }

    // DELETE /api/admin/chats?sessionId=... -> Xóa phiên chat
    if (req.method === 'DELETE') {
      const { sessionId = '' } = getQuery(req);
      const sid = String(sessionId || '').trim();
      if (!sid) return sendJson(res, 400, { ok: false, error: 'Thiếu sessionId cần xóa.' });

      await db.from('zaloshop_chat_messages').delete().eq('session_id', sid);
      const { error } = await db.from('zaloshop_chat_sessions').delete().eq('session_id', sid);
      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi server xử lý hội thoại' });
  }
}
