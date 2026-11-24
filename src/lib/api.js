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

// ============================================================
// CUSTOMER ACCOUNT ENDPOINTS (REGISTER / LOGIN / SESSION)
// ============================================================
const VALID_VN_PREFIXES_CLIENT = new Set([
  '032', '033', '034', '035', '036', '037', '038', '039', '086', '096', '097', '098',
  '070', '076', '077', '078', '079', '089', '090', '093',
  '081', '082', '083', '084', '085', '088', '091', '094',
  '052', '056', '058', '092', '055', '059', '087', '099'
]);

const JUNK_SEQ_CLIENT = [
  '0123456', '1234567', '2345678', '3456789',
  '9876543', '8765432', '7654321', '6543210'
];

export function validateRealVnPhoneClient(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+84')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('84') && digits.length === 11) digits = '0' + digits.slice(2);
  const phone = digits.replace(/\D/g, '');
  if (phone.length !== 10) return { valid: false, phone, error: 'SĐT phải gồm đúng 10 chữ số (bắt đầu bằng 0).' };
  const prefix = phone.slice(0, 3);
  if (!VALID_VN_PREFIXES_CLIENT.has(prefix)) return { valid: false, phone, error: `Đầu số "${prefix}" không thuộc nhà mạng VN hợp lệ.` };
  if (/(\d)\1{5,}/.test(phone)) return { valid: false, phone, error: 'SĐT lặp quá nhiều chữ số giống nhau — vui lòng nhập SĐT thật.' };
  if (new Set(phone.slice(3).split('')).size <= 1) return { valid: false, phone, error: 'Vui lòng nhập SĐT thật đang sử dụng.' };
  if (/^(\d{2})\1{3}$/.test(phone.slice(2))) return { valid: false, phone, error: 'SĐT lặp cặp số ảo — vui lòng nhập SĐT thật.' };
  if (JUNK_SEQ_CLIENT.some((s) => phone.includes(s))) return { valid: false, phone, error: 'SĐT dạng dãy số liên tiếp không hợp lệ.' };
  return { valid: true, phone, error: '' };
}

export async function fetchCustomerSession() {
  return apiRequest('/api/account', { method: 'GET' });
}

export async function registerCustomerAccount(payload) {
  return apiRequest('/api/account', { method: 'POST', body: { action: 'register', ...payload } });
}

export async function loginCustomerAccount(identifier, password) {
  return apiRequest('/api/account', { method: 'POST', body: { action: 'login', identifier, password } });
}

export async function logoutCustomerAccount() {
  return apiRequest('/api/account', { method: 'DELETE' });
}
