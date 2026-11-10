import { useMemo, useState } from 'react';
import {
  Building2, Save, User, Briefcase, Phone, Mail, Globe, MapPin, Hash, FileText,
  BookOpen, Lock, Printer, Landmark, Mailbox, BadgeCheck, AlertCircle,
} from 'lucide-react';
import ModalFrame from './ModalFrame';
import { FILTERS, NUMERIC, PHONE } from '../utils/inputFilters';

const token = () => localStorage.getItem('ikapi_token');
// Data lama kadang berisi "-" sebagai penanda kosong
const clean = (v) => (v == null || String(v).trim() === '-' ? '' : String(v));

// Dikelompokkan per bagian supaya mudah dipindai
const SECTIONS = [
  {
    title: 'Pimpinan & redaksi', desc: 'Penanggung jawab penerbit', icon: User, tint: 'from-sky-500 to-blue-600',
    fields: [
      { key: 'leaderName', label: 'Nama pimpinan', icon: User, required: true, placeholder: 'Nama lengkap pimpinan' },
      { key: 'leaderTitle', label: 'Jabatan', icon: Briefcase, placeholder: 'Mis. Direktur Utama' },
      { key: 'leaderPhone', label: 'No. HP pimpinan', icon: Phone, filter: FILTERS.phone, attrs: PHONE, placeholder: '08xxxxxxxxxx' },
      { key: 'personInCharge', label: 'PJ redaksi / editor', icon: BookOpen, required: true, placeholder: 'Nama penanggung jawab redaksi' },
    ],
  },
  {
    title: 'Kontak penerbit', desc: 'Dipakai Admin untuk menghubungi Anda', icon: Phone, tint: 'from-emerald-500 to-teal-600',
    fields: [
      { key: 'phone', label: 'Telepon kantor', icon: Phone, required: true, filter: FILTERS.phone, attrs: PHONE, placeholder: '022xxxxxxx' },
      { key: 'fax', label: 'Fax', icon: Printer, filter: FILTERS.phone, attrs: PHONE, placeholder: 'Opsional' },
      { key: 'email', label: 'Email penerbit', icon: Mail, required: true, type: 'email', placeholder: 'nama@penerbit.id' },
      { key: 'website', label: 'Website', icon: Globe, placeholder: 'Opsional' },
    ],
  },
  {
    title: 'Legalitas & terbitan', desc: 'Identitas usaha dan bidang terbitan', icon: Landmark, tint: 'from-violet-500 to-indigo-600',
    fields: [
      { key: 'legalEntity', label: 'Badan usaha', icon: Landmark, options: ['PT', 'CV', 'Yayasan', 'Perguruan Tinggi', 'Lainnya'] },
      { key: 'nib', label: 'NIB', icon: Hash, filter: FILTERS.digits, attrs: NUMERIC, placeholder: 'Nomor Induk Berusaha' },
      { key: 'npwp', label: 'NPWP', icon: FileText, filter: FILTERS.npwp, attrs: NUMERIC, placeholder: '00.000.000.0-000.000' },
      { key: 'specialization', label: 'Spesialisasi terbitan', icon: BookOpen, placeholder: 'Mis. Buku anak, pendidikan' },
    ],
  },
  {
    title: 'Alamat kantor', desc: 'Alamat surat-menyurat', icon: MapPin, tint: 'from-amber-500 to-orange-600',
    fields: [
      { key: 'address', label: 'Alamat lengkap', icon: MapPin, required: true, wide: true, textarea: true, placeholder: 'Jalan, nomor, RT/RW, kelurahan, kecamatan' },
      { key: 'city', label: 'Kota / kabupaten', icon: Building2, required: true, placeholder: 'Mis. Kota Bandung' },
      { key: 'postalCode', label: 'Kode pos', icon: Mailbox, filter: FILTERS.digits, attrs: NUMERIC, placeholder: '40xxx' },
    ],
  },
];
const FIELDS = SECTIONS.flatMap((s) => s.fields);

/**
 * Formulir perbarui data penerbit untuk anggota aktif.
 * Hanya mengubah data kontak & profil; nama penerbit, kategori & KTA tetap.
 */
