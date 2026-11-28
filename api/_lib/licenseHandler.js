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

    return sendJson(res, 400, { ok: false, error: 'Action không hợp lệ' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
