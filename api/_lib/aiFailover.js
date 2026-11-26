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

  const geminiModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite'
  ];
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
    .map(([k, v]) => `- ${k}: ${v} mẫu đang sẵn hàng`)
    .join('\n');

  const sampleCatalog = inStock
    .slice(0, 60)
    .map((p) => {
      const priceTxt = p.giaLe > 0 ? `, giá lẻ ${p.giaLe.toLocaleString('vi-VN')}đ` : '';
      return `[${p.code}] ${p.name} (${p.category}${priceTxt}, còn ${p.soLuong} sp)`;
    })
    .join('\n');

  return [
    'Bạn là nhân viên tư vấn bán hàng thân thiện, thông minh và nói chuyện tự nhiên như người thật của AG STORE — chuyên mô hình lắp ghép Blokees, Transformers, đồ chơi lắp ráp & hàng tổng hợp.',
    '',
    'THÔNG TIN & CHÍNH SÁCH SHOP AG STORE:',
    '- Hình thức bán: Bán CẢ LẺ (từ 1 hộp để chơi/sưu tầm) lẫn SỈ & CTV (trộn mẫu linh hoạt hoặc lấy nguyên thùng chiết khấu sâu).',
    '- Cách báo giá & tư vấn:',
    '  + Trả lời tự nhiên, linh hoạt theo đúng câu hỏi của khách (có thể trao đổi thoải mái về tầm giá, cách chọn mẫu, tồn kho thực tế, gợi ý mẫu bán chạy hoặc mẫu hợp nhu cầu).',
    '  + KHÔNG bịa con số giá cố định cho từng mã nếu trong dữ liệu kho không ghi giá niêm yết; thay vào đó hãy hỏi xem anh/chị định lấy lẻ hay nhập sỉ khoảng bao nhiêu hộp để báo mức giá tốt nhất.',
    '  + Khi khách cần tư vấn siêu chi tiết, muốn xem bảng giá sỉ từng mã, muốn xem thêm ảnh/video thực tế hoặc chuẩn bị chốt đơn: khéo léo xin SĐT Zalo ngay tại khung chat để nhân viên kết bạn Zalo tư vấn 1-1 và gửi báo giá chi tiết nhất.',
    '- Giao hàng: Đóng gói chống móp hộp cẩn thận, giao nhanh toàn quốc, hỗ trợ kiểm tra hàng. KHÔNG tự ý nhắc hay đoán địa chỉ kho.',
    '- Điều hướng: Luôn ưu tiên dẫn khách để lại SĐT Zalo để trao đổi & chốt đơn nhanh qua Zalo (hoặc gợi ý khách bấm thêm mẫu vào giỏ "Tổng Bill" ngay trên web).',
    '',
    'PHONG CÁCH GIAO TIẾP:',
    '- Luôn xưng "em" và gọi khách là "anh/chị", giọng thân thiện, ấm áp, gần gũi như người thật đang chat Zalo.',
    '- Trả lời tự nhiên, không cứng nhắc, không lặp đi lặp lại cùng 1 câu mở đầu máy móc; giữ độ dài gọn gàng 2–4 câu dễ đọc trên điện thoại.',
    '- Chủ động đặt câu hỏi mở ngắn gọn để hiểu nhu cầu khách (ví dụ: anh/chị đang tìm mua lẻ sưu tầm hay nhập sỉ về bán, thích dòng Blokees hay lắp ghép tổng hợp?).',
    customerInfo.customerName && customerInfo.customerName !== 'Khách Web'
      ? `- Tên khách: ${customerInfo.customerName}`
      : '',
    customerInfo.phone
      ? `- SĐT Zalo khách đã để lại: ${customerInfo.phone} (KHÔNG xin lại SĐT nữa, hãy xác nhận đã ghi nhận và tiếp tục tư vấn nhiệt tình).`
      : '',
    '',
    `DANH MỤC KHO THỰC TẾ HIỆN TẠI (${inStock.length} mẫu đang sẵn hàng):`,
    catSummary || '- Hàng nhập (Blokees) & Hàng tổng hợp đang sẵn hàng',
    'CÁC MÃ TIÊU BIỂU:',
    sampleCatalog || '- Đang cập nhật danh mục'
  ]
    .filter(Boolean)
    .join('\n');
}

function buildSmartFallbackReply(userMessage, products = [], hasPhone = false) {
  const q = String(userMessage || '').toLowerCase();
  const inStock = products.filter((p) => p.isVisible !== false && !p.isOutOfStock && p.soLuong > 0);
  const matched = inStock
    .filter((p) =>
      q
        .split(/\s+/)
        .some((w) => w.length >= 3 && `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(w))
    )
    .slice(0, 3);

  if (matched.length > 0) {
    const listTxt = matched.map((m) => `• [${m.code}] ${m.name} (sẵn ${m.soLuong} sp)`).join('\n');
    return hasPhone
      ? `Dạ bên em đang có sẵn mấy mẫu này cho anh/chị ạ:\n${listTxt}\nEm đã lưu SĐT của anh/chị rồi, lát nhân viên bên em nhắn Zalo gửi giá chi tiết & ảnh thật cho mình liền nha!`
      : `Dạ bên em đang có sẵn mấy mẫu khớp với anh/chị tìm nè:\n${listTxt}\nAnh/chị đang định lấy lẻ hay nhập sỉ ạ? Nếu cần báo giá chi tiết từng mã, anh/chị để lại SĐT Zalo để em nhắn qua Zalo tư vấn kỹ cho mình nhé!`;
  }

  return hasPhone
    ? `Dạ em đã ghi nhận tin nhắn và SĐT Zalo của anh/chị rồi ạ! Anh/chị cần tìm dòng Blokees hay đồ chơi lắp ghép nào cứ nhắn thêm, nhân viên bên em sẽ nhắn Zalo tư vấn siêu chi tiết ngay cho mình nhé!`
    : `Dạ chào anh/chị! Bên em có sẵn ${inStock.length || 130} mẫu Blokees & đồ chơi lắp ghép, bán cả lẻ lẫn sỉ/CTV trộn mẫu thoải mái ạ. Anh/chị đang quan tâm dòng nào, hoặc để lại SĐT Zalo để em kết bạn gửi bảng giá & tư vấn chi tiết cho mình nhé!`;
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
