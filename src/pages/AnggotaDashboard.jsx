import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import StatusStepper from '../components/StatusStepper';
import CentralPacketExporter from '../components/CentralPacketExporter';
import PaymentInvoice, { downloadInvoicePdf, invoiceNumber, isInvoicePaid } from '../components/PaymentInvoice';
import { feesFromSettings, formatRupiah } from '../utils/fees';
import { formatLongDate } from '../components/PengurusSignature';
import {
  Building2, CreditCard, Upload, FileText, AlertCircle,
  CheckCircle, ExternalLink, RefreshCw,
  Edit3, GraduationCap, ArrowRight, UserPlus, X,
  ShieldCheck, Landmark, Receipt, Download, XCircle, PartyPopper
} from 'lucide-react';

// Label hasil screening berkas: hijau = diterima, merah = tidak sesuai (unggah ulang), abu = belum diperiksa
const SCREENING_LABEL = {
  Sesuai:         { text: 'Diterima',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Perlu Revisi': { text: 'Tidak sesuai',    cls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500' },
  Menunggu:       { text: 'Menunggu screening', cls: 'bg-slate-50 text-slate-600 border-slate-200',    dot: 'bg-slate-400' },
};

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
      'Formulir Registrasi IKAPI 2026',
      'KTA Lama',
    ],
    'Luar Biasa': [
      'Formulir Registrasi IKAPI 2026',
      'KTA Lama',
    ],
  },
};

const token = () => localStorage.getItem('ikapi_token');

