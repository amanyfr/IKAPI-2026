import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CheckCircle, XCircle, FileText, CreditCard, ExternalLink, ShieldCheck, Eye, Lock,
  History, Truck, PenTool, Send, Clock
} from 'lucide-react';
import SubmissionTimeline, { formatTime } from './SubmissionTimeline';
import { STATUS_LABEL, POST_APPROVAL_STATUSES } from './StatusStepper';
import { notify } from './AppDialog';
import { fileUrl } from '../utils/fileUrl';

// Label cepat alasan "Tidak sesuai" (mengisi komentar, tetap bisa diubah)
const REASON_LABELS = [
  'File tidak terbaca / buram',
  'Dokumen tidak lengkap',
  'Bukan dokumen yang diminta',
  'Masa berlaku habis',
  'Data tidak sesuai formulir',
  'Belum ditandatangani / dicap',
];

const PAYMENT_REASONS = ['Nominal tidak sesuai', 'Bukti tidak terbaca', 'Rekening tujuan salah', 'Transfer belum masuk'];

const isImage = (doc) => /^image\//.test(doc?.mime_type || '') || /\.(png|jpe?g|gif|webp)$/i.test(doc?.file_path || '');
const isPdf = (doc) => /pdf/.test(doc?.mime_type || '') || /\.pdf$/i.test(doc?.file_path || '');

function FilePreview({ file }) {
  if (!file?.file_path) {
    return <div className="h-full min-h-[260px] flex items-center justify-center text-xs text-slate-400">Belum ada file.</div>;
  }
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-white">
        <span className="text-xs font-mono text-slate-600 truncate">{file.file_name}</span>
        <a href={fileUrl(file.file_path)} target="_blank" rel="noreferrer" className="flex-shrink-0 text-xs text-[#0884c4] font-semibold flex items-center gap-1 hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> Tab baru
        </a>
      </div>
      <div className="flex-1 min-h-[320px] bg-slate-100">
        {isImage(file) ? (
          <img src={fileUrl(file.file_path)} alt={file.file_name} className="w-full h-full max-h-[60vh] object-contain" />
        ) : isPdf(file) ? (
          <iframe title={file.file_name} src={fileUrl(file.file_path)} className="w-full h-full min-h-[320px] lg:min-h-[52vh] bg-white" />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 p-6 text-center">
            Pratinjau tidak tersedia untuk jenis file ini. Buka di tab baru untuk memeriksa.
          </div>
        )}
      </div>
    </div>
  );
}

const DOC_BADGE = {
  Sesuai: 'bg-emerald-100 text-emerald-800',
  'Perlu Revisi': 'bg-red-100 text-red-700',
  Menunggu: 'bg-slate-100 text-slate-600',
};
const docBadgeText = (doc) => (!doc.file_path ? 'Belum diunggah' : doc.screening_status === 'Perlu Revisi' ? 'Tidak sesuai' : doc.screening_status === 'Menunggu' ? 'Belum diperiksa' : 'Sesuai');

