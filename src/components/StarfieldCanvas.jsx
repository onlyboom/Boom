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
    const stars = [];
    const meteors = [];
    const STAR_COUNT = 160;

    function resize() {
      w = cvs.width = window.innerWidth;
      h = cvs.height = window.innerHeight;
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.45 + 0.35,
          a: Math.random() * 0.75 + 0.2,
          tw: Math.random() * 0.025 + 0.008,
          ph: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08
        });
      }
    }

    function spawnMeteor() {
      if (meteors.length >= 2) return;
      meteors.push({
        x: Math.random() * w * 0.8 + w * 0.1,
        y: Math.random() * h * 0.35,
        vx: 7 + Math.random() * 4,
        vy: 3.2 + Math.random() * 2.2,
        len: 70 + Math.random() * 60,
        life: 0,
        maxLife: 45 + Math.random() * 25
      });
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    const meteorTimer = setInterval(() => {
      if (Math.random() < 0.45) spawnMeteor();
    }, 3600);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.ph += s.tw;
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = w;
        if (s.x > w) s.x = 0;
        if (s.y < 0) s.y = h;
        if (s.y > h) s.y = 0;
        const alpha = Math.max(0.12, Math.min(0.95, s.a + Math.sin(s.ph) * 0.25));
        ctx.fillStyle = `rgba(210, 236, 255, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
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
        const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 8, m.y - m.vy * 8);
        grad.addColorStop(0, `rgba(186, 230, 253, ${(fade * 0.85).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 8, m.y - m.vy * 8);
        ctx.stroke();
      }
      rafId = requestAnimationFrame(draw);
    }
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(meteorTimer);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas id="starfieldCanvas" ref={canvasRef} />;
}
