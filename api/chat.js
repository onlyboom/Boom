import { extractVietnamesePhone, generateSalesReplyWithFailover } from './_lib/aiFailover.js';
import { getServerDb, mapProductRow } from './_lib/db.js';
import { getQuery, normalizePhone, readJsonBody, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  const { db } = getServerDb();

  // GET /api/chat?sessionId=... -> Tải lại lịch sử chat (bao gồm tin nhắn Admin vừa trả lời)
  if (req.method === 'GET') {
    const { sessionId = '' } = getQuery(req);
    const sid = String(sessionId || '').trim();
    if (!sid) return sendJson(res, 400, { ok: false, error: 'Thiếu sessionId' });

    try {
      const [sessRes, msgRes] = await Promise.all([
        db.from('zaloshop_chat_sessions').select('session_id,customer_name,phone,ai_paused,status').eq('session_id', sid).maybeSingle(),
        db
          .from('zaloshop_chat_messages')
          .select('id,sender,content,created_at')
          .eq('session_id', sid)
          .order('created_at', { ascending: true })
          .limit(100)
      ]);

      return sendJson(res, 200, {
        ok: true,
        session: sessRes.data || null,
        messages: Array.isArray(msgRes.data) ? msgRes.data : []
      });
    } catch {
      return sendJson(res, 200, { ok: true, session: null, messages: [] });
    }
  }

  // POST /api/chat -> Nhận tin nhắn khách, tự động chuyển ngầm AI nếu hết token, lưu DB & trả khách về Admin
  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const sessionId = String(body.sessionId || '').trim() || `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const message = String(body.message || '').trim();
      const inputName = String(body.customerName || '').trim();
      const inputPhone = normalizePhone(body.phone || '');
      const pagePath = String(body.pagePath || '/').slice(0, 120);

      if (!message) {
        return sendJson(res, 400, { ok: false, error: 'Nội dung tin nhắn không được để trống.' });
      }
      if (message.length > 1500) {
        return sendJson(res, 400, { ok: false, error: 'Tin nhắn quá dài (tối đa 1500 ký tự).' });
      }

      const detectedPhone = inputPhone || extractVietnamesePhone(message);
      const nowIso = new Date().toISOString();

      // 1. Lấy phiên cũ (nếu có) + lịch sử hội thoại + danh mục sản phẩm hiện có
      const [existingSessRes, historyRes, prodRes] = await Promise.all([
        db.from('zaloshop_chat_sessions').select('*').eq('session_id', sessionId).maybeSingle(),
        db
          .from('zaloshop_chat_messages')
          .select('sender,content,created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(20),
        db.from('zaloshop_products').select('*').order('item_id', { ascending: true }).limit(200)
      ]);

      const existingSess = existingSessRes.data || null;
      const finalName = inputName || existingSess?.customer_name || 'Khách Web';
      const finalPhone = detectedPhone || existingSess?.phone || '';
      const aiPaused = Boolean(existingSess?.ai_paused);
      const history = Array.isArray(historyRes.data) ? historyRes.data : [];
      const products = Array.isArray(prodRes.data) ? prodRes.data.map(mapProductRow) : [];

      // 2. Lưu/cập nhật phiên chat & tin nhắn của khách vào DB (để Admin thấy ngay)
      const sessionUpsert = {
        session_id: sessionId,
        customer_name: finalName,
        phone: finalPhone,
        page_path: pagePath,
        last_message: message.slice(0, 300),
        last_sender: 'customer',
        unread_admin: (Number(existingSess?.unread_admin || 0) || 0) + 1,
        needs_human: Boolean(existingSess?.needs_human) || Boolean(finalPhone),
        status: existingSess?.status || 'open',
        updated_at: nowIso
      };

      await db.from('zaloshop_chat_sessions').upsert([sessionUpsert], { onConflict: 'session_id' }).catch(() => {});
      await db
        .from('zaloshop_chat_messages')
        .insert([{ session_id: sessionId, sender: 'customer', content: message }])
        .catch(() => {});

      // 3. Nếu khách để lại SĐT -> tự động đẩy sang bảng Khách hàng (zaloshop_customers) cho Admin chăm sóc!
      if (finalPhone) {
        await db
          .from('zaloshop_customers')
          .upsert(
            [
              {
                phone: finalPhone,
                customer_name: finalName,
                note: `Khách hỏi từ Chatbox Web: "${message.slice(0, 120)}"`,
                updated_at: nowIso
              }
            ],
            { onConflict: 'phone' }
          )
          .catch(() => {});
      }

      // 4. Nếu Admin đã tiếp quản chat tay (ai_paused = true), không để AI chen ngang
      if (aiPaused) {
        return sendJson(res, 200, {
          ok: true,
          sessionId,
          aiPaused: true,
          reply: '',
          phoneCaptured: Boolean(finalPhone)
        });
      }

      // 5. Gọi AI Bán Hàng với cơ chế tự động chuyển ngầm khi hết token / quota
      const aiResult = await generateSalesReplyWithFailover({
        userMessage: message,
        history,
        products,
        customerInfo: { customerName: finalName, phone: finalPhone }
      });

      const replyIso = new Date().toISOString();
      await db
        .from('zaloshop_chat_messages')
        .insert([
          {
            session_id: sessionId,
            sender: 'ai',
            content: aiResult.reply,
            ai_provider: aiResult.provider,
            ai_model: aiResult.model
          }
        ])
        .catch(() => {});

      await db
        .from('zaloshop_chat_sessions')
        .update({
          last_message: aiResult.reply.slice(0, 300),
          last_sender: 'ai',
          ai_provider: aiResult.provider,
          ai_model: aiResult.model,
          updated_at: replyIso
        })
        .eq('session_id', sessionId)
        .catch(() => {});

      return sendJson(res, 200, {
        ok: true,
        sessionId,
        reply: aiResult.reply,
        phoneCaptured: Boolean(finalPhone)
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi máy chủ xử lý chat' });
    }
  }

  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}
