import React, { useEffect, useState } from 'react';
import { Mail, Save, Send } from 'lucide-react';
import { notify } from './AppDialog';

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` });
const inputCls = 'w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none';

// Pengaturan email (SMTP) untuk notifikasi & verifikasi akun. Disimpan terpisah dari form utama:
// kata sandi tidak pernah dikirim balik dari server, kolomnya kosong = pakai sandi tersimpan.
export default function SmtpSettings() {
  const [form, setForm] = useState({ smtp_host: '', smtp_port: '587', smtp_secure: false, smtp_user: '', smtp_from: '', smtp_pass: '' });
  const [hasPass, setHasPass] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/settings/smtp', { headers: auth() })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setForm({ smtp_host: d.smtp_host, smtp_port: d.smtp_port, smtp_secure: d.smtp_secure, smtp_user: d.smtp_user, smtp_from: d.smtp_from, smtp_pass: '' });
        setHasPass(d.hasPass);
        setEnabled(d.enabled);
      })
      .catch((err) => notify('Gagal memuat pengaturan email: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  // Gmail: host & port bawaan
  const useGmail = () => setForm((f) => ({ ...f, smtp_host: 'smtp.gmail.com', smtp_port: '587', smtp_secure: false }));

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ ...form, ...extra })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (extra.clearPass) setHasPass(false);
      else if (form.smtp_pass) setHasPass(true);
      set('smtp_pass', '');
      setEnabled(d.enabled);
      notify(d.message);
    } catch (err) {
      notify('Gagal menyimpan pengaturan email: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/settings/smtp/test', { method: 'POST', headers: auth() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      notify(d.message);
    } catch (err) {
      notify(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card-surface p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <Mail className="w-5 h-5 text-[#0da2e7]" />
          <div>
            <h3 className="text-lg text-slate-800">8. Email Notifikasi (SMTP)</h3>
            <p className="text-[11px] text-slate-500">
              Dipakai untuk notifikasi tugas ke Admin, Sekretaris, dan Ketua, serta kode atur ulang kata sandi untuk semua akun. Status pengajuan Anggota cukup lewat notifikasi di aplikasi.
            </p>
          </div>
        </div>
        {!loading && (
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {enabled ? 'Email aktif' : 'Email nonaktif'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-700 block mb-1">Host SMTP</label>
          <input type="text" value={form.smtp_host} onChange={(e) => set('smtp_host', e.target.value.trim())} placeholder="smtp.gmail.com" className={inputCls + ' font-mono'} />
          <button type="button" onClick={useGmail} className="text-[11px] text-[#0884c4] hover:underline mt-1">Pakai Gmail</button>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Port</label>
          <input type="text" inputMode="numeric" value={form.smtp_port} onChange={(e) => set('smtp_port', e.target.value.replace(/\D/g, '').slice(0, 5))} className={inputCls + ' font-mono'} />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 mt-1">
            <input type="checkbox" checked={form.smtp_secure} onChange={(e) => set('smtp_secure', e.target.checked)} />
            SSL langsung (port 465)
          </label>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Email / Username SMTP</label>
          <input type="email" autoComplete="off" value={form.smtp_user} onChange={(e) => set('smtp_user', e.target.value.trim())} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Kata Sandi Aplikasi</label>
          <input
            type="password"
            autoComplete="new-password"
            value={form.smtp_pass}
            onChange={(e) => set('smtp_pass', e.target.value)}
            placeholder={hasPass ? 'Tersimpan. Kosongkan bila tidak diganti' : 'Belum diisi'}
            className={inputCls}
          />
          {hasPass && (
            <button type="button" onClick={() => save({ clearPass: true })} className="text-[11px] text-red-600 hover:underline mt-1">Hapus kata sandi tersimpan</button>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Nama Pengirim</label>
          <input type="text" value={form.smtp_from} onChange={(e) => set('smtp_from', e.target.value)} placeholder="IKAPI Jawa Barat <alamat@gmail.com>" className={inputCls} />
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Untuk Gmail, pakai kata sandi aplikasi (App Password) 16 huruf dari pengaturan keamanan akun Google, bukan sandi login Gmail.
        Kosongkan Host untuk mematikan email.
      </p>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={test}
          disabled={testing || saving || !enabled}
          className="px-4 py-2.5 border border-[#0da2e7] text-[#0884c4] hover:bg-[#f0f9ff] disabled:opacity-50 text-xs font-bold rounded-xl transition flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {testing ? 'Mengirim...' : 'Kirim email uji ke saya'}
        </button>
        <button
          type="button"
          onClick={() => save()}
          disabled={saving || loading}
          className="px-4 py-2.5 bg-[#0da2e7] hover:bg-[#0884c4] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan Email'}
        </button>
      </div>
    </div>
  );
}
