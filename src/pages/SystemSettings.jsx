import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, Save, Building, CreditCard, Award, FileText,
  CheckCircle, Upload, Trash2, Image, RotateCcw, PenTool, Receipt, Phone
} from 'lucide-react';
import { INVOICE_DEFAULTS } from '../components/PaymentInvoice';
import { waLink } from '../utils/whatsapp';
import { notify } from '../components/AppDialog';
import { FILTERS, NUMERIC, PHONE } from '../utils/inputFilters';

// Pengaturan yang tidak boleh berisi huruf beserta penyaringnya
const FIELD_FILTERS = {
  bank_account: FILTERS.digits,
  fee_uang_pangkal: FILTERS.digits,
  fee_iuran_bulanan: FILTERS.digits,
  fee_iuran_durasi_bulan: FILTERS.digits,
  fee_administrasi: FILTERS.digits,
  fee_heregistrasi_iuran: FILTERS.digits,
  surat_counter: FILTERS.digits,
  admin_whatsapp: FILTERS.phone,
  office_phone: FILTERS.phone,
};

// Jalur anggota lama yang bisa dibuka Admin
const HEREG_TRACK_OPTIONS = [
  { key: 'Perpanjangan', title: 'Perpanjangan (berbayar)', desc: 'Anggota lama mengisi formulir registrasi, unggah dokumen & bayar iuran heregistrasi. Tombol Perpanjang juga tampil di dashboard.' },
  { key: 'Masih Aktif', title: 'Masih aktif (data manual)', desc: 'KTA masih berlaku. Anggota langsung ke dashboard, melengkapi data, lalu Admin memvalidasi masa aktifnya.' },
];

