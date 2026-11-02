import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import StatusStepper from '../components/StatusStepper';
import CentralPacketExporter from '../components/CentralPacketExporter';
import {
  Building2, CreditCard, Upload, FileText, AlertCircle,
  CheckCircle, Clock, ExternalLink, Plus, RefreshCw,
  Edit3, BadgeCheck, Send, Download, GraduationCap,
  ArrowRight, Star, RotateCcw
} from 'lucide-react';

/* ────────────────────────────────
   Berkas persyaratan dinamis per kategori & jenis
   ──────────────────────────────── */
const REQUIRED_DOCS = {
  Baru: {
    Biasa: [
      { type: 'akta_notaris',   title: 'Akta Notaris / Dokumen Pendirian Perusahaan', desc: 'Akta pendirian PT/CV dari notaris' },
      { type: 'nib',            title: 'NIB (Nomor Induk Berusaha)',                  desc: 'Dari OSS / BKPM' },
      { type: 'formulir',       title: 'Formulir Pendaftaran IKAPI 2026',             desc: 'Formulir yang telah diisi lengkap & ditandatangani' },
      { type: 'sertifikat_bnsp', title: 'Sertifikat BNSP Penerbitan / Editor',       desc: 'Sertifikat kompetensi dari BNSP' },
      { type: 'bukti_bayar',    title: 'Bukti Transfer Pembayaran',                  desc: 'Foto/PDF bukti transfer ke rekening BNI IKAPI' },
    ],
    'Luar Biasa': [
      { type: 'sk_penerbitan',  title: 'SK Pembentukan Unit Penerbitan Buku',         desc: 'Surat Keputusan resmi lembaga' },
      { type: 'domisili_press', title: 'Surat Keterangan Domisili Press',             desc: 'Domisili resmi unit penerbitan' },
      { type: 'formulir',       title: 'Formulir Pendaftaran IKAPI 2026',             desc: 'Formulir yang telah diisi & ditandatangani' },
      { type: 'sertifikat_bnsp', title: 'Sertifikat BNSP Penerbitan / Editor',       desc: 'Sertifikat kompetensi dari BNSP' },
      { type: 'bukti_bayar',    title: 'Bukti Transfer Pembayaran',                  desc: 'Foto/PDF bukti transfer ke rekening BNI IKAPI' },
    ],
  },
  Heregistrasi: {
    Biasa: [
      { type: 'formulir_hereg', title: 'Formulir Heregistrasi IKAPI 2026',           desc: 'Formulir perpanjangan yang telah diisi & ditandatangani' },
      { type: 'kta_lama',       title: 'KTA Lama yang Habis Masa Berlaku',           desc: 'Foto/scan KTA lama' },
      { type: 'bukti_bayar',    title: 'Bukti Transfer Pembayaran',                  desc: 'Foto/PDF bukti transfer ke rekening BNI IKAPI' },
    ],
    'Luar Biasa': [
      { type: 'formulir_hereg', title: 'Formulir Heregistrasi IKAPI 2026',           desc: 'Formulir perpanjangan yang telah diisi & ditandatangani' },
      { type: 'kta_lama',       title: 'KTA Lama yang Habis Masa Berlaku',           desc: 'Foto/scan KTA lama' },
      { type: 'bukti_bayar',    title: 'Bukti Transfer Pembayaran',                  desc: 'Foto/PDF bukti transfer ke rekening BNI IKAPI' },
    ],
  },
};

/* ────────────────────────────────
   Helper
   ──────────────────────────────── */
const token = () => localStorage.getItem('ikapi_token');

