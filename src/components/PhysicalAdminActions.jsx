import React, { useState } from 'react';
import { PackageCheck, BadgeCheck, CheckCircle } from 'lucide-react';
import { notify } from './AppDialog';

const token = () => localStorage.getItem('ikapi_token');
const KTA_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const inputCls = 'w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-[#0da2e7]';

// Aksi Admin setelah pemohon mengirim berkas fisik:
// 1) Terima Berkas: berkas sampai di IKAPI Jawa Barat & diteruskan ke IKAPI Pusat (status -> Dikirim ke Pusat)
// 2) Input KTA: Nomor KTA + foto KTA dari IKAPI Pusat (status -> Aktif)
// Dipakai di menu Monitoring dan di pop-up detail pengajuan agar Admin tidak tertahan di salah satu menu.
export default function PhysicalAdminActions({ submission, onDone, className = '' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [kta, setKta] = useState({ ktaNumber: '', issuedAt: '', file: null });

  const s = submission;
  const canReceive = s && ['Pengiriman Berkas', 'Berkas Diterima'].includes(s.status);
  // Data lama yang No. KTA-nya diisi pemohon diverifikasi lewat tombol Verifikasi KTA, bukan form ini
  const canInputKta = s && s.status === 'Dikirim ke Pusat' && s.kta_review_status !== 'Menunggu';
  if (!canReceive && !canInputKta) return null;

  const reset = () => { setOpen(false); setNotes(''); setKta({ ktaNumber: '', issuedAt: '', file: null }); };

  const receive = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/submissions/${s.id}/sent-to-central`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ notes: notes.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      notify(data.message || 'Berkas diterima.');
      reset();
      onDone?.();
    } catch (err) {
      notify(err.message || 'Gagal menyimpan penerimaan berkas.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null;
    e.target.value = '';
    if (!f) return;
    if (!KTA_TYPES.includes(f.type)) { notify('Foto KTA harus PDF, JPG, atau PNG.', { tone: 'error' }); return; }
    if (f.size > 15 * 1024 * 1024) { notify('Ukuran file maksimal 15 MB.', { tone: 'error' }); return; }
    setKta((v) => ({ ...v, file: f }));
  };

  const saveKta = async () => {
    const num = kta.ktaNumber.trim().toUpperCase();
    if (!num) { notify('Isi Nomor KTA dari IKAPI Pusat.', { tone: 'error' }); return; }
    if (!/^[A-Z0-9./ -]+$/.test(num)) { notify('Nomor KTA hanya boleh huruf, angka, titik, garis miring, strip, dan spasi.', { tone: 'error' }); return; }
    if (!kta.issuedAt) { notify('Isi tanggal terbit KTA.', { tone: 'error' }); return; }
    if (!kta.file) { notify('Unggah bukti foto KTA dari IKAPI Pusat.', { tone: 'error' }); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('ktaNumber', num);
      fd.append('issuedAt', kta.issuedAt);
      fd.append('notes', notes.trim());
      fd.append('ktaFile', kta.file);
      const res = await fetch(`/api/submissions/${s.id}/kta-input`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      notify(data.message || 'KTA tersimpan. Keanggotaan aktif.');
      reset();
      onDone?.();
    } catch (err) {
      notify(err.message || 'Gagal menyimpan KTA.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (canReceive) {
    if (!open) {
      return (
        <button type="button" onClick={() => setOpen(true)}
          className={`w-full sm:w-auto sm:self-end px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white ${className}`}>
          <PackageCheck className="w-4 h-4" /> Terima Berkas
        </button>
      );
    }
    return (
      <div className={`rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs space-y-2 ${className}`}>
        <p className="font-semibold text-indigo-800">Terima berkas fisik</p>
        <p className="text-slate-600">
          Pastikan berkas fisik pemohon sudah sampai di IKAPI Jawa Barat. Setelah diterima, berkas tercatat diteruskan ke IKAPI Pusat
          dan Anda tinggal menginput Nomor KTA + foto KTA saat KTA terbit.
        </p>
        <textarea value={notes} rows={2} maxLength={1000} onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan (opsional), mis. berkas lengkap / kurang materai" className={inputCls} />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={reset}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold">Batal</button>
          <button type="button" disabled={busy} onClick={receive}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1 disabled:opacity-50">
            <CheckCircle className="w-3.5 h-3.5" /> {busy ? 'Menyimpan...' : 'Ya, berkas sudah diterima'}
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={`w-full sm:w-auto sm:self-end px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white ${className}`}>
        <BadgeCheck className="w-4 h-4" /> Input Nomor KTA
      </button>
    );
  }
  return (
    <div className={`rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs space-y-2 ${className}`}>
      <p className="font-semibold text-violet-800">Input KTA dari IKAPI Pusat</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-slate-600">Nomor KTA *</span>
          <input value={kta.ktaNumber} maxLength={100} onChange={(e) => setKta((v) => ({ ...v, ktaNumber: e.target.value.toUpperCase() }))}
            placeholder="mis. 123/JBA/2026" className={`${inputCls} font-mono`} />
        </label>
        <label className="space-y-1">
          <span className="text-slate-600">Tanggal terbit *</span>
          <input type="date" value={kta.issuedAt} max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setKta((v) => ({ ...v, issuedAt: e.target.value }))} className={inputCls} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-slate-600">Bukti foto KTA * (PDF/JPG/PNG, maks. 15 MB)</span>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={pickFile}
          className="block w-full text-xs text-slate-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-violet-100 file:text-violet-700 file:font-semibold" />
        {kta.file && <span className="block text-slate-700 truncate">{kta.file.name}</span>}
      </label>
      <textarea value={notes} rows={2} maxLength={1000} onChange={(e) => setNotes(e.target.value)}
        placeholder="Catatan (opsional)" className={inputCls} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={reset}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold">Batal</button>
        <button type="button" disabled={busy} onClick={saveKta}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 disabled:opacity-50">
          <CheckCircle className="w-3.5 h-3.5" /> {busy ? 'Menyimpan...' : 'Simpan & aktifkan'}
        </button>
      </div>
    </div>
  );
}
