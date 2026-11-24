import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function PostsPage() {
  const { posts } = useStore();
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [kw, setKw] = useState('');

  const categories = useMemo(() => {
    const s = new Set(posts.map((p) => p.category || 'Tin kho hàng'));
    return Array.from(s);
  }, [posts]);

  const filtered = useMemo(() => {
    const q = kw.trim().toLowerCase();
    return posts.filter((p) => {
      if (selectedCat !== 'ALL' && (p.category || 'Tin kho hàng') !== selectedCat) return false;
      if (q && !`${p.title} ${p.excerpt} ${p.content}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, selectedCat, kw]);

  return (
    <main className="main-wrap">
      <div className="section-head-row">
        <div>
          <h1 className="section-title">📰 Bài Viết &amp; Tin Tức Kho Hàng</h1>
          <p className="section-sub">Cập nhật thông tin hàng mới về, kinh nghiệm nhập sỉ &amp; chính sách đóng gói tại AG STORE.</p>
        </div>
        <input
          type="text"
          className="admin-input"
          style={{ maxWidth: 280 }}
          placeholder="🔍 Tìm bài viết..."
          value={kw}
          onChange={(e) => setKw(e.target.value)}
        />
      </div>

      <div className="cat-tabs" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`cat-tab ${selectedCat === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedCat('ALL')}
        >
          Tất cả ({posts.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`cat-tab ${selectedCat === cat ? 'active' : ''}`}
            onClick={() => setSelectedCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          Chưa có bài viết nào phù hợp. Hãy thử chọn chuyên mục hoặc từ khóa khác!
        </div>
      ) : (
        <div className="posts-grid">
          {filtered.map((post) => (
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
                  <span style={{ color: '#67e8f9', fontWeight: 700 }}>Đọc chi tiết →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
