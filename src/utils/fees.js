// Biaya keanggotaan dari pengaturan Admin (sama dengan computeFees di server)
export function feesFromSettings(settings = {}, submissionType = 'Baru') {
  const fee = (key, fallback) => {
    const n = Number(settings[key]);
    return Number.isFinite(n) && n >= 0 && settings[key] !== '' && settings[key] != null ? n : fallback;
  };
  const durasiBulan = fee('fee_iuran_durasi_bulan', 24);

  if (submissionType === 'Baru') {
    const uangPangkal = fee('fee_uang_pangkal', 250000);
    const iuran = fee('fee_iuran_bulanan', 50000) * durasiBulan;
    const administrasi = fee('fee_administrasi', 250000);
    return { uangPangkal, iuran24Bulan: iuran, administrasi, durasiBulan, total: uangPangkal + iuran + administrasi };
  }
  const iuran = fee('fee_heregistrasi_iuran', 1200000);
  return { uangPangkal: 0, iuran24Bulan: iuran, administrasi: 0, durasiBulan, total: iuran };
}

export const formatRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
