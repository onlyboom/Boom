import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://lthmthojuwdhfwwpdnjo.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aG10aG9qdXdkaGZ3d3BkbmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0MjM2NDYsImV4cCI6MjExMDk5OTY0Nn0.mLePVfPMOFuNve9mnwmHaJikPINRjKpoOh1xt_DI4Cs';

export const ADMIN_PASSCODE = import.meta.env.VITE_ADMIN_PASSCODE || 'agstore2026';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LOCAL_POSTS_KEY = 'agstore_local_posts_v1';
const LOCAL_PRODUCT_OVERRIDES_KEY = 'agstore_local_product_overrides_v1';

export const DEFAULT_SAMPLE_POSTS = [
  {
    id: 'sample-1',
    slug: 'huong-dan-nhap-si-mo-hinh-blokees-tan-xuong',
    title: 'Hướng dẫn nhập sỉ mô hình lắp ghép Blokees & Transformers tận xưởng',
    category: 'Kinh nghiệm nhập sỉ',
    excerpt:
      'Tổng hợp các dòng Blokees Classic Class bán chạy nhất, cách trộn mẫu linh hoạt không cần ôm số lượng lớn và quy trình giữ kho qua Zalo.',
    content:
      'Mô hình lắp ghép sưu tầm (Blokees, Transformers, Gundam, Lego) đang là nhóm hàng có biên lợi nhuận tốt và tệp khách mua lặp lại rất cao.\n\nTại AG STORE, các chủ shop và CTV có thể:\n1. Xem trực tiếp tồn kho thực tế 100% cập nhật mỗi 15 giây.\n2. Trộn mẫu linh hoạt nhiều dòng trong cùng 1 đơn hàng.\n3. Đặt giữ hàng ngay trên web và nhận Phiếu Báo Giá Tổng Bill sỉ / nguyên thùng riêng qua Zalo.\n\nMọi thùng hàng đều được đóng gói chống móp hộp cẩn thận, hỗ trợ kiểm tra hàng trước khi thanh toán trên toàn quốc.',
    cover_url: '/ag-logo.jpg',
    published: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'sample-2',
    slug: 'chinh-sach-dong-goi-chong-mop-hop-toan-quoc',
    title: 'Quy chuẩn đóng gói chống móp hộp & giao nhanh toàn quốc tại AG STORE',
    category: 'Chính sách kho',
    excerpt:
      'Với dòng mô hình sưu tầm, form hộp đẹp quyết định 50% giá trị bán ra. Xem quy trình bọc xốp và xuất kho trong ngày của chúng tôi.',
    content:
      'Hiểu rõ nỗi lo móp méo vỏ hộp khi vận chuyển đường dài của các shop mô hình, AG STORE áp dụng quy chuẩn đóng thùng 3 lớp:\n\n- Bọc chống sốc góc hộp cho từng mã lẻ.\n- Xếp chèn xốp chống xê dịch trong thùng carton 5 lớp.\n- Chụp ảnh bill & kiện hàng gửi xác nhận trực tiếp qua Zalo trước khi bàn giao vận chuyển.\n\nKhách đặt đơn trước 16h00 được ưu tiên xuất kho ngay trong ngày.',
    cover_url: '/ag-logo.jpg',
    published: true,
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'sample-3',
    slug: 'top-mau-do-choi-lap-ghep-hot-trend-thang-nay',
    title: 'Top mẫu mô hình lắp ghép hot trend được các shop nhập nhiều nhất',
    category: 'Tin kho hàng',
    excerpt:
      'Điểm danh những mã Blokees và bộ lắp ráp tổng hợp có tốc độ ra đơn nhanh, dễ trưng bày tại quầy và bán tốt trên livestream.',
    content:
      'Trong tháng này, các mã Blokees Transformers Classic Class và dòng lắp ghép chủ đề quân sự / robot tiếp tục dẫn đầu lượng đặt sỉ tại kho A_long.\n\nMẹo giúp shop tăng doanh số nhanh:\n- Nhập đa dạng 10–15 mã trưng bày kệ để tạo hiệu ứng sưu tầm trọn bộ.\n- Quay video mở hộp ngắn 15 giây đăng nhóm Zalo / TikTok.\n- Giữ sẵn các mã chủ lực có tồn kho cao để không bị đứt hàng khi khách chốt đơn.\n\nBấm vào mục Cửa Hàng để chọn mẫu và nhận bảng giá sỉ mới nhất ngay hôm nay!',
    cover_url: '/ag-logo.jpg',
    published: true,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  }
];

