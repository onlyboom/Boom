import React, { useMemo, useState, useEffect } from 'react';
import HeroMarquee from '../components/HeroMarquee';
import ProductCard from '../components/ProductCard';
import { useStore } from '../context/StoreContext';

const PAGE_SIZE = 24;

export default function ShopPage({ hideHero = false, pageTitle = '' }) {
  const {
    products,
    loadingProducts,
    productsError,
    searchQuery,
    totalCartQty,
    openCheckout,
    sfxEnabled,
    toggleSfx,
    zaloParams
  } = useStore();

  const [selectedWarehouse, setSelectedWarehouse] = useState(zaloParams.kho || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [page, setPage] = useState(1);

  const warehouses = useMemo(() => {
    const set = new Set(products.map((p) => p.warehouseName).filter(Boolean));
    return Array.from(set);
  }, [products]);

  const categories = useMemo(() => {
    const counts = new Map();
    for (const p of products) {
      if (selectedWarehouse !== 'ALL' && p.warehouseName !== selectedWarehouse) continue;
      const cat = p.category || 'Chưa phân loại';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries());
  }, [products, selectedWarehouse]);

  const filtered = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase();
    let list = products.filter((p) => {
      if (selectedWarehouse !== 'ALL' && p.warehouseName !== selectedWarehouse) return false;
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (onlyInStock && p.isOutOfStock) return false;
      if (kw) {
        const hay = `${p.name} ${p.code} ${p.category} ${p.ghiChu}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    if (sortBy === 'in_stock_first') {
      list = [...list].sort((a, b) => Number(a.isOutOfStock) - Number(b.isOutOfStock) || b.soLuong - a.soLuong);
    } else if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => (a.giaLe || 999999999) - (b.giaLe || 999999999));
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => (b.giaLe || 0) - (a.giaLe || 0));
    } else if (sortBy === 'stock_desc') {
      list = [...list].sort((a, b) => b.soLuong - a.soLuong);
    } else if (sortBy === 'name_asc') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }
    return list;
  }, [products, selectedWarehouse, selectedCategory, onlyInStock, searchQuery, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [selectedWarehouse, selectedCategory, onlyInStock, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      {!hideHero && <HeroMarquee />}

      <main className="main-wrap" id="catalogSection">
        {pageTitle && (
          <div className="section-head-row" style={{ marginBottom: 14 }}>
            <div>
              <h1 className="section-title">{pageTitle}</h1>
              <p className="section-sub">Toàn bộ danh mục sản phẩm cập nhật đầy đủ giá &amp; tồn kho thực tế.</p>
            </div>
          </div>
        )}

        {/* Chỉ hiện thanh chọn kho nếu link không bị khóa 1 kho (?kho=...) */}
        {!zaloParams.kho && warehouses.length > 1 && (
          <div className="warehouse-strip">
            <button
              type="button"
              className={`wh-pill ${selectedWarehouse === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setSelectedWarehouse('ALL');
                setSelectedCategory('ALL');
              }}
            >
              🏪 Tất cả kho ({products.length})
            </button>
            {warehouses.map((wh) => (
              <button
                key={wh}
                type="button"
                className={`wh-pill ${selectedWarehouse === wh ? 'active' : ''}`}
                onClick={() => {
                  setSelectedWarehouse(wh);
                  setSelectedCategory('ALL');
                }}
              >
                📦 Kho {wh}
              </button>
            ))}
          </div>
        )}

        <div className="catalog-toolbar">
          <div className="toolbar-left">
            <nav className="cat-tabs">
              <button
                type="button"
                className={`cat-tab ${selectedCategory === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('ALL')}
              >
                <span>Tất cả</span>
                <span className="cnt">{filtered.length}</span>
              </button>
              {categories.map(([cat, cnt]) => (
                <button
                  key={cat}
                  type="button"
                  className={`cat-tab ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span>{cat}</span>
                  <span className="cnt">{cnt}</span>
                </button>
              ))}
            </nav>
            <span className="toolbar-count">
              Hiển thị {pageItems.length} / {filtered.length} mẫu
            </span>
          </div>

          <div className="toolbar-right">
            <button type="button" className="btn-total-bill" onClick={openCheckout}>
              <span>⚡ Tổng Bill</span>
              <span className="bill-count-badge">{totalCartQty}</span>
            </button>
            <label className="stock-toggle">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
              />
              <span>Chỉ hiện sẵn hàng</span>
            </label>
            <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="default">Sắp xếp: Mặc định</option>
              <option value="price_asc">Giá thấp → cao</option>
              <option value="price_desc">Giá cao → thấp</option>
              <option value="in_stock_first">Ưu tiên sẵn hàng</option>
              <option value="stock_desc">Tồn kho nhiều nhất</option>
              <option value="name_asc">Tên A → Z</option>
            </select>
            <button
              type="button"
              className={`btn-sfx-pill ${sfxEnabled ? '' : 'muted'}`}
              title="Bật/tắt âm thanh hiệu ứng (SFX)"
              onClick={toggleSfx}
            >
              {sfxEnabled ? '🔊 SFX' : '🔇 Tắt'}
            </button>
          </div>
        </div>

        <div className="product-stage">
          <div className="energy-streams-bg">
            <div className="energy-ribbon r1" />
            <div className="energy-ribbon r2" />
            <div className="energy-ribbon r3" />
          </div>

          {loadingProducts ? (
            <div style={{ textAlign: 'center', padding: 54, color: '#94a3b8', fontWeight: 600 }}>
              ⏳ Đang tải mẫu sản phẩm từ kho PostgreSQL...
            </div>
          ) : productsError ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#fda4af', fontWeight: 700 }}>
              ❌ {productsError}
            </div>
          ) : pageItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 54, color: '#94a3b8', fontWeight: 600 }}>
              Không tìm thấy sản phẩm phù hợp. Hãy thử từ khóa hoặc danh mục khác!
            </div>
          ) : (
            <div className="product-grid">
              {pageItems.map((p) => (
                <ProductCard key={p.key} product={p} />
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination-bar">
            <button
              type="button"
              className="page-btn"
              disabled={safePage <= 1}
              onClick={() => {
                setPage(safePage - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              ← Trước
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <button
                  key={pNum}
                  type="button"
                  className={`page-btn ${pNum === safePage ? 'active' : ''}`}
                  onClick={() => {
                    setPage(pNum);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  {pNum}
                </button>
              );
            })}
            <button
              type="button"
              className="page-btn"
              disabled={safePage >= totalPages}
              onClick={() => {
                setPage(safePage + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Sau →
            </button>
          </div>
        )}
      </main>
    </>
  );
}
