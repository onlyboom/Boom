import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function PostDetailPage() {
  const { slug } = useParams();
  const { posts } = useStore();
  const decoded = decodeURIComponent(slug || '');

  const post = useMemo(
    () => posts.find((p) => p.slug === decoded || String(p.id) === decoded) || null,
    [posts, decoded]
  );

  if (!post) {
    return (
      <main className="main-wrap" style={{ textAlign: 'center', padding: 64 }}>
        <h2 style={{ color: '#fff' }}>Không tìm thấy bài viết</h2>
        <Link to="/bai-viet" className="section-link-btn" style={{ marginTop: 12 }}>
          ← Quay lại danh sách bài viết
        </Link>
      </main>
    );
  }

  return (
    <main className="main-wrap">
      <div className="breadcrumb-row">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/bai-viet">Bài viết</Link>
        <span>/</span>
        <span style={{ color: '#e2e8f0' }}>{post.title}</span>
      </div>

      <article className="article-reader">
        <span className="post-cat-badge">{post.category || 'Tin kho hàng'}</span>
        <h1>{post.title}</h1>
        <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 18 }}>
          📅 Đăng ngày {new Date(post.created_at || Date.now()).toLocaleDateString('vi-VN')} • AG STORE
        </div>

        {post.cover_url && (
          <div style={{ marginBottom: 22, borderRadius: 14, overflow: 'hidden', maxHeight: 400, background: '#070d1f' }}>
            <img
              src={post.cover_url}
              alt={post.title}
              style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}

        {post.excerpt && (
          <p style={{ fontSize: 15.5, fontWeight: 700, color: '#bae6fd', lineHeight: 1.65, marginBottom: 18 }}>
            {post.excerpt}
          </p>
        )}

        <div className="article-content">{post.content}</div>

        <div
          style={{
            marginTop: 28,
            paddingTop: 18,
            borderTop: '1px solid rgba(148,163,184,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <Link to="/bai-viet" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            ← Danh sách bài viết
          </Link>
          <Link to="/shop" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            🛒 Xem kho sản phẩm AG STORE
          </Link>
        </div>
      </article>
    </main>
  );
}
