import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  parseDate, submittedDate, timeAgo, initials, pct, greetingName,
  buildTrend, TrendChart, TrendLegend, RangeToggle
} from '../components/DashboardWidgets';
import {
  ArrowUpRight, Users, UserPlus, UserCheck, RefreshCw, Lightbulb, Wallet,
  FileSignature, Search, Sparkles, CheckCircle2, CircleDashed, KeyRound
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

export default function AdminDashboard({ onOpenUsers, onOpenSettings }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('12m');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, s, st] = await Promise.all([
        fetch('/api/admin/users', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/submissions', { headers: authHeaders() }).then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
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

  useEffect(() => { fetchData(); }, []);

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

  const latest = useMemo(
    () => [...users].sort((a, b) => (parseDate(b.created_at) || 0) - (parseDate(a.created_at) || 0)).slice(0, 8),
    [users]
  );

  const { first: firstName } = greetingName(user?.name);

  const handleSearch = (e) => {
    e.preventDefault();
    onOpenUsers({ search: search.trim() });
  };

  return (
    <div className="space-y-6">

      {/* ══ Sapaan + komposisi peran + angka utama ══ */}
      <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-slate-900">
            Selamat datang, <span className="text-blue-800">{firstName}</span>
          </h1>

          <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:flex sm:gap-2 mt-6 max-w-2xl">
            {ROLES.map((r) => (
              <div key={r} className="min-w-0" style={{ flexGrow: Math.max(pct(byRole[r], total), 12), flexBasis: 0 }}>
                <p className="text-xs text-slate-500 mb-2 truncate">{r}</p>
                <div className={`h-11 rounded-full flex items-center px-4 text-sm font-medium ${ROLE_STYLE[r].bar}`}>
                  {pct(byRole[r], total)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-12">
          {[
            { value: total,        label: 'Total akun',            icon: Users,     tone: 'bg-blue-100 text-blue-800' },
            { value: newAccounts,  label: 'Akun baru (30 hari)',   icon: UserPlus,  tone: 'bg-sky-100 text-[#0884c4]' },
            { value: notOnboarded, label: 'Profil anggota belum lengkap', icon: UserCheck, tone: 'bg-emerald-100 text-emerald-700' },
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

      {/* ══ Baris 2: akun per peran, grafik, kesiapan sistem ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Akun per peran */}
        <div className="card-surface p-5 lg:col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-slate-800">Akun per peran</h2>
            <button onClick={fetchData} title="Segarkan data"
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-blue-800 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="space-y-2.5">
            {ROLES.map((r) => (
              <button key={r} onClick={() => onOpenUsers({ role: r })}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200/70 transition text-left">
                <span className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${ROLE_STYLE[r].dot}`} /> {r}
                </span>
                <span className="min-w-[2rem] text-center text-sm font-semibold text-slate-800 bg-slate-900/5 rounded-full px-2.5 py-0.5">
                  {byRole[r]}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-auto pt-5 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
            <Lightbulb className="w-4 h-4 flex-shrink-0 text-amber-500" />
            <span>
              {notOnboarded > 0
                ? <><strong className="text-slate-700">{notOnboarded} anggota</strong> belum menjawab pertanyaan awal (lama/baru, biasa/luar biasa).</>
                : <>Semua anggota sudah melengkapi profil keanggotaan.</>}
            </span>
          </p>
        </div>

        {/* Grafik akun baru vs pengajuan */}
        <div className="card-surface p-5 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <h2 className="text-lg text-slate-800">Akun baru & pengajuan masuk</h2>
              <TrendLegend series={TREND_SERIES} />
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>
          <TrendChart data={trend} series={TREND_SERIES} ariaLabel="Grafik akun baru dan pengajuan masuk" />
        </div>

        {/* Kesiapan sistem (oranye) */}
        <div className="lg:col-span-3 rounded-3xl p-5 text-white bg-gradient-to-br from-[#0da2e7] via-blue-700 to-blue-900 shadow-xl shadow-blue-900/25 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between">
            <h2 className="text-lg">Kesiapan sistem</h2>
            <button onClick={onOpenSettings} title="Buka pengaturan sistem"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-white/90 mt-3 leading-relaxed">
            {settingsDone} dari {checklist.length} pengaturan lengkap. Pastikan biaya, rekening, TTD, dan stempel siap sebelum surat diterbitkan.
          </p>
          <div className="relative mt-auto pt-8 pb-2">
            <button onClick={onOpenSettings}
              className="relative z-10 w-full flex items-center justify-between gap-3 text-left bg-white text-slate-800 rounded-2xl px-4 py-3.5 shadow-lg hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Lengkapi pengaturan</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{settingsMissing}</span>
            </button>
            <button onClick={() => onOpenUsers({ role: 'Anggota' })}
              className="relative w-full mt-2 flex items-center justify-between gap-3 text-left bg-blue-100/90 text-slate-800 rounded-2xl px-4 py-3.5 shadow-md hover:-translate-y-0.5 transition">
              <span className="text-sm font-medium">Profil belum lengkap</span>
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">{notOnboarded}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ══ Baris 3: akun terbaru, kelengkapan pengaturan, aksi cepat ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Akun terbaru */}
        <div className="card-surface p-5 lg:col-span-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg text-slate-800">Akun terbaru</h2>
            <button onClick={() => onOpenUsers({})} title="Lihat semua akun"
              className="w-10 h-10 rounded-full bg-slate-50 hover:bg-white border border-slate-200/70 flex items-center justify-center text-slate-600 transition">
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
          {latest.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">{loading ? 'Memuat akun...' : 'Belum ada akun.'}</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {latest.map((u) => (
                <button key={u.id} onClick={() => onOpenUsers({ search: u.email })}
                  className="snap-start flex-shrink-0 w-60 text-left rounded-2xl bg-slate-50 hover:bg-white border border-slate-200/70 p-4 flex flex-col transition">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${ROLE_STYLE[u.role]?.chip}`}>{u.role}</span>
                    <span className="text-[11px] text-slate-500">{timeAgo(u.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2.5 mt-4">
                    <span className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-800 text-white text-xs font-semibold flex items-center justify-center">
                      {initials(u.name)}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block text-sm text-slate-800 truncate">{u.name}</span>
                      <span className="block text-[11px] text-slate-500 truncate">{u.email}</span>
                    </span>
                  </div>
                  {u.role === 'Anggota' && (
                    <p className={`text-[11px] mt-3 pt-3 border-t border-slate-900/5 ${u.onboarded_at ? 'text-slate-500' : 'text-blue-700'}`}>
                      {u.onboarded_at ? `Anggota ${u.member_type?.toLowerCase()} · ${u.member_category}` : 'Belum menjawab pertanyaan awal'}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Kelengkapan pengaturan */}
        <div className="card-surface p-5 lg:col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg text-slate-800">Pengaturan</h2>
            <span className="text-xs font-medium text-slate-500">{settingsDone}/{checklist.length}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-4">
            <div className="h-full rounded-full bg-gradient-to-r from-[#0da2e7] to-blue-800 transition-all" style={{ width: `${pct(settingsDone, checklist.length)}%` }} />
          </div>
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-slate-700 min-w-0">
                  {c.ok
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                    : <CircleDashed className="w-4 h-4 flex-shrink-0 text-slate-400" />}
                  <span className="truncate">{c.label}</span>
                </span>
                <span className={`text-[11px] flex-shrink-0 ${c.ok ? 'text-slate-400' : 'text-blue-700 font-medium'}`}>
                  {c.note || (c.ok ? 'Siap' : 'Belum ada')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Aksi cepat */}
        <div className="card-surface p-5 lg:col-span-4 flex flex-col">
          <p className="text-lg text-slate-800">Halo, {firstName} 👋</p>
          <p className="text-xl font-medium text-slate-900">Apa yang perlu dikelola hari ini?</p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {[
              { label: 'Tambah akun',      icon: UserPlus,      tone: 'bg-blue-100 text-blue-800',     onClick: () => onOpenUsers({ create: true }) },
              { label: 'Kelola akun',      icon: KeyRound,      tone: 'bg-sky-100 text-[#0884c4]',       onClick: () => onOpenUsers({}) },
              { label: 'Biaya & rekening', icon: Wallet,        tone: 'bg-emerald-100 text-emerald-700', onClick: onOpenSettings },
              { label: 'Template & TTD',   icon: FileSignature, tone: 'bg-indigo-100 text-indigo-700',   onClick: onOpenSettings },
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
              placeholder="Cari nama atau email akun..."
              className="w-full pl-10 pr-11 py-3 text-sm rounded-full bg-slate-50 border border-slate-200/70 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 outline-none" />
            <button type="submit" aria-label="Cari" className="absolute right-3 bottom-2.5 p-1 text-blue-800 hover:text-blue-800">
              <Sparkles className="w-5 h-5" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
