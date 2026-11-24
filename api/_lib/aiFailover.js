// ============================================================
// SERVER-ONLY MULTI-AI SILENT FAILOVER ENGINE
// Tự động chuyển ngầm giữa các model Gemini -> OpenAI khi hết token / 429 / quota
// Không bao giờ làm gián đoạn cuộc trò chuyện của khách hàng!
// ============================================================

const slotCooldowns = new Map(); // slotKey -> timestamp ms
const COOLDOWN_MS = 5 * 60 * 1000; // 5 phút tạm nghỉ cho model vừa hết quota/token

function isSlotOnCooldown(slotKey) {
  const until = slotCooldowns.get(slotKey) || 0;
  if (until > Date.now()) return true;
  if (until > 0) slotCooldowns.delete(slotKey);
  return false;
}

function markSlotCooldown(slotKey, ms = COOLDOWN_MS) {
  slotCooldowns.set(slotKey, Date.now() + ms);
}

function splitKeys(raw) {
  return String(raw || '')
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function buildFailoverChain() {
  const geminiKeys = splitKeys(process.env.GEMINI_API_KEY || process.env.AI_GEMINI_API_KEY);
  const openaiKeys = splitKeys(process.env.OPENAI_API_KEY || process.env.AI_OPENAI_API_KEY);

  const rawOrder = String(process.env.AI_PROVIDER_ORDER || 'gemini,openai')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s === 'gemini' || s === 'openai');
  const order = rawOrder.length > 0 ? rawOrder : ['gemini', 'openai'];

  const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.0-flash-lite'];
  const openaiModels = ['gpt-4o-mini', 'gpt-4.1-mini'];

  const slots = [];
  for (const provider of order) {
    if (provider === 'gemini') {
      geminiKeys.forEach((key, kIdx) => {
        for (const model of geminiModels) {
          slots.push({
            slotKey: `gemini:${kIdx}:${model}`,
            provider: 'gemini',
            model,
            apiKey: key
          });
        }
      });
    } else if (provider === 'openai') {
      openaiKeys.forEach((key, kIdx) => {
        for (const model of openaiModels) {
          slots.push({
            slotKey: `openai:${kIdx}:${model}`,
            provider: 'openai',
            model,
            apiKey: key
          });
        }
      });
    }
  }
  return slots;
}

async function callGemini({ apiKey, model, systemPrompt, history, userMessage }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = [];
  for (const m of history.slice(-14)) {
    const role = m.sender === 'customer' ? 'user' : 'model';
    const text = String(m.content || '').trim();
    if (!text) continue;
    contents.push({ role, parts: [{ text }] });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 450
      }
    }),
    signal: AbortSignal.timeout(18000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Gemini ${model} HTTP ${res.status}: ${errText.slice(0, 180)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const reply =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || '')
      .join('')
      .trim() || '';

  if (!reply) {
    throw new Error(`Gemini ${model} trả về nội dung trống`);
  }
  return reply;
}