export default function DocumentVerificationModal({
  isOpen,
  onClose,
  submission,
  documents = [],
  payment,
  timeline = [],
  role,
  onScreenDocument,
  onVerifyPayment,
  onAdmin1Action,
  onSignSecretary,
  onRejectSecretary,
  onReceivePhysical,
  onSendCentral,
}) {
  const status = submission?.status;
  const initialTab = status === 'Menunggu Pembayaran' ? 'payment'
    : ['Pengiriman Berkas', 'Berkas Diterima', 'Dikirim ke Pusat'].includes(status) ? 'physical' : 'documents';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeDocId, setActiveDocId] = useState(documents[0]?.id || null);
  const [opened, setOpened] = useState(() => new Set());   // dokumen yang sudah dibuka (pratinjau) di sesi ini
  const [openedAt, setOpenedAt] = useState({});             // waktu dibuka yang baru dicatat server
  const [rejecting, setRejecting] = useState(null);         // docId yang sedang diberi komentar
  const [comment, setComment] = useState('');
  const [payReject, setPayReject] = useState(false);
  const [payComment, setPayComment] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [rejectingSub, setRejectingSub] = useState(false);
  const [busy, setBusy] = useState(false);
  const [central, setCentral] = useState({ courier: '', trackingNo: '', notes: '' });

  useEffect(() => {
    if (isOpen && submission) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen, submission]);

  if (!isOpen || !submission) return null;

  const isAdmin = role === 'Admin';
  const canScreenDocs = isAdmin && status === 'Menunggu Verifikasi';
  const canVerifyPayment = isAdmin && status === 'Menunggu Pembayaran' && payment?.proof_file && payment?.verification_status === 'Menunggu';
  const canSign = role === 'Sekretaris' && status === 'Menunggu TTD Sekretaris';
  // Berkas fisik baru bisa dikonfirmasi setelah pemohon menandainya sudah dikirim
  const awaitingShipment = isAdmin && status === 'Pengiriman Berkas' && submission.physical_status !== 'Dikirim';
  const canReceive = isAdmin && status === 'Pengiriman Berkas' && submission.physical_status === 'Dikirim';
  const canSendCentral = isAdmin && status === 'Berkas Diterima' && Boolean(onSendCentral);

  const activeDoc = documents.find((d) => d.id === activeDocId) || documents[0];
  const paymentFile = payment?.proof_file ? { file_path: payment.proof_file, file_name: payment.proof_filename || 'Bukti transfer', mime_type: '' } : null;

  const okCount = documents.filter((d) => d.file_path && d.screening_status === 'Sesuai').length;
  const badCount = documents.filter((d) => d.screening_status === 'Perlu Revisi').length;
  const pendingCount = documents.length - okCount - badCount;
  const allOk = documents.length > 0 && okCount === documents.length;

  // Catat waktu pertama Admin membuka dokumen / bukti transfer (log waktu screening)
  const recordOpen = async (key, url) => {
    if (!isAdmin || openedAt[key]) return;
    try {
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` } });
      const data = await res.json();
      if (res.ok) setOpenedAt((m) => ({ ...m, [key]: { at: data.opened_at || data.proof_opened_at, by: data.opened_by_name || data.proof_opened_by_name } }));
    } catch { /* log waktu gagal dicatat: penilaian tetap bisa dilakukan */ }
  };

  const docOpenInfo = (doc) => openedAt[doc.id] || (doc.opened_at ? { at: doc.opened_at, by: doc.opened_by_name } : null);
  const paymentOpenInfo = openedAt.payment || (payment?.proof_opened_at ? { at: payment.proof_opened_at, by: payment.proof_opened_by_name } : null);

  const openDoc = (doc) => {
    setActiveDocId(doc.id);
    if (doc.file_path) {
      setOpened((prev) => new Set(prev).add(doc.id));
      if (!doc.opened_at) recordOpen(doc.id, `/api/documents/${doc.id}/opened`);
    }
    setRejecting(null);
  };

  const openPayment = () => {
    setOpened((p) => new Set(p).add('payment'));
    if (!payment?.proof_opened_at) recordOpen('payment', `/api/submissions/${submission.id}/payment/opened`);
  };

  // Log waktu persetujuan per peran
  const approvalLog = [
    { label: 'Dokumen disetujui Admin', at: submission.screened_at, by: submission.screened_by_name },
    { label: 'Pembayaran valid', at: payment?.verification_status === 'Valid' ? payment.verified_at : null, by: payment?.verified_by_name },
    { label: 'Disetujui & TTD Sekretaris', at: submission.secretary_signature_date, by: submission.signed_by_secretary },
    { label: 'Disetujui & TTD Ketua', at: submission.chairman_signature_date, by: submission.signed_by_chairman },
    { label: 'Berkas fisik diterima', at: submission.physical_received_at, by: submission.physical_received_by },
  ];

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  const markDoc = (doc, value) => run(async () => {
    if (value === 'Perlu Revisi' && !comment.trim()) throw new Error('Tulis komentar alasan dokumen tidak sesuai.');
    await onScreenDocument(doc.id, value, value === 'Perlu Revisi' ? comment.trim() : '');
    setRejecting(null);
    setComment('');
    // Lanjut otomatis ke dokumen berikutnya yang belum diperiksa
    const next = documents.find((d) => d.id !== doc.id && d.file_path && d.screening_status === 'Menunggu');
    if (next) setActiveDocId(next.id);
  });

  const docsOpened = documents.every((d) => !d.file_path || opened.has(d.id) || docOpenInfo(d) || d.screening_status !== 'Menunggu');

  const tabs = [
    { key: 'documents', icon: FileText, label: `Dokumen (${okCount}/${documents.length})` },
    { key: 'payment', icon: CreditCard, label: `Pembayaran${payment?.verification_status === 'Valid' ? ' · Valid' : ''}` },
    ...(POST_APPROVAL_STATUSES.includes(status) ? [{ key: 'physical', icon: Truck, label: 'Berkas Fisik & Pusat' }] : []),
    { key: 'history', icon: History, label: 'Riwayat' },
  ];

  const modalContent = (
    <div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh]">

        {/* Header */}
        <div className="bg-[#0da2e7] text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-[#0884c4] rounded-lg text-amber-300 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-base sm:text-lg leading-tight truncate">{submission.publisher_name}</h3>
              <p className="text-xs text-[#dff2fd] mt-0.5">
                {submission.submission_type === 'Heregistrasi' ? 'Registrasi' : 'Anggota Baru'} · {submission.member_category || submission.category} ·{' '}
                <strong className="font-semibold text-white">{STATUS_LABEL[status] || status}</strong>
                {!isAdmin && !canSign && <span className="ml-1 opacity-90">· mode lihat</span>}
              </p>
              {(submission.applicant_name || submission.applicant_email) && (
                <p className="text-[11px] text-[#dff2fd] mt-1 flex flex-wrap items-center gap-x-1.5 min-w-0">
                  <span className="opacity-80">Akun pemohon:</span>
                  <span className="font-semibold text-white truncate">{submission.applicant_name || '-'}</span>
                  {submission.applicant_email && (
                    <a href={`mailto:${submission.applicant_email}`} className="underline decoration-white/40 hover:decoration-white truncate">
                      {submission.applicant_email}
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg text-[#dff2fd] hover:text-white hover:bg-[#0884c4] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-slate-100 px-3 sm:px-6 py-2 border-b border-slate-200 flex gap-1.5 overflow-x-auto">
          {tabs.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
                activeTab === key ? 'bg-white text-[#0884c4] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Log waktu persetujuan */}
        <div className="px-3 sm:px-6 py-2 border-b border-slate-200 bg-white flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-semibold text-slate-500 mr-1">Log persetujuan:</span>
          {approvalLog.filter((a) => a.at).length === 0 && <span className="text-slate-400">belum ada persetujuan</span>}
          {approvalLog.filter((a) => a.at).map((a) => (
            <span key={a.label} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200"
              title={a.by ? `oleh ${a.by}` : undefined}>
              <CheckCircle className="w-3 h-3" /> {a.label} · {formatTime(a.at)}{a.by ? ` · ${a.by}` : ''}
            </span>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── DOKUMEN ── */}
          {activeTab === 'documents' && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr]">
              <div className="border-b lg:border-b-0 lg:border-r border-slate-200 p-3 space-y-2">
                <p className="text-[11px] text-slate-500 px-1">
                  {canScreenDocs
                    ? 'Buka setiap dokumen dulu. Tombol penilaian muncul setelah dokumen dibuka.'
                    : 'Hasil screening dokumen oleh Admin.'}
                </p>
                {documents.map((doc, i) => {
                  const active = activeDoc?.id === doc.id;
                  const seen = opened.has(doc.id);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => openDoc(doc)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        active ? 'border-[#0da2e7] bg-[#f0f9ff]' : 'border-slate-200 bg-white hover:border-[#b8e6fc]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800">{i + 1}. {doc.document_title}</span>
                        <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${doc.file_path ? DOC_BADGE[doc.screening_status] : DOC_BADGE.Menunggu}`}>
                          {docBadgeText(doc)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                        {seen || docOpenInfo(doc) ? <Eye className="w-3 h-3 text-[#0884c4] flex-shrink-0" /> : <Lock className="w-3 h-3 flex-shrink-0" />}
                        <span>
                          {docOpenInfo(doc)
                            ? `Dibuka ${formatTime(docOpenInfo(doc).at)}`
                            : seen ? 'Sudah dibuka' : doc.file_path ? 'Belum dibuka' : 'Menunggu unggahan pemohon'}
                        </span>
                      </div>
                      {doc.verified_at && doc.screening_status !== 'Menunggu' && (
                        <div className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${doc.screening_status === 'Sesuai' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {doc.screening_status === 'Sesuai' ? <CheckCircle className="w-3 h-3 flex-shrink-0" /> : <XCircle className="w-3 h-3 flex-shrink-0" />}
                          <span>
                            {doc.screening_status === 'Sesuai' ? 'Sesuai' : 'Tidak sesuai'} · {formatTime(doc.verified_at)}
                            {doc.verified_by_name && <span className="text-slate-500"> · {doc.verified_by_name}</span>}
                          </span>
                        </div>
                      )}
                      {doc.screening_status === 'Perlu Revisi' && doc.revision_notes && (
                        <p className="mt-1.5 text-[11px] text-red-700 bg-red-50 rounded-lg px-2 py-1">{doc.revision_notes}</p>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col">
                <div className="flex-1 border-b border-slate-200">
                  {activeDoc && opened.has(activeDoc.id) ? (
                    <FilePreview file={activeDoc} />
                  ) : (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <FileText className="w-10 h-10 text-slate-300" />
                      <p className="text-sm text-slate-600">{activeDoc?.document_title}</p>
                      {activeDoc?.file_path ? (
                        <button onClick={() => openDoc(activeDoc)} className="px-4 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5">
                          <Eye className="w-4 h-4" /> Buka dokumen
                        </button>
                      ) : (
                        <p className="text-xs text-slate-400">Pemohon belum mengunggah dokumen ini.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Penilaian per dokumen (hanya Admin, hanya setelah dokumen dibuka) */}
                {canScreenDocs && activeDoc?.file_path && (
                  <div className="p-4 bg-slate-50 space-y-3">
                    {!opened.has(activeDoc.id) && !docOpenInfo(activeDoc) ? (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Buka dokumen dulu untuk menilai.</p>
                    ) : rejecting === activeDoc.id ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-red-700">Tandai tidak sesuai — pilih label atau tulis komentar untuk pemohon:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {REASON_LABELS.map((r) => (
                            <button key={r} type="button" onClick={() => setComment((c) => (c.includes(r) ? c : c ? `${c}; ${r}` : r))}
                              className="px-2.5 py-1 rounded-full text-[11px] border border-red-200 bg-white text-red-700 hover:bg-red-50">
                              {r}
                            </button>
                          ))}
                        </div>
                        <textarea rows="2" value={comment} onChange={(e) => setComment(e.target.value)}
                          placeholder="Contoh: Scan akta terpotong di halaman 2, mohon unggah ulang yang lengkap."
                          className="w-full text-xs p-2.5 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300" />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setRejecting(null); setComment(''); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white">Batal</button>
                          <button disabled={busy} onClick={() => markDoc(activeDoc, 'Perlu Revisi')}
                            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5" /> Simpan: tidak sesuai
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="mr-auto text-xs text-slate-600">Hasil pemeriksaan <strong>{activeDoc.document_title}</strong>:</span>
                        <button disabled={busy} onClick={() => { setRejecting(activeDoc.id); setComment(activeDoc.revision_notes || ''); }}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 border ${activeDoc.screening_status === 'Perlu Revisi' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:bg-red-50'}`}>
                          <XCircle className="w-3.5 h-3.5" /> Tidak sesuai
                        </button>
                        <button disabled={busy} onClick={() => markDoc(activeDoc, 'Sesuai')}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 ${activeDoc.screening_status === 'Sesuai' ? 'bg-emerald-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                          <CheckCircle className="w-3.5 h-3.5" /> Sesuai
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PEMBAYARAN ── */}
          {activeTab === 'payment' && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr]">
              <div className="border-b lg:border-b-0 lg:border-r border-slate-200 p-4 space-y-3 text-xs">
                {status === 'Menunggu Verifikasi' || status === 'Perlu Revisi' || status === 'Draf' ? (
                  <p className="text-slate-500 bg-slate-50 rounded-lg p-3">Pembayaran (Tahap 2) dibuka setelah semua dokumen disetujui Admin.</p>
                ) : null}
                <div>
                  <p className="text-slate-500">Tagihan</p>
                  <p className="text-2xl font-light text-slate-900">Rp {Number(payment?.amount || 0).toLocaleString('id-ID')}</p>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full font-bold ${
                    payment?.verification_status === 'Valid' ? 'bg-emerald-100 text-emerald-800'
                    : payment?.verification_status === 'Perlu Revisi' ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-800'}`}>
                    {payment?.verification_status === 'Valid' ? 'Valid' : payment?.verification_status === 'Perlu Revisi' ? 'Tidak sesuai' : payment?.proof_file ? 'Menunggu verifikasi' : 'Belum dibayar'}
                  </span>
                </div>
                <div className="space-y-1 bg-white rounded-lg border border-slate-200 p-3">
                  <p><span className="text-slate-500">Bank pengirim:</span> {payment?.sender_bank || '-'}</p>
                  <p><span className="text-slate-500">Nama rekening:</span> {payment?.sender_account_name || '-'}</p>
                  <p><span className="text-slate-500">No. rekening:</span> {payment?.sender_account_number || '-'}</p>
                  <p><span className="text-slate-500">Tanggal transfer:</span> {payment?.transfer_date || '-'}</p>
                </div>
                <div className="space-y-1 text-[11px] text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <Eye className="w-3 h-3" /> {paymentOpenInfo ? `Bukti dibuka ${formatTime(paymentOpenInfo.at)}${paymentOpenInfo.by ? ` · ${paymentOpenInfo.by}` : ''}` : 'Bukti transfer belum dibuka Admin'}
                  </p>
                  {payment?.verified_at && payment?.verification_status !== 'Menunggu' && (
                    <p className={`flex items-center gap-1.5 ${payment.verification_status === 'Valid' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {payment.verification_status === 'Valid' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {payment.verification_status === 'Valid' ? 'Valid' : 'Tidak sesuai'} · {formatTime(payment.verified_at)}{payment.verified_by_name ? ` · ${payment.verified_by_name}` : ''}
                    </p>
                  )}
                </div>
                {payment?.verification_notes && (
                  <p className={`rounded-lg p-2.5 ${payment.verification_status === 'Perlu Revisi' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
                    Catatan: {payment.verification_notes}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex-1 border-b border-slate-200">
                  {paymentFile && opened.has('payment') ? (
                    <FilePreview file={paymentFile} />
                  ) : (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <CreditCard className="w-10 h-10 text-slate-300" />
                      {paymentFile ? (
                        <button onClick={openPayment} className="px-4 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5">
                          <Eye className="w-4 h-4" /> Buka bukti transfer
                        </button>
                      ) : (
                        <p className="text-xs text-slate-400">Pemohon belum mengunggah bukti transfer.</p>
                      )}
                    </div>
                  )}
                </div>
                {canVerifyPayment && (
                  <div className="p-4 bg-slate-50 space-y-2">
                    {!opened.has('payment') && !paymentOpenInfo ? (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Buka bukti transfer dulu untuk memverifikasi.</p>
                    ) : payReject ? (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {PAYMENT_REASONS.map((r) => (
                            <button key={r} type="button" onClick={() => setPayComment((c) => (c.includes(r) ? c : c ? `${c}; ${r}` : r))}
                              className="px-2.5 py-1 rounded-full text-[11px] border border-red-200 bg-white text-red-700 hover:bg-red-50">{r}</button>
                          ))}
                        </div>
                        <textarea rows="2" value={payComment} onChange={(e) => setPayComment(e.target.value)} placeholder="Alasan bukti transfer tidak sesuai"
                          className="w-full text-xs p-2.5 border border-red-200 rounded-lg" />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setPayReject(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white">Batal</button>
                          <button disabled={busy} onClick={() => run(async () => {
                            if (!payComment.trim()) throw new Error('Tulis alasan bukti transfer tidak sesuai.');
                            await onVerifyPayment(submission.id, 'Perlu Revisi', payComment.trim());
                          })} className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white">Kembalikan ke pemohon</button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => setPayReject(true)} className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-red-200 bg-white text-red-700 flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" /> Tidak sesuai
                        </button>
                        <button disabled={busy} onClick={() => run(() => onVerifyPayment(submission.id, 'Valid', 'Pembayaran sesuai dengan mutasi rekening.'))}
                          className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" /> Valid · teruskan ke Sekretaris
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── BERKAS FISIK ── */}
          {activeTab === 'physical' && (
            <div className="p-5 sm:p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  ['Disetujui Ketua', submission.approved_at, true],
                  ['Dikirim pemohon', submission.physical_sent_at, ['Dikirim', 'Diterima'].includes(submission.physical_status)],
                  ['Diterima sekretariat', submission.physical_received_at, submission.physical_status === 'Diterima'],
                  ['Dikirim ke Pusat', submission.sent_to_central_at, Boolean(submission.sent_to_central_at)],
                  ['No. KTA terbit', submission.activated_at, status === 'Aktif'],
                ].map(([label, at, done]) => (
                  <div key={label} className={`rounded-xl border p-3 ${done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                    <p className={`text-xs font-semibold flex items-center gap-1.5 ${done ? 'text-emerald-800' : 'text-slate-500'}`}>
                      {done ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />} {label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{at || '—'}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 p-4 space-y-1 text-xs">
                <p><span className="text-slate-500">Dikirim lewat:</span> {submission.physical_courier || '-'}</p>
                <p><span className="text-slate-500">No. resi:</span> <span className="font-mono">{submission.physical_tracking_no || '-'}</span></p>
                <p><span className="text-slate-500">Catatan pemohon:</span> {submission.physical_notes || '-'}</p>
                {submission.physical_received_by && <p><span className="text-slate-500">Dikonfirmasi oleh:</span> {submission.physical_received_by}</p>}
              </div>
              {submission.sent_to_central_at && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-1 text-xs">
                  <p className="font-semibold text-slate-700">Pengiriman ke IKAPI Pusat</p>
                  <p><span className="text-slate-500">Dikirim lewat:</span> {submission.central_courier || '-'}</p>
                  <p><span className="text-slate-500">No. resi:</span> <span className="font-mono">{submission.central_tracking_no || '-'}</span></p>
                  {submission.central_notes && <p><span className="text-slate-500">Catatan:</span> {submission.central_notes}</p>}
                  {submission.central_sent_by && <p><span className="text-slate-500">Dicatat oleh:</span> {submission.central_sent_by}</p>}
                  <p><span className="text-slate-500">No. KTA:</span> <span className="font-mono">{submission.member_kta || 'Menunggu dari Pusat · diinput Sekretaris'}</span></p>
                </div>
              )}
              {awaitingShipment && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Pemohon belum menandai berkas fisik sudah dikirim. Konfirmasi penerimaan terbuka setelah pemohon mengirim berkas.
                </p>
              )}
              {canReceive && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="text-xs text-emerald-900">
                    Cek berkas fisik yang diterima sesuai data pengiriman di atas, lalu konfirmasi. Langkah berikutnya: kirim paket ke IKAPI Pusat.
                  </p>
                  <textarea rows="2" value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Catatan penerimaan (opsional)"
                    className="w-full text-xs p-2.5 border border-emerald-200 rounded-lg bg-white" />
                  <div className="flex justify-end">
                    <button disabled={busy} onClick={() => run(() => onReceivePhysical(submission.id, generalNotes))}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Konfirmasi berkas diterima
                    </button>
                  </div>
                </div>
              )}
              {canSendCentral && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-2">
                  <p className="text-xs text-sky-900">
                    Kirim paket berkas (surat pengantar, formulir, dan berkas persyaratan) ke IKAPI Pusat, lalu catat pengirimannya di sini.
                    Status berubah menjadi <strong>Menunggu KTA dari Pusat</strong>; Sekretaris menginput No. KTA setelah terbit.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={central.courier} onChange={(e) => setCentral((c) => ({ ...c, courier: e.target.value }))}
                      placeholder="Jasa pengiriman (wajib), mis. JNE / diantar langsung" className="text-xs p-2.5 border border-sky-200 rounded-lg bg-white" />
                    <input value={central.trackingNo} onChange={(e) => setCentral((c) => ({ ...c, trackingNo: e.target.value }))}
                      placeholder="No. resi (opsional)" className="text-xs p-2.5 border border-sky-200 rounded-lg bg-white font-mono" />
                  </div>
                  <textarea rows="2" value={central.notes} onChange={(e) => setCentral((c) => ({ ...c, notes: e.target.value }))}
                    placeholder="Catatan (opsional)" className="w-full text-xs p-2.5 border border-sky-200 rounded-lg bg-white" />
                  <div className="flex justify-end">
                    <button disabled={busy || !central.courier.trim()} onClick={() => run(() => onSendCentral(submission.id, central))}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-[#0da2e7] hover:bg-[#0884c4] disabled:opacity-60 text-white flex items-center gap-1.5">
                      <Send className="w-4 h-4" /> Tandai dikirim ke IKAPI Pusat
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── RIWAYAT ── */}
          {activeTab === 'history' && (
            <div className="p-4 sm:p-6">
              <SubmissionTimeline timeline={timeline} cardClassName="rounded-xl border border-slate-200" defaultOpen />
            </div>
          )}
        </div>

        {/* Footer: keputusan tahap */}
        {(canScreenDocs || canSign) && (
          <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            {canScreenDocs && (
              <>
                <div className="text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1 sm:mr-auto">
                  <span className="text-emerald-700 font-semibold">{okCount} sesuai</span>
                  <span className="text-red-700 font-semibold">{badCount} tidak sesuai</span>
                  <span>{pendingCount} belum diperiksa</span>
                </div>
                {badCount > 0 ? (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
                    <input value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Catatan umum untuk pemohon (opsional)"
                      className="text-xs px-3 py-2 border border-slate-200 rounded-lg sm:w-64" />
                    <button disabled={busy || badCount === 0}
                      onClick={() => run(async () => { await onAdmin1Action(submission.id, 'request_revision', generalNotes); onClose(); })}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-1.5">
                      <Send className="w-4 h-4" /> Kirim permintaan revisi ({badCount} dokumen)
                    </button>
                  </div>
                ) : (
                  <button disabled={busy || !allOk || !docsOpened}
                    onClick={() => run(async () => { await onAdmin1Action(submission.id, 'approve_documents', generalNotes); onClose(); })}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-[#0da2e7] hover:bg-[#0884c4] text-white disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Setujui semua dokumen · lanjut ke pembayaran
                  </button>
                )}
              </>
            )}
            {canSign && !rejectingSub && (
              <>
                <p className="text-xs text-slate-600 sm:mr-auto">
                  Keputusan Sekretaris: periksa semua dokumen & bukti transfer, lalu setujui sekaligus (bukan per dokumen).
                </p>
                {onRejectSecretary && (
                  <button onClick={() => setRejectingSub(true)}
                    className="px-4 py-2 text-xs font-bold rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 flex items-center justify-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Tolak pengajuan
                  </button>
                )}
                <button onClick={onSignSecretary}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5">
                  <PenTool className="w-4 h-4" /> Setujui, tanda tangani & teruskan ke Ketua
                </button>
              </>
            )}
            {canSign && rejectingSub && (
              <div className="w-full flex flex-col sm:flex-row gap-2 sm:items-center">
                <input autoFocus value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Alasan penolakan (wajib, terlihat oleh pemohon)"
                  className="flex-1 text-xs px-3 py-2 border border-red-200 rounded-lg" />
                <button onClick={() => setRejectingSub(false)} className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200">Batal</button>
                <button disabled={busy} onClick={() => run(async () => {
                  if (!generalNotes.trim()) throw new Error('Tulis alasan penolakan.');
                  await onRejectSecretary(submission.id, generalNotes.trim());
                  onClose();
                })} className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white">Tolak pengajuan</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
