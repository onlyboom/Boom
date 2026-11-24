import React, { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';

export default function HeroMarquee() {
  const { products, openQuickView, showToast } = useStore();
  const stageRef = useRef(null);
  const track1Ref = useRef(null);
  const track2Ref = useRef(null);

  const stateRef = useRef({
    x1: 0,
    x2: 0,
    v1: -22,
    v2: 18,
    inertia: 0,
    pausedByUser: false,
    dragging: false,
    dragRow: 0,
    lastX: 0,
    movedPx: 0,
    suppressClickUntil: 0,
    pendingClickTimer: null,
    cachedHalf1: 0,
    cachedHalf2: 0
  });

  const { rowA, rowB } = useMemo(() => {
    const inStock = products.filter((p) => !p.isOutOfStock && p.imageUrl);
    const src = inStock.length > 0 ? inStock : products.filter((p) => p.imageUrl);
    if (src.length === 0) return { rowA: [], rowB: [] };
    const half = Math.max(1, Math.ceil(src.length / 2));
    const a = src.slice(0, Math.min(half, 18));
    const b = src.slice(half, Math.min(src.length, half + 18));
    return { rowA: a, rowB: b.length > 0 ? b : [...a].reverse() };
  }, [products]);

  useEffect(() => {
    const stage = stageRef.current;
    const t1 = track1Ref.current;
    const t2 = track2Ref.current;
    if (!stage || !t1 || !t2) return;
    const st = stateRef.current;

    const wrapPos = (x, half) => {
      if (half <= 10) return 0;
      let v = x % half;
      if (v > 0) v -= half;
      return v;
    };

    const measure = () => {
      st.cachedHalf1 = t1.offsetWidth / 2;
      st.cachedHalf2 = t2.offsetWidth / 2;
      if (st.cachedHalf2 > 0 && st.x2 === 0) st.x2 = -st.cachedHalf2 * 0.5;
    };
    measure();

    const onResize = () => measure();
    window.addEventListener('resize', onResize, { passive: true });

    const beginDrag = (clientX, targetEl) => {
      st.dragging = true;
      st.lastX = clientX;
      st.movedPx = 0;
      st.inertia = 0;
      st.dragRow = targetEl?.closest('#heroTrack1') ? 1 : targetEl?.closest('#heroTrack2') ? 2 : 0;
    };

    const moveDrag = (clientX) => {
      if (!st.dragging) return;
      const dx = clientX - st.lastX;
      st.lastX = clientX;
      st.movedPx += Math.abs(dx);
      if (st.movedPx > 5 && !stage.classList.contains('dragging')) {
        stage.classList.add('dragging');
      }
      if (st.movedPx <= 5) return;
      if (st.dragRow === 1) {
        st.x1 += dx;
        st.x2 += dx * 0.35;
      } else if (st.dragRow === 2) {
        st.x2 += dx;
        st.x1 += dx * 0.35;
      } else {
        st.x1 += dx;
        st.x2 += dx;
      }
      st.inertia = dx * 0.85;
    };

    const endDrag = () => {
      if (!st.dragging) return;
      st.dragging = false;
      stage.classList.remove('dragging');
      if (st.movedPx > 7) {
        st.suppressClickUntil = performance.now() + 220;
      }
    };

    const onMouseDown = (e) => {
      if (e.button === 0) beginDrag(e.clientX, e.target);
    };
    const onMouseMove = (e) => moveDrag(e.clientX);
    const onTouchStart = (e) => {
      if (e.touches.length > 0) beginDrag(e.touches[0].clientX, e.target);
    };
    const onTouchMove = (e) => {
      if (st.dragging && e.touches.length > 0) moveDrag(e.touches[0].clientX);
    };
    const onDblClick = (e) => {
      e.preventDefault();
      clearTimeout(st.pendingClickTimer);
      st.pendingClickTimer = null;
      st.suppressClickUntil = performance.now() + 260;
      st.pausedByUser = !st.pausedByUser;
      st.inertia = 0;
      showToast(
        st.pausedByUser
          ? '⏸ Đã dừng dòng sản phẩm — Nhấp đúp lần nữa để chạy tiếp'
          : '▶ Đã chạy tiếp dòng sản phẩm'
      );
    };

    stage.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', endDrag, { passive: true });
    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', endDrag, { passive: true });
    stage.addEventListener('dblclick', onDblClick);

    let prevTime = performance.now();
    let lastRx1 = null;
    let lastRx2 = null;
    let rafId = null;

    const tick = (now) => {
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;
      if (st.cachedHalf1 <= 20) st.cachedHalf1 = t1.offsetWidth / 2;
      if (st.cachedHalf2 <= 20) st.cachedHalf2 = t2.offsetWidth / 2;

      const isActivelyDragging = st.dragging && st.movedPx > 5;
      if (!isActivelyDragging) {
        if (Math.abs(st.inertia) > 0.15) {
          st.x1 += st.inertia;
          st.x2 += st.inertia;
          st.inertia *= 0.92;
        } else if (!st.pausedByUser) {
          st.x1 += st.v1 * dt;
          st.x2 += st.v2 * dt;
        }
      }

      if (st.cachedHalf1 > 20) {
        st.x1 = wrapPos(st.x1, st.cachedHalf1);
        const rx1 = Math.round(st.x1 * 2) / 2;
        if (rx1 !== lastRx1) {
          lastRx1 = rx1;
          t1.style.transform = `translate3d(${rx1}px, 0, 0)`;
        }
      }
      if (st.cachedHalf2 > 20) {
        st.x2 = wrapPos(st.x2, st.cachedHalf2);
        const rx2 = Math.round(st.x2 * 2) / 2;
        if (rx2 !== lastRx2) {
          lastRx2 = rx2;
          t2.style.transform = `translate3d(${rx2}px, 0, 0)`;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      stage.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
      stage.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', endDrag);
      stage.removeEventListener('dblclick', onDblClick);
    };
  }, [rowA.length, rowB.length, showToast]);

  const handleCardClick = (key) => {
    const st = stateRef.current;
    if (performance.now() < st.suppressClickUntil) return;
    clearTimeout(st.pendingClickTimer);
    st.pendingClickTimer = setTimeout(() => {
      st.pendingClickTimer = null;
      openQuickView(key);
    }, 170);
  };

  const renderRow = (list, prefix) => {
    if (list.length === 0) {
      return Array.from({ length: 6 }).map((_, i) => <div key={`${prefix}-sk-${i}`} className="h3d-skeleton" />);
    }
    return [...list, ...list].map((p, idx) => (
      <div key={`${prefix}-${p.key}-${idx}`} className="h3d-card" onClick={() => handleCardClick(p.key)}>
        <div className="h3d-thumb">
          <img src={p.imageUrl} loading="eager" draggable="false" alt={p.name} />
        </div>
        <div className="h3d-meta">
          <span className="h3d-code">{p.code}</span>
          <div className="h3d-name">{p.name}</div>
          <div className="h3d-qty">● Sẵn {p.soLuong || 0} sp</div>
        </div>
      </div>
    ));
  };

  return (
    <section className="hero-wrap" id="heroBanner">
      <div className="hero-card" id="hero3dCard">
        <div className="hero-depth-chamber">
          <div className="hero-depth-ceiling" />
          <div className="hero-depth-floor" />
        </div>
        <div className="hero-depth-horizon" />
        <div className="hero-led-rails">
          <div className="hero-led-bar r-top" />
          <div className="hero-led-bar r-mid" />
          <div className="hero-led-bar r-bot" />
        </div>

        <div
          className="hero-3d-stage"
          id="hero3dStage"
          ref={stageRef}
          title="Giữ chuột kéo ngang • Nhấp đúp để dừng/chạy • Nhấp vào mẫu để xem nhanh"
        >
          <div className="hero-3d-plane" id="hero3dPlane">
            <div className="hero-marquee-row row-1" id="heroTrack1" ref={track1Ref}>
              {renderRow(rowA, 'r1')}
            </div>
            <div className="hero-marquee-row row-2" id="heroTrack2" ref={track2Ref}>
              {renderRow(rowB, 'r2')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
