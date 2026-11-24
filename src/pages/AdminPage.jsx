import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package,
  Newspaper,
  ShoppingCart,
  Users,
  LogOut,
  Upload,
  Trash2,
  EyeOff,
  Eye,
  PlusCircle,
  Edit3,
  Star,
  RefreshCw,
  Check
} from 'lucide-react';
import {
  checkAdminSession,
  loginAdmin,
  logoutAdmin,
  fetchAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  fetchAdminOrders,
  createAdminOrder,
  updateAdminOrder,
  deleteAdminOrder,
  fetchAdminCustomers,
  saveAdminCustomer,
  deleteAdminCustomer,
  fetchAdminPosts,
  createAdminPost,
  updateAdminPost,
  deleteAdminPost,
  uploadAdminImage
} from '../lib/api';
import { useStore } from '../context/StoreContext';

const ORDER_STATUS_META = {
  pending: { label: 'Chờ xác nhận', cls: 'pending' },
  confirmed: { label: 'Đã xác nhận', cls: 'confirmed' },
  shipping: { label: 'Đang giao', cls: 'shipping' },
  done: { label: 'Hoàn thành', cls: 'done' },
  cancelled: { label: 'Đã hủy', cls: 'cancelled' }
};

const EMPTY_PRODUCT_FORM = {
  name: '',
  code: '',
  warehouseName: 'A_long',
  category: 'Hàng nhập',
  soLuong: 100,
  isVisible: true,
  isFeatured: false,
  ghiChu: '',
  imageUrl: ''
};

const EMPTY_ORDER_FORM = {
  order_code: '',
  customer_name: '',
  phone: '',
  zalo_name: '',
  customer_uid: '',
  address: '',
  handler_account_id: '',
  note: '',
  status: 'pending',
  autoDeductStock: true,
  items: []
};

const EMPTY_CUSTOMER_FORM = {
  customer_name: '',
  phone: '',
  zalo_name: '',
  customer_uid: '',
  address: '',
  note: ''
};

const EMPTY_POST_FORM = {
  title: '',
  category: 'Tin kho hàng',
  cover_url: '',
  excerpt: '',
  content: '',
  published: true
};

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', { hour12: false });
  } catch {
    return String(iso);
  }
}

