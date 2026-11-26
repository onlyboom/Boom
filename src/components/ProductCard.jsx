import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useStore } from '../context/StoreContext';

function formatVnd(n) {
  const num = Number(n || 0);
  return num > 0 ? `${num.toLocaleString('vi-VN')}đ` : 'Báo giá Zalo';
}

export default function ProductCard({ product }) {
  const { cart, setItemQty, openQuickView, openCheckout, multiSelected, toggleMultiSelect } = useStore();
  const pickedQty = Number(cart[product.key] || 0);
  const isOut = product.isOutOfStock;
  const isSelected = Boolean(multiSelected?.[product.key]);

  return (
    <article className={`p-card ${pickedQty > 0 ? 'picked' : ''} ${isSelected ? 'multi-selected' : ''} ${isOut ? 'out' : ''}`}>
      <div className="p-card-inner">
        <div className="p-img-wrap" onClick={() => openQuickView(product.key)}>
          <span className={`p-badge-stock ${isOut ? 'out' : ''}`}>
            {isOut ? 'Tạm hết' : `Sẵn ${product.soLuong}`}
          </span>
          <span className="p-code-tag">{product.code}</span>
          {!isOut && (
            <button
              type="button"
              className={`p-multi-check ${isSelected ? 'checked' : ''}`}
              title={isSelected ? 'Bỏ chọn mẫu này' : 'Chọn nhiều sản phẩm cùng lúc'}
              onClick={(e) => {
                e.stopPropagation();
                toggleMultiSelect(product);
              }}
            >
              {isSelected ? <Check size={13} strokeWidth={3} /> : null}
            </button>
          )}
          <img src={product.imageUrl} loading="lazy" alt={product.name} />
          <span className="p-zoom-hint">🔄 Xem to 360°</span>
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
            <span className="p-price-badge">
              {formatVnd(product.giaLe)}
              {product.donVi && product.giaLe > 0 ? <small>/{product.donVi === 'PDQ' ? 'hộp' : product.donVi}</small> : null}
            </span>
            <span className={`p-stock-txt ${isOut ? 'out' : ''}`}>
              {isOut ? 'Hết hàng' : `Còn ${product.soLuong}`}
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
