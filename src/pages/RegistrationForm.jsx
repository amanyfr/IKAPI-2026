import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Save, Send, CheckCircle, Upload, ArrowLeft, ArrowRight
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
  'Buku Teks Pendidikan / Sekolah',
  'Buku Akademik & Perguruan Tinggi',
  'Sastra, Puisi & Fiksi',
  'Agama & Spiritualitas',
  'Buku Anak & Bergambar',
  'Pengembangan Diri & Populer',
  'Kamus & Ensiklopedia',
  'Ilmu Pengetahuan & Teknologi',
  'Sosial, Humaniora & Sejarah'
];

function getRequiredDocsList(submissionType, category) {
  if (submissionType === 'Heregistrasi') {
    return [
      { type: 'formulir_heregistrasi', title: 'Formulir Registrasi IKAPI 2026' },
      { type: 'kta_lama', title: 'KTA Lama' },
    ];
  }
  if (category === 'Biasa') {
    return [
      { type: 'akta_pendirian', title: 'Akta Notaris / Pendirian Perusahaan' },
      { type: 'nib', title: 'Nomor Induk Berusaha (NIB)' },
      { type: 'formulir_pendaftaran', title: 'Formulir Pendaftaran IKAPI 2026' },
      { type: 'sertifikat_bnsp', title: 'Sertifikat BNSP (Penerbitan / Editor)' },
    ];
  }
  return [
    { type: 'sk_pembentukan', title: 'SK Pembentukan Penerbitan Buku' },
    { type: 'domisili_press', title: 'Surat Keterangan Domisili Press' },
    { type: 'formulir_pendaftaran', title: 'Formulir Pendaftaran IKAPI 2026' },
    { type: 'sertifikat_bnsp', title: 'Sertifikat BNSP (Penerbitan / Editor)' },
  ];
}

