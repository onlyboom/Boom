import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://lthmthojuwdhfwwpdnjo.supabase.co';
const DEFAULT_ANON_FALLBACK =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aG10aG9qdXdkaGZ3d3BkbmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0MjM2NDYsImV4cCI6MjExMDk5OTY0Nn0.mLePVfPMOFuNve9mnwmHaJikPINRjKpoOh1xt_DI4Cs';

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
    warehouseName: r.warehouse_name || 'A_long',
    code: r.code || `${r.warehouse_name || 'KHO'}#${r.item_id || ''}`,
    category: r.category || 'Chưa phân loại',
    name: r.name || 'Sản phẩm',
    soLuong,
    isOutOfStock: Boolean(r.is_out_of_stock) || soLuong <= 0,
    isVisible: r.is_visible !== false,
    isFeatured: Boolean(r.is_featured),
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
