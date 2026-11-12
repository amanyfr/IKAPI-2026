import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, XCircle, RefreshCw, Edit3, IdCard, CheckCircle2 } from 'lucide-react';

/**
 * Anggota lama belum boleh mengisi formulir & dokumen sebelum Admin
 * memverifikasi Nomor KTA lamanya. Kartu ini tampil di dashboard selama
 * status verifikasi masih "Menunggu" atau "Ditolak", dan memuat ulang
 * data akun berkala supaya langsung terbuka begitu Admin menyetujui.
 */
export default function HeregVerificationCard({ onEditProfile, onEdit }) {
  const { user, updateUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const rejected = user?.hereg_status === 'Ditolak';

  const refresh = async (manual = false) => {
    if (manual) setChecking(true);
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) updateUser(data.user);
      }
    } catch { /* coba lagi di putaran berikutnya */ }
    finally { if (manual) setChecking(false); }
  };

  useEffect(() => {
    if (rejected) return undefined;
    const t = setInterval(() => refresh(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejected]);

  // Form gabungan (KTA + data keanggotaan) vs pengajuan lama (KTA saja)
  const full = Boolean(user?.hereg_mig_data?.ktaNumber);
  const steps = full ? [
    { label: 'Data KTA & penerbit dikirim', done: true },
    { label: 'Validasi Admin', done: false, current: true },
    { label: 'Dashboard aktif / formulir perpanjangan', done: false },
  ] : [
    { label: 'Data KTA lama dikirim', done: true },
    { label: 'Verifikasi Admin', done: false, current: true },
    { label: 'Isi formulir & unggah dokumen', done: false },
  ];


  return (
    <div className="relative w-full max-w-3xl mx-auto lg:min-h-[calc(100vh-14rem)] flex items-center">
      <div className="overflow-hidden w-full rounded-[28px] bg-white border border-slate-200/80 shadow-[0_30px_80px_-40px_rgba(11,26,74,0.45)]">
        <div className="px-5 sm:px-7 py-6 sm:py-7 border-b border-slate-100 flex items-start gap-4">
          <span className={`relative w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center ring-1 ${
            rejected ? 'bg-red-50 text-red-600 ring-red-100' : 'bg-amber-50 text-amber-600 ring-amber-100'
          }`}>
            {rejected ? <XCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
            {!rejected && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 animate-ping" />}
          </span>
          <div className="min-w-0">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${rejected ? 'text-red-600' : 'text-amber-600'}`}>
              Registrasi anggota lama
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
              {rejected ? 'Data KTA lama ditolak Admin' : 'Menunggu verifikasi data KTA lama'}
            </h2>
            {rejected && (
              <p className="text-sm text-slate-500 mt-1.5">
                Perbaiki Nomor KTA lama sesuai alasan di bawah, lalu kirim ulang untuk diverifikasi.
              </p>
            )}
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-sky-50 text-[#0884c4] ring-1 ring-sky-100 flex items-center justify-center flex-shrink-0">
              <IdCard className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Nomor KTA lama yang dikirim</p>
              <p className="text-base font-semibold text-slate-900 tabular-nums break-words">{user?.old_kta_number || '—'}</p>
            </div>
            <span className="ml-auto soft-chip whitespace-nowrap max-sm:!hidden">
              {user?.member_category === 'Luar Biasa' ? 'Anggota Luar Biasa' : 'Anggota Biasa'}
            </span>
          </div>

          {rejected && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <p className="text-xs font-semibold text-red-700 mb-1">Alasan penolakan</p>
              <p className="text-sm text-red-800 whitespace-pre-line">{user?.hereg_note || '—'}</p>
            </div>
          )}

          {!rejected && (
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {steps.map((s, i) => (
                <li key={s.label} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border text-[13px] ${
                  s.done ? 'bg-emerald-50/60 border-emerald-100 text-emerald-800'
                    : s.current ? 'bg-amber-50/70 border-amber-200 text-amber-800'
                    : 'bg-slate-50/70 border-slate-100 text-slate-500'
                }`}>
                  <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
                    s.done ? 'bg-emerald-500 text-white' : s.current ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {s.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <span className="leading-snug">{s.label}</span>
                </li>
              ))}
            </ol>
          )}

          {!rejected && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-white text-[#0884c4] ring-1 ring-sky-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="text-xs text-slate-500">Estimasi waktu verifikasi Admin</p>
                <p className="font-semibold text-slate-900">Maks. 2×24 jam kerja</p>
              </div>
            </div>
          )}

        </div>

        <div className="border-t border-slate-100 px-5 sm:px-7 py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
          {onEdit && !rejected && (
            <button type="button" onClick={onEdit} className="soft-pill justify-center !h-11">
              <Edit3 className="w-4 h-4" /> Ubah data
            </button>
          )}
          {onEditProfile && (
            <button type="button" onClick={onEditProfile} className={rejected
              ? 'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0884c4] hover:bg-[#076fa5] text-white text-sm font-semibold transition-colors'
              : 'soft-pill justify-center !h-11'}>
              <Edit3 className="w-4 h-4" /> {rejected ? 'Perbaiki & kirim ulang' : 'Ubah data KTA lama'}
            </button>
          )}
          {!rejected && (
            <button type="button" onClick={() => refresh(true)} disabled={checking}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0884c4] hover:bg-[#076fa5] text-white text-sm font-semibold transition-colors disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /> Cek status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
