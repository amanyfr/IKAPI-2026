// Catatan dokumen yang sudah dibuka per pengguna & pengajuan (disimpan di browser).
// Dipakai bersama modal verifikasi dan modal pembubuhan TTD agar progres "lihat dokumen"
// tidak hilang saat modal ditutup/dibatalkan dan tidak perlu membuka ulang dari awal.
// Kunci: `doc-<id>` (berkas persyaratan), `payment` (bukti transfer), `letter-<key>` (dokumen surat).

const storeKey = (submissionId) => {
  let userId = 'anon';
  try { userId = JSON.parse(localStorage.getItem('ikapi_user') || '{}')?.id ?? 'anon'; } catch { /* abaikan */ }
  return `ikapi_viewed:${userId}:${submissionId}`;
};

export function loadViewed(submissionId) {
  if (!submissionId) return new Set();
  try {
    const list = JSON.parse(localStorage.getItem(storeKey(submissionId)) || '[]');
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function addViewed(submissionId, ...keys) {
  if (!submissionId) return;
  try {
    const set = loadViewed(submissionId);
    keys.forEach((k) => set.add(k));
    localStorage.setItem(storeKey(submissionId), JSON.stringify([...set]));
  } catch { /* penyimpanan browser tidak tersedia: progres hanya berlaku di sesi ini */ }
}

// Kunci menyertakan path berkas: bila pemohon mengunggah ulang (revisi), berkas baru wajib dibuka lagi
export const docViewKey = (doc) => `doc-${doc.id}:${doc.file_path || ''}`;
export const paymentViewKey = (proofFile) => `payment:${proofFile || ''}`;
