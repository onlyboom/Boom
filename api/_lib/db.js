import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://amycyqggsvucaeqamxpx.supabase.co';
const DEFAULT_ANON_FALLBACK = 'sb_publishable_dXwdFDpsK9veF2sLVtbzTA_KrlKwFi7';

let cachedClient = null;
let cachedMode = 'anon';

export function getServerDb() {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || DEFAULT_ANON_FALLBACK).trim();
  const activeKey = serviceKey || anonKey;
  const mode = serviceKey ? 'service_role' : 'anon';

  if (!cachedClient || cachedMode !== mode) {
    cachedClient = createClient(url, activeKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    cachedMode = mode;
  }

  return {
    db: cachedClient,
    hasServiceRole: Boolean(serviceKey),
    url
  };
}

export function mapProductRow(r) {
  const soLuong = Math.max(0, Number(r.so_luong ?? 0));
  return {
    key: String(r.id),
    id: r.item_id ?? r.id,
    warehouseName: r.warehouse_name || 'Blokees',
    code: r.code || `${r.warehouse_name || 'KHO'}#${r.item_id || ''}`,
    category: r.category || 'Chưa phân loại',
    name: r.name || 'Sản phẩm',
    soLuong,
    isOutOfStock: Boolean(r.is_out_of_stock) || soLuong <= 0,
    isVisible: r.is_visible !== false,
    isFeatured: Boolean(r.is_featured),
    giaLe: Math.max(0, Number(r.gia_le ?? 0)),
    giaSi: Math.max(0, Number(r.gia_si ?? 0)),
    giaPdq: Math.max(0, Number(r.gia_pdq ?? 0)),
    donVi: r.don_vi || 'Hộp',
    quyCach: r.quy_cach || '',
    ghiChu: r.ghi_chu || '',
    relPath: r.rel_path || '',
    imageUrl: r.image_url || '/ag-logo.jpg',
    updatedAt: r.updated_at || null
  };
}

export function formatDbWriteError(err, hasServiceRole) {
  const msg = err?.message || String(err || 'Lỗi cơ sở dữ liệu');
  if (!hasServiceRole && /row-level security|permission denied|42501|unauthorized/i.test(msg)) {
    return 'Server chưa được cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY trên Vercel nên RLS đang chặn ghi. Hãy thêm SUPABASE_SERVICE_ROLE_KEY vào Vercel Environment Variables và Redeploy.';
  }
  return msg;
}
