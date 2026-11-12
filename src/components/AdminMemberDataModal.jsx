import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Building2, Save, IdCard } from 'lucide-react';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`,
});

// [key, label, wajib, tipe, lebar penuh]
const FIELDS = [
  ['publisherName', 'Nama penerbit', true, 'text', true],
  ['legalEntity', 'Badan usaha'], ['nib', 'NIB'], ['npwp', 'NPWP'],
  ['leaderName', 'Nama pimpinan', true], ['leaderTitle', 'Jabatan pimpinan'], ['leaderPhone', 'Telepon pimpinan'],
  ['personInCharge', 'PJ redaksi / editor', true],
  ['address', 'Alamat', true, 'textarea', true], ['city', 'Kota/kabupaten', true], ['postalCode', 'Kode pos'],
  ['phone', 'Telepon', true], ['fax', 'Faks'], ['email', 'Email', true, 'email'], ['website', 'Website'],
  ['specialization', 'Spesialisasi', false, 'textarea', true],
];

/**
 * Admin mengelola data penerbit milik anggota aktif.
 * No. KTA hanya ditampilkan (diisi pemohon & divalidasi lewat alurnya sendiri).
 */
export default function AdminMemberDataModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [kta, setKta] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${user.id}/member`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data penerbit.');
        if (!alive) return;
        const { kta_number: k, membership_status: _s, ...rest } = data.member;
        setKta(k || '');
        setForm(rest);
      } catch (err) {
        if (alive) setLoadErr(err.message);
      }
    })();
    return () => { alive = false; };
  }, [user.id]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${user.id}/member`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data penerbit.');
      onSaved(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#0da2e7] focus:ring-2 focus:ring-sky-100 outline-none';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto modal-overlay flex items-center justify-center p-4">
      <form onSubmit={save} className="modal-surface w-full max-w-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-xl bg-sky-50 text-[#0884c4] ring-1 ring-sky-100"><Building2 className="w-5 h-5" /></span>
            <div>
              <h3 className="text-lg font-medium text-slate-900">Data penerbit anggota</h3>
              <p className="text-xs text-slate-500 mt-0.5">{user.name} · {user.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadErr ? (
          <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{loadErr}</p>
        ) : !form ? (
          <p className="py-8 text-center text-sm text-slate-400">Memuat data penerbit...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <IdCard className="w-4 h-4 text-[#0884c4]" />
              <span className="text-xs text-slate-500">No. KTA</span>
              <span className="font-mono text-sm font-bold text-slate-800">{kta || '—'}</span>
              <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
                Kategori
                <select value={form.category || 'Biasa'} onChange={set('category')} className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
                  <option value="Biasa">Anggota Biasa</option>
                  <option value="Luar Biasa">Anggota Luar Biasa</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
              {FIELDS.map(([k, label, req, type, full]) => (
                <label key={k} className={`block ${full ? 'sm:col-span-2' : ''}`}>
                  <span className="text-xs font-semibold text-slate-600 block mb-1">{label}{req && <span className="text-red-500"> *</span>}</span>
                  {type === 'textarea'
                    ? <textarea rows={2} value={form[k] || ''} onChange={set(k)} className={field} />
                    : <input type={type || 'text'} required={req} value={form[k] || ''} onChange={set(k)} className={field} />}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">Anggota mendapat notifikasi berisi daftar data yang diubah. No. KTA tidak diubah di sini.</p>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">Batal</button>
          <button type="submit" disabled={saving || !form} className="px-5 py-2.5 bg-[#0da2e7] hover:bg-[#0884c4] disabled:opacity-60 text-white text-sm font-bold rounded-xl transition flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan data penerbit'}
          </button>
        </div>
      </form>
    </div>
  );
}
