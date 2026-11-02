import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import StatusStepper from '../components/StatusStepper';
import CentralPacketExporter from '../components/CentralPacketExporter';
import {
  Building2, CreditCard, Upload, FileText, AlertCircle,
  CheckCircle, ExternalLink, Plus, RefreshCw,
  Edit3, GraduationCap, ArrowRight, UserPlus, X,
  ShieldCheck, Landmark
} from 'lucide-react';

const REQUIRED_DOCS = {
  Baru: {
    Biasa: [
      'Akta Notaris / Pendirian Perusahaan',
      'NIB (Nomor Induk Berusaha)',
      'Formulir Pendaftaran IKAPI 2026',
      'Sertifikat BNSP Penerbitan / Editor',
    ],
    'Luar Biasa': [
      'SK Pembentukan Unit Penerbitan Buku',
      'Surat Keterangan Domisili Press',
      'Formulir Pendaftaran IKAPI 2026',
      'Sertifikat BNSP Penerbitan / Editor',
    ],
  },
  Heregistrasi: {
    Biasa: [
      'Formulir Heregistrasi IKAPI 2026',
      'KTA Lama',
    ],
    'Luar Biasa': [
      'Formulir Heregistrasi IKAPI 2026',
      'KTA Lama',
    ],
  },
};

const token = () => localStorage.getItem('ikapi_token');

