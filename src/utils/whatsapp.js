// Ubah nomor lokal (0812-xxx, +62 812 xxx) jadi tautan wa.me. Kembalikan '' bila nomor kosong/tidak valid.
export function waNumber(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits.length >= 9 ? digits : '';
}

export function waLink(phone, text = '') {
  const num = waNumber(phone);
  if (!num) return '';
  return `https://wa.me/${num}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
