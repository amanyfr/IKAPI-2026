import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import StatusStepper, { POST_APPROVAL_STATUSES } from '../components/StatusStepper';
import CentralPacketExporter, { officeAddress, physicalChecklist } from '../components/CentralPacketExporter';
import ModalFrame from '../components/ModalFrame';
import SubmissionTimeline from '../components/SubmissionTimeline';
import PaymentInvoice, { downloadInvoicePdf, invoiceNumber, isInvoicePaid } from '../components/PaymentInvoice';
import { feesFromSettings, formatRupiah } from '../utils/fees';
import { formatLongDate } from '../components/PengurusSignature';
import { fileUrl } from '../utils/fileUrl';
import {
  Building2, CreditCard, Upload, FileText, AlertCircle,
  CheckCircle, ExternalLink, RefreshCw,
  Edit3, GraduationCap, ArrowRight, UserPlus, X,
  ShieldCheck, Landmark, Receipt, Download, XCircle, PartyPopper,
  Printer, Truck, Clock, PenLine, MapPin, Info, ArrowLeft, Send, Phone, Mail
} from 'lucide-react';
import { notify } from '../components/AppDialog';

// Label hasil screening berkas: hijau = diterima, merah = tidak sesuai (unggah ulang), abu = belum diperiksa
const SCREENING_LABEL = {
  Sesuai:         { text: 'Sesuai',          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
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
      'Kartu Anggota Ikapi yang sudah habis masa berlakunya',
      'Isian Formulir Heregistrasi',
    ],
    'Luar Biasa': [
      'Kartu Anggota Ikapi yang sudah habis masa berlakunya',
      'Isian Formulir Heregistrasi',
    ],
  },
};

const token = () => localStorage.getItem('ikapi_token');

const STAGE_TONE = {
  blue: 'bg-sky-50 border-sky-200 text-sky-900',
  green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
};

function StageInfo({ icon: Icon, tone = 'blue', title, children }) {
  return (
    <div className={`rounded-[22px] p-4 sm:p-5 border flex items-start gap-3 ${STAGE_TONE[tone]}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="text-sm space-y-0.5">
        <p className="font-semibold">{title}</p>
        <p className="opacity-90">{children}</p>
      </div>
    </div>
  );
}

// Keterangan berkas fisik yang wajib dicetak sendiri oleh pemohon
function PrintNotice({ compact = false }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 ${compact ? 'px-3.5 py-2.5 text-xs' : 'px-4 py-3 text-sm'}`}>
      <Printer className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <p>
        <strong className="font-semibold">Berkas fisik wajib dicetak sendiri.</strong>{' '}
        Setelah disetujui Sekretaris & Ketua, Anda mencetak surat pengantar, formulir, dan fotokopi berkas persyaratan,
        lalu mengirimnya ke sekretariat IKAPI Jawa Barat. Keanggotaan aktif setelah berkas fisik diterima.
      </p>
    </div>
  );
}

