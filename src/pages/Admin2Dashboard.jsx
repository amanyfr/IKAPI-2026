import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  parseDate, submittedDate, timeAgo, initials, pct,
  buildTrend, TrendChart, TrendLegend, PositionBubbles, RangeToggle
} from '../components/DashboardWidgets';
import {
  ArrowUpRight, PenTool, FileCheck2, Wallet, RefreshCw, ChevronDown, Lightbulb,
  Award, Activity, Users, Search, Sparkles
} from 'lucide-react';

/* ── Kelompok status dari sudut pandang Ketua ── */
const AT_ADMIN1 = ['Draf', 'Menunggu Pembayaran', 'Menunggu Verifikasi', 'Perlu Revisi'];
const PENDING   = ['Menunggu Approval'];
const SIGNED    = ['Aktif'];
const REJECTED  = ['Ditolak'];

const STATUS_CHIP = {
  'Menunggu Approval': 'bg-indigo-600 text-white',
  'Aktif':             'bg-emerald-600 text-white',
  'Ditolak':           'bg-red-100 text-red-800 ring-1 ring-red-200',
};

const TREND_SERIES = [
  { key: 'masuk',    label: 'Pengajuan masuk', color: '#0da2e7', tipClass: 'text-sky-300',     dateOf: submittedDate },
  { key: 'disetujui', label: 'Disetujui',      color: '#10b981', tipClass: 'text-emerald-300', dateOf: (s) => parseDate(s.approved_at) },
];

const formatJuta = (n) => (n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 });

