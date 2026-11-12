import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Search, Pencil, X, AlertCircle, RefreshCw, CalendarClock, Building2 } from 'lucide-react';
import { FILTERS, PHONE } from '../utils/inputFilters';
import AdminMemberDataModal from '../components/AdminMemberDataModal';

const ROLES = ['Admin', 'Sekretaris', 'Ketua', 'Anggota'];

const ROLE_BADGE = {
  Admin:      'bg-blue-50 text-blue-800 border-blue-200',
  Sekretaris: 'bg-sky-50 text-[#0884c4] border-sky-200',
  Ketua:      'bg-indigo-50 text-indigo-700 border-indigo-200',
  Anggota:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pemohon:    'bg-amber-50 text-amber-700 border-amber-200',
};

// Akun peran Anggota baru disebut "Anggota" bila keanggotaannya sudah aktif; selain itu "Pemohon"
const GROUPS = ['Admin', 'Sekretaris', 'Ketua', 'Anggota', 'Pemohon'];
const GROUP_DESC = {
  Admin:      'Kelola akun & pengaturan sistem',
  Sekretaris: 'Screening berkas, verifikasi pembayaran & No. KTA',
  Ketua:      'Approval pengajuan & tanda tangan surat',
  Anggota:    'Penerbit dengan keanggotaan aktif',
  Pemohon:    'Penerbit yang belum aktif (belum/sedang mengajukan)',
};
const groupOf = (u) => (u.role === 'Anggota' && !u.membership ? 'Pemohon' : u.role);

const ROLE_DESC = {
  Admin:      'Kelola akun & pengaturan sistem',
  Sekretaris: 'Screening berkas, verifikasi pembayaran & No. KTA dari pemohon',
  Ketua:      'Approval pengajuan & tanda tangan surat',
  Anggota:    'Penerbit pemohon keanggotaan',
};

const EMPTY_FORM = { name: '', email: '', phone: '', role: 'Anggota', password: '' };

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
});

// Ringkasan jawaban pertanyaan login pertama anggota
const memberInfo = (u) => {
  if (u.role !== 'Anggota') return null;
  if (!u.onboarded_at) return 'Belum menjawab pertanyaan awal';
  const type = u.member_type === 'Lama' ? 'anggota lama' : 'anggota baru';
  return u.membership ? `Anggota ${u.member_type?.toLowerCase()} · ${u.member_category}` : `Mendaftar sebagai ${type} · ${u.member_category}`;
};

