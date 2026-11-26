// ============================================================
// AG STORE WEB AUDIO SFX ENGINE
// Hiệu ứng âm thanh click chuột, xoay 360° 0.25s, chọn nhiều mẫu & giỏ hàng
// ============================================================

const SFX_STORAGE_KEY = 'agstore_sfx_enabled_v1';

class ShopSfxEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    try {
      const saved = localStorage.getItem(SFX_STORAGE_KEY);
      if (saved === '0') this.enabled = false;
    } catch {}
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    try {
      localStorage.setItem(SFX_STORAGE_KEY, this.enabled ? '1' : '0');
    } catch {}
    if (this.enabled) this.click();
    return this.enabled;
  }

  ensureCtx() {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Click chuột giòn gọn
  click() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.045);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  // Âm thanh xoay khung hình 360° trong 0.25s (swirl + chime vui tai)
  spin() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Giai điệu xoay lấp lánh vui tai (rising chime 0.25s)
    [440, 587.33, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.052;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, t + 0.06);
      gain.gain.setValueAtTime(0.005, t);
      gain.gain.linearRampToValueAtTime(0.095, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    });

    // 2. Tiếng gió xoáy mượt bằng filtered noise
    const bufSize = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.13);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.25);
    filter.Q.value = 2.6;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.005, now);
    nGain.gain.linearRampToValueAtTime(0.08, now + 0.09);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.25);
  }

  // Thêm vào giỏ / chọn nhiều sản phẩm
  add() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.08, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.12);
    });
  }

  // Bỏ chọn / giảm số lượng
  remove() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.08);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  // Hoàn tất thêm hàng loạt / đặt đơn
  success() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }
}

export const ShopSFX = new ShopSfxEngine();
