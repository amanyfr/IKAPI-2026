import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Search, Pencil, X, AlertCircle, RefreshCw } from 'lucide-react';
import { FILTERS, PHONE } from '../utils/inputFilters';

const ROLES = ['Admin', 'Sekretaris', 'Ketua', 'Anggota'];

const ROLE_BADGE = {
  Admin:      'bg-blue-50 text-blue-800 border-blue-200',
  Sekretaris: 'bg-sky-50 text-[#0884c4] border-sky-200',
  Ketua:      'bg-indigo-50 text-indigo-700 border-indigo-200',
  Anggota:    'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const ROLE_DESC = {
  Admin:      'Kelola akun & pengaturan sistem',
  Sekretaris: 'Screening berkas, verifikasi pembayaran, input No. KTA',
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
  return `Anggota ${u.member_type?.toLowerCase()} · ${u.member_category}`;
};

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

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const counts = useMemo(
    () => Object.fromEntries(ROLES.map((r) => [r, users.filter((u) => u.role === r).length])),
    [users]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      (roleFilter === 'Semua' || u.role === roleFilter) &&
      (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
  }, [users, search, roleFilter]);

  const openCreate = () => { setEditing({}); setForm(EMPTY_FORM); setError(''); };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, phone: u.phone || '', role: u.role, password: '' });
    setError('');
  };
  const closeModal = () => { setEditing(null); setError(''); setConfirmDelete(false); };

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
            <p className="text-xs text-slate-500 mt-0.5">Tambah akun dan atur peran Admin, Sekretaris, Ketua, atau Anggota.</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(roleFilter === r ? 'Semua' : r)}
            className={`panel-surface p-4 text-left transition ${roleFilter === r ? 'ring-2 ring-[#0da2e7]' : 'hover:-translate-y-0.5'}`}
          >
            <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${ROLE_BADGE[r]}`}>{r}</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-2">{counts[r] ?? 0}</div>
            <div className="text-[11px] text-slate-500 leading-snug">{ROLE_DESC[r]}</div>
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
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
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
                </div>
                <span className={`hidden sm:inline-block flex-shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${ROLE_BADGE[u.role]}`}>
                  {u.role}
                </span>
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
    </div>
  );
}
