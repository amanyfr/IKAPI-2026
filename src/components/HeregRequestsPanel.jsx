import React, { useEffect, useState, useRef } from 'react';
import {
  RefreshCw, UserCheck, XCircle, CheckCircle, X, AlertTriangle, BadgeCheck, RotateCcw, ShieldCheck, FileText, CalendarClock, Pencil, Save,
} from 'lucide-react';
import { notify } from './AppDialog';
import { fileUrl } from '../utils/fileUrl';

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` });
const fmtDate = (v) => (v ? new Date(String(v).length <= 10 ? `${v}T00:00:00` : v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const daysLeft = (v) => {
  if (!v) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${String(v).slice(0, 10)}T00:00:00`) - today) / 86400000);
};

function Modal({ children, onClose, saving }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => !saving && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden my-auto" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHead({ eyebrow, title, subtitle, onClose, saving, tone = 'text-amber-600' }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div>
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${tone}`}>{eyebrow}</p>
        <h3 className="text-sm font-bold text-slate-800 mt-0.5">{title}</h3>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
      <button type="button" onClick={onClose} disabled={saving} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Tutup">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Kelompok data ringkas: label di atas nilai, 2 kolom; isian panjang selebar penuh
function Section({ title, items }) {
  const list = items.map(([k, v, full]) => [k, v === null || v === undefined || v === '' ? '-' : v, full]);
  return (
    <section>
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{title}</h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
        {list.map(([k, v, full]) => (
          <div key={k} className={`min-w-0 ${full ? 'col-span-2' : ''}`}>
            <dt className="text-[10px] text-slate-500">{k}</dt>
            <dd className="text-xs font-medium text-slate-800 break-words leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}


// Status masa berlaku KTA + tombol ubah data
function KtaCard({ validUntil, left, action }) {
  const ok = left > 0;
  return (
    <div className={`rounded-xl p-3 border flex items-center gap-3 ${ok ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
      <CalendarClock className={`w-5 h-5 flex-shrink-0 ${ok ? 'text-emerald-600' : 'text-red-600'}`} />
      <div className="min-w-0 flex-1 text-xs">
        <p className={`font-semibold ${ok ? 'text-emerald-800' : 'text-red-800'}`}>
          {ok ? `KTA masih berlaku · ${left} hari lagi` : 'Masa berlaku KTA sudah lewat'}
        </p>
        <p className={ok ? 'text-emerald-700' : 'text-red-700'}>Berlaku sampai {fmtDate(validUntil)}</p>
      </div>
      {action}
    </div>
  );
}

// Isian data penerbit pada formulir anggota lama — urutan & label sama dengan formulir pemohon.
// [key, label, wajib, tipe, lebar penuh]
const EDIT_FIELDS = [
  ['publisherName', 'Nama penerbit', true, 'text', true], ['legalEntity', 'Badan usaha'], ['nib', 'NIB'],
  ['leaderName', 'Nama pimpinan', true], ['leaderTitle', 'Jabatan pimpinan'],
  ['personInCharge', 'Penanggung jawab / PIC', true], ['leaderPhone', 'No. HP pimpinan'],
  ['address', 'Alamat', true, 'textarea', true], ['city', 'Kota / kabupaten', true], ['postalCode', 'Kode pos'],
  ['phone', 'Telepon penerbit', true], ['email', 'Email penerbit', true, 'email'],
  ['website', 'Website'], ['specialization', 'Spesialisasi terbitan'],
  ['notes', 'Catatan untuk Admin', false, 'textarea', true],
];

