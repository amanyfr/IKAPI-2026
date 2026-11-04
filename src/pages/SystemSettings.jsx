import React, { useState, useEffect } from 'react';
import {
  Settings, Save, Building, CreditCard, Award, FileText,
  CheckCircle, Upload, Trash2, Image, RotateCcw, PenTool
} from 'lucide-react';

const DEFAULT_TEMPLATES = {
  surat_kop_alamat: 'Sekretariat: Jl. Ibu Inggit Garnasih No. 148, Regol, Kota Bandung 40252',
  surat_kop_kontak: 'Telp: (022) 5202684 | Email: sekretariat@ikapi-jabar.or.id | Web: https://ikapi-jabar.or.id',
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
    ketua_nama: 'Dr. H. Mahpudi, M.T.',
    ketua_jabatan: 'Ketua Pengurus Daerah IKAPI Jawa Barat',
    sekretaris_nama: 'Drs. H. Anwar Rosyid, M.Si.',
    sekretaris_jabatan: 'Sekretaris PD IKAPI Jawa Barat',
    surat_counter: '14',
    ketua_signature_img: '',
    sekretaris_signature_img: '',
    stempel_img: '',
    ...DEFAULT_TEMPLATES
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }));
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
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  // Convert uploaded image to DataURL (compressed/resized if needed)
  const handleImageUpload = (fieldName, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 3 MB.');
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
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
        },
        body: JSON.stringify({ settings })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg('Seluruh pengaturan sistem, template surat, dan tanda tangan resmi berhasil disimpan.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      alert('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalBaru =
    Number(settings.fee_uang_pangkal) +
    Number(settings.fee_iuran_bulanan) * Number(settings.fee_iuran_durasi_bulan) +
    Number(settings.fee_administrasi);
  const totalHeregistrasi = Number(settings.fee_heregistrasi_iuran);

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
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola biaya pendaftaran, informasi rekening resmi, template surat pengantar, serta unggah tanda tangan & stempel.
            </p>
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
                  type="number"
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
                  type="number"
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
                type="number"
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
                  type="number"
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
                  type="number"
                  name="fee_heregistrasi_iuran"
                  value={settings.fee_heregistrasi_iuran}
                  onChange={handleChange}
                  className="w-full text-xs pl-8 pr-2.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
                />
              </div>
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
                type="number"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Baris Alamat Kop Surat Sekretariat
              </label>
              <input
                type="text"
                name="surat_kop_alamat"
                value={settings.surat_kop_alamat || ''}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Baris Kontak Kop Surat (Telp / Email / Web)
              </label>
              <input
                type="text"
                name="surat_kop_kontak"
                value={settings.surat_kop_kontak || ''}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
              />
            </div>
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

function SignatureUploadBox({ title, subtitle, imageData, onUpload, onClear }) {
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
