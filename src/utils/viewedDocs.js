// Catatan dokumen yang sudah dibuka per pengguna & pengajuan (disimpan di browser).
// Dipakai bersama modal verifikasi dan modal pembubuhan TTD agar progres "lihat dokumen"
// tidak hilang saat modal ditutup/dibatalkan dan tidak perlu membuka ulang dari awal.
// Kunci: `doc-<id>` (berkas persyaratan), `payment` (bukti transfer), `letter-<key>` (dokumen surat).

// ID pengguna diambil dari payload token login (ikapi_token) agar progres terpisah per akun
// walau beberapa akun bergantian login di browser yang sama.
const currentUserId = () => {
  try {
    const token = localStorage.getItem('ikapi_token');
    if (!token) return 'anon';
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')));
    return payload?.id ?? 'anon';
  } catch {
    return 'anon';
  }
};

const storeKey = (submissionId) => `ikapi_viewed:${currentUserId()}:${submissionId}`;

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
