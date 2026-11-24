// ============================================================
// STRICT VIETNAMESE REAL PHONE VALIDATOR (SHARED SERVER LOGIC)
// Chặn số ảo, sai đầu số nhà mạng, lặp số, dãy tiến/lùi linh tinh
// ============================================================

const VALID_VN_PREFIXES = new Set([
  // Viettel
  '032', '033', '034', '035', '036', '037', '038', '039', '086', '096', '097', '098',
  // MobiFone
  '070', '076', '077', '078', '079', '089', '090', '093',
  // VinaPhone
  '081', '082', '083', '084', '085', '088', '091', '094',
  // Vietnamobile
  '052', '056', '058', '092',
  // Gmobile / Itelecom / Reddi / Wintel / Local
  '055', '059', '087', '099'
]);

const JUNK_SEQUENCES = [
  '0123456', '1234567', '2345678', '3456789',
  '9876543', '8765432', '7654321', '6543210'
];

export function normalizeVnPhone(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+84')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('84') && digits.length === 11) digits = '0' + digits.slice(2);
  return digits.replace(/\D/g, '');
}

export function validateRealVnPhone(raw) {
  const phone = normalizeVnPhone(raw);
  if (phone.length !== 10) {
    return { valid: false, phone, error: 'Số điện thoại Việt Nam phải gồm đúng 10 chữ số (bắt đầu bằng 0).' };
  }
  const prefix = phone.slice(0, 3);
  if (!VALID_VN_PREFIXES.has(prefix)) {
    return { valid: false, phone, error: `Đầu số "${prefix}" không thuộc nhà mạng di động Việt Nam hợp lệ.` };
  }
  const tail = phone.slice(3); // 7 số đuôi
  // Chặn 6 chữ số giống nhau liên tiếp (VD: 0900000000, 0981111111)
  if (/(\d)\1{5,}/.test(phone)) {
    return { valid: false, phone, error: 'Số điện thoại không hợp lệ (lặp quá nhiều chữ số giống nhau).' };
  }
  // Chặn toàn bộ 7 số đuôi chỉ gồm <= 2 chữ số lặp lại kiểu 0912121212 hoặc 0901010101
  const uniqueTailDigits = new Set(tail.split(''));
  if (uniqueTailDigits.size <= 1) {
    return { valid: false, phone, error: 'Vui lòng nhập số điện thoại thật đang sử dụng.' };
  }
  if (/^(\d{2})\1{3}$/.test(phone.slice(2))) {
    return { valid: false, phone, error: 'Số điện thoại có dạng lặp cặp số ảo, vui lòng nhập SĐT thật.' };
  }
  // Chặn dãy tiến/lùi liên tiếp kiểu 0912345678, 0987654321
  for (const seq of JUNK_SEQUENCES) {
    if (phone.includes(seq)) {
      return { valid: false, phone, error: 'Số điện thoại dạng dãy số liên tiếp không hợp lệ, vui lòng nhập SĐT thật.' };
    }
  }
  return { valid: true, phone, error: '' };
}
