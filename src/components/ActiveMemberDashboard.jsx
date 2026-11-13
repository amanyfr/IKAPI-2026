import { useState } from 'react';
import {
  ShieldCheck, CalendarDays, CalendarClock, Clock, FileText, Receipt, Edit3, Copy, Check,
  Building2, User, MapPin, Phone, Mail, Globe, Hash, BadgeCheck, AlertTriangle, BookOpen,
  Award, ChevronRight, Sparkles, RefreshCw,
} from 'lucide-react';
import { fileUrl } from '../utils/fileUrl';
import { useAuth } from '../context/AuthContext';

// Default hari pemberitahuan perpanjangan (Admin bisa ubah di Pengaturan Sistem)
export const RENEW_NOTICE_DEFAULT = 7;

/**
 * Dashboard anggota aktif: kartu anggota digital, masa aktif keanggotaan,
 * data penerbit, dan aksi cepat. Masa aktif = tanggal terbit KTA (atau tanggal
 * aktivasi) + durasi iuran yang dibayar (default 24 bulan).
 */

const DAY = 24 * 60 * 60 * 1000;

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmt = (d) => (d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-');
const fmtMid = (d) => (d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const fmtShort = (d) => (d ? d.toLocaleDateString('id-ID', { month: '2-digit', year: '2-digit' }) : '--/--');
const addMonths = (d, n) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};

export function membershipPeriod(sub, durasiBulan = 24) {
  const start = toDate(sub?.kta_issued_at) || toDate(sub?.activated_at);
  if (!start) return null;
  // Masa berlaku manual (anggota lama yang dipindahkan dari data manual) diutamakan
  const manualEnd = toDate(sub?.kta_valid_until);
  const end = manualEnd && manualEnd > start ? manualEnd : addMonths(start, Number(durasiBulan) || 24);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const total = Math.max(1, Math.round((end - start) / DAY));
  const left = Math.ceil((end - today) / DAY);
  const elapsedPct = Math.min(100, Math.max(0, ((total - Math.max(left, 0)) / total) * 100));
  const tone = left <= 0 ? 'expired' : left <= 90 ? 'soon' : 'ok';
  return { start, end, total, left, elapsedPct, tone };
}

const leftLabel = (left) => {
  if (left <= 0) return 'Masa aktif habis';
  if (left < 60) return `${left} hari lagi`;
  const months = Math.floor(left / 30);
  const days = left % 30;
  return days ? `${months} bulan ${days} hari lagi` : `${months} bulan lagi`;
};

const TONES = {
  ok:      { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', ring: '#10b981', bar: 'from-emerald-400 to-emerald-500', text: 'text-emerald-700', label: 'Aktif' },
  soon:    { chip: 'bg-amber-50 text-amber-700 border-amber-200',       ring: '#f59e0b', bar: 'from-amber-400 to-orange-500',    text: 'text-amber-700',   label: 'Segera berakhir' },
  expired: { chip: 'bg-red-50 text-red-700 border-red-200',             ring: '#ef4444', bar: 'from-red-400 to-red-500',         text: 'text-red-700',     label: 'Kedaluwarsa' },
};

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0884c4]">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm text-slate-800 break-words">{value}</p>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, accent = 'text-[#0884c4] bg-sky-50 border-sky-100' }) {
  return (
    <div className="panel-surface px-3 sm:px-4 py-3.5 flex items-center gap-2.5 sm:gap-3 min-w-0">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-2xl border flex items-center justify-center ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-[13px] sm:text-sm font-semibold text-slate-800 leading-snug">{value}</p>
      </div>
    </div>
  );
}

/** Cincin progres sisa masa aktif */
function ProgressRing({ pct, color, children }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#eef2f7" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function ActionButton({ icon: Icon, title, subtitle, onClick, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition border ${
        primary ? 'border-sky-200 bg-gradient-to-r from-sky-50 to-white hover:from-sky-100' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center ${primary ? 'bg-[#0da2e7] text-white shadow-[0_6px_14px_-6px_rgba(13,162,231,0.8)]' : 'bg-slate-100 text-slate-600'}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        <span className="block text-xs text-slate-500">{subtitle}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-slate-400 transition group-hover:translate-x-0.5" />
    </button>
  );
}

/**
 * pending: anggota lama jalur "masih aktif" yang datanya belum divalidasi Admin.
 * Dashboard tetap tampil dari data yang ada; banner di atas memuat status & tombol lengkapi data.
 */
