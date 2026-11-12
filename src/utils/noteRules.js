// Aturan catatan revisi / alasan penolakan: harus bermakna (bukan "-" atau "." saja)
// agar pemohon tahu apa yang perlu diperbaiki. Sama persis dengan pengecekan di server.
export const NOTE_MIN_LENGTH = 5;

export const isMeaningfulNote = (text) => {
  const t = String(text || '').trim();
  return t.length >= NOTE_MIN_LENGTH && /\p{L}/u.test(t);
};

export const NOTE_HINT = `Tulis alasan yang jelas (minimal ${NOTE_MIN_LENGTH} karakter dan mengandung huruf).`;
