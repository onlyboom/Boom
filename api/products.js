import { getServerDb, mapProductRow } from './_lib/db.js';
import { getQuery, sendJson } from './_lib/http.js';
import { handleLicenseRequest } from './_lib/licenseHandler.js';

export default async function handler(req, res) {
  const q = getQuery(req);
  if (q.licenseRoute === '1' || ['plans', 'verify', 'create-payment', 'check-payment', 'claim-payment', 'support-chat', 'download'].includes(String(q.action || '').toLowerCase())) {
    return handleLicenseRequest(req, res);
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const { db } = getServerDb();
    const { kho = '' } = getQuery(req);
    const khoClean = String(kho || '').trim();

    let query = db
      .from('zaloshop_products')
      .select('*')
      .order('item_id', { ascending: true });

    if (khoClean && khoClean !== 'ALL') {
      query = query.eq('warehouse_name', khoClean);
    }

    const { data, error } = await query;
    if (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }

    // Chỉ trả về sản phẩm đang bật trưng bày VÀ có ảnh sản phẩm thật (bỏ trống sản phẩm không có ảnh)
    const items = (data || [])
      .map(mapProductRow)
      .filter((p) => {
        if (p.isVisible === false) return false;
        const img = String(p.imageUrl || '').trim();
        if (!img || img === '/ag-logo.jpg' || img.endsWith('/ag-logo.jpg')) return false;
        return true;
      });

    return sendJson(res, 200, {
      ok: true,
      items,
      total: items.length
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi server khi tải sản phẩm' });
  }
}