const DEFAULT_TEMPLATES = {
  surat_tujuan: 'Pengurus Pusat IKAPI\nc.q. Bidang Keanggotaan & Organisasi\nJl. Kalipasir No. 32, Cikini, Menteng\nJakarta Pusat 10330',
  surat_pembuka_baru: 'Sehubungan dengan permohonan pendaftaran Anggota Baru IKAPI yang diajukan ke Pengurus Daerah Jawa Barat, bersama ini kami sampaikan bahwa penerbit pemohon telah memenuhi seluruh persyaratan keabsahan hukum, verifikasi kompetensi perbukuan/editor BNSP, serta penyelesaian administrasi organisasi:',
  surat_pembuka_hereg: 'Sehubungan dengan permohonan Heregistrasi (Pembaruan Keanggotaan) yang diajukan oleh penerbit di wilayah Pengurus Daerah IKAPI Jawa Barat, kami telah melakukan verifikasi faktual terhadap berkas administrasi dan pelunasan kewajiban iuran. Berdasarkan hal tersebut, kami menerangkan data penerbit sebagai berikut:',
  surat_penutup: 'Pengurus Daerah IKAPI Jawa Barat telah menyetujui dan memberikan REKOMENDASI RESMI agar penerbit di atas disahkan menjadi Anggota IKAPI serta diterbitkan Nomor KTA dari Pengurus Pusat IKAPI. Demikian surat rekomendasi pengantar ini kami sampaikan untuk dapat dipergunakan sebagaimana mestinya.'
};

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    bank_name: 'Bank BNI',
    bank_account: '2089992087',
    bank_holder: 'Abdul Rasyid',
    fee_uang_pangkal: '250000',
    fee_iuran_bulanan: '50000',
    fee_iuran_durasi_bulan: '24',
    fee_administrasi: '250000',
    fee_heregistrasi_iuran: '1200000',
    hereg_tracks: 'Perpanjangan,Masih Aktif',
    ketua_nama: 'Dr. Abdul Raup, M.Pd.',
    ketua_jabatan: 'Ketua Pengurus Daerah IKAPI Jawa Barat',
    sekretaris_nama: 'Taofiq Rahman Ahmad, S.H.',
    sekretaris_jabatan: 'Sekretaris PD IKAPI Jawa Barat',
    surat_counter: '14',
    ketua_signature_img: '',
    sekretaris_signature_img: '',
    stempel_img: '',
    kop_header_img: '',
    kop_footer_img: '',
    ...DEFAULT_TEMPLATES,
    ...INVOICE_DEFAULTS
  });

  const [loading, setLoading] = useState(true);
  // Salinan nilai terakhir dari server: hanya kunci yang berubah yang dikirim saat simpan,
  // supaya nilai yang berubah di server (mis. surat_counter) tidak tertimpa nilai lama.
  const savedRef = useRef({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings', { headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` } });
        const data = await res.json();
        if (data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }));
          savedRef.current = { ...data.settings };
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (e) => {
    const { name } = e.target;
    const value = FIELD_FILTERS[name] ? FIELD_FILTERS[name](e.target.value) : e.target.value;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  // Convert uploaded image to DataURL (compressed/resized if needed)
  const handleImageUpload = (fieldName, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      notify('Ukuran gambar maksimal 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSettings(prev => ({ ...prev, [fieldName]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = (fieldName) => {
    setSettings(prev => ({ ...prev, [fieldName]: '' }));
  };

  const handleResetTemplate = () => {
    setSettings(prev => ({ ...prev, ...DEFAULT_TEMPLATES }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    const changed = Object.fromEntries(
      Object.entries(settings).filter(([k, v]) => String(v ?? '') !== String(savedRef.current[k] ?? '') || !(k in savedRef.current))
    );
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
        },
        body: JSON.stringify({ settings: changed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      savedRef.current = { ...savedRef.current, ...changed };

      setSuccessMsg('Seluruh pengaturan sistem, template surat, dan tanda tangan resmi berhasil disimpan.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      notify('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalBaru =
    Number(settings.fee_uang_pangkal) +
    Number(settings.fee_iuran_bulanan) * Number(settings.fee_iuran_durasi_bulan) +
    Number(settings.fee_administrasi);
  const totalHeregistrasi = Number(settings.fee_heregistrasi_iuran);

  // Jalur anggota lama: boleh keduanya atau salah satu, tidak boleh kosong
  const tracks = String(settings.hereg_tracks || '').split(',').map((t) => t.trim()).filter(Boolean);
  const toggleTrack = (key) => {
    const on = tracks.includes(key);
    if (on && tracks.length === 1) {
      notify('Minimal satu jalur anggota lama harus aktif.');
      return;
    }
    const next = HEREG_TRACK_OPTIONS.map((o) => o.key).filter((k) => (k === key ? !on : tracks.includes(k)));
    setSettings((prev) => ({ ...prev, hereg_tracks: next.join(',') }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header Card */}
      <div className="card-surface p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#0da2e7] rounded-xl text-white shadow-sm">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-light tracking-tight text-slate-900">
              Pengaturan Sistem, Biaya, Template Surat & TTD Resmi
            </h2>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">

        {/* 1. INFORMASI REKENING RESMI */}
        <div className="card-surface p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <CreditCard className="w-5 h-5 text-[#0da2e7]" />
            <h3 className="text-lg text-slate-800">
              1. Informasi Rekening Resmi Pembayaran Iuran IKAPI Jabar
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Bank Resmi *
              </label>
              <input
                type="text"
                name="bank_name"
                value={settings.bank_name}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nomor Rekening *
              </label>
              <input
                type="text"
                {...NUMERIC}
                name="bank_account"
                value={settings.bank_account}
                onChange={handleChange}
                className="w-full text-xs p-2.5 font-mono font-bold text-[#0884c4] border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Atas Nama Pemilik Rekening *
              </label>
              <input
                type="text"
                name="bank_holder"
                value={settings.bank_holder}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. RINCIAN BIAYA PENDAFTARAN & HEREGISTRASI */}
        <div className="card-surface p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-[#0da2e7]" />
              <h3 className="text-lg text-slate-800">
                2. Konfigurasi Biaya Pendaftaran & Heregistrasi
              </h3>
            </div>
            <div className="flex items-center gap-4 bg-[#f0f9ff] px-3.5 py-1.5 rounded-xl border border-[#b8e6fc]">
              <div>
                <span className="text-[10px] text-slate-500 block">Total Anggota Baru:</span>
                <span className="text-xs font-black text-[#0884c4]">Rp {totalBaru.toLocaleString('id-ID')}</span>
              </div>
              <div className="h-6 w-px bg-[#b8e6fc]" />
              <div>
                <span className="text-[10px] text-slate-500 block">Total Heregistrasi:</span>
                <span className="text-xs font-black text-emerald-700">Rp {totalHeregistrasi.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Uang Pangkal (Baru)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">Rp</span>
                <input
                  type="text"
                  {...NUMERIC}
                  name="fee_uang_pangkal"
                  value={settings.fee_uang_pangkal}
                  onChange={handleChange}
                  className="w-full text-xs pl-8 pr-2.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Iuran per Bulan
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">Rp</span>
                <input
                  type="text"
                  {...NUMERIC}
                  name="fee_iuran_bulanan"
                  value={settings.fee_iuran_bulanan}
                  onChange={handleChange}
                  className="w-full text-xs pl-8 pr-2.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Durasi Bayar (Bulan)
              </label>
              <input
                type="text"
                {...NUMERIC}
                name="fee_iuran_durasi_bulan"
                value={settings.fee_iuran_durasi_bulan}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Biaya Administrasi
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">Rp</span>
                <input
                  type="text"
                  {...NUMERIC}
                  name="fee_administrasi"
                  value={settings.fee_administrasi}
                  onChange={handleChange}
                  className="w-full text-xs pl-8 pr-2.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Biaya Heregistrasi (2 Thn)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">Rp</span>
                <input
                  type="text"
                  {...NUMERIC}
                  name="fee_heregistrasi_iuran"
                  value={settings.fee_heregistrasi_iuran}
                  onChange={handleChange}
                  className="w-full text-xs pl-8 pr-2.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-700">Jalur anggota lama</p>
            <p className="text-[11px] text-slate-500 mb-2.5">Aktifkan keduanya atau salah satu. Minimal satu jalur harus aktif.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HEREG_TRACK_OPTIONS.map((o) => {
                const on = tracks.includes(o.key);
                const locked = on && tracks.length === 1;
                return (
                  <button key={o.key} type="button" role="switch" aria-checked={on} onClick={() => toggleTrack(o.key)}
                    title={locked ? 'Minimal satu jalur harus aktif' : undefined}
                    className={`text-left rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${on ? 'border-[#0da2e7] bg-[#f0f9ff]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <span className={`mt-0.5 w-9 h-5 flex-shrink-0 rounded-full p-0.5 transition-colors ${on ? 'bg-[#0da2e7]' : 'bg-slate-300'} ${locked ? 'opacity-60' : ''}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-800">{o.title} {on ? '· aktif' : '· nonaktif'}</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">{o.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. PEJABAT PENANDATANGAN & UNGGAH TANDA TANGAN + STEMPEL RESMI */}
        <div className="card-surface p-6 space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <PenTool className="w-5 h-5 text-[#0da2e7]" />
            <div>
              <h3 className="text-lg text-slate-800">
                3. Data Penandatangan & Unggah Gambar Tanda Tangan / Stempel Resmi
              </h3>
              <p className="text-[11px] text-slate-500">
                Gambar tanda tangan dan stempel yang diunggah akan otomatis dibubuhkan pada Surat Pengantar Rekomendasi saat disetujui.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Ketua PD IKAPI Jabar *
              </label>
              <input
                type="text"
                name="ketua_nama"
                value={settings.ketua_nama}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Sekretaris PD IKAPI Jabar *
              </label>
              <input
                type="text"
                name="sekretaris_nama"
                value={settings.sekretaris_nama}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nomor Urut Surat (Counter)
              </label>
              <input
                type="text"
                {...NUMERIC}
                name="surat_counter"
                value={settings.surat_counter}
                onChange={handleChange}
                className="w-full text-xs p-2.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Format: <code>{`{urut}/PD-Ikapi Jabar/{bulan_romawi}/{tahun}`}</code>
              </span>
            </div>
          </div>

          {/* Upload 3 Images: TTD Ketua, TTD Sekretaris, Stempel Resmi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* TTD Ketua */}
            <SignatureUploadBox
              title="Tanda Tangan Ketua"
              subtitle={settings.ketua_nama}
              imageData={settings.ketua_signature_img}
              onUpload={(e) => handleImageUpload('ketua_signature_img', e)}
              onClear={() => handleClearImage('ketua_signature_img')}
            />

            {/* Stempel Resmi */}
            <SignatureUploadBox
              title="Stempel Resmi IKAPI Jabar"
              subtitle="Stempel Pengurus Daerah"
              imageData={settings.stempel_img}
              onUpload={(e) => handleImageUpload('stempel_img', e)}
              onClear={() => handleClearImage('stempel_img')}
            />

            {/* TTD Sekretaris */}
            <SignatureUploadBox
              title="Tanda Tangan Sekretaris"
              subtitle={settings.sekretaris_nama}
              imageData={settings.sekretaris_signature_img}
              onUpload={(e) => handleImageUpload('sekretaris_signature_img', e)}
              onClear={() => handleClearImage('sekretaris_signature_img')}
            />
          </div>
        </div>

        {/* 4. TEMPLATE SURAT PENGANTAR REKOMENDASI */}
        <div className="card-surface p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-[#0da2e7]" />
              <div>
                <h3 className="text-lg text-slate-800">
                  4. Pengaturan Template Surat Pengantar Rekomendasi
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sesuaikan kop surat, alamat tujuan, serta redaksi pembuka dan penutup surat pengantar ke IKAPI Pusat.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetTemplate}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset ke Template Standar
            </button>
          </div>

          {/* Kop surat = gambar utuh (kepala & kaki) yang dipakai di semua surat, invoice & dokumen pengurus */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SignatureUploadBox
              title="Gambar Kepala Surat (Kop)"
              subtitle="Dipakai di surat, invoice & dokumen pengurus"
              imageData={settings.kop_header_img}
              defaultSrc="/kop-surat-header.png"
              onUpload={(e) => handleImageUpload('kop_header_img', e)}
              onClear={() => handleClearImage('kop_header_img')}
            />
            <SignatureUploadBox
              title="Gambar Kaki Surat"
              subtitle="QRIS, kanal resmi & rekening di bagian bawah"
              imageData={settings.kop_footer_img}
              defaultSrc="/kop-surat-footer.png"
              onUpload={(e) => handleImageUpload('kop_footer_img', e)}
              onClear={() => handleClearImage('kop_footer_img')}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Redaksi Pembuka Surat (Pengajuan Anggota Baru)
            </label>
            <textarea
              rows={3}
              name="surat_pembuka_baru"
              value={settings.surat_pembuka_baru || ''}
              onChange={handleChange}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none leading-relaxed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Redaksi Pembuka Surat (Pengajuan Heregistrasi / Perpanjangan)
            </label>
            <textarea
              rows={3}
              name="surat_pembuka_hereg"
              value={settings.surat_pembuka_hereg || ''}
              onChange={handleChange}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none leading-relaxed"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Redaksi Penutup & Rekomendasi Surat Pengantar
            </label>
            <textarea
              rows={3}
              name="surat_penutup"
              value={settings.surat_penutup || ''}
              onChange={handleChange}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* 5. INVOICE / KUITANSI PEMBAYARAN */}
        <div className="card-surface p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Receipt className="w-5 h-5 text-[#0da2e7]" />
            <div>
              <h3 className="text-lg text-slate-800">5. Invoice Pembayaran Anggota</h3>
              <p className="text-[11px] text-slate-500">
                Invoice muncul di dashboard anggota setelah bukti transfer diunggah, dan berstatus LUNAS setelah pembayaran diverifikasi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['invoice_title', 'Judul invoice'],
              ['invoice_prefix', 'Awalan nomor invoice'],
              ['invoice_issuer_name', 'Nama penerbit invoice (penandatangan)'],
              ['invoice_issuer_title', 'Jabatan penandatangan'],
            ].map(([name, label]) => (
              <div key={name}>
                <label className="text-xs font-semibold text-slate-700 block mb-1">{label}</label>
                <input
                  type="text"
                  name={name}
                  value={settings[name]}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
                />
              </div>
            ))}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Catatan kaki invoice</label>
              <textarea
                rows="2"
                name="invoice_notes"
                value={settings.invoice_notes}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 bg-[#f0f9ff] border border-[#b8e6fc] rounded-lg px-3 py-2">
            Contoh nomor: <span className="font-mono text-[#0884c4]">{settings.invoice_prefix}/{new Date().getFullYear()}/0012</span> ·
            rekening & rincian biaya mengikuti bagian 1 dan 2 di atas.
          </p>
        </div>

        {/* 6. KONTAK ADMIN & SEKRETARIAT */}
        <div className="card-surface p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Phone className="w-5 h-5 text-[#0da2e7]" />
            <div>
              <h3 className="text-lg text-slate-800">6. Kontak Admin & Sekretariat</h3>
              <p className="text-[11px] text-slate-500">
                Nomor WhatsApp Admin tampil di halaman Lupa Sandi sebagai tombol chat. Telepon & email sekretariat tampil di dashboard anggota.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Nomor WhatsApp Admin</label>
              <input
                type="tel"
                {...PHONE}
                name="admin_whatsapp"
                value={settings.admin_whatsapp || ''}
                onChange={handleChange}
                placeholder="mis. 0812-3456-7890"
                className="w-full text-xs p-2.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
              {settings.admin_whatsapp && !waLink(settings.admin_whatsapp) && (
                <p className="text-[11px] text-red-600 mt-1">Nomor belum valid; tombol WhatsApp tidak akan tampil.</p>
              )}
              {waLink(settings.admin_whatsapp) && (
                <a href={waLink(settings.admin_whatsapp)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#0884c4] hover:underline mt-1 inline-block">
                  Uji tautan: {waLink(settings.admin_whatsapp).replace('https://', '')}
                </a>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Telepon Sekretariat</label>
              <input
                type="text"
                {...PHONE}
                name="office_phone"
                value={settings.office_phone || ''}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Email Sekretariat</label>
              <input
                type="email"
                name="office_email"
                value={settings.office_email || ''}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-xl shadow-md shadow-[#0da2e7]/25 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
          </button>
        </div>

      </form>
    </div>
  );
}

function SignatureUploadBox({ title, subtitle, imageData, onUpload, onClear, defaultSrc }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-[#f8fbfe] flex flex-col justify-between space-y-3">
      <div>
        <div className="text-xs font-bold text-slate-800">{title}</div>
        <div className="text-[11px] text-slate-500 truncate">{subtitle}</div>
      </div>

      <div className="h-28 bg-white border border-dashed border-[#b8e6fc] rounded-lg flex items-center justify-center p-2 overflow-hidden">
        {imageData ? (
          <img
            src={imageData}
            alt={title}
            className="max-h-24 max-w-full object-contain"
          />
        ) : defaultSrc ? (
          <div className="text-center w-full">
            <img src={defaultSrc} alt={title} className="max-h-20 max-w-full object-contain mx-auto opacity-80" />
            <span className="block text-[10px] text-slate-400 mt-1">Gambar bawaan (belum diganti)</span>
          </div>
        ) : (
          <div className="text-center text-slate-400 text-[11px]">
            <Image className="w-6 h-6 mx-auto mb-1 opacity-40 text-[#0da2e7]" />
            <span>Belum ada gambar</span>
            <span className="block text-[10px] text-slate-300">(Menggunakan TTD Digital Default)</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="flex-1 cursor-pointer px-3 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-[11px] font-bold rounded-lg text-center transition flex items-center justify-center gap-1.5 shadow-sm">
          <Upload className="w-3.5 h-3.5" />
          <span>{imageData ? 'Ganti Gambar' : 'Unggah PNG/JPG'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onUpload}
            className="hidden"
          />
        </label>
        {imageData && (
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition"
            title="Hapus Gambar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
