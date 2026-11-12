import React, { useEffect, useState, useRef } from 'react';
import {
  RefreshCw, UserCheck, XCircle, CheckCircle, X, AlertTriangle, BadgeCheck, RotateCcw, ShieldCheck, FileText, CalendarClock,
} from 'lucide-react';
import { notify } from './AppDialog';
import { fileUrl } from '../utils/fileUrl';

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` });
const fmtDate = (v) => (v ? new Date(String(v).length <= 10 ? `${v}T00:00:00` : v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const daysLeft = (v) => {
  if (!v) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${String(v).slice(0, 10)}T00:00:00`) - today) / 86400000);
};

// Jalur anggota lama yang dipilih Admin saat menyetujui data KTA
const TRACKS = [
  {
    key: 'Perpanjangan',
    title: 'Perpanjangan (heregistrasi)',
    desc: 'KTA sudah/akan habis. Pemohon mengisi formulir (data terisi otomatis), unggah dokumen, bayar iuran, lalu diproses seperti biasa.',
  },
  {
    key: 'Masih Aktif',
    title: 'Masih aktif · pindah dari data manual',
    desc: 'KTA masih berlaku. Pemohon langsung jadi Anggota Aktif dengan masa aktif sesuai KTA.',
  },
];

function Modal({ children, onClose, saving }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => !saving && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden my-auto" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHead({ eyebrow, title, subtitle, onClose, saving, tone = 'text-amber-600' }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${tone}`}>{eyebrow}</p>
        <h3 className="text-sm font-bold text-slate-800 mt-0.5">{title}</h3>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
      <button type="button" onClick={onClose} disabled={saving} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Tutup">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function Rows({ rows }) {
  return rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
    <div key={k} className="flex justify-between gap-3">
      <dt className="text-slate-500 flex-shrink-0">{k}</dt>
      <dd className="text-slate-800 font-medium text-right break-words min-w-0">{v}</dd>
    </div>
  ));
}

/**
 * Antrean Admin untuk anggota lama:
 * 1. Verifikasi Nomor KTA lama + pilih jalur (perpanjangan / masih aktif).
 * 2. Validasi masa aktif untuk jalur "masih aktif" (data keanggotaan diisi manual oleh pemohon).
 */