export default function AnggotaDashboard({ onNewSubmission, onEditDraft, onEditProfile, onStatusChange, defaultType = 'Baru', defaultCategory = 'Biasa' }) {
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
  const [showShipNotice, setShowShipNotice] = useState(false);
  const [shipForm,       setShipForm]       = useState({ courier: '', trackingNo: '', notes: '' });
  const [sendingShip,    setSendingShip]    = useState(false);
  const [lastUpdated,    setLastUpdated]    = useState(null);


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
      onStatusChange?.(data.submission?.status);
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadSubmissions(); }, [user]);

  // Biaya & rekening diatur Admin: dimuat ulang tiap 30 detik dan saat kembali ke tab,
  // jadi perubahan harga oleh Admin langsung terlihat di sini
  useEffect(() => {
    const loadSettings = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/settings', { headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` } })
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

  // Pemberitahuan sekali saat pengajuan disetujui Ketua: cetak & kirim berkas fisik
  const shipSubId = detailData?.submission?.status === 'Pengiriman Berkas' ? detailData.submission.id : null;
  const shipKey = shipSubId ? `ikapi_kirim_berkas_${shipSubId}` : null;
  useEffect(() => {
    if (!shipKey) return;
    try {
      if (!localStorage.getItem(shipKey)) setShowShipNotice(true);
    } catch { /* penyimpanan browser tidak tersedia: lewati */ }
  }, [shipKey]);

  const closeShipNotice = () => {
    setShowShipNotice(false);
    try { localStorage.setItem(shipKey, '1'); } catch { /* abaikan */ }
  };

  const handleShipSubmit = async (e) => {
    e.preventDefault();
    setSendingShip(true);
    try {
      const res = await fetch(`/api/submissions/${selectedSub.id}/physical-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(shipForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadDetail(selectedSub.id);
    } catch (err) { notify('Gagal menyimpan: ' + err.message); }
    finally { setSendingShip(false); }
  };

  const handleDocUpload = async (doc, file) => {
    if (!file) return;
    const currentSubId = selectedSub?.id || detailData?.submission?.id;
    if (!currentSubId) {
      notify('ID pengajuan tidak ditemukan.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('documentType', doc.document_type || doc.type);
    fd.append('documentTitle', doc.document_title || doc.title);
    setUploadingDocId(doc.id);
    try {
      const res  = await fetch(`/api/submissions/${currentSubId}/documents`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadDetail(currentSubId);
      await loadSubmissions();
      notify(data.message || 'Dokumen berhasil diunggah.');
    } catch (e) { notify('Gagal mengunggah berkas: ' + e.message); }
    finally    { setUploadingDocId(null); }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!payForm.proofFile) { notify('Pilih file bukti transfer terlebih dahulu.'); return; }
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
    } catch (e) { notify('Gagal mengunggah pembayaran: ' + e.message); }
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
  /* ══════════════════════════════════════════════════════════
     BELUM ADA PENGAJUAN — langsung tampil persyaratan sesuai jawaban profil
     (jenis & kategori dipilih di pertanyaan awal; bisa diubah lewat "Ubah jawaban")
     ══════════════════════════════════════════════════════════ */
  if (submissions.length === 0) {
    const pickType = defaultType;
    const pickCategory = defaultCategory;
    const reqDocs = REQUIRED_DOCS[pickType]?.[pickCategory] || [];
    const fees = feesFromSettings(appSettings, pickType);
    const isLB = pickCategory === 'Luar Biasa';
    const typeText = pickType === 'Heregistrasi' ? 'anggota lama' : 'anggota baru';
    const subText = pickType === 'Heregistrasi' ? 'registrasi perpanjangan KTA' : 'pendaftaran anggota baru';
    const backText = (
      <p className="text-xs sm:text-sm text-slate-500">
        Anda terdaftar sebagai <strong className="font-medium text-slate-700">{typeText}</strong> kategori{' '}
        <strong className="font-medium text-slate-700">{isLB ? 'Anggota Luar Biasa' : 'Anggota Biasa'}</strong>, jadi pengajuan Anda adalah {subText}.{' '}
        {onEditProfile && (
          <button type="button" onClick={onEditProfile} className="text-[#3b82f6] hover:underline font-medium">
            Salah pilih? Ubah jawaban
          </button>
        )}
      </p>
    );
    return (
      <div className="relative w-full max-w-5xl mx-auto lg:min-h-[calc(100vh-14rem)] flex items-center">
        <div className="card-surface overflow-hidden w-full">
          <div className="bg-slate-50/70 border-b border-slate-100 px-5 sm:px-7 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-light text-slate-900 tracking-tight">
                Persyaratan {isLB ? 'Anggota Luar Biasa' : 'Anggota Biasa'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {pickType === 'Heregistrasi' ? 'Registrasi (perpanjangan)' : 'Pendaftaran anggota baru'} ·{' '}
                {isLB ? 'Penerbit perguruan tinggi / lembaga (university press)' : 'Badan usaha penerbit (PT / CV / yayasan)'}
              </p>
            </div>
            <div className="accent-yellow px-4 py-2 rounded-2xl text-right shadow-[0_10px_24px_-14px_rgba(234,179,8,0.8)]">
              <div className="text-xs font-medium text-slate-700">Biaya pendaftaran</div>
              <div className="text-xl font-medium text-slate-900">{formatRupiah(fees.total)}</div>
            </div>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="panel-inner p-4">
              <p className="text-sm font-medium text-slate-800 mb-2">Dokumen yang diunggah ({reqDocs.length})</p>
              <ol className="space-y-1.5">
                {reqDocs.map((title, i) => (
                  <li key={title} className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-lg border border-slate-200/70 text-[13px] text-slate-700">
                    <span className="w-6 h-6 flex-shrink-0 rounded-full bg-blue-50 text-[#3b82f6] text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                    <span>{title}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-slate-500 mt-3">Format PDF / JPG / PNG. Dokumen diperiksa Admin satu per satu sebelum pembayaran.</p>
            </div>
            <div className="space-y-3">
              <div className="panel-inner p-4 text-sm">
                <p className="font-medium text-slate-800 mb-2">Rincian biaya</p>
                {[
                  ['Uang Pangkal', fees.uangPangkal],
                  [`Iuran ${fees.durasiBulan || 24} Bulan`, fees.iuran24Bulan],
                  ['Biaya Administrasi', fees.administrasi],
                ].filter(([, v]) => Number(v) > 0).map(([label, v]) => (
                  <div key={label} className="flex justify-between text-slate-600 py-0.5">
                    <span>{label}</span><span className="text-slate-900">{formatRupiah(v)}</span>
                  </div>
                ))}
              </div>
              <PrintNotice compact />
            </div>
          </div>

          <div className="border-t border-slate-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="sm:max-w-xl">{backText}</div>
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
  const isScreening   = sub.status === 'Menunggu Verifikasi';
  const isWaitPayment = sub.status === 'Menunggu Pembayaran';
  const rejectedDocs   = docs.filter((d) => d.screening_status === 'Perlu Revisi');
  const hasRejectedDocs = rejectedDocs.length > 0;
  const isNeedRevision = sub.status === 'Perlu Revisi' || hasRejectedDocs;
  const isShipping    = sub.status === 'Pengiriman Berkas';
  const actionDocs = docs.filter((d) => d.screening_status === 'Perlu Revisi'
    || ((isDraf || isScreening || isNeedRevision) && !d.file_path));
  const paymentRejected = isWaitPayment && payment?.verification_status === 'Perlu Revisi';
  const paymentPending  = isWaitPayment && payment?.proof_file && payment?.verification_status === 'Menunggu';
  const showPayForm     = isWaitPayment && (!payment?.proof_file || paymentRejected);
  const officialDocsReady = POST_APPROVAL_STATUSES.includes(sub.status);

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
      <StatusStepper
        currentStatus={sub.status}
        rejectionReason={sub.rejection_reason}
        rejectedAtStatus={sub.rejected_at_status}
        paymentRejected={paymentRejected}
        hasDocRejection={hasRejectedDocs}
        cardClassName="card-surface"
      />

      {/* ══ PEMBERITAHUAN REVISI DOKUMEN ══ */}
      {isNeedRevision && (
        <div className="rounded-[24px] p-5 sm:p-6 bg-gradient-to-r from-red-50 to-amber-50 border-2 border-red-300/80 shadow-sm space-y-3.5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0 text-red-600 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-bold text-red-900">Pemberitahuan: Dokumen Perlu Direvisi</h4>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                  {rejectedDocs.length} Dokumen Belum Sesuai
                </span>
              </div>
              <p className="text-sm text-red-800 leading-relaxed">
                Hasil pemeriksaan admin menemukan ada dokumen yang belum sesuai persyaratan. Silakan periksa catatan revisi di bawah dan unggah ulang dokumen yang bertanda merah.
              </p>
              {sub.admin_notes && (
                <div className="p-3 mt-2 rounded-xl bg-white/90 border border-red-200 text-xs text-red-950 flex items-start gap-2">
                  <Info className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-red-900">Catatan Admin:</span>
                    <p className="mt-0.5 font-medium">{sub.admin_notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white/85 rounded-xl p-3.5 border border-red-200/70 text-xs text-slate-700 space-y-1.5">
            <p className="font-semibold text-slate-900">Dokumen yang harus diunggah ulang:</p>
            <ul className="list-disc pl-5 space-y-1">
              {rejectedDocs.map((d) => (
                <li key={d.id}>
                  <strong className="text-slate-800">{d.document_title}</strong>
                  {d.revision_notes ? (
                    <span className="text-red-700 font-medium"> — Alasan: "{d.revision_notes}"</span>
                  ) : (
                    <span className="text-amber-700 font-medium"> — Belum sesuai ketentuan</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 pt-1">
              💡 Dokumen yang bertanda hijau ("Sesuai") tidak perlu diunggah ulang. Setelah dokumen perbaikan diunggah, berkas akan otomatis masuk ke antrean screening ulang Admin.
            </p>
          </div>
        </div>
      )}

      {/* ══ INFO TAHAP SAAT INI (Normal) ══ */}
      {isDraf && <PrintNotice />}
      {isScreening && !isNeedRevision && (
        <StageInfo icon={Clock} tone="blue" title="Tahap 1 · Dokumen sedang diperiksa Admin">
          Admin memeriksa setiap dokumen satu per satu. Pembayaran (Tahap 2) dibuka setelah semua dokumen dinyatakan sesuai.
          {docs.some((d) => !d.file_path) && ' Masih ada dokumen yang belum diunggah, lengkapi di bawah.'}
        </StageInfo>
      )}
      {isWaitPayment && paymentPending && (
        <StageInfo icon={Clock} tone="blue" title="Tahap 2 · Bukti transfer sedang diverifikasi Admin">
          Semua dokumen sudah sesuai. Setelah pembayaran dinyatakan valid, pengajuan diteruskan ke Sekretaris untuk ditandatangani.
        </StageInfo>
      )}
      {isWaitPayment && !payment?.proof_file && (
        <StageInfo icon={CheckCircle} tone="green" title="Tahap 1 selesai · Semua dokumen sesuai">
          Silakan lakukan pembayaran dan unggah bukti transfer di bawah (Tahap 2).
        </StageInfo>
      )}
      {sub.status === 'Menunggu TTD Sekretaris' && (
        <StageInfo icon={PenLine} tone="blue" title="Dokumen & pembayaran disetujui · Menunggu tanda tangan Sekretaris">
          Setelah Sekretaris menandatangani, pengajuan diteruskan ke Ketua.
        </StageInfo>
      )}
      {sub.status === 'Menunggu Approval' && (
        <StageInfo icon={PenLine} tone="blue" title="Ditandatangani Sekretaris · Menunggu persetujuan Ketua">
          Setelah Ketua menyetujui, Anda akan diminta mencetak dan mengirim berkas fisik ke sekretariat IKAPI Jawa Barat.
        </StageInfo>
      )}

      {/* ══ KIRIM BERKAS FISIK ══ */}
      {isShipping && (
        <div className="card-surface overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-5 sm:px-7 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Truck className="w-5 h-5 text-amber-700" />
              <h3 className="text-lg text-slate-800">Kirim Berkas Fisik ke IKAPI Jawa Barat</h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              sub.physical_status === 'Dikirim' ? 'bg-sky-50 text-[#0884c4] border-sky-200' : 'bg-amber-100 text-amber-800 border-amber-200'
            }`}>
              {sub.physical_status === 'Dikirim' ? 'Sudah dikirim · menunggu konfirmasi Admin' : 'Belum dikirim'}
            </span>
          </div>
          <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Pengajuan Anda sudah disetujui Sekretaris & Ketua. <strong className="font-medium">Cetak sendiri</strong> berkas berikut lalu kirim ke sekretariat:
              </p>
              <ol className="space-y-1.5 text-sm text-slate-700 list-decimal pl-5">
                {physicalChecklist(sub, docs).map((item) => <li key={item}>{item}</li>)}
              </ol>
              <div className="panel-inner p-3.5 flex items-start gap-2.5 text-sm">
                <MapPin className="w-4 h-4 text-[#0884c4] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-800">Sekretariat IKAPI Jawa Barat</p>
                  <p className="text-slate-600">{officeAddress(settings)}</p>
                  {settings.office_phone && <p className="text-slate-500 text-xs mt-0.5">Telp. {settings.office_phone}</p>}
                </div>
              </div>
              <button onClick={() => setShowPacket(true)} className="soft-pill-primary">
                <Printer className="w-4 h-4" /> Cetak / unduh surat pengantar & formulir
              </button>
            </div>

            {sub.physical_status === 'Dikirim' ? (
              <div className="panel-inner p-5 space-y-2 text-sm">
                <p className="font-medium text-slate-800 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /> Berkas fisik sudah Anda kirim</p>
                <p className="text-slate-600">Dikirim lewat <strong className="font-medium">{sub.physical_courier}</strong>{sub.physical_tracking_no && <> · No. resi <span className="font-mono">{sub.physical_tracking_no}</span></>}{sub.physical_sent_at && <> · {formatLongDate(sub.physical_sent_at)}</>}.</p>
                <p className="text-slate-500 text-xs">Admin akan mengonfirmasi setelah berkas sampai di sekretariat, lalu mengirimkannya ke IKAPI Pusat. Anda resmi aktif setelah Nomor KTA terbit dari Pusat.</p>
              </div>
            ) : (
              <form onSubmit={handleShipSubmit} className="panel-inner p-5 space-y-3">
                <p className="text-sm font-medium text-slate-800">Sudah mengirim berkas? Konfirmasi di sini</p>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Dikirim lewat *</label>
                  <input required value={shipForm.courier} onChange={(e) => setShipForm({ ...shipForm, courier: e.target.value })}
                    placeholder="JNE / J&T / POS / Diantar langsung" className="soft-input" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">No. resi (jika ada)</label>
                  <input value={shipForm.trackingNo} onChange={(e) => setShipForm({ ...shipForm, trackingNo: e.target.value })}
                    placeholder="Nomor resi pengiriman" className="soft-input" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Catatan</label>
                  <input value={shipForm.notes} onChange={(e) => setShipForm({ ...shipForm, notes: e.target.value })}
                    placeholder="Opsional" className="soft-input" />
                </div>
                <button type="submit" disabled={sendingShip} className="soft-pill-primary w-full py-3">
                  <Truck className="w-4 h-4" /> {sendingShip ? 'Menyimpan...' : 'Saya sudah mengirim berkas fisik'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══ PROSES DI IKAPI PUSAT ══ */}
      {(sub.status === 'Berkas Diterima' || sub.status === 'Dikirim ke Pusat') && (
        <div className="card-surface px-5 sm:px-7 py-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Truck className="w-5 h-5 text-violet-600" />
              <h3 className="text-lg text-slate-800">
                {sub.status === 'Berkas Diterima' ? 'Berkas fisik diterima sekretariat' : 'Berkas dikirim ke IKAPI Pusat'}
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200">
              {sub.status === 'Berkas Diterima' ? 'Disiapkan untuk dikirim ke Pusat' : 'Menunggu Nomor KTA dari Pusat'}
            </span>
          </div>
          {(() => {
            const atPusat = sub.status === 'Dikirim ke Pusat';
            const days = atPusat && sub.sent_to_central_at
              ? Math.max(0, Math.floor((Date.now() - new Date(sub.sent_to_central_at).getTime()) / 86400000))
              : null;
            const late = days !== null && days > 30;
            // Empat langkah setelah berkas diterima: siapa yang memegang berkas di tiap langkah
            const steps = [
              { label: 'Berkas diterima sekretariat', who: 'IKAPI Jawa Barat', at: sub.physical_received_at, done: true },
              { label: 'Dikirim ke IKAPI Pusat', who: 'Admin IKAPI Jawa Barat', at: sub.sent_to_central_at, done: atPusat, current: !atPusat },
              { label: 'Diproses IKAPI Pusat', who: 'Verifikasi & penerbitan No. KTA', current: atPusat },
              { label: 'No. KTA dicatat, Anggota Aktif', who: 'Sekretaris IKAPI Jawa Barat' },
            ];
            return (
              <>
                {/* Posisi berkas sekarang */}
                <div className={`rounded-2xl border p-4 flex items-start gap-3 ${late ? 'bg-amber-50 border-amber-200' : 'bg-violet-50 border-violet-200'}`}>
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${late ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                    {atPusat ? <Send className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="text-slate-800 font-medium">
                      {atPusat ? 'Berkas Anda sedang diproses di IKAPI Pusat' : 'Sekretariat sedang menyiapkan pengiriman berkas ke IKAPI Pusat'}
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      {atPusat
                        ? <>Dikirim {formatLongDate(sub.sent_to_central_at)}{days !== null && <> · <strong className="font-medium">{days === 0 ? 'menunggu sejak hari ini' : `sudah ${days} hari menunggu`}</strong></>}
                            {(sub.central_courier || sub.central_tracking_no) && <> · {sub.central_courier || '-'}{sub.central_tracking_no && <> resi <span className="font-mono">{sub.central_tracking_no}</span></>}</>}</>
                        : <>Berkas diterima {formatLongDate(sub.physical_received_at)}. Admin akan mengirim paket berkas ke IKAPI Pusat.</>}
                    </p>
                  </div>
                </div>

                <ol className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
                  {steps.map((s, i) => (
                    <li key={s.label} className={`p-3 rounded-2xl border flex items-start gap-2 ${
                      s.current ? 'bg-white border-violet-300 ring-2 ring-violet-100' : s.done ? 'panel-inner' : 'panel-inner opacity-60'
                    }`}>
                      {s.done
                        ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        : s.current
                          ? <span className="relative mt-1 flex w-3 h-3 flex-shrink-0"><span className="absolute inline-flex w-full h-full rounded-full bg-violet-400 opacity-60 animate-ping" /><span className="relative inline-flex w-3 h-3 rounded-full bg-violet-600" /></span>
                          : <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />}
                      <span className="min-w-0">
                        <span className={`block ${s.current ? 'text-violet-800 font-medium' : 'text-slate-800'}`}>{i + 1}. {s.label}</span>
                        <span className="block text-xs text-slate-500">{s.done && s.at ? formatLongDate(s.at) : s.current ? 'Sedang berjalan' : 'Belum'}</span>
                        <span className="block text-[11px] text-slate-400">{s.who}</span>
                      </span>
                    </li>
                  ))}
                </ol>

                {/* Yang perlu dilakukan pemohon */}
                <div className="panel-inner p-4 text-sm space-y-1.5">
                  <p className="flex items-center gap-2 text-slate-800 font-medium">
                    <Info className="w-4 h-4 text-sky-600" /> Yang perlu Anda lakukan
                  </p>
                  <p className="text-slate-600">
                    Tidak ada tindakan dari Anda. Penerbitan Nomor KTA dilakukan oleh IKAPI Pusat. Setelah terbit, Sekretaris IKAPI Jawa Barat
                    mencatat Nomor KTA. Status Anda otomatis menjadi <strong className="font-medium">Anggota Aktif</strong> dan Anda menerima email.
                  </p>
                  {(settings.office_phone || settings.office_email) && (
                    <p className={late ? 'text-amber-800' : 'text-slate-500'}>
                      {late ? 'Sudah lebih dari 30 hari? ' : 'Ada pertanyaan? '}Hubungi sekretariat:{' '}
                      {settings.office_phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{settings.office_phone}</span>}
                      {settings.office_phone && settings.office_email && ' · '}
                      {settings.office_email && (
                        <a href={`mailto:${settings.office_email}?subject=${encodeURIComponent(`Status No. KTA - ${sub.publisher_name || ''} (Pengajuan #${sub.id})`)}`}
                          className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                          <Mail className="w-3.5 h-3.5" />{settings.office_email}
                        </a>
                      )}
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ══ KTA AKTIF CARD ══ */}
      {sub.status === 'Aktif' && (
        <div className="accent-green rounded-[28px] p-6 sm:p-7 shadow-[0_14px_30px_-16px_rgba(18,194,111,0.8)] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="soft-chip !text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
              <span>Anggota Penerbit IKAPI</span>
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
      {showPayForm && (
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
                Tahap 2 · Belum dibayar
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
                <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  <span>Sebelumnya: {payment.proof_filename || 'Bukti Transfer'} (tidak sesuai)</span>
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

      {/* ══ DOKUMEN YANG PERLU DIREVISI (Hanya muncul jika ada revisi / belum lengkap) ══ */}
      {actionDocs.length > 0 && (
        <div className="card-surface overflow-hidden">
          <div className="px-5 sm:px-7 py-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${rejectedDocs.length > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                <AlertCircle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg text-slate-800">
                  {rejectedDocs.length > 0 ? 'Dokumen yang Perlu Direvisi' : 'Dokumen yang Belum Diunggah'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {rejectedDocs.length > 0
                    ? 'Unggah ulang hanya dokumen di bawah ini sesuai catatan Admin. Dokumen lain dan pembayaran tidak perlu diulang.'
                    : 'Lengkapi dokumen di bawah ini sebelum pengajuan diperiksa Admin.'}
                </p>
              </div>
            </div>
            {rejectedDocs.length > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100 whitespace-nowrap">
                {rejectedDocs.length} dokumen perlu diganti
              </span>
            )}
          </div>

          <ol className="divide-y divide-slate-100">
            {actionDocs.map((doc, idx) => {
              const isRevisi  = doc.screening_status === 'Perlu Revisi';
              const hasFile   = Boolean(doc.file_path && doc.file_name && doc.file_name !== 'Belum diunggah');
              const canUpload = isDraf || isRevisi || ((isScreening || isNeedRevision) && !hasFile);
              const label = !hasFile && !isRevisi
                ? { text: 'Belum diunggah', cls: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-300' }
                : isRevisi
                ? { text: 'Perlu revisi', cls: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500' }
                : SCREENING_LABEL[doc.screening_status] || SCREENING_LABEL.Menunggu;

              return (
                <li
                  key={doc.id || idx}
                  className="px-5 sm:px-7 py-5 grid grid-cols-[auto,1fr] lg:grid-cols-[auto,1fr,auto] gap-x-4 gap-y-3 items-start"
                >
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>

                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="text-sm font-semibold text-slate-900">{doc.document_title}</span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${label.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${label.dot}`} />
                        {label.text}
                      </span>
                    </div>

                    {isRevisi && (
                      <div className="border-l-2 border-red-300 bg-red-50/60 rounded-r-lg px-3 py-2 max-w-xl">
                        <p className="text-[11px] font-medium text-red-600 uppercase tracking-wide">Catatan Admin</p>
                        <p className="text-sm text-slate-800 leading-relaxed mt-0.5">
                          {doc.revision_notes || 'Format atau berkas belum sesuai ketentuan. Silakan unggah dokumen pengganti.'}
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-slate-400 flex items-center gap-1.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{hasFile ? `Berkas sebelumnya: ${doc.file_name}` : 'Belum ada berkas diunggah'}</span>
                    </p>
                  </div>

                  <div className="col-start-2 lg:col-start-3 flex flex-wrap items-center gap-2 lg:justify-end lg:self-center">
                    {doc.file_path && (
                      <a
                        href={fileUrl(doc.file_path)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 text-xs font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800 flex items-center gap-1.5 transition"
                        title="Buka dokumen sebelumnya di tab baru"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Lihat berkas</span>
                      </a>
                    )}

                    {canUpload && (
                      <label className="px-4 py-2 text-xs font-semibold rounded-full cursor-pointer flex items-center gap-1.5 transition bg-[#0da2e7] hover:bg-[#0884c4] text-white shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {uploadingDocId === doc.id ? 'Mengunggah...' : isRevisi ? 'Unggah ulang' : 'Unggah'}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          disabled={uploadingDocId === doc.id}
                          onChange={(e) => handleDocUpload(doc, e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* ══ RIWAYAT ALUR BERKAS ══ */}
      <SubmissionTimeline timeline={detailData?.timeline || []} cardClassName="card-surface" />

      {/* ══ POP UP: KIRIM BERKAS FISIK ══ */}
      {showShipNotice && (
        createPortal(
        <div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4" onClick={closeShipNotice}>
          <div role="dialog" aria-modal="true" aria-labelledby="ship-title" onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white rounded-[28px] shadow-2xl overflow-hidden">
            <div className="bg-amber-400 px-6 pt-7 pb-9 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-white/40 flex items-center justify-center">
                <Truck className="w-7 h-7 text-amber-900" />
              </div>
            </div>
            <div className="-mt-6 mx-4 mb-4 bg-white rounded-3xl px-5 pt-6 pb-5">
              <h3 id="ship-title" className="text-xl font-medium text-slate-900 text-center">Pengajuan disetujui! Kirim berkas fisik</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed text-center">
                Sekretaris & Ketua sudah menandatangani. <strong className="font-medium text-slate-800">Cetak sendiri</strong> surat pengantar,
                formulir, dan fotokopi berkas persyaratan, lalu kirim ke sekretariat IKAPI Jawa Barat:
              </p>
              <p className="text-xs text-slate-700 bg-slate-50 rounded-xl px-3 py-2 mt-3 flex gap-2">
                <MapPin className="w-4 h-4 text-[#0884c4] flex-shrink-0" /> {officeAddress(settings)}
              </p>
              <p className="text-xs text-slate-500 mt-3 flex gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                Setelah berkas diterima, Admin mengirimkannya ke IKAPI Pusat. Anda resmi menjadi anggota setelah Nomor KTA terbit.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-5">
                <button onClick={() => { closeShipNotice(); setShowPacket(true); }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#3b82f6] hover:bg-[#2f6fe0] text-white text-sm font-medium transition">
                  <Printer className="w-4 h-4" /> Cetak dokumen
                </button>
                <button onClick={closeShipNotice}
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition">
                  Nanti
                </button>
              </div>
            </div>
          </div>
        </div>
        , document.body)
      )}

      {/* ══ UCAPAN SELAMAT: BARU SAJA AKTIF ══ */}
      {showWelcome && (
        createPortal(
        <div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4" onClick={closeWelcome}>
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
              <h3 id="welcome-title" className="text-xl font-medium text-slate-900">Selamat, tahap pendaftaran sudah selesai!</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Nomor KTA <strong className="font-medium text-slate-800">{sub.publisher_name}</strong> sudah terbit dari IKAPI Pusat.
                Anda kini <strong className="font-medium text-emerald-700">resmi menjadi anggota IKAPI Jawa Barat</strong>
                {sub.activated_at && <> sejak {formatLongDate(sub.activated_at)}</>}.
              </p>
              <p className="text-xs text-slate-500 mt-3">
                {(sub.member_kta || sub.kta_number) ? <>Nomor KTA: <strong className="font-mono text-slate-700">{sub.member_kta || sub.kta_number}</strong>. </> : null}
                Dokumen resmi (surat, formulir, berita acara & SK) bisa diunduh kapan saja.
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
        , document.body)
      )}

      {/* ══ INVOICE MODAL ══ */}
      {showInvoice && payment && (
        <ModalFrame maxWidth="max-w-3xl" onClose={() => setShowInvoice(false)}>
          <PaymentInvoice submission={sub} payment={payment} settings={settings} />
        </ModalFrame>
      )}

      {/* ══ PACKET MODAL ══ */}
      {showPacket && (
        <ModalFrame onClose={() => setShowPacket(false)}>
          <CentralPacketExporter submission={sub} documents={docs} settings={settings} />
        </ModalFrame>
      )}
    </div>
  );
}
