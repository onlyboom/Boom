import React from 'react';
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
    <article
      className={`p-card ${pickedQty > 0 ? 'picked' : ''} ${isSelected ? 'multi-selected' : ''} ${isOut ? 'out' : ''}`}
      onClick={() => openQuickView(product.key)}
    >
      <div className="p-card-inner">
        <div className="p-img-wrap p-img-cosmic">
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
          <div className="p-img-float-box">
            <img src={product.imageUrl} loading="lazy" alt={product.name} />
          </div>
          <span className="p-zoom-hint">🔍 Xem chi tiết</span>
        </div>

        <div className="p-body">
          <div className="p-cat">{product.category}</div>
          <div className="p-name" title={product.name}>
            {product.name}
          </div>

          <div className="p-meta-row">
            <span className="p-price-badge">
              {formatVnd(product.giaLe)}
              {product.donVi && product.giaLe > 0 ? <small>/{product.donVi === 'PDQ' ? 'hộp' : product.donVi}</small> : null}
            </span>
            <span className={`p-stock-txt ${isOut ? 'out' : ''}`}>
              {isOut ? 'Hết hàng' : `Còn ${product.soLuong}`}
            </span>
          </div>

          <div className="p-actions" onClick={(e) => e.stopPropagation()}>
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
              <div className="p-picked-row p-picked-row-v2">
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
                <div className="p-picked-btns">
                  <button type="button" className="btn-order-card" onClick={openCheckout}>
                    Đặt ngay
                  </button>
                  <button
                    type="button"
                    className="btn-cancel-card"
                    title="Hủy chọn sản phẩm này"
                    onClick={() => setItemQty(product, 0)}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