export default function AdminPage() {
  const { reloadProducts, reloadPosts, showToast } = useStore();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [serverDbReady, setServerDbReady] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'products' | 'customers' | 'posts'
  const [refreshing, setRefreshing] = useState(false);

  // Admin data (loaded 100% from Server APIs)
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminCustomers, setAdminCustomers] = useState([]);
  const [adminPosts, setAdminPosts] = useState([]);

  // Products tab states
  const [editingProductKey, setEditingProductKey] = useState(null);
  const [prodForm, setProdForm] = useState(EMPTY_PRODUCT_FORM);
  const [prodSearch, setProdSearch] = useState('');
  const [prodFilter, setProdFilter] = useState('ALL'); // ALL | IN_STOCK | OUT_OF_STOCK | HIDDEN
  const [prodBusy, setProdBusy] = useState(false);
  const [stockDrafts, setStockDrafts] = useState({});

  // Orders tab states
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER_FORM);
  const [selectedProdKeyForOrder, setSelectedProdKeyForOrder] = useState('');
  const [selectedProdQtyForOrder, setSelectedProdQtyForOrder] = useState(1);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderBusy, setOrderBusy] = useState(false);

  // Customers tab states
  const [editingCustomerPhone, setEditingCustomerPhone] = useState(null);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerBusy, setCustomerBusy] = useState(false);

  // Posts tab states
  const [editingPostId, setEditingPostId] = useState(null);
  const [postForm, setPostForm] = useState(EMPTY_POST_FORM);
  const [postBusy, setPostBusy] = useState(false);

  const loadAllAdminData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [prods, orders, custRes, posts] = await Promise.all([
        fetchAdminProducts().catch(() => []),
        fetchAdminOrders().catch(() => []),
        fetchAdminCustomers().catch(() => ({ customers: [] })),
        fetchAdminPosts().catch(() => [])
      ]);
      setAdminProducts(prods);
      setAdminOrders(orders);
      setAdminCustomers(custRes.customers || []);
      setAdminPosts(posts);
      const nextDrafts = {};
      for (const p of prods) nextDrafts[p.key] = p.soLuong;
      setStockDrafts(nextDrafts);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    checkAdminSession()
      .then((res) => {
        if (!active) return;
        setAuthed(Boolean(res.authenticated));
        setServerDbReady(res.serverDbReady !== false);
      })
      .catch(() => {
        if (active) setAuthed(false);
      })
      .finally(() => {
        if (active) setCheckingAuth(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authed) {
      loadAllAdminData();
    }
  }, [authed, loadAllAdminData]);

  // ============================================================
  // AUTH HANDLERS
  // ============================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!passcode.trim()) {
      showToast('Vui lòng nhập mã quản trị!', true);
      return;
    }
    setLoginBusy(true);
    try {
      const res = await loginAdmin(passcode.trim());
      setAuthed(true);
      setServerDbReady(res.serverDbReady !== false);
      setPasscode('');
      showToast('✅ Đăng nhập quản trị thành công!');
    } catch (err) {
      showToast(`❌ ${err?.message || 'Sai mã quản trị'}`, true);
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin().catch(() => {});
    setAuthed(false);
    showToast('Đã đăng xuất phiên quản trị.');
  };

  // ============================================================
  // IMAGE UPLOAD VIA SERVER
  // ============================================================
  const handleImageUpload = async (file, target) => {
    if (!file) return;
    try {
      showToast('⏳ Đang tải ảnh lên máy chủ...');
      const url = await uploadAdminImage(file);
      if (target === 'product') setProdForm((p) => ({ ...p, imageUrl: url }));
      else setPostForm((p) => ({ ...p, cover_url: url }));
      showToast('✅ Đã tải ảnh lên thành công!');
    } catch (err) {
      showToast(`❌ Lỗi tải ảnh: ${err?.message || err}`, true);
    }
  };

  // ============================================================
  // PRODUCTS & INVENTORY HANDLERS
  // ============================================================
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!prodForm.name.trim()) {
      showToast('Vui lòng nhập tên sản phẩm!', true);
      return;
    }
    setProdBusy(true);
    try {
      if (editingProductKey) {
        await updateAdminProduct(editingProductKey, prodForm);
        showToast('✅ Đã cập nhật sản phẩm!');
      } else {
        await createAdminProduct(prodForm);
        showToast('✅ Đã thêm sản phẩm mới lên kho!');
      }
      setEditingProductKey(null);
      setProdForm(EMPTY_PRODUCT_FORM);
      await Promise.all([loadAllAdminData(), reloadProducts(true)]);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi lưu sản phẩm'}`, true);
    } finally {
      setProdBusy(false);
    }
  };

  const handleQuickStockSave = async (p, nextQty) => {
    const cleanQty = Math.max(0, parseInt(nextQty, 10) || 0);
    setStockDrafts((prev) => ({ ...prev, [p.key]: cleanQty }));
    try {
      await updateAdminProduct(p.key, { soLuong: cleanQty, isOutOfStock: cleanQty <= 0 });
      await Promise.all([loadAllAdminData(), reloadProducts(true)]);
      showToast(`✅ Đã cập nhật tồn kho [${p.code}] = ${cleanQty} sp`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Không cập nhật được tồn kho'}`, true);
    }
  };

  const handleToggleVisible = async (p) => {
    try {
      const nextVis = !p.isVisible;
      await updateAdminProduct(p.key, { isVisible: nextVis });
      await Promise.all([loadAllAdminData(), reloadProducts(true)]);
      showToast(nextVis ? `👁️ Đã bật trưng bày "${p.name}"` : `🙈 Đã ẩn trưng bày "${p.name}"`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi đổi trạng thái trưng bày'}`, true);
    }
  };

  const handleToggleFeatured = async (p) => {
    try {
      const nextFeat = !p.isFeatured;
      await updateAdminProduct(p.key, { isFeatured: nextFeat });
      await Promise.all([loadAllAdminData(), reloadProducts(true)]);
      showToast(nextFeat ? `⭐ Đã đưa "${p.name}" lên mục nổi bật` : `Đã bỏ nổi bật "${p.name}"`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi cập nhật nổi bật'}`, true);
    }
  };

  const handleDeleteProduct = async (p) => {
    if (!window.confirm(`Xóa vĩnh viễn sản phẩm "${p.name}" (${p.code})?`)) return;
    try {
      await deleteAdminProduct(p.key);
      if (editingProductKey === p.key) {
        setEditingProductKey(null);
        setProdForm(EMPTY_PRODUCT_FORM);
      }
      await Promise.all([loadAllAdminData(), reloadProducts(true)]);
      showToast(`🗑️ Đã xóa "${p.name}"`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi xóa sản phẩm'}`, true);
    }
  };

  // ============================================================
  // ORDERS HANDLERS (FULL CRUD)
  // ============================================================
  const handleAddItemToOrderForm = () => {
    const prod = adminProducts.find((p) => p.key === selectedProdKeyForOrder);
    if (!prod) {
      showToast('Hãy chọn 1 sản phẩm từ danh sách trước!', true);
      return;
    }
    const qty = Math.max(1, parseInt(selectedProdQtyForOrder, 10) || 1);
    setOrderForm((prev) => {
      const existingIdx = prev.items.findIndex((i) => i.key === prod.key || i.code === prod.code);
      if (existingIdx >= 0) {
        const nextItems = [...prev.items];
        nextItems[existingIdx] = { ...nextItems[existingIdx], qty: nextItems[existingIdx].qty + qty };
        return { ...prev, items: nextItems };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            id: prod.id,
            key: prod.key,
            code: prod.code,
            name: prod.name,
            warehouseName: prod.warehouseName,
            relPath: prod.relPath,
            qty
          }
        ]
      };
    });
    setSelectedProdQtyForOrder(1);
  };

  const handleUpdateOrderFormItemQty = (idx, nextQty) => {
    const qty = parseInt(nextQty, 10) || 0;
    setOrderForm((prev) => {
      const next = [...prev.items];
      if (qty <= 0) next.splice(idx, 1);
      else next[idx] = { ...next[idx], qty };
      return { ...prev, items: next };
    });
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (!orderForm.phone.trim()) {
      showToast('Vui lòng nhập SĐT khách hàng!', true);
      return;
    }
    if (!orderForm.items || orderForm.items.length === 0) {
      showToast('Vui lòng thêm ít nhất 1 sản phẩm vào đơn hàng!', true);
      return;
    }
    setOrderBusy(true);
    try {
      if (editingOrderId) {
        await updateAdminOrder(editingOrderId, orderForm);
        showToast('✅ Đã cập nhật đơn hàng!');
      } else {
        await createAdminOrder(orderForm);
        showToast('✅ Đã tạo đơn hàng mới thành công!');
      }
      setEditingOrderId(null);
      setOrderForm(EMPTY_ORDER_FORM);
      await Promise.all([loadAllAdminData(), reloadProducts(true)]);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi lưu đơn hàng'}`, true);
    } finally {
      setOrderBusy(false);
    }
  };

  const handleQuickOrderStatus = async (order, nextStatus) => {
    try {
      await updateAdminOrder(order.id, { status: nextStatus });
      await loadAllAdminData();
      showToast(`✅ Đã chuyển đơn #${order.order_code} sang "${ORDER_STATUS_META[nextStatus]?.label || nextStatus}"`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi đổi trạng thái đơn'}`, true);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Xóa vĩnh viễn đơn hàng #${order.order_code} của khách ${order.customer_name}?`)) return;
    try {
      await deleteAdminOrder(order.id);
      if (editingOrderId === order.id) {
        setEditingOrderId(null);
        setOrderForm(EMPTY_ORDER_FORM);
      }
      await loadAllAdminData();
      showToast(`🗑️ Đã xóa đơn hàng #${order.order_code}`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi xóa đơn hàng'}`, true);
    }
  };

  // ============================================================
  // CUSTOMERS HANDLERS
  // ============================================================
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.phone.trim()) {
      showToast('Vui lòng nhập SĐT khách hàng!', true);
      return;
    }
    setCustomerBusy(true);
    try {
      await saveAdminCustomer(customerForm);
      setEditingCustomerPhone(null);
      setCustomerForm(EMPTY_CUSTOMER_FORM);
      await loadAllAdminData();
      showToast('✅ Đã lưu thông tin khách hàng!');
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi lưu khách hàng'}`, true);
    } finally {
      setCustomerBusy(false);
    }
  };

  const handleDeleteCustomer = async (c) => {
    if (!window.confirm(`Xóa hồ sơ khách "${c.customer_name}" (${c.phone}) khỏi danh bạ?`)) return;
    try {
      await deleteAdminCustomer(c.phone);
      if (editingCustomerPhone === c.phone) {
        setEditingCustomerPhone(null);
        setCustomerForm(EMPTY_CUSTOMER_FORM);
      }
      await loadAllAdminData();
      showToast(`🗑️ Đã xóa hồ sơ khách ${c.phone}`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi xóa khách hàng'}`, true);
    }
  };

  // ============================================================
  // POSTS HANDLERS
  // ============================================================
  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!postForm.title.trim() || !postForm.content.trim()) {
      showToast('Vui lòng nhập tiêu đề và nội dung bài viết!', true);
      return;
    }
    setPostBusy(true);
    try {
      if (editingPostId) {
        await updateAdminPost(editingPostId, postForm);
        showToast('✅ Đã cập nhật bài viết!');
      } else {
        await createAdminPost(postForm);
        showToast('✅ Đã đăng bài viết mới!');
      }
      setEditingPostId(null);
      setPostForm(EMPTY_POST_FORM);
      await Promise.all([loadAllAdminData(), reloadPosts()]);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi lưu bài viết'}`, true);
    } finally {
      setPostBusy(false);
    }
  };

  const handleTogglePostPublish = async (post) => {
    try {
      await updateAdminPost(post.id, { published: !post.published });
      await Promise.all([loadAllAdminData(), reloadPosts()]);
      showToast(post.published ? `🙈 Đã gỡ bài "${post.title}" xuống nháp` : `✅ Đã xuất bản lại "${post.title}"`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi cập nhật bài viết'}`, true);
    }
  };

  const handleDeletePost = async (post) => {
    if (!window.confirm(`Xóa vĩnh viễn bài viết "${post.title}"?`)) return;
    try {
      await deleteAdminPost(post.id);
      await Promise.all([loadAllAdminData(), reloadPosts()]);
      showToast(`🗑️ Đã xóa bài viết "${post.title}"`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi xóa bài viết'}`, true);
    }
  };

  // ============================================================
  // FILTERED LISTS
  // ============================================================
  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return adminProducts.filter((p) => {
      if (prodFilter === 'IN_STOCK' && (p.isOutOfStock || p.soLuong <= 0)) return false;
      if (prodFilter === 'OUT_OF_STOCK' && !p.isOutOfStock && p.soLuong > 0) return false;
      if (prodFilter === 'HIDDEN' && p.isVisible !== false) return false;
      if (q && !`${p.name} ${p.code} ${p.category} ${p.warehouseName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [adminProducts, prodSearch, prodFilter]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return adminOrders.filter((o) => {
      if (orderStatusFilter !== 'ALL' && o.status !== orderStatusFilter) return false;
      if (q && !`${o.order_code} ${o.customer_name} ${o.phone} ${o.address} ${o.note}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [adminOrders, orderSearch, orderStatusFilter]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return adminCustomers;
    return adminCustomers.filter((c) =>
      `${c.customer_name} ${c.phone} ${c.zalo_name} ${c.address} ${c.note}`.toLowerCase().includes(q)
    );
  }, [adminCustomers, customerSearch]);

  const totalStockUnits = useMemo(
    () => adminProducts.reduce((sum, p) => sum + Math.max(0, Number(p.soLuong || 0)), 0),
    [adminProducts]
  );

  // ============================================================
  // LOGIN VIEW
  // ============================================================
  if (checkingAuth) {
    return (
      <div className="admin-shell">
        <div className="admin-login-box" style={{ textAlign: 'center', color: '#94a3b8' }}>
          ⏳ Đang xác thực phiên quản trị từ máy chủ...
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="admin-shell">
        <div className="admin-login-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <img src="/ag-logo.jpg" alt="AG" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />
            <div>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 19 }}>🛡️ Quản Trị AG STORE</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>
                Xác thực bảo mật qua máy chủ (Server-Side)
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <div className="admin-field">
              <label htmlFor="inpAdminPasscode">Mã quản trị</label>
              <input
                id="inpAdminPasscode"
                type="password"
                className="admin-input"
                placeholder="Nhập mã quản trị..."
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={loginBusy}>
              {loginBusy ? '⏳ Đang xác thực...' : '🔓 Đăng nhập Quản Trị'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================
  // AUTHENTICATED ADMIN DASHBOARD
  // ============================================================
  return (
    <div className="admin-shell">
      <div className="section-head-row" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="section-title">🛡️ Trung Tâm Quản Trị AG STORE</h1>
          <p className="section-sub">
            Quản lý Đơn hàng, Tồn kho, Trưng bày sản phẩm, Khách đặt hàng &amp; Bài viết (100% xử lý qua Server API)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-cyan-soft"
            onClick={loadAllAdminData}
            disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> {refreshing ? 'Đang tải...' : 'Làm mới dữ liệu'}
          </button>
          <button
            type="button"
            className="btn-danger-soft"
            onClick={handleLogout}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </div>

      {!serverDbReady && (
        <div className="admin-alert-warn">
          ⚠️ <strong>Lưu ý cấu hình Server:</strong> Biến môi trường <code>SUPABASE_SERVICE_ROLE_KEY</code> chưa được gắn trên máy chủ (Vercel). Bạn vẫn xem được danh sách sản phẩm, nhưng để thêm/sửa/xóa đơn hàng, tồn kho và khách hàng ghi thẳng vào cơ sở dữ liệu, hãy thêm <code>SUPABASE_SERVICE_ROLE_KEY</code> trong Vercel Project Settings ➔ Environment Variables rồi Redeploy.
        </div>
      )}

      {/* KPI STRIP */}
      <div className="admin-stat-strip">
        <div className="admin-stat-card">
          <span>Tổng đơn hàng</span>
          <strong style={{ color: '#fbbf24' }}>{adminOrders.length}</strong>
        </div>
        <div className="admin-stat-card">
          <span>Đơn chờ xử lý</span>
          <strong style={{ color: '#f43f5e' }}>
            {adminOrders.filter((o) => o.status === 'pending').length}
          </strong>
        </div>
        <div className="admin-stat-card">
          <span>Mẫu sản phẩm / Tổng tồn</span>
          <strong style={{ color: '#6ee7b7' }}>
            {adminProducts.length} <span style={{ fontSize: 13, color: '#94a3b8' }}>({totalStockUnits.toLocaleString('vi-VN')} sp)</span>
          </strong>
        </div>
        <div className="admin-stat-card">
          <span>Khách đặt hàng</span>
          <strong style={{ color: '#67e8f9' }}>{adminCustomers.length}</strong>
        </div>
      </div>

      {/* ADMIN TABS */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <ShoppingCart size={16} /> Đơn hàng ({adminOrders.length})
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <Package size={16} /> Sản phẩm &amp; Tồn kho ({adminProducts.length})
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          <Users size={16} /> Khách đặt hàng ({adminCustomers.length})
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          <Newspaper size={16} /> Bài viết ({adminPosts.length})
        </button>
      </div>

      {/* ============================================================
          TAB 1: QUẢN LÝ ĐƠN HÀNG (THÊM / SỬA / XÓA)
         ============================================================ */}
      {activeTab === 'orders' && (
        <div className="admin-grid-2">
          <div className="admin-panel">
            <h3>{editingOrderId ? '✏️ Chỉnh Sửa Đơn Hàng' : '➕ Tạo Đơn Hàng Mới'}</h3>
            <form onSubmit={handleSaveOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="admin-field">
                  <label>Tên khách hàng *</label>
                  <input
                    className="admin-input"
                    required
                    placeholder="VD: Shop Minh Anh"
                    value={orderForm.customer_name}
                    onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })}
                  />
                </div>
                <div className="admin-field">
                  <label>SĐT / Zalo *</label>
                  <input
                    className="admin-input"
                    required
                    placeholder="09xxxxxxxx"
                    value={orderForm.phone}
                    onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="admin-field">
                  <label>Tên Zalo / UID (nếu có)</label>
                  <input
                    className="admin-input"
                    placeholder="VD: Minh Anh Toys"
                    value={orderForm.zalo_name}
                    onChange={(e) => setOrderForm({ ...orderForm, zalo_name: e.target.value })}
                  />
                </div>
                <div className="admin-field">
                  <label>Trạng thái đơn</label>
                  <select
                    className="admin-select"
                    value={orderForm.status}
                    onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value })}
                  >
                    {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-field">
                <label>Địa chỉ giao hàng</label>
                <input
                  className="admin-input"
                  placeholder="Số nhà, đường, quận/huyện, tỉnh/TP..."
                  value={orderForm.address}
                  onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                />
              </div>

              {/* CHỌN SẢN PHẨM CHO ĐƠN */}
              <div className="admin-field">
                <label>Thêm sản phẩm vào đơn</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="admin-select"
                    style={{ flex: 1 }}
                    value={selectedProdKeyForOrder}
                    onChange={(e) => setSelectedProdKeyForOrder(e.target.value)}
                  >
                    <option value="">-- Chọn mẫu trong kho --</option>
                    {adminProducts.map((p) => (
                      <option key={p.key} value={p.key}>
                        [{p.code}] {p.name} (Tồn: {p.soLuong})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    className="admin-input"
                    style={{ width: 68 }}
                    value={selectedProdQtyForOrder}
                    onChange={(e) => setSelectedProdQtyForOrder(parseInt(e.target.value, 10) || 1)}
                  />
                  <button type="button" className="btn-cyan-soft" onClick={handleAddItemToOrderForm}>
                    + Thêm
                  </button>
                </div>
              </div>

              <div className="admin-order-items-box">
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8' }}>
                  Sản phẩm trong đơn ({orderForm.items.length} mã •{' '}
                  {orderForm.items.reduce((s, i) => s + (Number(i.qty) || 0), 0)} sp)
                </div>
                {orderForm.items.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#64748b' }}>Chưa chọn sản phẩm nào.</div>
                ) : (
                  orderForm.items.map((it, idx) => (
                    <div key={`${it.key || it.code || idx}`} className="admin-order-item-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it.name || it.code || it.relPath}
                        </div>
                        <div style={{ fontSize: 11, color: '#67e8f9' }}>{it.code || it.warehouseName}</div>
                      </div>
                      <input
                        type="number"
                        min="1"
                        className="admin-stock-input"
                        value={it.qty}
                        onChange={(e) => handleUpdateOrderFormItemQty(idx, e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-danger-soft"
                        onClick={() => handleUpdateOrderFormItemQty(idx, 0)}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="admin-field">
                <label>Ghi chú đơn hàng</label>
                <textarea
                  rows={2}
                  className="admin-textarea"
                  placeholder="Ghi chú đóng gói, giờ giao, yêu cầu sỉ..."
                  value={orderForm.note}
                  onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })}
                />
              </div>

              {!editingOrderId && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#cbd5e1', fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(orderForm.autoDeductStock)}
                    onChange={(e) => setOrderForm({ ...orderForm, autoDeductStock: e.target.checked })}
                  />
                  Tự động trừ số lượng tồn kho khi tạo đơn này
                </label>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={orderBusy}>
                  <PlusCircle size={15} />{' '}
                  {orderBusy ? 'Đang lưu...' : editingOrderId ? 'Lưu cập nhật đơn' : 'Tạo Đơn Hàng'}
                </button>
                {editingOrderId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingOrderId(null);
                      setOrderForm(EMPTY_ORDER_FORM);
                    }}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>🧾 Danh Sách Đơn Hàng ({filteredOrders.length})</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  className="admin-select"
                  style={{ width: 150 }}
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <input
                  className="admin-input"
                  style={{ width: 210 }}
                  placeholder="🔍 Tìm mã đơn / SĐT / tên..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-table-wrap" style={{ maxHeight: 620, overflowY: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách đặt hàng</th>
                    <th>Sản phẩm</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>
                        Chưa có đơn hàng nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const items = Array.isArray(o.items) ? o.items : [];
                      const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
                      return (
                        <tr key={o.id}>
                          <td>
                            <div style={{ fontWeight: 800, color: '#67e8f9' }}>#{o.order_code}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatTime(o.created_at)}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#fff' }}>{o.customer_name}</div>
                            <div style={{ fontSize: 12, color: '#6ee7b7' }}>{o.phone}</div>
                            {o.address && <div style={{ fontSize: 11, color: '#94a3b8' }}>{o.address}</div>}
                            {o.note && <div style={{ fontSize: 11, color: '#fde68a' }}>📝 {o.note}</div>}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#fff' }}>
                              {items.length} mã ({totalQty} sp)
                            </div>
                            <div style={{ fontSize: 11.5, color: '#cbd5e1', maxWidth: 220 }}>
                              {items
                                .slice(0, 3)
                                .map((it) => `${it.code || it.name || it.relPath} x${it.qty}`)
                                .join(', ')}
                              {items.length > 3 ? ` +${items.length - 3} mã` : ''}
                            </div>
                          </td>
                          <td>
                            <select
                              className="admin-select"
                              style={{ padding: '5px 8px', fontSize: 12, minWidth: 125 }}
                              value={o.status || 'pending'}
                              onChange={(e) => handleQuickOrderStatus(o, e.target.value)}
                            >
                              {Object.entries(ORDER_STATUS_META).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn-cyan-soft"
                                title="Sửa đơn hàng"
                                onClick={() => {
                                  setEditingOrderId(o.id);
                                  setOrderForm({
                                    order_code: o.order_code || '',
                                    customer_name: o.customer_name || '',
                                    phone: o.phone || '',
                                    zalo_name: o.zalo_name || '',
                                    customer_uid: o.customer_uid || '',
                                    address: o.address || '',
                                    handler_account_id: o.handler_account_id || '',
                                    note: o.note || '',
                                    status: o.status || 'pending',
                                    autoDeductStock: false,
                                    items: Array.isArray(o.items) ? o.items : []
                                  });
                                }}
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-danger-soft"
                                title="Xóa đơn hàng"
                                onClick={() => handleDeleteOrder(o)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 2: QUẢN LÝ SẢN PHẨM, TỒN KHO & TRƯNG BÀY
         ============================================================ */}
      {activeTab === 'products' && (
        <div className="admin-grid-2">
          <div className="admin-panel">
            <h3>{editingProductKey ? '✏️ Sửa Sản Phẩm & Trưng Bày' : '➕ Thêm Sản Phẩm Mới'}</h3>
            <form onSubmit={handleSaveProduct}>
              <div className="admin-field">
                <label>Tên sản phẩm *</label>
                <input
                  className="admin-input"
                  required
                  placeholder="VD: Blokees Transformers Classic #135"
                  value={prodForm.name}
                  onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="admin-field">
                  <label>Mã hàng</label>
                  <input
                    className="admin-input"
                    placeholder="VD: A_long#135"
                    value={prodForm.code}
                    onChange={(e) => setProdForm({ ...prodForm, code: e.target.value })}
                  />
                </div>
                <div className="admin-field">
                  <label>Kho hàng</label>
                  <input
                    className="admin-input"
                    value={prodForm.warehouseName}
                    onChange={(e) => setProdForm({ ...prodForm, warehouseName: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="admin-field">
                  <label>Danh mục</label>
                  <input
                    className="admin-input"
                    value={prodForm.category}
                    onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                  />
                </div>
                <div className="admin-field">
                  <label>Số lượng tồn kho</label>
                  <input
                    type="number"
                    min="0"
                    className="admin-input"
                    value={prodForm.soLuong}
                    onChange={(e) => setProdForm({ ...prodForm, soLuong: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
              <div className="admin-field">
                <label>Ảnh sản phẩm (URL hoặc tải ảnh lên Server)</label>
                <input
                  className="admin-input"
                  placeholder="https://..."
                  value={prodForm.imageUrl}
                  onChange={(e) => setProdForm({ ...prodForm, imageUrl: e.target.value })}
                />
                <label
                  style={{
                    marginTop: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    color: '#67e8f9',
                    fontSize: 12
                  }}
                >
                  <Upload size={14} /> Tải ảnh từ máy tính
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload(e.target.files?.[0], 'product')}
                  />
                </label>
              </div>
              <div className="admin-field">
                <label>Ghi chú sản phẩm</label>
                <textarea
                  rows={2}
                  className="admin-textarea"
                  placeholder="VD: Nguyên thùng 24 hộp, form hộp đẹp..."
                  value={prodForm.ghiChu}
                  onChange={(e) => setProdForm({ ...prodForm, ghiChu: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#e2e8f0', fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    checked={prodForm.isVisible !== false}
                    onChange={(e) => setProdForm({ ...prodForm, isVisible: e.target.checked })}
                  />
                  Hiển thị trưng bày trên web
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fde68a', fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(prodForm.isFeatured)}
                    onChange={(e) => setProdForm({ ...prodForm, isFeatured: e.target.checked })}
                  />
                  Nổi bật băng chuyền
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={prodBusy}>
                  <PlusCircle size={15} />{' '}
                  {prodBusy ? 'Đang lưu...' : editingProductKey ? 'Lưu Thay Đổi' : 'Đăng Sản Phẩm'}
                </button>
                {editingProductKey && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingProductKey(null);
                      setProdForm(EMPTY_PRODUCT_FORM);
                    }}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>📦 Kho Hàng &amp; Trưng Bày ({filteredProducts.length})</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  className="admin-select"
                  style={{ width: 145 }}
                  value={prodFilter}
                  onChange={(e) => setProdFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả mẫu</option>
                  <option value="IN_STOCK">Còn hàng</option>
                  <option value="OUT_OF_STOCK">Hết hàng</option>
                  <option value="HIDDEN">Đang ẩn trưng bày</option>
                </select>
                <input
                  className="admin-input"
                  style={{ width: 200 }}
                  placeholder="🔍 Tìm mã / tên SP..."
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-table-wrap" style={{ maxHeight: 620, overflowY: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ảnh</th>
                    <th>Sản phẩm</th>
                    <th>Tồn kho</th>
                    <th>Trưng bày</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const draftVal = stockDrafts[p.key] ?? p.soLuong;
                    const dirty = Number(draftVal) !== Number(p.soLuong);
                    return (
                      <tr key={p.key} style={{ opacity: p.isVisible === false ? 0.58 : 1 }}>
                        <td>
                          <img src={p.imageUrl} alt={p.name} className="admin-thumb" loading="lazy" />
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{p.name}</div>
                          <div style={{ fontSize: 11.5, color: '#67e8f9' }}>
                            {p.code} • <span style={{ color: '#94a3b8' }}>{p.category}</span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-stock-inline">
                            <button
                              type="button"
                              className="admin-stock-btn"
                              title="Giảm 1"
                              onClick={() => handleQuickStockSave(p, Math.max(0, Number(p.soLuong) - 1))}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              className="admin-stock-input"
                              value={draftVal}
                              onChange={(e) =>
                                setStockDrafts((prev) => ({ ...prev, [p.key]: parseInt(e.target.value, 10) || 0 }))
                              }
                            />
                            <button
                              type="button"
                              className="admin-stock-btn"
                              title="Tăng 1"
                              onClick={() => handleQuickStockSave(p, Number(p.soLuong) + 1)}
                            >
                              +
                            </button>
                            {dirty && (
                              <button
                                type="button"
                                className="btn-cyan-soft"
                                title="Lưu tồn kho mới"
                                onClick={() => handleQuickStockSave(p, draftVal)}
                              >
                                <Check size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            <button
                              type="button"
                              className={p.isVisible === false ? 'btn-danger-soft' : 'btn-cyan-soft'}
                              title={p.isVisible === false ? 'Đang ẩn — Bấm để trưng bày' : 'Đang trưng bày — Bấm để ẩn'}
                              onClick={() => handleToggleVisible(p)}
                            >
                              {p.isVisible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              type="button"
                              className={p.isFeatured ? 'btn-amber-soft' : 'btn-cyan-soft'}
                              title={p.isFeatured ? 'Đang nổi bật' : 'Đánh dấu nổi bật'}
                              onClick={() => handleToggleFeatured(p)}
                            >
                              <Star size={13} fill={p.isFeatured ? '#fcd34d' : 'none'} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn-cyan-soft"
                              title="Sửa sản phẩm"
                              onClick={() => {
                                setEditingProductKey(p.key);
                                setProdForm({
                                  name: p.name || '',
                                  code: p.code || '',
                                  warehouseName: p.warehouseName || 'A_long',
                                  category: p.category || 'Hàng nhập',
                                  soLuong: p.soLuong ?? 0,
                                  isVisible: p.isVisible !== false,
                                  isFeatured: Boolean(p.isFeatured),
                                  ghiChu: p.ghiChu || '',
                                  imageUrl: p.imageUrl || ''
                                });
                              }}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-danger-soft"
                              title="Xóa sản phẩm"
                              onClick={() => handleDeleteProduct(p)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 3: QUẢN LÝ THÔNG TIN KHÁCH ĐẶT HÀNG
         ============================================================ */}
      {activeTab === 'customers' && (
        <div className="admin-grid-2">
          <div className="admin-panel">
            <h3>{editingCustomerPhone ? '✏️ Sửa Thông Tin Khách Hàng' : '➕ Thêm Hồ Sơ Khách Hàng'}</h3>
            <form onSubmit={handleSaveCustomer}>
              <div className="admin-field">
                <label>Tên khách / Tên shop *</label>
                <input
                  className="admin-input"
                  required
                  placeholder="VD: Chị Lan - Đồ Chơi Bé Yêu"
                  value={customerForm.customer_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, customer_name: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="admin-field">
                  <label>Số điện thoại *</label>
                  <input
                    className="admin-input"
                    required
                    placeholder="09xxxxxxxx"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  />
                </div>
                <div className="admin-field">
                  <label>Tên Zalo</label>
                  <input
                    className="admin-input"
                    placeholder="Tên hiển thị Zalo"
                    value={customerForm.zalo_name}
                    onChange={(e) => setCustomerForm({ ...customerForm, zalo_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="admin-field">
                <label>Zalo UID (nếu có)</label>
                <input
                  className="admin-input"
                  placeholder="UID Zalo khách"
                  value={customerForm.customer_uid}
                  onChange={(e) => setCustomerForm({ ...customerForm, customer_uid: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Địa chỉ</label>
                <input
                  className="admin-input"
                  placeholder="Địa chỉ nhận hàng..."
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Ghi chú khách hàng (mức sỉ, thói quen nhập...)</label>
                <textarea
                  rows={3}
                  className="admin-textarea"
                  value={customerForm.note}
                  onChange={(e) => setCustomerForm({ ...customerForm, note: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={customerBusy}>
                  {customerBusy ? 'Đang lưu...' : editingCustomerPhone ? '💾 Cập Nhật Khách' : '➕ Lưu Khách Hàng'}
                </button>
                {editingCustomerPhone && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingCustomerPhone(null);
                      setCustomerForm(EMPTY_CUSTOMER_FORM);
                    }}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>👥 Danh Sách Khách Đặt Hàng ({filteredCustomers.length})</h3>
              <input
                className="admin-input"
                style={{ maxWidth: 240 }}
                placeholder="🔍 Tìm tên / SĐT / Zalo..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>

            <div className="admin-table-wrap" style={{ maxHeight: 620, overflowY: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Liên hệ / Địa chỉ</th>
                    <th>Lịch sử đặt</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>
                        Chưa có thông tin khách đặt hàng nào.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c.phone}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{c.customer_name}</div>
                          {c.zalo_name && <div style={{ fontSize: 11.5, color: '#67e8f9' }}>Zalo: {c.zalo_name}</div>}
                          {c.note && <div style={{ fontSize: 11, color: '#fde68a' }}>📝 {c.note}</div>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#6ee7b7' }}>{c.phone}</div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{c.address || 'Chưa có địa chỉ'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff' }}>
                            {c.order_count || 0} đơn • {c.total_qty || 0} sp
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            Gần nhất: {formatTime(c.last_order_at)}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn-cyan-soft"
                              title="Sửa thông tin khách"
                              onClick={() => {
                                setEditingCustomerPhone(c.phone);
                                setCustomerForm({
                                  customer_name: c.customer_name || '',
                                  phone: c.phone || '',
                                  zalo_name: c.zalo_name || '',
                                  customer_uid: c.customer_uid || '',
                                  address: c.address || '',
                                  note: c.note || ''
                                });
                              }}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-danger-soft"
                              title="Xóa hồ sơ khách"
                              onClick={() => handleDeleteCustomer(c)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 4: QUẢN LÝ BÀI VIẾT
         ============================================================ */}
      {activeTab === 'posts' && (
        <div className="admin-grid-2">
          <div className="admin-panel">
            <h3>{editingPostId ? '✏️ Chỉnh Sửa Bài Viết' : '📝 Đăng Bài Viết Mới'}</h3>
            <form onSubmit={handleSavePost}>
              <div className="admin-field">
                <label>Tiêu đề bài viết *</label>
                <input
                  className="admin-input"
                  required
                  placeholder="VD: Lô Blokees Transformers mới về kho tháng này..."
                  value={postForm.title}
                  onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Chuyên mục</label>
                <input
                  className="admin-input"
                  value={postForm.category}
                  onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Ảnh bìa (URL hoặc tải ảnh)</label>
                <input
                  className="admin-input"
                  placeholder="https://... (để trống dùng logo AG)"
                  value={postForm.cover_url}
                  onChange={(e) => setPostForm({ ...postForm, cover_url: e.target.value })}
                />
                <label
                  style={{
                    marginTop: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    color: '#67e8f9',
                    fontSize: 12
                  }}
                >
                  <Upload size={14} /> Tải ảnh bìa từ máy
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload(e.target.files?.[0], 'post')}
                  />
                </label>
              </div>
              <div className="admin-field">
                <label>Mô tả ngắn</label>
                <textarea
                  rows={2}
                  className="admin-textarea"
                  value={postForm.excerpt}
                  onChange={(e) => setPostForm({ ...postForm, excerpt: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Nội dung bài viết *</label>
                <textarea
                  rows={6}
                  className="admin-textarea"
                  required
                  value={postForm.content}
                  onChange={(e) => setPostForm({ ...postForm, content: e.target.value })}
                />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, color: '#e2e8f0', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={postForm.published}
                  onChange={(e) => setPostForm({ ...postForm, published: e.target.checked })}
                />
                Xuất bản hiển thị ngay trên website
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={postBusy}>
                  {postBusy ? '⏳ Đang lưu...' : editingPostId ? '💾 Lưu thay đổi' : '🚀 Đăng Bài Viết'}
                </button>
                {editingPostId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingPostId(null);
                      setPostForm(EMPTY_POST_FORM);
                    }}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-panel">
            <h3>📰 Danh Sách Bài Viết ({adminPosts.length})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tiêu đề</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {adminPosts.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>
                        Chưa có bài viết nào trong cơ sở dữ liệu.
                      </td>
                    </tr>
                  ) : (
                    adminPosts.map((post) => (
                      <tr key={post.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{post.title}</div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                            /{post.slug} • {post.category}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: post.published ? '#6ee7b7' : '#fbbf24' }}>
                            {post.published ? '● Đang hiển thị' : '● Đã gỡ (Nháp)'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn-cyan-soft"
                              title="Sửa bài"
                              onClick={() => {
                                setEditingPostId(post.id);
                                setPostForm({
                                  title: post.title,
                                  category: post.category || 'Tin kho hàng',
                                  cover_url: post.cover_url || '',
                                  excerpt: post.excerpt || '',
                                  content: post.content || '',
                                  published: post.published !== false
                                });
                              }}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-cyan-soft"
                              title={post.published ? 'Gỡ bài xuống' : 'Đăng lại'}
                              onClick={() => handleTogglePostPublish(post)}
                            >
                              {post.published ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              type="button"
                              className="btn-danger-soft"
                              title="Xóa bài"
                              onClick={() => handleDeletePost(post)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
