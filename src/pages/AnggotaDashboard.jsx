import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import StatusStepper, { POST_APPROVAL_STATUSES } from '../components/StatusStepper';
import CentralPacketExporter, { physicalChecklist } from '../components/CentralPacketExporter';
import { centralAddressLines } from '../utils/centralAddress';
import ModalFrame from '../components/ModalFrame';
import ActiveMemberDashboard from '../components/ActiveMemberDashboard';
import ProfileEditModal from '../components/ProfileEditModal';
import HeregVerificationCard from '../components/HeregVerificationCard';
import HeregMigrationForm from '../components/HeregMigrationForm';
import SubmissionTimeline from '../components/SubmissionTimeline';
import PaymentInvoice, { downloadInvoicePdf, invoiceNumber, isInvoicePaid } from '../components/PaymentInvoice';
import { feesFromSettings, formatRupiah } from '../utils/fees';
import { formatLongDate } from '../components/PengurusSignature';
import { fileUrl } from '../utils/fileUrl';
import { canMarkFile, parseMarks, adminGeneralNote } from '../components/DocumentMarker';
import RevisionMarksViewer from '../components/RevisionMarksViewer';
import { FILTERS, NUMERIC } from '../utils/inputFilters';
import {
  Building2, CreditCard, Upload, FileText, AlertCircle,
  CheckCircle, ExternalLink, RefreshCw,
  Edit3, GraduationCap, ArrowRight, UserPlus, X,
  ShieldCheck, Landmark, Receipt, Download, XCircle, PartyPopper,
  Printer, Truck, Clock, PenLine, MapPin, Info, ArrowLeft, Send, Phone, Mail, Eye, Trash2, HelpCircle
} from 'lucide-react';
import { notify } from '../components/AppDialog';
import UploadReviewDialog, { formatFileSize } from '../components/UploadReviewDialog';

