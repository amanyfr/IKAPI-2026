// Penyaring karakter untuk input yang tidak boleh berisi huruf.
// Dipakai di onChange sehingga ketikan maupun tempelan (paste) langsung dibersihkan.

const keepOneDot = (s) => {
  const i = s.indexOf('.');
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
};

export const FILTERS = {
  // Hanya angka 0-9: no. resi, no. rekening, NIB, kode pos, tahun, jumlah, biaya
  digits: (v) => String(v ?? '').replace(/\D/g, ''),
  // Nomor telepon/WA/fax: angka plus + - spasi ( ) /
  phone: (v) => String(v ?? '').replace(/[^\d+\-\s()/]/g, ''),
  // Angka desimal (persen): angka dan satu titik; koma diubah jadi titik
  decimal: (v) => keepOneDot(String(v ?? '').replace(/,/g, '.').replace(/[^\d.]/g, '')),
  // NPWP: angka dengan pemisah titik / strip, mis. 01.234.567.8-901.000
  npwp: (v) => String(v ?? '').replace(/[^\d.\-]/g, ''),
  // ISBN: angka dan strip; huruf X hanya sebagai digit kontrol ISBN-10
  isbn: (v) => String(v ?? '').toUpperCase().replace(/[^\dX-]/g, ''),
};

// Atribut tambahan agar keyboard HP menampilkan papan angka
export const NUMERIC = { inputMode: 'numeric', autoComplete: 'off' };
export const DECIMAL = { inputMode: 'decimal', autoComplete: 'off' };
export const PHONE = { inputMode: 'tel' };
