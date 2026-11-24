import { requireAdmin } from '../_lib/auth.js';
import { formatDbWriteError, getServerDb, mapProductRow } from '../_lib/db.js';
import { getQuery, readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  const { db, hasServiceRole } = getServerDb();

  try {
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('zaloshop_products')
        .select('*')
        .order('item_id', { ascending: true });
      if (error) {
        return sendJson(res, 500, { ok: false, error: error.message });
      }
      const items = (data || []).map(mapProductRow);
      return sendJson(res, 200, { ok: true, items, total: items.length });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const name = String(body.name || '').trim();
      if (!name) return sendJson(res, 400, { ok: false, error: 'Tên sản phẩm không được để trống.' });

      const warehouseName = String(body.warehouseName || 'A_long').trim() || 'A_long';
      const itemId = Number(body.itemId) || Math.floor(1000 + Math.random() * 8999);
      const code = String(body.code || '').trim() || `${warehouseName}#${itemId}`;
      const soLuong = Math.max(0, parseInt(body.soLuong, 10) || 0);
      const id = String(body.id || '').trim() || `${warehouseName}::${Date.now()}_${itemId}`;

      const fullRow = {
        id,
        warehouse_name: warehouseName,
        item_id: itemId,
        code,
        category: String(body.category || 'Hàng nhập').trim() || 'Hàng nhập',
        name,
        so_luong: soLuong,
        is_out_of_stock: soLuong <= 0,
        is_visible: body.isVisible !== false,
        is_featured: Boolean(body.isFeatured),
        ghi_chu: String(body.ghiChu || '').trim(),
        rel_path: String(body.relPath || '').trim(),
        image_url: String(body.imageUrl || '').trim() || '/ag-logo.jpg',
        updated_at: new Date().toISOString()
      };

      let { data, error } = await db.from('zaloshop_products').insert([fullRow]).select().single();
      // Tương thích ngược nếu cột is_visible / is_featured chưa chạy ALTER TABLE
      if (error && /column .* does not exist/i.test(error.message || '')) {
        const { is_visible, is_featured, ...legacyRow } = fullRow;
        const retry = await db.from('zaloshop_products').insert([legacyRow]).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, item: mapProductRow(data) });
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const key = String(body.key || body.id || '').trim();
      if (!key) return sendJson(res, 400, { ok: false, error: 'Thiếu mã khóa sản phẩm (key).' });

      const dbPatch = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) dbPatch.name = String(body.name).trim();
      if (body.code !== undefined) dbPatch.code = String(body.code).trim();
      if (body.warehouseName !== undefined) dbPatch.warehouse_name = String(body.warehouseName).trim();
      if (body.category !== undefined) dbPatch.category = String(body.category).trim();
      if (body.soLuong !== undefined) {
        const qty = Math.max(0, parseInt(body.soLuong, 10) || 0);
        dbPatch.so_luong = qty;
        dbPatch.is_out_of_stock = qty <= 0;
      }
      if (body.isOutOfStock !== undefined) dbPatch.is_out_of_stock = Boolean(body.isOutOfStock);
      if (body.isVisible !== undefined) dbPatch.is_visible = Boolean(body.isVisible);
      if (body.isFeatured !== undefined) dbPatch.is_featured = Boolean(body.isFeatured);
      if (body.ghiChu !== undefined) dbPatch.ghi_chu = String(body.ghiChu);
      if (body.imageUrl !== undefined) dbPatch.image_url = String(body.imageUrl).trim() || '/ag-logo.jpg';

      let { data, error } = await db
        .from('zaloshop_products')
        .update(dbPatch)
        .eq('id', key)
        .select()
        .single();

      if (error && /column .* does not exist/i.test(error.message || '')) {
        const { is_visible, is_featured, ...legacyPatch } = dbPatch;
        const retry = await db
          .from('zaloshop_products')
          .update(legacyPatch)
          .eq('id', key)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, item: data ? mapProductRow(data) : null });
    }

    if (req.method === 'DELETE') {
      const { id = '' } = getQuery(req);
      let key = String(id || '').trim();
      if (!key) {
        const body = await readJsonBody(req).catch(() => ({}));
        key = String(body.key || body.id || '').trim();
      }
      if (!key) return sendJson(res, 400, { ok: false, error: 'Thiếu mã khóa sản phẩm cần xóa.' });

      const { error } = await db.from('zaloshop_products').delete().eq('id', key);
      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, deletedId: key });
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi server xử lý sản phẩm' });
  }
}
