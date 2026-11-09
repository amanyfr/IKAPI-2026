import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Save, Send, CheckCircle, Check, Upload, ArrowLeft, ArrowRight
} from 'lucide-react';
import {
  PEMASARAN_DISTRIBUTOR, PEMASARAN_SENDIRI, PENJUALAN_OPTIONS, NASKAH_OPTIONS,
  KEPEMILIKAN_KANTOR_OPTIONS, LOKASI_KANTOR_OPTIONS, CETAK_OPTIONS, DEFAULT_KARYAWAN,
  asList, karyawanRows
} from '../utils/formulirIkapi';
import { notify } from '../components/AppDialog';
import { FILTERS, NUMERIC, DECIMAL, PHONE } from '../utils/inputFilters';

// Field formulir yang tidak boleh berisi huruf beserta penyaringnya
const FIELD_FILTERS = {
  nib: FILTERS.digits,
  npwp: FILTERS.npwp,
  postalCode: FILTERS.digits,
  phone: FILTERS.phone,
  fax: FILTERS.phone,
  tahunMulaiUsaha: FILTERS.digits,
  jumlahJudulTerbit: FILTERS.digits,
  rataRataOplah: FILTERS.digits,
  annualBookCount: FILTERS.digits,
  rataRataDiskon: FILTERS.decimal,
  persentaseRoyalti: FILTERS.decimal,
  contohIsbn: FILTERS.isbn,
};

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
      { type: 'kta_lama', title: 'Kartu Anggota Ikapi yang Sudah Habis Masa Berlakunya' },
      { type: 'formulir_heregistrasi', title: 'Isian Formulir Heregistrasi' },
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
  // Draf bisa disimpan di setiap langkah; id disimpan agar simpan berikutnya memperbarui draf yang sama
  const [draftId, setDraftId] = useState(existingSubmission?.id || null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [activeTab, setActiveTab] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState({});
  // Dokumen yang sudah tersimpan di server (draf lama): { document_type: nama file }
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [showMissingDocs, setShowMissingDocs] = useState(false);

  useEffect(() => {
    const id = existingSubmission?.id;
    if (!id) return;
    fetch(`/api/submissions/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const map = {};
        (data?.documents || []).forEach((d) => { if (d.file_path) map[d.document_type] = d.file_name || 'Sudah diunggah'; });
        setUploadedDocs(map);
      })
      .catch(() => {});
  }, [existingSubmission?.id]);

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

    // 4. Pemasaran (pilihan sesuai formulir resmi)
    sistemPemasaran: [],
    rataRataDiskon: '',
    sistemPenjualan: [],

    // 5. Naskah
    sistemPengadaanNaskah: [],
    persentaseRoyalti: '',

    // 6. Organisasi
    karyawan: DEFAULT_KARYAWAN,
    kepemilikanKantor: '',
    lokasiKantor: '',
    kantorCabang1: '',
    kantorCabang2: '',
    liniPenerbitan1: '',
    liniPenerbitan2: '',

    // 7. Produksi
    softwareProduksi: '',
    contohIsbn: '',
    jenisKertas: '',
    sistemCetak: '',
    pekerjaanOutsource: ''
  });

  useEffect(() => {
    if (existingSubmission) {
      const parsed = typeof existingSubmission.form_data === 'string'
        ? JSON.parse(existingSubmission.form_data || '{}')
        : existingSubmission.form_data || {};

      // Isian lama (teks bebas) diselaraskan ke pilihan formulir resmi
      const onlyKnown = (value, options) => asList(value).filter(v => options.includes(v));
      const oneOf = (value, options) => (options.includes(value) ? value : '');
      const rows = karyawanRows(parsed);
      const keepDash = (v) => (v && v.trim() !== '-' ? v : '');

      setFormData(prev => ({
        ...prev,
        ...parsed,
        sistemPemasaran: onlyKnown(parsed.sistemPemasaran, [PEMASARAN_DISTRIBUTOR, ...PEMASARAN_SENDIRI]),
        sistemPenjualan: onlyKnown(parsed.sistemPenjualan, PENJUALAN_OPTIONS),
        sistemPengadaanNaskah: onlyKnown(parsed.sistemPengadaanNaskah, NASKAH_OPTIONS),
        kepemilikanKantor: oneOf(parsed.kepemilikanKantor, KEPEMILIKAN_KANTOR_OPTIONS),
        lokasiKantor: oneOf(parsed.lokasiKantor, LOKASI_KANTOR_OPTIONS),
        sistemCetak: oneOf(parsed.sistemCetak, CETAK_OPTIONS),
        karyawan: rows.length
          ? [...rows, ...Array(Math.max(0, 4 - rows.length)).fill({ bagian: '', jumlah: '' })]
          : prev.karyawan,
        kantorCabang1: parsed.kantorCabang1 ?? keepDash(parsed.kantorCabang),
        liniPenerbitan1: parsed.liniPenerbitan1 ?? keepDash(parsed.liniPenerbitan),
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
    const { name } = e.target;
    const value = FIELD_FILTERS[name] ? FIELD_FILTERS[name](e.target.value) : e.target.value;
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

  // Kotak centang (boleh lebih dari satu) sesuai formulir resmi
  const toggleListValue = (name, value) => {
    setFormData(prev => {
      const current = asList(prev[name]);
      return { ...prev, [name]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] };
    });
  };

  const setKaryawan = (idx, field, value) => {
    setFormData(prev => ({
      ...prev,
      karyawan: prev.karyawan.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    }));
  };

  const handleFileSelect = (docType, file) => {
    if (!file) return;
    setSelectedFiles(prev => ({ ...prev, [docType]: file }));
  };

  const requiredDocs = getRequiredDocsList(formData.submissionType, formData.category);
  const missingDocs = requiredDocs.filter((d) => !selectedFiles[d.type] && !uploadedDocs[d.type]);
  const isHereg = formData.submissionType === 'Heregistrasi';

  const handleSubmit = async (isDraft = false, { stay = false } = {}) => {
    if (isDraft && !formData.publisherName.trim()) {
      notify('Isi Nama Penerbit terlebih dahulu agar draf bisa disimpan.');
      setActiveTab(1);
      return;
    }
    if (!isDraft) {
      if (!formData.publisherName.trim()) {
        notify('Nama penerbit wajib diisi.');
        setActiveTab(1);
        return;
      }
      if (!formData.address.trim()) {
        notify('Alamat kantor wajib diisi.');
        setActiveTab(1);
        return;
      }
      if (!formData.leaderName.trim()) {
        notify('Nama pimpinan wajib diisi.');
        setActiveTab(1);
        return;
      }
      if (formData.submissionType === 'Heregistrasi' && !formData.oldKtaNumber.trim()) {
        notify('Nomor KTA Lama wajib diisi untuk Registrasi.');
        setActiveTab(1);
        return;
      }
    }

    if (!isDraft && missingDocs.length) {
      setActiveTab(4);
      setShowMissingDocs(true);
      notify('Pengajuan belum bisa dikirim karena dokumen berikut belum diunggah:', {
        tone: 'warning',
        title: 'Dokumen belum lengkap',
        items: missingDocs.map((d) => d.title),
        okLabel: 'Unggah dokumen',
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('ikapi_token');
      const endpoint = draftId ? `/api/submissions/${draftId}` : '/api/submissions';
      const method = draftId ? 'PUT' : 'POST';

      // 1) Simpan sebagai draf, 2) unggah dokumen, 3) baru dikirim untuk screening Admin
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...formData, isDraft: true, isSubmit: false })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const subId = data.submissionId || draftId;
      if (subId) setDraftId(subId);

      if (subId && Object.keys(selectedFiles).length > 0) {
        for (const docItem of requiredDocs) {
          const file = selectedFiles[docItem.type];
          if (file) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('documentType', docItem.type);
            fd.append('documentTitle', docItem.title);
            const up = await fetch(`/api/submissions/${subId}/documents`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: fd
            });
            if (!up.ok) {
              const upData = await up.json().catch(() => ({}));
              setActiveTab(4);
              throw new Error(`Dokumen "${docItem.title}" belum berhasil diunggah. ${upData.error || 'Periksa file lalu coba lagi.'}`);
            }
            setUploadedDocs((prev) => ({ ...prev, [docItem.type]: file.name }));
          }
        }
      }

      if (!isDraft) {
        const submitRes = await fetch(`/api/submissions/${subId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...formData, isSubmit: true })
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok) {
          // Draf & dokumen sudah tersimpan; pemohon tetap di formulir untuk melengkapi lalu kirim lagi
          setDraftSavedAt(new Date());
          setActiveTab(4);
          setShowMissingDocs(true);
          throw new Error(submitData.error);
        }
      }

      if (isDraft && stay) {
        setDraftSavedAt(new Date());
        return;
      }
      if (onComplete) onComplete(subId);
    } catch (err) {
      notify(err.message || 'Periksa koneksi internet lalu coba lagi.', {
        tone: 'warning',
        title: isDraft ? 'Draf belum tersimpan' : 'Pengajuan belum terkirim',
      });
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
                  {/* Default anggota biasa; anggota luar biasa hanya opsi tambahan */}
                  <div className={`${inputCls} flex items-center justify-between bg-slate-50`}>
                    <span>{formData.category === 'Luar Biasa' ? 'Anggota Luar Biasa (Perguruan Tinggi / Lembaga)' : 'Anggota Biasa (Badan Usaha)'}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {formData.category === 'Luar Biasa' ? 'Bukan perguruan tinggi / lembaga? ' : 'Penerbit perguruan tinggi atau lembaga? '}
                    <button
                      type="button"
                      onClick={() => handleChange({ target: { name: 'category', value: formData.category === 'Luar Biasa' ? 'Biasa' : 'Luar Biasa' } })}
                      className="text-[#3b82f6] hover:underline font-medium"
                    >
                      {formData.category === 'Luar Biasa' ? 'Kembali ke Anggota Biasa' : 'Daftar sebagai Anggota Luar Biasa'}
                    </button>
                    {' '}— dokumen persyaratan di tab terakhir menyesuaikan.
                  </p>
                </div>

                {formData.submissionType === 'Heregistrasi' && (
                  <div>
                    <label className={labelCls}>No. Anggota Ikapi (KTA Lama) *</label>
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

                {!isHereg && (
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
                )}

                {!isHereg && (<>
                <div>
                  <label className={labelCls}>Nomor Induk Berusaha (NIB)</label>
                  <input
                    type="text"
                    {...NUMERIC} maxLength={13}
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
                    {...NUMERIC} maxLength={20}
                    name="npwp"
                    value={formData.npwp}
                    onChange={handleChange}
                    placeholder="Nomor NPWP"
                    className={inputCls}
                  />
                </div>
                </>)}

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
                    {...NUMERIC} maxLength={5}
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
                    {...PHONE}
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
                    {...PHONE}
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

                {!isHereg && (
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
                )}
              </div>

              <div className="flex justify-end pt-4">
                <div className="flex flex-wrap items-center justify-end gap-2">
                {draftSavedAt && <span className="text-xs text-emerald-700">Draf tersimpan {draftSavedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
                <button
                  type="button"
                  onClick={() => handleSubmit(true, { stay: true })}
                  disabled={submitting}
                  className="soft-pill whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Menyimpan...' : 'Simpan Draf'}</span>
                </button>
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
                        {...NUMERIC} maxLength={4}
                        name="tahunMulaiUsaha"
                        value={formData.tahunMulaiUsaha}
                        onChange={handleChange}
                        placeholder="Contoh: 2021"
                        className={inputCls}
                      />
                    </div>
                  </>
                )}

                {!isHereg && (
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
                )}

                <div>
                  <label className={labelCls}>Jumlah Judul yang Telah Diterbitkan</label>
                  <input
                    type="text"
                    {...NUMERIC}
                    name="jumlahJudulTerbit"
                    value={formData.jumlahJudulTerbit}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Rata-rata Oplag Cetakan Pertama (eks)</label>
                  <input
                    type="text"
                    {...NUMERIC}
                    name="rataRataOplah"
                    value={formData.rataRataOplah}
                    onChange={handleChange}
                    placeholder="1000"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Rencana Produksi/Penerbitan (judul/tahun)</label>
                  <input
                    type="text"
                    {...NUMERIC}
                    name="annualBookCount"
                    value={formData.annualBookCount}
                    onChange={handleChange}
                    placeholder="10"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Rata-rata Diskon yang Lepas (%)</label>
                  <input
                    type="text"
                    {...DECIMAL}
                    name="rataRataDiskon"
                    value={formData.rataRataDiskon}
                    onChange={handleChange}
                    placeholder="30"
                    className={inputCls}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelCls}>Sistem Pemasaran</label>
                  <div className="space-y-2">
                    <ChoiceGroup
                      options={[PEMASARAN_DISTRIBUTOR]}
                      selected={asList(formData.sistemPemasaran)}
                      onToggle={(v) => toggleListValue('sistemPemasaran', v)}
                    />
                    <p className="text-xs text-slate-500">Melalui penjualan sendiri:</p>
                    <ChoiceGroup
                      options={PEMASARAN_SENDIRI}
                      selected={asList(formData.sistemPemasaran)}
                      onToggle={(v) => toggleListValue('sistemPemasaran', v)}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className={labelCls}>Sistem Penjualan</label>
                  <ChoiceGroup
                    options={PENJUALAN_OPTIONS}
                    selected={asList(formData.sistemPenjualan)}
                    onToggle={(v) => toggleListValue('sistemPenjualan', v)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelCls}>Sistem Pengadaan Naskah</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <ChoiceGroup
                      options={NASKAH_OPTIONS}
                      selected={asList(formData.sistemPengadaanNaskah)}
                      onToggle={(v) => toggleListValue('sistemPengadaanNaskah', v)}
                    />
                    {asList(formData.sistemPengadaanNaskah).includes('Royalti') && (
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        Royalti =
                        <input
                          type="text"
                          {...DECIMAL}
                          name="persentaseRoyalti"
                          value={String(formData.persentaseRoyalti || '').replace('%', '')}
                          onChange={handleChange}
                          placeholder="10"
                          className="soft-input !w-20 py-2"
                        />
                        %
                      </label>
                    )}
                  </div>
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
                <div className="flex flex-wrap items-center justify-end gap-2">
                {draftSavedAt && <span className="text-xs text-emerald-700">Draf tersimpan {draftSavedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
                <button
                  type="button"
                  onClick={() => handleSubmit(true, { stay: true })}
                  disabled={submitting}
                  className="soft-pill whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Menyimpan...' : 'Simpan Draf'}</span>
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
            </div>
          )}

          {/* TAB 3: ORGANISASI & PRODUKSI (Semua Ke Bawah) */}
          {activeTab === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 p-4 sm:p-6 panel-inner">
                <div className="md:col-span-2">
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <label className={`${labelCls} !mb-0`}>Jumlah Karyawan (per bagian)</label>
                    <span className="text-xs text-slate-500">
                      Total: <strong className="text-slate-800">
                        {formData.karyawan.reduce((sum, k) => sum + (Number(k.jumlah) || 0), 0)} orang
                      </strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {formData.karyawan.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-4">{idx + 1}.</span>
                        <input
                          type="text"
                          value={row.bagian}
                          onChange={(e) => setKaryawan(idx, 'bagian', e.target.value)}
                          placeholder="Nama bagian"
                          className={`${inputCls} flex-1 min-w-0`}
                        />
                        <input
                          type="text"
                          {...NUMERIC}
                          value={row.jumlah}
                          onChange={(e) => setKaryawan(idx, 'jumlah', FILTERS.digits(e.target.value))}
                          placeholder="0"
                          aria-label={`Jumlah orang bagian ${row.bagian || idx + 1}`}
                          className={`${inputCls} !w-20`}
                        />
                        <span className="text-xs text-slate-500">orang</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Kepemilikan Kantor</label>
                  <ChoiceGroup
                    single
                    options={KEPEMILIKAN_KANTOR_OPTIONS}
                    selected={[formData.kepemilikanKantor]}
                    onToggle={(v) => setFormData(prev => ({ ...prev, kepemilikanKantor: v }))}
                  />
                </div>

                <div>
                  <label className={labelCls}>Lokasi</label>
                  <ChoiceGroup
                    single
                    options={LOKASI_KANTOR_OPTIONS}
                    selected={[formData.lokasiKantor]}
                    onToggle={(v) => setFormData(prev => ({ ...prev, lokasiKantor: v }))}
                  />
                </div>

                {isHereg && (
                  <>
                    <div>
                      <label className={labelCls}>Kantor Cabang / Perwakilan</label>
                      <div className="space-y-2">
                        <input type="text" name="kantorCabang1" value={formData.kantorCabang1} onChange={handleChange} placeholder="1. Kosongkan bila tidak ada" className={inputCls} />
                        <input type="text" name="kantorCabang2" value={formData.kantorCabang2} onChange={handleChange} placeholder="2." className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Lini Penerbitan</label>
                      <div className="space-y-2">
                        <input type="text" name="liniPenerbitan1" value={formData.liniPenerbitan1} onChange={handleChange} placeholder="1. Kosongkan bila tidak ada" className={inputCls} />
                        <input type="text" name="liniPenerbitan2" value={formData.liniPenerbitan2} onChange={handleChange} placeholder="2." className={inputCls} />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className={labelCls}>Program Komputer (Software) yang Digunakan</label>
                  <input
                    type="text"
                    name="softwareProduksi"
                    value={formData.softwareProduksi}
                    onChange={handleChange}
                    placeholder="Contoh: Adobe InDesign, Photoshop"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Nomor ISBN yang Sudah Digunakan</label>
                  <input
                    type="text"
                    maxLength={17}
                    name="contohIsbn"
                    value={formData.contohIsbn}
                    onChange={handleChange}
                    placeholder="Salah satu buku saja, mis. 978-623-..."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Jenis Kertas yang Digunakan</label>
                  <input
                    type="text"
                    name="jenisKertas"
                    value={formData.jenisKertas}
                    onChange={handleChange}
                    placeholder="Contoh: Bookpaper, HVS"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Mencetak Buku</label>
                  <ChoiceGroup
                    single
                    options={CETAK_OPTIONS}
                    selected={[formData.sistemCetak]}
                    onToggle={(v) => setFormData(prev => ({ ...prev, sistemCetak: v }))}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelCls}>Pekerjaan yang Dioutsourcing</label>
                  <input
                    type="text"
                    name="pekerjaanOutsource"
                    value={formData.pekerjaanOutsource}
                    onChange={handleChange}
                    placeholder="Contoh: Percetakan & penjilidan"
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
                <div className="flex flex-wrap items-center justify-end gap-2">
                {draftSavedAt && <span className="text-xs text-emerald-700">Draf tersimpan {draftSavedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
                <button
                  type="button"
                  onClick={() => handleSubmit(true, { stay: true })}
                  disabled={submitting}
                  className="soft-pill whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Menyimpan...' : 'Simpan Draf'}</span>
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
            </div>
          )}

          {/* TAB 4: UNGGAH BERKAS & SUBMIT */}
          {activeTab === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {requiredDocs.map((docItem) => {
                  const chosenFile = selectedFiles[docItem.type];
                  const savedName = uploadedDocs[docItem.type];
                  const hasFile = Boolean(chosenFile || savedName);
                  const flagged = showMissingDocs && !hasFile;
                  return (
                    <div
                      key={docItem.type}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                        hasFile ? 'bg-emerald-50/40 border-emerald-200' : flagged ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-slate-200/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">{docItem.title} *</div>
                        {hasFile ? (
                          <div className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 mt-1">
                            <CheckCircle className="w-4 h-4" />
                            <span className="truncate">{chosenFile ? chosenFile.name : `Sudah diunggah: ${savedName}`}</span>
                          </div>
                        ) : flagged ? (
                          <div className="text-xs text-amber-700 font-semibold mt-0.5">Belum diunggah — wajib sebelum pengajuan dikirim</div>
                        ) : (
                          <div className="text-xs text-slate-400 mt-0.5">Format PDF / JPG / PNG</div>
                        )}
                      </div>

                      <label className="soft-pill !text-xs cursor-pointer flex-shrink-0">
                        <Upload className="w-4 h-4" />
                        <span>{hasFile ? 'Ganti File' : 'Pilih File'}</span>
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
                  {draftSavedAt && <span className="text-xs text-emerald-700 text-center">Draf tersimpan {draftSavedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
                  <button
                    type="button"
                    onClick={() => handleSubmit(true, { stay: true })}
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

// Pilihan bergaya kotak centang (single = pilih salah satu) seperti pada formulir resmi
function ChoiceGroup({ options, selected, onToggle, single = false }) {
  return (
    <div className="flex flex-wrap gap-2" role={single ? 'radiogroup' : 'group'}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            role={single ? 'radio' : 'checkbox'}
            aria-checked={active}
            onClick={() => onToggle(opt)}
            className={`px-3.5 py-2 rounded-xl border text-sm flex items-center gap-2 transition ${
              active
                ? 'bg-blue-50 border-[#3b82f6] text-[#2f6fe0] font-medium'
                : 'bg-white border-slate-200/70 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className={`w-4 h-4 flex items-center justify-center border ${single ? 'rounded-full' : 'rounded'} ${
              active ? 'bg-[#3b82f6] border-[#3b82f6] text-white' : 'border-slate-300 bg-white'
            }`}>
              {active && <Check className="w-3 h-3" strokeWidth={3} />}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}