export function slugifyVi(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `bai-viet-${Date.now()}`;
}

export function mapProductRow(r) {
  const soLuong = Number(r.so_luong ?? 0);
  return {
    key: String(r.id),
    id: r.item_id ?? r.id,
    warehouseName: r.warehouse_name || 'A_long',
    code: r.code || `${r.warehouse_name || 'KHO'}#${r.item_id || ''}`,
    category: r.category || 'Chưa phân loại',
    name: r.name || 'Sản phẩm',
    soLuong,
    isOutOfStock: Boolean(r.is_out_of_stock) || soLuong <= 0,
    ghiChu: r.ghi_chu || '',
    relPath: r.rel_path || '',
    imageUrl: r.image_url || '/ag-logo.jpg'
  };
}

function loadLocalProductOverrides() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PRODUCT_OVERRIDES_KEY) || '{"added":[],"updated":{},"removed":[]}');
  } catch {
    return { added: [], updated: {}, removed: [] };
  }
}

function saveLocalProductOverrides(data) {
  try {
    localStorage.setItem(LOCAL_PRODUCT_OVERRIDES_KEY, JSON.stringify(data));
  } catch {}
}

export async function fetchProductsFromDb(khoParam = '') {
  let query = supabase
    .from('zaloshop_products')
    .select('id,warehouse_name,item_id,code,category,name,so_luong,is_out_of_stock,ghi_chu,rel_path,image_url')
    .order('item_id', { ascending: true });

  if (khoParam && khoParam !== 'ALL') {
    query = query.eq('warehouse_name', khoParam);
  }

  const { data, error } = await query;
  if (error) throw error;

  const overrides = loadLocalProductOverrides();
  const removedSet = new Set(overrides.removed || []);
  const mapped = (data || [])
    .map(mapProductRow)
    .filter((p) => !removedSet.has(p.key))
    .map((p) => (overrides.updated?.[p.key] ? { ...p, ...overrides.updated[p.key] } : p));

  const localAdded = (overrides.added || []).filter(
    (p) => !khoParam || khoParam === 'ALL' || p.warehouseName === khoParam
  );

  return [...localAdded, ...mapped];
}

export async function createProductInDb(product) {
  const cleanId = `${product.warehouseName}_${Date.now()}`;
  const itemId = Number(product.itemId) || Math.floor(1000 + Math.random() * 8999);
  const row = {
    id: cleanId,
    warehouse_name: product.warehouseName || 'A_long',
    item_id: itemId,
    code: product.code || `${product.warehouseName || 'A_long'}#${itemId}`,
    category: product.category || 'Hàng nhập',
    name: product.name,
    so_luong: Math.max(0, Number(product.soLuong) || 0),
    is_out_of_stock: Number(product.soLuong) <= 0,
    ghi_chu: product.ghiChu || '',
    rel_path: product.relPath || '',
    image_url: product.imageUrl || '/ag-logo.jpg'
  };

  const { data, error } = await supabase.from('zaloshop_products').insert([row]).select().single();
  if (!error && data) {
    return { product: mapProductRow(data), persistedToPg: true };
  }

  // Fallback local preview mode if Supabase RLS blocks anon write before SQL migration/login
  const overrides = loadLocalProductOverrides();
  const mapped = mapProductRow(row);
  overrides.added = [mapped, ...(overrides.added || [])];
  saveLocalProductOverrides(overrides);
  return { product: mapped, persistedToPg: false, pgError: error?.message || 'RLS blocked' };
}

export async function updateProductInDb(key, patch) {
  const dbPatch = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.category !== undefined) dbPatch.category = patch.category;
  if (patch.soLuong !== undefined) {
    dbPatch.so_luong = Math.max(0, Number(patch.soLuong) || 0);
    dbPatch.is_out_of_stock = dbPatch.so_luong <= 0;
  }
  if (patch.isOutOfStock !== undefined) dbPatch.is_out_of_stock = Boolean(patch.isOutOfStock);
  if (patch.ghiChu !== undefined) dbPatch.ghi_chu = patch.ghiChu;
  if (patch.imageUrl !== undefined) dbPatch.image_url = patch.imageUrl;

  const { error } = await supabase.from('zaloshop_products').update(dbPatch).eq('id', key);
  if (!error) {
    return { persistedToPg: true };
  }

  const overrides = loadLocalProductOverrides();
  const addedIdx = (overrides.added || []).findIndex((p) => p.key === key);
  if (addedIdx >= 0) {
    overrides.added[addedIdx] = { ...overrides.added[addedIdx], ...patch };
  } else {
    overrides.updated = { ...(overrides.updated || {}), [key]: { ...(overrides.updated?.[key] || {}), ...patch } };
  }
  saveLocalProductOverrides(overrides);
  return { persistedToPg: false, pgError: error?.message || 'RLS blocked' };
}