// Tampilan baca: semua isian formulir pemohon, satu per satu
const ktaItems = (d, proof, proofName) => [
  ['Nomor KTA', <span className="font-mono font-bold">{d.ktaNumber || '-'}</span>, true],
  ['Tanggal terbit', fmtDate(d.issuedAt)],
  ['Berlaku sampai', fmtDate(d.validUntil)],
  ['Bukti KTA', proof ? (
    <a href={fileUrl(proof)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline max-w-full">
      <FileText className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{proofName || 'Lihat bukti'}</span>
    </a>
  ) : '-', true],
];
const publisherItems = (d) => EDIT_FIELDS.map(([k, label, , , full]) => [label, d[k], full]);

function EditMigForm({ userId, initial, onCancel, onSaved }) {
  const [f, setF] = useState(() => {
    const o = {};
    for (const [k] of EDIT_FIELDS) o[k] = initial?.[k] || '';
    o.ktaNumber = initial?.ktaNumber || '';
    o.issuedAt = String(initial?.issuedAt || '').slice(0, 10);
    o.validUntil = String(initial?.validUntil || '').slice(0, 10);
    return o;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: k === 'ktaNumber' ? e.target.value.toUpperCase() : e.target.value }));
  const input = 'w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-200 focus:border-sky-400 outline-none';

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const res = await fetch(`/api/admin/hereg-requests/${userId}/data`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(f),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      onSaved(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
      <p className="text-[11px] text-slate-500">Perbaiki isian yang keliru. Pemohon mendapat notifikasi daftar data yang diubah.</p>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="col-span-2 block">
          <span className="block text-[11px] font-semibold text-slate-600 mb-1">Nomor KTA <span className="text-red-500">*</span></span>
          <input value={f.ktaNumber} onChange={set('ktaNumber')} className={`${input} font-mono`} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-slate-600 mb-1">Tanggal terbit <span className="text-red-500">*</span></span>
          <input type="date" value={f.issuedAt} onChange={set('issuedAt')} className={input} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-slate-600 mb-1">Berlaku sampai <span className="text-red-500">*</span></span>
          <input type="date" value={f.validUntil} onChange={set('validUntil')} className={input} />
        </label>
        {EDIT_FIELDS.map(([k, label, req, type, full]) => (
          <label key={k} className={`block ${full ? 'col-span-2' : ''}`}>
            <span className="block text-[11px] font-semibold text-slate-600 mb-1">{label}{req && <span className="text-red-500"> *</span>}</span>
            {type === 'textarea'
              ? <textarea rows={2} value={f[k]} onChange={set(k)} className={input} />
              : <input type={type || 'text'} value={f[k]} onChange={set(k)} className={input} />}
          </label>
        ))}
      </div>
      {err && <p className="text-[11px] text-red-600 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
        <button type="button" onClick={save} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#0884c4] hover:bg-[#076fa5] text-white disabled:opacity-50 flex items-center gap-1">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Simpan perubahan'}
        </button>
      </div>
    </div>
  );
}

/**
 * Antrean Admin untuk anggota lama:
 * 1. Verifikasi data KTA lama: setujui (langsung Anggota Aktif) atau tolak.
 * 2. Validasi masa aktif akun lama yang dulu mengisi data keanggotaan terpisah.
 */
export default function HeregRequestsPanel() {
  const [items, setItems] = useState([]);
  const [migs, setMigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const [migReview, setMigReview] = useState(null);
  const [mode, setMode] = useState(null); // null | 'reject' | 'renew'
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Spinner hanya saat pemuatan pertama; muat ulang sesudahnya senyap agar tabel tidak berkedip
  const loadedOnce = useRef(false);
  const load = async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/hereg-requests', { headers: authHeader() }),
        fetch('/api/admin/hereg-migrations', { headers: authHeader() }),
      ]);
      const [d1, d2] = await Promise.all([r1.json().catch(() => []), r2.json().catch(() => [])]);
      if (r1.ok) setItems(Array.isArray(d1) ? d1 : []);
      if (r2.ok) setMigs(Array.isArray(d2) ? d2 : []);
    } catch (err) {
      console.error('Gagal memuat antrean anggota lama:', err);
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const open = (item) => { setReview(item); setMode(null); setNote(''); setEditing(false); };
  const openMig = (item) => { setMigReview(item); setMode(null); setNote(''); setEditing(false); };
  const close = () => { setReview(null); setMigReview(null); setEditing(false); };

  // Data hasil koreksi Admin: perbarui modal & daftar tanpa menutup modal
  const onEdited = (data) => {
    const patch = (it) => ({
      ...it, hereg_mig_data: data.hereg_mig_data, old_kta_number: data.old_kta_number,
      ...(data.kta_matches ? { kta_matches: data.kta_matches } : {}),
    });
    const id = (review || migReview)?.id;
    if (review) setReview(patch);
    if (migReview) setMigReview(patch);
    setItems((l) => l.map((it) => (it.id === id ? patch(it) : it)));
    setMigs((l) => l.map((it) => (it.id === id ? patch(it) : it)));
    setEditing(false);
    notify(data.message);
  };
  const editBtn = (
    <button type="button" onClick={() => { setEditing(true); setMode(null); }} disabled={saving}
      className="ml-auto flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0884c4] bg-white hover:bg-sky-50 border border-sky-200">
      <Pencil className="w-3 h-3" /> Ubah data
    </button>
  );

  const post = async (url, body) => {
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      close();
      notify(data.message);
      load();
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = (decision) => {
    if (decision === 'reject' && !note.trim()) {
      notify('Tulis alasan penolakan supaya pemohon tahu apa yang harus diperbaiki.');
      return;
    }
    post(`/api/admin/hereg-requests/${review.id}/review`, {
      decision, note: decision === 'reject' ? note.trim() : undefined,
    });
  };

  const submitMig = (decision) => {
    if (decision === 'reject' && !note.trim()) {
      notify('Tulis alasan penolakan supaya pemohon tahu apa yang harus diperbaiki.');
      return;
    }
    post(`/api/admin/hereg-migrations/${migReview.id}/review`, { decision, note: note.trim() || undefined });
  };

  // Tidak ada antrean: panel tidak memakan tempat
  if (!loading && items.length === 0 && migs.length === 0) return null;
  const total = items.length + migs.length;
  const md = migReview?.hereg_mig_data || {};
  const migLeft = daysLeft(md.validUntil);
  const rd = review?.hereg_mig_data?.ktaNumber ? review.hereg_mig_data : null;
  const rdLeft = rd ? daysLeft(rd.validUntil) : null;

  return (
    <div className="card-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100"><UserCheck className="w-4 h-4" /></span>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Verifikasi anggota lama {total > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{total}</span>}
            </h3>
            <p className="text-[11px] text-slate-500">
              Cocokkan data KTA lama, lalu setujui atau tolak.
            </p>
          </div>
        </div>
        <button type="button" onClick={load} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Muat ulang">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {items.length > 0 && (
        <>
          {migs.length > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Verifikasi KTA lama</p>}
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {items.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-white">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">{it.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{it.email}{it.phone ? ` · ${it.phone}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs font-bold text-slate-800">{it.old_kta_number || '-'}</p>
                  <p className={`text-[10px] font-medium ${it.kta_matches?.length ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {it.kta_matches?.length ? 'Cocok dengan data anggota' : 'Tidak ada di data anggota'}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 w-20 text-right hidden sm:block">{fmtDate(it.hereg_requested_at || it.onboarded_at)}</span>
                <button type="button" onClick={() => open(it)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verifikasi
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {migs.length > 0 && (
        <>
          <p className={`text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 ${items.length ? 'mt-4' : ''}`}>Validasi masa aktif · data manual</p>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {migs.map((it) => {
              const d = it.hereg_mig_data || {};
              const left = daysLeft(d.validUntil);
              return (
                <div key={it.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-white">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{d.publisherName || it.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{it.name} · {it.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-bold text-slate-800">{d.ktaNumber || it.old_kta_number}</p>
                    <p className={`text-[10px] font-medium ${left > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {left > 0 ? `Berlaku s.d. ${fmtDate(d.validUntil)}` : 'Masa berlaku lewat'}
                    </p>
                  </div>
                  <button type="button" onClick={() => openMig(it)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0884c4] hover:bg-[#076fa5] text-white flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Validasi
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Modal 1: verifikasi KTA lama (setujui / tolak) ── */}
      {review && (
        <Modal onClose={close} saving={saving}>
          <ModalHead eyebrow="Verifikasi anggota lama" title={review.name}
            subtitle="Pastikan pemohon benar pernah terdaftar, lalu setujui atau tolak." onClose={close} saving={saving} />

          {rd && (
            <div className="px-5 pt-4">
              <KtaCard validUntil={rd.validUntil} left={rdLeft} action={!editing && editBtn} />
            </div>
          )}

          {editing && rd ? (
            <EditMigForm userId={review.id} initial={rd} onCancel={() => setEditing(false)} onSaved={onEdited} />
          ) : (<>
          <div className={`px-5 py-4 space-y-3 ${rd ? 'max-h-[42vh] overflow-y-auto' : ''}`}>
            {rd ? (<>
              <Section title="Data KTA" items={ktaItems(rd, review.hereg_mig_proof, review.hereg_mig_proof_name)} />
              <Section title="Data penerbit" items={publisherItems(rd)} />
              <Section title="Akun pemohon" items={[
                ['Kategori', review.member_category === 'Luar Biasa' ? 'Luar Biasa' : 'Biasa'],
                ['Akun dibuat', fmtDate(review.created_at)],
                ['Telepon akun', review.phone],
                ['Email akun', review.email, true],
              ]} />
            </>) : (
              <Section title="Data pendaftaran" items={[
                ['Nomor KTA lama', <span className="font-mono font-bold">{review.old_kta_number || '-'}</span>, true],
                ['Kategori', review.member_category === 'Luar Biasa' ? 'Luar Biasa' : 'Biasa'],
                ['Akun dibuat', fmtDate(review.created_at)],
                ['Email', review.email],
                ['Telepon', review.phone || '-'],
              ]} />
            )}
            {review.kta_matches?.length ? (
              <div className="space-y-1">
                {review.kta_matches.map((m, i) => (
                  <p key={i} className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800 flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Cocok dengan data anggota: <b>{m.publisher_name || '-'}</b> · {m.membership_status} · {m.category}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-[11px] text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                KTA belum tercatat di sistem. Cek arsip / IKAPI Pusat dulu.
              </p>
            )}
          </div>

          {mode === 'reject' ? (
            <div className="px-5 pb-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Alasan penolakan <span className="text-red-500">*</span></label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
                placeholder="Contoh: Nomor KTA tidak ditemukan di arsip IKAPI Jawa Barat."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-red-400" />
              <p className="text-[10px] text-slate-500 mt-1">Alasan ini dikirim ke pemohon untuk diperbaiki.</p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-100">
            {mode === 'reject' ? (
              <>
                <button type="button" onClick={() => setMode(null)} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="button" onClick={() => submit('reject')} disabled={saving || !note.trim()} className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Kirim penolakan'}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setMode('reject')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Tolak
                </button>
                <button type="button" onClick={() => submit('approve')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Setujui'}
                </button>
              </>
            )}
          </div>
          </>)}
        </Modal>
      )}

      {/* ── Modal 2: validasi masa aktif anggota lama (data manual) ── */}
      {migReview && (
        <Modal onClose={close} saving={saving}>
          <ModalHead eyebrow="Validasi anggota masih aktif" tone="text-[#0884c4]" title={md.publisherName || migReview.name}
            subtitle="Cocokkan data & bukti KTA. Bila masih berlaku, pemohon langsung jadi Anggota Aktif." onClose={close} saving={saving} />

          <div className="px-5 pt-4">
            <KtaCard validUntil={md.validUntil} left={migLeft} action={!editing && editBtn} />
            {md.ktaNumber && migReview.old_kta_number && md.ktaNumber !== String(migReview.old_kta_number).toUpperCase() && (
              <p className="mt-2 text-[11px] text-amber-700 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> Berbeda dengan KTA lama saat daftar: {migReview.old_kta_number}
              </p>
            )}
          </div>

          {editing ? (
            <EditMigForm userId={migReview.id} initial={md} onCancel={() => setEditing(false)} onSaved={onEdited} />
          ) : (<>
          <div className="px-5 py-4 space-y-3 max-h-[42vh] overflow-y-auto">
            <Section title="Data KTA" items={ktaItems(md, migReview.hereg_mig_proof, migReview.hereg_mig_proof_name)} />
            <Section title="Data penerbit" items={publisherItems(md)} />
            <Section title="Akun pemohon" items={[
              ['Nama akun', migReview.name],
              ['Kategori', migReview.member_category === 'Luar Biasa' ? 'Luar Biasa' : 'Biasa'],
              ['Email akun', migReview.email, true],
            ]} />
          </div>

          {mode && (
            <div className="px-5 pb-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {mode === 'reject' ? <>Alasan penolakan <span className="text-red-500">*</span></> : 'Catatan untuk pemohon (opsional)'}
              </label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
                placeholder={mode === 'reject' ? 'Contoh: Foto KTA buram, tanggal berlaku tidak terbaca.' : 'Contoh: Masa aktif KTA sudah habis Maret 2026.'}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-300 focus:border-sky-400" />
              <p className="text-[10px] text-slate-500 mt-1">
                {mode === 'reject' ? 'Pemohon memperbaiki data lalu mengirim ulang.' : 'Pemohon tetap di dashboard dan melihat saran perpanjangan. Pemohon sendiri yang memilih Perpanjang (berbayar).'}
              </p>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-100">
            {mode ? (
              <>
                <button type="button" onClick={() => setMode(null)} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
                {mode === 'reject' ? (
                  <button type="button" onClick={() => submitMig('reject')} disabled={saving || !note.trim()} className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Kirim penolakan'}
                  </button>
                ) : (
                  <button type="button" onClick={() => submitMig('renew')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Kirim saran perpanjangan'}
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" onClick={() => setMode('reject')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Tolak
                </button>
                {(
                  <button type="button" onClick={() => setMode('renew')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Sarankan perpanjang
                  </button>
                )}
                <button type="button" onClick={() => submitMig('approve')} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Valid · aktifkan'}
                </button>
              </>
            )}
          </div>
          </>)}
        </Modal>
      )}
    </div>
  );
}
