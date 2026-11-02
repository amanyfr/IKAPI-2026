import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  FileText, 
  Save, 
  Send, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Upload, 
  ArrowLeft 
} from 'lucide-react';

const CITIES_JABAR = [
  'Kota Bandung', 'Kabupaten Bandung', 'Kabupaten Bandung Barat', 'Kota Cimahi',
  'Kabupaten Sumedang', 'Kabupaten Garut', 'Kabupaten Tasikmalaya', 'Kota Tasikmalaya',
  'Kabupaten Ciamis', 'Kota Banjar', 'Kabupaten Pangandaran', 'Kabupaten Cianjur',
  'Kabupaten Sukabumi', 'Kota Sukabumi', 'Kabupaten Bogor', 'Kota Bogor',
  'Kota Depok', 'Kabupaten Bekasi', 'Kota Bekasi', 'Kabupaten Karawang',
  'Kabupaten Purwakarta', 'Kabupaten Subang', 'Kabupaten Cirebon', 'Kota Cirebon',
  'Kabupaten Indramayu', 'Kabupaten Majalengka', 'Kabupaten Kuningan'
];

const SPECIALIZATIONS = [
  'Buku Teks Pendidikan / Pelajaran Sekolah',
  'Buku Akademik & Perguruan Tinggi',
  'Sastra, Puisi & Fiksi',
  'Agama & Spiritualitas',
  'Buku Anak & Bergambar',
  'Pengembangan Diri & Populer',
  'Kamus & Ensiklopedia',
  'Ilmu Pengetahuan & Teknologi (Sains)',
  'Sosial, Humaniora & Sejarah'
];