// Tanggal 'YYYY-MM-DD' -> '1 Jun 2027'
const fmtDay = (v) => (v ? new Date(v + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const periodText = (m) => `Masa aktif s.d. ${fmtDay(m.end)} · ${m.left > 0 ? `${m.left} hari lagi` : 'sudah berakhir'}`;

export default function UserManagement({ initialRole = 'Semua', initialSearch = '', startWithCreate = false }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState(initialRole);
  const [editing, setEditing] = useState(startWithCreate ? {} : null); // null = tutup, {} = akun baru, user = ubah
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [memberData, setMemberData] = useState(null); // akun anggota aktif yang data penerbitnya dikelola

  // Spinner hanya saat pemuatan pertama; muat ulang sesudahnya senyap agar tabel tidak berkedip
  const loadedOnce = useRef(false);
  const loadUsers = async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const counts = useMemo(
    () => Object.fromEntries(GROUPS.map((r) => [r, users.filter((u) => groupOf(u) === r).length])),
    [users]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      (roleFilter === 'Semua' || groupOf(u) === roleFilter) &&
      (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
  }, [users, search, roleFilter]);

  const openCreate = () => { setEditing({}); setForm(EMPTY_FORM); setError(''); };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, phone: u.phone || '', role: u.role, password: '' });
    setPeriod(u.membership ? { start: u.membership.start, end: u.membership.end } : null);
    setPeriodMsg(null);
    setError('');
  };
  const closeModal = () => { setEditing(null); setError(''); setConfirmDelete(false); setPeriod(null); setPeriodMsg(null); };

  // Masa aktif keanggotaan (khusus anggota aktif), disimpan terpisah dari data akun
  const [period, setPeriod] = useState(null);
  const [periodMsg, setPeriodMsg] = useState(null); // { ok, text }
  const [savingPeriod, setSavingPeriod] = useState(false);
  const periodChanged = period && editing?.membership
    && (period.start !== editing.membership.start || period.end !== editing.membership.end);
  const savePeriod = async () => {
    if (!period?.start || !period?.end) { setPeriodMsg({ ok: false, text: 'Isi tanggal mulai & berakhir.' }); return; }
    if (period.end <= period.start) { setPeriodMsg({ ok: false, text: 'Tanggal berakhir harus setelah tanggal mulai.' }); return; }
    setSavingPeriod(true);
    setPeriodMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${editing.id}/membership`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ issuedAt: period.start, validUntil: period.end }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah masa aktif.');
      setPeriodMsg({ ok: true, text: data.message });
      setEditing((e) => ({ ...e, membership: { ...e.membership, start: period.start, end: period.end } }));
      loadUsers();
    } catch (err) {
      setPeriodMsg({ ok: false, text: err.message });
    } finally {
      setSavingPeriod(false);
    }
  };

  // Klik pertama meminta konfirmasi, klik kedua menghapus
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${editing.id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus akun.');
      setNotice(data.message);
      closeModal();
      loadUsers();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  };

  const isNew = editing && !editing.id;
  const isSelf = editing?.id === me?.id;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...form };
      if (!isNew && !body.password) delete body.password;
      const res = await fetch(isNew ? '/api/admin/users' : `/api/admin/users/${editing.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan akun.');
      setNotice(data.message);
      closeModal();
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full text-sm px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-[#0da2e7] focus:ring-2 focus:ring-sky-100 outline-none disabled:bg-slate-50 disabled:text-slate-400';

  return (
    <div className="space-y-6">

      {/* Judul */}
      <div className="card-surface p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-800 rounded-xl text-white">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-light tracking-tight text-slate-900">Kelola Akun Pengguna</h2>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-sm font-bold rounded-xl transition flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Tambah Akun
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Tutup pesan" className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Jumlah per peran (klik untuk memfilter) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {GROUPS.map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(roleFilter === r ? 'Semua' : r)}
            className={`panel-surface p-4 text-left transition ${roleFilter === r ? 'ring-2 ring-[#0da2e7]' : 'hover:-translate-y-0.5'}`}
          >
            <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${ROLE_BADGE[r]}`}>{r}</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{counts[r] ?? 0}</div>
            <div className="text-[11px] text-slate-500 leading-snug">{GROUP_DESC[r]}</div>
          </button>
        ))}
      </div>

      {/* Daftar akun */}
      <div className="card-surface overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              className={`${field} pl-9`}
            />
          </div>
          <div className="flex gap-2">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter peran" className={`${field} sm:w-44`}>
              <option value="Semua">Semua peran</option>
              {GROUPS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={loadUsers} title="Muat ulang" className="p-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Memuat daftar akun...</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Tidak ada akun yang cocok.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((u) => (
              <li key={u.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 hover:bg-slate-50 transition">
                <span className="w-10 h-10 flex-shrink-0 rounded-full bg-slate-100 text-slate-600 text-sm font-bold flex items-center justify-center">
                  {u.name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-sm text-slate-900 truncate">{u.name}</span>
                    {u.id === me?.id && <span className="text-[10px] font-bold text-slate-400 uppercase">Anda</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                  {memberInfo(u) && (
                    <div className={`text-[11px] mt-0.5 ${u.onboarded_at ? 'text-slate-500' : 'text-blue-700'}`}>{memberInfo(u)}</div>
                  )}
                  {u.role === 'Anggota' && u.onboarded_at && !u.membership && (
                    <div className="text-[11px] mt-0.5 flex items-center gap-1 text-slate-400">
                      <CalendarClock className="w-3 h-3 flex-shrink-0" />
                      Belum ada masa aktif · {u.submission_status ? `pengajuan ${u.submission_status.toLowerCase()}` : 'belum mengirim pengajuan'}
                    </div>
                  )}
                  {u.membership && (
                    <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${u.membership.left > 30 ? 'text-emerald-700' : u.membership.left > 0 ? 'text-amber-700' : 'text-red-600'}`}>
                      <CalendarClock className="w-3 h-3 flex-shrink-0" /> {periodText(u.membership)}
                    </div>
                  )}
                </div>
                <span className={`hidden sm:inline-block flex-shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${ROLE_BADGE[groupOf(u)]}`}>
                  {groupOf(u)}
                </span>
                {u.membership && (
                  <button
                    onClick={() => setMemberData(u)}
                    title="Kelola data penerbit"
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Data penerbit</span>
                  </button>
                )}
                <button
                  onClick={() => openEdit(u)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-[#0884c4] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Ubah</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal tambah / ubah akun */}
      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto modal-overlay flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="modal-surface w-full max-w-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium text-slate-900">{isNew ? 'Tambah akun baru' : 'Ubah akun'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{isNew ? 'Akun langsung aktif dan bisa dipakai login.' : editing.email}</p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Tutup" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Nama lengkap</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Nomor telepon</label>
                <input type="tel" {...PHONE} value={form.phone} onChange={(e) => setForm({ ...form, phone: FILTERS.phone(e.target.value) })} placeholder="08XXXXXXXXXX" className={field} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Peran</label>
                <select value={form.role} disabled={isSelf} onChange={(e) => setForm({ ...form, role: e.target.value })} className={field}>
                  {ROLES.map((r) => <option key={r} value={r}>{r} — {ROLE_DESC[r]}</option>)}
                </select>
                {isSelf && <p className="text-[11px] text-slate-400 mt-1">Peran akun Anda sendiri tidak bisa diubah.</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">
                  {isNew ? 'Kata sandi' : 'Kata sandi baru'}
                  {!isNew && <span className="font-normal text-slate-400"> (kosongkan jika tidak diubah)</span>}
                </label>
                <input
                  type="password"
                  required={isNew}
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                  className={field}
                />
              </div>
            </div>

            {!isNew && editing.role === 'Anggota' && !editing.membership && (
              <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
                <CalendarClock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                Masa aktif bisa diubah setelah akun ini menjadi anggota aktif
                {editing.submission_status ? ` (pengajuan saat ini: ${editing.submission_status}).` : ' (belum mengirim pengajuan).'}
              </p>
            )}

            {!isNew && editing.membership && period && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                <div className="flex items-start gap-2.5">
                  <CalendarClock className="w-4 h-4 text-[#0884c4] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Masa aktif keanggotaan</p>
                    <p className="text-[11px] text-slate-500">
                      Saat ini {fmtDay(editing.membership.start)} s.d. {fmtDay(editing.membership.end)}. Anggota mendapat notifikasi bila diubah.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Mulai</label>
                    <input type="date" value={period.start} max={period.end || undefined}
                      onChange={(e) => { setPeriod({ ...period, start: e.target.value }); setPeriodMsg(null); }} className={field} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Berakhir</label>
                    <input type="date" value={period.end} min={period.start || undefined}
                      onChange={(e) => { setPeriod({ ...period, end: e.target.value }); setPeriodMsg(null); }} className={field} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={() => { const u = editing; closeModal(); setMemberData(u); }}
                    className="mr-auto px-3 py-2 text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 rounded-lg transition flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Kelola data penerbit
                  </button>
                  {periodMsg && (
                    <span className={`mr-auto text-xs ${periodMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{periodMsg.text}</span>
                  )}
                  <button type="button" onClick={savePeriod} disabled={savingPeriod || !periodChanged}
                    className="px-4 py-2 bg-white border border-sky-200 text-[#0884c4] hover:bg-sky-50 disabled:opacity-50 text-xs font-bold rounded-lg transition">
                    {savingPeriod ? 'Menyimpan...' : 'Simpan masa aktif'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {!isNew && !isSelf && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className={`mr-auto px-4 py-2.5 text-sm font-semibold rounded-xl transition disabled:opacity-60 ${
                    confirmDelete ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  {confirmDelete ? 'Yakin hapus akun?' : 'Hapus akun'}
                </button>
              )}
              <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                Batal
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#0da2e7] hover:bg-[#0884c4] disabled:opacity-60 text-white text-sm font-bold rounded-xl transition">
                {saving ? 'Menyimpan...' : isNew ? 'Buat akun' : 'Simpan perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {memberData && (
        <AdminMemberDataModal
          user={memberData}
          onClose={() => setMemberData(null)}
          onSaved={(msg) => { setMemberData(null); setNotice(msg); loadUsers(); }}
        />
      )}
    </div>
  );
}