export default function ActiveMemberDashboard({
  sub, durasiBulan = 24, hasInvoice, onOpenPacket, onOpenInvoice, onEditProfile,
  pending = false, banner = null, editLabel = 'Perbarui data', onRenew, renewFee,
  noticeDays = RENEW_NOTICE_DEFAULT,
}) {
  const { user } = useAuth();
  // Sapaan memakai nama akun; nama penerbit tetap tampil di kartu anggota
  const greetName = user?.name || sub.publisher_name;
  const kta = sub.member_kta || sub.kta_number;
  const category = sub.member_category || sub.category || 'Biasa';
  const period = membershipPeriod(sub, durasiBulan);
  const tone = TONES[period?.tone || 'ok'];
  const activeSince = toDate(sub.activated_at) || period?.start;
  const leftPct = period ? 100 - period.elapsedPct : 0;
  const [copied, setCopied] = useState(false);
  // Tombol Perpanjang ada di kartu Masa Aktif; baru bisa diklik setelah pemberitahuan
  // perpanjangan terkirim (H-noticeDays, sama dengan server). Selalu lewat konfirmasi dulu.
  const canRenew = Boolean(onRenew) && !pending;
  const noticeSent = Boolean(period) && period.left <= noticeDays;
  const renewOpen = canRenew && noticeSent;
  // Pengingat: tampil sejak pemberitahuan sampai masa aktif berakhir; hilang setelah perpanjangan diajukan
  const showReminder = renewOpen && period.left > 0;
  // Tercatat dari data manual: tidak ada surat/paket dokumen resmi dari aplikasi
  const migrated = (() => {
    try {
      const fd = typeof sub.form_data === 'string' ? JSON.parse(sub.form_data || '{}') : sub.form_data || {};
      return fd?.source === 'Migrasi';
    } catch { return false; }
  })();

  const copyKta = async () => {
    if (!kta) return;
    try {
      await navigator.clipboard.writeText(kta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard tidak tersedia */ }
  };

  return (
    <div className="space-y-6 motion-safe:animate-stepper-in">
      {banner}

      {/* Pengingat sejak pemberitahuan sampai hari terakhir masa aktif */}
      {showReminder && (
        <section className="rounded-[24px] border p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4 border-amber-200 bg-amber-50/80">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <span className="w-11 h-11 flex-shrink-0 rounded-2xl flex items-center justify-center text-white bg-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {`Masa aktif berakhir ${period.left === 1 ? 'besok' : `dalam ${period.left} hari`}`}
              </p>
              <p className="text-[13px] text-slate-600 mt-0.5">
                Berlaku sampai {fmt(period.end)}. Klik tombol Perpanjang di kartu Masa Aktif Keanggotaan supaya status anggota tetap aktif.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ══ HERO: sambutan + kartu anggota digital ══ */}
      <section className="card-surface relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(13,162,231,0.10),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.08),transparent_50%)] pointer-events-none" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr),minmax(0,480px)] items-center p-5 sm:p-8">
          <div className="space-y-5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {pending ? (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold bg-amber-50 text-amber-700 border-amber-200">
                  <Clock className="w-3.5 h-3.5" /> Menunggu validasi Admin
                </span>
              ) : (
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${tone.chip}`}>
                  <span className="relative flex w-2 h-2">
                    {period?.tone !== 'expired' && <span className="absolute inset-0 rounded-full bg-current opacity-60 motion-safe:animate-ping" />}
                    <span className="relative w-2 h-2 rounded-full bg-current" />
                  </span>
                  Keanggotaan {tone.label}
                </span>
              )}
              <span className="soft-chip"><Award className="w-3.5 h-3.5 text-[#0884c4]" /> Anggota {category}</span>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#0884c4] font-semibold">Dashboard Anggota</p>
              <h2 className="text-2xl sm:text-[2rem] leading-tight font-light text-slate-800 mt-1">
                Selamat datang, <span className="font-medium">{greetName}</span>
              </h2>
              {pending ? (
                <p className="text-sm text-slate-500 mt-2 max-w-lg">
                  Keanggotaan Anda sebelumnya didata manual. Lengkapi data penerbit & masa berlaku KTA, lalu Admin memvalidasi bahwa keanggotaan Anda masih aktif.
                </p>
              ) : (
              <p className="text-sm text-slate-500 mt-2 max-w-lg">
                Anda resmi tercatat sebagai anggota IKAPI Jawa Barat{activeSince && <> sejak <strong className="font-medium text-slate-700">{fmt(activeSince)}</strong></>}.
                Simpan nomor KTA Anda untuk keperluan administrasi penerbitan.
              </p>
              )}
            </div>

            {/* Nomor KTA + salin */}
            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 pl-4 pr-2 py-2 shadow-sm max-w-full">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Nomor KTA</p>
                <p className="font-mono text-lg font-semibold tracking-wider text-slate-800 truncate">{kta || 'Belum tercatat'}</p>
              </div>
              {kta && (
                <button type="button" onClick={copyKta} title="Salin nomor KTA"
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition ${copied ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              )}
            </div>

            {!migrated && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onOpenPacket} className="soft-pill-primary">
                  <FileText className="w-4 h-4" /> Dokumen resmi
                </button>
              </div>
            )}
          </div>

          {/* Kartu anggota digital */}
          <div className="relative w-full max-w-[480px] mx-auto lg:mx-0 [perspective:1200px]">
            <div className="absolute -inset-3 rounded-[32px] bg-gradient-to-br from-sky-300/30 to-emerald-200/20 blur-2xl" />
            <div className="relative aspect-[1.586/1] rounded-[24px] overflow-hidden text-white shadow-[0_24px_50px_-20px_rgba(9,107,160,0.75)] bg-gradient-to-br from-[#0e4568] via-[#096ba0] to-[#0da2e7] transition duration-500 hover:[transform:rotateX(4deg)_rotateY(-6deg)]">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10" />
              <div className="absolute -bottom-24 -left-10 w-64 h-64 rounded-full bg-white/[0.07]" />
              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.22)_50%,transparent_65%)] bg-[length:250%_100%] motion-safe:animate-stepper-shine" />

              <div className="relative h-full flex flex-col justify-between p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white p-1 shadow-sm">
                      <img src="/logo-ikapi.jpg" alt="IKAPI" className="w-full h-full object-contain rounded-lg" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-white/75">Kartu Anggota</p>
                      <p className="text-sm sm:text-base font-semibold">IKAPI Jawa Barat</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-white/15 ring-1 ring-white/30 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">
                    {pending ? 'Validasi' : period?.tone === 'expired' ? 'Kedaluwarsa' : 'Aktif'}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-white/70">Nomor KTA</p>
                  <p className="font-mono text-lg sm:text-2xl tracking-[0.12em] font-medium break-all">{kta || 'Belum tercatat'}</p>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg font-semibold truncate">{sub.publisher_name}</p>
                    <p className="text-[11px] sm:text-xs text-white/80 truncate">
                      Anggota {category}{sub.legal_entity ? ` · ${sub.legal_entity}` : ''}{sub.city ? ` · ${sub.city}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Berlaku s.d.</p>
                    <p className="font-mono text-sm sm:text-base font-semibold">{fmtShort(period?.end)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ RINGKASAN CEPAT ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile icon={BadgeCheck} label="Keanggotaan" value={pending ? 'Menunggu validasi' : tone.label}
          accent={period?.tone === 'ok' || !period ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : period.tone === 'soon' ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-red-600 bg-red-50 border-red-100'} />
        <StatTile icon={CalendarDays} label="Anggota sejak" value={fmtMid(activeSince)} />
        <StatTile icon={Clock} label="Berlaku sampai" value={fmtMid(period?.end)} accent="text-violet-600 bg-violet-50 border-violet-100" />
        <StatTile icon={Award} label="Kategori anggota" value={category} accent="text-amber-600 bg-amber-50 border-amber-100" />
      </div>

      {/* ══ MASA AKTIF + DOKUMEN ══ */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
        <div className="card-surface p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <CalendarClock className="w-5 h-5 text-[#0884c4]" />
            <h3 className="text-lg text-slate-800">Masa Aktif Keanggotaan</h3>
          </div>

          {period ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ProgressRing pct={leftPct} color={tone.ring}>
                <span className={`text-3xl font-semibold ${tone.text}`}>{Math.max(period.left, 0)}</span>
                <span className="text-[11px] text-slate-500">hari tersisa</span>
              </ProgressRing>

              <div className="flex-1 w-full min-w-0">
                <p className={`text-2xl font-light ${tone.text}`}>{leftLabel(period.left)}</p>
                <p className="text-xs text-slate-500 mt-1">{migrated ? 'Sesuai masa berlaku KTA yang divalidasi Admin' : `Durasi iuran ${durasiBulan} bulan sejak KTA terbit`}</p>

                <div className="mt-4">
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${tone.bar} transition-all duration-700`} style={{ width: `${period.elapsedPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1.5">
                    <span>{fmt(period.start)}</span>
                    <span>{fmt(period.end)}</span>
                  </div>
                </div>

                {period.tone !== 'ok' ? (
                  <p className={`mt-4 flex items-start gap-2 text-xs rounded-xl border px-3 py-2.5 ${tone.chip}`}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" />
                    {period.tone === 'expired'
                      ? 'Masa aktif keanggotaan sudah habis. Klik Perpanjang untuk mengajukan perpanjangan.'
                      : noticeSent
                        ? 'Masa aktif hampir habis. Perpanjang sekarang agar keanggotaan tidak terputus.'
                        : `Masa aktif hampir habis. Tombol Perpanjang aktif setelah pemberitahuan perpanjangan (H-${noticeDays}).`}
                  </p>
                ) : (
                  <p className="mt-4 flex items-start gap-2 text-xs rounded-xl border border-sky-100 bg-sky-50/70 text-sky-800 px-3 py-2.5">
                    <Sparkles className="w-4 h-4 flex-shrink-0 mt-px" />
                    Pemberitahuan perpanjangan dikirim {noticeDays} hari sebelum masa aktif berakhir. Setelah itu tombol Perpanjang bisa diklik.
                  </p>
                )}

                {canRenew && (
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <button type="button" onClick={() => onRenew()} disabled={!renewOpen}
                      title={renewOpen ? undefined : `Aktif setelah pemberitahuan perpanjangan (H-${noticeDays})`}
                      className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                      <RefreshCw className="w-4 h-4" /> Perpanjang
                    </button>
                    {!renewOpen && (
                      <span className="text-[11px] text-slate-500">
                        Bisa diklik mulai {fmt(new Date(period.end.getTime() - noticeDays * DAY))} (H-{noticeDays}), setelah pemberitahuan perpanjangan.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {pending
                ? 'Isi tanggal terbit & tanggal berlaku KTA lewat tombol lengkapi data, supaya sisa masa aktif tampil di sini.'
                : 'Tanggal aktif keanggotaan belum tercatat.'}
            </p>
          )}
        </div>

        <div className="card-surface p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2.5 mb-2">
            <ShieldCheck className="w-5 h-5 text-[#0884c4]" />
            <h3 className="text-lg text-slate-800">Dokumen Keanggotaan</h3>
          </div>
          {pending ? (
            <ActionButton primary icon={FileText} title="Bukti KTA"
              subtitle={sub.kta_proof_file ? 'Scan KTA yang dikirim untuk validasi' : 'Belum diunggah · klik untuk melengkapi'}
              onClick={() => (sub.kta_proof_file ? window.open(fileUrl(sub.kta_proof_file), '_blank', 'noopener') : onEditProfile?.())} />
          ) : migrated ? (
            sub.kta_proof_file && (
              <ActionButton primary icon={FileText} title="Bukti KTA" subtitle="Scan KTA yang divalidasi Admin" onClick={() => window.open(fileUrl(sub.kta_proof_file), '_blank', 'noopener')} />
            )
          ) : (
            <ActionButton primary icon={FileText} title="Dokumen resmi" subtitle="Surat pengantar, SK & berita acara" onClick={onOpenPacket} />
          )}
          {hasInvoice && (
            <ActionButton icon={Receipt} title="Invoice pembayaran" subtitle="Bukti iuran keanggotaan · Lunas" onClick={onOpenInvoice} />
          )}
          {sub.id && <div className="panel-inner px-4 py-3 text-xs text-slate-500 space-y-1">
            {sub.reference_number && <p>No. surat: <span className="font-mono text-slate-700">{sub.reference_number}</span></p>}
            <p>No. pengajuan: <span className="font-mono text-slate-700">#{sub.id}</span> · {migrated ? 'Anggota lama (data manual)' : sub.submission_type === 'Heregistrasi' ? 'Heregistrasi' : 'Anggota Baru'}</p>
          </div>}
        </div>
      </div>

      {/* ══ DATA PENERBIT ══ */}
      <div className="card-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-[#0884c4]" />
            <h3 className="text-lg text-slate-800">Data Penerbit</h3>
          </div>
          {onEditProfile && (
            <button type="button" onClick={onEditProfile}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-[#0884c4] shadow-sm transition hover:bg-[#0884c4] hover:text-white hover:border-[#0884c4] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
              <Edit3 className="w-3.5 h-3.5" /> {editLabel}
            </button>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 divide-y divide-slate-100 sm:divide-y-0">
          <InfoRow icon={User} label="Pimpinan" value={[sub.leader_name, sub.leader_title].filter(Boolean).join(' · ')} />
          <InfoRow icon={BadgeCheck} label="Kategori / badan usaha" value={[`Anggota ${category}`, sub.legal_entity].filter(Boolean).join(' · ')} />
          <InfoRow icon={Hash} label="NIB" value={sub.nib} />
          <InfoRow icon={User} label="PJ redaksi / editor" value={sub.person_in_charge} />
          <InfoRow icon={Phone} label="Telepon" value={sub.publisher_phone || sub.leader_phone} />
          <InfoRow icon={Mail} label="Email" value={sub.publisher_email} />
          <InfoRow icon={Globe} label="Website" value={sub.website} />
          <InfoRow icon={BookOpen} label="Spesialisasi terbitan" value={sub.specialization} />
          <div className="sm:col-span-2 lg:col-span-3">
            <InfoRow icon={MapPin} label="Alamat" value={[sub.address, sub.city, sub.postal_code].filter(Boolean).join(', ')} />
          </div>
        </div>
      </div>
    </div>
  );
}
