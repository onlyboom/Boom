import crypto from 'crypto';
import { getServerDb } from './db.js';
import { getQuery, readJsonBody, sendJson } from './http.js';

const VAULT_BUCKET = 'zalotool-license-vault';

async function readVaultJson(db, fileName, fallback) {
  try {
    const { data, error } = await db.storage.from(VAULT_BUCKET).download(fileName);
    if (error || !data) return fallback;
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeVaultJson(db, fileName, obj) {
  const buf = Buffer.from(JSON.stringify(obj, null, 2), 'utf-8');
  const { error } = await db.storage.from(VAULT_BUCKET).upload(fileName, buf, {
    contentType: 'application/json',
    upsert: true
  });
  if (error) throw new Error(error.message || `Không ghi được ${fileName}`);
}

function compareSemver(a, b) {
  const pa = String(a || '0.0.0').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0.0.0').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function buildVietQrUrl(settings, amount, addInfo) {
  if (settings?.customQrUrl && String(settings.customQrUrl).trim()) {
    return String(settings.customQrUrl).trim();
  }
  const bin = String(settings?.bankBin || '').trim();
  const acc = String(settings?.bankAccount || '').trim();
  if (!bin || !acc) return '';
  const owner = encodeURIComponent(String(settings?.bankOwner || '').trim());
  const desc = encodeURIComponent(String(addInfo || '').trim());
  const amt = Math.max(0, Number(amount || 0));
  return `https://img.vietqr.io/image/${encodeURIComponent(bin)}-${encodeURIComponent(acc)}-compact2.png?amount=${amt}&addInfo=${desc}&accountName=${owner}`;
}

function generateLicenseKey() {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `LAGE-${seg()}-${seg()}-${seg()}`;
}

const SUPPORT_SYSTEM_INSTRUCTION = `Bạn là Trợ lý AI Hướng Dẫn Sử Dụng chính thức của phần mềm LAGE ZaloTool Pro.

QUY TẮC BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ):
1. PHẠM VI DUY NHẤT: Bạn CHỈ ĐƯỢC PHÉP trả lời các câu hỏi liên quan đến phần mềm LAGE ZaloTool Pro (hướng dẫn sử dụng, cài đặt, xử lý lỗi, tính năng, gia hạn gói, đổi máy, làm Web Shop riêng đồng bộ Tool, và các thông tin dịch vụ/liên hệ nằm trong "GHI CHÚ BỔ SUNG TỪ ADMIN").
2. TỪ CHỐI NGOÀI LỀ: Nếu khách hỏi bất kỳ chuyện nào KHÔNG liên quan đến phần mềm hay dịch vụ của LAGE ZaloTool Pro (ví dụ: viết văn, giải toán, lập trình, tin tức, thời tiết, nấu ăn, y tế, tâm sự, dịch thuật, v.v.), PHẢI TỪ CHỐI NGAY một cách lịch sự, ngắn gọn:
   "Mình là Trợ lý hướng dẫn sử dụng LAGE ZaloTool Pro nên chỉ hỗ trợ các câu hỏi về cách dùng phần mềm này thôi nhé! Bạn cần hướng dẫn bước nào trong Tool cứ hỏi mình nha 😊"
3. KHÔNG BAO GIỜ tiết lộ API key, mã nguồn, cấu trúc máy chủ hay cách vượt bản quyền.
4. PHONG CÁCH: Tiếng Việt tự nhiên, dễ hiểu cho người không rành công nghệ, chia bước ngắn gọn (1, 2, 3...), không dùng thuật ngữ lập trình phức tạp.

TOÀN BỘ HƯỚNG DẪN SỬ DỤNG LAGE ZALOTOOL PRO:
- BẢN QUYỀN & CẬP NHẬT:
  + Mở app nhập Mã Key do Admin cấp hoặc chọn tab "Đăng Ký / Gia Hạn Theo Tháng (Quét QR)", nhập Tên/Shop và SĐT/Zalo, chọn gói và quét QR chuyển khoản. Khi Admin duyệt, phần mềm tự động mở khóa sau 5 giây.
  + Mỗi Key gắn với 1 máy tính. Nếu muốn đổi sang máy mới, nhắn Admin bỏ tích gắn máy rồi đăng nhập trên máy mới.
  + Khi có bản cập nhật mới, góc trên sẽ hiện nút "🚀 Có bản cập nhật mới vX.Y.Z" — bấm vào để tải bản mới về chạy đè, dữ liệu cũ được giữ nguyên 100%.
- 5 NÚT CHÍNH GIỮA THANH TRÊN CÙNG:
  1. "📦 Đơn Web": Xem và xử lý đơn hàng khách đặt từ Web Shop (nếu có đồng bộ).
  2. "👥 Khách Web": Xem danh sách khách đã đăng ký tài khoản web.
  3. "🛍️ Web Cửa Hàng": Mở cửa hàng online của bạn. Lần đầu chưa có link sẽ mở khung để bạn dán link bán hàng (Shopee, TikTok, Facebook hoặc Web riêng) rồi bấm Lưu.
  4. "🛡️ Admin Web": Mở khung cài đặt Link Cửa Hàng và Link Trang Quản Lý Shop của bạn.
  5. "🤖 AI Sale & Auto": Mở khung cài đặt AI Sale 24/7 tự đọc hiểu & tư vấn chốt đơn:
     - Tích bật "⚡ Bật AI Sale tự đọc hiểu & tư vấn 24/7".
     - Dán 1 hoặc nhiều Gemini API Key của riêng bạn vào ô "Gemini API (Xoay nhiều Key)" (mỗi dòng 1 key để tự xoay vòng khi hết lượt).
     - Viết phong cách tư vấn, bảng giá, chính sách ship vào ô "Phong cách trả lời & Chính sách".
     - Có thể bấm "🧪 Test AI" để hỏi thử rồi bấm "💾 Lưu AI Sale".
     - Phía dưới có mục "📝 Kịch Bản Từ Khóa Cứng" để tự trả lời theo từ khóa khi tắt AI.
- QUY TRÌNH 3 BƯỚC CHẠY TỰ ĐỘNG (AN TOÀN CHỐNG BAY NICK):
  + BƯỚC 1 — Đăng Nhập Tài Khoản Zalo:
    * Bấm "➕ Quét QR thêm nick" rồi dùng điện thoại quét mã QR đăng nhập Zalo.
    * Hệ thống tự động phân tầng ngầm chống khóa nick: Nick mới/yếu tự vào Tầng 1 (Nuôi nick nhẹ để tăng độ tin cậy); khi đủ ngày & đủ khỏe tự động nâng lên Tầng 2 (Kéo vừa) -> Tầng 3 (Kéo siêu nhanh).
    * Nick Chính giữ Nhóm Đích luôn được bảo vệ 100%, không bị ép kéo quá tải.
    * Nếu thấy nick báo Offline/Mất kết nối, bấm nút "🔄 Quét QR nối lại phiên ngay" trên thẻ nick đó.
  + BƯỚC 2 — Chọn Nhóm Đích & Nguồn Khách:
    * Bấm "🎯 Chọn Nhóm Đích" để chọn các nhóm Zalo bạn muốn kéo khách vào (nhóm đạt ≥ 99 thành viên tự chuyển sang cột Đủ ≥99; nếu có thành viên rời nhóm làm hụt dưới 99, hệ thống tự trả về Nhóm Đích để nạp bù cho đủ).
    * Bấm "🔎 Dán Link / SĐT" để dán danh sách Link nhóm Zalo đối thủ hoặc SĐT khách hàng cần quét vào kho.
  + BƯỚC 3 — Chạy Tự Động 1 Chạm:
    * Bấm "▶️ BẮT ĐẦU CHẠY 1 CHẠM" ở Bước 3. Phần mềm tự chạy ngầm 100%: tự điều chỉnh tốc độ theo sức khỏe dàn nick, tự xoay nick, gửi kết bạn giãn cách, khách vừa đồng ý kết bạn sẽ tự động được mời vào Nhóm Đích.
    * Khuyên dùng nút "🩺 Kiểm Tra Sẵn Sàng" (5 hạng mục) trước khi bấm chạy để đảm bảo đã có nick Online, đã chọn Nhóm Đích và đã nạp nguồn khách.
    * Công tắc "⏰ Giờ Vàng" giúp tự nghỉ ban đêm (chỉ gửi kết bạn/DM từ 08:00–21:30 giờ VN, còn AI Sale vẫn trực trả lời khách 24/7).
- HỘP THƯ 2 TAB TRONG MỤC TIN NHẮN:
  + Tab 1 "1️⃣ TN Hàng Loạt All Group": Soạn nội dung/ảnh để gửi thông báo hàng loạt vào các nhóm đã chọn.
  + Tab 2 "2️⃣ Nhắn Tin Lạnh (DM)": Cài tin nhắn chào/nhắn tin tự động cho khách mới.
- LỖI THƯỜNG GẶP:
  + Lỗi 114 (Zalo hạn chế tạm thời do gửi nhanh): Hệ thống có cơ chế tự bảo vệ & tự hạ tốc độ/nghỉ dưỡng cho nick bị 114, không cần lo lắng, cứ để Tool tự xoay nick khác.
  + Không thấy khách được kéo: Kiểm tra lại 3 mục: (1) Có ít nhất 1 nick đang Online, (2) Đã chọn Nhóm Đích, (3) Đã dán Link nhóm/SĐT vào nguồn khách.`;

const FREE_DAILY_LIMIT_PER_KEY = 200;

function getVnDateStr() {
  const vn = new Date(Date.now() + 7 * 3600 * 1000);
  return vn.toISOString().slice(0, 10);
}

function keyFingerprint(apiKey) {
  return crypto.createHash('sha256').update(String(apiKey || '')).digest('hex').slice(0, 16);
}

async function callGeminiWithRotation(db, supportCfg, message, history) {
  const keys = Array.isArray(supportCfg?.geminiKeys) ? supportCfg.geminiKeys : [];
  const extraNotes = supportCfg?.extraNotes || '';
  const freeOnly = supportCfg?.freeOnly !== false; // Mặc định BẬT KHÓA FREE 100%
  const cleanKeys = keys.map((k) => String(k || '').trim()).filter((k) => k.length >= 15);
  if (!cleanKeys.length) {
    return {
      ok: false,
      error: 'Admin chưa cấu hình Gemini API Key miễn phí cho Trợ Lý Hướng Dẫn. Vui lòng liên hệ Admin!'
    };
  }

  const todayVn = getVnDateStr();
  const usageByKey = supportCfg?.usageByKey && typeof supportCfg.usageByKey === 'object' ? { ...supportCfg.usageByKey } : {};
  let usageDirty = false;

  // Chuẩn hóa bộ đếm theo ngày giờ VN
  for (const k of cleanKeys) {
    const fp = keyFingerprint(k);
    const rec = usageByKey[fp];
    if (!rec || rec.dateVn !== todayVn) {
      usageByKey[fp] = {
        dateVn: todayVn,
        usedToday: 0,
        limitPerDay: k.startsWith('AIza') ? FREE_DAILY_LIMIT_PER_KEY : 0,
        status: k.startsWith('AIza') ? 'ready' : 'blocked_paid',
        lastModel: '',
        lastUsedAt: null,
        lastError: ''
      };
      usageDirty = true;
    }
  }

  // Lọc chỉ lấy các Key được phép chạy (chế độ Free Only chỉ chạy Gemini AIza... còn hạn mức hôm nay!)
  const eligibleKeys = cleanKeys.filter((k) => {
    if (freeOnly && !k.startsWith('AIza')) return false;
    const fp = keyFingerprint(k);
    const rec = usageByKey[fp];
    if (k.startsWith('AIza') && Number(rec?.usedToday || 0) >= FREE_DAILY_LIMIT_PER_KEY) return false;
    return true;
  });

  if (!eligibleKeys.length) {
    if (usageDirty) {
      await writeVaultJson(db, 'support_ai.json', { ...supportCfg, usageByKey }).catch(() => {});
    }
    const hasOnlyOpenAi = cleanKeys.every((k) => k.startsWith('sk-'));
    return {
      ok: false,
      error: hasOnlyOpenAi && freeOnly
        ? '🛡️ Đang bật khóa CHỈ DÙNG FREE (0đ): Key OpenAI (sk-...) là API trả phí nên đã bị khóa. Admin vui lòng dán Key Gemini miễn phí (AIza...)!'
        : '🛡️ Toàn bộ Key Gemini miễn phí hôm nay đã chạm hạn mức Free — hệ thống tự dừng để không phát sinh chi phí. Vui lòng thử lại ngày mai hoặc báo Admin thêm Key Gemini!'
    };
  }

  const startIdx = Math.floor(Math.random() * eligibleKeys.length);
  const rotatedKeys = eligibleKeys.slice(startIdx).concat(eligibleKeys.slice(0, startIdx));
  // Ưu tiên model Gemini Free Tier nhẹ & hạn mức cao nhất trước
  const models = ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];
  const sysText = extraNotes
    ? `${SUPPORT_SYSTEM_INSTRUCTION}\n\nGHI CHÚ BỔ SUNG TỪ ADMIN:\n${String(extraNotes).trim()}`
    : SUPPORT_SYSTEM_INSTRUCTION;

  const contents = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-8)) {
      const role = h?.role === 'model' ? 'model' : 'user';
      const txt = String(h?.text || '').trim().slice(0, 1200);
      if (txt) contents.push({ role, parts: [{ text: txt }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: String(message || '').trim().slice(0, 1500) }] });

  let lastErr = 'Không thể kết nối AI lúc này.';
  for (const apiKey of rotatedKeys) {
    const fp = keyFingerprint(apiKey);
    const rec = usageByKey[fp];

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sysText }] },
            contents,
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 700
            }
          })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) {
          const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('').trim();
          if (reply) {
            rec.usedToday = Number(rec.usedToday || 0) + 1;
            rec.limitPerDay = FREE_DAILY_LIMIT_PER_KEY;
            rec.status = rec.usedToday >= FREE_DAILY_LIMIT_PER_KEY ? 'quota_full' : 'ready';
            rec.lastModel = model;
            rec.lastUsedAt = new Date().toISOString();
            rec.lastError = '';
            await writeVaultJson(db, 'support_ai.json', { ...supportCfg, usageByKey }).catch(() => {});
            return { ok: true, reply };
          }
        }
        lastErr = data?.error?.message || `HTTP ${resp.status}`;
        if (resp.status === 429) {
          rec.status = 'quota_full';
          rec.lastError = 'Chạm giới hạn Free Google (429)';
          usageDirty = true;
          break;
        }
        if (resp.status === 400 || resp.status === 403) {
          rec.status = 'invalid';
          rec.lastError = lastErr.slice(0, 120);
          usageDirty = true;
          break;
        }
      } catch (e) {
        lastErr = e?.message || String(e);
      }
    }
  }
  if (usageDirty) {
    await writeVaultJson(db, 'support_ai.json', { ...supportCfg, usageByKey }).catch(() => {});
  }
  return { ok: false, error: `Trợ lý AI tạm bận (${lastErr}). Vui lòng thử lại sau vài giây!` };
}

