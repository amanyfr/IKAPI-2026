import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck, Clock, XCircle, RefreshCw, Edit3, IdCard, CheckCircle2, Building2, CalendarClock, Upload, FileText, Send, AlertTriangle,
} from 'lucide-react';
import { notify } from './AppDialog';
import ModalFrame from './ModalFrame';
import ActiveMemberDashboard from './ActiveMemberDashboard';
import { FILTERS, NUMERIC, PHONE } from '../utils/inputFilters';
import { feesFromSettings } from '../utils/fees';
import RenewConfirm from './RenewConfirm';

/**
 * Jalur anggota lama "masih aktif": KTA masih berlaku tapi dulu didata manual.
 * Tanpa formulir pengajuan & pembayaran — pemohon cukup melengkapi data
 * keanggotaan + bukti KTA, lalu Admin memvalidasi masa aktifnya.
 */

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` });
const fmtDate = (v) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-');
const todayIso = () => new Date().toISOString().slice(0, 10);
// Masa berlaku KTA bawaan: tanggal terbit + 24 bulan (tetap bisa diubah)
const KTA_MONTHS = 24;
const plusMonths = (iso, months) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
};

const EMPTY = {
  publisherName: '', legalEntity: '', leaderName: '', leaderTitle: '', leaderPhone: '', nib: '',
  address: '', city: '', postalCode: '', phone: '', email: '', website: '', personInCharge: '',
  specialization: '', notes: '', ktaNumber: '', issuedAt: '', validUntil: '',
};

const LEGAL = ['PT', 'CV', 'Yayasan', 'Perguruan Tinggi', 'Lainnya'];

function Field({ label, required, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-slate-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-9 h-9 rounded-xl bg-sky-50 text-[#0884c4] ring-1 ring-sky-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function MigrationForm({ onDone, onCancel }) {
  const { user, updateUser } = useAuth();
  const rejected = user?.hereg_mig_status === 'Ditolak';
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...(user?.hereg_mig_data || {}),
    ktaNumber: user?.hereg_mig_data?.ktaNumber || user?.old_kta_number || '',
    email: user?.hereg_mig_data?.email || user?.email || '',
    phone: user?.hereg_mig_data?.phone || user?.phone || '',
  }));
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, filter) => (e) => {
    const v = filter ? filter(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  // Isi otomatis "berlaku sampai" selama anggota belum mengubahnya sendiri
  const setIssuedAt = (e) => {
    const issuedAt = e.target.value;
    setForm((f) => {
      const auto = !f.validUntil || f.validUntil === plusMonths(f.issuedAt, KTA_MONTHS);
      return { ...f, issuedAt, validUntil: auto ? plusMonths(issuedAt, KTA_MONTHS) : f.validUntil };
    });
  };

  const expired = form.validUntil && form.validUntil <= todayIso();
  const hasProof = Boolean(file || user?.hereg_mig_proof_name);
  const required = ['publisherName', 'leaderName', 'personInCharge', 'address', 'city', 'phone', 'email', 'ktaNumber', 'issuedAt', 'validUntil'];
  const canSubmit = useMemo(() => required.every((k) => String(form[k] || '').trim()) && hasProof,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, hasProof]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      notify('Lengkapi semua isian bertanda * dan unggah bukti KTA.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
      if (file) fd.append('ktaFile', file);
      const res = await fetch('/api/auth/hereg-migration', { method: 'POST', headers: authHeader(), body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim data keanggotaan.');
      if (data.user) updateUser({ ...user, ...data.user });
      notify(data.message);
      onDone?.();
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  };

  const input = 'soft-input w-full';

  return (
    <form onSubmit={submit} className="w-full bg-slate-50 p-3 sm:p-5 space-y-4">
      {/* Header */}
      <div className="overflow-hidden rounded-[24px] bg-white border border-slate-200/80">
        <div className="px-5 sm:px-7 py-6 flex items-start gap-4">
          <span className="w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center ring-1 bg-emerald-50 text-emerald-600 ring-emerald-100">
            <ShieldCheck className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">KTA lama terverifikasi · anggota masih aktif</p>
            <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Data keanggotaan</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Keanggotaan Anda sebelumnya didata manual. Isi data penerbit & masa berlaku KTA sesuai kartu anggota Anda, tanpa formulir pengajuan atau pembayaran.
              Admin memvalidasi bahwa keanggotaan Anda masih aktif.
            </p>
          </div>
        </div>
        {rejected && (
          <div className="mx-5 sm:mx-7 mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700 mb-0.5">Data dikembalikan Admin</p>
              <p className="text-sm text-red-800 whitespace-pre-line">{user?.hereg_mig_note || '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* KTA & masa berlaku */}
      <div className="card-surface p-5 sm:p-6">
        <SectionTitle icon={IdCard} title="KTA & masa berlaku" subtitle="Sesuai kartu anggota IKAPI yang masih berlaku." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Nomor KTA" required>
            <input className={`${input} font-mono uppercase`} value={form.ktaNumber} onChange={set('ktaNumber', (v) => v.toUpperCase())} maxLength={100} />
          </Field>
          <Field label="Tanggal terbit" required>
            <input type="date" className={input} value={form.issuedAt} max={todayIso()} onChange={setIssuedAt} />
          </Field>
          <Field label="Berlaku sampai" required hint={`Otomatis ${KTA_MONTHS} bulan dari tanggal terbit. Ubah bila berbeda dengan KTA.`}>
            <input type="date" className={input} value={form.validUntil} min={form.issuedAt || undefined} onChange={set('validUntil')} />
          </Field>
        </div>
        {expired && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Tanggal berlaku sudah lewat. Admin kemungkinan akan mengalihkan Anda ke jalur perpanjangan.
          </p>
        )}
        <div className="mt-4">
          <span className="block text-xs font-medium text-slate-600 mb-1.5">Foto / scan KTA <span className="text-red-500">*</span></span>
          <label className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 hover:border-[#0884c4] hover:bg-sky-50/40 px-4 py-3.5 cursor-pointer transition">
            <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
              {file || user?.hereg_mig_proof_name ? <FileText className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-800 truncate">
                {file?.name || user?.hereg_mig_proof_name || 'Pilih file KTA'}
              </span>
              <span className="block text-[11px] text-slate-400">
                {file || user?.hereg_mig_proof_name ? 'Klik untuk mengganti file' : 'PDF, JPG, PNG, atau WEBP · maks 15 MB'}
              </span>
            </span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
      </div>

      {/* Data penerbit */}
      <div className="card-surface p-5 sm:p-6">
        <SectionTitle icon={Building2} title="Data penerbit" subtitle="Tampil di kartu anggota & dashboard Anda." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nama penerbit" required className="sm:col-span-2">
            <input className={input} value={form.publisherName} onChange={set('publisherName')} maxLength={255} />
          </Field>
          <Field label="Badan usaha">
            <select className={input} value={form.legalEntity} onChange={set('legalEntity')}>
              <option value="">Pilih</option>
              {LEGAL.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="NIB">
            <input className={input} value={form.nib} onChange={set('nib', FILTERS.digits)} {...NUMERIC} maxLength={30} />
          </Field>
          <Field label="Nama pimpinan" required>
            <input className={input} value={form.leaderName} onChange={set('leaderName')} maxLength={255} />
          </Field>
          <Field label="Jabatan pimpinan">
            <input className={input} value={form.leaderTitle} onChange={set('leaderTitle')} placeholder="Direktur" maxLength={255} />
          </Field>
          <Field label="Penanggung jawab / PIC" required>
            <input className={input} value={form.personInCharge} onChange={set('personInCharge')} maxLength={255} />
          </Field>
          <Field label="No. HP pimpinan">
            <input className={input} value={form.leaderPhone} onChange={set('leaderPhone', FILTERS.phone)} {...PHONE} maxLength={50} />
          </Field>
          <Field label="Alamat" required className="sm:col-span-2">
            <textarea className={`${input} !h-auto py-2.5`} rows={2} value={form.address} onChange={set('address')} maxLength={1000} />
          </Field>
          <Field label="Kota / kabupaten" required>
            <input className={input} value={form.city} onChange={set('city')} maxLength={150} />
          </Field>
          <Field label="Kode pos">
            <input className={input} value={form.postalCode} onChange={set('postalCode', FILTERS.digits)} {...NUMERIC} maxLength={10} />
          </Field>
          <Field label="Telepon penerbit" required>
            <input className={input} value={form.phone} onChange={set('phone', FILTERS.phone)} {...PHONE} maxLength={50} />
          </Field>
          <Field label="Email penerbit" required>
            <input type="email" className={input} value={form.email} onChange={set('email')} maxLength={255} />
          </Field>
          <Field label="Website">
            <input className={input} value={form.website} onChange={set('website')} placeholder="https://" maxLength={255} />
          </Field>
          <Field label="Spesialisasi terbitan">
            <input className={input} value={form.specialization} onChange={set('specialization')} placeholder="Buku anak, pendidikan, ..." maxLength={500} />
          </Field>
          <Field label="Catatan untuk Admin" className="sm:col-span-2" hint="Opsional, mis. tahun pertama bergabung atau lokasi arsip KTA.">
            <textarea className={`${input} !h-auto py-2.5`} rows={2} value={form.notes} onChange={set('notes')} maxLength={1000} />
          </Field>
        </div>
      </div>

      {/* Aksi */}
      <div className="card-surface px-5 sm:px-6 py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarClock className="w-4 h-4 text-[#0884c4] flex-shrink-0" />
          Masa aktif di dashboard mengikuti tanggal berlaku yang divalidasi Admin.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
          {onCancel && (
            <button type="button" onClick={onCancel} className="soft-pill justify-center !h-11">Batal</button>
          )}
          <button type="submit" disabled={saving}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0884c4] hover:bg-[#076fa5] text-white text-sm font-semibold transition-colors disabled:opacity-60">
            <Send className="w-4 h-4" /> {saving ? 'Mengirim...' : rejected ? 'Kirim ulang untuk validasi' : 'Kirim untuk validasi'}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ── Banner status validasi di atas dashboard ── */
const BANNERS = {
  Kosong: {
    tone: 'border-sky-200 bg-sky-50/80', icon: 'bg-[#0884c4] text-white', Icon: IdCard,
    title: 'Lengkapi data keanggotaan Anda',
    body: 'Keanggotaan Anda sebelumnya didata manual. Isi data penerbit, masa berlaku KTA & unggah bukti KTA supaya Admin bisa memvalidasi.',
    cta: 'Lengkapi data',
  },
  Menunggu: {
    tone: 'border-amber-200 bg-amber-50/80', icon: 'bg-amber-400 text-white', Icon: Clock,
    title: 'Menunggu validasi Admin',
    body: 'Admin sedang memeriksa data & bukti KTA Anda untuk memastikan keanggotaan masih aktif.',
    cta: 'Ubah data',
  },
  Saran: {
    tone: 'border-orange-200 bg-orange-50/80', icon: 'bg-orange-500 text-white', Icon: AlertTriangle,
    title: 'Keanggotaan Anda sebaiknya diperpanjang',
    body: null,
    cta: 'Perbarui data',
  },
  Ditolak: {
    tone: 'border-red-200 bg-red-50/80', icon: 'bg-red-500 text-white', Icon: XCircle,
    title: 'Data dikembalikan Admin',
    body: null,
    cta: 'Perbaiki data',
  },
};

function StatusBanner({ user, onOpen, onRefresh, checking, onEditProfile, onRenew }) {
  const st = user?.hereg_mig_status === 'Ditolak' ? 'Ditolak'
    : user?.hereg_mig_status === 'Perlu Perpanjang' ? 'Saran'
      : ['Menunggu', 'Disetujui'].includes(user?.hereg_mig_status) ? 'Menunggu' : 'Kosong';
  const saranText = `Admin menilai masa aktif KTA Anda sebaiknya diperpanjang${user?.hereg_mig_note ? `: ${user.hereg_mig_note}` : '.'}\nPilih Perpanjang untuk mengisi formulir & membayar iuran, atau perbarui data bila ada yang keliru.`;
  const b = BANNERS[st];
  const Icon = b.Icon;
  return (
    <section className={`rounded-[24px] border ${b.tone} p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4`}>
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <span className={`w-11 h-11 flex-shrink-0 rounded-2xl flex items-center justify-center ${b.icon}`}>
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{b.title}</p>
          <p className="text-[13px] text-slate-600 mt-0.5 whitespace-pre-line">
            {st === 'Ditolak' ? (user?.hereg_mig_note || 'Perbaiki data sesuai catatan Admin, lalu kirim ulang.') : st === 'Saran' ? saranText : b.body}
          </p>
          {onEditProfile && st === 'Kosong' && (
            <button type="button" onClick={onEditProfile} className="mt-1 text-xs text-[#0884c4] font-semibold hover:underline">
              Bukan anggota yang masih aktif? Ubah jawaban profil
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-2 md:flex-shrink-0">
        {st === 'Menunggu' && (
          <button type="button" onClick={onRefresh} disabled={checking} className="soft-pill justify-center !h-11">
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /> Cek status
          </button>
        )}
        {onRenew && st === 'Saran' ? (
          <>
            <button type="button" onClick={onOpen} className="soft-pill justify-center !h-11">
              <Edit3 className="w-4 h-4" /> {b.cta}
            </button>
            <button type="button" onClick={onRenew}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors">
              <RefreshCw className="w-4 h-4" /> Perpanjang
            </button>
          </>
        ) : (
          // Belum tervalidasi: tidak ada tombol Perpanjang (muncul di dashboard H-7 masa aktif, atau saat Admin menyarankan)
          <button type="button" onClick={onOpen}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0884c4] hover:bg-[#076fa5] text-white text-sm font-semibold transition-colors">
            <Edit3 className="w-4 h-4" /> {b.cta}
          </button>
        )}
      </div>
    </section>
  );
}

/** Data sementara (belum divalidasi) dipetakan ke bentuk pengajuan supaya dashboard anggota bisa dipakai ulang */
function pendingSub(user) {
  const d = user?.hereg_mig_data || {};
  return {
    id: null,
    publisher_name: d.publisherName || user?.name || 'Anggota',
    kta_number: d.ktaNumber || user?.old_kta_number || '',
    member_category: user?.member_category || 'Biasa',
    kta_issued_at: d.issuedAt || null,
    kta_valid_until: d.validUntil || null,
    kta_proof_file: user?.hereg_mig_proof || null,
    legal_entity: d.legalEntity, nib: d.nib, leader_name: d.leaderName, leader_title: d.leaderTitle,
    leader_phone: d.leaderPhone, person_in_charge: d.personInCharge, publisher_phone: d.phone || user?.phone,
    publisher_email: d.email || user?.email, website: d.website, specialization: d.specialization,
    address: d.address, city: d.city, postal_code: d.postalCode,
    submission_type: 'Heregistrasi',
    form_data: { source: 'Migrasi' },
  };
}

/**
 * Anggota lama "masih aktif" yang sudah disetujui Admin langsung masuk dashboard.
 * Data keanggotaan dilengkapi lewat modal, lalu Admin memvalidasi masa aktifnya.
 */
export default function HeregMigrationForm({ onEditProfile }) {
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [settings, setSettings] = useState(null);
  const [renewAsk, setRenewAsk] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const waiting = ['Menunggu', 'Disetujui'].includes(user?.hereg_mig_status);

  // Biaya & jalur perpanjangan sesuai Pengaturan Sistem
  useEffect(() => {
    fetch('/api/settings', { headers: authHeader() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.settings && setSettings(data.settings))
      .catch(() => {});
  }, []);
  const enabledTracks = String(settings?.hereg_tracks || '').split(',').map((t) => t.trim()).filter(Boolean);
  const renewOn = Boolean(settings) && (enabledTracks.length === 0 || enabledTracks.includes('Perpanjangan'));

  const renew = async () => {
    setRenewing(true);
    try {
      const res = await fetch('/api/auth/hereg-renew', { method: 'POST', headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memulai perpanjangan.');
      setRenewAsk(false);
      if (data.user) updateUser({ ...user, ...data.user });
    } catch (err) {
      notify(err.message);
    } finally {
      setRenewing(false);
    }
  };

  const refresh = async (manual = false) => {
    if (manual) setChecking(true);
    try {
      const res = await fetch('/api/auth/me', { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        if (data.user) updateUser(data.user);
      }
    } catch { /* coba lagi nanti */ }
    finally { if (manual) setChecking(false); }
  };

  // Saat menunggu validasi: muat ulang berkala supaya status di dashboard langsung berganti
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(() => refresh(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  const sub = useMemo(() => pendingSub(user), [user]);

  return (
    <>
      <ActiveMemberDashboard
        sub={sub}
        pending
        editLabel="Lengkapi data"
        onEditProfile={() => setOpen(true)}
        banner={<StatusBanner user={user} onOpen={() => setOpen(true)} onRefresh={() => refresh(true)} checking={checking} onEditProfile={onEditProfile}
          onRenew={renewOn ? () => setRenewAsk(true) : undefined} />}
      />
      {renewAsk && (
        <RenewConfirm fee={feesFromSettings(settings || {}, 'Heregistrasi')} busy={renewing}
          onCancel={() => setRenewAsk(false)} onConfirm={renew} />
      )}
      {open && (
        <ModalFrame maxWidth="max-w-4xl" onClose={() => setOpen(false)}>
          <MigrationForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </ModalFrame>
      )}
    </>
  );
}