async function callOpenAI({ apiKey, model, systemPrompt, history, userMessage }) {
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const m of history.slice(-14)) {
    const role = m.sender === 'customer' ? 'user' : 'assistant';
    const content = String(m.content || '').trim();
    if (!content) continue;
    messages.push({ role, content });
  }
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 450
    }),
    signal: AbortSignal.timeout(18000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`OpenAI ${model} HTTP ${res.status}: ${errText.slice(0, 180)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const reply = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!reply) {
    throw new Error(`OpenAI ${model} trả về nội dung trống`);
  }
  return reply;
}

export function buildSalesSystemPrompt(products = [], customerInfo = {}) {
  const inStock = products.filter((p) => p.isVisible !== false && !p.isOutOfStock && p.soLuong > 0);
  const categories = {};
  for (const p of inStock) {
    categories[p.category] = (categories[p.category] || 0) + 1;
  }
  const catSummary = Object.entries(categories)
    .map(([k, v]) => `- ${k}: ${v} mẫu sẵn kho`)
    .join('\n');

  const sampleCatalog = inStock
    .slice(0, 40)
    .map((p) => `[${p.code}] ${p.name} (${p.category}, còn ${p.soLuong} sp)`)
    .join('\n');

  return [
    'Bạn là nhân viên tư vấn bán sỉ chuyên nghiệp của AG STORE (Tổng Kho Sỉ Đồ Chơi & Mô Hình Lắp Ghép: Blokees, Transformers, Lego, Hàng tổng hợp tận xưởng).',
    'QUY TẮC GIAO TIẾP:',
    '- Xưng "em", gọi khách là "anh/chị", mở đầu lịch sự bằng "Dạ", trả lời ngắn gọn 2–4 câu, đi thẳng trọng tâm, thân thiện và chuyên nghiệp.',
    '- TUYỆT ĐỐI KHÔNG tự bịa giá tiền cụ thể. Khi khách hỏi giá sỉ / giá nguyên thùng, giải thích rằng giá sỉ tận xưởng tính theo tổng số lượng & trộn mẫu linh hoạt, và mời anh/chị để lại SĐT Zalo ngay tại khung chat (hoặc bấm Tổng Bill) để nhân viên kho gửi bảng giá sỉ ưu đãi nhất.',
    '- Tư vấn dựa trên danh mục kho thực tế bên dưới. Nếu khách quan tâm mẫu nào, gợi ý đúng mã hàng và số lượng tồn kho.',
    '- Chính sách kho: Trộn mẫu linh hoạt từ số lượng ít, đóng gói chống móp hộp 3 lớp, giao nhanh toàn quốc và kiểm tra hàng trước thanh toán.',
    customerInfo.customerName ? `- Tên khách hiện tại: ${customerInfo.customerName}` : '',
    customerInfo.phone ? `- SĐT khách đã cung cấp: ${customerInfo.phone} (KHÔNG hỏi lại SĐT nếu khách đã cung cấp)` : '',
    `TỔNG QUAN KHO HIỆN TẠI (${inStock.length} mẫu đang sẵn hàng):`,
    catSummary || '- Hàng nhập (Blokees) & Hàng tổng hợp đang sẵn kho',
    'MỘT SỐ MÃ TIÊU BIỂU:',
    sampleCatalog || '- Đang cập nhật danh mục kho'
  ]
    .filter(Boolean)
    .join('\n');
}

function buildSmartFallbackReply(userMessage, products = [], hasPhone = false) {
  const q = String(userMessage || '').toLowerCase();
  const inStock = products.filter((p) => p.isVisible !== false && !p.isOutOfStock && p.soLuong > 0);
  const matched = inStock
    .filter((p) => q.split(/\s+/).some((w) => w.length >= 3 && `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(w)))
    .slice(0, 3);

  if (matched.length > 0) {
    const listTxt = matched.map((m) => `• [${m.code}] ${m.name} (sẵn ${m.soLuong} sp)`).join('\n');
    return hasPhone
      ? `Dạ bên em đang có sẵn các mẫu khớp với yêu cầu của anh/chị ạ:\n${listTxt}\nEm đã chuyển thông tin qua nhân viên kho để báo giá sỉ chi tiết qua Zalo cho mình ngay ạ!`
      : `Dạ bên em đang có sẵn các mẫu sau ạ:\n${listTxt}\nAnh/chị để lại SĐT Zalo ngay tại đây để nhân viên kho gửi bảng giá sỉ tận xưởng và giữ hàng cho mình nhé ạ!`;
  }

  return hasPhone
    ? `Dạ em đã ghi nhận yêu cầu và SĐT của anh/chị rồi ạ! Nhân viên kho AG STORE sẽ xem ngay và nhắn báo giá sỉ chi tiết qua Zalo trong ít phút tới ạ.`
    : `Dạ chào anh/chị ạ! Kho AG STORE hiện đang sẵn ${inStock.length || 130} mẫu Blokees & đồ chơi lắp ghép sỉ tận xưởng, trộn mẫu linh hoạt và đóng gói chống móp hộp toàn quốc. Anh/chị nhắn mã mẫu quan tâm hoặc để lại SĐT Zalo để nhân viên kho gửi bảng giá sỉ ưu đãi ngay nhé ạ!`;
}

export async function generateSalesReplyWithFailover({ userMessage, history = [], products = [], customerInfo = {} }) {
  const systemPrompt = buildSalesSystemPrompt(products, customerInfo);
  const allSlots = buildFailoverChain();

  // Ưu tiên các slot không bị cooldown trước; nếu tất cả đều cooldown thì vẫn thử lại lần cuối
  const activeSlots = allSlots.filter((s) => !isSlotOnCooldown(s.slotKey));
  const candidateSlots = activeSlots.length > 0 ? activeSlots : allSlots;

  const triedErrors = [];
  for (const slot of candidateSlots) {
    try {
      const reply =
        slot.provider === 'gemini'
          ? await callGemini({
              apiKey: slot.apiKey,
              model: slot.model,
              systemPrompt,
              history,
              userMessage
            })
          : await callOpenAI({
              apiKey: slot.apiKey,
              model: slot.model,
              systemPrompt,
              history,
              userMessage
            });

      return {
        reply,
        provider: slot.provider,
        model: slot.model,
        switchedCount: triedErrors.length
      };
    } catch (err) {
      const msg = String(err?.message || err);
      triedErrors.push(`${slot.provider}/${slot.model}: ${msg}`);
      // Nếu lỗi hết token / quota / rate limit / key sai -> đưa vào cooldown 5 phút và chuyển ngầm sang AI tiếp theo ngay!
      const isQuotaOrAuth =
        err?.status === 429 ||
        err?.status === 402 ||
        err?.status === 401 ||
        err?.status === 403 ||
        /quota|rate.?limit|resource_exhausted|insufficient|billing|token|invalid.*key|api_key/i.test(msg);
      markSlotCooldown(slot.slotKey, isQuotaOrAuth ? COOLDOWN_MS : 60 * 1000);
    }
  }

  return {
    reply: buildSmartFallbackReply(userMessage, products, Boolean(customerInfo.phone)),
    provider: 'fallback',
    model: 'catalog-assistant',
    switchedCount: triedErrors.length
  };
}

export function extractVietnamesePhone(text) {
  const cleaned = String(text || '').replace(/[\s.\-()]/g, '');
  const match = cleaned.match(/(?:\+?84|0)(?:3|5|7|8|9)\d{8}/);
  return match ? match[0] : '';
}