export default function RegistrationForm({ existingSubmission, onComplete, onCancel, initialSubmissionType, initialCategory }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(1); // 1: Kategori & Jenis, 2: Badan Usaha, 3: Pimpinan & Redaksi, 4: Berkas & Submit

  // Form State
  const [formData, setFormData] = useState({
    submissionType: initialSubmissionType || 'Baru', // 'Baru' | 'Heregistrasi'
    category: initialCategory || 'Biasa', // 'Biasa' | 'Luar Biasa'
    oldKtaNumber: '',
    
    // Badan Usaha
    publisherName: '',
    legalEntity: 'PT',
    nib: '',
    npwp: '',
    establishmentDate: '',
    address: '',
    city: 'Kota Bandung',
    postalCode: '',
    phone: '',
    fax: '',
    email: user?.email || '',
    website: '',

    // Pimpinan
    leaderName: user?.name || '',
    leaderTitle: 'Direktur Utama',
    leaderNik: '',
    leaderPhone: user?.phone || '',
    leaderEmail: user?.email || '',

    // Penanggung Jawab Redaksi
    personInCharge: '',
    bnspCertificateNo: '',
    personInChargePhone: '',

    // Spesialisasi
    specialization: ['Buku Teks Pendidikan / Pelajaran Sekolah'],
    annualBookCount: '15',
    isbnCount: '30'
  });

  // Populate if editing existing submission
  useEffect(() => {
    if (existingSubmission) {
      const parsed = typeof existingSubmission.form_data === 'string'
        ? JSON.parse(existingSubmission.form_data || '{}')
        : existingSubmission.form_data || {};

      setFormData(prev => ({
        ...prev,
        ...parsed,
        submissionType: existingSubmission.submission_type || prev.submissionType,
        category: existingSubmission.member_category || existingSubmission.category || prev.category,
        oldKtaNumber: existingSubmission.old_kta_number || prev.oldKtaNumber,
        publisherName: existingSubmission.publisher_name || prev.publisherName,
        leaderName: existingSubmission.leader_name || prev.leaderName,
        address: existingSubmission.address || prev.address,
        city: existingSubmission.city || prev.city,
        phone: existingSubmission.publisher_phone || existingSubmission.phone || prev.phone
      }));
    }
  }, [existingSubmission]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSpecializationToggle = (spec) => {
    setFormData(prev => {
      const exists = prev.specialization.includes(spec);
      const updated = exists
        ? prev.specialization.filter(s => s !== spec)
        : [...prev.specialization, spec];
      return { ...prev, specialization: updated };
    });
  };

  const handleSubmit = async (isDraft = false) => {
    if (!isDraft) {
      if (!formData.publisherName.trim()) {
        alert('Nama penerbit wajib diisi.');
        setActiveTab(2);
        return;
      }
      if (!formData.address.trim()) {
        alert('Alamat kantor wajib diisi.');
        setActiveTab(2);
        return;
      }
      if (!formData.leaderName.trim()) {
        alert('Nama pimpinan wajib diisi.');
        setActiveTab(3);
        return;
      }
      if (formData.submissionType === 'Heregistrasi' && !formData.oldKtaNumber.trim()) {
        alert('Untuk pengajuan Heregistrasi, Nomor KTA Lama wajib dicantumkan.');
        setActiveTab(1);
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = existingSubmission?.id
        ? `/api/submissions/${existingSubmission.id}`
        : '/api/submissions';
      const method = existingSubmission?.id ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
        },
        body: JSON.stringify({
          ...formData,
          isDraft,
          isSubmit: !isDraft
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(isDraft ? 'Draf formulir berhasil disimpan!' : 'Formulir berhasil disubmit! Silakan lanjut mengunggah berkas persyaratan & bukti pembayaran.');
      if (onComplete) onComplete(data.submissionId || existingSubmission?.id);
    } catch (err) {
      alert('Gagal menyimpan formulir: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition mr-1"
                title="Kembali"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="p-3 bg-[#0da2e7] rounded-xl text-amber-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Formulir Pendaftaran Digital Anggota IKAPI 2026
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengurus Daerah Ikatan Penerbit Indonesia (IKAPI) Jawa Barat
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            >
              <Save className="w-4 h-4 text-slate-500" /> Simpan Draf
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-5 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg shadow flex items-center gap-1.5 transition"
            >
              <Send className="w-4 h-4 text-amber-400" /> Submit Pengajuan
            </button>
          </div>
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-4 gap-2 mt-6 pt-4 border-t border-slate-100 text-center text-xs font-bold">
          {[
            { step: 1, label: 'Kategori & Jenis' },
            { step: 2, label: 'Identitas Penerbit' },
            { step: 3, label: 'Pimpinan & Redaksi' },
            { step: 4, label: 'Spesialisasi & Berkas' }
          ].map(s => (
            <button
              key={s.step}
              onClick={() => setActiveTab(s.step)}
              className={`py-2 px-3 rounded-lg transition ${
                activeTab === s.step
                  ? 'bg-[#0da2e7] text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.step}. {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
        
        {/* TAB 1: KATEGORI & JENIS PENGAJUAN */}
        {activeTab === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Pilih Jenis Pengajuan & Kategori Keanggotaan
              </h3>
              <p className="text-xs text-slate-500">
                Pilihan ini akan menentukan persyaratan berkas dan rincian biaya resmi keanggotaan IKAPI.
              </p>
            </div>

            {/* Jenis Pengajuan */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                Jenis Pengajuan:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start space-x-3 ${
                  formData.submissionType === 'Baru'
                    ? 'border-[#0da2e7] bg-blue-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="submissionType"
                    value="Baru"
                    checked={formData.submissionType === 'Baru'}
                    onChange={handleChange}
                    className="mt-1 text-[#0884c4]"
                  />
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">Anggota Baru</span>
                    <span className="text-xs text-slate-500 leading-relaxed block mt-1">
                      Penerbit belum pernah memiliki KTA IKAPI. Total biaya Rp 1.700.000 (Uang Pangkal Rp 250rb + Iuran 24 Bulan Rp 1,2jt + Administrasi Rp 250rb).
                    </span>
                  </div>
                </label>

                <label className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start space-x-3 ${
                  formData.submissionType === 'Heregistrasi'
                    ? 'border-[#0da2e7] bg-blue-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="submissionType"
                    value="Heregistrasi"
                    checked={formData.submissionType === 'Heregistrasi'}
                    onChange={handleChange}
                    className="mt-1 text-[#0884c4]"
                  />
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">Heregistrasi (Anggota Lama)</span>
                    <span className="text-xs text-slate-500 leading-relaxed block mt-1">
                      Perpanjangan masa berlaku KTA yang telah habis. Total biaya Rp 1.200.000 (Iuran 24 Bulan).
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* KTA Lama Input if Heregistrasi */}
            {formData.submissionType === 'Heregistrasi' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <label className="text-xs font-bold text-amber-900 block">
                  Nomor KTA IKAPI Lama (Wajib untuk Heregistrasi):
                </label>
                <input
                  type="text"
                  name="oldKtaNumber"
                  value={formData.oldKtaNumber}
                  onChange={handleChange}
                  placeholder="Contoh: 008/JBR/2022"
                  className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>
            )}

            {/* Kategori Anggota */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                Kategori Anggota IKAPI:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start space-x-3 ${
                  formData.category === 'Biasa'
                    ? 'border-[#0da2e7] bg-blue-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="category"
                    value="Biasa"
                    checked={formData.category === 'Biasa'}
                    onChange={handleChange}
                    className="mt-1 text-[#0884c4]"
                  />
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">Anggota Biasa</span>
                    <span className="text-xs text-slate-500 leading-relaxed block mt-1">
                      Badan usaha penerbitan komersial berbentuk <strong>PT</strong> atau <strong>CV</strong> yang berbadan hukum sah.
                    </span>
                  </div>
                </label>

                <label className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start space-x-3 ${
                  formData.category === 'Luar Biasa'
                    ? 'border-[#0da2e7] bg-blue-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="category"
                    value="Luar Biasa"
                    checked={formData.category === 'Luar Biasa'}
                    onChange={handleChange}
                    className="mt-1 text-[#0884c4]"
                  />
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">Anggota Luar Biasa</span>
                    <span className="text-xs text-slate-500 leading-relaxed block mt-1">
                      Institusi pendidikan, perguruan tinggi (<strong>University Press</strong>), atau yayasan lembaga riset.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setActiveTab(2)}
                className="px-5 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg shadow transition"
              >
                Lanjut ke Identitas Penerbit →
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: IDENTITAS BADAN USAHA */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Data Badan Usaha / Lembaga Penerbitan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Penerbit / Lembaga Press *
                </label>
                <input
                  type="text"
                  name="publisherName"
                  value={formData.publisherName}
                  onChange={handleChange}
                  placeholder="Contoh: PT Pustaka Jaya Abadi"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Bentuk Badan Hukum *
                </label>
                <select
                  name="legalEntity"
                  value={formData.legalEntity}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                >
                  <option value="Perseroan Terbatas (PT)">Perseroan Terbatas (PT)</option>
                  <option value="Commanditaire Vennootschap (CV)">Commanditaire Vennootschap (CV)</option>
                  <option value="Perguruan Tinggi (University Press)">Perguruan Tinggi (University Press)</option>
                  <option value="Yayasan">Yayasan</option>
                  <option value="Koperasi / Lembaga Lain">Koperasi / Lembaga Lain</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nomor Induk Berusaha (NIB)
                </label>
                <input
                  type="text"
                  name="nib"
                  value={formData.nib}
                  onChange={handleChange}
                  placeholder="13 digit angka NIB OSS"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  NPWP Perusahaan / Lembaga
                </label>
                <input
                  type="text"
                  name="npwp"
                  value={formData.npwp}
                  onChange={handleChange}
                  placeholder="00.000.000.0-000.000"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Alamat Kantor Lengkap *
                </label>
                <textarea
                  rows="2"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Nama jalan, nomor gedung/kantor, RT/RW, kelurahan, kecamatan..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kota / Kabupaten di Jawa Barat *
                </label>
                <select
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                >
                  {CITIES_JABAR.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kode Pos
                </label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="Contoh: 40252"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Telepon Kantor *
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="022-XXXXXXX"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email Penerbit *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="redaksi@penerbit.co.id"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Website Penerbit
                </label>
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://penerbit.co.id"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nomor Faksimili
                </label>
                <input
                  type="text"
                  name="fax"
                  value={formData.fax}
                  onChange={handleChange}
                  placeholder="022-XXXXXXX"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveTab(1)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                ← Kembali
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(3)}
                className="px-5 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg shadow"
              >
                Lanjut ke Pimpinan & Redaksi →
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: PIMPINAN & REDAKSI */}
        {activeTab === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Data Pimpinan & Penanggung Jawab Redaksi
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Lengkap Pimpinan (Beserta Gelar) *
                </label>
                <input
                  type="text"
                  name="leaderName"
                  value={formData.leaderName}
                  onChange={handleChange}
                  placeholder="Contoh: Dr. H. Ahmad Fauzi, M.Pd."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Jabatan Pimpinan *
                </label>
                <input
                  type="text"
                  name="leaderTitle"
                  value={formData.leaderTitle}
                  onChange={handleChange}
                  placeholder="Direktur Utama / Rektor / Kepala Press"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nomor HP / WhatsApp Pimpinan *
                </label>
                <input
                  type="text"
                  name="leaderPhone"
                  value={formData.leaderPhone}
                  onChange={handleChange}
                  placeholder="0812XXXXXXXX"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  NIK KTP Pimpinan
                </label>
                <input
                  type="text"
                  name="leaderNik"
                  value={formData.leaderNik}
                  onChange={handleChange}
                  placeholder="16 digit NIK KTP"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-[#0884c4] uppercase tracking-wider mb-2">
                  Penanggung Jawab Editorial & Sertifikasi BNSP
                </h4>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Penanggung Jawab Redaksi / Editor *
                </label>
                <input
                  type="text"
                  name="personInCharge"
                  value={formData.personInCharge}
                  onChange={handleChange}
                  placeholder="Nama Kepala Redaksi / Editor"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nomor Sertifikat Kompetensi BNSP Editor
                </label>
                <input
                  type="text"
                  name="bnspCertificateNo"
                  value={formData.bnspCertificateNo}
                  onChange={handleChange}
                  placeholder="Contoh: BNSP-EDT-2025-XXXXX"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setActiveTab(2)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                ← Kembali
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(4)}
                className="px-5 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg shadow"
              >
                Lanjut ke Spesialisasi & Berkas →
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: SPESIALISASI & RINGKASAN PERSYARATAN BERKAS */}
        {activeTab === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Fokus Spesialisasi Buku & Dokumen Persyaratan
              </h3>
              <p className="text-xs text-slate-500">
                Pilih bidang penerbitan utama yang ditekuni oleh institusi Anda.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                Jenis Buku / Spesialisasi:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SPECIALIZATIONS.map(spec => {
                  const checked = formData.specialization.includes(spec);
                  return (
                    <label
                      key={spec}
                      className={`p-3 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 transition ${
                        checked ? 'bg-blue-50 border-[#0da2e7] font-semibold text-blue-950' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleSpecializationToggle(spec)}
                        className="rounded text-[#0884c4] focus:ring-[#0da2e7]"
                      />
                      <span>{spec}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Berkas Checklist Preview */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#0884c4]" /> Dokumen Wajib yang Harus Diunggah Setelah Ini:
              </h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                {formData.submissionType === 'Heregistrasi' ? (
                  <>
                    <li>Formulir Heregistrasi resmi bertandatangan</li>
                    <li>Scan KTA IKAPI lama yang telah habis masa berlakunya</li>
                    <li>NIB / SK Legalitas pembaruan lembaga (jika ada)</li>
                    <li>Bukti transfer pembayaran iuran heregistrasi</li>
                  </>
                ) : formData.category === 'Biasa' ? (
                  <>
                    <li>Akta Notaris & SK Kemenkumham Pendirian/Perubahan Perusahaan</li>
                    <li>Nomor Induk Berusaha (NIB) & NPWP Perusahaan</li>
                    <li>Formulir Pendaftaran resmi bertandatangan</li>
                    <li>Sertifikat Kompetensi BNSP Editor / Penerbitan</li>
                    <li>Bukti transfer pembayaran (Uang pangkal + iuran + administrasi)</li>
                  </>
                ) : (
                  <>
                    <li>SK Rektor / Pimpinan Lembaga tentang Pembentukan University Press</li>
                    <li>Surat Keterangan Domisili Lembaga Penerbitan Kampus</li>
                    <li>Formulir Pendaftaran resmi bertandatangan</li>
                    <li>Sertifikat Kompetensi BNSP Editor / Penerbitan</li>
                    <li>Bukti transfer pembayaran resmi IKAPI</li>
                  </>
                )}
              </ul>
              <p className="text-[11px] text-[#0884c4] font-medium mt-3 bg-blue-100/60 p-2 rounded">
                Catatan: Anda dapat mengunggah berkas-berkas di atas langsung pada dashboard setelah formulir ini disubmit.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab(3)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                ← Kembali
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                >
                  <Save className="w-4 h-4 text-slate-500" /> Simpan sebagai Draf
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="px-6 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg shadow flex items-center gap-1.5 transition"
                >
                  <Send className="w-4 h-4 text-amber-400" /> Submit Formulir Pendaftaran
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}