export async function deleteProductInDb(key) {
  const { error } = await supabase.from('zaloshop_products').delete().eq('id', key);
  if (!error) {
    return { persistedToPg: true };
  }

  const overrides = loadLocalProductOverrides();
  overrides.added = (overrides.added || []).filter((p) => p.key !== key);
  if (!overrides.removed) overrides.removed = [];
  if (!overrides.removed.includes(key)) overrides.removed.push(key);
  saveLocalProductOverrides(overrides);
  return { persistedToPg: false, pgError: error?.message || 'RLS blocked' };
}

export async function uploadProductImageToStorage(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const filePath = `admin/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from('zaloshop-images').upload(filePath, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg'
  });
  if (error) throw error;
  const { data } = supabase.storage.from('zaloshop-images').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function submitOrderToDb({ orderCode, customerName, phone, address, note, handlerAccountId, customerUid, items }) {
  const { error } = await supabase.from('zaloshop_orders').insert([
    {
      order_code: orderCode,
      customer_name: customerName,
      phone,
      address,
      note,
      handler_account_id: handlerAccountId || '',
      customer_uid: customerUid || '',
      items: items.map((it) => ({
        id: it.id,
        warehouseName: it.warehouseName,
        relPath: it.relPath,
        qty: it.qty
      })),
      status: 'pending'
    }
  ]);
  if (error) throw error;
  return { ok: true, orderCode };
}

// ============================================================
// POSTS / ARTICLES (PostgreSQL zaloshop_posts + local fallback)
// ============================================================
function loadLocalPosts() {
  try {
    const raw = localStorage.getItem(LOCAL_POSTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_SAMPLE_POSTS;
}

function saveLocalPosts(posts) {
  try {
    localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts));
  } catch {}
}

export async function fetchPostsFromDb({ includeDrafts = false } = {}) {
  try {
    let query = supabase.from('zaloshop_posts').select('*').order('created_at', { ascending: false });
    if (!includeDrafts) query = query.eq('published', true);
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return { posts: data, source: 'postgresql' };
    }
  } catch {}

  const local = loadLocalPosts();
  return {
    posts: includeDrafts ? local : local.filter((p) => p.published !== false),
    source: 'local_fallback'
  };
}

export async function createPostInDb(post) {
  const payload = {
    slug: post.slug ? slugifyVi(post.slug) : slugifyVi(post.title),
    title: post.title.trim(),
    category: (post.category || 'Tin kho hàng').trim(),
    excerpt: (post.excerpt || '').trim(),
    content: (post.content || '').trim(),
    cover_url: (post.cover_url || '/ag-logo.jpg').trim(),
    published: post.published !== false
  };

  const { data, error } = await supabase.from('zaloshop_posts').insert([payload]).select().single();
  if (!error && data) {
    return { post: data, persistedToPg: true };
  }

  const local = loadLocalPosts();
  const newItem = {
    id: `local-${Date.now()}`,
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  saveLocalPosts([newItem, ...local]);
  return { post: newItem, persistedToPg: false, pgError: error?.message || 'Table zaloshop_posts chưa tạo hoặc RLS chặn' };
}

export async function updatePostInDb(id, patch) {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString()
  };
  if (patch.title && !patch.slug) {
    payload.slug = slugifyVi(patch.title);
  }
  const { error } = await supabase.from('zaloshop_posts').update(payload).eq('id', id);
  if (!error) {
    return { persistedToPg: true };
  }

  const local = loadLocalPosts().map((p) => (p.id === id ? { ...p, ...payload } : p));
  saveLocalPosts(local);
  return { persistedToPg: false, pgError: error?.message || 'RLS blocked' };
}

export async function deletePostInDb(id) {
  const { error } = await supabase.from('zaloshop_posts').delete().eq('id', id);
  if (!error) {
    return { persistedToPg: true };
  }

  const local = loadLocalPosts().filter((p) => p.id !== id);
  saveLocalPosts(local);
  return { persistedToPg: false, pgError: error?.message || 'RLS blocked' };
}
