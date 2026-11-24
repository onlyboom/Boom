import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useStore } from '../context/StoreContext';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { products, loadingProducts, cart, setItemQty, openCheckout, showToast } = useStore();

  const decodedId = decodeURIComponent(id || '');
  const product = useMemo(
    () =>
      products.find(
        (p) => String(p.key) === decodedId || String(p.id) === decodedId || String(p.code) === decodedId
      ) || null,
    [products, decodedId]
  );

  const related = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.key !== product.key && p.category === product.category)
      .slice(0, 4);
  }, [products, product]);

  if (loadingProducts) {
    return (
      <main className="main-wrap" style={{ textAlign: 'center', padding: 64, color: '#94a3b8' }}>
        ⏳ Đang tải chi tiết sản phẩm...
      </main>
    );
  }

  if (!product) {
    return (
      <main className="main-wrap" style={{ textAlign: 'center', padding: 64 }}>
        <h2 style={{ color: '#fff' }}>Không tìm thấy sản phẩm</h2>
        <p style={{ color: '#94a3b8' }}>Sản phẩm này có thể đã được gỡ hoặc mã không tồn tại.</p>
        <Link to="/san-pham" className="section-link-btn" style={{ marginTop: 12 }}>
          ← Quay lại danh sách sản phẩm
        </Link>
      </main>
    );
  }

  const pickedQty = Number(cart[product.key] || 0);

  return (
    <main className="main-wrap">
      <div className="breadcrumb-row">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/san-pham">Sản phẩm</Link>
        <span>/</span>
        <span style={{ color: '#e2e8f0' }}>{product.name}</span>
      </div>

      <div className="detail-card">
        <div className="detail-media">
          <img src={product.imageUrl} alt={product.name} />
        </div>
        <div className="detail-info" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="post-cat-badge">{product.category}</span>
            <span className="h3d-code">{product.code}</span>
            <span className="h3d-code" style={{ color: '#6ee7b7', borderColor: 'rgba(52,211,153,0.45)' }}>
              Kho: {product.warehouseName}
            </span>
          </div>

          <h1>{product.name}</h1>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(251, 191, 36, 0.09)',
              border: '1px solid rgba(251, 191, 36, 0.35)',
              color: '#fde68a',
              fontWeight: 800,
              fontSize: 14,
              marginBottom: 14
            }}
          >
            💰 Giá sỉ / Giá nguyên thùng: Nhận báo giá ưu đãi trực tiếp qua Zalo
          </div>

          <div style={{ fontSize: 14, color: product.isOutOfStock ? '#f87171' : '#6ee7b7', fontWeight: 700, marginBottom: 12 }}>
            {product.isOutOfStock ? '● Tạm hết hàng trong kho' : `● Sẵn hàng thực tế: ${product.soLuong} sản phẩm`}
          </div>

          {product.ghiChu && (
            <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, margin: '0 0 18px' }}>
              📝 <strong>Ghi chú kho:</strong> {product.ghiChu}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 'auto' }}>
            {!product.isOutOfStock && (
              <>
                <div className="qty-stepper" style={{ height: 42 }}>
                  <button type="button" onClick={() => setItemQty(product, Math.max(0, pickedQty - 1))}>−</button>
                  <input
                    type="number"
                    min="0"
                    max={product.soLuong}
                    value={pickedQty}
                    onChange={(e) => setItemQty(product, parseInt(e.target.value, 10) || 0)}
                  />
                  <button type="button" onClick={() => setItemQty(product, pickedQty + 1)}>+</button>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (pickedQty <= 0) setItemQty(product, 1);
                    showToast(`✅ Đã thêm ${product.name} vào Tổng Bill`);
                    openCheckout();
                  }}
                >
                  ⚡ Đặt giữ kho ngay
                </button>
              </>
            )}
            <Link to="/shop" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              ← Xem thêm mẫu khác
            </Link>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <div className="section-head-row">
            <h2 className="section-title">✨ Sản Phẩm Cùng Danh Mục</h2>
          </div>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.key} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
