// ============================================================
// AG STORE CLIENT API LAYER
// 100% giao tiếp qua Backend Server (/api/*)
// KHÔNG chứa Supabase URL/Key, KHÔNG chạy SQL ở UI/Client!
// ============================================================

async function apiRequest(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    credentials: 'same-origin',
    headers: {}
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, error: text || `HTTP ${res.status}` };
  }
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `Lỗi máy chủ (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ============================================================
// PUBLIC STOREFRONT ENDPOINTS
// ============================================================
export async function fetchPublicProducts(kho = '') {
  const qs = kho && kho !== 'ALL' ? `?kho=${encodeURIComponent(kho)}` : '';
  const data = await apiRequest(`/api/products${qs}`);
  return data.items || [];
}

export async function fetchPublicPosts(slug = '') {
  const qs = slug ? `?slug=${encodeURIComponent(slug)}` : '';
  const data = await apiRequest(`/api/posts${qs}`);
  return { posts: data.posts || [], source: data.source || 'database' };
}

export async function submitPublicOrder(payload) {
  return apiRequest('/api/orders', { method: 'POST', body: payload });
}

// ============================================================
// ADMIN AUTH ENDPOINTS (HttpOnly Cookie Session trên Server)
// ============================================================
export async function checkAdminSession() {
  return apiRequest('/api/admin/auth', { method: 'GET' });
}

export async function loginAdmin(username, password) {
  return apiRequest('/api/admin/auth', { method: 'POST', body: { username, password } });
}

export async function logoutAdmin() {
  return apiRequest('/api/admin/auth', { method: 'DELETE' });
}

// ============================================================
// ADMIN PRODUCTS & INVENTORY ENDPOINTS
// ============================================================
export async function fetchAdminProducts() {
  const data = await apiRequest('/api/admin/products');
  return data.items || [];
}

export async function createAdminProduct(product) {
  return apiRequest('/api/admin/products', { method: 'POST', body: product });
}

export async function updateAdminProduct(key, patch) {
  return apiRequest('/api/admin/products', { method: 'PATCH', body: { key, ...patch } });
}

export async function deleteAdminProduct(key) {
  return apiRequest(`/api/admin/products?id=${encodeURIComponent(key)}`, { method: 'DELETE' });
}

// ============================================================
// ADMIN ORDERS ENDPOINTS (FULL CRUD)
// ============================================================
export async function fetchAdminOrders() {
  const data = await apiRequest('/api/admin/orders');
  return data.orders || [];
}

export async function createAdminOrder(order) {
  return apiRequest('/api/admin/orders', { method: 'POST', body: order });
}

export async function updateAdminOrder(id, patch) {
  return apiRequest('/api/admin/orders', { method: 'PATCH', body: { id, ...patch } });
}

export async function deleteAdminOrder(id) {
  return apiRequest(`/api/admin/orders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ============================================================
// ADMIN CUSTOMERS ENDPOINTS
// ============================================================
export async function fetchAdminCustomers() {
  return apiRequest('/api/admin/customers');
}

export async function saveAdminCustomer(customer) {
  return apiRequest('/api/admin/customers', { method: 'POST', body: customer });
}

export async function deleteAdminCustomer(phone) {
  return apiRequest(`/api/admin/customers?phone=${encodeURIComponent(phone)}`, { method: 'DELETE' });
}

// ============================================================
// ADMIN POSTS ENDPOINTS
// ============================================================
export async function fetchAdminPosts() {
  const data = await apiRequest('/api/admin/posts');
  return data.posts || [];
}

export async function createAdminPost(post) {
  return apiRequest('/api/admin/posts', { method: 'POST', body: post });
}

export async function updateAdminPost(id, patch) {
  return apiRequest('/api/admin/posts', { method: 'PATCH', body: { id, ...patch } });
}

export async function deleteAdminPost(id) {
  return apiRequest(`/api/admin/posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ============================================================
// ADMIN IMAGE UPLOAD (qua Server)
// ============================================================
export function uploadAdminImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiRequest('/api/admin/upload', {
          method: 'POST',
          body: { fileName: file.name, dataUrl: String(reader.result || '') }
        });
        resolve(res.url);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
    reader.readAsDataURL(file);
  });
}

// ============================================================
// PUBLIC SALES AI CHATBOX ENDPOINTS (100% Server-Only)
// ============================================================
export async function fetchChatHistory(sessionId) {
  return apiRequest(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`);
}

export async function sendChatMessage(payload) {
  return apiRequest('/api/chat', { method: 'POST', body: payload });
}

// ============================================================
// ADMIN CHAT INBOX & HUMAN TAKEOVER ENDPOINTS
// ============================================================
export async function fetchAdminChatSessions() {
  return apiRequest('/api/admin/chats');
}

export async function fetchAdminChatMessages(sessionId) {
  return apiRequest(`/api/admin/chats?sessionId=${encodeURIComponent(sessionId)}`);
}

export async function sendAdminChatReply(sessionId, content, pauseAi = true) {
  return apiRequest('/api/admin/chats', { method: 'POST', body: { sessionId, content, pauseAi } });
}

export async function updateAdminChatSession(sessionId, patch) {
  return apiRequest('/api/admin/chats', { method: 'PATCH', body: { sessionId, ...patch } });
}

export async function deleteAdminChatSession(sessionId) {
  return apiRequest(`/api/admin/chats?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}
