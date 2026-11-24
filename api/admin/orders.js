import { requireAdmin } from '../_lib/auth.js';
import { formatDbWriteError, getServerDb } from '../_lib/db.js';
import { getQuery, normalizePhone, readJsonBody, sendJson } from '../_lib/http.js';

const VALID_STATUSES = new Set(['pending', 'confirmed', 'shipping', 'done', 'cancelled']);

async function syncCustomerProfile(db, { phone, customerName, zaloName, customerUid, address }) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return;
  await db
    .from('zaloshop_customers')
    .upsert(
      [
        {
          phone: cleanPhone,
          customer_name: String(customerName || 'Khách Cửa Hàng').trim(),
          zalo_name: String(zaloName || '').trim(),
          customer_uid: String(customerUid || '').trim(),
          address: String(address || '').trim(),
          updated_at: new Date().toISOString()
        }
      ],
      { onConflict: 'phone' }
    )
    .catch(() => {});
}

async function deductStockForItems(db, items) {
  for (const it of items) {
    const prodKey = String(it.key || '').trim();
    const qty = Math.max(0, parseInt(it.qty, 10) || 0);
    if (!prodKey || qty <= 0) continue;
    const { data: prod } = await db
      .from('zaloshop_products')
      .select('id,so_luong')
      .eq('id', prodKey)
      .single();
    if (!prod) continue;
    const nextQty = Math.max(0, Number(prod.so_luong || 0) - qty);
    await db
      .from('zaloshop_products')
      .update({
        so_luong: nextQty,
        is_out_of_stock: nextQty <= 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', prodKey);
  }
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  const { db, hasServiceRole } = getServerDb();

  try {
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('zaloshop_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, orders: data || [] });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const phone = normalizePhone(body.phone);
      const customerName = String(body.customer_name || body.customerName || '').trim() || 'Khách Cửa Hàng';
      if (!phone) return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập SĐT khách hàng.' });

      const rawItems = Array.isArray(body.items) ? body.items : [];
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

      if (cleanItems.length === 0) {
        return sendJson(res, 400, { ok: false, error: 'Đơn hàng phải có ít nhất 1 sản phẩm.' });
      }

      const status = VALID_STATUSES.has(body.status) ? body.status : 'pending';
      const orderCode =
        String(body.order_code || body.orderCode || '').trim() ||
        `AG-${Date.now().toString(36).toUpperCase().slice(-6)}`;

      const row = {
        order_code: orderCode,
        customer_name: customerName,
        phone,
        address: String(body.address || '').trim(),
        note: String(body.note || '').trim(),
        handler_account_id: String(body.handler_account_id || body.handlerAccountId || '').trim(),
        customer_uid: String(body.customer_uid || body.customerUid || '').trim(),
        zalo_name: String(body.zalo_name || body.zaloName || '').trim(),
        items: cleanItems,
        status
      };

      let { data, error } = await db.from('zaloshop_orders').insert([row]).select().single();
      if (error && /column .* does not exist/i.test(error.message || '')) {
        const { zalo_name, ...legacyRow } = row;
        const retry = await db.from('zaloshop_orders').insert([legacyRow]).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }

      if (body.autoDeductStock) {
        await deductStockForItems(db, cleanItems);
      }

      await syncCustomerProfile(db, {
        phone,
        customerName,
        zaloName: row.zalo_name,
        customerUid: row.customer_uid,
        address: row.address
      });

      return sendJson(res, 200, { ok: true, order: data });
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const id = String(body.id || '').trim();
      if (!id) return sendJson(res, 400, { ok: false, error: 'Thiếu ID đơn hàng cần cập nhật.' });

      const patch = {};
      if (body.order_code !== undefined) patch.order_code = String(body.order_code).trim();
      if (body.customer_name !== undefined) patch.customer_name = String(body.customer_name).trim();
      if (body.phone !== undefined) patch.phone = normalizePhone(body.phone);
      if (body.address !== undefined) patch.address = String(body.address).trim();
      if (body.note !== undefined) patch.note = String(body.note).trim();
      if (body.handler_account_id !== undefined) patch.handler_account_id = String(body.handler_account_id).trim();
      if (body.customer_uid !== undefined) patch.customer_uid = String(body.customer_uid).trim();
      if (body.zalo_name !== undefined) patch.zalo_name = String(body.zalo_name).trim();
      if (body.status !== undefined && VALID_STATUSES.has(body.status)) patch.status = body.status;
      if (Array.isArray(body.items)) {
        patch.items = body.items
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
      }

      let { data, error } = await db
        .from('zaloshop_orders')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error && /column .* does not exist/i.test(error.message || '')) {
        const { zalo_name, ...legacyPatch } = patch;
        const retry = await db
          .from('zaloshop_orders')
          .update(legacyPatch)
          .eq('id', id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }

      if (data?.phone) {
        await syncCustomerProfile(db, {
          phone: data.phone,
          customerName: data.customer_name,
          zaloName: data.zalo_name || body.zalo_name || '',
          customerUid: data.customer_uid,
          address: data.address
        });
      }

      return sendJson(res, 200, { ok: true, order: data });
    }

    if (req.method === 'DELETE') {
      const { id = '' } = getQuery(req);
      let targetId = String(id || '').trim();
      if (!targetId) {
        const body = await readJsonBody(req).catch(() => ({}));
        targetId = String(body.id || '').trim();
      }
      if (!targetId) return sendJson(res, 400, { ok: false, error: 'Thiếu ID đơn hàng cần xóa.' });

      const { error } = await db.from('zaloshop_orders').delete().eq('id', targetId);
      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, deletedId: targetId });
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi server xử lý đơn hàng' });
  }
}