export default function AnggotaDashboard({ onNewSubmission, onEditDraft }) {
  const { user } = useAuth();
  const [submissions,    setSubmissions]    = useState([]);
  const [selectedSub,    setSelectedSub]    = useState(null);
  const [detailData,     setDetailData]     = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [showPacket,     setShowPacket]     = useState(false);

  const [pickType,     setPickType]     = useState('Baru');
  const [pickCategory, setPickCategory] = useState('Biasa');

  const [payForm, setPayForm] = useState({
    senderBank: '',
    senderAccountName: '',
    senderAccountNumber: '',
    transferDate: new Date().toISOString().split('T')[0],
    proofFile: null
  });
  const [submittingPay, setSubmittingPay] = useState(false);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/submissions', { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      const list = data.submissions || [];
      setSubmissions(list);
      if (list.length > 0) {
        const id = selectedSub?.id || list[0].id;
        await loadDetail(id);
      } else {
        setDetailData(null);
      }
    } catch (e) { console.error(e); }
    finally    { setLoading(false); }
  };

  const loadDetail = async (id) => {
    try {
      const res  = await fetch(`/api/submissions/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setDetailData(data);
      setSelectedSub(data.submission);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadSubmissions(); }, [user]);

  const handleDocUpload = async (doc, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('documentType', doc.document_type || doc.type);
    fd.append('documentTitle', doc.document_title || doc.title);
    setUploadingDocId(doc.id);
    try {
      const res  = await fetch(`/api/submissions/${selectedSub.id}/documents`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadDetail(selectedSub.id);
    } catch (e) { alert('Gagal mengunggah berkas: ' + e.message); }
    finally    { setUploadingDocId(null); }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!payForm.proofFile) { alert('Pilih file bukti transfer terlebih dahulu.'); return; }
    const fd = new FormData();
    fd.append('proofFile', payForm.proofFile);
    fd.append('senderBank', payForm.senderBank);
    fd.append('senderAccountName', payForm.senderAccountName);
    fd.append('senderAccountNumber', payForm.senderAccountNumber);
    fd.append('transferDate', payForm.transferDate);
    setSubmittingPay(true);
    try {
      const res  = await fetch(`/api/submissions/${selectedSub.id}/payment`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadDetail(selectedSub.id);
      await loadSubmissions();
    } catch (e) { alert('Gagal mengunggah pembayaran: ' + e.message); }
    finally    { setSubmittingPay(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="w-10 h-10 border-3 border-[#0da2e7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     EMPTY STATE — Pilihan Jenis & Kategori (Full Width & Blue Accent)
     ══════════════════════════════════════════════════════════ */
  if (submissions.length === 0) {
    return (
      <div className="w-full">
        <div className="bg-white rounded-2xl border border-[#b8e6fc] shadow-lg shadow-[#0884c4]/5 overflow-hidden">

          {/* Header */}
          <div className="bg-white border-b border-[#d8effd] px-8 py-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Pengajuan Keanggotaan IKAPI Jawa Barat</h2>
              <p className="text-sm text-slate-500 mt-0.5">Pilih jenis pengajuan dan kategori keanggotaan penerbit</p>
            </div>
            <div className="bg-[#eaf6fe] border border-[#b8e6fc] px-5 py-2.5 rounded-xl text-right">
              <div className="text-[11px] uppercase font-bold text-[#0884c4] tracking-wider">Biaya Pendaftaran</div>
              <div className="text-xl font-extrabold text-[#0884c4]">
                {pickType === 'Baru' ? 'Rp 1.700.000' : 'Rp 1.200.000'}
              </div>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-gradient-to-b from-[#f5fbff] to-white">

            {/* Left Column: Choices */}
            <div className="lg:col-span-8 space-y-6">
              {/* Jenis Pengajuan */}
              <div>
                <label className="text-sm font-bold text-[#065986] uppercase tracking-wider block mb-3">
                  1. Pilih Jenis Pengajuan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'Baru', label: 'Anggota Baru', sub: 'Pendaftaran anggota pertama kali', icon: UserPlus },
                    { id: 'Heregistrasi', label: 'Heregistrasi', sub: 'Perpanjangan masa berlaku KTA', icon: RefreshCw }
                  ].map(item => {
                    const Icon = item.icon;
                    const active = pickType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPickType(item.id)}
                        className={`p-5 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                          active
                            ? 'border-[#0da2e7] bg-[#eaf6fe] shadow-md shadow-[#0da2e7]/10'
                            : 'border-[#d6eefc] hover:border-[#0da2e7] bg-white'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                          active ? 'bg-[#0884c4] text-white shadow' : 'bg-[#eaf6fe] text-[#0884c4]'
                        }`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-base font-extrabold text-slate-900">{item.label}</span>
                            {active && <CheckCircle className="w-5 h-5 text-[#0884c4]" />}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">{item.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kategori Keanggotaan */}
              <div>
                <label className="text-sm font-bold text-[#065986] uppercase tracking-wider block mb-3">
                  2. Pilih Kategori Keanggotaan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'Biasa', label: 'Anggota Biasa', sub: 'Badan Usaha Penerbit (PT / CV)', icon: Building2 },
                    { id: 'Luar Biasa', label: 'Anggota Luar Biasa', sub: 'Perguruan Tinggi / Lembaga', icon: GraduationCap }
                  ].map(item => {
                    const Icon = item.icon;
                    const active = pickCategory === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPickCategory(item.id)}
                        className={`p-5 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                          active
                            ? 'border-[#0da2e7] bg-[#eaf6fe] shadow-md shadow-[#0da2e7]/10'
                            : 'border-[#d6eefc] hover:border-[#0da2e7] bg-white'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                          active ? 'bg-[#0884c4] text-white shadow' : 'bg-[#eaf6fe] text-[#0884c4]'
                        }`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-base font-extrabold text-slate-900">{item.label}</span>
                            {active && <CheckCircle className="w-5 h-5 text-[#0884c4]" />}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">{item.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Docs & Action */}
            <div className="lg:col-span-4 flex flex-col justify-between bg-[#eaf6fe] border border-[#b8e6fc] rounded-2xl p-6 space-y-6">
              <div>
                <div className="text-sm font-extrabold text-[#065986] uppercase tracking-wider mb-3">
                  Berkas Persyaratan
                </div>
                <div className="space-y-2.5">
                  {(REQUIRED_DOCS[pickType]?.[pickCategory] || []).map((title) => (
                    <div key={title} className="flex items-center gap-2.5 bg-white px-3.5 py-2.5 rounded-xl border border-[#cdeafd] text-sm font-semibold text-slate-800">
                      <CheckCircle className="w-4 h-4 text-[#0da2e7] flex-shrink-0" />
                      <span>{title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onNewSubmission({ submissionType: pickType, category: pickCategory })}
                className="w-full py-4 bg-gradient-to-r from-[#0884c4] to-[#0da2e7] hover:from-[#066ba3] hover:to-[#0884c4] text-white font-bold text-base rounded-xl shadow-lg shadow-[#0884c4]/25 transition flex items-center justify-center gap-2"
              >
                <span>Isi Formulir Pengajuan</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Data Pengajuan Aktif ─── */
  const sub      = detailData?.submission || selectedSub;
  const docs     = detailData?.documents  || [];
  const payment  = detailData?.payment;
  const settings = detailData?.settings;

  if (!sub) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="w-10 h-10 border-3 border-[#0da2e7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isDraf        = sub.status === 'Draf';
  const isWaitPayment = sub.status === 'Menunggu Pembayaran';
  const isNeedRevision = sub.status === 'Perlu Revisi';

  return (
    <div className="space-y-6 w-full">

      {/* ── Top Control Bar (Biru Muda & Putih) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-6 py-4 rounded-2xl border border-[#b8e6fc] shadow-md shadow-[#0884c4]/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#eaf6fe] border border-[#b8e6fc] flex items-center justify-center text-[#0884c4]">
            <Building2 className="w-5 h-5" />
          </div>
          <select
            value={selectedSub?.id}
            onChange={(e) => loadDetail(Number(e.target.value))}
            className="text-sm font-bold text-slate-900 bg-[#f4faff] border border-[#b8e6fc] rounded-xl px-4 py-2.5 focus:border-[#0da2e7] outline-none"
          >
            {submissions.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.id} — {s.publisher_name} ({s.submission_type} / {s.member_category || s.category})
              </option>
            ))}
          </select>
          <button
            onClick={() => loadDetail(selectedSub?.id)}
            title="Muat ulang"
            className="p-2.5 bg-[#f4faff] border border-[#b8e6fc] hover:bg-[#dff2fd] rounded-xl text-[#0884c4] transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isDraf && (
            <button
              onClick={() => onEditDraft(sub)}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl shadow-sm transition flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              <span>Lanjutkan Draf</span>
            </button>
          )}
          <button
            onClick={() => onNewSubmission({ submissionType: 'Baru', category: 'Biasa' })}
            className="px-5 py-2.5 bg-gradient-to-r from-[#0884c4] to-[#0da2e7] hover:from-[#066ba3] hover:to-[#0884c4] text-white font-bold text-sm rounded-xl shadow-md shadow-[#0884c4]/20 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Pengajuan Baru</span>
          </button>
        </div>
      </div>

      {/* ── Status Stepper ── */}
      <StatusStepper currentStatus={sub.status} rejectionReason={sub.rejection_reason} />

      {/* ══ KTA AKTIF CARD ══ */}
      {sub.status === 'Aktif' && (
        <div className="bg-gradient-to-r from-[#066ba3] via-[#0884c4] to-[#0da2e7] text-white rounded-2xl p-7 shadow-lg shadow-[#0884c4]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-white/20 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Anggota Resmi Aktif</span>
            </div>
            <h3 className="text-2xl font-extrabold">{sub.publisher_name}</h3>
            <p className="text-sm text-[#dff2fd] font-mono">
              Nomor KTA: <strong className="text-white text-base">{sub.member_kta || sub.kta_number || '—'}</strong>
            </p>
          </div>
          <button
            onClick={() => setShowPacket(true)}
            className="px-6 py-3 bg-white text-[#0884c4] hover:bg-[#f0f9ff] font-bold text-sm rounded-xl shadow transition flex items-center gap-2 self-start sm:self-center"
          >
            <FileText className="w-4 h-4" />
            <span>Unduh Dokumen Resmi</span>
          </button>
        </div>
      )}

      {/* ══ CATATAN REVISI ADMIN ══ */}
      {isNeedRevision && sub.admin_notes && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <span className="font-bold">Catatan Verifikator: </span>
            <span>{sub.admin_notes}</span>
          </div>
        </div>
      )}

      {/* ══ PEMBAYARAN & UPLOAD BUKTI BAYAR ══ */}
      {(isWaitPayment || (payment && payment.verification_status !== 'Valid' && !isDraf)) && (
        <div className="bg-white rounded-2xl border border-[#b8e6fc] shadow-md shadow-[#0884c4]/5 overflow-hidden">
          <div className="bg-white border-b border-[#d8effd] px-7 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-5 h-5 text-[#0884c4]" />
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Pembayaran Keanggotaan</h3>
            </div>
            <span className="text-xs font-bold px-3.5 py-1 rounded-full bg-[#eaf6fe] text-[#0884c4] border border-[#b8e6fc]">
              {payment?.verification_status === 'Menunggu' ? 'Menunggu Verifikasi' : 'Belum Dibayar'}
            </span>
          </div>

          <div className="p-7 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-gradient-to-b from-[#f5fbff] to-white">
            {/* Info Tagihan & Rekening */}
            <div className="space-y-5">
              <div className="bg-white border border-[#cdeafd] rounded-xl p-5 space-y-3 text-sm">
                {sub.submission_type === 'Baru' ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Uang Pangkal</span>
                      <span className="font-semibold text-slate-900">Rp 250.000</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Iuran 24 Bulan</span>
                      <span className="font-semibold text-slate-900">Rp 1.200.000</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Biaya Administrasi</span>
                      <span className="font-semibold text-slate-900">Rp 250.000</span>
                    </div>
                    <div className="border-t border-[#d8effd] pt-3 flex justify-between font-extrabold text-base text-slate-900">
                      <span>Total Tagihan</span>
                      <span className="text-[#0884c4] text-lg">Rp 1.700.000</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Iuran Perpanjangan 24 Bulan</span>
                      <span className="font-semibold text-slate-900">Rp 1.200.000</span>
                    </div>
                    <div className="border-t border-[#d8effd] pt-3 flex justify-between font-extrabold text-base text-slate-900">
                      <span>Total Tagihan</span>
                      <span className="text-[#0884c4] text-lg">Rp 1.200.000</span>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-gradient-to-r from-[#0884c4] to-[#0da2e7] text-white rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs text-[#dff2fd] font-semibold uppercase tracking-wider">Rekening Tujuan (Bank BNI)</p>
                  <p className="text-2xl font-mono font-extrabold mt-1 tracking-wider">2089992087</p>
                  <p className="text-sm text-white/90 font-semibold mt-0.5">a.n. Abdul Rasyid</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                  <Landmark className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {/* Form Konfirmasi */}
            <form onSubmit={handlePaymentSubmit} className="bg-white border border-[#cdeafd] rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-slate-800 block mb-1.5">Bank Pengirim *</label>
                  <input
                    type="text"
                    required
                    value={payForm.senderBank}
                    onChange={(e) => setPayForm({ ...payForm, senderBank: e.target.value })}
                    placeholder="BCA / Mandiri / BNI / BRI"
                    className="w-full text-sm px-3.5 py-2.5 bg-[#f8fbfe] border border-[#b8e6fc] rounded-xl focus:border-[#0da2e7] outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-800 block mb-1.5">Nama Pengirim *</label>
                  <input
                    type="text"
                    required
                    value={payForm.senderAccountName}
                    onChange={(e) => setPayForm({ ...payForm, senderAccountName: e.target.value })}
                    placeholder="Nama pemilik rekening"
                    className="w-full text-sm px-3.5 py-2.5 bg-[#f8fbfe] border border-[#b8e6fc] rounded-xl focus:border-[#0da2e7] outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-800 block mb-1.5">No. Rekening</label>
                  <input
                    type="text"
                    value={payForm.senderAccountNumber}
                    onChange={(e) => setPayForm({ ...payForm, senderAccountNumber: e.target.value })}
                    placeholder="Nomor rekening"
                    className="w-full text-sm px-3.5 py-2.5 bg-[#f8fbfe] border border-[#b8e6fc] rounded-xl focus:border-[#0da2e7] outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-800 block mb-1.5">Tanggal Transfer *</label>
                  <input
                    type="date"
                    required
                    value={payForm.transferDate}
                    onChange={(e) => setPayForm({ ...payForm, transferDate: e.target.value })}
                    className="w-full text-sm px-3.5 py-2.5 bg-[#f8fbfe] border border-[#b8e6fc] rounded-xl focus:border-[#0da2e7] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-800 block mb-1.5">Bukti Transfer (PDF/JPG/PNG) *</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required={!payment?.proof_file}
                  onChange={(e) => setPayForm({ ...payForm, proofFile: e.target.files[0] })}
                  className="w-full text-sm text-slate-600 bg-[#f8fbfe] border border-[#b8e6fc] rounded-xl p-2
                             file:mr-3 file:py-1.5 file:px-3.5 file:rounded-lg file:border-0
                             file:text-xs file:font-bold file:bg-[#0da2e7] file:text-white"
                />
              </div>

              {payment?.proof_file && (
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Terunggah: {payment.proof_filename || 'Bukti Transfer'}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={submittingPay}
                className="w-full py-3 bg-gradient-to-r from-[#0884c4] to-[#0da2e7] hover:from-[#066ba3] hover:to-[#0884c4] disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-md shadow-[#0884c4]/20 transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>{submittingPay ? 'Mengunggah...' : 'Unggah Bukti Pembayaran'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ DAFTAR BERKAS PERSYARATAN ══ */}
      <div className="bg-white rounded-2xl border border-[#b8e6fc] shadow-md shadow-[#0884c4]/5 overflow-hidden">
        <div className="bg-white border-b border-[#d8effd] px-7 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#0884c4]" />
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Dokumen Persyaratan</h3>
          </div>
          <span className="text-xs font-bold bg-[#eaf6fe] text-[#0884c4] border border-[#b8e6fc] px-3.5 py-1 rounded-full">
            {docs.filter(d => d.screening_status === 'Sesuai').length}/{docs.length} Sesuai
          </span>
        </div>

        <div className="divide-y divide-[#e2f2fd]">
          {docs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Tidak ada dokumen.</p>
          )}
          {docs.map((doc, idx) => {
            const isRevisi  = doc.screening_status === 'Perlu Revisi';
            const isSesuai  = doc.screening_status === 'Sesuai';
            const hasFile   = Boolean(doc.file_path && doc.file_name && doc.file_name !== 'Belum diunggah');
            const canUpload = isNeedRevision ? isRevisi : (isDraf || isWaitPayment);

            return (
              <div
                key={doc.id || idx}
                className={`px-7 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fbfe]'
                }`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">{doc.document_title}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      isSesuai  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : isRevisi ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-[#eaf6fe] text-[#0884c4] border border-[#b8e6fc]'
                    }`}>
                      {doc.screening_status || 'Menunggu'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {hasFile ? doc.file_name : 'Belum diunggah'}
                  </p>
                  {isRevisi && doc.revision_notes && (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1.5">
                      <strong>Revisi:</strong> {doc.revision_notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {doc.file_path && (
                    <a
                      href={doc.file_path}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 text-xs bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc] font-bold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Lihat</span>
                    </a>
                  )}
                  {canUpload ? (
                    <label className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition ${
                      isRevisi
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                        : doc.file_path
                        ? 'bg-white hover:bg-[#f0f9ff] text-[#0884c4] border border-[#b8e6fc]'
                        : 'bg-[#0da2e7] hover:bg-[#0884c4] text-white shadow-sm'
                    }`}>
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingDocId === doc.id ? '...' : isRevisi ? 'Perbaiki' : doc.file_path ? 'Ganti' : 'Unggah'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={uploadingDocId === doc.id}
                        onChange={(e) => handleDocUpload(doc, e.target.files[0])}
                      />
                    </label>
                  ) : isSesuai ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ PACKET MODAL ══ */}
      {showPacket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowPacket(false)}
                className="px-4 py-2 bg-white text-slate-800 font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Tutup</span>
              </button>
            </div>
            <CentralPacketExporter submission={sub} documents={docs} settings={settings} />
          </div>
        </div>
      )}
    </div>
  );
}
