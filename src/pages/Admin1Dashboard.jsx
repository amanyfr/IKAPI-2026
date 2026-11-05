import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { exportMembersExcel } from '../utils/exportMembers';
import { STATUS_LABEL } from '../components/StatusStepper';
import {
  parseDate, submittedDate, timeAgo, initials, pct, greetingName,
  buildTrend, TrendChart, TrendLegend, PositionBubbles, RangeToggle
} from '../components/DashboardWidgets';
import {
  ArrowUpRight, ShieldCheck, Users, Download, KeyRound, Search, Sparkles,
  FileStack, Send, BadgeCheck, RefreshCw, ChevronDown, Lightbulb
} from 'lucide-react';
import { notify } from '../components/AppDialog';

/* ── Helper data ── */
// Antrean sebelum Ketua: TTD Sekretaris + tahap yang dikerjakan Admin (dipantau Sekretaris)
const ADMIN1_QUEUE = ['Menunggu TTD Sekretaris', 'Menunggu Verifikasi', 'Perlu Revisi', 'Menunggu Pembayaran'];
const AT_ADMIN2    = ['Menunggu Approval'];
const FINISHED     = ['Pengiriman Berkas', 'Aktif', 'Ditolak'];

const STATUS_CHIP = {
  'Menunggu TTD Sekretaris': 'bg-indigo-600 text-white',
  'Menunggu Verifikasi': 'bg-[#0da2e7] text-white',
  'Perlu Revisi':        'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  'Menunggu Pembayaran': 'bg-white text-slate-700 ring-1 ring-slate-200',
};

const TREND_SERIES = [
  { key: 'baru',  label: 'Anggota Baru', color: '#0da2e7', tipClass: 'text-sky-300',
    dateOf: submittedDate, filter: (s) => s.submission_type === 'Baru' },
  { key: 'hereg', label: 'Heregistrasi', color: '#a78bfa', tipClass: 'text-violet-300',
    dateOf: submittedDate, filter: (s) => s.submission_type === 'Heregistrasi' },
];

