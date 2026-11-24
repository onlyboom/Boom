import React, { useState } from 'react';
import { UserPlus, LogIn, X, ShieldCheck } from 'lucide-react';
import {
  loginCustomerAccount,
  registerCustomerAccount,
  validateRealVnPhoneClient
} from '../lib/api';
import { useStore } from '../context/StoreContext';

export default function AuthModal() {
  const { authModalOpen, authModalMode, setAuthModalMode, closeAuthModal, setCustomerUser, showToast } = useStore();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!authModalOpen) return null;

  const handlePhoneChange = (val) => {
    setPhone(val);
    if (val.trim().length >= 10) {
      const check = validateRealVnPhoneClient(val);
      setPhoneErr(check.valid ? '' : check.error);
    } else {
      setPhoneErr('');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const check = validateRealVnPhoneClient(phone);
    if (!check.valid) {
      setPhoneErr(check.error);
      showToast(`❌ ${check.error}`, true);
      return;
    }
    if (!/^[a-zA-Z0-9_.-]{4,24}$/.test(username.trim())) {
      showToast('❌ Tên đăng nhập 4–24 ký tự không dấu (chữ, số, _).', true);
      return;
    }
    if (address.trim().length < 8) {
      showToast('❌ Vui lòng nhập địa chỉ chi tiết đầy đủ để giao hàng.', true);
      return;
    }
    if (password.length < 6) {
      showToast('❌ Mật khẩu phải từ 6 ký tự trở lên.', true);
      return;
    }

    setBusy(true);
    try {
      const res = await registerCustomerAccount({
        username: username.trim(),
        full_name: fullName.trim() || username.trim(),
        phone: check.phone,
        address: address.trim(),
        password
      });
      setCustomerUser(res.user);
      closeAuthModal();
      setUsername('');
      setFullName('');
      setPhone('');
      setAddress('');
      setPassword('');
      setPhoneErr('');
      showToast(`✅ Đăng ký thành công! Chào mừng ${res.user.full_name || res.user.username} đến với AG STORE!`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Lỗi đăng ký tài khoản'}`, true);
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !loginPass) {
      showToast('❌ Vui lòng nhập tài khoản/SĐT và mật khẩu.', true);
      return;
    }
    setBusy(true);
    try {
      const res = await loginCustomerAccount(identifier.trim(), loginPass);
      setCustomerUser(res.user);
      closeAuthModal();
      setIdentifier('');
      setLoginPass('');
      showToast(`✅ Xin chào ${res.user.full_name || res.user.username}!`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Sai tài khoản hoặc mật khẩu'}`, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={closeAuthModal}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tài khoản AG STORE">
        <div className="auth-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/ag-logo.jpg" alt="AG" style={{ width: 40, height: 40, borderRadius: 11, objectFit: 'cover' }} />
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 17 }}>
                {authModalMode === 'register' ? 'Đăng Ký Tài Khoản AG STORE' : 'Đăng Nhập Tài Khoản'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                Lưu địa chỉ giao hàng &amp; nhận ưu đãi sỉ/lẻ nhanh qua Zalo
              </p>
            </div>
          </div>
          <button type="button" className="sales-chat-icon-btn" onClick={closeAuthModal} aria-label="Đóng">
            <X size={16} />
          </button>
        </div>

        <div className="auth-mode-tabs">
          <button
            type="button"
            className={`auth-mode-tab ${authModalMode === 'register' ? 'active' : ''}`}
            onClick={() => setAuthModalMode('register')}
          >
            <UserPlus size={14} /> Đăng ký mới
          </button>
          <button
            type="button"
            className={`auth-mode-tab ${authModalMode === 'login' ? 'active' : ''}`}
            onClick={() => setAuthModalMode('login')}
          >
            <LogIn size={14} /> Đã có tài khoản
          </button>
        </div>

        {authModalMode === 'register' ? (
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="admin-field">
                <label>Tên đăng nhập (Username) *</label>
                <input
                  className="admin-input"
                  required
                  placeholder="VD: minhanh99"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="admin-field">
                <label>Họ tên / Tên shop</label>
                <input
                  className="admin-input"
                  placeholder="VD: Minh Anh"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-field">
              <label>Số điện thoại thật (Zalo) *</label>
              <input
                type="tel"
                className="admin-input"
                required
                placeholder="VD: 0987654321 (10 số nhà mạng VN)"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
              {phoneErr ? (
                <div style={{ fontSize: 11.5, color: '#fda4af', marginTop: 2 }}>⚠️ {phoneErr}</div>
              ) : (
                <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={12} /> Hệ thống tự kiểm tra đầu số di động VN thật
                </div>
              )}
            </div>

            <div className="admin-field">
              <label>Địa chỉ nhận hàng chi tiết *</label>
              <input
                className="admin-input"
                required
                placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/TP..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="admin-field">
              <label>Mật khẩu *</label>
              <input
                type="password"
                className="admin-input"
                required
                minLength={6}
                placeholder="Tối thiểu 6 ký tự..."
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={busy}>
              {busy ? '⏳ Đang tạo tài khoản...' : '✨ Hoàn Tất Đăng Ký'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="admin-field">
              <label>Tên đăng nhập hoặc SĐT *</label>
              <input
                className="admin-input"
                required
                placeholder="Nhập username hoặc số điện thoại..."
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label>Mật khẩu *</label>
              <input
                type="password"
                className="admin-input"
                required
                placeholder="Nhập mật khẩu..."
                autoComplete="current-password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={busy}>
              {busy ? '⏳ Đang đăng nhập...' : '🔓 Đăng Nhập'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
