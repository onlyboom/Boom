import React, { useEffect, useMemo, useState } from 'react';
import { Package, Newspaper, Database, LogOut, Upload, Trash2, EyeOff, Eye, PlusCircle, Edit3, Copy } from 'lucide-react';
import {
  ADMIN_PASSCODE,
  SUPABASE_URL,
  supabase,
  createProductInDb,
  updateProductInDb,
  deleteProductInDb,
  uploadProductImageToStorage,
  fetchPostsFromDb,
  createPostInDb,
  updatePostInDb,
  deletePostInDb
} from '../lib/supabase';
import { useStore } from '../context/StoreContext';

const ADMIN_SESSION_KEY = 'agstore_admin_unlocked_v1';

const SCHEMA_SQL_SNIPPET = `-- Chạy 1 lần trong Supabase SQL Editor (Project tool_zalo)
create table if not exists public.zaloshop_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null default 'Tin kho hàng',
  excerpt text not null default '',
  content text not null default '',
  cover_url text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.zaloshop_posts enable row level security;
drop policy if exists "Public read published posts" on public.zaloshop_posts;
create policy "Public read published posts" on public.zaloshop_posts for select using (published = true);
drop policy if exists "Authenticated manage posts" on public.zaloshop_posts;
create policy "Authenticated manage posts" on public.zaloshop_posts for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated manage products" on public.zaloshop_products;
create policy "Authenticated manage products" on public.zaloshop_products for all to authenticated using (true) with check (true);`;

