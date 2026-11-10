import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import QueueCard, { QueueFooter, QueueFilterBar } from '../components/QueueCard';
import HeregRequestsPanel from '../components/HeregRequestsPanel';
import { revisionRoundIn } from '../components/StatusStepper';
import {
  parseDate, submittedDate, timeAgo, initials, pct, greetingName,
  buildTrend, SideCardList, TrendChart, TrendLegend, RangeToggle, HeaderStats } from '../components/DashboardWidgets';
import {
  ArrowUpRight, ArrowRight, Users, UserPlus, UserCheck, RefreshCw, Lightbulb, Wallet,
  FileSignature, Search, Sparkles, CheckCircle2, CircleDashed, KeyRound,
  ShieldCheck, CreditCard, Truck, Activity
} from 'lucide-react';

const ROLES = ['Admin', 'Sekretaris', 'Ketua', 'Anggota'];

const ROLE_STYLE = {
  Admin:      { dot: 'bg-blue-800',   bar: 'bg-blue-800 text-white',   chip: 'bg-blue-100 text-blue-900 ring-1 ring-blue-200' },
  Sekretaris: { dot: 'bg-[#0da2e7]',   bar: 'bg-[#0da2e7] text-white',   chip: 'bg-sky-100 text-[#0884c4] ring-1 ring-sky-200' },
  Ketua:      { dot: 'bg-indigo-600',  bar: 'bg-indigo-600 text-white',  chip: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' },
  Anggota:    { dot: 'bg-emerald-500', bar: 'bg-white text-slate-800 ring-1 ring-slate-200', chip: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' },
};

// Grafik: akun baru (tabel pengguna) dan pengajuan masuk, dalam satu daftar gabungan
const TREND_SERIES = [
  { key: 'akun',      label: 'Akun baru',       color: '#1e40af', tipClass: 'text-blue-300', dateOf: (x) => parseDate(x.created_at), filter: (x) => x.kind === 'user' },
  { key: 'pengajuan', label: 'Pengajuan masuk', color: '#0da2e7', tipClass: 'text-sky-300',   dateOf: submittedDate,                 filter: (x) => x.kind === 'submission' },
];

// Kelengkapan pengaturan sesuai PRD: biaya, rekening, template surat, gambar TTD & stempel
const settingsChecklist = (s) => [
  { label: 'Rekening pembayaran', ok: Boolean(s.bank_name && s.bank_account && s.bank_holder) },
  { label: 'Biaya pendaftaran',   ok: Boolean(s.fee_uang_pangkal && s.fee_administrasi && s.fee_iuran_bulanan && s.fee_heregistrasi_iuran) },
  { label: 'Nama Ketua & Sekretaris', ok: Boolean(s.ketua_nama && s.sekretaris_nama) },
  { label: 'Gambar TTD Ketua',    ok: Boolean(s.ketua_signature_img) },
  { label: 'Gambar TTD Sekretaris', ok: Boolean(s.sekretaris_signature_img) },
  { label: 'Stempel resmi',       ok: Boolean(s.stempel_img) },
  { label: 'Template surat',      ok: true, note: s.surat_pembuka_baru ? 'Kustom' : 'Standar' },
];

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` });

export default function AdminDashboard({ onOpenUsers, onOpenSettings, onOpenScreening, onOpenMonitoring, onOpenDetail }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('12m');
  const [search, setSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState('Semua');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'

  const fetchData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [u, s, st] = await Promise.all([
        fetch('/api/admin/users', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/submissions', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/settings', { headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` } }).then((r) => r.json()),
      ]);
      setUsers(u.users || []);
      setSubmissions(s.submissions || []);
      setSettings(st.settings || {});
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Segarkan otomatis agar pengajuan / unggahan baru pemohon masuk tanpa reload halaman
    const refresh = () => { if (document.visibilityState === 'visible') fetchData({ silent: true }); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);

  const total = users.length;
  const byRole = Object.fromEntries(ROLES.map((r) => [r, users.filter((u) => u.role === r).length]));
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newAccounts = users.filter((u) => (parseDate(u.created_at)?.getTime() || 0) >= monthAgo).length;
  const notOnboarded = users.filter((u) => u.role === 'Anggota' && !u.onboarded_at).length;

  const checklist = settingsChecklist(settings);
  const settingsDone = checklist.filter((c) => c.ok).length;
  const settingsMissing = checklist.length - settingsDone;

  const trend = useMemo(() => buildTrend(
    [...users.map((u) => ({ ...u, kind: 'user' })), ...submissions.map((s) => ({ ...s, kind: 'submission' }))],
    range, TREND_SERIES
  ), [users, submissions, range]);

  // Tugas Admin: screening dokumen (Tahap 1), verifikasi bayar (Tahap 2), konfirmasi berkas fisik
  // (setelah pemohon menandai sudah dikirim), dan mengirim paket ke IKAPI Pusat
  const TASKS = [
    { key: 'screening', label: 'Screening berkas', action: 'Screening berkas', dot: 'bg-[#0da2e7]', chip: 'bg-sky-100 text-sky-800', icon: ShieldCheck, test: (x) => x.status === 'Menunggu Verifikasi' && !revisionRoundIn(x) },
    // Pemohon sudah mengirim dokumen perbaikan: diperiksa ulang, ditandai "Revisi ke-N"
    { key: 'revisi', label: 'Revisi', action: 'Periksa revisi', dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-900', icon: RefreshCw, test: (x) => revisionRoundIn(x) > 0 },
    { key: 'bayar', label: 'Verifikasi bayar', action: 'Cek bukti pembayaran', dot: 'bg-amber-400', chip: 'bg-amber-100 text-amber-800', icon: CreditCard, test: (x) => x.status === 'Menunggu Pembayaran' && x.payment_status === 'Menunggu' && Boolean(x.payment_proof) },
    { key: 'fisik', label: 'Berkas fisik', action: 'Konfirmasi berkas fisik', dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-800', icon: Truck, test: (x) => x.status === 'Pengiriman Berkas' && x.physical_status === 'Dikirim' },
    { key: 'pusat', label: 'Kirim ke Pusat', action: 'Kirim berkas ke Pusat', dot: 'bg-violet-500', chip: 'bg-violet-100 text-violet-800', icon: Truck, test: (x) => x.status === 'Berkas Diterima' },
  ];
  // Pengajuan berjalan yang sedang menunggu pihak lain (pemohon, Sekretaris, Ketua, Pusat):
  // hanya tampil di filter "Semua" agar Admin melihat posisi semua pengajuan
  const WAITING = {
    'Perlu Revisi': { label: 'Revisi oleh pemohon', dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800' },
    'Menunggu Pembayaran': { label: 'Menunggu pembayaran', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' },
    'Menunggu TTD Sekretaris': { label: 'Menunggu TTD Sekretaris', dot: 'bg-indigo-400', chip: 'bg-indigo-50 text-indigo-800' },
    'Menunggu Approval': { label: 'Menunggu persetujuan Ketua', dot: 'bg-indigo-400', chip: 'bg-indigo-50 text-indigo-800' },
    'Pengiriman Berkas': { label: 'Menunggu berkas fisik', dot: 'bg-orange-300', chip: 'bg-orange-50 text-orange-800' },
    'Dikirim ke Pusat': { label: 'Diproses di Pusat', dot: 'bg-violet-400', chip: 'bg-violet-50 text-violet-800' },
  };
  const taskOf = (x) => TASKS.find((t) => t.test(x));
  const cardOf = (x) => { const t = taskOf(x); return t ? { ...t, label: t.action, isTask: true } : (WAITING[x.status] ? { key: 'tunggu', ...WAITING[x.status] } : null); };
  const matchesFilter = (x, fKey) => {
    if (fKey === 'Semua') return Boolean(cardOf(x));
    if (fKey === 'screening') return x.status === 'Menunggu Verifikasi';
    if (fKey === 'revisi') return revisionRoundIn(x) > 0 || x.status === 'Perlu Revisi';
    return taskOf(x)?.key === fKey;
  };
  const tasks = useMemo(
    () => submissions
      .filter((x) => matchesFilter(x, taskFilter))
      // Tugas Admin dulu, lalu urut waktu masuk/diperbarui (default terbaru di atas agar unggahan baru langsung terlihat)
      .sort((a, b) => {
        const byTask = (taskOf(b) ? 1 : 0) - (taskOf(a) ? 1 : 0);
        const diff = (parseDate(b.updated_at) || 0) - (parseDate(a.updated_at) || 0);
        return byTask || (sortOrder === 'oldest' ? -diff : diff);
      }),
    [submissions, taskFilter, sortOrder]
  );
  // Dashboard hanya menampilkan maksimal 6 kartu; selebihnya lewat menu Screening
  const displayTasks = tasks.slice(0, 6);
  const taskCount = (key) => {
    if (key === 'screening') return submissions.filter((x) => x.status === 'Menunggu Verifikasi').length;
    if (key === 'revisi') return submissions.filter((x) => revisionRoundIn(x) > 0 || x.status === 'Perlu Revisi').length;
    return submissions.filter((x) => taskOf(x)?.key === key).length;
  };

  const { first: firstName } = greetingName(user?.name);

  const handleSearch = (e) => {
    e.preventDefault();
    onOpenUsers({ search: search.trim() });
  };

  // Satu kartu = satu pengajuan: langsung buka detailnya
  const openTask = (x) => {
    if (onOpenDetail) return onOpenDetail(x.id);
    const t = taskOf(x)?.key;
    if (t === 'fisik' || t === 'pusat') onOpenMonitoring?.();
    else onOpenScreening?.(x.status);
  };

  return (
    <div className="flex flex-col gap-4 w-full">

      {/* ══ Sapaan + angka utama (satu baris) ══ */}
      <section className="flex-shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-slate-900 truncate">
            Selamat datang, <span className="text-blue-800">{firstName}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} akun · {newAccounts} akun baru dalam 30 hari · {notOnboarded} profil anggota belum lengkap</p>
        </div>
        <HeaderStats
          loading={loading}
          items={TASKS.map(({ key, label, icon, chip }) => ({
            key, label, icon, tone: chip, value: taskCount(key), onClick: () => setTaskFilter(key),
          }))}
        />
      </section>

      {/* Anggota lama menunggu verifikasi KTA lama (hanya tampil bila ada antrean) */}
      <HeregRequestsPanel />

      {/* ══ Widget utama: tugas Admin + kesiapan sistem ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card-surface p-4 sm:p-5 lg:col-span-9 flex flex-col">
          <QueueFilterBar
            title="Tugas Admin"
            filters={[
              ...TASKS.map((f) => ({ key: f.key, label: f.label, dot: f.dot, value: taskCount(f.key) })),
              { key: 'Semua', label: 'Semua', dot: 'bg-slate-400', value: submissions.filter((x) => cardOf(x)).length },
            ]}
            active={taskFilter}
            onChange={setTaskFilter}
            sortOrder={sortOrder}
            onToggleSort={() => setSortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
            onRefresh={() => fetchData()}
            loading={loading}
          />

          {tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 py-10">
              {loading ? 'Memuat tugas...' : 'Tidak ada tugas di antrian ini.'}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {displayTasks.map((x) => {
                  const t = cardOf(x);
                  const round = revisionRoundIn(x);
                  return (
                    <QueueCard
                      key={x.id}
                      sub={x}
                      label={t.label}
                      tone={t}
                      revisionRound={round}
                      note={t.key === 'fisik' ? `Dikirim lewat ${x.physical_courier || '-'}` : null}
                      noteTone="text-orange-700"
                      onClick={() => openTask(x)}
                    />
                  );
                })}
              </div>

              {tasks.length > 6 && (
                <QueueFooter shown={displayTasks.length} total={tasks.length}
                  noun={taskFilter === 'Semua' ? 'pengajuan berjalan' : 'tugas'}
                  linkLabel="Buka menu Screening" onLink={() => onOpenScreening?.()} />
              )}
            </div>
          )}
        </div>

        {/* Kesiapan sistem */}
        <div className="lg:col-span-3 rounded-3xl p-5 text-white bg-gradient-to-br from-[#0da2e7] via-blue-700 to-blue-900 shadow-xl shadow-blue-900/25 flex flex-col min-h-0 overflow-hidden lg:h-0 lg:min-h-full">
          <div className="flex items-start justify-between">
            <h2 className="text-lg">Kesiapan sistem</h2>
            <button onClick={onOpenSettings} title="Buka pengaturan sistem"
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct(settingsDone, checklist.length)}%` }} />
          </div>
          <p className="text-xs text-white/90 mt-2">{settingsDone} dari {checklist.length} pengaturan lengkap.</p>
          <SideCardList title="Daftar pengaturan"
            items={checklist.map((c) => ({
              label: c.label, icon: c.ok ? CheckCircle2 : CircleDashed, muted: !c.ok, onClick: onOpenSettings,
            }))} />
          <div className="mt-auto pt-3 space-y-2">
            <button onClick={onOpenSettings}
              className="w-full flex items-center justify-between gap-3 text-left bg-white text-slate-800 rounded-2xl px-4 py-3 [@media(max-height:780px)]:py-2 shadow-lg hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Lengkapi pengaturan</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{settingsMissing}</span>
            </button>
            <button onClick={() => onOpenMonitoring?.()}
              className="w-full flex items-center justify-between gap-3 text-left bg-blue-100/90 text-slate-800 rounded-2xl px-4 py-3 [@media(max-height:780px)]:py-2 shadow-md hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Monitoring pendaftaran</span>
              <Activity className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ══ Baris bawah: grafik, akun per peran, aksi cepat ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card-surface p-4 sm:p-5 lg:col-span-6 flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div>
              <h2 className="text-base text-slate-800">Akun baru & pengajuan masuk</h2>
              <TrendLegend series={TREND_SERIES} />
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>
          <div className="flex-1 min-h-0 h-48 sm:h-52">
            <TrendChart data={trend} series={TREND_SERIES} fill ariaLabel="Grafik akun baru dan pengajuan masuk" />
          </div>
        </div>

        <div className="card-surface p-4 sm:p-5 lg:col-span-3 flex flex-col min-h-0">
          <h2 className="text-base text-slate-800 mb-2">Akun per peran</h2>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button key={r} onClick={() => onOpenUsers({ role: r })}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200/70 transition text-left">
                <span className="flex items-center gap-1.5 text-xs text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${ROLE_STYLE[r].dot}`} /> {r}
                </span>
                <span className="text-xs font-semibold text-slate-800">{byRole[r]}</span>
              </button>
            ))}
          </div>
          <p className="mt-auto pt-2 flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug [@media(max-height:780px)]:hidden">
            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
            {notOnboarded > 0 ? `${notOnboarded} anggota belum menjawab pertanyaan awal.` : 'Semua anggota sudah melengkapi profil.'}
          </p>
        </div>

        <div className="card-surface p-4 sm:p-5 lg:col-span-3 flex flex-col min-h-0">
          <p className="text-base text-slate-800 [@media(max-height:780px)]:hidden">Halo, {firstName} 👋</p>
          <div className="grid grid-cols-2 gap-2 mt-3 [@media(max-height:780px)]:mt-0">
            {[
              { label: 'Tambah akun', icon: UserPlus,      tone: 'bg-blue-100 text-blue-800',       onClick: () => onOpenUsers({ create: true }) },
              { label: 'Kelola akun', icon: KeyRound,      tone: 'bg-sky-100 text-[#0884c4]',       onClick: () => onOpenUsers({}) },
              { label: 'Biaya',       icon: Wallet,        tone: 'bg-emerald-100 text-emerald-700', onClick: onOpenSettings },
              { label: 'Template & TTD', icon: FileSignature, tone: 'bg-indigo-100 text-indigo-700', onClick: onOpenSettings },
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
              placeholder="Cari nama atau email akun..."
              className="w-full pl-9 pr-10 py-2.5 text-xs rounded-full bg-slate-50 border border-slate-200/70 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 outline-none" />
            <button type="submit" aria-label="Cari" className="absolute right-3 bottom-2 p-1 text-blue-800">
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
