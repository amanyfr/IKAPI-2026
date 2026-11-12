import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import DocumentVerificationModal from '../components/DocumentVerificationModal';
import { STEPS, STATUS_LABEL } from '../components/StatusStepper';
import {
  Activity, Truck, RefreshCw, CheckCircle, Clock, Search, Send, PackageCheck, BadgeCheck, Eye,
  AlertTriangle, Inbox, Hash, CalendarDays, User, ChevronRight, HelpCircle, XCircle,
} from 'lucide-react';
import { notify } from '../components/AppDialog';
import { fileUrl } from '../utils/fileUrl';
import { isMeaningfulNote, NOTE_HINT } from '../utils/noteRules';

const token = () => localStorage.getItem('ikapi_token');

const formatDate = (raw) => {
  if (!raw) return '-';
  const d = new Date(String(raw).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const daysSince = (raw) => {
  if (!raw) return null;
  const d = new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

// Tahap setelah surat ditandatangani: pemohon kirim berkas langsung ke IKAPI Pusat -> pemohon isi No. KTA -> aktif.
// Tahap 'Berkas Diterima' hanya untuk data lama (alur sebelumnya lewat sekretariat).
// Kelas warna ditulis lengkap supaya terbaca Tailwind.
const SECTIONS = [
  {
    key: 'fisik', label: 'Berkas fisik dari pemohon', short: 'Berkas dari pemohon', icon: Truck, statuses: ['Pengiriman Berkas'],
    hint: 'Pemohon mencetak & mengirim berkas ke IKAPI Pusat',
    empty: 'Belum ada berkas fisik yang ditunggu dari pemohon.',
    tone: { icon: 'bg-amber-100 text-amber-700', active: 'border-amber-300 bg-amber-50/70 ring-2 ring-amber-200', bar: 'bg-amber-400', text: 'text-amber-700' },
  },
  {
    key: 'pusat', label: 'Di sekretariat (data lama)', short: 'Data lama', icon: PackageCheck, statuses: ['Berkas Diterima'],
    hint: 'Berkas sudah di sekretariat, tinggal dikirim',
    empty: 'Tidak ada berkas yang menunggu dikirim ke IKAPI Pusat.',
    tone: { icon: 'bg-indigo-100 text-indigo-700', active: 'border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-200', bar: 'bg-indigo-400', text: 'text-indigo-700' },
  },
  {
    key: 'kta', label: 'Input KTA · verifikasi Admin', short: 'Input KTA', icon: HelpCircle, statuses: ['Dikirim ke Pusat'],
    hint: 'Pemohon isi No. KTA, Admin cek benar / tolak',
    empty: 'Tidak ada pengajuan di tahap Input KTA.',
    tone: { icon: 'bg-violet-100 text-violet-700', active: 'border-violet-300 bg-violet-50/70 ring-2 ring-violet-200', bar: 'bg-violet-400', text: 'text-violet-700' },
  },
  {
    key: 'selesai', label: 'Selesai · anggota aktif', short: 'Anggota aktif', icon: BadgeCheck, statuses: ['Aktif'],
    hint: 'No. KTA terbit, keanggotaan aktif',
    empty: 'Belum ada anggota yang aktif.',
    tone: { icon: 'bg-emerald-100 text-emerald-700', active: 'border-emerald-300 bg-emerald-50/70 ring-2 ring-emerald-200', bar: 'bg-emerald-400', text: 'text-emerald-700' },
  },
];

// Ringkasan tile per status (Berkas Diterima ditampilkan terpisah dari Dikirim ke Pusat)
const TILES = [
  ...STEPS.slice(0, 6),
  { key: 'Berkas Diterima', label: 'Berkas diterima', icon: PackageCheck },
  STEPS[6],
  STEPS[7],
];
// Indeks tile pertama tahap fisik (Berkas Fisik) untuk pengelompokan visual
const PHYSICAL_FROM = 5;

// Monitoring status pendaftaran (semua tahap) sampai pengiriman ke IKAPI Pusat dan terbitnya No. KTA
export default function PhysicalMonitoring({ onOpenScreening }) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('fisik');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  // Verifikasi data KTA dari pemohon: id pengajuan yang sedang ditolak + alasannya
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [reviewing, setReviewing] = useState(null);

  // Spinner hanya saat pemuatan pertama; muat ulang sesudahnya senyap agar tabel tidak berkedip
  const loadedOnce = useRef(false);
  const load = async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const res = await fetch('/api/submissions', { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Gagal memuat monitoring:', err);
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id) => {
    const res = await fetch(`/api/submissions/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
    setDetail(await res.json());
  };

  const postAction = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    notify(data.message);
  };

  const handleKtaReview = async (id, decision) => {
    if (decision === 'reject' && !isMeaningfulNote(rejectNote)) {
      notify(`Tulis alasan penolakan agar pemohon tahu yang harus diperbaiki. ${NOTE_HINT}`, { tone: 'error' });
      return;
    }
    setReviewing(id);
    try {
      await postAction(`/api/submissions/${id}/kta-review`, { decision, note: decision === 'reject' ? rejectNote.trim() : '' });
      setRejectFor(null);
      setRejectNote('');
      load();
    } catch (err) {
      notify(err.message || 'Gagal menyimpan verifikasi KTA.', { tone: 'error' });
    } finally {
      setReviewing(null);
    }
  };

  const stageCounts = useMemo(() => {
    const map = {};
    submissions.forEach((s) => {
      const key = s.status === 'Perlu Revisi' ? 'Menunggu Verifikasi' : s.status;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [submissions]);

  const sectionCount = (sec) => submissions.filter((s) => sec.statuses.includes(s.status)).length;
  // Tahap 'Berkas Diterima' (alur lama lewat sekretariat) hanya ditampilkan bila masih ada datanya
  const hasLegacy = submissions.some((s) => s.status === 'Berkas Diterima');
  const sections = hasLegacy ? SECTIONS : SECTIONS.filter((sec) => sec.key !== 'pusat');
  const tiles = hasLegacy ? TILES : TILES.filter((t) => t.key !== 'Berkas Diterima');
  const activeSection = sections.find((s) => s.key === section) || sections[0];
  const q = search.trim().toLowerCase();
  const list = submissions
    .filter((s) => activeSection.statuses.includes(s.status))
    .filter((s) => !q || `${s.publisher_name} ${s.applicant_name} ${s.physical_tracking_no || ''} ${s.central_tracking_no || ''} ${s.member_kta || ''}`.toLowerCase().includes(q));

  const notShipped = submissions.filter((s) => s.status === 'Pengiriman Berkas').length;
  const waitingKta = submissions.filter((s) => s.status === 'Dikirim ke Pusat');
  const overdueKta = waitingKta.filter((s) => (daysSince(s.sent_to_central_at) ?? 0) > 30).length;
  const totalActive = stageCounts.Aktif || 0;
  const ktaToReview = waitingKta.filter((s) => s.kta_review_status === 'Menunggu').length;
  const needAction = ktaToReview;

  const rowInfo = (s) => {
    if (s.status === 'Pengiriman Berkas') {
      return { badge: 'Pemohon belum kirim ke Pusat', tone: 'bg-amber-50 text-amber-800 border-amber-200',
        meta: [{ icon: CalendarDays, text: `Disetujui Ketua ${formatDate(s.approved_at)}` }] };
    }
    if (s.status === 'Berkas Diterima') {
      return { badge: 'Di sekretariat · siap dikirim', tone: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        meta: [
          { icon: CalendarDays, text: `Diterima ${formatDate(s.physical_received_at)}` },
          s.physical_received_by && { icon: User, text: `oleh ${s.physical_received_by}` },
        ] };
    }
    if (s.status === 'Dikirim ke Pusat') {
      const days = daysSince(s.sent_to_central_at);
      const meta = [{ icon: CalendarDays, text: `Berkas dikirim ${formatDate(s.sent_to_central_at)}` }];
      if (s.kta_review_status === 'Menunggu') {
        return { badge: 'KTA perlu diverifikasi', tone: 'bg-sky-50 text-[#0884c4] border-sky-200',
          meta: [...meta, s.kta_confirmed_at && { icon: HelpCircle, text: `KTA diisi ${formatDate(s.kta_confirmed_at)}` }] };
      }
      if (s.kta_review_status === 'Ditolak') {
        return { badge: 'Ditolak · menunggu perbaikan', tone: 'bg-red-50 text-red-700 border-red-200',
          meta: [...meta, s.kta_reviewed_at && { icon: XCircle, text: `Ditolak ${formatDate(s.kta_reviewed_at)}` }] };
      }
      return { badge: `Menunggu pemohon isi KTA${days !== null ? ` · ${days} hari` : ''}`, overdue: days > 30,
        tone: days > 30 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-violet-50 text-violet-700 border-violet-200',
        meta };
    }
    return { badge: s.member_kta ? `KTA ${s.member_kta}` : 'Aktif', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      meta: [
        { icon: CalendarDays, text: `Aktif ${formatDate(s.activated_at)}` },
        s.sent_to_central_at && { icon: Send, text: `Dikirim ke Pusat ${formatDate(s.sent_to_central_at)}` },
        s.kta_issued_at && { icon: BadgeCheck, text: `KTA terbit ${formatDate(s.kta_issued_at)}` },
      ] };
  };

  // Posisi pengajuan di 4 tahap fisik (0..3) untuk progres kecil di kartu
  const physicalStage = (s) => {
    const i = sections.findIndex((sec) => sec.statuses.includes(s.status));
    return i < 0 ? sections.length - 1 : i;
  };

  const actionFor = (s) => {
    if (user?.role !== 'Admin') return { label: 'Lihat', icon: Eye, primary: false };
    return { label: 'Lihat riwayat', icon: Clock, primary: false };
  };

  const modalRole = user?.role === 'Admin' && ['Pengiriman Berkas', 'Dikirim ke Pusat'].includes(detail?.submission?.status) ? 'Admin' : 'Pengamat';

  const kpis = [
    { label: 'Perlu tindakan Admin', value: needAction, note: `${ktaToReview} verifikasi KTA`, icon: AlertTriangle },
    { label: 'Tahap Input KTA', value: waitingKta.length, note: overdueKta ? `${overdueKta} lewat 30 hari` : 'Semua dalam batas wajar', icon: HelpCircle },
    { label: 'Anggota aktif', value: totalActive, note: 'KTA diverifikasi Admin', icon: BadgeCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Hero ringkasan */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#075985] via-[#0884c4] to-[#0da2e7] text-white p-5 sm:p-7 shadow-[0_20px_40px_-20px_rgba(8,132,196,0.7)]">
        <div className="pointer-events-none absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25 flex-shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-light tracking-tight">Monitoring Berkas Fisik</h2>
            </div>
          </div>
          <button onClick={load}
            className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/30 text-xs font-semibold flex items-center gap-1.5 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
          </button>
        </div>

        <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-[#0884c4] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-sky-100">{k.label}</p>
                  <p className="text-2xl font-semibold leading-tight">{k.value}</p>
                  <p className="text-[11px] text-sky-100/90 truncate">{k.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alur semua tahap */}
      <div className="card-surface overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="text-base font-medium text-slate-800">Alur pendaftaran</h3>
        </div>
        <div className="-mx-5 sm:mx-0 px-5 sm:px-0 overflow-x-auto pb-1">
          <div className={`min-w-[760px] grid ${hasLegacy ? 'grid-cols-9' : 'grid-cols-8'}`}>
            {tiles.map((step, i) => {
              const n = stageCounts[step.key] || 0;
              const Icon = step.icon;
              const physical = i >= PHYSICAL_FROM;
              const has = n > 0;
              return (
                <button
                  key={step.key}
                  onClick={() => onOpenScreening?.(step.key)}
                  className={`group relative flex flex-col items-center text-center px-1 pt-3 pb-3 ${physical ? 'bg-sky-50/70' : ''} ${i === PHYSICAL_FROM ? 'rounded-l-2xl' : ''} ${i === tiles.length - 1 ? 'rounded-r-2xl' : ''}`}
                  title={`Buka daftar: ${STATUS_LABEL[step.key] || step.label}`}
                >
                  {i < tiles.length - 1 && (
                    <span className={`absolute top-[34px] left-1/2 w-full h-0.5 ${has ? 'bg-[#0da2e7]/60' : 'bg-slate-200'}`} />
                  )}
                  <span className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center transition group-hover:scale-110 ${
                    has ? 'bg-[#0da2e7] text-white shadow-md shadow-sky-200' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>
                    <Icon className="w-5 h-5" />
                    {has && (
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">{n}</span>
                    )}
                  </span>
                  <span className={`mt-2 text-[11px] leading-tight font-medium ${has ? 'text-slate-800' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Tahap {i + 1}</span>
                </button>
              );
            })}
          </div>
          <div className={`min-w-[760px] grid ${hasLegacy ? 'grid-cols-9' : 'grid-cols-8'} mt-2 text-[10px] uppercase tracking-wider font-semibold`}>
            <span className="col-span-5 text-slate-400 text-center border-t border-dashed border-slate-200 pt-1.5">Verifikasi & tanda tangan</span>
            <span className={`${hasLegacy ? 'col-span-4' : 'col-span-3'} text-[#0884c4] text-center border-t border-dashed border-sky-300 pt-1.5`}>Berkas fisik & IKAPI Pusat</span>
          </div>
        </div>
      </div>

      {/* Berkas fisik -> IKAPI Pusat -> KTA */}
      <div className="card-surface overflow-hidden">
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium text-slate-800">Berkas Fisik & Pengiriman ke IKAPI Pusat</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {notShipped} belum klik Lanjutkan · {ktaToReview} data KTA perlu diverifikasi
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari penerbit / pemohon / KTA"
                className="w-full text-sm pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-[#0da2e7]" />
            </div>
          </div>

          {/* Tahap fisik sebagai kartu pilihan */}
          <div className={`grid grid-cols-2 ${hasLegacy ? 'lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
            {sections.map((sec, i) => {
              const Icon = sec.icon;
              const active = section === sec.key;
              const n = sectionCount(sec);
              return (
                <button key={sec.key} onClick={() => setSection(sec.key)}
                  className={`relative text-left rounded-2xl border p-4 transition ${active ? sec.tone.active : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${sec.tone.icon}`}>
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                    {i < sections.length - 1 && <ChevronRight className="hidden lg:block w-4 h-4 text-slate-300" />}
                  </div>
                  <p className="mt-3 text-3xl font-light text-slate-900 leading-none">{n}</p>
                  <p className={`mt-1.5 text-sm font-semibold ${active ? sec.tone.text : 'text-slate-700'}`}>{sec.short}</p>
                  <p className="hidden sm:block text-[11px] text-slate-500 leading-snug mt-0.5">{sec.hint}</p>
                  {active && <span className={`absolute left-4 right-4 bottom-0 h-1 rounded-t-full ${sec.tone.bar}`} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-6">
          {list.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeSection.tone.icon}`}>
                {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Inbox className="w-6 h-6" />}
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">{loading ? 'Memuat data...' : q ? 'Tidak ada hasil pencarian.' : activeSection.empty}</p>
              {!loading && <p className="text-xs text-slate-400 mt-1">{activeSection.label}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {list.map((s) => {
                const info = rowInfo(s);
                const action = actionFor(s);
                const Icon = action.icon;
                const stage = physicalStage(s);
                return (
                  <div key={s.id}
                    className={`rounded-2xl bg-white border p-4 flex flex-col gap-3 transition hover:shadow-md ${info.overdue ? 'border-red-200' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${activeSection.tone.icon}`}>
                        {initials(s.publisher_name || s.applicant_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{s.publisher_name || '-'}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {[s.applicant_name, s.submission_type === 'Heregistrasi' ? 'Registrasi' : 'Anggota Baru'].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold whitespace-nowrap ${info.tone}`}>{info.badge}</span>
                    </div>

                    {/* Progres 4 tahap fisik */}
                    <div className="flex items-center gap-1.5" title={sections[stage].label}>
                      {sections.map((sec, i) => (
                        <span key={sec.key} className={`h-1.5 flex-1 rounded-full ${i <= stage ? sec.tone.bar : 'bg-slate-200'}`} />
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {s.reference_number && (
                        <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5 text-slate-400" />{s.reference_number}</span>
                      )}
                      {info.meta.filter(Boolean).map((m) => {
                        const MIcon = m.icon;
                        return <span key={m.text} className="flex items-center gap-1"><MIcon className="w-3.5 h-3.5 text-slate-400" />{m.text}</span>;
                      })}
                      {s.kta_proof_file && (
                        <a href={fileUrl(s.kta_proof_file)} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[#0884c4] hover:underline">
                          <Eye className="w-3.5 h-3.5" />Bukti KTA dari pemohon
                        </a>
                      )}
                    </div>

                    {s.status === 'Dikirim ke Pusat' && s.kta_review_status && (
                      <div className={`rounded-xl border p-3 text-xs space-y-2 ${s.kta_review_status === 'Ditolak' ? 'border-red-200 bg-red-50/60' : 'border-sky-200 bg-sky-50/60'}`}>
                        <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
                          <span className="text-slate-500">No. KTA</span>
                          <span className="font-mono font-semibold text-slate-900 break-all">{s.kta_number_submitted || '-'}</span>
                          <span className="text-slate-500">Tgl terbit</span>
                          <span className="text-slate-800">{formatDate(s.kta_issued_at)}</span>
                          {s.kta_notes && <><span className="text-slate-500">Catatan</span><span className="text-slate-800">{s.kta_notes}</span></>}
                          {s.kta_review_status === 'Ditolak' && s.kta_review_note && (
                            <><span className="text-red-600">Alasan tolak</span><span className="text-red-700">{s.kta_review_note}</span></>
                          )}
                        </div>
                        {user?.role === 'Admin' && s.kta_review_status === 'Menunggu' && (
                          rejectFor === s.id ? (
                            <div className="space-y-2 pt-1">
                              <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={2} autoFocus
                                placeholder="Alasan penolakan, mis. nomor tidak sesuai foto KTA"
                                className="w-full text-xs px-3 py-2 border border-red-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-100" />
                              <div className="flex gap-2 justify-end">
                                <button type="button" onClick={() => { setRejectFor(null); setRejectNote(''); }}
                                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold">Batal</button>
                                <button type="button" disabled={reviewing === s.id} onClick={() => handleKtaReview(s.id, 'reject')}
                                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50">
                                  {reviewing === s.id ? 'Menyimpan...' : 'Tolak & minta perbaikan'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end pt-1">
                              <button type="button" onClick={() => { setRejectFor(s.id); setRejectNote(''); }}
                                className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 font-semibold flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> Tolak
                              </button>
                              <button type="button" disabled={reviewing === s.id} onClick={() => handleKtaReview(s.id, 'approve')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 disabled:opacity-50">
                                <CheckCircle className="w-3.5 h-3.5" /> {reviewing === s.id ? 'Menyimpan...' : 'Data benar · aktifkan'}
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <button onClick={() => openDetail(s.id)}
                      className={`mt-auto w-full sm:w-auto sm:self-end px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        action.primary ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <Icon className="w-4 h-4" /> {action.label}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {detail && (
        <DocumentVerificationModal
          isOpen
          onClose={() => setDetail(null)}
          submission={detail.submission}
          documents={detail.documents}
          payment={detail.payment}
          timeline={detail.timeline}
          role={modalRole}
        />
      )}
    </div>
  );
}
