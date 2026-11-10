import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { STATUS_LABEL, POST_APPROVAL_STATUSES } from '../components/StatusStepper';
import {
  parseDate, submittedDate, timeAgo, initials, pct,
  buildTrend, TrendChart, TrendLegend, PositionBubbles, RangeToggle
} from '../components/DashboardWidgets';
import QueueCard, { QueueFooter, QueueFilterBar } from '../components/QueueCard';
import {
  ArrowUpRight, ArrowRight, PenTool, FileCheck2, Wallet, RefreshCw, ChevronDown, Lightbulb,
  Award, Activity, Users, Search, Sparkles
} from 'lucide-react';

/* ── Kelompok status dari sudut pandang Ketua ── */
const AT_ADMIN1 = ['Draf', 'Menunggu Verifikasi', 'Perlu Revisi', 'Menunggu Pembayaran', 'Menunggu TTD Sekretaris'];
const PENDING   = ['Menunggu Approval'];
const SIGNED    = POST_APPROVAL_STATUSES;
const REJECTED  = ['Ditolak'];

// Label kartu: apa yang sedang terjadi / perlu dilakukan
const CARD = {
  'Menunggu Approval': { label: 'Perlu persetujuan Anda', chip: 'bg-indigo-100 text-indigo-800',   dot: 'bg-indigo-600' },
  'Perlu Revisi':      { label: 'Revisi oleh pemohon',    chip: 'bg-amber-100 text-amber-800',     dot: 'bg-amber-500' },
  'Pengiriman Berkas': { label: 'Menunggu berkas fisik',  chip: 'bg-orange-100 text-orange-800',   dot: 'bg-orange-500' },
  'Berkas Diterima':   { label: 'Diproses ke Pusat',      chip: 'bg-violet-100 text-violet-800',   dot: 'bg-violet-500' },
  'Dikirim ke Pusat':  { label: 'Diproses di Pusat',      chip: 'bg-violet-100 text-violet-800',   dot: 'bg-violet-500' },
  'Aktif':             { label: 'Anggota aktif',          chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  'Ditolak':           { label: 'Ditolak',                chip: 'bg-red-100 text-red-800',         dot: 'bg-red-500' },
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
  const [showAllQueue, setShowAllQueue] = useState(false);
  // Default: yang paling lama menunggu tampil duluan agar tidak terlewat
  const [sortOrder, setSortOrder] = useState('oldest'); // 'newest' | 'oldest'
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
      queueFilter === 'Semua' ? [...PENDING, 'Perlu Revisi', ...SIGNED, ...REJECTED].includes(s.status) : queueFilter === 'Dikirim ke Pusat' ? ['Berkas Diterima', 'Dikirim ke Pusat'].includes(s.status) : s.status === queueFilter
    );
    return list.sort((a, b) => {
      const diff = (parseDate(b.updated_at) || 0) - (parseDate(a.updated_at) || 0);
      return sortOrder === 'newest' ? diff : -diff;
    });
  }, [submissions, queueFilter, sortOrder]);

  const displayQueue = useMemo(() => {
    return showAllQueue ? queue : queue.slice(0, 6);
  }, [queue, showAllQueue]);

  const displayName = (user?.name || '').split(',')[0];

  const handleSearch = (e) => {
    e.preventDefault();
    onOpenApproval({ search: search.trim() });
  };

  // Satu filter untuk antrian (menggantikan widget "Keputusan" terpisah)
  const FILTERS = [
    { key: 'Menunggu Approval', label: 'Approval', value: pending, dot: 'bg-indigo-600' },
    { key: 'Perlu Revisi', label: 'Revisi', value: count(['Perlu Revisi']), dot: 'bg-amber-500' },
    { key: 'Pengiriman Berkas', label: 'Berkas fisik', value: count(['Pengiriman Berkas']), dot: 'bg-orange-500' },
    { key: 'Dikirim ke Pusat', label: 'Proses Pusat', value: count(['Berkas Diterima', 'Dikirim ke Pusat']), dot: 'bg-violet-500' },
    { key: 'Aktif', label: 'Aktif', value: count(['Aktif']), dot: 'bg-emerald-500' },
    { key: 'Ditolak', label: 'Ditolak', value: rejected, dot: 'bg-red-500' },
    { key: 'Semua', label: 'Semua', value: pending + count(['Perlu Revisi']) + signed + rejected, dot: 'bg-slate-400' },
  ];

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* ══ Sapaan + angka utama (satu baris) ══ */}
      <section className="flex-shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-slate-900 truncate">
            Selamat datang, <span className="text-indigo-700">{displayName}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{atAdmin1} pengajuan masih di Admin & Sekretaris · {total} pengajuan total</p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-8">
          {[
            { value: pending, label: 'Menunggu keputusan',  icon: PenTool,    tone: 'bg-indigo-100 text-indigo-700' },
            { value: signed,  label: 'Surat ditandatangani', icon: FileCheck2, tone: 'bg-emerald-100 text-emerald-700' },
            { value: formatJuta(iuran), prefix: 'Rp', suffix: 'jt', label: 'Iuran terverifikasi', icon: Wallet, tone: 'bg-sky-100 text-[#0884c4]' },
          ].map(({ value, prefix, suffix, label, icon: Icon, tone }) => (
            <div key={label} className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2.5 min-w-0">
              <span className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center ring-4 ring-white/70 ${tone}`}>
                <Icon className="w-4 h-4" />
              </span>
              <div className="leading-tight min-w-0">
                <span className="text-xl sm:text-3xl font-light text-slate-900 tabular-nums whitespace-nowrap">
                  {prefix && <span className="text-sm text-slate-500 mr-0.5">{prefix}</span>}
                  {loading ? '–' : value}
                  {suffix && <span className="text-sm text-slate-500 ml-0.5">{suffix}</span>}
                </span>
                <p className="text-[11px] text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Widget utama: antrian keputusan + tanda tangan ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card-surface p-4 sm:p-5 lg:col-span-9 flex flex-col">
          <QueueFilterBar
            title="Antrian keputusan"
            filters={FILTERS}
            active={queueFilter}
            onChange={(k) => { setQueueFilter(k); setShowAllQueue(false); }}
            sortOrder={sortOrder}
            onToggleSort={() => setSortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
            onRefresh={fetchSubmissions}
            loading={loading}
          />

          {queue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 py-10">
              {loading ? 'Memuat antrian...' : 'Tidak ada pengajuan di antrian ini.'}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {displayQueue.map((s) => {
                  const c = CARD[s.status] || { label: STATUS_LABEL[s.status] || s.status };
                  const note = s.status === 'Ditolak'
                    ? (s.rejection_reason ? `Alasan: ${s.rejection_reason}` : null)
                    : s.reference_number ? `No. surat ${s.reference_number}` : null;
                  return (
                    <QueueCard
                      key={s.id}
                      sub={s}
                      label={c.label}
                      tone={c}
                      note={note}
                      noteTone={s.status === 'Ditolak' ? 'text-red-700' : 'text-slate-500 font-mono'}
                      actionLabel={s.status === 'Menunggu Approval' ? 'Tinjau & setujui' : 'Lihat detail'}
                      onClick={() => (s.status === 'Menunggu Approval' ? onOpenApproval() : onOpenApproval({ search: s.publisher_name || '' }))}
                    />
                  );
                })}
              </div>

              {queue.length > 6 && (
                <QueueFooter shown={displayQueue.length} total={queue.length} noun="pengajuan"
                  expanded={showAllQueue} onToggle={() => setShowAllQueue(!showAllQueue)}
                  linkLabel="Buka menu Approval" onLink={() => onOpenApproval?.()} />
              )}
            </div>
          )}
        </div>

        {/* Kartu tanda tangan */}
        <div className="lg:col-span-3 rounded-3xl p-5 text-white bg-gradient-to-br from-[#0da2e7] via-blue-600 to-indigo-700 shadow-xl shadow-indigo-700/25 flex flex-col justify-between overflow-hidden min-h-[220px]">
          <div>
            <div className="flex items-start justify-between">
              <h2 className="text-lg">Perlu tanda tangan</h2>
              <button onClick={() => onOpenApproval()} title="Buka antrian approval"
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-white/85 mt-2 leading-relaxed">
              Pengajuan yang sudah disetujui Admin & Sekretaris. Setujui dan bubuhkan TTD Ketua.
            </p>
          </div>
          <div className="pt-4 space-y-2">
            <button onClick={() => onOpenApproval()}
              className="w-full flex items-center justify-between gap-3 text-left bg-white text-slate-800 rounded-2xl px-4 py-3 shadow-lg hover:-translate-y-0.5 transition cursor-pointer">
              <span className="text-sm font-medium">Approval & TTD</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{pending}</span>
            </button>
            <button onClick={() => onOpenApproval({ status: 'Aktif' })}
              className="w-full flex items-center justify-between gap-3 text-left bg-indigo-100/90 text-slate-800 rounded-2xl px-4 py-3 shadow-md hover:-translate-y-0.5 transition cursor-pointer">
              <span className="text-sm font-medium">Anggota aktif</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{count(['Aktif'])}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ══ Baris bawah: grafik, posisi, aksi cepat ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card-surface p-4 sm:p-5 lg:col-span-6 flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div>
              <h2 className="text-base text-slate-800">Pengajuan masuk vs disetujui</h2>
              <TrendLegend series={TREND_SERIES} />
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>
          <div className="h-52">
            <TrendChart data={trend} series={TREND_SERIES} fill ariaLabel="Grafik pengajuan masuk dan disetujui" />
          </div>
        </div>

        <div className="card-surface p-4 sm:p-5 lg:col-span-3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-base text-slate-800">Posisi pengajuan</h2>
            <button onClick={() => onOpenApproval({ scroll: true })} title="Lihat monitoring semua pengajuan"
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-white border border-slate-200/70 flex items-center justify-center text-slate-600 transition">
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <PositionBubbles compact total={total} items={[
            { label: 'Diputuskan',    value: signed + rejected, cls: 'text-slate-700 ring-1 ring-slate-300 bg-slate-50 bg-[repeating-linear-gradient(135deg,rgba(15,23,42,0.07)_0_2px,transparent_2px_7px)]', pos: 'right-3 top-0' },
            { label: 'Di Admin & Sekre', value: atAdmin1, cls: 'bg-[#0da2e7] text-white shadow-lg shadow-sky-500/30', pos: 'left-0 top-6' },
            { label: 'Menunggu Anda', value: pending,  cls: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30', pos: 'right-0 bottom-0' },
          ]} />
        </div>

        <div className="card-surface p-4 sm:p-5 lg:col-span-3 flex flex-col">
          <p className="text-base text-slate-800">Halo, {displayName} 👋</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              { label: 'Approval',   icon: Award,      tone: 'bg-indigo-100 text-indigo-700',   onClick: () => onOpenApproval() },
              { label: 'Monitoring', icon: Activity,   tone: 'bg-sky-100 text-[#0884c4]',       onClick: () => onOpenApproval({ scroll: true }) },
              { label: 'Anggota',    icon: Users,      tone: 'bg-violet-100 text-violet-700',   onClick: onOpenMembers },
              { label: 'Surat',      icon: FileCheck2, tone: 'bg-emerald-100 text-emerald-700', onClick: () => onOpenApproval({ status: 'Aktif', scroll: true }) },
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
              placeholder="Cari penerbit / no. surat..."
              className="w-full pl-9 pr-10 py-2.5 text-xs rounded-full bg-slate-50 border border-white/90 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300 outline-none" />
            <button type="submit" aria-label="Cari" className="absolute right-3 bottom-2 p-1 text-indigo-600 hover:text-indigo-800">
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