export async function handleLicenseRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const { db, hasServiceRole } = getServerDb();
  if (!hasServiceRole) {
    return sendJson(res, 500, { ok: false, error: 'Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY' });
  }

  const q = getQuery(req);
  const action = String(q.action || '').trim().toLowerCase();

  try {
    // 1. Lấy danh sách gói tháng + thông tin thanh toán QR + phiên bản mới nhất
    if (req.method === 'GET' && action === 'plans') {
      const [settings, releases] = await Promise.all([
        readVaultJson(db, 'settings.json', { plans: [] }),
        readVaultJson(db, 'releases.json', { latestVersion: '2.3.0', downloadUrl: '', releaseNotes: '' })
      ]);
      const plans = (Array.isArray(settings?.plans) ? settings.plans : [])
        .filter((p) => p && p.enabled !== false)
        .map((p) => ({
          ...p,
          id: p.code || p.id,
          code: p.code || p.id,
          name: p.label || p.name,
          label: p.label || p.name
        }));
      return sendJson(res, 200, {
        ok: true,
        plans,
        bank: {
          bankId: settings?.bankName || '',
          bankName: settings?.bankName || '',
          accountNo: settings?.bankAccount || '',
          bankAccount: settings?.bankAccount || '',
          accountName: settings?.bankOwner || '',
          bankOwner: settings?.bankOwner || '',
          contactZalo: settings?.contactZalo || '',
          hasQrReady: Boolean((settings?.bankBin && settings?.bankAccount) || settings?.customQrUrl)
        },
        release: releases
      });
    }

    // 2. Xác thực License Key + gắn cứng HWID + kiểm tra bản cập nhật mới
    if (req.method === 'POST' && action === 'verify') {
      const body = await readJsonBody(req);
      const rawKey = String(body.licenseKey || '').trim().toUpperCase();
      const hwid = String(body.hwid || '').trim();
      const pcName = String(body.pcName || '').trim().slice(0, 80);
      const appVersion = String(body.appVersion || '2.3.0').trim();

      const [licData, releases] = await Promise.all([
        readVaultJson(db, 'licenses.json', { licenses: [] }),
        readVaultJson(db, 'releases.json', { latestVersion: '2.3.0', downloadUrl: '', releaseNotes: '' })
      ]);

      const latestVersion = String(releases?.latestVersion || appVersion);
      const updateAvailable = Boolean(releases?.downloadUrl) && compareSemver(latestVersion, appVersion) > 0;

      if (!rawKey) {
        return sendJson(res, 200, {
          ok: true,
          valid: false,
          code: 'NO_KEY',
          message: 'Vui lòng nhập Mã Bản Quyền (License Key) hoặc quét QR đăng ký gói tháng.',
          latestVersion,
          updateAvailable,
          downloadUrl: releases?.downloadUrl || '',
          releaseNotes: releases?.releaseNotes || ''
        });
      }

      const list = Array.isArray(licData?.licenses) ? licData.licenses : [];
      const lic = list.find((item) => String(item?.licenseKey || '').trim().toUpperCase() === rawKey);
      if (!lic) {
        return sendJson(res, 200, {
          ok: true,
          valid: false,
          code: 'INVALID_KEY',
          message: 'Mã Bản Quyền không tồn tại. Vui lòng kiểm tra lại hoặc mua Key mới!'
        });
      }

      if (lic.status === 'locked') {
        return sendJson(res, 200, {
          ok: true,
          valid: false,
          code: 'LOCKED',
          message: '🔒 Mã Bản Quyền này đã bị Admin tạm khóa. Vui lòng liên hệ hỗ trợ!'
        });
      }

      const now = Date.now();
      let dirty = false;

      // Gắn cứng mã máy (HWID) ở lần kích hoạt đầu tiên (hoặc sau khi Admin bỏ tích cho phép đổi máy)
      // LƯU Ý DOANH THU: KHÔNG BAO GIỜ cộng thêm hay reset expiresAt khi đổi máy!
      if (!lic.hwid && hwid) {
        lic.hwid = hwid;
        lic.pcName = pcName || lic.pcName || '';
        if (!lic.activatedAt) {
          lic.activatedAt = new Date(now).toISOString();
        }
        if (!lic.expiresAt && Number(lic.durationDays || 0) > 0 && Number(lic.durationDays) < 9000) {
          lic.expiresAt = new Date(now + Number(lic.durationDays) * 86400000).toISOString();
        }
        dirty = true;

        // Nếu là Key dùng thử -> ghi vĩnh viễn HWID này vào trial_history.json để chống dùng lại sau khi hết 3 ngày
        if (lic.planCode === 'trial_3d' || (Number(lic.durationDays || 0) <= 7 && Number(lic.priceVnd || 0) === 0)) {
          const hist = await readVaultJson(db, 'trial_history.json', { records: [] });
          const recs = Array.isArray(hist?.records) ? hist.records : [];
          if (!recs.some((r) => r.hwid === hwid)) {
            recs.unshift({
              hwid,
              pcName: pcName || lic.pcName || '',
              customerName: lic.customerName || '',
              customerPhone: lic.customerPhone || '',
              licenseKey: lic.licenseKey,
              planLabel: lic.planLabel || 'Dùng Thử 3 Ngày',
              usedAt: new Date(now).toISOString(),
              expiresAt: lic.expiresAt || null
            });
            await writeVaultJson(db, 'trial_history.json', { records: recs.slice(0, 2000) });
          }
        }
      } else if (lic.hwid && hwid && lic.hwid !== hwid) {
        return sendJson(res, 200, {
          ok: true,
          valid: false,
          code: 'WRONG_MACHINE',
          message: '⚠️ Mã Key này đã kích hoạt trên một máy tính khác! Liên hệ Admin nếu bạn cần chuyển máy.'
        });
      }

      if (lic.expiresAt && new Date(lic.expiresAt).getTime() < now) {
        return sendJson(res, 200, {
          ok: true,
          valid: false,
          code: 'EXPIRED',
          message: '⏰ Mã Bản Quyền đã hết hạn sử dụng. Vui lòng gia hạn gói tháng mới!'
        });
      }

      lic.lastSeenAt = new Date(now).toISOString();
      if (pcName) lic.pcName = pcName;
      lic.lastAppVersion = appVersion;
      dirty = true;

      if (dirty) {
        await writeVaultJson(db, 'licenses.json', { licenses: list });
      }

      const daysLeft = lic.expiresAt
        ? Math.max(0, Math.ceil((new Date(lic.expiresAt).getTime() - now) / 86400000))
        : 9999;

      return sendJson(res, 200, {
        ok: true,
        valid: true,
        code: 'ACTIVE',
        license: {
          licenseKey: lic.licenseKey,
          customerName: lic.customerName || '',
          planName: lic.planLabel || 'Bản Quyền',
          planLabel: lic.planLabel || 'Bản Quyền',
          expiresAt: lic.expiresAt || null,
          daysLeft
        },
        latestVersion,
        updateAvailable,
        downloadUrl: releases?.downloadUrl || '',
        releaseNotes: releases?.releaseNotes || ''
      });
    }

    // 3. Tạo đơn thanh toán QR theo gói tháng cho khách ngay trong .exe
    if (req.method === 'POST' && action === 'create-payment') {
      const body = await readJsonBody(req);
      const planCode = String(body.planCode || body.planId || '').trim();
      const customerName = String(body.customerName || '').trim().slice(0, 80);
      const customerPhone = String(body.customerPhone || '').trim().slice(0, 30);
      const phoneDigits = customerPhone.replace(/\D/g, '');
      if (customerName.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập đầy đủ Tên / Shop của bạn!' });
      }
      if (phoneDigits.length < 9 || phoneDigits.length > 11) {
        return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập đúng SĐT / Zalo liên hệ (9–11 chữ số)!' });
      }
      const hwid = String(body.hwid || '').trim();
      const pcName = String(body.pcName || '').trim().slice(0, 80);

      const settings = await readVaultJson(db, 'settings.json', { plans: [] });
      const plan = (Array.isArray(settings?.plans) ? settings.plans : []).find(
        (p) => p.code === planCode || p.id === planCode
      );
      if (!plan) {
        return sendJson(res, 400, { ok: false, error: 'Gói bản quyền không hợp lệ!' });
      }

      if (Number(plan.price || 0) <= 0) {
        const [licData, trialHist] = await Promise.all([
          readVaultJson(db, 'licenses.json', { licenses: [] }),
          readVaultJson(db, 'trial_history.json', { records: [] })
        ]);
        const list = Array.isArray(licData?.licenses) ? licData.licenses : [];
        const recs = Array.isArray(trialHist?.records) ? trialHist.records : [];
        const cleanPhone = customerPhone.replace(/\D/g, '');

        // Kiểm tra vĩnh viễn trong lịch sử dùng thử (chống tải lại .exe / xóa Key để xin thêm ngày miễn phí!)
        const usedBefore = recs.find(
          (r) =>
            (hwid && r.hwid === hwid) ||
            (cleanPhone.length >= 9 && String(r.customerPhone || '').replace(/\D/g, '') === cleanPhone)
        );
        const existingTrial = hwid && list.find((x) => x.hwid === hwid && x.planCode === plan.code);
        if (usedBefore || existingTrial) {
          const expIso = usedBefore?.expiresAt || existingTrial?.expiresAt || null;
          const stillValid = existingTrial && existingTrial.status !== 'locked' && expIso && new Date(expIso).getTime() > Date.now();
          if (stillValid) {
            return sendJson(res, 200, {
              ok: true,
              autoIssued: true,
              licenseKey: existingTrial.licenseKey,
              message: 'Máy tính này đang có Key Dùng Thử còn hạn — đã tự điền lại Key cũ cho bạn!'
            });
          }
          return sendJson(res, 403, {
            ok: false,
            error: '⛔ Máy tính hoặc SĐT này đã sử dụng hết lượt Dùng Thử 3 Ngày trước đó! Không thể nhận thêm ngày miễn phí — vui lòng chọn gói trả phí để tiếp tục.'
          });
        }

        const now = Date.now();
        const newKey = generateLicenseKey();
        const days = Math.max(1, Number(plan.days || 3));
        const expiresAtIso = new Date(now + days * 86400000).toISOString();
        list.unshift({
          id: `lic_${now}`,
          licenseKey: newKey,
          customerName: customerName || 'Khách Dùng Thử',
          customerPhone,
          planCode: plan.code,
          planLabel: plan.label,
          priceVnd: 0,
          durationDays: days,
          status: 'active',
          hwid,
          pcName,
          activatedAt: new Date(now).toISOString(),
          expiresAt: expiresAtIso,
          lastSeenAt: new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
          note: 'Tự động cấp gói dùng thử'
        });
        recs.unshift({
          hwid,
          pcName,
          customerName: customerName || 'Khách Dùng Thử',
          customerPhone,
          licenseKey: newKey,
          planLabel: plan.label,
          usedAt: new Date(now).toISOString(),
          expiresAt: expiresAtIso
        });
        await Promise.all([
          writeVaultJson(db, 'licenses.json', { licenses: list }),
          writeVaultJson(db, 'trial_history.json', { records: recs.slice(0, 2000) })
        ]);
        return sendJson(res, 200, {
          ok: true,
          autoIssued: true,
          licenseKey: newKey,
          message: `✅ Đã cấp ngay Key ${plan.label}: ${newKey}`
        });
      }

      const orderCode = `KEY${Math.floor(100000 + Math.random() * 899999)}`;
      const qrUrl = buildVietQrUrl(settings, plan.price, orderCode);
      const ordersData = await readVaultJson(db, 'orders.json', { orders: [] });
      const orders = Array.isArray(ordersData?.orders) ? ordersData.orders : [];
      orders.unshift({
        orderCode,
        planCode: plan.code,
        planLabel: plan.label,
        durationDays: Number(plan.days || 30),
        amountVnd: Number(plan.price || 0),
        customerName: customerName || 'Khách mua Key',
        customerPhone,
        hwid,
        pcName,
        status: 'pending',
        issuedLicenseKey: '',
        createdAt: new Date().toISOString(),
        paidAt: null
      });
      await writeVaultJson(db, 'orders.json', { orders: orders.slice(0, 500) });

      return sendJson(res, 200, {
        ok: true,
        autoIssued: false,
        orderCode,
        transferContent: orderCode,
        planName: plan.label,
        planLabel: plan.label,
        days: Number(plan.days || 30),
        amount: Number(plan.price || 0),
        amountVnd: Number(plan.price || 0),
        qrImageUrl: qrUrl,
        qrUrl,
        bank: {
          bankId: settings?.bankName || '',
          accountNo: settings?.bankAccount || '',
          accountName: settings?.bankOwner || ''
        },
        bankName: settings?.bankName || '',
        bankAccount: settings?.bankAccount || '',
        bankOwner: settings?.bankOwner || '',
        supportZalo: settings?.contactZalo || '',
        contactZalo: settings?.contactZalo || ''
      });
    }

    // 4. Máy khách tự kiểm tra đơn thanh toán QR mỗi 5 giây -> có Key là tự mở khóa luôn!
    if (req.method === 'GET' && action === 'check-payment') {
      const orderCode = String(q.orderCode || '').trim().toUpperCase();
      if (!orderCode) return sendJson(res, 400, { ok: false, error: 'Thiếu orderCode' });
      const ordersData = await readVaultJson(db, 'orders.json', { orders: [] });
      const order = (Array.isArray(ordersData?.orders) ? ordersData.orders : []).find(
        (o) => String(o?.orderCode || '').toUpperCase() === orderCode
      );
      if (!order) return sendJson(res, 404, { ok: false, error: 'Không tìm thấy đơn thanh toán' });
      return sendJson(res, 200, {
        ok: true,
        orderCode: order.orderCode,
        status: order.status,
        issuedLicenseKey: order.status === 'paid' ? order.issuedLicenseKey || '' : ''
      });
    }

    // 5. Trợ lý AI Hướng Dẫn Sử Dụng App (xoay vòng Gemini API Key của Admin lưu kín trong Vault)
    if (req.method === 'POST' && action === 'support-chat') {
      const body = await readJsonBody(req);
      const message = String(body.message || '').trim();
      if (!message) return sendJson(res, 400, { ok: false, error: 'Vui lòng nhập câu hỏi cần hướng dẫn.' });
      const supportCfg = await readVaultJson(db, 'support_ai.json', { geminiKeys: [], extraNotes: '', freeOnly: true, usageByKey: {} });
      const resAi = await callGeminiWithRotation(db, supportCfg, message, body.history || []);
      if (!resAi.ok) return sendJson(res, 200, { ok: false, error: resAi.error });
      return sendJson(res, 200, { ok: true, reply: resAi.reply });
    }

    return sendJson(res, 400, { ok: false, error: 'Action không hợp lệ' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