export default function RegistrationForm({ existingSubmission, onComplete, onCancel, initialSubmissionType, initialCategory, initialOldKtaNumber, lockSubmissionType = false }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState({});

  const [formData, setFormData] = useState({
    submissionType: initialSubmissionType || 'Baru',
    category: initialCategory || 'Biasa',
    oldKtaNumber: initialOldKtaNumber || '',

    // 1. Identitas Anggota
    publisherName: '',
    legalEntity: 'Perseroan Terbatas (PT)',
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
    leaderName: user?.name || '',
    leaderTitle: 'Direktur Utama',
    leaderNik: '',
    leaderPhone: user?.phone || '',
    leaderEmail: user?.email || '',
    personInCharge: '',
    bnspCertificateNo: '',
    personInChargePhone: '',

    // 2. Profil (Khusus Anggota Baru)
    tujuanMenjadiAnggota: '',
    tahunMulaiUsaha: '',

    // 3. Terbitan
    specialization: ['Buku Teks Pendidikan / Sekolah'],
    jumlahJudulTerbit: '',
    rataRataOplah: '',
    annualBookCount: '',

    // 4. Pemasaran
    sistemPemasaran: 'Toko Buku, Penjualan Online, & Instansi',
    rataRataDiskon: '30',
    sistemPenjualan: 'Tunai, Kredit, dan Konsinyasi',

    // 5. Naskah
    sistemPengadaanNaskah: 'Royalti Penulis & Beli Putus',
    persentaseRoyalti: '10%',

    // 6. Organisasi
    jumlahKaryawanRedaksi: '',
    jumlahKaryawanProduksi: '',
    jumlahKaryawanPemasaran: '',
    jumlahKaryawanAdmin: '',
    kepemilikanKantor: 'Milik Sendiri',
    lokasiKantor: 'Gedung Perkantoran / Ruko',
    kantorCabang: '-',
    liniPenerbitan: '',

    // 7. Produksi
    softwareProduksi: 'Adobe InDesign, Illustrator, Photoshop',
    contohIsbn: '',
    jenisKertas: 'Bookpaper, HVS, Art Carton',
    sistemCetak: 'Cetak di Luar (Percetakan Mitra)',
    pekerjaanOutsource: 'Percetakan & Penjilidan'
  });

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
        oldKtaNumber: existingSubmission.old_kta_number || parsed.oldKtaNumber || prev.oldKtaNumber,
        publisherName: existingSubmission.publisher_name || parsed.publisherName || prev.publisherName,
        leaderName: existingSubmission.leader_name || parsed.leaderName || prev.leaderName,
        address: existingSubmission.address || parsed.address || prev.address,
        city: existingSubmission.city || parsed.city || prev.city,
        phone: existingSubmission.publisher_phone || existingSubmission.phone || parsed.phone || prev.phone
      }));
    }
  }, [existingSubmission]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSpecializationToggle = (spec) => {
    setFormData(prev => {
      const current = Array.isArray(prev.specialization) ? prev.specialization : [prev.specialization].filter(Boolean);
      const exists = current.includes(spec);
      const updated = exists ? current.filter(s => s !== spec) : [...current, spec];
      return { ...prev, specialization: updated };
    });
  };

  const handleFileSelect = (docType, file) => {
    if (!file) return;
    setSelectedFiles(prev => ({ ...prev, [docType]: file }));
  };

  const requiredDocs = getRequiredDocsList(formData.submissionType, formData.category);

  const handleSubmit = async (isDraft = false) => {
    if (!isDraft) {
      if (!formData.publisherName.trim()) {
        alert('Nama penerbit wajib diisi.');
        setActiveTab(1);
        return;
      }
      if (!formData.address.trim()) {
        alert('Alamat kantor wajib diisi.');
        setActiveTab(1);
        return;
      }
      if (!formData.leaderName.trim()) {
        alert('Nama pimpinan wajib diisi.');
        setActiveTab(1);
        return;
      }
      if (formData.submissionType === 'Heregistrasi' && !formData.oldKtaNumber.trim()) {
        alert('Nomor KTA Lama wajib diisi untuk Registrasi.');
        setActiveTab(1);
        return;
      }
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('ikapi_token');
      const endpoint = existingSubmission?.id
        ? `/api/submissions/${existingSubmission.id}`
        : '/api/submissions';
      const method = existingSubmission?.id ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          isDraft,
          isSubmit: !isDraft
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const subId = data.submissionId || existingSubmission?.id;

      if (subId && Object.keys(selectedFiles).length > 0) {
        for (const docItem of requiredDocs) {
          const file = selectedFiles[docItem.type];
          if (file) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('documentType', docItem.type);
            fd.append('documentTitle', docItem.title);
            await fetch(`/api/submissions/${subId}/documents`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: fd
            });
          }
        }
      }

      if (onComplete) onComplete(subId);
    } catch (err) {
      alert('Gagal menyimpan formulir: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "soft-input py-2.5";
  const labelCls = "text-sm font-medium text-slate-700 block mb-1.5";

  return (
    <div className="w-full">
      <div className="card-surface overflow-hidden">

        {/* Top Header */}
        <div className="bg-slate-50/70 border-b border-slate-100 px-5 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {onCancel && (
              <button
                onClick={onCancel}
                className="soft-pill !p-2.5"
                title="Kembali"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-light text-slate-900 tracking-tight">
                Formulir Keanggotaan IKAPI Jawa Barat
              </h2>
            </div>
          </div>
        </div>

        {/* Step Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 sm:px-8 pt-4 text-sm font-medium">
          {[
            { step: 1, label: '1. Identitas Penerbit' },
            { step: 2, label: '2. Terbitan & Naskah' },
            { step: 3, label: '3. Organisasi & Produksi' },
            { step: 4, label: '4. Unggah Berkas' }
          ].map(s => (
            <button
              key={s.step}
              type="button"
              onClick={() => setActiveTab(s.step)}
              className={`py-2.5 px-4 rounded-full transition text-center ${
                activeTab === s.step
                  ? 'bg-[#3b82f6] text-white shadow-[0_8px_18px_-8px_rgba(59,130,246,0.7)]'
                  : 'bg-white text-slate-600 border border-slate-200/70 shadow-sm hover:bg-slate-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Form Body — field dibagi 2 kolom di layar lebar agar tidak perlu scroll panjang */}
        <div className="p-4 sm:p-6">

          {/* TAB 1: IDENTITAS */}
          {activeTab === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 p-4 sm:p-6 panel-inner">
                <div>
                  <label className={labelCls}>Jenis Pengajuan *</label>
                  <select
                    name="submissionType"
                    value={formData.submissionType}
                    onChange={handleChange}
                    disabled={lockSubmissionType}
                    className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed`}
                  >
                    <option value="Baru">Anggota Baru</option>
                    <option value="Heregistrasi">Registrasi (Perpanjangan)</option>
                  </select>
                  {lockSubmissionType && (
                    <p className="text-xs text-slate-500 mt-1.5">Sesuai profil keanggotaan Anda (anggota lama/baru).</p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Kategori Keanggotaan *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    <option value="Biasa">Anggota Biasa (Badan Usaha)</option>
                    <option value="Luar Biasa">Anggota Luar Biasa (Institusi)</option>
                  </select>
                </div>

                {formData.submissionType === 'Heregistrasi' && (
                  <div>
                    <label className={labelCls}>Nomor KTA Lama *</label>
                    <input
                      type="text"
                      name="oldKtaNumber"
                      value={formData.oldKtaNumber}
                      onChange={handleChange}
                      placeholder="Contoh: 008/JBR/2024"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 p-4 sm:p-6 panel-inner">
                <div>
                  <label className={labelCls}>Nama Penerbit *</label>
                  <input
                    type="text"
                    name="publisherName"
                    value={formData.publisherName}
                    onChange={handleChange}
                    placeholder="Nama perusahaan / press"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Bentuk Badan Hukum *</label>
                  <select
                    name="legalEntity"
                    value={formData.legalEntity}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    <option value="Perseroan Terbatas (PT)">Perseroan Terbatas (PT)</option>
                    <option value="Commanditaire Vennootschap (CV)">Commanditaire Vennootschap (CV)</option>
                    <option value="Perguruan Tinggi (University Press)">Perguruan Tinggi (University Press)</option>
                    <option value="Yayasan / Lembaga Pendidikan">Yayasan / Lembaga Pendidikan</option>
                    <option value="Koperasi / Badan Hukum Lainnya">Koperasi / Badan Hukum Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Nomor Induk Berusaha (NIB)</label>
                  <input
                    type="text"
                    name="nib"
                    value={formData.nib}
                    onChange={handleChange}
                    placeholder="Nomor NIB"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>NPWP</label>
                  <input
                    type="text"
                    name="npwp"
                    value={formData.npwp}
                    onChange={handleChange}
                    placeholder="Nomor NPWP"
                    className={inputCls}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelCls}>Alamat Kantor *</label>
                  <textarea
                    rows="2"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Alamat lengkap kantor penerbit"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Kota / Kabupaten *</label>
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    {CITIES_JABAR.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Kode Pos</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    placeholder="Kode pos"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Telepon *</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Nomor telepon / HP"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Faksimili</label>
                  <input
                    type="text"
                    name="fax"
                    value={formData.fax}
                    onChange={handleChange}
                    placeholder="Opsional"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Email resmi penerbit"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Website</label>
                  <input
                    type="text"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Nama Pimpinan *</label>
                  <input
                    type="text"
                    name="leaderName"
                    value={formData.leaderName}
                    onChange={handleChange}
                    placeholder="Nama lengkap pimpinan"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Jabatan Pimpinan *</label>
                  <input
                    type="text"
                    name="leaderTitle"
                    value={formData.leaderTitle}
                    onChange={handleChange}
                    placeholder="Direktur / Kepala Press"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Penanggung Jawab Penerbitan *</label>
                  <input
                    type="text"
                    name="personInCharge"
                    value={formData.personInCharge}
                    onChange={handleChange}
                    placeholder="Nama penanggung jawab"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>No. Sertifikat BNSP *</label>
                  <input
                    type="text"
                    name="bnspCertificateNo"
                    value={formData.bnspCertificateNo}
                    onChange={handleChange}
                    placeholder="Nomor sertifikat BNSP"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab(2)}
                  className="soft-pill-primary"
                >
                  <span>Selanjutnya</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PROFIL, TERBITAN, PEMASARAN & NASKAH (Semua Ke Bawah) */}
          {activeTab === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 p-4 sm:p-6 panel-inner">
                {formData.submissionType === 'Baru' && (
                  <>
                    <div>
                      <label className={labelCls}>Tujuan Menjadi Anggota *</label>
                      <input
                        type="text"
                        name="tujuanMenjadiAnggota"
                        value={formData.tujuanMenjadiAnggota}
                        onChange={handleChange}
                        placeholder="Tujuan bergabung dengan IKAPI"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Tahun Mulai Usaha *</label>
                      <input
                        type="text"
                        name="tahunMulaiUsaha"
                        value={formData.tahunMulaiUsaha}
                        onChange={handleChange}
                        placeholder="Contoh: 2021"
                        className={inputCls}
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className={labelCls}>Jenis Terbitan</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1.5">
                    {SPECIALIZATIONS.map(spec => {
                      const current = Array.isArray(formData.specialization) ? formData.specialization : [formData.specialization];
                      const checked = current.includes(spec);
                      return (
                        <label
                          key={spec}
                          className={`px-4 py-2.5 rounded-xl border text-sm cursor-pointer flex items-center gap-3 transition ${
                            checked
                              ? 'bg-blue-50 border-[#3b82f6] font-medium text-[#2f6fe0]'
                              : 'border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleSpecializationToggle(spec)}
                            className="w-4 h-4 rounded text-[#3b82f6]"
                          />
                          <span>{spec}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Jumlah Judul Terbit</label>
                  <input
                    type="number"
                    name="jumlahJudulTerbit"
                    value={formData.jumlahJudulTerbit}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Rata-rata Oplah Cetakan Pertama (Eksemplar)</label>
                  <input
                    type="number"
                    name="rataRataOplah"
                    value={formData.rataRataOplah}
                    onChange={handleChange}
                    placeholder="1000"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Rencana Produksi (Judul / Tahun)</label>
                  <input
                    type="number"
                    name="annualBookCount"
                    value={formData.annualBookCount}
                    onChange={handleChange}
                    placeholder="10"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Sistem Pemasaran Buku</label>
                  <input
                    type="text"
                    name="sistemPemasaran"
                    value={formData.sistemPemasaran}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Rata-rata Diskon (%)</label>
                  <input
                    type="text"
                    name="rataRataDiskon"
                    value={formData.rataRataDiskon}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Sistem Penjualan</label>
                  <select
                    name="sistemPenjualan"
                    value={formData.sistemPenjualan}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    <option value="Tunai, Kredit, dan Konsinyasi">Tunai, Kredit & Konsinyasi</option>
                    <option value="Tunai dan Konsinyasi">Tunai & Konsinyasi</option>
                    <option value="Tunai (Cash)">Tunai</option>
                    <option value="Konsinyasi">Konsinyasi</option>
                    <option value="Kredit">Kredit</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Sistem Pengadaan Naskah</label>
                  <select
                    name="sistemPengadaanNaskah"
                    value={formData.sistemPengadaanNaskah}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    <option value="Royalti Penulis & Beli Putus">Royalti & Beli Putus</option>
                    <option value="Sistem Royalti Penulis">Royalti Penulis</option>
                    <option value="Beli Putus (Flat Fee)">Beli Putus</option>
                    <option value="Ditulis Sendiri oleh Tim Internal / Dosen">Ditulis Internal</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Besaran Royalti Rata-rata (%)</label>
                  <input
                    type="text"
                    name="persentaseRoyalti"
                    value={formData.persentaseRoyalti}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab(1)}
                  className="soft-pill"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(3)}
                  className="soft-pill-primary"
                >
                  <span>Selanjutnya</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ORGANISASI & PRODUKSI (Semua Ke Bawah) */}
          {activeTab === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 p-4 sm:p-6 panel-inner">
                <div>
                  <label className={labelCls}>Jumlah Karyawan Redaksi (Orang)</label>
                  <input
                    type="number"
                    name="jumlahKaryawanRedaksi"
                    value={formData.jumlahKaryawanRedaksi}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Jumlah Karyawan Produksi (Orang)</label>
                  <input
                    type="number"
                    name="jumlahKaryawanProduksi"
                    value={formData.jumlahKaryawanProduksi}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Jumlah Karyawan Pemasaran (Orang)</label>
                  <input
                    type="number"
                    name="jumlahKaryawanPemasaran"
                    value={formData.jumlahKaryawanPemasaran}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Jumlah Karyawan Admin / Umum (Orang)</label>
                  <input
                    type="number"
                    name="jumlahKaryawanAdmin"
                    value={formData.jumlahKaryawanAdmin}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Kepemilikan Kantor</label>
                  <select
                    name="kepemilikanKantor"
                    value={formData.kepemilikanKantor}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    <option value="Milik Sendiri">Milik Sendiri</option>
                    <option value="Sewa / Kontrak">Sewa / Kontrak</option>
                    <option value="Gedung Kampus / Institusi Induk">Gedung Kampus / Institusi</option>
                    <option value="Pinjam Pakai">Pinjam Pakai</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Lokasi Kantor</label>
                  <select
                    name="lokasiKantor"
                    value={formData.lokasiKantor}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    <option value="Gedung Perkantoran / Ruko">Gedung Perkantoran / Ruko</option>
                    <option value="Lingkungan Kampus / Lembaga">Lingkungan Kampus / Lembaga</option>
                    <option value="Kawasan Bisnis / Komersial">Kawasan Bisnis</option>
                    <option value="Rumah Tinggal / Perumahan">Rumah Tinggal</option>
                  </select>
                </div>

                {formData.submissionType === 'Heregistrasi' && (
                  <>
                    <div>
                      <label className={labelCls}>Kantor Cabang</label>
                      <input
                        type="text"
                        name="kantorCabang"
                        value={formData.kantorCabang}
                        onChange={handleChange}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Lini Penerbitan / Imprint</label>
                      <input
                        type="text"
                        name="liniPenerbitan"
                        value={formData.liniPenerbitan}
                        onChange={handleChange}
                        className={inputCls}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className={labelCls}>Software Produksi</label>
                  <input
                    type="text"
                    name="softwareProduksi"
                    value={formData.softwareProduksi}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Contoh ISBN</label>
                  <input
                    type="text"
                    name="contohIsbn"
                    value={formData.contohIsbn}
                    onChange={handleChange}
                    placeholder="978-623-..."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Jenis Kertas</label>
                  <input
                    type="text"
                    name="jenisKertas"
                    value={formData.jenisKertas}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Pelaksanaan Cetak</label>
                  <select
                    name="sistemCetak"
                    value={formData.sistemCetak}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    <option value="Cetak di Luar (Percetakan Mitra)">Cetak di Luar</option>
                    <option value="Cetak Sendiri (Memiliki Mesin Percetakan)">Cetak Sendiri</option>
                    <option value="Kombinasi (Cetak Sendiri & Cetak di Luar)">Kombinasi</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Pekerjaan Outsource</label>
                  <input
                    type="text"
                    name="pekerjaanOutsource"
                    value={formData.pekerjaanOutsource}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab(2)}
                  className="soft-pill"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(4)}
                  className="soft-pill-primary"
                >
                  <span>Selanjutnya</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: UNGGAH BERKAS & SUBMIT */}
          {activeTab === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {requiredDocs.map((docItem) => {
                  const chosenFile = selectedFiles[docItem.type];
                  return (
                    <div
                      key={docItem.type}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                        chosenFile ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">{docItem.title} *</div>
                        {chosenFile ? (
                          <div className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 mt-1">
                            <CheckCircle className="w-4 h-4" />
                            <span className="truncate">{chosenFile.name}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 mt-0.5">Format PDF / JPG / PNG</div>
                        )}
                      </div>

                      <label className="soft-pill !text-xs cursor-pointer flex-shrink-0">
                        <Upload className="w-4 h-4" />
                        <span>{chosenFile ? 'Ganti File' : 'Pilih File'}</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => handleFileSelect(docItem.type, e.target.files?.[0])}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab(3)}
                  className="soft-pill"
                >
                  Kembali
                </button>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={submitting}
                    className="soft-pill whitespace-nowrap w-full sm:w-auto"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Draf</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="soft-pill-primary whitespace-nowrap w-full sm:w-auto"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitting ? 'Memproses...' : 'Submit Pengajuan'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
