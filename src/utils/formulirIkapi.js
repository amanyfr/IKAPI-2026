// Pilihan isian sesuai Formulir Heregistrasi / Menjadi Anggota IKAPI 2026

export const PEMASARAN_DISTRIBUTOR = 'Lewat distributor';
export const PEMASARAN_SENDIRI = ['Toko Buku', 'Direct Selling', 'Proyek', 'Internet (mail order)'];
export const PENJUALAN_OPTIONS = ['Kredit', 'Tunai', 'Konsinyasi'];
export const NASKAH_OPTIONS = ['Beli Naskah', 'Ditulis sendiri', 'Royalti'];
export const KEPEMILIKAN_KANTOR_OPTIONS = ['Sewa', 'Milik Sendiri'];
export const LOKASI_KANTOR_OPTIONS = ['Perumahan', 'Pemerintah', 'Kompleks Perkantoran / Usaha'];
export const CETAK_OPTIONS = ['Percetakan sendiri', 'Percetakan luar'];

export const DEFAULT_KARYAWAN = [
  { bagian: 'Redaksi', jumlah: '' },
  { bagian: 'Produksi', jumlah: '' },
  { bagian: 'Pemasaran', jumlah: '' },
  { bagian: 'Administrasi', jumlah: '' },
];

// Data lama menyimpan pilihan sebagai teks; data baru sebagai daftar
export const asList = (value) =>
  Array.isArray(value) ? value : value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : [];

export const listText = (value) => asList(value).join(', ');

// Rincian karyawan per bagian (fallback ke kolom lama per bagian)
export function karyawanRows(formData = {}) {
  if (Array.isArray(formData.karyawan)) {
    return formData.karyawan.filter((k) => k.bagian?.trim() || Number(k.jumlah) > 0);
  }
  return [
    ['Redaksi', formData.jumlahKaryawanRedaksi],
    ['Produksi', formData.jumlahKaryawanProduksi],
    ['Pemasaran', formData.jumlahKaryawanPemasaran],
    ['Administrasi', formData.jumlahKaryawanAdmin],
  ].filter(([, n]) => Number(n) > 0).map(([bagian, jumlah]) => ({ bagian, jumlah }));
}

export const totalKaryawan = (formData) =>
  karyawanRows(formData).reduce((sum, k) => sum + (Number(k.jumlah) || 0), 0);

export function karyawanText(formData) {
  const rows = karyawanRows(formData);
  if (!rows.length) return '-';
  return `${totalKaryawan(formData)} orang (${rows.map((k) => `${k.bagian || 'Lainnya'}: ${k.jumlah || 0}`).join(', ')})`;
}

export function pemasaranText(formData = {}) {
  const list = asList(formData.sistemPemasaran);
  const sendiri = list.filter((v) => PEMASARAN_SENDIRI.includes(v));
  const lain = list.filter((v) => v !== PEMASARAN_DISTRIBUTOR && !PEMASARAN_SENDIRI.includes(v));
  const parts = [];
  if (list.includes(PEMASARAN_DISTRIBUTOR)) parts.push('Lewat distributor');
  if (sendiri.length) parts.push(`Melalui penjualan sendiri (${sendiri.join(', ')})`);
  return [...parts, ...lain].join('; ') || '-';
}

export function naskahText(formData = {}) {
  const list = asList(formData.sistemPengadaanNaskah);
  if (!list.length) return '-';
  return list
    .map((v) => (v === 'Royalti' && formData.persentaseRoyalti ? `Royalti = ${String(formData.persentaseRoyalti).replace('%', '')}%` : v))
    .join(', ');
}

const pairText = (a, b) => [a, b].map((v) => (v || '').trim()).filter(Boolean).map((v, i) => `${i + 1}. ${v}`).join('  ') || '-';

const withUnit = (value, unit) => (value ? `${value} ${unit}` : '-');

// Isian Formulir Heregistrasi Anggota IKAPI — urut & berlabel sama dengan formulir resmi
export function heregistrasiRows(submission = {}, formData = {}) {
  const alamat = [submission.address || formData.address, submission.city || formData.city, submission.postal_code || formData.postalCode]
    .filter((v) => v && v !== '-').join(', ');
  return [
    ['Nama Penerbit', submission.publisher_name || formData.publisherName],
    ['Nama Pimpinan', submission.leader_name || formData.leaderName],
    ['Alamat', alamat],
    ['Telepon', submission.publisher_phone || formData.phone],
    ['Faksimili', submission.fax || formData.fax],
    ['Email', submission.publisher_email || formData.email],
    ['Website', submission.website || formData.website],
    ['Penanggungjawab Penerbitan', submission.person_in_charge || formData.personInCharge],
    ['No. Anggota Ikapi', submission.old_kta_number || formData.oldKtaNumber],
    ['Jumlah judul yang telah diterbitkan', withUnit(formData.jumlahJudulTerbit, 'judul')],
    ['Rata-rata oplag cetakan pertama', withUnit(formData.rataRataOplah, 'eks')],
    ['Sistem Pemasaran', pemasaranText(formData)],
    ['Rata-rata diskon yang lepas', formData.rataRataDiskon ? `${String(formData.rataRataDiskon).replace('%', '')}%` : '-'],
    ['Sistem Penjualan', listText(formData.sistemPenjualan) || '-'],
    ['Rencana Produksi/Penerbitan', withUnit(formData.annualBookCount, 'judul/tahun')],
    ['Sistem Pengadaan Naskah', naskahText(formData)],
    ['Jumlah Karyawan', karyawanText(formData)],
    ['Kepemilikan Kantor', formData.kepemilikanKantor],
    ['Lokasi', formData.lokasiKantor],
    ['Kantor cabang/perwakilan', pairText(formData.kantorCabang1 ?? formData.kantorCabang, formData.kantorCabang2)],
    ['Lini penerbitan', pairText(formData.liniPenerbitan1 ?? formData.liniPenerbitan, formData.liniPenerbitan2)],
    ['Program komputer (software) yang digunakan', formData.softwareProduksi],
    ['Nomor ISBN yang sudah digunakan', formData.contohIsbn],
    ['Jenis kertas yang digunakan', formData.jenisKertas],
    ['Mencetak buku', formData.sistemCetak],
    ['Pekerjaan yang dioutsourcing', formData.pekerjaanOutsource],
  ].map(([label, value]) => [label, value && value !== '-' ? value : '-']);
}
