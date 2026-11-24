import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function ProductCard({ product }) {
  const { cart, setItemQty, openQuickView, openCheckout } = useStore();
  const pickedQty = Number(cart[product.key] || 0);
  const isOut = product.isOutOfStock;

  return (
    <article className={`p-card ${pickedQty > 0 ? 'picked' : ''} ${isOut ? 'out' : ''}`}>
      <div className="p-card-inner">
        <div className="p-img-wrap" onClick={() => openQuickView(product.key)}>
          <span className={`p-badge-stock ${isOut ? 'out' : ''}`}>
            {isOut ? 'Tạm hết' : `Sẵn ${product.soLuong}`}
          </span>
          <span className="p-code-tag">{product.code}</span>
          <img src={product.imageUrl} loading="lazy" alt={product.name} />
          <span className="p-zoom-hint">🔍 Xem nhanh</span>
        </div>

        <div className="p-body">
          <div className="p-cat">{product.category}</div>
          <Link
            to={`/san-pham/${encodeURIComponent(product.key)}`}
            className="p-name"
            style={{ textDecoration: 'none' }}
          >
            {product.name}
          </Link>

          <div className="p-meta-row">
            <span className="p-wholesale-tag">Giá sỉ qua Zalo</span>
            <span className={`p-stock-txt ${isOut ? 'out' : ''}`}>
              {isOut ? 'Hết hàng' : `Còn ${product.soLuong} sp`}
            </span>
          </div>

          <div className="p-actions">
            {isOut ? (
              <button type="button" className="btn-add-primary" disabled>
                Tạm hết hàng
              </button>
            ) : pickedQty <= 0 ? (
              <button
                type="button"
                className="btn-add-primary"
                onClick={() => setItemQty(product, 1)}
              >
                + Chọn đặt hàng
              </button>
            ) : (
              <div className="p-picked-row">
                <div className="qty-stepper">
                  <button type="button" onClick={() => setItemQty(product, pickedQty - 1)}>
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={product.soLuong}
                    value={pickedQty}
                    onChange={(e) => setItemQty(product, parseInt(e.target.value, 10) || 0)}
                  />
                  <button type="button" onClick={() => setItemQty(product, pickedQty + 1)}>
                    +
                  </button>
                </div>
                <button type="button" className="btn-order-card" onClick={openCheckout}>
                  Đặt ngay
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