export default function AnggotaDashboard({ onNewSubmission, onEditDraft, onEditProfile, defaultType = 'Baru', defaultCategory = 'Biasa' }) {
  const { user } = useAuth();
  const [submissions,    setSubmissions]    = useState([]);
  const [selectedSub,    setSelectedSub]    = useState(null);
  const [detailData,     setDetailData]     = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [showPacket,     setShowPacket]     = useState(false);
  const [showInvoice,    setShowInvoice]    = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [appSettings,    setAppSettings]    = useState({});
  const [showWelcome,    setShowWelcome]    = useState(false);
  const [lastUpdated,    setLastUpdated]    = useState(null);

  const [pickType,     setPickType]     = useState(defaultType);
  const [pickCategory, setPickCategory] = useState(defaultCategory);

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
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadSubmissions(); }, [user]);

  // Biaya & rekening diatur Admin: dimuat ulang tiap 30 detik dan saat kembali ke tab,
  // jadi perubahan harga oleh Admin langsung terlihat di sini
  useEffect(() => {
    const loadSettings = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => data.settings && setAppSettings(data.settings))
        .catch((err) => console.error('Failed to load settings:', err));
    };
    loadSettings();
    const timer = setInterval(loadSettings, 30000);
    document.addEventListener('visibilitychange', loadSettings);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', loadSettings);
    };
  }, []);

  // Perbarui status pengajuan: tombol manual dengan indikator, otomatis tiap 30 detik,
  // dan saat pengguna kembali ke tab ini
  const refreshStatus = async () => {
    if (!selectedSub?.id) return;
    setRefreshing(true);
    await loadDetail(selectedSub.id);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!selectedSub?.id) return;
    const id = selectedSub.id;
    const tick = () => {
      if (document.visibilityState === 'visible') loadDetail(id);
    };
    const timer = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [selectedSub?.id]);

  // Ucapan selamat saat pengajuan baru saja menjadi Aktif (sekali per pengajuan di browser ini)
  const activeSubId = detailData?.submission?.status === 'Aktif' ? detailData.submission.id : null;
  const welcomeKey = activeSubId ? `ikapi_welcome_aktif_${activeSubId}` : null;
  useEffect(() => {
    if (!welcomeKey) return;
    try {
      if (!localStorage.getItem(welcomeKey)) setShowWelcome(true);
    } catch { /* penyimpanan browser tidak tersedia: lewati */ }
  }, [welcomeKey]);

  const closeWelcome = () => {
    setShowWelcome(false);
    try { localStorage.setItem(welcomeKey, '1'); } catch { /* abaikan */ }
  };

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
        <div className="w-10 h-10 border-[3px] border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     EMPTY STATE — Pilihan Jenis & Kategori (Full Width & Blue Accent)
     ══════════════════════════════════════════════════════════ */
  if (submissions.length === 0) {
    return (
      <>
      {/* Tinggi minimal = layar dikurangi header & footer, agar widget pas di tengah layar */}
      <div className="relative w-full max-w-5xl mx-auto lg:min-h-[calc(100vh-14rem)] flex items-center">
        <div className="card-surface overflow-hidden w-full">

          {/* Header */}
          <div className="bg-slate-50/70 border-b border-slate-100 px-5 sm:px-7 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-light text-slate-900 tracking-tight">Pengajuan Keanggotaan</h2>
              <p className="text-sm text-slate-500 mt-0.5">Pilih jenis pengajuan dan kategori keanggotaan penerbit</p>
            </div>
            <div className="accent-yellow px-4 py-2 rounded-2xl text-right shadow-[0_10px_24px_-14px_rgba(234,179,8,0.8)]">
              <div className="text-xs font-medium text-slate-700">Biaya pendaftaran</div>
              <div className="text-xl font-medium text-slate-900">
                {formatRupiah(feesFromSettings(appSettings, pickType).total)}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* Left Column: Choices */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Jenis Pengajuan */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-slate-800 block mb-2">
                  1. Pilih Jenis Pengajuan
                </label>
                <div className="flex-1 grid grid-rows-2 gap-3">
                  {[
                    { id: 'Baru', label: 'Anggota Baru', sub: 'Pendaftaran anggota pertama kali', icon: UserPlus },
                    { id: 'Heregistrasi', label: 'Registrasi', sub: 'Perpanjangan masa berlaku KTA', icon: RefreshCw }
                  ].filter((item) => item.id === defaultType).map(item => {
                    const Icon = item.icon;
                    const active = pickType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPickType(item.id)}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                          active
                            ? 'border-[#3b82f6] bg-white shadow-[0_8px_20px_-12px_rgba(59,130,246,0.6)]'
                            : 'border-white bg-white/70 hover:border-blue-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition ${
                          active ? 'bg-[#3b82f6] text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-900">{item.label}</span>
                            {active && <CheckCircle className="w-4 h-4 text-[#3b82f6]" />}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{item.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                  {/* Jenis pengajuan dikunci sesuai jawaban profil (anggota lama/baru) */}
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-3.5 py-3 text-xs text-slate-500 flex items-center">
                    <span>
                      {defaultType === 'Heregistrasi'
                        ? 'Anda terdaftar sebagai anggota lama, jadi pengajuan Anda adalah registrasi perpanjangan KTA.'
                        : 'Anda terdaftar sebagai anggota baru, jadi pengajuan Anda adalah pendaftaran anggota baru.'}
                      {onEditProfile && (
                        <button type="button" onClick={onEditProfile} className="ml-1 text-[#3b82f6] hover:underline font-medium">
                          Salah pilih? Ubah jawaban
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kategori Keanggotaan */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-slate-800 block mb-2">
                  2. Pilih Kategori Keanggotaan
                </label>
                <div className="flex-1 grid grid-rows-2 gap-3">
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
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                          active
                            ? 'border-[#3b82f6] bg-white shadow-[0_8px_20px_-12px_rgba(59,130,246,0.6)]'
                            : 'border-white bg-white/70 hover:border-blue-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition ${
                          active ? 'bg-[#3b82f6] text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-900">{item.label}</span>
                            {active && <CheckCircle className="w-4 h-4 text-[#3b82f6]" />}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{item.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Docs & Action */}
            <div className="lg:col-span-5 panel-inner p-4">
              <div>
                <div className="text-sm font-medium text-slate-800 mb-2">
                  Berkas Persyaratan
                </div>
                <div className="space-y-1.5">
                  {(REQUIRED_DOCS[pickType]?.[pickCategory] || []).map((title) => (
                    <div key={title} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200/70 text-[13px] text-slate-700">
                      <CheckCircle className="w-4 h-4 text-[#12c26f] flex-shrink-0" />
                      <span>{title}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Baris aksi: tombol di bawah agar kolom berkas tidak lebih tinggi dari kolom pilihan */}
          <div className="border-t border-slate-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {(REQUIRED_DOCS[pickType]?.[pickCategory] || []).length} berkas perlu disiapkan. Formulir bisa disimpan sebagai draf.
            </p>
            <button
              onClick={() => onNewSubmission({ submissionType: pickType, category: pickCategory })}
              className="soft-pill-primary w-full sm:w-auto px-6 py-3 whitespace-nowrap"
            >
              <span>Isi Formulir Pengajuan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  /* ─── Data Pengajuan Aktif ─── */
  const sub      = detailData?.submission || selectedSub;
  const docs     = detailData?.documents  || [];
  const payment  = detailData?.payment;
  const settings = { ...appSettings, ...detailData?.settings };

  if (!sub) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="w-10 h-10 border-[3px] border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isDraf        = sub.status === 'Draf';
  const isWaitPayment = sub.status === 'Menunggu Pembayaran';
  const isNeedRevision = sub.status === 'Perlu Revisi';
  const rejectedDocs   = docs.filter((d) => d.screening_status === 'Perlu Revisi');
  const paymentRejected = payment?.verification_status === 'Perlu Revisi';

  // Tagihan tersimpan di server (ikut harga terbaru selama belum dibayar)
  const bill = payment?.fee_breakdown?.total != null
    ? { ...payment.fee_breakdown, total: payment.amount }
    : feesFromSettings(settings, sub.submission_type);
  const billItems = [
    ['Uang Pangkal', bill.uangPangkal],
    [`Iuran ${sub.submission_type === 'Baru' ? '' : 'Perpanjangan '}${bill.durasiBulan || 24} Bulan`, bill.iuran24Bulan],
    ['Biaya Administrasi', bill.administrasi],
  ].filter(([, amount]) => Number(amount) > 0);

  return (
    <div className="space-y-6 w-full">

      {/* ── Ringkasan pengajuan (satu akun = satu pengajuan) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 card-surface px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 flex-shrink-0 rounded-full bg-white border border-slate-200/70 shadow-sm flex items-center justify-center text-slate-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-lg text-slate-800 truncate">{sub.publisher_name}</p>
            <p className="text-xs text-slate-500">
              Pengajuan #{sub.id} · {sub.submission_type === 'Heregistrasi' ? 'Registrasi (perpanjangan)' : 'Anggota Baru'} · {sub.member_category || sub.category}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDraf && (
            <button
              onClick={() => onEditDraft(sub)}
              className="soft-pill-primary"
            >
              <Edit3 className="w-4 h-4" />
              <span>Lanjutkan Draf</span>
            </button>
          )}
          <button
            onClick={refreshStatus}
            disabled={refreshing}
            title="Status juga diperbarui otomatis setiap 30 detik"
            className="soft-pill disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="flex flex-col items-start leading-tight">
              <span>{refreshing ? 'Memperbarui...' : 'Perbarui status'}</span>
              {lastUpdated && !refreshing && (
                <span className="text-[10px] font-normal text-slate-400">
                  Diperbarui {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* ── Status Stepper ── */}
      <StatusStepper currentStatus={sub.status} rejectionReason={sub.rejection_reason} cardClassName="card-surface" />

      {/* ══ KTA AKTIF CARD ══ */}
      {sub.status === 'Aktif' && (
        <div className="accent-green rounded-[28px] p-6 sm:p-7 shadow-[0_14px_30px_-16px_rgba(18,194,111,0.8)] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="soft-chip !text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
              <span>Anggota Resmi Aktif</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-light">{sub.publisher_name}</h3>
            <p className="text-sm text-white/90">
              Selamat! Anda resmi terdaftar sebagai anggota IKAPI Jawa Barat
              {sub.activated_at && <> sejak <strong className="font-medium text-white">{formatLongDate(sub.activated_at)}</strong></>}.
            </p>
            <p className="text-sm text-white/85">
              Nomor KTA:{' '}
              {sub.member_kta || sub.kta_number
                ? <strong className="text-white text-lg font-medium tracking-wide">{sub.member_kta || sub.kta_number}</strong>
                : <span className="text-white/90">sedang dicatat oleh pengurus</span>}
            </p>
          </div>
          <button
            onClick={() => setShowPacket(true)}
            className="soft-pill self-start sm:self-center"
          >
            <FileText className="w-4 h-4" />
            <span>Unduh Dokumen Resmi</span>
          </button>
        </div>
      )}

      {/* ══ PENGAJUAN TIDAK DI-ACC: unggah ulang yang bertanda merah saja ══ */}
      {isNeedRevision && (
        <div className="rounded-[22px] p-5 bg-red-50 border border-red-200 flex items-start gap-3.5">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-900 space-y-1">
            <p className="font-semibold">
              {rejectedDocs.length > 0 && `${rejectedDocs.length} berkas`}
              {rejectedDocs.length > 0 && paymentRejected && ' dan '}
              {paymentRejected && 'bukti pembayaran'} tidak sesuai screening
            </p>
            <p>Cukup unggah ulang yang bertanda <strong>merah</strong>. Berkas berlabel hijau sudah diterima dan tidak perlu diubah.</p>
            {sub.admin_notes && <p className="text-red-800/80">Catatan verifikator: {sub.admin_notes}</p>}
          </div>
        </div>
      )}

      {/* ══ INVOICE PEMBAYARAN (setelah bukti transfer diunggah) ══ */}
      {payment?.proof_file && (
        <div className="card-surface px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center ${
              isInvoicePaid(payment) ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}>
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-base text-slate-800">Invoice pembayaran</p>
              <p className="text-xs text-slate-500 truncate">
                <span className="font-mono">{invoiceNumber(sub, settings)}</span> · Rp {Number(payment.amount || 0).toLocaleString('id-ID')}
              </p>
            </div>
            <span className={`ml-1 flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              isInvoicePaid(payment)
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : payment.verification_status === 'Perlu Revisi'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {isInvoicePaid(payment) ? 'Lunas' : payment.verification_status === 'Perlu Revisi' ? 'Ditolak' : 'Menunggu verifikasi'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInvoice(true)} className="soft-pill !text-xs">
              <Receipt className="w-4 h-4" /> Lihat invoice
            </button>
            <button
              onClick={() => downloadInvoicePdf({ submission: sub, payment, settings })}
              className="soft-pill-primary !text-xs"
            >
              <Download className="w-4 h-4" /> Unduh PDF
            </button>
          </div>
        </div>
      )}

      {/* ══ PEMBAYARAN & UPLOAD BUKTI BAYAR ══ */}
      {/* Form bayar: saat menunggu pembayaran, atau bukti transfer ditolak (unggah ulang) */}
      {(isWaitPayment || paymentRejected || (payment && !payment.proof_file && !isDraf)) && (
        <div className="card-surface overflow-hidden">
          <div className="bg-slate-50/70 border-b border-slate-100 px-5 sm:px-7 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-5 h-5 text-[#0884c4]" />
              <h3 className="text-lg text-slate-800">Pembayaran Keanggotaan</h3>
            </div>
            {paymentRejected ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
                Tidak sesuai · unggah ulang
              </span>
            ) : (
              <span className="soft-chip"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {payment?.proof_file ? 'Menunggu Verifikasi' : 'Belum Dibayar'}
              </span>
            )}
          </div>
          {paymentRejected && payment?.verification_notes && (
            <p className="mx-5 sm:mx-7 mt-4 text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              <strong>Alasan:</strong> {payment.verification_notes}
            </p>
          )}

          <div className="p-4 sm:p-7 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Info Tagihan & Rekening */}
            <div className="space-y-5">
              <div className="panel-inner p-4 sm:p-5 space-y-3 text-sm">
                {billItems.map(([label, amount]) => (
                  <div key={label} className="flex justify-between text-slate-600">
                    <span>{label}</span>
                    <span className="font-semibold text-slate-900">{formatRupiah(amount)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200/70 pt-3 flex justify-between font-medium text-base text-slate-900">
                  <span>Total Tagihan</span>
                  <span className="text-[#3b82f6] text-lg">{formatRupiah(bill.total)}</span>
                </div>
              </div>

              <div className="accent-violet rounded-[22px] p-5 flex items-center justify-between shadow-[0_14px_30px_-16px_rgba(123,92,255,0.8)]">
                <div>
                  <p className="text-xs text-white/80">Rekening tujuan · {settings.bank_name || 'Bank BNI'}</p>
                  <p className="text-2xl sm:text-3xl font-medium mt-1 tracking-wide">{settings.bank_account || '2089992087'}</p>
                  <p className="text-sm text-white/90 font-semibold mt-0.5">a.n. {settings.bank_holder || 'Abdul Rasyid'}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/20 border border-white/40 flex items-center justify-center">
                  <Landmark className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {/* Form Konfirmasi */}
            <form onSubmit={handlePaymentSubmit} className="panel-inner p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-slate-800 block mb-1.5">Bank Pengirim *</label>
                  <input
                    type="text"
                    required
                    value={payForm.senderBank}
                    onChange={(e) => setPayForm({ ...payForm, senderBank: e.target.value })}
                    placeholder="BCA / Mandiri / BNI / BRI"
                    className="soft-input"
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
                    className="soft-input"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-800 block mb-1.5">No. Rekening</label>
                  <input
                    type="text"
                    value={payForm.senderAccountNumber}
                    onChange={(e) => setPayForm({ ...payForm, senderAccountNumber: e.target.value })}
                    placeholder="Nomor rekening"
                    className="soft-input"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-800 block mb-1.5">Tanggal Transfer *</label>
                  <input
                    type="date"
                    required
                    value={payForm.transferDate}
                    onChange={(e) => setPayForm({ ...payForm, transferDate: e.target.value })}
                    className="soft-input"
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
                  className="w-full text-sm text-slate-600 bg-white border border-slate-200/80 rounded-2xl p-2
                             file:mr-3 file:py-1.5 file:px-3.5 file:rounded-full file:border-0
                             file:text-xs file:font-medium file:bg-[#3b82f6] file:text-white"
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
                className="soft-pill-primary w-full py-3"
              >
                <Upload className="w-4 h-4" />
                <span>{submittingPay ? 'Mengunggah...' : 'Unggah Bukti Pembayaran'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ DAFTAR BERKAS PERSYARATAN ══ */}
      <div className="card-surface overflow-hidden">
        <div className="bg-slate-50/70 border-b border-slate-100 px-5 sm:px-7 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#0884c4]" />
            <h3 className="text-lg text-slate-800">Dokumen Persyaratan</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
              {docs.filter(d => d.screening_status === 'Sesuai').length} diterima
            </span>
            {rejectedDocs.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
                {rejectedDocs.length} tidak sesuai
              </span>
            )}
          </div>
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
            const label     = SCREENING_LABEL[doc.screening_status] || SCREENING_LABEL.Menunggu;

            return (
              <div
                key={doc.id || idx}
                className={`px-5 sm:px-7 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                  isRevisi ? 'bg-red-50/50' : 'bg-white'
                }`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{doc.document_title}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${label.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${label.dot}`} />
                      {label.text}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {hasFile ? doc.file_name : 'Belum diunggah'}
                  </p>
                  {isRevisi && doc.revision_notes && (
                    <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1.5">
                      <strong>Alasan tidak sesuai:</strong> {doc.revision_notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {doc.file_path && (
                    <a
                      href={doc.file_path}
                      target="_blank"
                      rel="noreferrer"
                      className="soft-pill !px-3.5 !py-2 !text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Lihat</span>
                    </a>
                  )}
                  {canUpload ? (
                    <label className={`px-4 py-2 text-xs font-medium rounded-full cursor-pointer flex items-center gap-1.5 transition ${
                      isRevisi
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                        : doc.file_path
                        ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/70 shadow-sm'
                        : 'bg-[#3b82f6] hover:bg-[#2f6fe0] text-white shadow-sm'
                    }`}>
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingDocId === doc.id ? '...' : isRevisi ? 'Unggah ulang' : doc.file_path ? 'Ganti' : 'Unggah'}
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

      {/* ══ UCAPAN SELAMAT: BARU SAJA AKTIF ══ */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeWelcome}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white rounded-[28px] shadow-2xl overflow-hidden text-center"
          >
            <div className="accent-green px-6 pt-8 pb-10">
              <div className="mx-auto w-16 h-16 rounded-full bg-white/25 flex items-center justify-center">
                <PartyPopper className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="-mt-6 mx-4 mb-4 bg-white rounded-3xl px-5 pt-6 pb-5">
              <h3 id="welcome-title" className="text-xl font-medium text-slate-900">Selamat, Anda resmi menjadi anggota!</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Pengajuan <strong className="font-medium text-slate-800">{sub.publisher_name}</strong> telah disetujui dan
                ditandatangani Sekretaris serta Ketua. Anda kini terdaftar sebagai <strong className="font-medium text-emerald-700">anggota aktif IKAPI Jawa Barat</strong>
                {sub.activated_at && <> sejak {formatLongDate(sub.activated_at)}</>}.
              </p>
              <p className="text-xs text-slate-500 mt-3">
                Dokumen resmi (surat, formulir, berita acara & SK) sudah bisa diunduh. Nomor KTA akan tampil setelah dicatat pengurus.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-5">
                <button
                  onClick={() => { closeWelcome(); setShowPacket(true); }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition"
                >
                  <FileText className="w-4 h-4" /> Lihat dokumen
                </button>
                <button
                  onClick={closeWelcome}
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ INVOICE MODAL ══ */}
      {showInvoice && payment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button onClick={() => setShowInvoice(false)} className="soft-pill !py-2 !text-xs">
                <X className="w-4 h-4" /> Tutup
              </button>
            </div>
            <PaymentInvoice submission={sub} payment={payment} settings={settings} />
          </div>
        </div>
      )}

      {/* ══ PACKET MODAL ══ */}
      {showPacket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowPacket(false)}
                className="soft-pill !py-2 !text-xs"
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