export default function AdminPage() {
  const { products, reloadProducts, reloadPosts, showToast } = useStore();

  const [authed, setAuthed] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === '1');
  const [sbUser, setSbUser] = useState(null);
  const [loginMode, setLoginMode] = useState('passcode'); // 'passcode' | 'supabase'
  const [passcode, setPasscode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'posts' | 'db'

  // Product Form State
  const [prodForm, setProdForm] = useState({
    name: '',
    code: '',
    warehouseName: 'A_long',
    category: 'Hàng nhập',
    soLuong: 100,
    ghiChu: '',
    imageUrl: ''
  });
  const [prodSearch, setProdSearch] = useState('');
  const [prodBusy, setProdBusy] = useState(false);

  // Post Form State
  const [allAdminPosts, setAllAdminPosts] = useState([]);
  const [postsSource, setPostsSource] = useState('postgresql');
  const [editingPostId, setEditingPostId] = useState(null);
  const [postForm, setPostForm] = useState({
    title: '',
    category: 'Tin kho hàng',
    cover_url: '',
    excerpt: '',
    content: '',
    published: true
  });
  const [postBusy, setPostBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setSbUser(data.session.user);
        setAuthed(true);
      }
    });
  }, []);

  const loadAdminPosts = async () => {
    const res = await fetchPostsFromDb({ includeDrafts: true });
    setAllAdminPosts(res.posts || []);
    setPostsSource(res.source || 'postgresql');
  };

  useEffect(() => {
    if (authed) {
      loadAdminPosts();
    }
  }, [authed]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loginMode === 'passcode') {
      if (passcode.trim() === ADMIN_PASSCODE) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
        setAuthed(true);
        showToast('✅ Đã đăng nhập trang quản trị AG STORE!');
      } else {
        showToast('❌ Sai mã quản trị!', true);
      }
      return;
    }

    setLoginBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setSbUser(data.user);
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      setAuthed(true);
      showToast('✅ Đăng nhập Supabase PostgreSQL thành công!');
    } catch (err) {
      showToast(`❌ Lỗi đăng nhập: ${err?.message || err}`, true);
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    await supabase.auth.signOut().catch(() => {});
    setSbUser(null);
    setAuthed(false);
    showToast('Đã đăng xuất quản trị.');
  };

  const handleImageUpload = async (file, target) => {
    if (!file) return;
    try {
      showToast('⏳ Đang tải ảnh lên Supabase Storage...');
      const url = await uploadProductImageToStorage(file);
      if (target === 'product') setProdForm((p) => ({ ...p, imageUrl: url }));
      else setPostForm((p) => ({ ...p, cover_url: url }));
      showToast('✅ Đã tải ảnh lên thành công!');
    } catch {
      // Fallback: preview DataURL locally if storage policy requires Supabase Auth
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (target === 'product') setProdForm((p) => ({ ...p, imageUrl: dataUrl }));
        else setPostForm((p) => ({ ...p, cover_url: dataUrl }));
        showToast('⚠️ Đã gắn ảnh xem trước cục bộ (đăng nhập Supabase Auth để upload Storage cloud).');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!prodForm.name.trim()) {
      showToast('Vui lòng nhập tên sản phẩm!', true);
      return;
    }
    setProdBusy(true);
    try {
      const res = await createProductInDb(prodForm);
      await reloadProducts(true);
      setProdForm({
        name: '',
        code: '',
        warehouseName: prodForm.warehouseName || 'A_long',
        category: prodForm.category || 'Hàng nhập',
        soLuong: 100,
        ghiChu: '',
        imageUrl: ''
      });
      showToast(
        res.persistedToPg
          ? '✅ Đã đăng sản phẩm mới thẳng lên PostgreSQL!'
          : '✅ Đã đăng sản phẩm (chế độ xem trước local — đăng nhập Supabase Auth để ghi thẳng PostgreSQL)!'
      );
    } catch (err) {
      showToast(`❌ Lỗi đăng sản phẩm: ${err?.message || err}`, true);
    } finally {
      setProdBusy(false);
    }
  };

  const handleToggleProductStock = async (p) => {
    const nextOut = !p.isOutOfStock;
    const nextQty = nextOut ? 0 : Math.max(10, p.soLuong || 10);
    await updateProductInDb(p.key, { isOutOfStock: nextOut, soLuong: nextQty });
    await reloadProducts(true);
    showToast(nextOut ? `🙈 Đã ẩn / tạm hết "${p.name}"` : `✅ Đã mở bán lại "${p.name}"`);
  };

  const handleDeleteProduct = async (p) => {
    if (!window.confirm(`Gỡ vĩnh viễn sản phẩm "${p.name}" (${p.code}) khỏi cửa hàng?`)) return;
    const res = await deleteProductInDb(p.key);
    await reloadProducts(true);
    showToast(
      res.persistedToPg
        ? `🗑️ Đã gỡ "${p.name}" khỏi PostgreSQL!`
        : `🗑️ Đã gỡ "${p.name}" khỏi giao diện cửa hàng!`
    );
  };

  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!postForm.title.trim() || !postForm.content.trim()) {
      showToast('Vui lòng nhập tiêu đề và nội dung bài viết!', true);
      return;
    }
    setPostBusy(true);
    try {
      if (editingPostId) {
        const res = await updatePostInDb(editingPostId, postForm);
        showToast(res.persistedToPg ? '✅ Đã cập nhật bài viết trên PostgreSQL!' : '✅ Đã cập nhật bài viết!');
      } else {
        const res = await createPostInDb(postForm);
        showToast(
          res.persistedToPg
            ? '✅ Đã đăng bài viết mới lên PostgreSQL!'
            : '✅ Đã đăng bài viết lên website (chạy schema.sql để đồng bộ bảng zaloshop_posts lên cloud)!'
        );
      }
      setEditingPostId(null);
      setPostForm({ title: '', category: 'Tin kho hàng', cover_url: '', excerpt: '', content: '', published: true });
      await Promise.all([loadAdminPosts(), reloadPosts(false)]);
    } catch (err) {
      showToast(`❌ Lỗi lưu bài viết: ${err?.message || err}`, true);
    } finally {
      setPostBusy(false);
    }
  };

  const handleTogglePostPublish = async (post) => {
    await updatePostInDb(post.id, { published: !post.published });
    await Promise.all([loadAdminPosts(), reloadPosts(false)]);
    showToast(post.published ? `🙈 Đã gỡ bài "${post.title}" xuống nháp` : `✅ Đã xuất bản lại "${post.title}"`);
  };

  const handleDeletePost = async (post) => {
    if (!window.confirm(`Xóa vĩnh viễn bài viết "${post.title}"?`)) return;
    await deletePostInDb(post.id);
    await Promise.all([loadAdminPosts(), reloadPosts(false)]);
    showToast(`🗑️ Đã xóa bài viết "${post.title}"`);
  };

  const filteredAdminProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.name} ${p.code} ${p.category} ${p.warehouseName}`.toLowerCase().includes(q));
  }, [products, prodSearch]);

  if (!authed) {
    return (
      <div className="admin-shell">
        <div className="admin-login-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img src="/ag-logo.jpg" alt="AG" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover' }} />
            <div>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 19 }}>🛡️ Quản Trị AG STORE</h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Đăng / gỡ sản phẩm &amp; bài viết PostgreSQL</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <button
              type="button"
              className={`admin-tab-btn ${loginMode === 'passcode' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', padding: '8px 10px' }}
              onClick={() => setLoginMode('passcode')}
            >
              🔑 Mã nhanh
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${loginMode === 'supabase' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', padding: '8px 10px' }}
              onClick={() => setLoginMode('supabase')}
            >
              🗄️ Supabase Auth
            </button>
          </div>

          <form onSubmit={handleLogin}>
            {loginMode === 'passcode' ? (
              <div className="admin-field">
                <label>Mã quản trị (mặc định: agstore2026)</label>
                <input
                  type="password"
                  className="admin-input"
                  placeholder="Nhập mã quản trị..."
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div className="admin-field">
                  <label>Email Admin (Supabase Auth)</label>
                  <input
                    type="email"
                    className="admin-input"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="admin-field">
                  <label>Mật khẩu</label>
                  <input
                    type="password"
                    className="admin-input"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={loginBusy}>
              {loginBusy ? '⏳ Đang xác thực...' : '🔓 Vào trang Quản Trị'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="section-head-row" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="section-title">🛡️ Trung Tâm Quản Trị AG STORE (/admin)</h1>
          <p className="section-sub">
            {sbUser
              ? `Đang đăng nhập PostgreSQL bằng: ${sbUser.email}`
              : 'Chế độ quản trị nhanh — có thể đăng/gỡ sản phẩm & bài viết trực tiếp'}
          </p>
        </div>
        <button type="button" className="btn-danger-soft" onClick={handleLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <LogOut size={14} /> Đăng xuất
        </button>
      </div>

      {/* KPI STRIP */}
      <div className="admin-stat-strip">
        <div className="admin-stat-card">
          <span>Tổng sản phẩm</span>
          <strong>{products.length}</strong>
        </div>
        <div className="admin-stat-card">
          <span>Đang sẵn hàng</span>
          <strong style={{ color: '#6ee7b7' }}>{products.filter((p) => !p.isOutOfStock).length}</strong>
        </div>
        <div className="admin-stat-card">
          <span>Tổng bài viết</span>
          <strong style={{ color: '#67e8f9' }}>{allAdminPosts.length}</strong>
        </div>
        <div className="admin-stat-card">
          <span>Cơ sở dữ liệu</span>
          <strong style={{ fontSize: 15, color: '#fbbf24' }}>PostgreSQL / Supabase</strong>
        </div>
      </div>

      {/* ADMIN TABS */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <Package size={16} /> Quản lý Sản phẩm ({products.length})
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          <Newspaper size={16} /> Quản lý Bài viết ({allAdminPosts.length})
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'db' ? 'active' : ''}`}
          onClick={() => setActiveTab('db')}
        >
          <Database size={16} /> Kết nối PostgreSQL
        </button>
      </div>

      {/* TAB 1: PRODUCTS */}
      {activeTab === 'products' && (
        <div className="admin-grid-2">
          <div className="admin-panel">
            <h3>➕ Đăng Sản Phẩm Mới</h3>
            <form onSubmit={handleCreateProduct}>
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
                  <label>Số lượng tồn</label>
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
                <label>Ảnh sản phẩm (Dán URL hoặc tải ảnh từ máy)</label>
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
                  <Upload size={14} /> Chọn ảnh từ máy tính
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
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={prodBusy}>
                <PlusCircle size={16} /> {prodBusy ? 'Đang đăng...' : 'Đăng Sản Phẩm Lên Web'}
              </button>
            </form>
          </div>

          <div className="admin-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>📋 Danh Sách Sản Phẩm ({filteredAdminProducts.length})</h3>
              <input
                className="admin-input"
                style={{ maxWidth: 240 }}
                placeholder="🔍 Tìm mã / tên SP..."
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
              />
            </div>

            <div className="admin-table-wrap" style={{ maxHeight: 560, overflowY: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ảnh</th>
                    <th>Sản phẩm</th>
                    <th>Kho / Loại</th>
                    <th>Tồn</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdminProducts.slice(0, 100).map((p) => (
                    <tr key={p.key}>
                      <td>
                        <img src={p.imageUrl} alt={p.name} className="admin-thumb" />
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#fff' }}>{p.name}</div>
                        <div style={{ fontSize: 11.5, color: '#67e8f9' }}>{p.code}</div>
                      </td>
                      <td>
                        <div style={{ color: '#cbd5e1' }}>{p.warehouseName}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{p.category}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: p.isOutOfStock ? '#f87171' : '#6ee7b7' }}>
                          {p.isOutOfStock ? 'Ẩn / Hết' : p.soLuong}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn-cyan-soft"
                            title={p.isOutOfStock ? 'Mở bán lại' : 'Ẩn / Tạm hết hàng'}
                            onClick={() => handleToggleProductStock(p)}
                          >
                            {p.isOutOfStock ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button
                            type="button"
                            className="btn-danger-soft"
                            title="Gỡ sản phẩm xuống"
                            onClick={() => handleDeleteProduct(p)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: POSTS */}
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
                  <Upload size={14} /> Chọn ảnh bìa từ máy
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload(e.target.files?.[0], 'post')}
                  />
                </label>
              </div>
              <div className="admin-field">
                <label>Mô tả ngắn (hiển thị ngoài danh sách)</label>
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
                      setPostForm({ title: '', category: 'Tin kho hàng', cover_url: '', excerpt: '', content: '', published: true });
                    }}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-panel">
            <h3>📰 Danh Sách Bài Viết ({allAdminPosts.length})</h3>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
              Nguồn dữ liệu: <strong style={{ color: postsSource === 'postgresql' ? '#6ee7b7' : '#fbbf24' }}>
                {postsSource === 'postgresql' ? 'PostgreSQL (zaloshop_posts)' : 'Local Preview (chạy schema.sql để lưu Cloud)'}
              </strong>
            </div>

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
                  {allAdminPosts.map((post) => (
                    <tr key={post.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#fff' }}>{post.title}</div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8' }}>/{post.slug} • {post.category}</div>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DATABASE SETUP */}
      {activeTab === 'db' && (
        <div className="admin-panel">
          <h3>🗄️ Cấu Hình PostgreSQL / Supabase (Deploy Vercel)</h3>
          <p style={{ color: '#cbd5e1', fontSize: 13.5, lineHeight: 1.6 }}>
            Website đang kết nối trực tiếp tới PostgreSQL tại: <strong style={{ color: '#67e8f9' }}>{SUPABASE_URL}</strong>.
            Để lưu bài viết (<code>zaloshop_posts</code>) và bật quyền đăng/gỡ sản phẩm trực tiếp trên Cloud cho tài khoản Admin Supabase Auth, copy đoạn SQL dưới đây dán vào <strong>Supabase ➔ SQL Editor ➔ Run</strong>:
          </p>
          <pre
            style={{
              background: '#050814',
              border: '1px solid rgba(56,189,248,0.3)',
              borderRadius: 12,
              padding: 14,
              color: '#a5f3fc',
              fontSize: 12,
              overflowX: 'auto',
              lineHeight: 1.5
            }}
          >
            {SCHEMA_SQL_SNIPPET}
          </pre>
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              await navigator.clipboard.writeText(SCHEMA_SQL_SNIPPET);
              showToast('✅ Đã copy SQL schema! Dán vào Supabase SQL Editor và bấm Run nhé.');
            }}
          >
            <Copy size={15} /> Copy SQL Schema
          </button>
        </div>
      )}
    </div>
  );
}
