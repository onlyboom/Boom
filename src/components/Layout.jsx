import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, Home, Store, Package, Newspaper, UserPlus, LogOut } from 'lucide-react';
import StarfieldCanvas from './StarfieldCanvas';
import SalesChatWidget from './SalesChatWidget';
import AuthModal from './AuthModal';
import { useStore } from '../context/StoreContext';
import { submitPublicOrder } from '../lib/api';

export default function Layout({ children }) {
  const {
    products,
    cartItems,
    totalCartQty,
    setItemQty,
    clearCart,
    searchQuery,
    setSearchQuery,
    quickViewProduct,
    closeQuickView,
    checkoutOpen,
    openCheckout,
    closeCheckout,
    customerUser,
    openAuthModal,
    handleCustomerLogout,
    toast,
    showToast,
    zaloParams
  } = useStore();

  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  // Checkout form state
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custNote, setCustNote] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('has-cart-bar', totalCartQty > 0);
  }, [totalCartQty]);

  useEffect(() => {
    if (customerUser) {
      if (!custName && (customerUser.full_name || customerUser.username)) {
        setCustName(customerUser.full_name || customerUser.username);
      }
      if (!custPhone && customerUser.phone) setCustPhone(customerUser.phone);
      if (!custAddress && customerUser.address) setCustAddress(customerUser.address);
    }
  }, [customerUser]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim() && location.pathname !== '/shop' && location.pathname !== '/san-pham') {
      navigate('/shop');
    }
  };

  const buildZaloOrderText = () => {
    const lines = [
      '🛒 ĐƠN ĐẶT SỈ TỪ AG STORE',
      ...cartItems.map((it, idx) => `${idx + 1}. [${it.code}] ${it.name} — SL: ${it.qty}`),
      `📦 Tổng số lượng: ${totalCartQty} sản phẩm`
    ];
    if (custName.trim()) lines.push(`👤 Người nhận: ${custName.trim()}`);
    if (custPhone.trim()) lines.push(`📞 SĐT Zalo: ${custPhone.trim()}`);
    if (custAddress.trim()) lines.push(`📍 Địa chỉ: ${custAddress.trim()}`);
    if (custNote.trim()) lines.push(`📝 Ghi chú: ${custNote.trim()}`);
    return lines.join('\n');
  };

  const handleCopyZalo = async () => {
    if (cartItems.length === 0) {
      showToast('Giỏ hàng đang trống!', true);
      return;
    }
    try {
      await navigator.clipboard.writeText(buildZaloOrderText());
      showToast('✅ Đã copy đơn hàng — dán gửi qua Zalo ngay nhé!');
    } catch {
      showToast('Không thể copy tự động, vui lòng bấm Đặt hàng trực tiếp!', true);
    }
  };

  const handleSubmitDirectOrder = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      showToast('Giỏ hàng đang trống!', true);
      return;
    }
    if (!custPhone.trim()) {
      showToast('Vui lòng nhập SĐT Zalo để kho gửi Phiếu Báo Giá Tổng Bill!', true);
      return;
    }
    setSubmittingOrder(true);
    const now = new Date();
    const orderCode = `DH${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${Math.floor(10 + Math.random() * 89)}`;
    try {
      await submitPublicOrder({
        orderCode,
        customerName: custName.trim() || 'Khách Cửa Hàng',
        phone: custPhone.trim(),
        address: custAddress.trim(),
        note: custNote.trim(),
        handlerAccountId: zaloParams.acc,
        customerUid: zaloParams.uid,
        items: cartItems
      });
      clearCart();
      closeCheckout();
      showToast(`✅ Đã gửi đơn #${orderCode} thành công! Kho sẽ gửi Bill qua Zalo ngay ạ!`);
    } catch (err) {
      showToast(`❌ Lỗi gửi đơn: ${err?.message || err}`, true);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const qvQty = quickViewProduct ? Number(cartItems.find((i) => i.key === quickViewProduct.key)?.qty || 0) : 0;

  return (
    <>
      <StarfieldCanvas />

      <div className="page-layer">
        <header className={`site-header ${scrolled ? 'scrolled' : ''}`} id="siteHeader">
          <div className="header-main">
            <Link className="brand-logo" to="/" title="AG STORE — Trang chủ">
              <img src="/ag-logo.jpg" alt="AG STORE Logo" />
            </Link>

            <nav className="header-nav" aria-label="Điều hướng chính">
              <NavLink to="/" end className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}>
                <Home size={15} /> Trang chủ
              </NavLink>
              <NavLink to="/shop" className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}>
                <Store size={15} /> Cửa hàng
              </NavLink>
              <NavLink to="/san-pham" className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}>
                <Package size={15} /> Sản phẩm
              </NavLink>
              <NavLink to="/bai-viet" className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`}>
                <Newspaper size={15} /> Bài viết
              </NavLink>
            </nav>

            <div className="search-box header-search-wrap">
              <span className="search-icon-left">
                <Search size={16} />
              </span>
              <input
                type="text"
                className="search-input"
                placeholder="Tìm theo tên sản phẩm, mã hàng..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn show"
                  onClick={() => setSearchQuery('')}
                  title="Xóa từ khóa"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="header-actions">
              <div className="sync-chip" title="Đồng bộ tồn kho theo thời gian thực mỗi 15 giây">
                <span className="sync-dot" />
                <span>{products.length} mẫu</span>
              </div>
              {customerUser ? (
                <div className="header-user-pill">
                  <span className="header-user-name" title={`SĐT: ${customerUser.phone}`}>
                    👤 @{customerUser.username}
                  </span>
                  <button
                    type="button"
                    className="header-user-logout"
                    title="Đăng xuất"
                    onClick={handleCustomerLogout}
                  >
                    <LogOut size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="header-auth-btn"
                  onClick={() => openAuthModal('register')}
                >
                  <UserPlus size={15} />
                  <span>Đăng ký</span>
                </button>
              )}
              <button
                type="button"
                className={`header-cart-btn ${totalCartQty > 0 ? 'has-items' : ''}`}
                onClick={openCheckout}
              >
                <ShoppingBag size={17} />
                <span>Tổng Bill</span>
                <span className="header-cart-count">{totalCartQty}</span>
              </button>
            </div>
          </div>
        </header>

        {children}

        <footer className="site-footer">
          <div className="footer-inner">
            <div className="footer-trust-grid">
              <div className="ft-card">
                <span className="ft-icon">⚡</span>
                <div>
                  <h5>Tồn Kho Thực Tế 100%</h5>
                  <p>Số lượng đồng bộ trực tiếp từ hệ thống kho theo thời gian thực, xác nhận đơn là giữ kho ngay.</p>
                </div>
              </div>
              <div className="ft-card">
                <span className="ft-icon">📦</span>
                <div>
                  <h5>Trộn Mẫu Sỉ Linh Hoạt</h5>
                  <p>Thoải mái chọn nhiều mẫu trong cùng 1 đơn, hỗ trợ giá sỉ và giá nguyên thùng.</p>
                </div>
              </div>
              <div className="ft-card">
                <span className="ft-icon">🛡️</span>
                <div>
                  <h5>Đóng Gói Chống Móp Hộp</h5>
                  <p>Đóng thùng cẩn thận giữ nguyên form hộp đẹp, hỗ trợ kiểm tra hàng trước thanh toán.</p>
                </div>
              </div>
              <div className="ft-card">
                <span className="ft-icon">🚚</span>
                <div>
                  <h5>Giao Nhanh Toàn Quốc</h5>
                  <p>Xác nhận tổng bill chi tiết qua Zalo trong vài phút và xuất kho gửi hàng ngay trong ngày.</p>
                </div>
              </div>
            </div>

            <div className="footer-main-grid">
              <div>
                <Link className="brand-logo footer-logo" to="/" title="Trang chủ AG STORE">
                  <img src="/ag-logo.jpg" alt="AG Logo" />
                </Link>
                <p className="footer-brand-desc">
                  Hệ thống trưng bày mẫu mô hình lắp ghép &amp; đồ chơi sỉ tận xưởng. Đặt giữ hàng trực tiếp trên catalog và nhận báo giá ưu đãi riêng qua Zalo.
                </p>
                <div className="footer-pill-tags">
                  <span className="footer-pill-tag"><span className="dot">●</span> Kho sỉ tận xưởng</span>
                  <span className="footer-pill-tag"><span className="dot">●</span> Hỗ trợ Shop &amp; CTV</span>
                  <span className="footer-pill-tag"><span className="dot">●</span> Xuất đơn toàn quốc</span>
                </div>
              </div>

              <div>
                <div className="footer-section-title">Điều Hướng Nhanh</div>
                <div className="footer-nav-links">
                  <Link to="/">→ Trang chủ</Link>
                  <Link to="/shop">→ Cửa hàng tồn kho</Link>
                  <Link to="/san-pham">→ Danh sách sản phẩm</Link>
                  <Link to="/bai-viet">→ Bài viết &amp; Tin kho hàng</Link>
                </div>
              </div>

              <div className="footer-cta-card">
                <h4>Quy Trình Đặt Sỉ 3 Bước</h4>
                <p>
                  1. Chọn mẫu &amp; số lượng ngay trên web.<br />
                  2. Bấm <strong>Tổng Bill</strong> hoặc <strong>Đặt ngay</strong>.<br />
                  3. Nhập SĐT Zalo để kho giữ hàng &amp; gửi báo giá sỉ chi tiết.
                </p>
                <div className="footer-cta-btns">
                  <Link to="/shop" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                    🛒 Xem Kho Hàng
                  </Link>
                  <button type="button" className="btn btn-ghost" onClick={openCheckout}>
                    ⚡ Mở Tổng Bill ({totalCartQty})
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} <strong>AG STORE</strong> — Catalog Mô Hình &amp; Đồ Chơi Sỉ Tận Xưởng</span>
            <span className="footer-status-live">● Hệ thống đồng bộ tồn kho trực tuyến</span>
          </div>
        </footer>
      </div>

      {/* FLOATING CART BAR */}
      <div className={`floating-cart-bar ${totalCartQty > 0 ? 'visible' : ''}`}>
        <div className="fc-summary">
          <strong>🛒 Đã chọn {cartItems.length} mẫu ({totalCartQty} sản phẩm)</strong>
          <span>Bấm Đặt hàng để giữ kho &amp; nhận Phiếu Báo Giá Tổng Bill qua Zalo</span>
        </div>
        <div className="fc-actions">
          <button type="button" className="btn btn-ghost" onClick={handleCopyZalo}>
            📋 Copy gửi Zalo
          </button>
          <button type="button" className="btn btn-primary" onClick={openCheckout}>
            ⚡ Đặt giữ kho ngay
          </button>
        </div>
      </div>

      {/* QUICK VIEW MODAL */}
      {quickViewProduct && (
        <div className="modal-backdrop open" onClick={closeQuickView}>
          <div className="qv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qv-media">
              <img src={quickViewProduct.imageUrl} alt={quickViewProduct.name} />
            </div>
            <div className="qv-info">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="p-cat">{quickViewProduct.category}</span>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={closeQuickView}>
                  ✕
                </button>
              </div>
              <h3 style={{ margin: '6px 0', color: '#fff', fontSize: 20 }}>{quickViewProduct.name}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span className="h3d-code">{quickViewProduct.code}</span>
                <span className="p-stock-txt">
                  {quickViewProduct.isOutOfStock ? 'Tạm hết hàng' : `● Sẵn ${quickViewProduct.soLuong} sp trong kho`}
                </span>
              </div>
              {quickViewProduct.ghiChu && (
                <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 12px' }}>📝 {quickViewProduct.ghiChu}</p>
              )}
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fbbf24', marginBottom: 14 }}>
                💰 Giá sỉ / Giá nguyên thùng: Nhận báo giá riêng qua Zalo
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 'auto' }}>
                {!quickViewProduct.isOutOfStock && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setItemQty(quickViewProduct, Math.max(1, qvQty + 1));
                      showToast(`✅ Đã thêm ${quickViewProduct.name} vào Tổng Bill`);
                    }}
                  >
                    + Thêm vào Tổng Bill {qvQty > 0 ? `(${qvQty})` : ''}
                  </button>
                )}
                <Link
                  to={`/san-pham/${encodeURIComponent(quickViewProduct.key)}`}
                  className="btn btn-ghost"
                  style={{ textDecoration: 'none' }}
                  onClick={closeQuickView}
                >
                  🔍 Xem trang chi tiết
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT / TỔNG BILL MODAL */}
      {checkoutOpen && (
        <div className="modal-backdrop open" onClick={closeCheckout}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>⚡ Tổng Bill Đặt Giữ Kho ({totalCartQty} sp)</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={closeCheckout}>
                ✕
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 10px', color: '#94a3b8' }}>
                Giỏ hàng đang trống. Hãy chọn mẫu sản phẩm trước nhé!
              </div>
            ) : (
              <form onSubmit={handleSubmitDirectOrder} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="cart-items-list" style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {cartItems.map((it) => (
                    <div key={it.key} className="cart-row">
                      <img src={it.imageUrl} alt={it.name} />
                      <div>
                        <div className="cart-row-name">{it.name}</div>
                        <div className="cart-row-code">{it.code} • Tồn: {it.soLuong}</div>
                      </div>
                      <div className="cart-row-ctrl">
                        <div className="mini-step">
                          <button type="button" onClick={() => setItemQty(it, it.qty - 1)}>−</button>
                          <span style={{ padding: '0 8px', fontWeight: 800, color: '#fff' }}>{it.qty}</span>
                          <button type="button" onClick={() => setItemQty(it, it.qty + 1)}>+</button>
                        </div>
                        <button type="button" className="cart-del-btn" onClick={() => setItemQty(it, 0)}>
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input
                    className="admin-input"
                    placeholder="Tên anh/chị / Tên Shop"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                  />
                  <input
                    className="admin-input"
                    placeholder="SĐT Zalo nhận báo giá *"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                  />
                </div>
                <input
                  className="admin-input"
                  placeholder="Địa chỉ giao hàng (không bắt buộc)"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                />
                <input
                  className="admin-input"
                  placeholder="Ghi chú thêm (vd: giao giờ hành chính, lấy nguyên thùng...)"
                  value={custNote}
                  onChange={(e) => setCustNote(e.target.value)}
                />

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost" onClick={handleCopyZalo}>
                    📋 Copy gửi Zalo
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submittingOrder}>
                    {submittingOrder ? '⏳ Đang gửi đơn...' : '✅ Xác Nhận Đặt Giữ Kho'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <AuthModal />
      <SalesChatWidget />

      {/* TOAST */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'err' : ''}`}>
        {toast.text}
      </div>
    </>
  );
}
