// Alamat tujuan IKAPI Pusat untuk surat pengantar & pengiriman berkas fisik.
// Diambil dari pengaturan "surat_tujuan" (Pengaturan Sistem), dipecah per baris.
const DEFAULT_CENTRAL_ADDRESS =
  'Pengurus Pusat IKAPI\nc.q. Bidang Keanggotaan & Organisasi\nJl. Kalipasir No. 32, Cikini, Menteng\nJakarta Pusat 10330';

export const centralAddressLines = (settings) =>
  String(settings?.surat_tujuan || DEFAULT_CENTRAL_ADDRESS)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