export default function HeregRequestsPanel() {
  const [items, setItems] = useState([]);
  const [migs, setMigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const [migReview, setMigReview] = useState(null);
  const [mode, setMode] = useState(null); // null | 'reject' | 'renew'
  const [track, setTrack] = useState('Perpanjangan');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  // Jalur yang dibuka Admin di Pengaturan Sistem (default keduanya)
  const [enabled, setEnabled] = useState(TRACKS.map((t) => t.key));
  const tracks = TRACKS.filter((t) => enabled.includes(t.key));
  const renewOn = enabled.includes('Perpanjangan');

  // Spinner hanya saat pemuatan pertama; muat ulang sesudahnya senyap agar tabel tidak berkedip
  const loadedOnce = useRef(false);
  const load = async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/admin/hereg-requests', { headers: authHeader() }),
        fetch('/api/admin/hereg-migrations', { headers: authHeader() }),
        fetch('/api/settings', { headers: authHeader() }),
      ]);
      const [d1, d2, d3] = await Promise.all([r1.json().catch(() => []), r2.json().catch(() => []), r3.json().catch(() => ({}))]);
      if (r1.ok) setItems(Array.isArray(d1) ? d1 : []);
      if (r2.ok) setMigs(Array.isArray(d2) ? d2 : []);
      const on = String(d3?.settings?.hereg_tracks || '').split(',').map((t) => t.trim()).filter((t) => TRACKS.some((x) => x.key === t));
      if (r3.ok) setEnabled(on.length ? on : TRACKS.map((t) => t.key));
    } catch (err) {
      console.error('Gagal memuat antrean anggota lama:', err);
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const open = (item) => {
    setReview(item); setMode(null); setNote('');
    // Form gabungan: saran jalur dari masa berlaku KTA; pengajuan lama: dari data anggota yang cocok
    const vu = item.hereg_mig_data?.validUntil;
    const guess = item.hereg_mig_data?.ktaNumber
      ? (daysLeft(vu) > 0 ? 'Masih Aktif' : 'Perpanjangan')
      : item.kta_matches?.some((m) => m.membership_status === 'Aktif') ? 'Masih Aktif' : 'Perpanjangan';
    setTrack(enabled.includes(guess) ? guess : enabled[0]);
  };
  const openMig = (item) => { setMigReview(item); setMode(null); setNote(''); };
  const close = () => { setReview(null); setMigReview(null); };

  const post = async (url, body) => {
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      close();
      notify(data.message);
      load();
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = (decision) => {
    if (decision === 'reject' && !note.trim()) {
      notify('Tulis alasan penolakan supaya pemohon tahu apa yang harus diperbaiki.');
      return;
    }
    post(`/api/admin/hereg-requests/${review.id}/review`, {
      decision, track: decision === 'approve' ? track : undefined, note: decision === 'reject' ? note.trim() : undefined,
    });
  };

  const submitMig = (decision) => {
    if (decision === 'reject' && !note.trim()) {
      notify('Tulis alasan penolakan supaya pemohon tahu apa yang harus diperbaiki.');
      return;
    }
    post(`/api/admin/hereg-migrations/${migReview.id}/review`, { decision, note: note.trim() || undefined });
  };

  // Tidak ada antrean: panel tidak memakan tempat
  if (!loading && items.length === 0 && migs.length === 0) return null;
  const total = items.length + migs.length;
  const md = migReview?.hereg_mig_data || {};
  const migLeft = daysLeft(md.validUntil);
  const rd = review?.hereg_mig_data?.ktaNumber ? review.hereg_mig_data : null;
  const rdLeft = rd ? daysLeft(rd.validUntil) : null;
  // KTA habis tidak bisa diaktifkan langsung (server juga menolak)
  const trackOff = (key) => key === 'Masih Aktif' && rd && !(rdLeft > 0);

  return (
    <div className="card-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100"><UserCheck className="w-4 h-4" /></span>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Verifikasi anggota lama {total > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{total}</span>}
            </h3>
            <p className="text-[11px] text-slate-500">
              {tracks.length > 1 ? 'Cocokkan KTA lama lalu tentukan jalurnya: perpanjangan, atau masih aktif (data manual).'
                : `Cocokkan KTA lama. Jalur yang dibuka: ${tracks[0]?.title.toLowerCase()}.`}
            </p>
          </div>
        </div>
        <button type="button" onClick={load} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Muat ulang">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {items.length > 0 && (
        <>
          {migs.length > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Verifikasi KTA lama</p>}
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {items.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-white">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">{it.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{it.email}{it.phone ? ` · ${it.phone}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs font-bold text-slate-800">{it.old_kta_number || '-'}</p>
                  <p className={`text-[10px] font-medium ${it.kta_matches?.length ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {it.kta_matches?.length ? 'Cocok dengan data anggota' : 'Tidak ada di data anggota'}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 w-20 text-right hidden sm:block">{fmtDate(it.hereg_requested_at || it.onboarded_at)}</span>
                <button type="button" onClick={() => open(it)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verifikasi
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {migs.length > 0 && (
        <>
          <p className={`text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 ${items.length ? 'mt-4' : ''}`}>Validasi masa aktif · data manual</p>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {migs.map((it) => {
              const d = it.hereg_mig_data || {};
              const left = daysLeft(d.validUntil);
              return (
                <div key={it.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-white">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{d.publisherName || it.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{it.name} · {it.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-bold text-slate-800">{d.ktaNumber || it.old_kta_number}</p>
                    <p className={`text-[10px] font-medium ${left > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {left > 0 ? `Berlaku s.d. ${fmtDate(d.validUntil)}` : 'Masa berlaku lewat'}
                    </p>
                  </div>
                  <button type="button" onClick={() => openMig(it)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0884c4] hover:bg-[#076fa5] text-white flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Validasi
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Modal 1: verifikasi KTA lama + pilih jalur ── */}
      {review && (
        <Modal onClose={close} saving={saving}>
          <ModalHead eyebrow="Verifikasi anggota lama" title={review.name}
            subtitle="Pastikan pemohon benar pernah terdaftar, lalu tentukan jalurnya." onClose={close} saving={saving} />

          {rd && (
            <div className="px-5 pt-4">
              <div className={`rounded-xl p-3 border flex items-center gap-3 ${rdLeft > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <CalendarClock className={`w-5 h-5 flex-shrink-0 ${rdLeft > 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-slate-800">{rd.publisherName}</p>
                  <p className={rdLeft > 0 ? 'text-emerald-700' : 'text-red-700'}>
                    Terbit {fmtDate(rd.issuedAt)} · berlaku s.d. {fmtDate(rd.validUntil)}
                    {rdLeft > 0 ? ` (${rdLeft} hari lagi)` : ' · sudah lewat'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <dl className={`px-5 py-4 space-y-2.5 text-xs ${rd ? 'max-h-[40vh] overflow-y-auto' : ''}`}>
            <Rows rows={[
              ['Nomor KTA lama', <span className="font-mono font-bold">{review.old_kta_number || '-'}</span>],
              ['Kategori', review.member_category === 'Luar Biasa' ? 'Anggota Luar Biasa' : 'Anggota Biasa'],
              ['Email', review.email],
              ['Telepon', review.phone || '-'],
              ['Akun dibuat', fmtDate(review.created_at)],
              ...(rd ? [
                ['Badan usaha', rd.legalEntity],
                ['Pimpinan', [rd.leaderName, rd.leaderTitle].filter(Boolean).join(' · ')],
                ['Penanggung jawab', rd.personInCharge],
                ['NIB', rd.nib],
                ['Alamat', [rd.address, rd.city, rd.postalCode].filter(Boolean).join(', ')],
                ['Telepon penerbit', rd.phone],
                ['Email penerbit', rd.email],
                ['Website', rd.website],
                ['Spesialisasi', rd.specialization],
                ['Catatan pemohon', rd.notes],
              ] : []),
            ]} />
            {rd && review.hereg_mig_proof && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Bukti KTA</dt>
                <dd className="min-w-0">
                  <a href={fileUrl(review.hereg_mig_proof)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-700 hover:underline font-medium max-w-[14rem] truncate">
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{review.hereg_mig_proof_name || 'Lihat bukti'}</span>
                  </a>
                </dd>
              </div>
            )}
            <div className="pt-1">
              <dt className="text-slate-500 mb-1">Pencocokan data anggota</dt>
              {review.kta_matches?.length ? (
                <dd className="space-y-1">
                  {review.kta_matches.map((m, i) => (
                    <div key={i} className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800">
                      <span className="font-semibold">{m.publisher_name || '-'}</span> · {m.membership_status} · {m.category}
                    </div>
                  ))}
                </dd>
              ) : (
                <dd className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Nomor ini belum tercatat di data anggota sistem. Cek arsip / IKAPI Pusat dulu.
                </dd>
              )}
            </div>
          </dl>

          {mode === 'reject' ? (
            <div className="px-5 pb-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Alasan penolakan <span className="text-red-500">*</span></label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
                placeholder="Contoh: Nomor KTA tidak ditemukan di arsip IKAPI Jawa Barat."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-red-400" />
              <p className="text-[10px] text-slate-500 mt-1">Alasan ini dikirim ke pemohon untuk diperbaiki.</p>
            </div>
          ) : (
            <fieldset className="px-5 pb-4">
              <legend className="text-[11px] font-semibold text-slate-600 mb-1.5">
                {tracks.length > 1 ? 'Jalur bila disetujui' : 'Jalur yang dibuka (diatur di Pengaturan Sistem)'}
              </legend>
              <div className="space-y-2">
                {tracks.map((t) => (
                  <label key={t.key} className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition ${
                    trackOff(t.key) ? 'border-slate-200 opacity-50 cursor-not-allowed'
                      : track === t.key ? 'border-[#0884c4] bg-sky-50/70 ring-1 ring-[#0884c4]/30 cursor-pointer' : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                  }`}>
                    <input type="radio" name="hereg-track" value={t.key} checked={track === t.key} disabled={trackOff(t.key)} onChange={() => setTrack(t.key)}
                      className={`mt-0.5 accent-[#0884c4] ${tracks.length > 1 ? '' : 'hidden'}`} />
                    <span>
                      <span className="block text-xs font-semibold text-slate-800">{t.title}</span>
                      <span className="block text-[11px] text-slate-500 leading-snug">
                        {trackOff(t.key) ? 'Tidak tersedia: masa berlaku KTA sudah lewat.' : !rd && t.key === 'Masih Aktif' ? 'KTA masih berlaku. Pemohon mengisi data keanggotaan di dashboard, lalu Admin memvalidasi masa aktifnya.' : t.desc}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-100">
            {mode === 'reject' ? (
              <>
                <button type="button" onClick={() => setMode(null)} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="button" onClick={() => submit('reject')} disabled={saving || !note.trim()} className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Kirim penolakan'}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setMode('reject')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Tolak
                </button>
                <button type="button" onClick={() => submit('approve')} disabled={saving || trackOff(track)} className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : track === 'Masih Aktif' ? (rd ? 'Setujui · aktifkan' : 'Setujui · masih aktif') : 'Setujui · perpanjangan'}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal 2: validasi masa aktif anggota lama (data manual) ── */}
      {migReview && (
        <Modal onClose={close} saving={saving}>
          <ModalHead eyebrow="Validasi anggota masih aktif" tone="text-[#0884c4]" title={md.publisherName || migReview.name}
            subtitle="Cocokkan data & bukti KTA. Bila masih berlaku, pemohon langsung jadi Anggota Aktif." onClose={close} saving={saving} />

          <div className="px-5 pt-4">
            <div className={`rounded-xl p-3 border flex items-center gap-3 ${migLeft > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <CalendarClock className={`w-5 h-5 flex-shrink-0 ${migLeft > 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              <div className="min-w-0 text-xs">
                <p className="font-mono font-bold text-slate-800">{md.ktaNumber}</p>
                <p className={migLeft > 0 ? 'text-emerald-700' : 'text-red-700'}>
                  Terbit {fmtDate(md.issuedAt)} · berlaku s.d. {fmtDate(md.validUntil)}
                  {migLeft > 0 ? ` (${migLeft} hari lagi)` : ' · sudah lewat'}
                </p>
              </div>
            </div>
            {md.ktaNumber && migReview.old_kta_number && md.ktaNumber !== String(migReview.old_kta_number).toUpperCase() && (
              <p className="mt-2 text-[11px] text-amber-700 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> Berbeda dengan KTA lama saat daftar: {migReview.old_kta_number}
              </p>
            )}
          </div>

          <dl className="px-5 py-4 space-y-2 text-xs max-h-[40vh] overflow-y-auto">
            <Rows rows={[
              ['Penerbit', md.publisherName],
              ['Badan usaha', md.legalEntity],
              ['Pimpinan', [md.leaderName, md.leaderTitle].filter(Boolean).join(' · ')],
              ['Penanggung jawab', md.personInCharge],
              ['NIB', md.nib],
              ['Alamat', [md.address, md.city, md.postalCode].filter(Boolean).join(', ')],
              ['Telepon', md.phone],
              ['Email', md.email],
              ['Website', md.website],
              ['Spesialisasi', md.specialization],
              ['Catatan pemohon', md.notes],
              ['Kategori', migReview.member_category === 'Luar Biasa' ? 'Anggota Luar Biasa' : 'Anggota Biasa'],
              ['Akun', `${migReview.name} · ${migReview.email}`],
            ]} />
            {migReview.hereg_mig_proof && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Bukti KTA</dt>
                <dd className="min-w-0">
                  <a href={fileUrl(migReview.hereg_mig_proof)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-700 hover:underline font-medium max-w-[14rem] truncate">
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{migReview.hereg_mig_proof_name || 'Lihat bukti'}</span>
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {mode && (
            <div className="px-5 pb-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {mode === 'reject' ? <>Alasan penolakan <span className="text-red-500">*</span></> : 'Catatan untuk pemohon (opsional)'}
              </label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
                placeholder={mode === 'reject' ? 'Contoh: Foto KTA buram, tanggal berlaku tidak terbaca.' : 'Contoh: Masa aktif KTA sudah habis Maret 2026.'}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-300 focus:border-sky-400" />
              <p className="text-[10px] text-slate-500 mt-1">
                {mode === 'reject' ? 'Pemohon memperbaiki data lalu mengirim ulang.' : 'Pemohon tetap di dashboard dan melihat saran perpanjangan. Pemohon sendiri yang memilih Perpanjang (berbayar).'}
              </p>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-100">
            {mode ? (
              <>
                <button type="button" onClick={() => setMode(null)} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
                {mode === 'reject' ? (
                  <button type="button" onClick={() => submitMig('reject')} disabled={saving || !note.trim()} className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Kirim penolakan'}
                  </button>
                ) : (
                  <button type="button" onClick={() => submitMig('renew')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Kirim saran perpanjangan'}
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" onClick={() => setMode('reject')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Tolak
                </button>
                {renewOn && (
                  <button type="button" onClick={() => setMode('renew')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Sarankan perpanjang
                  </button>
                )}
                <button type="button" onClick={() => submitMig('approve')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Valid · aktifkan'}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