export default function ProfileEditModal({ sub, onClose, onSaved }) {
  const initial = useMemo(() => ({
    leaderName: clean(sub.leader_name), leaderTitle: clean(sub.leader_title), leaderPhone: clean(sub.leader_phone),
    legalEntity: clean(sub.legal_entity), nib: clean(sub.nib), npwp: clean(sub.npwp),
    personInCharge: clean(sub.person_in_charge), phone: clean(sub.publisher_phone), fax: clean(sub.fax),
    email: clean(sub.publisher_email), website: clean(sub.website), specialization: clean(sub.specialization),
    address: clean(sub.address), city: clean(sub.city), postalCode: clean(sub.postal_code),
  }), [sub]);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const changed = FIELDS.filter((f) => String(form[f.key] ?? '').trim() !== String(initial[f.key] ?? '').trim());
  const missing = FIELDS.filter((f) => f.required && !String(form[f.key] || '').trim());
  const kta = sub.member_kta || sub.kta_number || sub.kta_number_submitted;
  const category = sub.member_category || sub.category || 'Biasa';

  const set = (f) => (e) => {
    const v = f.filter ? f.filter(e.target.value) : e.target.value;
    setForm((p) => ({ ...p, [f.key]: v }));
  };

  const save = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (missing.length) { setError(`${missing.map((f) => f.label).join(', ')} wajib diisi.`); return; }
    if (!changed.length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/members/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      onSaved?.(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f) => {
    const isChanged = changed.includes(f);
    const isMissing = touched && f.required && !String(form[f.key] || '').trim();
    const ring = isMissing
      ? 'border-red-300 bg-red-50/40 focus-within:ring-red-200'
      : isChanged
        ? 'border-[#3b82f6]/60 bg-blue-50/40 focus-within:ring-[#3b82f6]/25'
        : 'border-slate-200 bg-white hover:border-slate-300 focus-within:ring-[#3b82f6]/25';
    const Icon = f.icon;
    const base = 'w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none';
    return (
      <label key={f.key} className={`block ${f.wide ? 'sm:col-span-2' : ''}`}>
        <span className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-600">
            {f.label}{f.required && <span className="text-red-500"> *</span>}
          </span>
          {isChanged && <span className="text-[10px] font-semibold text-[#3b82f6] bg-blue-50 rounded-full px-2 py-0.5">Diubah</span>}
        </span>
        <span className={`flex ${f.textarea ? 'items-start' : 'items-center'} gap-2.5 rounded-xl border px-3 py-2.5 transition focus-within:ring-4 ${ring}`}>
          <Icon className={`w-4 h-4 flex-shrink-0 ${f.textarea ? 'mt-0.5' : ''} ${isChanged ? 'text-[#3b82f6]' : 'text-slate-400'}`} />
          {f.options ? (
            <select value={form[f.key]} onChange={set(f)} className={`${base} cursor-pointer`}>
              <option value="">Pilih badan usaha</option>
              {[...new Set([...(form[f.key] && !f.options.includes(form[f.key]) ? [form[f.key]] : []), ...f.options])]
                .map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.textarea ? (
            <textarea rows={2} value={form[f.key]} onChange={set(f)} placeholder={f.placeholder} className={`${base} resize-y`} />
          ) : (
            <input type={f.type || 'text'} value={form[f.key]} onChange={set(f)} placeholder={f.placeholder}
              {...(f.attrs || {})} className={base} />
          )}
        </span>
      </label>
    );
  };

  return (
    <ModalFrame maxWidth="max-w-3xl" onClose={saving ? undefined : onClose}>
      <form onSubmit={save} className="bg-slate-50">
        {/* Header bergradien dengan identitas penerbit yang terkunci */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0b5fa8] via-[#1d74d8] to-[#3b82f6] px-5 sm:px-7 pt-6 pb-5 text-white">
          <div aria-hidden="true" className="absolute -right-10 -top-12 w-48 h-48 rounded-full bg-white/10" />
          <div aria-hidden="true" className="absolute right-16 -bottom-16 w-40 h-40 rounded-full bg-white/5" />
          <div className="relative flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-white/70">Perbarui data</p>
              <h3 className="text-xl font-medium truncate">{sub.publisher_name || 'Data penerbit'}</h3>
              <p className="text-xs text-white/75 mt-0.5">Perbarui data yang berubah, lalu simpan. Admin akan menerima pemberitahuan.</p>
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2">
            {kta && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 ring-1 ring-white/20 px-3 py-1 text-xs">
                <BadgeCheck className="w-3.5 h-3.5" /> KTA <span className="font-mono">{kta}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 ring-1 ring-white/20 px-3 py-1 text-xs">
              Anggota {category}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-[11px] text-white/80">
              <Lock className="w-3 h-3" /> Nama, kategori & KTA hanya bisa diubah Admin
            </span>
          </div>
        </div>

        {/* Bagian-bagian formulir */}
        <div className="px-4 sm:px-7 py-5 space-y-4">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const count = s.fields.filter((f) => changed.includes(f)).length;
            return (
              <section key={s.title} className="rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.tint} text-white flex items-center justify-center shadow-sm`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800">{s.title}</h4>
                    <p className="text-xs text-slate-500">{s.desc}</p>
                  </div>
                  {count > 0 && (
                    <span className="text-[11px] font-medium text-[#3b82f6] bg-blue-50 rounded-full px-2.5 py-1">{count} diubah</span>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5">
                  {s.fields.map(renderField)}
                </div>
              </section>
            );
          })}

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-100 rounded-xl px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </p>
          )}
        </div>

        {/* Bilah aksi */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-7 py-4">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            {changed.length
              ? <><span className="font-semibold text-[#3b82f6]">{changed.length} data</span> akan diperbarui</>
              : 'Belum ada data yang diubah'}
          </p>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="soft-pill flex-1 sm:flex-none justify-center">Batal</button>
            <button type="submit" disabled={saving || !changed.length}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#1d74d8] to-[#3b82f6] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 shadow-md shadow-blue-500/25 transition">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </div>
        </div>
      </form>
    </ModalFrame>
  );
}
