import { requireAdmin } from '../_lib/auth.js';
import { formatDbWriteError, getServerDb } from '../_lib/db.js';
import { getQuery, normalizePhone, readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  const { db, hasServiceRole } = getServerDb();

  try {
    if (req.method === 'GET') {
      const [custRes, ordRes] = await Promise.all([
        db.from('zaloshop_customers').select('*').order('updated_at', { ascending: false }),
        db.from('zaloshop_orders').select('id,order_code,customer_name,phone,address,customer_uid,zalo_name,items,status,created_at').order('created_at', { ascending: false }).limit(1000)
      ]);

      // Nếu bảng zaloshop_orders chưa có cột zalo_name thì fallback query cũ
      let orders = ordRes.data || [];
      if (ordRes.error && /column .* does not exist/i.test(ordRes.error.message || '')) {
        const retry = await db
          .from('zaloshop_orders')
          .select('id,order_code,customer_name,phone,address,customer_uid,items,status,created_at')
          .order('created_at', { ascending: false })
          .limit(1000);
        orders = retry.data || [];
      }

      const byPhone = new Map();
      const savedCustomers = Array.isArray(custRes.data) ? custRes.data : [];

      for (const c of savedCustomers) {
        const phone = normalizePhone(c.phone);
        if (!phone) continue;
        byPhone.set(phone, {
          id: c.id,
          phone,
          customer_name: c.customer_name || 'Khách Cửa Hàng',
          zalo_name: c.zalo_name || '',
          customer_uid: c.customer_uid || '',
          address: c.address || '',
          note: c.note || '',
          order_count: 0,
          total_qty: 0,
          last_order_at: null,
          updated_at: c.updated_at || c.created_at || null,
          saved_in_table: true
        });
      }

      for (const o of orders) {
        const phone = normalizePhone(o.phone);
        if (!phone) continue;
        const qtySum = Array.isArray(o.items)
          ? o.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
          : 0;

        if (!byPhone.has(phone)) {
          byPhone.set(phone, {
            id: `order-derived-${phone}`,
            phone,
            customer_name: o.customer_name || 'Khách Cửa Hàng',
            zalo_name: o.zalo_name || '',
            customer_uid: o.customer_uid || '',
            address: o.address || '',
            note: '',
            order_count: 0,
            total_qty: 0,
            last_order_at: o.created_at || null,
            updated_at: o.created_at || null,
            saved_in_table: false
          });
        }

        const rec = byPhone.get(phone);
        rec.order_count += 1;
        rec.total_qty += qtySum;
        if (!rec.last_order_at || (o.created_at && o.created_at > rec.last_order_at)) {
          rec.last_order_at = o.created_at;
        }
        if (!rec.address && o.address) rec.address = o.address;
        if (!rec.customer_uid && o.customer_uid) rec.customer_uid = o.customer_uid;
        if (!rec.zalo_name && o.zalo_name) rec.zalo_name = o.zalo_name;
      }

      const customers = Array.from(byPhone.values()).sort((a, b) => {
        const ta = a.last_order_at || a.updated_at || '';
        const tb = b.last_order_at || b.updated_at || '';
        return tb.localeCompare(ta);
      });

      return sendJson(res, 200, {
        ok: true,
        customers,
        tableReady: !custRes.error
      });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const phone = normalizePhone(body.phone);
      if (!phone) return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập SĐT khách hàng.' });

      const payload = {
        phone,
        customer_name: String(body.customer_name || 'Khách Cửa Hàng').trim(),
        zalo_name: String(body.zalo_name || '').trim(),
        customer_uid: String(body.customer_uid || '').trim(),
        address: String(body.address || '').trim(),
        note: String(body.note || '').trim(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await db
        .from('zaloshop_customers')
        .upsert([payload], { onConflict: 'phone' })
        .select()
        .single();

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, customer: data });
    }

    if (req.method === 'DELETE') {
      const { phone = '', id = '' } = getQuery(req);
      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone && !id) {
        return sendJson(res, 400, { ok: false, error: 'Thiếu SĐT hoặc ID khách hàng cần xóa.' });
      }
      let q = db.from('zaloshop_customers').delete();
      q = cleanPhone ? q.eq('phone', cleanPhone) : q.eq('id', String(id).trim());
      const { error } = await q;
      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi server xử lý khách hàng' });
  }
}
