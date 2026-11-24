import { getServerDb } from './_lib/db.js';
import { getQuery, sendJson } from './_lib/http.js';

const DEFAULT_POSTS = [
  {
    id: 'sample-1',
    slug: 'huong-dan-nhap-si-mo-hinh-blokees-tan-xuong',
    title: 'Hướng dẫn nhập sỉ mô hình lắp ghép Blokees & Transformers tận xưởng',
    category: 'Kinh nghiệm nhập sỉ',
    excerpt:
      'Tổng hợp các dòng Blokees Classic Class bán chạy nhất, cách trộn mẫu linh hoạt không cần ôm số lượng lớn và quy trình giữ kho qua Zalo.',
    content:
      'Mô hình lắp ghép sưu tầm (Blokees, Transformers, Gundam, Lego) đang là nhóm hàng có biên lợi nhuận tốt và tệp khách mua lặp lại rất cao.\n\nTại AG STORE, các chủ shop và CTV có thể:\n1. Xem trực tiếp tồn kho thực tế 100% cập nhật liên tục.\n2. Trộn mẫu linh hoạt nhiều dòng trong cùng 1 đơn hàng.\n3. Đặt giữ hàng ngay trên web và nhận Phiếu Báo Giá Tổng Bill sỉ / nguyên thùng riêng qua Zalo.\n\nMọi thùng hàng đều được đóng gói chống móp hộp cẩn thận, hỗ trợ kiểm tra hàng trước khi thanh toán trên toàn quốc.',
    cover_url: '/ag-logo.jpg',
    published: true,
    created_at: '2026-11-20T08:00:00.000Z'
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
    created_at: '2026-11-19T08:00:00.000Z'
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
    created_at: '2026-11-18T08:00:00.000Z'
  }
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const { db } = getServerDb();
    const { slug = '' } = getQuery(req);

    let query = db
      .from('zaloshop_posts')
      .select('id,slug,title,category,excerpt,content,cover_url,published,created_at,updated_at')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (slug) {
      query = query.eq('slug', String(slug).trim());
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return sendJson(res, 200, { ok: true, posts: data, source: 'database' });
    }

    const fallback = slug
      ? DEFAULT_POSTS.filter((p) => p.slug === String(slug).trim())
      : DEFAULT_POSTS;
    return sendJson(res, 200, { ok: true, posts: fallback, source: 'default' });
  } catch (err) {
    return sendJson(res, 200, { ok: true, posts: DEFAULT_POSTS, source: 'default' });
  }
}