// Label hasil screening berkas: hijau = diterima, merah = tidak sesuai (unggah ulang), abu = belum diperiksa
const SCREENING_LABEL = {
  Sesuai:         { text: 'Sesuai',          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'Perlu Revisi': { text: 'Tidak sesuai',    cls: 'bg-amber-50 text-amber-800 border-amber-200',       dot: 'bg-amber-500' },
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
    <div className={`flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/70 text-amber-900 leading-relaxed ${compact ? 'px-3.5 py-2.5 text-xs' : 'px-4 py-3 text-sm'}`}>
      <Printer className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <p>
        <strong className="font-semibold">Berkas fisik wajib dicetak sendiri.</strong>{' '}
        Setelah disetujui Sekretaris & Ketua, Anda mencetak surat pengantar, formulir, dan fotokopi berkas persyaratan,
        lalu mengirimnya langsung ke IKAPI Pusat. Setelah Pusat menyetujui, Anda mengisi Nomor KTA di sistem dan keanggotaan langsung aktif.
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
  const [stagedFiles,    setStagedFiles]    = useState({}); // { docId: File } dipilih tapi belum dikirim
  const [reviewOpen,     setReviewOpen]     = useState(false);
  const [sendingDocs,    setSendingDocs]    = useState(false);
  // File pilihan milik pengajuan lain tidak boleh terbawa saat berpindah pengajuan
  useEffect(() => { setStagedFiles({}); setReviewOpen(false); }, [selectedSub?.id]);
  // Ingatkan bila halaman ditutup padahal ada file yang belum dikirim
  useEffect(() => {
    if (Object.keys(stagedFiles).length === 0) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [stagedFiles]);
  const [showPacket,     setShowPacket]     = useState(false);
  const [showInvoice,    setShowInvoice]    = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [appSettings,    setAppSettings]    = useState({});
  const [showWelcome,    setShowWelcome]    = useState(false);
  const [showShipNotice, setShowShipNotice] = useState(false);
  const [shipConfirmed,  setShipConfirmed]  = useState(false);
  const [sendingShip,    setSendingShip]    = useState(false);
  const [ktaForm,        setKtaForm]        = useState({ ktaNumber: '', issuedAt: '', notes: '', file: null });
  const [sendingKta,     setSendingKta]     = useState(false);
  const [lastUpdated,    setLastUpdated]    = useState(null);
  const [markDoc,        setMarkDoc]        = useState(null); // dokumen yang dilihat beserta sorotan revisi Admin


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

  // Pemohon klik "Lanjutkan" setelah mengirim sendiri berkas fisik ke IKAPI Pusat -> tahap Input KTA
  const handleShipSubmit = async (e) => {
    e.preventDefault();
    setSendingShip(true);
    try {
      const res = await fetch(`/api/submissions/${selectedSub.id}/physical-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadDetail(selectedSub.id);
    } catch (err) { notify('Gagal menyimpan: ' + err.message); }
    finally { setSendingShip(false); }
  };

  // Pemohon mengisi No. KTA dari IKAPI Pusat -> diverifikasi Admin sebelum keanggotaan aktif
  const handleKtaSubmit = async (e) => {
    e.preventDefault();
    if (ktaForm.file && ktaForm.file.size > 10 * 1024 * 1024) {
      notify('Ukuran file maksimal 10 MB. Kompres atau pilih file lain.', { tone: 'warning', title: 'File terlalu besar' });
      return;
    }
    setSendingKta(true);
    try {
      const fd = new FormData();
      fd.append('ktaNumber', ktaForm.ktaNumber);
      fd.append('issuedAt', ktaForm.issuedAt);
      fd.append('notes', ktaForm.notes);
      if (ktaForm.file) fd.append('ktaFile', ktaForm.file);
      const res = await fetch(`/api/submissions/${selectedSub.id}/kta-confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(data.message, { tone: 'success', title: 'Data KTA terkirim' });
      setKtaForm({ ktaNumber: '', issuedAt: '', notes: '', file: null });
      await loadDetail(selectedSub.id);
    } catch (err) { notify('Gagal menyimpan: ' + err.message); }
    finally { setSendingKta(false); }
  };

  // File yang dipilih hanya ditahan di browser (bisa dilihat/diganti/dihapus) sampai pemohon menekan Kirim
  const stageDocFile = (doc, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notify('Ukuran file maksimal 10 MB. Kompres atau pilih file lain.', { tone: 'warning', title: 'File terlalu besar' });
      return;
    }
    setStagedFiles((prev) => ({ ...prev, [doc.id]: file }));
  };
  const unstageDocFile = (doc) => setStagedFiles((prev) => {
    const next = { ...prev };
    delete next[doc.id];
    return next;
  });
  const previewStaged = (file) => {
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const sendStagedDocs = async () => {
    const currentSubId = selectedSub?.id || detailData?.submission?.id;
    if (!currentSubId) {
      notify('ID pengajuan tidak ditemukan.');
      return;
    }
    const docsById = Object.fromEntries((detailData?.documents || []).map((d) => [String(d.id), d]));
    const entries = Object.entries(stagedFiles).filter(([id]) => docsById[id]);
    setSendingDocs(true);
    let lastData = null;
    const sent = [];
    try {
      for (const [id, file] of entries) {
        const doc = docsById[id];
        setUploadingDocId(doc.id);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('documentType', doc.document_type || doc.type);
        fd.append('documentTitle', doc.document_title || doc.title);
        const res  = await fetch(`/api/submissions/${currentSubId}/documents`, {
          method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`"${doc.document_title}": ${data.error || 'periksa file lalu coba lagi.'}`);
        lastData = data;
        sent.push(id);
      }
      setStagedFiles({});
      setReviewOpen(false);
      notify(
        lastData?.resubmitted
          ? 'Dokumen perbaikan sudah diterima dan pengajuan kembali masuk antrean screening Admin. Pantau statusnya di halaman ini.'
          : detailData?.submission?.status === 'Draf'
          ? `${sent.length} dokumen tersimpan di draf. Kirim pengajuan lewat Lanjutkan Draf bila semua sudah lengkap.`
          : `${sent.length} dokumen berhasil dikirim ke Admin.`,
        { tone: 'success', title: lastData?.resubmitted ? 'Revisi terkirim!' : detailData?.submission?.status === 'Draf' ? 'Dokumen tersimpan' : 'Dokumen terkirim', okLabel: 'Mengerti' }
      );
    } catch (e) {
      // Yang sudah terkirim dilepas dari daftar; sisanya tetap bisa dikirim ulang
      setStagedFiles((prev) => { const next = { ...prev }; sent.forEach((id) => delete next[id]); return next; });
      setReviewOpen(false);
      notify('Sebagian dokumen belum terkirim. ' + e.message, { tone: 'error', title: 'Gagal mengirim dokumen' });
    } finally {
      setUploadingDocId(null);
      setSendingDocs(false);
      await loadDetail(currentSubId);
      await loadSubmissions();
    }
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
    // Anggota lama: formulir & dokumen terkunci sampai Admin menyetujui data KTA lama
    if (defaultType === 'Heregistrasi' && user?.hereg_status !== 'Disetujui') {
      return <HeregVerificationCard onEditProfile={onEditProfile} />;
    }
    // Jalur "masih aktif" (dipilih Admin): tanpa formulir & bayar, cukup lengkapi data keanggotaan
    if (defaultType === 'Heregistrasi' && user?.hereg_track === 'Masih Aktif') {
      return <HeregMigrationForm onEditProfile={onEditProfile} />;
    }
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
          <button type="button" onClick={onEditProfile} className="text-[#0884c4] hover:underline font-semibold">
            Salah pilih? Ubah jawaban
          </button>
        )}
      </p>
    );
    return (
      <div className="relative w-full max-w-5xl mx-auto lg:min-h-[calc(100vh-14rem)] flex items-center">
        <div className="overflow-hidden w-full rounded-[28px] bg-white border border-slate-200/80 shadow-[0_30px_80px_-40px_rgba(11,26,74,0.45)]">
          <div className="border-b border-slate-100 px-5 sm:px-7 py-5 sm:py-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0884c4]">Sebelum mengisi formulir</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900 tracking-tight">
                Persyaratan {isLB ? 'Anggota Luar Biasa' : 'Anggota Biasa'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
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
            <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <p className="text-sm font-semibold text-slate-800 mb-3">Dokumen yang diunggah ({reqDocs.length})</p>
              <ol className="space-y-1.5">
                {reqDocs.map((title, i) => (
                  <li key={title} className="flex items-center gap-3 bg-slate-50/70 px-3 py-2.5 rounded-xl border border-slate-100 text-[13px] text-slate-700">
                    <span className="w-6 h-6 flex-shrink-0 rounded-full bg-sky-50 text-[#0884c4] ring-1 ring-sky-100 text-xs font-semibold tabular-nums flex items-center justify-center">{i + 1}</span>
                    <span>{title}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-slate-500 mt-3">Format PDF / JPG / PNG. Dokumen diperiksa Admin satu per satu sebelum pembayaran.</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 p-4 sm:p-5 text-sm">
                <p className="font-semibold text-slate-800 mb-3">Rincian biaya</p>
                {[
                  ['Uang Pangkal', fees.uangPangkal],
                  [`Iuran ${fees.durasiBulan || 24} Bulan`, fees.iuran24Bulan],
                  ['Biaya Administrasi', fees.administrasi],
                ].filter(([, v]) => Number(v) > 0).map(([label, v]) => (
                  <div key={label} className="flex justify-between text-slate-600 py-0.5">
                    <span>{label}</span><span className="text-slate-900 tabular-nums">{formatRupiah(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between mt-2 pt-2.5 border-t border-dashed border-slate-200 font-semibold text-slate-900">
                  <span>Total</span><span className="tabular-nums">{formatRupiah(fees.total)}</span>
                </div>
              </div>
              <PrintNotice compact />
            </div>
          </div>

          <div className="border-t border-slate-100 px-5 sm:px-7 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="sm:max-w-xl">{backText}</div>
            <button
              onClick={() => onNewSubmission({ submissionType: pickType, category: pickCategory })}
              className="group inline-flex items-center justify-center gap-2 w-full sm:w-auto h-12 px-6 rounded-xl bg-[#0884c4] hover:bg-[#076fa5] active:bg-[#065d8a] text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap"
            >
              <span>Isi formulir pengajuan</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
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
  // Anggota lama yang masa aktifnya masih berlaku: tercatat dari data manual, tanpa paket dokumen resmi
  const migratedSub = (() => {
    try {
      const fd = typeof sub?.form_data === 'string' ? JSON.parse(sub.form_data || '{}') : sub?.form_data || {};
      return fd?.source === 'Migrasi';
    } catch { return false; }
  })();

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
  // Nomor revisi mengikuti putaran pengajuan agar sama dengan yang dilihat Admin
  const revRound = sub.status === 'Perlu Revisi' ? Math.max(Number(sub.revision_round) || 0, 1) : (Number(sub.revision_round) || 0) + 1;
  const isShipping    = sub.status === 'Pengiriman Berkas';
  const actionDocs = docs.filter((d) => d.screening_status === 'Perlu Revisi'
    || ((isDraf || isScreening || isNeedRevision) && !d.file_path));
  const stagedActionDocs = actionDocs.filter((d) => stagedFiles[d.id]);
  const stagedCount      = stagedActionDocs.length;
  const remainingCount   = actionDocs.length - stagedCount;
  const reviewItems      = stagedActionDocs.map((d) => ({ key: d.id, title: d.document_title, file: stagedFiles[d.id] }));
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

  // Anggota aktif: tampilkan dashboard keanggotaan saja, tanpa tahapan & riwayat pengajuan
  const isActiveMember = sub.status === 'Aktif';

  return (
    <div className="space-y-6 w-full">

      {/* ══ DASHBOARD ANGGOTA AKTIF: kartu anggota, masa aktif, data penerbit ══ */}
      {isActiveMember ? (
        <ActiveMemberDashboard
          sub={sub}
          durasiBulan={bill.durasiBulan || 24}
          hasInvoice={Boolean(payment?.proof_file)}
          onOpenPacket={() => setShowPacket(true)}
          onOpenInvoice={() => setShowInvoice(true)}
          onEditProfile={() => setShowProfileEdit(true)}
          renewFee={feesFromSettings(settings, 'Heregistrasi')}
          onRenew={() => onNewSubmission?.({ renewFrom: sub })}
        />
      ) : (
      <>
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
        <div className="rounded-[24px] p-5 sm:p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300/80 shadow-sm space-y-3.5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-600 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-bold text-amber-900">Pemberitahuan: Dokumen Perlu Direvisi</h4>
                {sub.revision_round > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-amber-800 border border-amber-300">
                    Revisi ke-{revRound}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                  {rejectedDocs.length} Dokumen Belum Sesuai
                </span>
              </div>
              <p className="text-sm text-amber-900 leading-relaxed">
                Hasil pemeriksaan admin menemukan ada dokumen yang belum sesuai persyaratan. Silakan periksa catatan revisi di bawah dan unggah ulang dokumen yang bertanda kuning.
              </p>
              {sub.admin_notes && (
                <div className="p-3 mt-2 rounded-xl bg-white/90 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-900">Catatan Admin:</span>
                    <p className="mt-0.5 font-medium">{sub.admin_notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white/85 rounded-xl p-3.5 border border-amber-200/70 text-xs text-slate-700 space-y-1.5">
            <p className="font-semibold text-slate-900">Dokumen yang harus diunggah ulang:</p>
            <ul className="list-disc pl-5 space-y-1">
              {rejectedDocs.map((d) => (
                <li key={d.id}>
                  <strong className="text-slate-800">{d.document_title}</strong>
                  {d.revision_notes ? (
                    <span className="text-amber-800 font-medium"> — Alasan: "{d.revision_notes}"</span>
                  ) : (
                    <span className="text-amber-700 font-medium"> — Belum sesuai ketentuan</span>
                  )}
                  {canMarkFile(d) && (
                    <button type="button" onClick={() => setMarkDoc(d)} className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-semibold transition">
                      <Eye className="w-3 h-3" /> Lihat highlight revisi
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 pt-1">
              💡 Dokumen yang bertanda hijau ("Sesuai") tidak perlu diunggah ulang. Pilih file pengganti, periksa lagi, lalu tekan "Kirim ke Admin". Berkas baru masuk antrean screening ulang setelah dikirim.
            </p>
          </div>
        </div>
      )}

      {/* ══ INFO TAHAP SAAT INI (Normal) ══ */}
      {isDraf && <PrintNotice />}
      {isScreening && !isNeedRevision && (
        <StageInfo icon={Clock} tone="blue" title={sub.revision_round > 0 ? `Tahap 1 · Hasil revisi ke-${sub.revision_round} sedang diperiksa Admin` : 'Tahap 1 · Dokumen sedang diperiksa Admin'}>
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
          Setelah Ketua menyetujui, Anda akan diminta mencetak dan mengirim berkas fisik langsung ke IKAPI Pusat.
        </StageInfo>
      )}

      {/* ══ PEMBERITAHUAN: KIRIM BERKAS FISIK KE IKAPI PUSAT ══ */}
      {/* Tidak ada data pengiriman yang diisi. Pemohon cukup klik "Lanjutkan" setelah mengirim berkas. */}
      {isShipping && (
        <div className="card-surface overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-100 px-5 sm:px-7 py-4 flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-amber-700" />
            <h3 className="text-lg text-slate-800">Kirim Berkas Fisik ke IKAPI Pusat</h3>
          </div>
          <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Pengajuan Anda sudah disetujui Sekretaris & Ketua. <strong className="font-medium">Cetak sendiri</strong> berkas berikut lalu kirim langsung ke IKAPI Pusat:
              </p>
              <ol className="space-y-1.5 text-sm text-slate-700 list-decimal pl-5">
                {physicalChecklist(sub, docs).map((item) => <li key={item}>{item}</li>)}
              </ol>
              <button onClick={() => setShowPacket(true)} className="soft-pill-primary">
                <Printer className="w-4 h-4" /> Cetak / unduh surat pengantar & formulir
              </button>
            </div>

            <form onSubmit={handleShipSubmit} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5" />
                </span>
                <div className="text-sm text-slate-700 space-y-1">
                  <p className="font-medium text-slate-900">Kirim berkas fisik ke alamat ini</p>
                  {centralAddressLines(settings).map((line, i) => (
                    <p key={i} className={i === 0 ? 'text-slate-800' : 'text-slate-600'}>{line}</p>
                  ))}
                </div>
              </div>
              <p className="text-sm text-slate-600">
                Pengiriman diurus sendiri oleh Anda. Setelah berkas dikirim, klik <strong className="font-medium">Lanjutkan</strong> untuk
                masuk ke tahap pengisian Nomor KTA.
              </p>
              <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={shipConfirmed} onChange={(e) => setShipConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0da2e7] focus:ring-sky-200" />
                Saya sudah mengirim berkas fisik ke IKAPI Pusat.
              </label>
              <button type="submit" disabled={!shipConfirmed || sendingShip} className="soft-pill-primary w-full py-3 disabled:opacity-50">
                {sendingShip ? 'Menyimpan...' : <>Lanjutkan <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ INPUT NOMOR KTA (diverifikasi Admin) ══ */}
      {/* kta_review_status: NULL = belum diisi, Menunggu = diperiksa Admin, Ditolak = isi / unggah ulang */}
      {(sub.status === 'Berkas Diterima' || sub.status === 'Dikirim ke Pusat') && (() => {
        const canInput = sub.status === 'Dikirim ke Pusat';
        const review = sub.kta_review_status;
        const waiting = canInput && review === 'Menunggu';
        const rejected = canInput && review === 'Ditolak';
        return (
          <div className="card-surface overflow-hidden">
            <div className="bg-sky-50 border-b border-sky-100 px-5 sm:px-7 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-5 h-5 text-[#0884c4]" />
                <h3 className="text-lg text-slate-800">Input Nomor KTA</h3>
              </div>
              {canInput && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  waiting ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : rejected ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-sky-100 text-[#0884c4] border-sky-200'}`}>
                  {waiting ? 'Diverifikasi Admin' : rejected ? 'Perlu diperbaiki' : 'Belum diisi'}
                </span>
              )}
            </div>

            <div className="p-5 sm:p-7">
              {!canInput ? (
                <div className="panel-inner p-5 text-sm text-slate-600">
                  Berkas Anda tercatat di sekretariat IKAPI Jawa Barat dan sedang diteruskan ke IKAPI Pusat.
                </div>
              ) : waiting ? (
                <div className="max-w-xl mx-auto text-center space-y-4 py-2">
                  <span className="mx-auto w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Clock className="w-7 h-7" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-base font-medium text-slate-900">Data KTA sedang diverifikasi Admin</p>
                    <p className="text-sm text-slate-600">Keanggotaan Anda aktif setelah Admin menyatakan datanya benar.</p>
                  </div>
                  <div className="panel-inner p-4 text-left text-sm space-y-1.5">
                    <p className="flex justify-between gap-3"><span className="text-slate-500">Nomor KTA</span><span className="font-mono text-slate-900">{sub.kta_number_submitted}</span></p>
                    <p className="flex justify-between gap-3"><span className="text-slate-500">Tanggal terbit</span><span className="text-slate-900">{formatLongDate(sub.kta_issued_at)}</span></p>
                    {sub.kta_proof_file && (
                      <p className="flex justify-between gap-3"><span className="text-slate-500">Bukti</span>
                        <a href={fileUrl(sub.kta_proof_file)} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline truncate">{sub.kta_proof_name || 'Lihat file'}</a>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleKtaSubmit} className="max-w-xl mx-auto space-y-5">
                  {rejected ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 text-sm">
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium text-red-800">Data KTA ditolak Admin. Perbaiki lalu kirim ulang.</p>
                        {sub.kta_review_note && <p className="text-red-700">Alasan: {sub.kta_review_note}</p>}
                        {sub.kta_number_submitted && (
                          <p className="text-xs text-red-600/80">Data sebelumnya: <span className="font-mono">{sub.kta_number_submitted}</span></p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <span className="mx-auto w-14 h-14 rounded-full bg-sky-100 text-[#0884c4] flex items-center justify-center">
                        <HelpCircle className="w-7 h-7" />
                      </span>
                      <p className="text-base font-medium text-slate-900">Sudah menerima Nomor KTA dari IKAPI Pusat?</p>
                      <p className="text-sm text-slate-600">
                        Isi sesuai kartu / surat dari Pusat. Admin akan memeriksa datanya, lalu keanggotaan Anda aktif.
                      </p>
                    </div>
                  )}

                  <div className="panel-inner p-5 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Nomor KTA *</label>
                      <input required value={ktaForm.ktaNumber} maxLength={100}
                        onChange={(e) => setKtaForm({ ...ktaForm, ktaNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9./ -]/g, '') })}
                        placeholder="Sesuai kartu / surat dari IKAPI Pusat" className="soft-input font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Tanggal terbit KTA *</label>
                      <input required type="date" value={ktaForm.issuedAt} max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setKtaForm({ ...ktaForm, issuedAt: e.target.value })} className="soft-input" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Foto / scan KTA atau surat dari Pusat *</label>
                      <input required type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => setKtaForm({ ...ktaForm, file: e.target.files?.[0] || null })}
                        className="block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:bg-sky-50 file:text-[#0884c4] file:font-medium hover:file:bg-sky-100" />
                      <p className="text-[11px] text-slate-400 mt-1">PDF/JPG/PNG, maks. 10 MB.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Catatan</label>
                      <input value={ktaForm.notes} onChange={(e) => setKtaForm({ ...ktaForm, notes: e.target.value })}
                        placeholder="Opsional" className="soft-input" />
                    </div>
                    <button type="submit" disabled={sendingKta} className="soft-pill-primary w-full py-3">
                      <Send className="w-4 h-4" /> {sendingKta ? 'Mengirim...' : rejected ? 'Kirim ulang untuk diverifikasi' : 'Kirim untuk diverifikasi Admin'}
                    </button>
                  </div>

                  {(settings.office_phone || settings.office_email) && (
                    <p className="text-xs text-slate-500 text-center">
                      Belum menerima Nomor KTA? Hubungi sekretariat IKAPI Jawa Barat:{' '}
                      {settings.office_phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{settings.office_phone}</span>}
                      {settings.office_phone && settings.office_email && ' · '}
                      {settings.office_email && (
                        <a href={`mailto:${settings.office_email}?subject=${encodeURIComponent(`Status KTA - ${sub.publisher_name || ''} (Pengajuan #${sub.id})`)}`}
                          className="inline-flex items-center gap-1 text-sky-700 hover:underline">
                          <Mail className="w-3.5 h-3.5" />{settings.office_email}
                        </a>
                      )}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        );
      })()}

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
                    {...NUMERIC}
                    value={payForm.senderAccountNumber}
                    onChange={(e) => setPayForm({ ...payForm, senderAccountNumber: FILTERS.digits(e.target.value) })}
                    placeholder="Nomor rekening (angka saja)"
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
              <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${rejectedDocs.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
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
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                {rejectedDocs.length} dokumen perlu diganti
              </span>
            )}
          </div>

          <ol className="p-4 sm:p-6 space-y-3">
            {actionDocs.map((doc, idx) => {
              const isRevisi  = doc.screening_status === 'Perlu Revisi';
              const hasFile   = Boolean(doc.file_path && doc.file_name && doc.file_name !== 'Belum diunggah');
              const canUpload = isDraf || isRevisi || ((isScreening || isNeedRevision) && !hasFile);
              const staged    = canUpload ? stagedFiles[doc.id] : null;
              const label = !hasFile && !isRevisi
                ? { text: 'Belum diunggah', cls: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-300' }
                : isRevisi
                ? { text: `Perlu revisi ke-${revRound}`, cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' }
                : SCREENING_LABEL[doc.screening_status] || SCREENING_LABEL.Menunggu;

              return (
                <li key={doc.id || idx} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  {/* Kepala kartu: nomor, nama dokumen, status, berkas lama */}
                  <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 ${isRevisi ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 min-w-0">{doc.document_title}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${label.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${label.dot}`} />
                      {label.text}
                    </span>
                    {isRevisi && doc.file_path && (
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        {canMarkFile(doc) && (
                          <button
                            type="button"
                            onClick={() => setMarkDoc(doc)}
                            className="px-3 py-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-semibold flex items-center gap-1.5 transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> Lihat highlight di dokumen
                          </button>
                        )}
                        <a href={fileUrl(doc.file_path)} target="_blank" rel="noreferrer"
                          className="text-xs font-medium text-slate-500 hover:text-[#0884c4] flex items-center gap-1 transition">
                          <ExternalLink className="w-3.5 h-3.5" /> Lihat berkas lama
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className={`grid gap-4 items-stretch ${canUpload ? 'md:grid-cols-[minmax(0,1fr),16rem]' : ''}`}>
                      {isRevisi ? (() => {
                        const rawMarks = parseMarks(doc.revision_marks);
                        const hasFileToMark = canMarkFile(doc);
                        const marks = rawMarks.length > 0
                          ? rawMarks
                          : (doc.revision_notes
                            ? String(doc.revision_notes).split(';').map((s) => s.trim()).filter(Boolean).map((note, idxNote) => ({
                                page: 1,
                                x: 0.08,
                                y: Math.min(0.75, 0.10 + idxNote * 0.18),
                                w: 0.84,
                                h: 0.14,
                                note,
                              }))
                            : []);
                        const showMarks = marks.length > 0;
                        const general = adminGeneralNote(doc, rawMarks);
                        return (
                          <div className="rounded-xl bg-amber-50/80 border-l-4 border-amber-400 px-4 py-3 text-sm text-amber-950 flex flex-col min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 mb-2">Catatan Admin</p>
                            {showMarks && (
                              <ol className="space-y-1.5">
                                {marks.map((m, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="mt-px w-5 h-5 flex-shrink-0 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                                    <span className="leading-snug text-amber-950">{m.note || 'Bagian yang ditandai perlu diperbaiki.'}</span>
                                  </li>
                                ))}
                              </ol>
                            )}
                            {(general && rawMarks.length > 0) || !showMarks ? (
                              <p className={`leading-relaxed ${showMarks ? 'mt-2.5 pt-2.5 border-t border-amber-200/70 text-amber-900' : 'text-amber-950'}`}>
                                {general || doc.revision_notes || 'Format atau berkas belum sesuai ketentuan. Silakan unggah dokumen pengganti.'}
                              </p>
                            ) : null}
                            {hasFileToMark && (
                              <button type="button" onClick={() => setMarkDoc(doc)}
                                className="mt-3 self-start px-3.5 py-1.5 rounded-full bg-amber-400/90 hover:bg-amber-400 border border-amber-500/40 text-amber-950 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition">
                                <Eye className="w-3.5 h-3.5" /> Lihat bagian yang disorot pada dokumen
                              </button>
                            )}
                          </div>
                        );
                      })() : (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 flex-shrink-0 text-slate-400" />
                          {hasFile ? (
                            <a href={fileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="truncate hover:underline">{doc.file_name}</a>
                          ) : <span>Belum ada berkas diunggah</span>}
                        </div>
                      )}

                      {canUpload && (staged ? (
                        <div className="min-h-[8rem] rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col gap-3 min-w-0">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="w-9 h-9 rounded-xl bg-white border border-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="w-5 h-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">File pengganti siap</p>
                              <button type="button" onClick={() => previewStaged(staged)} title="Lihat file"
                                className="block max-w-full text-left text-sm font-medium text-slate-800 truncate hover:underline">{staged.name}</button>
                              <p className="text-xs text-slate-500">{formatFileSize(staged.size)}</p>
                            </div>
                          </div>
                          {uploadingDocId === doc.id ? (
                            <span className="mt-auto text-xs text-[#0884c4] flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengirim…</span>
                          ) : (
                            <div className="mt-auto grid grid-cols-2 gap-2">
                              <label className={`px-3 py-2 rounded-full bg-white border border-slate-200 text-xs font-medium text-[#0884c4] hover:border-[#0da2e7] flex items-center justify-center gap-1.5 transition ${sendingDocs ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                                <RefreshCw className="w-3.5 h-3.5" /> Ganti
                                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" disabled={sendingDocs}
                                  onChange={(e) => { stageDocFile(doc, e.target.files[0]); e.target.value = ''; }} />
                              </label>
                              <button type="button" onClick={() => unstageDocFile(doc)} disabled={sendingDocs}
                                className="px-3 py-2 rounded-full bg-white border border-slate-200 text-xs font-medium text-red-600 hover:border-red-300 flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                                <Trash2 className="w-3.5 h-3.5" /> Hapus
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <label className={`min-h-[8rem] rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-50 hover:border-[#0da2e7] p-4 flex flex-col items-center justify-center text-center gap-1 transition ${sendingDocs ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                          <span className="w-9 h-9 mb-1 rounded-full bg-[#0da2e7] text-white flex items-center justify-center shadow-sm">
                            <Upload className="w-4 h-4" />
                          </span>
                          <span className="text-sm font-semibold text-slate-800">{isRevisi ? 'Unggah file pengganti' : 'Pilih file'}</span>
                          <span className="text-xs text-slate-500">PDF, JPG, atau PNG</span>
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" disabled={sendingDocs}
                            onChange={(e) => { stageDocFile(doc, e.target.files[0]); e.target.value = ''; }} />
                        </label>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Kirim file yang sudah dipilih: baru masuk ke Admin setelah dikonfirmasi */}
          <div className="px-5 sm:px-7 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-600 leading-relaxed sm:max-w-lg">
              {stagedCount === 0
                ? (isDraf
                  ? 'Pilih file untuk setiap dokumen di atas. File belum tersimpan sampai Anda menekan tombol Simpan.'
                  : 'Pilih file untuk setiap dokumen di atas. File belum dikirim sampai Anda menekan tombol Kirim.')
                : remainingCount > 0
                ? <><strong className="text-slate-800">{stagedCount} file siap dikirim.</strong> Masih ada {remainingCount} dokumen yang belum dipilih filenya.</>
                : <><strong className="text-slate-800">Semua file siap.</strong> {isDraf ? 'Periksa sekali lagi lalu simpan ke draf.' : 'Periksa sekali lagi lalu kirim ke Admin.'}</>}
            </p>
            <button type="button" disabled={stagedCount === 0 || sendingDocs} onClick={() => setReviewOpen(true)}
              className="px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 transition bg-[#0da2e7] hover:bg-[#0884c4] text-white shadow-sm disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
              <Send className="w-4 h-4" />
              {isDraf
                ? (stagedCount > 0 ? `Simpan ${stagedCount} dokumen ke draf` : 'Simpan ke draf')
                : (stagedCount > 0 ? `Kirim ${stagedCount} dokumen ke Admin` : 'Kirim ke Admin')}
            </button>
          </div>
        </div>
      )}

      <UploadReviewDialog
        open={reviewOpen}
        title={isDraf ? 'Simpan dokumen ke draf?' : rejectedDocs.length > 0 ? 'Kirim dokumen perbaikan?' : 'Kirim dokumen ke Admin?'}
        description={isDraf
          ? 'File disimpan di draf dan belum dikirim ke Admin. Pengajuan dikirim lewat tombol Lanjutkan Draf → Submit Pengajuan.'
          : 'Pastikan file sudah benar dan terbaca jelas. Setelah dikirim, dokumen tidak bisa diganti sampai Admin selesai memeriksa.'}
        items={reviewItems}
        confirmLabel={isDraf ? 'Simpan ke draf' : 'Kirim ke Admin'}
        note={remainingCount > 0 && !isDraf
          ? `Masih ada ${remainingCount} dokumen yang belum dipilih. Pengajuan baru diperiksa ulang Admin setelah semua dokumen yang diminta terkirim.`
          : null}
        busy={sendingDocs}
        onConfirm={sendStagedDocs}
        onClose={() => setReviewOpen(false)}
      />

      {/* ══ RIWAYAT ALUR BERKAS ══ */}
      <SubmissionTimeline timeline={detailData?.timeline || []} cardClassName="card-surface" />
      </>
      )}

      {/* ══ DOKUMEN DENGAN SOROTAN REVISI ══ */}
      {markDoc && <RevisionMarksViewer doc={markDoc} round={revRound} onClose={() => setMarkDoc(null)} />}

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
                formulir, dan fotokopi berkas persyaratan, lalu kirim langsung ke IKAPI Pusat:
              </p>
              <p className="text-xs text-slate-700 bg-slate-50 rounded-xl px-3 py-2 mt-3 flex gap-2">
                <MapPin className="w-4 h-4 text-[#0884c4] flex-shrink-0" /> {centralAddressLines(settings).join(', ')}
              </p>
              <p className="text-xs text-slate-500 mt-3 flex gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                Setelah berkas dikirim, klik Lanjutkan lalu isi Nomor KTA dari IKAPI Pusat. Admin memverifikasi sebelum keanggotaan aktif.
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
              <h3 id="welcome-title" className="text-xl font-medium text-slate-900">
                {migratedSub ? 'Selamat, keanggotaan Anda tervalidasi!' : 'Selamat, tahap pendaftaran sudah selesai!'}
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {migratedSub
                  ? <>Admin memvalidasi KTA <strong className="font-medium text-slate-800">{sub.publisher_name}</strong> yang masih berlaku.</>
                  : <>Nomor KTA <strong className="font-medium text-slate-800">{sub.publisher_name}</strong> sudah terbit dari IKAPI Pusat.</>}
                {' '}Anda kini <strong className="font-medium text-emerald-700">resmi menjadi anggota IKAPI Jawa Barat</strong>
                {sub.activated_at && <> sejak {formatLongDate(sub.activated_at)}</>}.
              </p>
              <p className="text-xs text-slate-500 mt-3">
                {(sub.member_kta || sub.kta_number) ? <>Nomor KTA: <strong className="font-mono text-slate-700">{sub.member_kta || sub.kta_number}</strong>. </> : null}
                {migratedSub
                  ? 'Data keanggotaan Anda kini tercatat di aplikasi ini.'
                  : 'Dokumen resmi (surat, formulir, berita acara & SK) bisa diunduh kapan saja.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-5">
                {!migratedSub && <button
                  onClick={() => { closeWelcome(); setShowPacket(true); }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition"
                >
                  <FileText className="w-4 h-4" /> Lihat dokumen
                </button>}
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
      {showProfileEdit && (
        <ProfileEditModal sub={sub} onClose={() => setShowProfileEdit(false)}
          onSaved={async (msg) => { setShowProfileEdit(false); await loadDetail(sub.id); notify(msg, { tone: 'success', title: 'Data diperbarui' }); }} />
      )}
      {showPacket && (
        <ModalFrame onClose={() => setShowPacket(false)}>
          <CentralPacketExporter submission={sub} documents={docs} settings={settings} />
        </ModalFrame>
      )}
    </div>
  );
}
