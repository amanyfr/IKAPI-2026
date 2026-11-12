import { useEffect, useState } from 'react';

// Estimasi waktu tiap tahap, diatur Admin di Pengaturan Sistem (tabel settings, kunci eta_*)
export const ETA_FIELDS = [
  { key: 'eta_hereg_verifikasi', label: 'Verifikasi data anggota lama', def: 'Maks. 2×24 jam kerja' },
  { key: 'eta_screening', label: 'Screening dokumen', def: 'Maks. 2×24 jam kerja', step: 'Menunggu Verifikasi' },
  { key: 'eta_pembayaran', label: 'Verifikasi pembayaran', def: 'Maks. 1×24 jam kerja', step: 'Menunggu Pembayaran' },
  { key: 'eta_ttd_sekretaris', label: 'TTD Sekretaris', def: 'Maks. 2×24 jam kerja', step: 'Menunggu TTD Sekretaris' },
  { key: 'eta_ttd_ketua', label: 'TTD Ketua', def: 'Maks. 2×24 jam kerja', step: 'Menunggu Approval' },
  { key: 'eta_berkas', label: 'Pengiriman berkas fisik', def: '± 2–5 hari kerja', step: 'Pengiriman Berkas' },
  { key: 'eta_kta', label: 'Cek No. KTA', def: 'Maks. 2×24 jam kerja', step: 'Dikirim ke Pusat' },
];

export const ETA_DEFAULTS = Object.fromEntries(ETA_FIELDS.map((f) => [f.key, f.def]));
export const ETA_BY_STEP = Object.fromEntries(ETA_FIELDS.filter((f) => f.step).map((f) => [f.step, f.key]));

// Label pendek untuk chip stepper, mis. "Maks. 2×24 jam kerja" -> "≤ 2×24 jam"
export function shortEta(text) {
  const t = String(text || '').trim();
  let m = t.match(/(\d+)\s*[×x]\s*24\s*jam/i);
  if (m) return `≤ ${m[1]}×24 jam`;
  m = t.match(/(\d+)\s*[–-]\s*(\d+)\s*(hari|jam|minggu)/i);
  if (m) return `${m[1]}–${m[2]} ${m[3].toLowerCase()}`;
  m = t.match(/(\d+)\s*(hari|jam|minggu)/i);
  if (m) return `≤ ${m[1]} ${m[2].toLowerCase()}`;
  return t;
}

let cache = null;
let pending = null;
const listeners = new Set();

function load() {
  if (pending) return pending;
  pending = fetch('/api/settings', { headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` } })
    .then((r) => (r.ok ? r.json() : {}))
    .then((d) => {
      const s = d?.settings || {};
      cache = Object.fromEntries(ETA_FIELDS.map((f) => [f.key, String(s[f.key] || '').trim() || f.def]));
      listeners.forEach((fn) => fn(cache));
      return cache;
    })
    .catch(() => ETA_DEFAULTS)
    .finally(() => { pending = null; });
  return pending;
}

// Dipanggil setelah Admin menyimpan pengaturan supaya tampilan ikut berubah
export function refreshStageEta() { cache = null; return load(); }

export function useStageEta() {
  const [eta, setEta] = useState(cache || ETA_DEFAULTS);
  useEffect(() => {
    listeners.add(setEta);
    if (!cache) load(); else setEta(cache);
    return () => { listeners.delete(setEta); };
  }, []);
  return eta;
}
