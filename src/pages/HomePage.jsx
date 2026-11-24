import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import HeroMarquee from '../components/HeroMarquee';
import ProductCard from '../components/ProductCard';
import { useStore } from '../context/StoreContext';

export default function HomePage() {
  const { products, loadingProducts, posts } = useStore();

  const featuredProducts = useMemo(() => {
    const inStock = products.filter((p) => !p.isOutOfStock);
    const list = inStock.length > 0 ? inStock : products;
    return list.slice(0, 8);
  }, [products]);

  const latestPosts = useMemo(() => posts.slice(0, 3), [posts]);

  return (
    <>
      <HeroMarquee />

      <main className="main-wrap">
        {/* SẢN PHẨM NỔI BẬT */}
        <section style={{ marginBottom: 42 }}>
          <div className="section-head-row">
            <div>
              <h2 className="section-title">🔥 Sản Phẩm Sẵn Kho Nổi Bật</h2>
              <p className="section-sub">
                Đồng bộ tồn kho trực tiếp từ PostgreSQL — chọn mẫu, trộn sỉ linh hoạt &amp; nhận báo giá riêng qua Zalo.
              </p>
            </div>
            <Link to="/shop" className="section-link-btn">
              Xem tất cả ({products.length} mẫu) →
            </Link>
          </div>

          <div className="product-stage">
            <div className="energy-streams-bg">
              <div className="energy-ribbon r1" />
              <div className="energy-ribbon r2" />
              <div className="energy-ribbon r3" />
            </div>
            {loadingProducts ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontWeight: 600 }}>
                ⏳ Đang tải sản phẩm từ máy chủ kho...
              </div>
            ) : (
              <div className="product-grid">
                {featuredProducts.map((p) => (
                  <ProductCard key={p.key} product={p} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* BÀI VIẾT & TIN KHO HÀNG */}
        <section>
          <div className="section-head-row">
            <div>
              <h2 className="section-title">📰 Bài Viết &amp; Tin Kho Hàng Mới Nhất</h2>
              <p className="section-sub">Cập nhật lô hàng mới về, mẹo chọn mẫu bán chạy &amp; chính sách đóng gói tại AG STORE.</p>
            </div>
            <Link to="/bai-viet" className="section-link-btn">
              Xem tất cả bài viết →
            </Link>
          </div>

          <div className="posts-grid">
            {latestPosts.map((post) => (
              <Link key={post.id || post.slug} to={`/bai-viet/${encodeURIComponent(post.slug)}`} className="post-card">
                <div className="post-cover">
                  <img src={post.cover_url || '/ag-logo.jpg'} alt={post.title} loading="lazy" />
                </div>
                <div className="post-card-body">
                  <span className="post-cat-badge">{post.category || 'Tin kho hàng'}</span>
                  <h3 className="post-card-title">{post.title}</h3>
                  <p className="post-card-excerpt">{post.excerpt}</p>
                  <div className="post-card-meta">
                    <span>{new Date(post.created_at || Date.now()).toLocaleDateString('vi-VN')}</span>
                    <span style={{ color: '#67e8f9', fontWeight: 700 }}>Đọc tiếp →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