export default function Admin2Dashboard({ onOpenApproval, onOpenMembers }) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('12m');
  const [queueFilter, setQueueFilter] = useState('Menunggu Approval');
  const [search, setSearch] = useState('');

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/submissions', {
        headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` }
      });
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubmissions(); }, []);

  const count = (statuses) => submissions.filter((s) => statuses.includes(s.status)).length;
  const total     = submissions.length;
  const atAdmin1  = count(AT_ADMIN1);
  const pending   = count(PENDING);
  const signed    = count(SIGNED);
  const rejected  = count(REJECTED);
  const iuran = submissions
    .filter((s) => s.payment_status === 'Valid')
    .reduce((sum, s) => sum + (s.payment_amount || 0), 0);

  const trend = useMemo(() => buildTrend(submissions, range, TREND_SERIES), [submissions, range]);

  const queue = useMemo(() => {
    const list = submissions.filter((s) =>
      queueFilter === 'Semua' ? [...PENDING, ...SIGNED, ...REJECTED].includes(s.status) : s.status === queueFilter
    );
    // Yang paling lama menunggu tampil duluan agar tidak terlewat
    return list.sort((a, b) => (parseDate(a.updated_at) || 0) - (parseDate(b.updated_at) || 0));
  }, [submissions, queueFilter]);

  const displayName = (user?.name || '').split(',')[0];

  const distribution = [
    { label: 'Di Sekretaris',         value: atAdmin1, cls: 'bg-white text-slate-800 ring-1 ring-slate-200' },
    { label: 'Menunggu Anda',      value: pending,  cls: 'bg-indigo-600 text-white' },
    { label: 'Anggota aktif',      value: signed,   cls: 'bg-emerald-500 text-white' },
    { label: 'Ditolak',            value: rejected, cls: 'text-slate-700 ring-1 ring-slate-300/70 bg-[repeating-linear-gradient(135deg,rgba(15,23,42,0.08)_0_2px,transparent_2px_8px)]' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    onOpenApproval({ search: search.trim() });
  };

  return (
    <div className="space-y-6">

      {/* ══ Sapaan + sebaran posisi + angka utama ══ */}
      <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-slate-900">
            Selamat datang, <span className="text-indigo-700">{displayName}</span>
          </h1>

          <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:flex sm:gap-2 mt-6 max-w-2xl">
            {distribution.map((d) => (
              <div key={d.label} className="min-w-0" style={{ flexGrow: Math.max(pct(d.value, total), 12), flexBasis: 0 }}>
                <p className="text-xs text-slate-500 mb-2 truncate">{d.label}</p>
                <div className={`h-11 rounded-full flex items-center px-4 text-sm font-medium ${d.cls}`}>
                  {pct(d.value, total)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-12">
          {[
            { value: pending, label: 'Menunggu keputusan',  icon: PenTool,    tone: 'bg-indigo-100 text-indigo-700' },
            { value: signed,  label: 'Surat ditandatangani', icon: FileCheck2, tone: 'bg-emerald-100 text-emerald-700' },
            { value: formatJuta(iuran), prefix: 'Rp', suffix: 'jt', label: 'Iuran terverifikasi', icon: Wallet, tone: 'bg-sky-100 text-[#0884c4]' },
          ].map(({ value, prefix, suffix, label, icon: Icon, tone }) => (
            <div key={label}>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className={`w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0 rounded-full flex items-center justify-center ring-4 ring-white/70 ${tone}`}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
                <span className="text-3xl sm:text-5xl font-light text-slate-900 tabular-nums whitespace-nowrap">
                  {prefix && <span className="text-base sm:text-xl text-slate-500 mr-0.5">{prefix}</span>}
                  {loading ? '–' : value}
                  {suffix && <span className="text-base sm:text-xl text-slate-500 ml-0.5">{suffix}</span>}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Baris 2: keputusan, grafik, tanda tangan ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Ringkasan keputusan */}
        <div className="card-surface p-5 lg:col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-slate-800">Keputusan</h2>
            <button onClick={fetchSubmissions} title="Segarkan data"
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Menunggu approval', value: pending,     dot: 'bg-indigo-600',  open: () => onOpenApproval() },
              { label: 'Anggota aktif',     value: signed,      dot: 'bg-emerald-500', open: () => onOpenApproval({ status: 'Aktif' }) },
              { label: 'Ditolak',           value: rejected,    dot: 'bg-red-500',     open: () => onOpenApproval({ status: 'Ditolak' }) },
            ].map((r) => (
              <button key={r.label} onClick={r.open}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200/70 transition text-left">
                <span className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${r.dot}`} /> {r.label}
                </span>
                <span className="min-w-[2rem] text-center text-sm font-semibold text-slate-800 bg-slate-900/5 rounded-full px-2.5 py-0.5">
                  {r.value}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-auto pt-5 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
            <Lightbulb className="w-4 h-4 flex-shrink-0 text-amber-500" />
            <span>
              <strong className="text-slate-700">{signed} pemohon</strong> sudah ditandatangani Ketua & Sekretaris dan otomatis menjadi anggota aktif.
            </span>
          </p>
        </div>

        {/* Grafik masuk vs disetujui */}
        <div className="card-surface p-5 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <h2 className="text-lg text-slate-800">Pengajuan masuk vs disetujui</h2>
              <TrendLegend series={TREND_SERIES} />
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>
          <TrendChart data={trend} series={TREND_SERIES} ariaLabel="Grafik pengajuan masuk dan disetujui" />
        </div>

        {/* Kartu tanda tangan (biru-ungu) */}
        <div className="lg:col-span-3 rounded-3xl p-5 text-white bg-gradient-to-br from-[#0da2e7] via-blue-600 to-indigo-700 shadow-xl shadow-indigo-700/25 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between">
            <h2 className="text-lg">Perlu tanda tangan</h2>
            <button onClick={() => onOpenApproval()} title="Buka antrian approval"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-white/85 mt-3 leading-relaxed">
            Tinjau berkas yang lolos screening Sekretaris, lalu setujui & bubuhkan TTD Ketua dan Sekretaris.
          </p>
          <div className="relative mt-auto pt-8 pb-2">
            <button onClick={() => onOpenApproval()}
              className="relative z-10 w-full flex items-center justify-between gap-3 text-left bg-white text-slate-800 rounded-2xl px-4 py-3.5 shadow-lg hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Approval & TTD</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{pending}</span>
            </button>
            <button onClick={() => onOpenApproval({ status: 'Aktif' })}
              className="relative w-full mt-2 flex items-center justify-between gap-3 text-left bg-indigo-100/90 text-slate-800 rounded-2xl px-4 py-3.5 shadow-md hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Anggota aktif</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{signed}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ══ Baris 3: antrian keputusan, posisi, aksi cepat ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Antrian keputusan */}
        <div className="card-surface p-5 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg text-slate-800">Antrian keputusan</h2>
            <div className="relative">
              <select aria-label="Filter status" value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)}
                className="appearance-none text-xs pl-4 pr-8 py-2 rounded-full bg-slate-50 border border-slate-200/70 text-slate-700 focus:ring-2 focus:ring-indigo-300 outline-none">
                <option value="Menunggu Approval">Menunggu approval</option>
                <option value="Aktif">Disetujui (aktif)</option>
                <option value="Ditolak">Ditolak</option>
                <option value="Semua">Semua keputusan</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {queue.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">
              {loading ? 'Memuat antrian...' : 'Tidak ada pengajuan di antrian ini.'}
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {queue.map((s) => (
                <button key={s.id}
                  onClick={() => (s.status === 'Menunggu Approval' ? onOpenApproval() : onOpenApproval({ search: s.publisher_name || '' }))}
                  className="snap-start flex-shrink-0 w-64 text-left rounded-2xl bg-slate-50 hover:bg-white border border-slate-200/70 p-4 flex flex-col transition">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${STATUS_CHIP[s.status] || 'bg-slate-100 text-slate-700'}`}>
                      {s.status}
                    </span>
                    <span className="text-right text-[11px] text-slate-500 leading-tight">{timeAgo(s.updated_at)}</span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium mt-4">{s.publisher_name || '-'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {s.submission_type} · {s.member_category} · {s.city || '-'}
                  </p>
                  <p className="text-[11px] font-mono text-indigo-700 mt-2 truncate">
                    {s.reference_number || 'No. surat belum terbit'}
                  </p>
                  {s.status === 'Ditolak' && s.rejection_reason && (
                    <p className="text-[11px] text-red-700 mt-1 line-clamp-2">Alasan: {s.rejection_reason}</p>
                  )}
                  <div className="flex items-center gap-2.5 mt-4 pt-4 border-t border-slate-900/5">
                    <span className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                      {initials(s.applicant_name)}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block text-sm text-slate-800 truncate">{s.applicant_name}</span>
                      <span className="block text-[11px] text-slate-500 truncate">{s.applicant_email}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Posisi pengajuan */}
        <div className="card-surface p-5 lg:col-span-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-lg text-slate-800">Posisi pengajuan</h2>
            <button onClick={() => onOpenApproval({ scroll: true })} title="Lihat monitoring semua pengajuan"
              className="w-10 h-10 rounded-full bg-slate-50 hover:bg-white border border-slate-200/70 flex items-center justify-center text-slate-600 transition">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <PositionBubbles total={total} items={[
            { label: 'Diputuskan',    value: signed + rejected, cls: 'text-slate-700 ring-1 ring-slate-300 bg-slate-50 bg-[repeating-linear-gradient(135deg,rgba(15,23,42,0.07)_0_2px,transparent_2px_7px)]', pos: 'right-3 top-0' },
            { label: 'Di Sekretaris',    value: atAdmin1, cls: 'bg-[#0da2e7] text-white shadow-lg shadow-sky-500/30', pos: 'left-0 top-10' },
            { label: 'Menunggu Anda', value: pending,  cls: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30', pos: 'right-0 bottom-0' },
          ]} />
        </div>

        {/* Aksi cepat */}
        <div className="card-surface p-5 lg:col-span-4 flex flex-col">
          <p className="text-lg text-slate-800">Halo, {displayName} 👋</p>
          <p className="text-xl font-medium text-slate-900">Apa yang perlu diputuskan hari ini?</p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {[
              { label: 'Approval & TTD',    icon: Award,    tone: 'bg-indigo-100 text-indigo-700',   onClick: () => onOpenApproval() },
              { label: 'Monitoring',        icon: Activity, tone: 'bg-sky-100 text-[#0884c4]',       onClick: () => onOpenApproval({ scroll: true }) },
              { label: 'Direktori anggota', icon: Users,    tone: 'bg-violet-100 text-violet-700',   onClick: onOpenMembers },
              { label: 'Surat disetujui',   icon: FileCheck2, tone: 'bg-emerald-100 text-emerald-700', onClick: () => onOpenApproval({ status: 'Aktif', scroll: true }) },
            ].map(({ label, icon: Icon, tone, onClick }) => (
              <button key={label} onClick={onClick}
                className="flex items-center gap-2.5 px-3 py-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200/70 text-sm text-slate-700 transition text-left">
                <span className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center ${tone}`}>
                  <Icon className="w-4 h-4" />
                </span>
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="relative mt-auto pt-5">
            <Search className="w-4 h-4 absolute left-4 bottom-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari penerbit atau no. surat..."
              className="w-full pl-10 pr-11 py-3 text-sm rounded-full bg-slate-50 border border-white/90 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300 outline-none" />
            <button type="submit" aria-label="Cari" className="absolute right-3 bottom-2.5 p-1 text-indigo-600 hover:text-indigo-800">
              <Sparkles className="w-5 h-5" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
