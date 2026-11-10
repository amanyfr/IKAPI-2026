import React, { useState, useEffect } from 'react';
import {
  Users, Search, Download, Building2, Phone, Mail, MapPin, RefreshCw, KeyRound,
  X, Edit2, CheckCircle, ChevronRight
} from 'lucide-react';
import { notify } from '../components/AppDialog';

const token = () => localStorage.getItem('ikapi_token');

const BADGE = {
  Aktif:   'bg-emerald-100 text-emerald-800 border-emerald-200',
  Calon:   'bg-amber-100 text-amber-800 border-amber-200',
  Nonaktif:'bg-slate-100 text-slate-600 border-slate-300',
};

// Status ditampilkan sebagai titik + teks (lebih tenang daripada badge berwarna)
const STATUS_DOT = {
  Aktif:    'bg-emerald-500',
  Calon:    'bg-amber-400',
  Nonaktif: 'bg-slate-300',
  'Menunggu KTA': 'bg-violet-500',
};
const STATUS_LABEL = { Aktif: 'Aktif', Calon: 'Calon anggota', Nonaktif: 'Nonaktif' };

// Warna avatar inisial dari palet biru, tetap sama untuk nama yang sama
const AVATAR_TONES = [
  'bg-blue-50 text-blue-700',
  'bg-sky-50 text-sky-700',
  'bg-indigo-50 text-indigo-700',
  'bg-slate-100 text-slate-700',
  'bg-cyan-50 text-cyan-700',
];
const initials = (name = '') =>
  name.replace(/\(.*?\)/g, '').split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(PT|CV)$/i.test(w))
    .slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const avatarTone = (name = '') =>
  AVATAR_TONES[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];

// 'Menunggu KTA' = berkas sudah dikirim ke IKAPI Pusat, No. KTA belum diinput
const STATUS_TABS = ['Semua', 'Menunggu KTA', 'Aktif', 'Calon', 'Nonaktif'];
const isWaitingKta = (m) => m.submission_status === 'Dikirim ke Pusat';
const matchesStatus = (m, st) => st === 'Semua' || (st === 'Menunggu KTA' ? isWaitingKta(m) : m.membership_status === st);
const CATEGORY_TABS = ['Semua', 'Biasa', 'Luar Biasa'];

