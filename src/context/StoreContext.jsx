import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { fetchProductsFromDb, fetchPostsFromDb } from '../lib/supabase';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [posts, setPosts] = useState([]);
  const [postsSource, setPostsSource] = useState('postgresql');
  const [cart, setCart] = useState({}); // { [key]: qty }
  const [searchQuery, setSearchQuery] = useState('');
  const [quickViewKey, setQuickViewKey] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, text: '', isError: false });

  // Giữ nguyên tham số ?kho=...&acc=...&uid=... từ link Zalo AI Sale
  const [zaloParams] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      kho: (p.get('kho') || p.get('warehouse') || '').trim(),
      acc: (p.get('acc') || '').trim(),
      uid: (p.get('uid') || '').trim()
    };
  });

  const showToast = useCallback((text, isError = false) => {
    setToast({ show: true, text, isError });
  }, []);

  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 2800);
    return () => clearTimeout(t);
  }, [toast.show, toast.text]);

  const reloadProducts = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingProducts(true);
      try {
        const list = await fetchProductsFromDb(zaloParams.kho);
        setProducts(list);
        setProductsError('');
        // Tự điều chỉnh giỏ hàng nếu tồn kho thay đổi
        setCart((prev) => {
          const next = { ...prev };
          let changed = false;
          const byKey = new Map(list.map((p) => [p.key, p]));
          for (const [k, qty] of Object.entries(next)) {
            const prod = byKey.get(k);
            if (!prod || prod.isOutOfStock) {
              delete next[k];
              changed = true;
            } else if (qty > prod.soLuong) {
              next[k] = prod.soLuong;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      } catch (err) {
        setProductsError(err?.message || 'Không tải được dữ liệu kho từ Supabase');
      } finally {
        if (!silent) setLoadingProducts(false);
      }
    },
    [zaloParams.kho]
  );

  const reloadPosts = useCallback(async (includeDrafts = false) => {
    const res = await fetchPostsFromDb({ includeDrafts });
    setPosts(res.posts || []);
    setPostsSource(res.source || 'postgresql');
  }, []);

  useEffect(() => {
    reloadProducts(false);
    reloadPosts(false);
    const timer = setInterval(() => reloadProducts(true), 15000);
    return () => clearInterval(timer);
  }, [reloadProducts, reloadPosts]);

  const setItemQty = useCallback(
    (product, nextQty) => {
      if (!product) return;
      const maxStock = Math.max(0, Number(product.soLuong || 0));
      const clamped = Math.max(0, Math.min(maxStock, Number(nextQty) || 0));
      setCart((prev) => {
        const next = { ...prev };
        if (clamped <= 0) delete next[product.key];
        else next[product.key] = clamped;
        return next;
      });
      if (Number(nextQty) > maxStock && maxStock > 0) {
        showToast(`Kho chỉ còn tối đa ${maxStock} sp cho mã ${product.code}`, true);
      }
    },
    [showToast]
  );

  const clearCart = useCallback(() => setCart({}), []);

  const cartItems = useMemo(() => {
    const map = new Map(products.map((p) => [p.key, p]));
    return Object.entries(cart)
      .map(([k, qty]) => {
        const prod = map.get(k);
        return prod && qty > 0 ? { ...prod, qty } : null;
      })
      .filter(Boolean);
  }, [cart, products]);

  const totalCartQty = useMemo(() => cartItems.reduce((sum, it) => sum + it.qty, 0), [cartItems]);

  const quickViewProduct = useMemo(
    () => (quickViewKey ? products.find((p) => p.key === quickViewKey) || null : null),
    [quickViewKey, products]
  );

  const value = {
    products,
    loadingProducts,
    productsError,
    reloadProducts,
    posts,
    postsSource,
    reloadPosts,
    cart,
    cartItems,
    totalCartQty,
    setItemQty,
    clearCart,
    searchQuery,
    setSearchQuery,
    quickViewKey,
    quickViewProduct,
    openQuickView: (key) => setQuickViewKey(key),
    closeQuickView: () => setQuickViewKey(null),
    checkoutOpen,
    openCheckout: () => setCheckoutOpen(true),
    closeCheckout: () => setCheckoutOpen(false),
    toast,
    showToast,
    zaloParams
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
