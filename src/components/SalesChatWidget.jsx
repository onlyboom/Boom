import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Send, X, Sparkles, Phone } from 'lucide-react';
import { fetchChatHistory, sendChatMessage } from '../lib/api';

const SESSION_STORAGE_KEY = 'agstore_chat_session_id_v1';
const LEAD_STORAGE_KEY = 'agstore_chat_lead_v1';

const QUICK_SUGGESTIONS = [
  'Mình muốn hỏi mua lẻ / sỉ dòng Blokees',
  'Shop hiện có những mẫu nào đang sẵn hàng?',
  'Tư vấn giúp mình chọn mẫu bán chạy / đẹp nhất nhé'
];

function getOrCreateSessionId() {
  try {
    let sid = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sid) {
      sid = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(SESSION_STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return `web_${Date.now().toString(36)}`;
  }
}

export default function SalesChatWidget() {
  const location = useLocation();
  const isHiddenRoute = location.pathname === '/admin' || location.pathname === '/.admin';

  const [open, setOpen] = useState(false);
  const [sessionId] = useState(() => getOrCreateSessionId());
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      content:
        'Dạ chào anh/chị ghé AG STORE ạ! Bên em có bán cả lẻ lẫn sỉ mô hình Blokees & đồ chơi lắp ghép. Anh/chị đang tìm mẫu nào hay cần tư vấn cứ nhắn em nhé!',
      created_at: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showLeadBar, setShowLeadBar] = useState(false);
  const [leadName, setLeadName] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LEAD_STORAGE_KEY) || '{}').name || '';
    } catch {
      return '';
    }
  });
  const [leadPhone, setLeadPhone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LEAD_STORAGE_KEY) || '{}').phone || '';
    } catch {
      return '';
    }
  });
  const [aiPaused, setAiPaused] = useState(false);

  const listRef = useRef(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, open]);

  // Lưu tên & SĐT khách cục bộ để không phải nhập lại
  useEffect(() => {
    try {
      localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify({ name: leadName, phone: leadPhone }));
    } catch {}
  }, [leadName, leadPhone]);

  // Đồng bộ lịch sử & nhận tin nhắn trực tiếp từ Admin mỗi 5 giây khi mở khung chat
  useEffect(() => {
    if (!open || isHiddenRoute) return;
    let active = true;

    const syncHistory = async () => {
      try {
        const res = await fetchChatHistory(sessionId);
        if (!active) return;
        if (res.session) {
          setAiPaused(Boolean(res.session.ai_paused));
          if (res.session.phone && !leadPhone) setLeadPhone(res.session.phone);
        }
        if (Array.isArray(res.messages) && res.messages.length > 0) {
          setMessages(res.messages);
        }
      } catch {}
    };

    syncHistory();
    const timer = setInterval(syncHistory, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open, isHiddenRoute, sessionId]);

  if (isHiddenRoute) return null;

  const handleSend = async (customText) => {
    const text = String(customText !== undefined ? customText : input).trim();
    if (!text || sending) return;

    const optimisticMsg = {
      id: `local-${Date.now()}`,
      sender: 'customer',
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    if (customText === undefined) setInput('');
    setSending(true);

    try {
      const res = await sendChatMessage({
        sessionId,
        message: text,
        customerName: leadName.trim(),
        phone: leadPhone.trim(),
        pagePath: location.pathname
      });

      if (res.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            content: res.reply,
            created_at: new Date().toISOString()
          }
        ]);
      } else if (res.aiPaused) {
        setAiPaused(true);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          content:
            'Dạ kết nối đang hơi chậm một chút ạ. Anh/chị để lại SĐT Zalo để nhân viên kho AG STORE nhắn báo giá trực tiếp ngay cho mình nhé ạ!',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="sales-chat-root">
      {open && (
        <div className="sales-chat-panel" role="dialog" aria-label="Chat tư vấn AG STORE">
          <div className="sales-chat-header">
            <div className="sales-chat-head-left">
              <div className="sales-chat-avatar">
                <img src="/ag-logo.jpg" alt="AG" />
                <span className="sales-chat-online-dot" />
              </div>
              <div>
                <div className="sales-chat-title">Tư Vấn AG STORE</div>
                <div className="sales-chat-sub">
                  {aiPaused ? '👤 Nhân viên kho đang hỗ trợ trực tiếp' : '✨ Trợ lý AI trực kho 24/7'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="sales-chat-icon-btn"
                title="Để lại SĐT Zalo nhận báo giá sỉ"
                onClick={() => setShowLeadBar((v) => !v)}
              >
                <Phone size={15} />
              </button>
              <button
                type="button"
                className="sales-chat-icon-btn"
                title="Đóng khung chat"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {showLeadBar && (
            <div className="sales-chat-lead-bar">
              <input
                type="text"
                className="sales-chat-lead-inp"
                placeholder="Tên anh/chị..."
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
              />
              <input
                type="tel"
                className="sales-chat-lead-inp"
                placeholder="SĐT Zalo nhận bảng giá..."
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
              />
            </div>
          )}

          <div className="sales-chat-messages" ref={listRef}>
            {messages.map((m, i) => {
              const isCustomer = m.sender === 'customer';
              const isAdmin = m.sender === 'admin';
              return (
                <div key={m.id || i} className={`sales-chat-row ${isCustomer ? 'me' : 'bot'}`}>
                  {!isCustomer && (
                    <div className="sales-chat-sender-tag">
                      {isAdmin ? '🛡️ Nhân viên kho AG' : '✨ Trợ lý AG STORE'}
                    </div>
                  )}
                  <div className={`sales-chat-bubble ${isCustomer ? 'me' : isAdmin ? 'admin' : 'bot'}`}>
                    {m.content}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="sales-chat-row bot">
                <div className="sales-chat-bubble bot typing">Đang kiểm tra kho &amp; soạn trả lời...</div>
              </div>
            )}

            {messages.length <= 1 && !sending && (
              <div className="sales-chat-chips">
                {QUICK_SUGGESTIONS.map((q) => (
                  <button key={q} type="button" className="sales-chat-chip" onClick={() => handleSend(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form className="sales-chat-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="sales-chat-input"
              placeholder="Nhập mẫu cần hỏi hoặc SĐT Zalo..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button type="submit" className="sales-chat-send-btn" disabled={sending || !input.trim()} aria-label="Gửi">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className={`sales-chat-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Mở chat tư vấn sỉ AG STORE"
      >
        {open ? (
          <X size={22} />
        ) : (
          <>
            <MessageCircle size={20} />
            <span>Chat tư vấn</span>
            <Sparkles size={14} className="sales-chat-spark" />
          </>
        )}
      </button>
    </div>
  );
}