export default function AnggotaDashboard({ onNewSubmission, onEditDraft }) {
  const { user } = useAuth();
  const [submissions,    setSubmissions]    = useState([]);
  const [selectedSub,    setSelectedSub]    = useState(null);
  const [detailData,     setDetailData]     = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [showPacket,     setShowPacket]     = useState(false);

  /* ── Pilih Jenis & Kategori (empty state) ── */
  const [pickType,     setPickType]     = useState('Baru');       // 'Baru' | 'Heregistrasi'
  const [pickCategory, setPickCategory] = useState('Biasa');      // 'Biasa' | 'Luar Biasa'

  /* ── Payment form ── */
  const [payForm, setPayForm] = useState({
    senderBank: '', senderAccountName: '', senderAccountNumber: '',
    transferDate: new Date().toISOString().split('T')[0], proofFile: null
  });
  const [submittingPay, setSubmittingPay] = useState(false);

  /* ── Load ── */
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

  /* ── Upload berkas ── */
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

  /* ── Upload bukti bayar ── */
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

  /* ── Loading spinner ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#0da2e7] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Memuat data pengajuan...</p>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     EMPTY STATE — Belum ada pengajuan: pilih jenis & kategori
     ══════════════════════════════════════════════════════════ */
  if (submissions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6">

        {/* Welcome */}
        <div className="text-center space-y-1">
          <div className="w-16 h-16 bg-[#dff2fd] rounded-2xl mx-auto flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-[#0da2e7]" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Buat Pengajuan Keanggotaan</h2>
          <p className="text-sm text-slate-500">Pilih jenis dan kategori pengajuan Anda untuk memulai</p>
        </div>

        {/* Card Pilih */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 p-8 space-y-7">

          {/* Step 1: Jenis Pengajuan */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#0da2e7] text-white text-xs font-black flex items-center justify-center">1</div>
              <h3 className="font-bold text-slate-800 text-sm">Pilih Jenis Pengajuan</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Anggota Baru */}
              <button
                type="button"
                onClick={() => setPickType('Baru')}
                className={`p-5 rounded-2xl border-2 text-left transition-all ${
                  pickType === 'Baru'
                    ? 'border-[#0da2e7] bg-[#f0f9ff] shadow-md shadow-[#0da2e7]/10'
                    : 'border-slate-200 hover:border-[#b8e6fc] hover:bg-slate-50'
                }`}
              >
                <div className="text-2xl mb-2">✨</div>
                <h4 className="font-bold text-slate-900 text-sm">Anggota Baru</h4>
                <p className="text-xs text-slate-500 mt-1 leading-snug">Pertama kali mendaftar sebagai anggota IKAPI Jawa Barat</p>
                {pickType === 'Baru' && (
                  <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-[#0884c4] bg-[#dff2fd] px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Dipilih
                  </div>
                )}
              </button>

              {/* Heregistrasi */}
              <button
                type="button"
                onClick={() => { setPickType('Heregistrasi'); setPickCategory('Biasa'); }}
                className={`p-5 rounded-2xl border-2 text-left transition-all ${
                  pickType === 'Heregistrasi'
                    ? 'border-[#0da2e7] bg-[#f0f9ff] shadow-md shadow-[#0da2e7]/10'
                    : 'border-slate-200 hover:border-[#b8e6fc] hover:bg-slate-50'
                }`}
              >
                <div className="text-2xl mb-2">🔄</div>
                <h4 className="font-bold text-slate-900 text-sm">Heregistrasi</h4>
                <p className="text-xs text-slate-500 mt-1 leading-snug">Perpanjangan Kartu Tanda Anggota (KTA) yang sudah habis masa berlaku</p>
                {pickType === 'Heregistrasi' && (
                  <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-[#0884c4] bg-[#dff2fd] px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Dipilih
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Kategori (hanya untuk Anggota Baru) */}
          {pickType === 'Baru' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-[#0da2e7] text-white text-xs font-black flex items-center justify-center">2</div>
                <h3 className="font-bold text-slate-800 text-sm">Pilih Kategori Keanggotaan</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Anggota Biasa */}
                <button
                  type="button"
                  onClick={() => setPickCategory('Biasa')}
                  className={`p-5 rounded-2xl border-2 text-left transition-all ${
                    pickCategory === 'Biasa'
                      ? 'border-[#0da2e7] bg-[#f0f9ff] shadow-md shadow-[#0da2e7]/10'
                      : 'border-slate-200 hover:border-[#b8e6fc] hover:bg-slate-50'
                  }`}
                >
                  <div className="text-2xl mb-2">🏢</div>
                  <h4 className="font-bold text-slate-900 text-sm">Anggota Biasa</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">Badan usaha penerbit komersial (PT / CV)</p>
                  {pickCategory === 'Biasa' && (
                    <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-[#0884c4] bg-[#dff2fd] px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Dipilih
                    </div>
                  )}
                </button>

                {/* Anggota Luar Biasa */}
                <button
                  type="button"
                  onClick={() => setPickCategory('Luar Biasa')}
                  className={`p-5 rounded-2xl border-2 text-left transition-all ${
                    pickCategory === 'Luar Biasa'
                      ? 'border-[#0da2e7] bg-[#f0f9ff] shadow-md shadow-[#0da2e7]/10'
                      : 'border-slate-200 hover:border-[#b8e6fc] hover:bg-slate-50'
                  }`}
                >
                  <div className="text-2xl mb-2">🎓</div>
                  <h4 className="font-bold text-slate-900 text-sm">Anggota Luar Biasa</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">Institusi pendidikan / university press</p>
                  {pickCategory === 'Luar Biasa' && (
                    <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-[#0884c4] bg-[#dff2fd] px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Dipilih
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Info berkas sesuai pilihan */}
          <div className="bg-[#f8fbfe] border border-[#b8e6fc] rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-[#0884c4] uppercase tracking-wider">
              Berkas yang perlu disiapkan:
            </p>
            <ul className="space-y-1.5">
              {(REQUIRED_DOCS[pickType]?.[pickType === 'Heregistrasi' ? 'Biasa' : pickCategory] || []).map((d) => (
                <li key={d.type} className="flex items-start gap-2 text-xs text-slate-600">
                  <CheckCircle className="w-3.5 h-3.5 text-[#0da2e7] flex-shrink-0 mt-0.5" />
                  <span><strong className="text-slate-800">{d.title}</strong> — {d.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Biaya */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Estimasi Biaya Keanggotaan</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {pickType === 'Baru' ? 'Rp 1.700.000' : 'Rp 1.200.000'}
              </p>
              <p className="text-xs text-slate-400">
                {pickType === 'Baru'
                  ? 'Pangkal Rp250rb + Iuran 24bln Rp1,2jt + Admin Rp250rb'
                  : 'Iuran Perpanjangan 24 bulan @ Rp50.000'}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-semibold">Bank BNI</p>
              <p className="font-mono font-black text-slate-800">2089992087</p>
              <p>a.n. Abdul Rasyid</p>
            </div>
          </div>

          {/* Tombol Mulai */}
          <button
            onClick={() => onNewSubmission({ submissionType: pickType, category: pickCategory })}
            className="w-full py-4 bg-[#0da2e7] hover:bg-[#0884c4] active:bg-[#096ba0]
                       text-white font-bold text-sm rounded-2xl shadow-lg shadow-[#0da2e7]/25
                       transition-all flex items-center justify-center gap-2"
          >
            Mulai Pengisian Formulir
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  /* ─── sub belum loaded ─── */
  const sub      = detailData?.submission || selectedSub;
  const docs     = detailData?.documents  || [];
  const payment  = detailData?.payment;
  const settings = detailData?.settings;

  if (!sub) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-[#0da2e7] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Memuat detail pengajuan...</p>
        </div>
      </div>
    );
  }

  const isDraf             = sub.status === 'Draf';
  const isWaitPayment      = sub.status === 'Menunggu Pembayaran';
  const isNeedRevision     = sub.status === 'Perlu Revisi';
  const isWaitVerification = sub.status === 'Menunggu Verifikasi';
  const isApproved         = ['Disetujui', 'Dikirim ke Pusat', 'Aktif'].includes(sub.status);

  /* ── warna tombol utama ── */
  const primaryBtn =
    'bg-[#0da2e7] hover:bg-[#0884c4] active:bg-[#096ba0] text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5';

  return (
    <div className="space-y-5">

      {/* ── Selector bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500">Pengajuan:</label>
          <select
            value={selectedSub?.id}
            onChange={(e) => loadDetail(Number(e.target.value))}
            className="text-xs font-bold text-slate-800 bg-[#f8fbfe] border border-[#b8e6fc] rounded-lg px-3 py-1.5
                       focus:ring-2 focus:ring-[#dff2fd] focus:border-[#0da2e7] outline-none"
          >
            {submissions.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.id} – {s.publisher_name} ({s.submission_type}) · {s.status}
              </option>
            ))}
          </select>
          <button onClick={() => loadDetail(selectedSub?.id)} title="Muat ulang"
            className="p-1.5 hover:bg-[#f0f9ff] rounded-lg text-slate-400 hover:text-[#0da2e7] transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <button onClick={() => onNewSubmission({ submissionType: 'Baru', category: 'Biasa' })}
          className={`px-3.5 py-1.5 ${primaryBtn}`}>
          <Plus className="w-3.5 h-3.5" /> Pengajuan Baru
        </button>
      </div>

      {/* ── Status Stepper ── */}
      <StatusStepper currentStatus={sub.status} rejectionReason={sub.rejection_reason} />

      {/* ══ KTA AKTIF CARD ══ */}
      {sub.status === 'Aktif' && (
        <div className="bg-gradient-to-r from-[#0884c4] via-[#0da2e7] to-[#35baf5]
                        text-white rounded-3xl p-6 shadow-xl shadow-[#0da2e7]/30 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-4 pointer-events-none">
            <BadgeCheck className="w-56 h-56" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <span className="inline-block bg-white/20 text-white text-xs px-3 py-0.5 rounded-full font-bold border border-white/30">
                ★ Keanggotaan Resmi Aktif ★
              </span>
              <h3 className="text-2xl font-black">{sub.publisher_name}</h3>
              <p className="text-sm text-white/80">
                Anggota {sub.member_category || sub.category} · Pimpinan: {sub.leader_name}
              </p>
              <div className="flex items-center gap-3 pt-1">
                <div className="bg-white/15 border border-white/30 px-4 py-2 rounded-xl">
                  <p className="text-[10px] text-white/60 uppercase font-bold tracking-wider">No. KTA Resmi</p>
                  <p className="text-lg font-mono font-black tracking-wider">
                    {sub.member_kta || sub.kta_number || '—'}
                  </p>
                </div>
              </div>
            </div>
            <button onClick={() => setShowPacket(true)}
              className="px-5 py-3 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-bold text-sm rounded-2xl transition flex items-center gap-2">
              <FileText className="w-4 h-4" /> Paket Dokumen Resmi
            </button>
          </div>
        </div>
      )}

      {/* ══ DRAF ALERT ══ */}
      {isDraf && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">Formulir Masih Berstatus Draf</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Belum dikirimkan. Lanjutkan pengisian untuk maju ke tahap pembayaran.
              </p>
            </div>
          </div>
          <button onClick={() => onEditDraft(sub)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5" /> Lanjutkan Formulir
          </button>
        </div>
      )}

      {/* ══ REVISI ALERT ══ */}
      {isNeedRevision && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">Pengajuan Memerlukan Perbaikan Berkas</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                {sub.admin_notes || 'Terdapat berkas yang perlu diperbaiki. Ganti file yang ditandai di bawah. Anda tidak perlu membayar ulang.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══ MENUNGGU VERIFIKASI ALERT ══ */}
      {isWaitVerification && (
        <div className="bg-[#f0f9ff] border border-[#b8e6fc] rounded-2xl p-5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#dff2fd] flex items-center justify-center flex-shrink-0">
            <Send className="w-4 h-4 text-[#0da2e7]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#0884c4]">Menunggu Verifikasi Admin</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Bukti pembayaran Anda sudah diterima. Tim Admin 1 sedang memeriksa berkas dan pembayaran Anda.
            </p>
          </div>
        </div>
      )}

      {/* ══ PEMBAYARAN & UPLOAD BUKTI BAYAR ══ */}
      {(isWaitPayment || (payment && payment.verification_status !== 'Valid' && !isDraf)) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Header */}
          <div className="bg-[#0da2e7] text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              <h3 className="font-bold text-sm">Tagihan & Informasi Pembayaran IKAPI</h3>
            </div>
            <span className="bg-white/20 text-white/90 text-xs px-2.5 py-0.5 rounded-full font-bold border border-white/30">
              {payment?.verification_status === 'Menunggu' ? 'Menunggu Verifikasi' : 'Wajib Bayar'}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Rincian tagihan */}
            <div className="space-y-4">
              <div className="bg-[#f8fbfe] border border-[#b8e6fc] rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-[#0884c4] uppercase tracking-wider">Rincian Biaya (IKAPI 2026)</p>
                {sub.submission_type === 'Baru' ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Uang Pangkal Anggota Baru</span>
                      <span className="font-semibold">Rp 250.000</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Iuran Anggota 24 Bln (@ Rp50.000)</span>
                      <span className="font-semibold">Rp 1.200.000</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Biaya Administrasi & Verifikasi</span>
                      <span className="font-semibold">Rp 250.000</span>
                    </div>
                    <div className="border-t border-[#b8e6fc] pt-2 flex justify-between font-black text-sm">
                      <span className="text-slate-800">Total Tagihan</span>
                      <span className="text-[#0da2e7] text-base">Rp 1.700.000</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Iuran Perpanjangan 24 Bln (@ Rp50.000)</span>
                      <span className="font-semibold">Rp 1.200.000</span>
                    </div>
                    <div className="border-t border-[#b8e6fc] pt-2 flex justify-between font-black text-sm">
                      <span className="text-slate-800">Total Tagihan Heregistrasi</span>
                      <span className="text-[#0da2e7] text-base">Rp 1.200.000</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Rekening tujuan */}
              <div className="bg-[#f0f9ff] border border-[#b8e6fc] rounded-2xl p-4 space-y-1">
                <p className="text-[10px] font-bold text-[#0884c4] uppercase tracking-wider">Transfer ke Rekening Resmi:</p>
                <p className="text-sm font-bold text-slate-800">Bank BNI (Bank Negara Indonesia)</p>
                <p className="text-xl font-mono font-black text-[#0da2e7] tracking-wider">2089992087</p>
                <p className="text-xs text-slate-600 font-semibold">a.n. Abdul Rasyid</p>
              </div>
            </div>

            {/* Upload bukti bayar */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
                Unggah Bukti Transfer
              </h4>
              <form onSubmit={handlePaymentSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bank Pengirim *</label>
                  <input type="text" required
                    value={payForm.senderBank}
                    onChange={(e) => setPayForm({ ...payForm, senderBank: e.target.value })}
                    placeholder="BCA / Mandiri / BRI / BNI..."
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl
                               focus:ring-2 focus:ring-[#dff2fd] focus:border-[#0da2e7] outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nama Pemilik Rekening *</label>
                  <input type="text" required
                    value={payForm.senderAccountName}
                    onChange={(e) => setPayForm({ ...payForm, senderAccountName: e.target.value })}
                    placeholder="Nama di buku tabungan"
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl
                               focus:ring-2 focus:ring-[#dff2fd] focus:border-[#0da2e7] outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">No. Rekening</label>
                    <input type="text"
                      value={payForm.senderAccountNumber}
                      onChange={(e) => setPayForm({ ...payForm, senderAccountNumber: e.target.value })}
                      placeholder="XXXX-XXXX"
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl
                                 focus:ring-2 focus:ring-[#dff2fd] focus:border-[#0da2e7] outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tanggal Transfer *</label>
                    <input type="date" required
                      value={payForm.transferDate}
                      onChange={(e) => setPayForm({ ...payForm, transferDate: e.target.value })}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl
                                 focus:ring-2 focus:ring-[#dff2fd] focus:border-[#0da2e7] outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    File Bukti Transfer (JPG / PNG / PDF) *
                  </label>
                  <input type="file" accept="image/*,application/pdf"
                    required={!payment?.proof_file}
                    onChange={(e) => setPayForm({ ...payForm, proofFile: e.target.files[0] })}
                    className="w-full text-xs text-slate-500
                               file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                               file:text-xs file:font-semibold file:bg-[#dff2fd] file:text-[#0884c4]
                               hover:file:bg-[#b8e6fc]" />
                </div>
                {payment?.proof_file && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Bukti terunggah: {payment.proof_filename || 'Bukti.jpg'}
                  </p>
                )}
                <button type="submit" disabled={submittingPay}
                  className="w-full mt-1 py-2.5 bg-[#0da2e7] hover:bg-[#0884c4] disabled:opacity-60
                             text-white text-xs font-bold rounded-xl shadow shadow-[#0da2e7]/20
                             transition flex items-center justify-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  {submittingPay ? 'Mengunggah...' : 'Kirim Bukti Pembayaran'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══ DAFTAR BERKAS PERSYARATAN ══ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-[#f8fbfe]">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Berkas Persyaratan Keanggotaan</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kategori: <strong className="text-[#0884c4]">Anggota {sub.member_category || sub.category}</strong>
              {' '}· Jenis: <strong className="text-[#0884c4]">{sub.submission_type}</strong>
            </p>
          </div>
          <span className="text-xs bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc] px-3 py-1 rounded-full font-bold">
            {docs.filter(d => d.screening_status === 'Sesuai').length} / {docs.length} Terverifikasi
          </span>
        </div>

        <div className="p-5 space-y-3">
          {docs.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Belum ada berkas yang terdaftar.</p>
          )}
          {docs.map((doc, idx) => {
            const isRevisi  = doc.screening_status === 'Perlu Revisi';
            const isSesuai  = doc.screening_status === 'Sesuai';
            const canUpload = !isApproved && !isWaitVerification;

            return (
              <div
                key={doc.id || idx}
                className={`p-4 rounded-2xl border transition ${
                  isRevisi  ? 'border-amber-300 bg-amber-50/60 ring-1 ring-amber-200'
                  : isSesuai ? 'border-emerald-200 bg-emerald-50/30'
                  : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-800">{doc.document_title}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        isSesuai  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : isRevisi ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {doc.screening_status || 'Menunggu Verifikasi'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {doc.file_name && doc.file_name !== 'Belum diunggah'
                        ? `📎 ${doc.file_name}`
                        : 'Belum ada file diunggah'}
                    </p>
                    {isRevisi && (
                      <div className="mt-2 p-2.5 bg-amber-100 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <strong>📝 Catatan Admin 1:</strong>{' '}
                        {doc.revision_notes || 'Mohon unggah file yang lebih jelas dan sesuai standar.'}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.file_path && (
                      <a href={doc.file_path} target="_blank" rel="noreferrer"
                        className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg flex items-center gap-1 transition">
                        <ExternalLink className="w-3.5 h-3.5" /> Lihat
                      </a>
                    )}
                    {/* Upload hanya diizinkan jika bisa diubah */}
                    {(canUpload || isRevisi) && (
                      <label className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition ${
                        isRevisi   ? 'bg-amber-500 hover:bg-amber-600 text-white shadow'
                        : doc.file_path ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                        : 'bg-[#0da2e7] hover:bg-[#0884c4] text-white shadow shadow-[#0da2e7]/20'
                      }`}>
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingDocId === doc.id ? 'Mengunggah...' : doc.file_path ? 'Ganti' : 'Unggah'}</span>
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                          disabled={uploadingDocId === doc.id}
                          onChange={(e) => handleDocUpload(doc, e.target.files[0])} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ Riwayat Status ══ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-800 text-sm mb-4">Riwayat & Catatan Proses Pengajuan</h3>
        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-[#0da2e7]" />
              <div className="w-px flex-1 bg-slate-200 mt-1" />
            </div>
            <div className="pb-3">
              <p className="font-semibold text-slate-800">Pengajuan Dibuat</p>
              <p className="text-slate-400 mt-0.5">{sub.created_at ? new Date(sub.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
            </div>
          </div>
          {sub.submitted_at && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-[#0da2e7]" />
                <div className="w-px flex-1 bg-slate-200 mt-1" />
              </div>
              <div className="pb-3">
                <p className="font-semibold text-slate-800">Formulir Disubmit</p>
                <p className="text-slate-400 mt-0.5">{new Date(sub.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          )}
          {sub.admin_notes && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Catatan dari Admin</p>
                <p className="mt-0.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  {sub.admin_notes}
                </p>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-slate-300 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-500">Status Saat Ini: <span className="text-[#0884c4]">{sub.status}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* ══ PACKET MODAL ══ */}
      {showPacket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button onClick={() => setShowPacket(false)}
                className="px-3 py-1.5 bg-white text-slate-700 font-bold text-xs rounded-xl shadow hover:bg-slate-100">
                ✕ Tutup
              </button>
            </div>
            <CentralPacketExporter submission={sub} documents={docs} settings={settings} />
          </div>
        </div>
      )}
    </div>
  );
}
