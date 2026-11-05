import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { exportMembersExcel } from '../utils/exportMembers';
import {
  parseDate, submittedDate, timeAgo, initials, pct, greetingName,
  buildTrend, TrendChart, TrendLegend, PositionBubbles, RangeToggle
} from '../components/DashboardWidgets';
import {
  ArrowUpRight, ShieldCheck, Users, Download, KeyRound, Search, Sparkles,
  FileStack, Send, BadgeCheck, RefreshCw, ChevronDown, Lightbulb
} from 'lucide-react';

/* ── Helper data ── */
const ADMIN1_QUEUE = ['Menunggu Verifikasi', 'Perlu Revisi', 'Menunggu Pembayaran'];
const AT_ADMIN2    = ['Menunggu Approval'];
const FINISHED     = ['Aktif', 'Ditolak'];

const STATUS_CHIP = {
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
  const needScreening = count(['Menunggu Verifikasi']);
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

  const distribution = [
    { label: 'Perlu screening', value: needScreening, cls: 'bg-[#0da2e7] text-white' },
    { label: 'Perlu revisi',    value: needRevision,  cls: 'bg-white text-slate-800 ring-1 ring-slate-200' },
    { label: 'Menunggu bayar',  value: needPayment,   cls: 'bg-slate-700/10 text-slate-700 ring-1 ring-white/80' },
    { label: 'Lewat Sekretaris',   value: atAdmin2 + finished, cls: 'text-slate-700 ring-1 ring-slate-300/70 bg-[repeating-linear-gradient(135deg,rgba(15,23,42,0.08)_0_2px,transparent_2px_8px)]' },
  ];

  const handleExport = async () => {
    try { await exportMembersExcel(); } catch (err) { alert('Ekspor Excel gagal: ' + err.message); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    onOpenScreening({ search: search.trim() });
  };

  return (
    <div className="space-y-6">

      {/* ══ Sapaan + sebaran status + angka utama ══ */}
      <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-slate-900">
            Selamat datang, <span className="text-[#0884c4]">{firstName}</span>
            {restName && <span className="text-slate-400"> {restName}</span>}
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

        <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-12">
          {[
            { value: total,         label: 'Total pengajuan',     icon: FileStack,  tone: 'bg-sky-100 text-[#0884c4]' },
            { value: atAdmin2,      label: 'Diteruskan ke Ketua', icon: Send,     tone: 'bg-violet-100 text-violet-700' },
            { value: activeMembers, label: 'Anggota aktif',       icon: BadgeCheck, tone: 'bg-emerald-100 text-emerald-700' },
          ].map(({ value, label, icon: Icon, tone }) => (
            <div key={label}>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className={`w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0 rounded-full flex items-center justify-center ring-4 ring-white/70 ${tone}`}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
                <span className="text-4xl sm:text-5xl font-light text-slate-900 tabular-nums">{loading ? '–' : value}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Baris 2: ringkasan, grafik, prioritas ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Ringkasan antrian */}
        <div className="card-surface p-5 lg:col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-slate-800">Ringkasan</h2>
            <button onClick={fetchSubmissions} title="Segarkan data"
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-[#0da2e7] transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Perlu screening', value: needScreening, dot: 'bg-[#0da2e7]', status: 'Menunggu Verifikasi' },
              { label: 'Perlu revisi',    value: needRevision,  dot: 'bg-amber-400', status: 'Perlu Revisi' },
              { label: 'Menunggu bayar',  value: needPayment,   dot: 'bg-slate-400', status: 'Menunggu Pembayaran' },
            ].map((r) => (
              <button key={r.label} onClick={() => onOpenScreening({ status: r.status })}
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
              <strong className="text-slate-700">{atAdmin1} pengajuan</strong> masih di tahap Sekretaris.
              {needScreening > 0 && <> Mulai dari <strong className="text-slate-700">{needScreening} berkas</strong> yang menunggu screening.</>}
            </span>
          </p>
        </div>

        {/* Grafik tren pengajuan */}
        <div className="card-surface p-5 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <h2 className="text-lg text-slate-800">Tren pengajuan masuk</h2>
              <TrendLegend series={TREND_SERIES} />
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>
          <TrendChart data={trend} series={TREND_SERIES} ariaLabel="Grafik tren pengajuan masuk" />
        </div>

        {/* Kartu prioritas (biru) */}
        <div className="lg:col-span-3 rounded-3xl p-5 text-white bg-gradient-to-br from-[#0da2e7] via-[#0884c4] to-blue-700 shadow-xl shadow-sky-700/25 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between">
            <h2 className="text-lg">Prioritas hari ini</h2>
            <button onClick={() => onOpenScreening({ status: 'Menunggu Verifikasi' })} title="Buka antrian screening"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-white/85 mt-3 leading-relaxed">
            Periksa berkas & bukti transfer pemohon, lalu teruskan yang lengkap ke Ketua.
          </p>
          <div className="relative mt-auto pt-8 pb-2">
            <button onClick={() => onOpenScreening({ status: 'Menunggu Verifikasi' })}
              className="relative z-10 w-full flex items-center justify-between gap-3 text-left bg-white text-slate-800 rounded-2xl px-4 py-3.5 shadow-lg hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Screening berkas</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{needScreening}</span>
            </button>
            <button onClick={onOpenMembers}
              className="relative w-full mt-2 flex items-center justify-between gap-3 text-left bg-sky-100/90 text-slate-800 rounded-2xl px-4 py-3.5 shadow-md hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Input No. KTA</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{needKta}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ══ Baris 3: antrian, statistik, aksi cepat ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Antrian pengajuan */}
        <div className="card-surface p-5 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg text-slate-800">Antrian pengajuan</h2>
            <div className="flex gap-2">
              {[
                { value: sortOrder, set: setSortOrder, options: [['newest', 'Terbaru'], ['oldest', 'Terlama']], label: 'Urutkan' },
                { value: queueFilter, set: setQueueFilter, options: [['Semua', 'Semua'], ['Menunggu Verifikasi', 'Screening'], ['Perlu Revisi', 'Revisi'], ['Menunggu Pembayaran', 'Bayar']], label: 'Filter status' },
              ].map((sel) => (
                <div key={sel.label} className="relative">
                  <select aria-label={sel.label} value={sel.value} onChange={(e) => sel.set(e.target.value)}
                    className="appearance-none text-xs pl-4 pr-8 py-2 rounded-full bg-slate-50 border border-slate-200/70 text-slate-700 focus:ring-2 focus:ring-[#0da2e7]/30 outline-none">
                    {sel.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              ))}
            </div>
          </div>

          {queue.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">
              {loading ? 'Memuat antrian...' : 'Tidak ada pengajuan di antrian ini.'}
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {queue.map((s) => (
                <button key={s.id} onClick={() => onOpenScreening({ search: s.publisher_name || '' })}
                  className="snap-start flex-shrink-0 w-64 text-left rounded-2xl bg-slate-50 hover:bg-white border border-slate-200/70 p-4 flex flex-col transition">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${STATUS_CHIP[s.status] || 'bg-slate-100 text-slate-700'}`}>
                      {s.status}
                    </span>
                    <span className="text-right text-[11px] text-slate-500 leading-tight">
                      PGJ-{String(s.id).padStart(4, '0')}<br />{timeAgo(s.updated_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium mt-4">{s.publisher_name || '-'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {s.submission_type} · {s.member_category} · {s.city || '-'}
                  </p>
                  <div className="flex items-center gap-2.5 mt-5 pt-4 border-t border-slate-900/5">
                    <span className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white text-xs font-semibold flex items-center justify-center">
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

        {/* Statistik posisi pengajuan */}
        <div className="card-surface p-5 lg:col-span-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-lg text-slate-800">Posisi pengajuan</h2>
            <button onClick={() => onOpenScreening({})} title="Lihat semua pengajuan"
              className="w-10 h-10 rounded-full bg-slate-50 hover:bg-white border border-slate-200/70 flex items-center justify-center text-slate-600 transition">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <PositionBubbles total={total} items={[
            { label: 'Selesai',    value: finished, cls: 'text-slate-700 ring-1 ring-slate-300 bg-slate-50 bg-[repeating-linear-gradient(135deg,rgba(15,23,42,0.07)_0_2px,transparent_2px_7px)]', pos: 'right-3 top-0' },
            { label: 'Di Sekretaris', value: atAdmin1, cls: 'bg-[#0da2e7] text-white shadow-lg shadow-sky-500/30', pos: 'left-0 top-10' },
            { label: 'Di Ketua', value: atAdmin2, cls: 'bg-blue-700 text-white shadow-lg shadow-blue-700/30', pos: 'right-0 bottom-0' },
          ]} />
        </div>

        {/* Aksi cepat */}
        <div className="card-surface p-5 lg:col-span-4 flex flex-col">
          <p className="text-lg text-slate-800">Halo, {firstName} 👋</p>
          <p className="text-xl font-medium text-slate-900">Mau mengerjakan apa hari ini?</p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {[
              { label: 'Screening berkas', icon: ShieldCheck, tone: 'bg-sky-100 text-[#0884c4]',        onClick: () => onOpenScreening({ status: 'Menunggu Verifikasi' }) },
              { label: 'Data anggota',     icon: Users,       tone: 'bg-violet-100 text-violet-700',    onClick: onOpenMembers },
              { label: 'Ekspor Excel',     icon: Download,    tone: 'bg-emerald-100 text-emerald-700',  onClick: handleExport },
              { label: 'Input No. KTA',    icon: KeyRound,    tone: 'bg-amber-100 text-amber-700',      onClick: onOpenMembers },
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
              placeholder="Cari penerbit atau kota..."
              className="w-full pl-10 pr-11 py-3 text-sm rounded-full bg-slate-50 border border-white/90 placeholder:text-slate-400 focus:ring-2 focus:ring-[#0da2e7]/30 outline-none" />
            <button type="submit" aria-label="Cari" className="absolute right-3 bottom-2.5 p-1 text-[#0da2e7] hover:text-[#0884c4]">
              <Sparkles className="w-5 h-5" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