export default function Admin1Dashboard({ onOpenScreening, onOpenMembers }) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('12m');
  const [sortOrder, setSortOrder] = useState('newest');
  const [queueFilter, setQueueFilter] = useState('Semua');
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
  const total = submissions.length;
  const needScreening = count(['Menunggu TTD Sekretaris']);
  const needRevision  = count(['Perlu Revisi']);
  const needPayment   = count(['Menunggu Pembayaran']);
  // Anggota yang sudah aktif tapi nomor KTA-nya belum dicatat di Data Anggota
  const needKta       = submissions.filter((s) => s.status === 'Aktif' && !s.member_kta).length;
  const atAdmin1      = count(ADMIN1_QUEUE);
  const atAdmin2      = count(AT_ADMIN2);
  const finished      = count(FINISHED);
  const activeMembers = count(['Aktif']);

  const trend = useMemo(() => buildTrend(submissions, range, TREND_SERIES), [submissions, range]);

  const queue = useMemo(() => {
    const list = submissions.filter((s) =>
      queueFilter === 'Semua' ? ADMIN1_QUEUE.includes(s.status) : s.status === queueFilter
    );
    return list.sort((a, b) => {
      const diff = (parseDate(b.updated_at) || 0) - (parseDate(a.updated_at) || 0);
      return sortOrder === 'newest' ? diff : -diff;
    });
  }, [submissions, queueFilter, sortOrder]);

  const { first: firstName, rest: restName } = greetingName(user?.name);

  const handleExport = async () => {
    try { await exportMembersExcel(); } catch (err) { notify('Ekspor Excel gagal: ' + err.message); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    onOpenScreening({ search: search.trim() });
  };

  // Satu filter untuk antrian (menggantikan widget "Ringkasan" terpisah)
  const FILTERS = [
    { key: 'Menunggu TTD Sekretaris', label: 'Perlu keputusan Anda', value: needScreening, dot: 'bg-[#0da2e7]' },
    { key: 'Menunggu Verifikasi', label: 'Screening Admin', value: count(['Menunggu Verifikasi']), dot: 'bg-sky-300' },
    { key: 'Perlu Revisi', label: 'Revisi', value: needRevision, dot: 'bg-amber-400' },
    { key: 'Menunggu Pembayaran', label: 'Pembayaran', value: needPayment, dot: 'bg-slate-400' },
    { key: 'Semua', label: 'Semua', value: atAdmin1, dot: 'bg-slate-300' },
  ];

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">

      {/* ══ Sapaan + angka utama (satu baris) ══ */}
      <section className="flex-shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-slate-900 truncate">
            Selamat datang, <span className="text-[#0884c4]">{firstName}</span>
            {restName && <span className="text-slate-400"> {restName}</span>}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {needScreening > 0 ? `${needScreening} pengajuan menunggu persetujuan & tanda tangan Anda` : 'Tidak ada pengajuan yang menunggu tanda tangan Anda'}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-8">
          {[
            { value: total,         label: 'Total pengajuan',     icon: FileStack,  tone: 'bg-sky-100 text-[#0884c4]' },
            { value: atAdmin2,      label: 'Diteruskan ke Ketua', icon: Send,       tone: 'bg-violet-100 text-violet-700' },
            { value: activeMembers, label: 'Anggota aktif',       icon: BadgeCheck, tone: 'bg-emerald-100 text-emerald-700' },
          ].map(({ value, label, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-2.5">
              <span className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center ring-4 ring-white/70 ${tone}`}>
                <Icon className="w-4 h-4" />
              </span>
              <div className="leading-tight">
                <span className="text-2xl sm:text-3xl font-light text-slate-900 tabular-nums">{loading ? '–' : value}</span>
                <p className="text-[11px] text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Widget utama: antrian + prioritas ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:flex-[6] lg:min-h-0">
        <div className="card-surface p-4 sm:p-5 lg:col-span-9 flex flex-col min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
            <h2 className="text-lg text-slate-800 whitespace-nowrap">Antrian pengajuan</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setQueueFilter(f.key)}
                  className={`flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full text-xs border transition ${
                    queueFilter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-white'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />
                  {f.label}
                  <span className={`min-w-[1.5rem] text-center rounded-full px-1.5 py-0.5 font-semibold ${queueFilter === f.key ? 'bg-white/20' : 'bg-slate-900/5'}`}>{f.value}</span>
                </button>
              ))}
              <button onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                className="px-3 py-1 rounded-full text-xs border bg-slate-50 text-slate-600 border-slate-200/70 hover:bg-white">
                {sortOrder === 'newest' ? 'Terbaru' : 'Terlama'}
              </button>
              <button onClick={fetchSubmissions} title="Segarkan data"
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-[#0da2e7] transition">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 py-8">
              {loading ? 'Memuat antrian...' : 'Tidak ada pengajuan di antrian ini.'}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 snap-x">
              {queue.map((s) => (
                <button key={s.id}
                  onClick={() => onOpenScreening(s.status === 'Menunggu TTD Sekretaris' ? { status: s.status } : { search: s.publisher_name || '' })}
                  className="snap-start flex-shrink-0 w-60 text-left rounded-2xl bg-slate-50 hover:bg-white border border-slate-200/70 p-4 [@media(max-height:780px)]:p-3 flex flex-col transition">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${STATUS_CHIP[s.status] || 'bg-slate-100 text-slate-700'}`}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                    <span className="text-right text-[11px] text-slate-500 leading-tight">
                      PGJ-{String(s.id).padStart(4, '0')}<br />{timeAgo(s.updated_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium mt-3 [@media(max-height:780px)]:mt-2 truncate">{s.publisher_name || '-'}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate [@media(max-height:780px)]:hidden">
                    {s.submission_type} · {s.member_category} · {s.city || '-'}
                  </p>
                  <div className="flex items-center gap-2.5 mt-auto pt-3 [@media(max-height:780px)]:pt-2 border-t border-slate-900/5">
                    <span className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white text-xs font-semibold flex items-center justify-center">
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

        {/* Kartu prioritas */}
        <div className="lg:col-span-3 rounded-3xl p-5 text-white bg-gradient-to-br from-[#0da2e7] via-[#0884c4] to-blue-700 shadow-xl shadow-sky-700/25 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-start justify-between">
            <h2 className="text-lg">Prioritas hari ini</h2>
            <button onClick={() => onOpenScreening({ status: 'Menunggu TTD Sekretaris' })} title="Buka antrean tanda tangan"
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-white/85 mt-2 leading-relaxed [@media(max-height:780px)]:hidden">
            Lihat semua dokumen & bukti transfer yang sudah disetujui Admin, lalu putuskan: setujui & tanda tangani, atau tolak.
          </p>
          <div className="mt-auto pt-4 space-y-2">
            <button onClick={() => onOpenScreening({ status: 'Menunggu TTD Sekretaris' })}
              className="w-full flex items-center justify-between gap-3 text-left bg-white text-slate-800 rounded-2xl px-4 py-3 [@media(max-height:780px)]:py-2 shadow-lg hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Persetujuan & TTD</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{needScreening}</span>
            </button>
            <button onClick={onOpenMembers}
              className="w-full flex items-center justify-between gap-3 text-left bg-sky-100/90 text-slate-800 rounded-2xl px-4 py-3 [@media(max-height:780px)]:py-2 shadow-md hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Input No. KTA</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{needKta}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ══ Baris bawah: grafik, posisi, aksi cepat ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:flex-[4] lg:min-h-0">
        <div className="card-surface p-4 sm:p-5 lg:col-span-6 flex flex-col min-h-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div>
              <h2 className="text-base text-slate-800">Tren pengajuan masuk</h2>
              <TrendLegend series={TREND_SERIES} />
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>
          <div className="flex-1 min-h-0 h-44 lg:h-auto">
            <TrendChart data={trend} series={TREND_SERIES} fill ariaLabel="Grafik tren pengajuan masuk" />
          </div>
        </div>

        <div className="card-surface p-4 sm:p-5 lg:col-span-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-base text-slate-800">Posisi pengajuan</h2>
            <button onClick={() => onOpenScreening({})} title="Lihat semua pengajuan"
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-white border border-slate-200/70 flex items-center justify-center text-slate-600 transition">
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <PositionBubbles compact total={total} items={[
            { label: 'Selesai',    value: finished, cls: 'text-slate-700 ring-1 ring-slate-300 bg-slate-50 bg-[repeating-linear-gradient(135deg,rgba(15,23,42,0.07)_0_2px,transparent_2px_7px)]', pos: 'right-3 top-0' },
            { label: 'Admin & Sekre', value: atAdmin1, cls: 'bg-[#0da2e7] text-white shadow-lg shadow-sky-500/30', pos: 'left-0 top-4' },
            { label: 'Di Ketua', value: atAdmin2, cls: 'bg-blue-700 text-white shadow-lg shadow-blue-700/30', pos: 'right-0 bottom-0' },
          ]} />
        </div>

        <div className="card-surface p-4 sm:p-5 lg:col-span-3 flex flex-col min-h-0">
          <p className="text-base text-slate-800 [@media(max-height:780px)]:hidden">Halo, {firstName} 👋</p>
          <div className="grid grid-cols-2 gap-2 mt-3 [@media(max-height:780px)]:mt-0">
            {[
              { label: 'Tanda tangan', icon: ShieldCheck, tone: 'bg-sky-100 text-[#0884c4]',       onClick: () => onOpenScreening({ status: 'Menunggu TTD Sekretaris' }) },
              { label: 'Data anggota', icon: Users,       tone: 'bg-violet-100 text-violet-700',   onClick: onOpenMembers },
              { label: 'Ekspor Excel', icon: Download,    tone: 'bg-emerald-100 text-emerald-700', onClick: handleExport },
              { label: 'No. KTA',      icon: KeyRound,    tone: 'bg-amber-100 text-amber-700',     onClick: onOpenMembers },
            ].map(({ label, icon: Icon, tone, onClick }) => (
              <button key={label} onClick={onClick}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200/70 text-xs text-slate-700 transition text-left">
                <span className={`w-6 h-6 flex-shrink-0 rounded-lg flex items-center justify-center ${tone}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="relative mt-auto pt-3">
            <Search className="w-4 h-4 absolute left-3.5 bottom-3 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari penerbit atau kota..."
              className="w-full pl-9 pr-10 py-2.5 text-xs rounded-full bg-slate-50 border border-white/90 placeholder:text-slate-400 focus:ring-2 focus:ring-[#0da2e7]/30 outline-none" />
            <button type="submit" aria-label="Cari" className="absolute right-3 bottom-2 p-1 text-[#0da2e7] hover:text-[#0884c4]">
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
