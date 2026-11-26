import React, { useEffect, useRef } from 'react';

export default function StarfieldCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    let w = 0;
    let h = 0;
    let rafId = null;

    // 3 lớp chiều sâu (0 = xa, 1 = trung bình, 2 = gần rực sáng)
    const stars = [];
    const meteors = [];
    const nebulas = [];
    const STAR_COUNT = 220;

    // Parallax nhẹ theo chuột & cuộn trang tạo chiều sâu không gian 3D
    let targetMouseX = 0;
    let targetMouseY = 0;
    let curMouseX = 0;
    let curMouseY = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      cvs.width = Math.floor(w * dpr);
      cvs.height = Math.floor(h * dpr);
      cvs.style.width = `${w}px`;
      cvs.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        const depth = i < 110 ? 0.35 : i < 185 ? 0.7 : 1.25;
        const tintRoll = Math.random();
        const rgb =
          tintRoll > 0.78
            ? '125, 211, 252'
            : tintRoll > 0.6
              ? '110, 231, 183'
              : tintRoll > 0.48
                ? '253, 230, 138'
                : '226, 240, 255';
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: (Math.random() * 1.15 + 0.35) * depth,
          depth,
          baseA: (Math.random() * 0.45 + 0.25) * Math.min(1, depth),
          tw: Math.random() * 0.025 + 0.008,
          ph: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 0.06 * depth,
          vy: -(0.04 + Math.random() * 0.1) * depth,
          rgb
        });
      }

      nebulas.length = 0;
      nebulas.push(
        { x: w * 0.18, y: h * 0.22, r: Math.max(w, h) * 0.34, color: '14, 165, 233', a: 0.085, ph: 0 },
        { x: w * 0.82, y: h * 0.3, r: Math.max(w, h) * 0.32, color: '99, 102, 241', a: 0.08, ph: 2.1 },
        { x: w * 0.5, y: h * 0.82, r: Math.max(w, h) * 0.36, color: '16, 185, 129', a: 0.065, ph: 4.2 }
      );
    }

    function spawnMeteor() {
      if (meteors.length >= 2) return;
      meteors.push({
        x: Math.random() * w * 0.75 + w * 0.1,
        y: Math.random() * h * 0.35,
        vx: 7.5 + Math.random() * 4.5,
        vy: 3.1 + Math.random() * 2.2,
        len: 85 + Math.random() * 70,
        life: 0,
        maxLife: 44 + Math.random() * 22
      });
    }

    const onMouseMove = (e) => {
      targetMouseX = (e.clientX / Math.max(1, w) - 0.5) * 26;
      targetMouseY = (e.clientY / Math.max(1, h) - 0.5) * 18;
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    const meteorTimer = setInterval(() => {
      if (Math.random() < 0.55) spawnMeteor();
    }, 3200);

    let t = 0;
    function draw() {
      t += 0.012;
      curMouseX += (targetMouseX - curMouseX) * 0.04;
      curMouseY += (targetMouseY - curMouseY) * 0.04;
      const scrollShift = (window.scrollY || 0) * 0.06;

      ctx.clearRect(0, 0, w, h);

      // 1. Vầng tinh vân chiều sâu nhẹ nhàng
      for (const nb of nebulas) {
        const pulse = nb.a + Math.sin(t + nb.ph) * 0.018;
        const nx = nb.x - curMouseX * 0.6;
        const ny = nb.y - curMouseY * 0.6;
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nb.r);
        g.addColorStop(0, `rgba(${nb.color}, ${pulse.toFixed(3)})`);
        g.addColorStop(1, `rgba(${nb.color}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(nx, ny, nb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. 3 tầng ánh sao chuyển động parallax
      for (const s of stars) {
        s.ph += s.tw;
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -8) s.x = w + 8;
        if (s.x > w + 8) s.x = -8;
        if (s.y < -8) s.y = h + 8;
        if (s.y > h + 8) s.y = -8;

        const px = s.x - curMouseX * s.depth;
        const py = ((s.y - scrollShift * s.depth - curMouseY * s.depth) % (h + 16) + (h + 16)) % (h + 16) - 8;
        const alpha = Math.max(0.12, Math.min(1, s.baseA + Math.sin(s.ph) * 0.3));

        ctx.fillStyle = `rgba(${s.rgb}, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();

        // Hào quang cho các ngôi sao tầng gần
        if (s.depth > 1.0 && s.r > 1.35) {
          ctx.fillStyle = `rgba(${s.rgb}, ${(alpha * 0.22).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(px, py, s.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Sao băng lướt ngang
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life++;
        const fade = 1 - m.life / m.maxLife;
        if (fade <= 0) {
          meteors.splice(i, 1);
          continue;
        }
        const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.len, m.y - m.len * 0.42);
        grad.addColorStop(0, `rgba(224, 242, 254, ${(fade * 0.92).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.len, m.y - m.len * 0.42);
        ctx.stroke();
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(meteorTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return <canvas id="starfieldCanvas" ref={canvasRef} />;
}