// canEditKta=false untuk Ketua: direktori hanya-lihat (input No. KTA tugas Sekretaris sesuai PRD)
export default function MembersManagement({ canEditKta = true, initialStatus = 'Semua' }) {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('Semua');
  const [status,   setStatus]   = useState(initialStatus);

  // Panel "Input No. KTA": isian per anggota & anggota yang sedang dikonfirmasi
  const [ktaDrafts,  setKtaDrafts]  = useState({});
  const [confirmKta, setConfirmKta] = useState(null);

  // Detail Modal
  const [selectedMember, setSelectedMember] = useState(null);

  // Edit KTA (inline row)
  const [editingKtaId, setEditingKtaId] = useState(null);
  const [ktaInput,     setKtaInput]     = useState('');
  const [savingKta,    setSavingKta]    = useState(false);

  // Semua anggota dimuat sekali; pencarian & filter dilakukan di sini agar jumlah per status tetap terlihat
  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/members', {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const q = search.trim().toLowerCase();
  const matchesSearchAndCategory = (m) =>
    (category === 'Semua' || (m.category || 'Biasa') === category) &&
    (!q || [m.publisher_name, m.leader_name, m.city, m.kta_number, m.email]
      .some((v) => (v || '').toLowerCase().includes(q)));
  const baseList = members.filter(matchesSearchAndCategory);
  const visibleMembers = baseList.filter((m) => matchesStatus(m, status));
  const countFor = (st) => baseList.filter((m) => matchesStatus(m, st)).length;
  // No. KTA diinput setelah berkas dikirim ke Pusat; anggota lama/aktif boleh dikoreksi
  const canInputKta = (m) => canEditKta && (isWaitingKta(m) || m.membership_status !== 'Calon' || m.submission_status === 'Aktif');

  /* ── Aktif / Nonaktif ── */
  const [savingStatus, setSavingStatus] = useState(false);
  const handleSetStatus = async (member, nextStatus) => {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/members/${member.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(data.message);
      setSelectedMember({ ...member, membership_status: nextStatus });
      fetchMembers();
    } catch (err) {
      notify('Gagal mengubah status: ' + err.message);
    } finally {
      setSavingStatus(false);
    }
  };

  /* ── Save KTA ── */
  const handleSaveKta = async (memberId, value = ktaInput) => {
    if (!value.trim()) { notify('Nomor KTA wajib diisi.'); return; }
    setSavingKta(true);
    try {
      const res = await fetch(`/api/members/${memberId}/kta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ kta_number: value.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(data.message || 'Nomor KTA berhasil disimpan.');
      setEditingKtaId(null);
      setKtaInput('');
      setConfirmKta(null);
      setKtaDrafts((d) => { const n = { ...d }; delete n[memberId]; return n; });
      fetchMembers();
    } catch (err) {
      notify('Gagal simpan KTA: ' + err.message);
    } finally {
      setSavingKta(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetch('/api/members/export', {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error('Gagal mengunduh file Excel');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Data_Anggota_IKAPI_Jawa_Barat.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notify('Ekspor Excel gagal: ' + err.message);
    }
  };

  // Tampilan & edit inline No. KTA — di HP tombol edit selalu tampil (tidak ada hover)
  const renderKta = (m, alwaysShowEdit = false) =>
    !canInputKta(m) ? (
      <span className={m.kta_number ? 'font-mono text-slate-800' : 'text-slate-400'}>
        {m.kta_number || 'Belum terbit'}
      </span>
    ) : editingKtaId === m.id ? (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={ktaInput}
          onChange={(e) => setKtaInput(e.target.value)}
          placeholder="014/JBR/2026"
          autoFocus
          className="w-28 text-xs font-mono font-bold p-1.5 border border-[#0da2e7] rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none uppercase"
        />
        <button
          onClick={() => handleSaveKta(m.id)}
          disabled={savingKta}
          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
          title="Simpan"
        >
          <CheckCircle className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { setEditingKtaId(null); setKtaInput(''); }}
          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
          title="Batal"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ) : isWaitingKta(m) && !m.kta_number ? (
      <button
        type="button"
        onClick={() => { setEditingKtaId(m.id); setKtaInput(''); }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium whitespace-nowrap transition"
      >
        <KeyRound className="w-3.5 h-3.5" /> Input No. KTA
      </button>
    ) : (
      <div className="flex items-center gap-1.5 group">
        <span className={m.kta_number ? 'font-mono text-slate-800' : isWaitingKta(m) ? 'text-violet-700 font-medium' : 'text-slate-400'}>
          {m.kta_number || (isWaitingKta(m) ? 'Menunggu dari Pusat' : 'Belum terbit')}
        </span>
        <button
          onClick={() => { setEditingKtaId(m.id); setKtaInput(m.kta_number || ''); }}
          className={`p-1 rounded text-slate-300 hover:text-[#0da2e7] hover:bg-[#f0f9ff] transition ${alwaysShowEdit || isWaitingKta(m) ? 'text-slate-400' : 'opacity-0 group-hover:opacity-100'}`}
          title="Edit No. KTA"
          aria-label="Edit No. KTA"
        >
          <Edit2 className="w-3 h-3" />
        </button>
      </div>
    );

  const waitingKta = members.filter(isWaitingKta);
  const daysSince = (at) => (at ? Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 86400000)) : null);
  const fmtDate = (at) => (at ? new Date(at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-');

  return (
    <div className="space-y-6">

      {/* ══ Input No. KTA dari IKAPI Pusat (tugas Sekretaris) ══ */}
      {canEditKta && waitingKta.length > 0 && (
        <div id="input-kta" className="card-surface overflow-hidden">
          <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-light tracking-tight text-slate-900">
                  Input No. KTA dari IKAPI Pusat <span className="text-violet-600 tabular-nums">{waitingKta.length}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Pemohon di bawah ini sudah mengirim berkas ke IKAPI Pusat. Pemohon mengisi sendiri Nomor KTA setelah disetujui Pusat.
                  Isi di sini hanya bila pemohon meminta bantuan. Status pemohon otomatis menjadi <strong className="font-medium text-slate-700">Anggota Aktif</strong>.
                </p>
              </div>
            </div>
          </div>
          <ul className="bg-white border-t border-slate-100 divide-y divide-slate-100">
            {waitingKta.map((m) => {
              const days = daysSince(m.sent_to_central_at);
              const draft = ktaDrafts[m.id] || '';
              const confirming = confirmKta === m.id;
              return (
                <li key={m.id} className="px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${avatarTone(m.publisher_name)}`}>
                      {initials(m.publisher_name)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{m.publisher_name}</div>
                      <div className="text-xs text-slate-500">
                        {m.city || '-'} · {m.category || 'Biasa'}{m.submission_type ? ` · ${m.submission_type}` : ''}
                      </div>
                      <div className={`text-xs mt-0.5 ${days > 30 ? 'text-amber-700' : 'text-violet-700'}`}>
                        Dikirim ke Pusat {fmtDate(m.sent_to_central_at)}
                        {days !== null && ` · ${days === 0 ? 'hari ini' : `${days} hari lalu`}`}
                        {m.central_courier && <span className="text-slate-500"> · {m.central_courier}{m.central_tracking_no ? ` resi ${m.central_tracking_no}` : ''}</span>}
                      </div>
                    </div>
                  </div>

                  {confirming ? (
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <span className="text-xs text-slate-600">
                        Simpan <strong className="font-mono text-slate-900">{draft.trim().toUpperCase()}</strong> dan aktifkan anggota?
                      </span>
                      <button type="button" onClick={() => handleSaveKta(m.id, draft)} disabled={savingKta}
                        className="px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-60">
                        <CheckCircle className="w-4 h-4" /> {savingKta ? 'Menyimpan...' : 'Ya, aktifkan'}
                      </button>
                      <button type="button" onClick={() => setConfirmKta(null)}
                        className="px-3.5 py-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition">
                        Batal
                      </button>
                    </div>
                  ) : (
                    <form
                      className="flex items-center gap-2 lg:justify-end"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!draft.trim()) { notify('Isi Nomor KTA dari IKAPI Pusat terlebih dahulu.'); return; }
                        setConfirmKta(m.id);
                      }}
                    >
                      <input
                        type="text"
                        value={draft}
                        onChange={(e) => setKtaDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                        placeholder="mis. 014/JBR/2026"
                        aria-label={`Nomor KTA ${m.publisher_name}`}
                        className="flex-1 lg:w-56 min-w-0 text-sm font-mono uppercase px-3.5 py-2 rounded-full border border-slate-200 bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
                      />
                      <button type="submit"
                        className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4" /> Simpan No. KTA
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card-surface overflow-hidden">

        {/* ── Judul & aksi ── */}
        <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-light tracking-tight text-slate-900">
              Direktori anggota <span className="text-slate-400">{members.length}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {canEditKta
                ? 'Penerbit terdaftar di IKAPI Jawa Barat. Klik baris untuk detail, ubah No. KTA langsung di kolomnya.'
                : 'Penerbit terdaftar di IKAPI Jawa Barat. Klik baris untuk melihat detail.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchMembers}
              className="p-2 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition"
              title="Muat ulang"
              aria-label="Muat ulang"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Ekspor Excel
            </button>
          </div>
        </div>

        {/* ── Status (dengan jumlah), kategori & pencarian ── */}
        <div className="px-5 sm:px-6 pb-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex gap-1 p-1 rounded-full bg-slate-100/80 overflow-x-auto self-start max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATUS_TABS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatus(st)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                  status === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st !== 'Semua' && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[st]}`} />}
                {st === 'Calon' ? 'Calon' : st}
                <span className="text-slate-400 tabular-nums">{countFor(st)}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-xs">
            {CATEGORY_TABS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap transition ${
                  category === c ? 'text-blue-700 bg-blue-50 font-medium' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {c === 'Semua' ? 'Semua kategori' : c}
              </button>
            ))}
          </div>

          <div className="relative lg:ml-auto lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Cari penerbit, kota, KTA"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm pl-10 pr-4 py-2 rounded-full border border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            />
          </div>
        </div>

        {/* ── Daftar ── */}
        <div className="bg-white border-t border-slate-100">
          {/* Label kolom (layar lebar) */}
          <div className="hidden md:grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_1.5rem] gap-4 px-6 py-2.5 text-[11px] text-slate-400 border-b border-slate-100">
            <span>Penerbit</span>
            <span>Kota · Kategori</span>
            <span>No. KTA</span>
            <span>Status</span>
            <span />
          </div>

          {loading && members.length === 0 ? (
            <p className="text-center py-12 text-sm text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Memuat data...
            </p>
          ) : visibleMembers.length === 0 ? (
            <div className="text-center py-14 text-sm text-slate-400">
              <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
              {members.length === 0 ? 'Belum ada anggota terdaftar.' : 'Tidak ada anggota yang cocok dengan filter ini.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleMembers.map((m) => (
                <li
                  key={m.id}
                  onClick={() => editingKtaId !== m.id && setSelectedMember(m)}
                  className="group px-4 sm:px-6 py-3.5 cursor-pointer hover:bg-slate-50/80 transition grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_1.5rem] gap-x-4 gap-y-2 items-center"
                >
                  {/* Penerbit */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${avatarTone(m.publisher_name)}`}>
                      {initials(m.publisher_name)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{m.publisher_name}</div>
                      <div className="text-xs text-slate-500 truncate">{m.leader_name || '-'} · {m.legal_entity || '-'}</div>
                    </div>
                  </div>

                  {/* Status di HP: kanan atas */}
                  <div className="md:hidden flex items-center gap-1.5 text-xs text-slate-600 justify-self-end">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[m.membership_status] || STATUS_DOT.Calon}`} />
                    {STATUS_LABEL[m.membership_status] || m.membership_status}
                  </div>

                  {/* Kota · kategori */}
                  <div className="col-span-2 md:col-span-1 pl-[3.25rem] md:pl-0 text-xs text-slate-600 min-w-0">
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />{m.city || '-'}
                    </span>
                    <span className={`md:block ml-2 md:ml-0 md:mt-0.5 ${m.category === 'Luar Biasa' ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {m.category === 'Luar Biasa' ? 'Luar biasa' : 'Biasa'}
                    </span>
                  </div>

                  {/* No. KTA */}
                  <div
                    className="col-span-2 md:col-span-1 pl-[3.25rem] md:pl-0 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="md:hidden text-slate-400 mr-1.5">KTA</span>
                    <span className="inline-block align-middle">{renderKta(m, true)}</span>
                  </div>

                  {/* Status (layar lebar) */}
                  <div className="hidden md:flex items-center gap-2 text-xs text-slate-700">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[m.membership_status] || STATUS_DOT.Calon}`} />
                    {STATUS_LABEL[m.membership_status] || m.membership_status}
                  </div>

                  <ChevronRight className="hidden md:block w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && visibleMembers.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-white text-xs text-slate-400">
            {visibleMembers.length} dari {members.length} anggota
          </div>
        )}
      </div>

      {/* ── Member Detail Modal ── */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 overflow-y-auto modal-overlay flex items-center justify-center p-4">
          <div className="modal-surface max-w-2xl w-full p-0 overflow-hidden">

            {/* Modal Header */}
            <div className="bg-[#0da2e7] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-lg leading-tight">{selectedMember.publisher_name}</h3>
                  <p className="text-xs text-[#dff2fd] mt-0.5">
                    Anggota {selectedMember.category} · {selectedMember.legal_entity || 'Badan Usaha'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">

              {/* KTA & Status Banner */}
              <div className="bg-[#f0f9ff] rounded-xl border border-[#b8e6fc] p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold text-[#0884c4] uppercase tracking-wider mb-0.5">Nomor KTA Resmi</div>
                  <div className="font-mono font-extrabold text-lg text-[#0da2e7]">
                    {selectedMember.kta_number || '— Belum Terbit —'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${BADGE[selectedMember.membership_status] || BADGE.Calon}`}>
                    {selectedMember.membership_status}
                  </span>
                  {canInputKta(selectedMember) && <button
                    onClick={() => {
                      setSelectedMember(null);
                      setEditingKtaId(selectedMember.id);
                      setKtaInput(selectedMember.kta_number || '');
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Edit KTA
                  </button>}
                  {canEditKta && selectedMember.membership_status === 'Aktif' && (
                    <button
                      onClick={() => handleSetStatus(selectedMember, 'Nonaktif')}
                      disabled={savingStatus}
                      className="px-3 py-1 bg-slate-600 hover:bg-slate-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition"
                    >
                      Nonaktifkan
                    </button>
                  )}
                  {canEditKta && selectedMember.membership_status === 'Nonaktif' && (
                    <button
                      onClick={() => handleSetStatus(selectedMember, 'Aktif')}
                      disabled={savingStatus}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition"
                    >
                      Aktifkan kembali
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Legalitas */}
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block border-b border-slate-200 pb-1.5 mb-2">Legalitas & Identitas</span>
                  <InfoRow label="NIB" value={selectedMember.nib} />
                  <InfoRow label="NPWP" value={selectedMember.npwp} />
                  <InfoRow label="Sertifikat BNSP" value={selectedMember.bnsp_certificate_no} />
                  <InfoRow label="Tgl Berdiri" value={selectedMember.establishment_date} />
                </div>

                {/* Kontak */}
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block border-b border-slate-200 pb-1.5 mb-2">Pimpinan & Kontak</span>
                  <InfoRow label="Pimpinan" value={`${selectedMember.leader_name || '-'} (${selectedMember.leader_title || 'Pimpinan'})`} />
                  <InfoRow label="PJ Redaksi" value={selectedMember.person_in_charge} />
                  <InfoRow label="Telepon" value={selectedMember.phone} icon={<Phone className="w-3 h-3" />} />
                  <InfoRow label="Email" value={selectedMember.email} icon={<Mail className="w-3 h-3" />} />
                </div>
              </div>

              {/* Alamat */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-700 block border-b border-slate-200 pb-1.5 mb-2">Alamat & Spesialisasi</span>
                <InfoRow label="Alamat" value={`${selectedMember.address || '-'}, ${selectedMember.city || ''}`} icon={<MapPin className="w-3 h-3" />} />
                <InfoRow label="Kode Pos" value={selectedMember.postal_code} />
                <InfoRow label="Website" value={selectedMember.website} />
                <InfoRow label="Spesialisasi" value={selectedMember.specialization || 'Umum & Pendidikan'} />
              </div>
            </div>

            <div className="px-6 pb-5 flex justify-end">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function InfoRow({ label, value, icon }) {
  return (
    <p className="flex items-start gap-1.5 text-slate-600">
      {icon && <span className="text-[#0da2e7] mt-0.5 flex-shrink-0">{icon}</span>}
      <span><strong className="text-slate-700">{label}:</strong> {value || <span className="text-slate-300 italic">—</span>}</span>
    </p>
  );
}
