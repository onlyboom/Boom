import { getServerDb } from './_lib/db.js';
import { normalizePhone, readJsonBody, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const phone = normalizePhone(body.phone);
    const customerName = String(body.customerName || '').trim() || 'Khách Cửa Hàng';
    const address = String(body.address || '').trim();
    const note = String(body.note || '').trim();
    const handlerAccountId = String(body.handlerAccountId || '').trim();
    const customerUid = String(body.customerUid || '').trim();
    const zaloName = String(body.zaloName || '').trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!phone || phone.length < 8) {
      return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập số điện thoại Zalo hợp lệ!' });
    }
    if (rawItems.length === 0) {
      return sendJson(res, 400, { ok: false, error: 'Giỏ hàng đang trống!' });
    }

    const cleanItems = rawItems
      .map((it) => ({
        id: it.id ?? '',
        key: String(it.key || ''),
        code: String(it.code || ''),
        name: String(it.name || ''),
        warehouseName: String(it.warehouseName || 'A_long'),
        relPath: String(it.relPath || ''),
        qty: Math.max(1, parseInt(it.qty, 10) || 1)
      }))
      .filter((it) => it.qty > 0);

    const orderCode =
      String(body.orderCode || '').trim() || `AG-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const { db } = getServerDb();

    const insertRow = {
      order_code: orderCode,
      customer_name: customerName,
      phone,
      address,
      note,
      handler_account_id: handlerAccountId,
      customer_uid: customerUid,
      items: cleanItems,
      status: 'pending'
    };

    const { error } = await db.from('zaloshop_orders').insert([insertRow]);
    if (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }

    // Tự động lưu / cập nhật hồ sơ khách hàng (nếu bảng zaloshop_customers đã tồn tại)
    await db
      .from('zaloshop_customers')
      .upsert(
        [
          {
            phone,
            customer_name: customerName,
            zalo_name: zaloName,
            customer_uid: customerUid,
            address,
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: 'phone' }
      )
      .catch(() => {});

    return sendJson(res, 200, {
      ok: true,
      orderCode,
      message: `Đã gửi đơn ${orderCode} thành công!`
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi server khi tạo đơn hàng' });
  }
}
