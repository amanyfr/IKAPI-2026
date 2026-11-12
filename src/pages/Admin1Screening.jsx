import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import DocumentVerificationModal from '../components/DocumentVerificationModal';
import CentralPacketExporter from '../components/CentralPacketExporter';
import ModalFrame from '../components/ModalFrame';
import { useMySignature, MySignatureCard, SignLetterModal } from '../components/LetterSigning';
import { exportMembersExcel } from '../utils/exportMembers';
import { STATUS_LABEL, POST_APPROVAL_STATUSES } from '../components/StatusStepper';
import {
  ShieldCheck,
  Search,
  Filter,
  FileText,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  Download,
  Users,
  PenTool,
  BadgeCheck,
  XCircle,
  X
} from 'lucide-react';
import { fileUrl } from '../utils/fileUrl';
import HeregRequestsPanel from '../components/HeregRequestsPanel';
import { notify } from '../components/AppDialog';

export default function Admin1Screening({ onNavigateToMembers, initialStatus = 'Semua', initialSearch = '', openSubmissionId = null, onDetailClosed }) {
  // Dibuka dari kartu Dashboard: hanya tampilkan detail satu pengajuan, tanpa halaman daftar
  const detailOnly = Boolean(openSubmissionId);
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (bisa diisi awal dari Dashboard)
  const [filterStatus, setFilterStatus] = useState(initialStatus);
  const [filterType, setFilterType] = useState('Semua');
  const [filterCategory, setFilterCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Selected for Verification Modal
  const [selectedSubDetail, setSelectedSubDetail] = useState(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  // Selected for Packet Preview Modal
  const [packetSubDetail, setPacketSubDetail] = useState(null);
  const [isPacketModalOpen, setIsPacketModalOpen] = useState(false);

  // TTD tersimpan Sekretaris, dibubuhkan saat meneruskan pengajuan ke Ketua
  const isSekretaris = user?.role === 'Sekretaris';
  // Screening utama dilakukan Admin; Sekretaris boleh ikut screening (opsional) lalu cukup membubuhkan TTD
  const isAdmin = user?.role === 'Admin';
  const mySignature = useMySignature(isSekretaris);
  const [passing, setPassing] = useState(null); // { submission, settings, notes }
  const [processingPass, setProcessingPass] = useState(false);

  // Verifikasi data KTA yang diisi pemohon (setujui → anggota aktif, tolak → wajib keterangan)
  const [ktaReview, setKtaReview] = useState(null); // submission
  const [ktaRejectMode, setKtaRejectMode] = useState(false);
  const [ktaRejectNote, setKtaRejectNote] = useState('');
  const [ktaSaving, setKtaSaving] = useState(false);

  const openKtaReview = (sub) => {
    setKtaReview(sub);
    setKtaRejectMode(false);
    setKtaRejectNote('');
  };

  const submitKtaReview = async (decision) => {
    if (!ktaReview) return;
    const note = ktaRejectNote.trim();
    if (decision === 'reject' && !note) {
      notify('Tulis keterangan penolakan supaya pemohon tahu apa yang harus diperbaiki.');
      return;
    }
    setKtaSaving(true);
    try {
      const res = await fetch(`/api/submissions/${ktaReview.id}/kta-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` },
        body: JSON.stringify({ decision, note: decision === 'reject' ? note : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan verifikasi KTA.');
      setKtaReview(null);
      notify(data.message || (decision === 'approve' ? 'KTA disetujui.' : 'KTA ditolak.'));
      fetchSubmissions();
    } catch (err) {
      notify(err.message);
    } finally {
      setKtaSaving(false);
    }
  };

  // Spinner hanya saat pemuatan pertama; muat ulang sesudahnya senyap agar tabel tidak berkedip
  const loadedOnce = useRef(false);
  const fetchSubmissions = async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filterStatus !== 'Semua') queryParams.append('status', filterStatus);
      if (filterType !== 'Semua') queryParams.append('type', filterType);
      if (filterCategory !== 'Semua') queryParams.append('category', filterCategory);
      if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());

      const res = await fetch(`/api/submissions?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` }
      });
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!detailOnly) fetchSubmissions();
  }, [filterStatus, filterType, filterCategory]);

  useEffect(() => {
    if (openSubmissionId) openVerificationModal(openSubmissionId);
  }, [openSubmissionId]);

  const closeVerifyModal = () => {
    setIsVerifyModalOpen(false);
    if (detailOnly) onDetailClosed?.();
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSubmissions();
  };

  // Open verification modal
  const openVerificationModal = async (subId) => {
    try {
      const res = await fetch(`/api/submissions/${subId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` }
      });
      const data = await res.json();
      setSelectedSubDetail(data);
      setIsVerifyModalOpen(true);
    } catch (err) {
      notify('Gagal mengambil data pengajuan: ' + err.message);
    }
  };

  // Open packet modal
  const openPacketModal = async (subId) => {
    try {
      const res = await fetch(`/api/submissions/${subId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` }
      });
      const data = await res.json();
      setPacketSubDetail(data);
      setIsPacketModalOpen(true);
    } catch (err) {
      notify('Gagal mengambil data pengajuan: ' + err.message);
    }
  };

  // Screen document
  const handleScreenDoc = async (docId, status, revisionNotes, revisionMarks = []) => {
    const res = await fetch(`/api/documents/${docId}/screen`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
      },
      body: JSON.stringify({ status, revisionNotes, revisionMarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Refresh detail
    if (selectedSubDetail) {
      openVerificationModal(selectedSubDetail.submission.id);
    }
    fetchSubmissions();
  };

  // Verify payment
  const handleVerifyPayment = async (submissionId, status, notes) => {
    const res = await fetch(`/api/submissions/${submissionId}/payment/verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
      },
      body: JSON.stringify({ status, notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    notify(data.message);
    if (selectedSubDetail) {
      openVerificationModal(selectedSubDetail.submission.id);
    }
    fetchSubmissions();
  };

  // Sekretaris: keputusan akhir menolak pengajuan (bukan per dokumen)
  const handleRejectSecretary = async (submissionId, reason) => {
    const res = await fetch(`/api/submissions/${submissionId}/admin2-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` },
      body: JSON.stringify({ action: 'reject', reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    notify('Pengajuan ditolak. Pemohon dapat melihat alasan penolakan di dashboard.');
    fetchSubmissions();
  };

  // Sekretaris action (request_revision / pass_to_admin2 / update_kta)
  const handleAdmin1Action = async (submissionId, action, notes, extra = {}) => {
    const res = await fetch(`/api/submissions/${submissionId}/admin1-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
      },
      body: JSON.stringify({ action, notes, ...extra })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    notify(data.message);
    fetchSubmissions();
  };

  // Sekretaris: tanda tangani pengajuan yang dokumen & pembayarannya sudah disetujui Admin
  // fromDetail: dibuka dari modal detail pengajuan; Batal kembali ke detail itu (bukan halaman kosong)
  const startSignScreened = (sub, settings = {}, fromDetail = false) => {
    setPassing({ submission: sub, settings, notes: '', fromDetail });
    setIsVerifyModalOpen(false);
  };

  const cancelSign = () => {
    const backToDetail = passing?.fromDetail && selectedSubDetail;
    setPassing(null);
    if (backToDetail) setIsVerifyModalOpen(true);
    else if (detailOnly) onDetailClosed?.();
  };

  const confirmPassToKetua = async (signaturePositions) => {
    setProcessingPass(true);
    try {
      await handleAdmin1Action(passing.submission.id, 'pass_to_admin2', passing.notes, { signaturePositions });
      setPassing(null);
      // Dibuka dari kartu Dashboard: kembali ke Dashboard (segarkan) agar kartu bisa diklik lagi
      if (detailOnly) onDetailClosed?.();
    } catch (err) {
      notify('Gagal meneruskan: ' + err.message);
    } finally {
      setProcessingPass(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportMembersExcel();
    } catch (err) {
      notify('Ekspor Excel gagal: ' + err.message);
    }
  };

  const statusChipClass = (status) =>
    status === 'Aktif'             ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    : status === 'Pengiriman Berkas' ? 'bg-orange-100 text-orange-800 border border-orange-200'
    : status === 'Berkas Diterima' || status === 'Dikirim ke Pusat' ? 'bg-violet-100 text-violet-800 border border-violet-200'
    : status === 'Menunggu Approval' || status === 'Menunggu TTD Sekretaris' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
    : status === 'Perlu Revisi'      ? 'bg-amber-100 text-amber-800 border border-amber-200'
    : status === 'Ditolak'           ? 'bg-red-100 text-red-800 border border-red-200'
    : status === 'Menunggu Verifikasi' ? 'bg-sky-100 text-[#0884c4] border border-sky-200'
    : 'bg-slate-100 text-slate-700 border border-slate-200';

  // Tombol utama sesuai tugas peran pada tahap ini
  const primaryLabel = (sub) => {
    if (isAdmin && sub.status === 'Menunggu Verifikasi') return Number(sub.revision_round) > 0 ? `Screening revisi ke-${sub.revision_round}` : 'Screening dokumen';
    if (isAdmin && sub.status === 'Perlu Revisi' && Number(sub.fresh_revision_count) > 0) return 'Screening revisi';
    if (isAdmin && sub.status === 'Menunggu Pembayaran' && sub.payment_status === 'Menunggu' && sub.payment_proof) return 'Verifikasi bayar';
    return null;
  };

  // Tombol aksi per pengajuan — dipakai di tabel (layar lebar) dan kartu (HP)
  const renderActions = (sub) => {
    const isApproved = POST_APPROVAL_STATUSES.includes(sub.status);
    const readyToSign = isSekretaris && sub.status === 'Menunggu TTD Sekretaris';
    const primary = primaryLabel(sub);
    return (
      <>
        {/* Dokumen & pembayaran disetujui Admin: Sekretaris tanda tangan */}
        {readyToSign && (
          <button
            onClick={() => startSignScreened(sub)}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-transparent rounded-lg text-xs font-semibold shadow-sm whitespace-nowrap transition inline-flex items-center gap-1"
            title="Bubuhkan TTD Sekretaris & teruskan ke Ketua"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Tanda tangani</span>
          </button>
        )}

        {/* Pemohon sudah mengisi data KTA: Admin cek lalu setujui / tolak */}
        {isAdmin && sub.status === 'Dikirim ke Pusat' && sub.kta_review_status === 'Menunggu' && (
          <button
            onClick={() => openKtaReview(sub)}
            className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white border border-transparent rounded-lg text-xs font-semibold shadow-sm whitespace-nowrap transition inline-flex items-center gap-1"
            title="Cek data KTA dari pemohon, lalu setujui atau tolak"
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>Verifikasi KTA</span>
          </button>
        )}

        {/* Semua peran bisa membuka dokumen, bukti transfer & riwayat; aksi hanya untuk peran yang bertugas */}
        <button
          onClick={() => openVerificationModal(sub.id)}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition inline-flex items-center gap-1 ${
            primary
              ? 'bg-[#0da2e7] hover:bg-[#0884c4] text-white border-transparent shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
          title="Dokumen, pembayaran & riwayat alur berkas"
        >
          <ShieldCheck className={`w-3.5 h-3.5 ${primary ? 'text-amber-300' : 'text-slate-400'}`} />
          <span>{primary || 'Lihat'}</span>
        </button>

        {/* Packet Button if Approved */}
        {isApproved && (
          <button
            onClick={() => openPacketModal(sub.id)}
            className="px-2.5 py-1.5 bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc] rounded-lg text-xs font-semibold whitespace-nowrap transition inline-flex items-center gap-1"
            title="Lihat Paket Dokumen"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Dokumen resmi</span>
          </button>
        )}

      </>
    );
  };

  return (
    <div className="space-y-6">
      {!detailOnly && (<>

      {/* Header Banner */}
      <div className="card-surface p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#0da2e7] rounded-xl text-white">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-light tracking-tight text-slate-900">
              {isAdmin ? 'Screening Dokumen, Pembayaran & KTA' : 'Pengajuan & Tanda Tangan Sekretaris'}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onNavigateToMembers && (
            <button
              onClick={onNavigateToMembers}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
            >
              <Users className="w-4 h-4 text-[#0884c4]" /> Kelola Data Anggota
            </button>
          )}

          {!isAdmin && <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Ekspor Excel
          </button>}
        </div>
      </div>

      {/* Anggota lama menunggu verifikasi KTA lama (sebelum boleh mengisi formulir) */}
      {isAdmin && <HeregRequestsPanel />}

      {/* Tanda tangan tersimpan Sekretaris */}
      {isSekretaris && (
        <MySignatureCard
          roleLabel="Sekretaris"
          signature={mySignature.signature}
          saving={mySignature.saving}
          onSave={mySignature.save}
          loading={!mySignature.loaded}
        />
      )}

      {/* Filter & Search Bar */}
      <div className="panel-surface p-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari penerbit, nama pimpinan, kota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full text-xs py-2 px-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
            >
              <option value="Semua">Semua Status</option>
              {['Draf', 'Menunggu Verifikasi', 'Perlu Revisi', 'Menunggu Pembayaran', 'Menunggu TTD Sekretaris', 'Menunggu Approval', 'Pengiriman Berkas', 'Dikirim ke Pusat', 'Aktif', 'Ditolak'].map((st) => (
                <option key={st} value={st}>{STATUS_LABEL[st]}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full text-xs py-2 px-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
            >
              <option value="Semua">Semua Jenis</option>
              <option value="Baru">Anggota Baru</option>
              <option value="Heregistrasi">Heregistrasi</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 text-xs py-2 px-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7]"
            >
              <option value="Semua">Semua Kategori</option>
              <option value="Biasa">Anggota Biasa</option>
              <option value="Luar Biasa">Anggota Luar Biasa</option>
            </select>

            <button
              type="button"
              onClick={fetchSubmissions}
              className="p-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

        </form>
      </div>

      {/* Submissions Table */}
      <div className="card-surface overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-700">
            Daftar Pengajuan ({submissions.length})
          </span>
        </div>

        {/* ── HP: daftar kartu ── */}
        <div className="md:hidden divide-y divide-slate-100 bg-white">
          {loading ? (
            <p className="py-8 text-center text-xs text-slate-400">Memuat data pengajuan...</p>
          ) : submissions.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">Tidak ada pengajuan yang sesuai dengan filter.</p>
          ) : (
            submissions.map((sub) => (
              <div key={sub.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-blue-950 text-sm">{sub.publisher_name}</div>
                    <div className="text-[11px] text-slate-500">Pimpinan: {sub.leader_name}</div>
                  </div>
                  <span className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="flex flex-wrap items-center justify-end gap-1">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${statusChipClass(sub.status)}`}>
                        {STATUS_LABEL[sub.status] || sub.status}
                      </span>
                      {sub.status === 'Menunggu Verifikasi' && Number(sub.revision_round) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-400 text-amber-950">
                          <RefreshCw className="w-3 h-3" /> Pengajuan Revisi ke-{sub.revision_round}
                        </span>
                      )}
                      {sub.status === 'Perlu Revisi' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Ke-{Math.max(Number(sub.revision_round) || 0, 1)}
                        </span>
                      )}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <div className="text-slate-400">Kategori / Jenis</div>
                    <div className="font-semibold text-slate-700">{sub.member_category || 'Biasa'} · {sub.submission_type}</div>
                    <div className="text-slate-500">{sub.city || '-'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <div className="text-slate-400">Pembayaran</div>
                    <div className="font-semibold text-slate-900">
                      Rp {sub.payment_amount ? sub.payment_amount.toLocaleString('id-ID') : '-'}
                    </div>
                    <div className={`font-bold ${sub.payment_status === 'Valid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {sub.payment_status === 'Valid' ? 'Valid' : sub.payment_status === 'Perlu Revisi' ? 'Tidak sesuai' : sub.status === 'Menunggu Pembayaran' && sub.payment_status === 'Menunggu' && sub.payment_proof ? 'Perlu dicek' : 'Belum dibayar'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">{renderActions(sub)}</div>
              </div>
            ))
          )}
        </div>

        {/* ── Layar lebar: tabel ── */}
        <div className="hidden md:block overflow-x-auto bg-white">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Nama Penerbit & Pimpinan</th>
                <th className="py-3 px-4">Kategori / Jenis</th>
                <th className="py-3 px-4">Kota</th>
                <th className="py-3 px-4">Status Pengajuan</th>
                <th className="py-3 px-4">Pembayaran</th>
                <th className="py-3 px-4 text-center">Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Memuat data pengajuan...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Tidak ada pengajuan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                submissions.map((sub, idx) => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-blue-950 text-sm">
                        {sub.publisher_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Pimpinan: {sub.leader_name}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${sub.member_category === 'Luar Biasa'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                        }`}>
                        {sub.member_category || 'Biasa'}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        {sub.submission_type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      {sub.city || '-'}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${statusChipClass(sub.status)}`}>
                          {STATUS_LABEL[sub.status] || sub.status}
                        </span>
                        {sub.status === 'Menunggu Verifikasi' && Number(sub.revision_round) > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-400 text-amber-950">
                            <RefreshCw className="w-3 h-3" /> Pengajuan Revisi ke-{sub.revision_round}
                          </span>
                        )}
                        {sub.status === 'Perlu Revisi' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Ke-{Math.max(Number(sub.revision_round) || 0, 1)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 whitespace-nowrap">
                        Rp {sub.payment_amount ? sub.payment_amount.toLocaleString('id-ID') : '-'}
                      </div>
                      <span className={`text-[10px] font-bold ${sub.payment_status === 'Valid' ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                        {sub.payment_status === 'Valid' ? 'Valid' : sub.payment_status === 'Perlu Revisi' ? 'Tidak sesuai' : sub.status === 'Menunggu Pembayaran' && sub.payment_status === 'Menunggu' && sub.payment_proof ? 'Perlu dicek' : 'Belum dibayar'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {renderActions(sub)}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      </>)}

      {/* MODAL 1: VERIFIKASI BERKAS & PEMBAYARAN */}
      {isVerifyModalOpen && selectedSubDetail && (
        <DocumentVerificationModal
          isOpen={isVerifyModalOpen}
          onClose={closeVerifyModal}
          submission={selectedSubDetail.submission}
          documents={selectedSubDetail.documents}
          payment={selectedSubDetail.payment}
          timeline={selectedSubDetail.timeline}
          role={user?.role}
          onScreenDocument={handleScreenDoc}
          onVerifyPayment={handleVerifyPayment}
          onAdmin1Action={handleAdmin1Action}
          onSignSecretary={() => startSignScreened(selectedSubDetail.submission, selectedSubDetail.settings, true)}
          onRejectSecretary={isSekretaris ? handleRejectSecretary : undefined}
        />
      )}

      {/* Pembubuhan TTD Sekretaris sebelum diteruskan ke Ketua */}
      {passing && (
        <SignLetterModal
          role="secretary"
          submission={{ ...passing.submission, reference_number: passing.submission.reference_number || 'Otomatis saat diteruskan' }}
          settings={passing.settings}
          signature={mySignature.signature}
          savingSignature={mySignature.saving}
          onSaveSignature={mySignature.save}
          title="Bubuhkan tanda tangan Sekretaris pada dokumen pengajuan"
          subtitle={`${passing.submission.publisher_name} • diteruskan ke Ketua setelah ditandatangani`}
          confirmLabel="Bubuhkan TTD (4 dokumen) & Teruskan"
          processing={processingPass}
          onConfirm={confirmPassToKetua}
          onClose={cancelSign}
        />
      )}

      {/* MODAL 2: DOKUMEN RESMI */}
      {isPacketModalOpen && packetSubDetail && (
        <ModalFrame onClose={() => setIsPacketModalOpen(false)}>
          <CentralPacketExporter
            submission={packetSubDetail.submission}
            documents={packetSubDetail.documents}
            settings={packetSubDetail.settings}
            payment={packetSubDetail.payment}
          />
        </ModalFrame>
      )}

      {/* MODAL 3: VERIFIKASI DATA KTA */}
      {ktaReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !ktaSaving && setKtaReview(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">Verifikasi KTA</p>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">{ktaReview.publisher_name || `Pengajuan #${ktaReview.id}`}</h3>
                <p className="text-[11px] text-slate-500">Cocokkan dengan KTA dari IKAPI Pusat sebelum menyetujui.</p>
              </div>
              <button type="button" onClick={() => setKtaReview(null)} disabled={ktaSaving} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Tutup">
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="px-5 py-4 space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Nomor KTA</dt>
                <dd className="font-mono font-bold text-slate-800 text-right">{ktaReview.kta_number_submitted || '-'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Tanggal terbit</dt>
                <dd className="font-medium text-slate-800 text-right">
                  {ktaReview.kta_issued_at ? new Date(ktaReview.kta_issued_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Bukti KTA</dt>
                <dd className="text-right min-w-0">
                  {ktaReview.kta_proof_file ? (
                    <a href={fileUrl(ktaReview.kta_proof_file)} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline truncate inline-block max-w-[14rem] align-bottom">
                      {ktaReview.kta_proof_name || 'Lihat file'}
                    </a>
                  ) : <span className="text-slate-400">Tidak dilampirkan</span>}
                </dd>
              </div>
              {ktaReview.kta_notes && (
                <div className="pt-1">
                  <dt className="text-slate-500">Catatan pemohon</dt>
                  <dd className="mt-1 p-2 rounded-lg bg-slate-50 text-slate-700 whitespace-pre-wrap">{ktaReview.kta_notes}</dd>
                </div>
              )}
            </dl>

            {ktaRejectMode && (
              <div className="px-5 pb-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Keterangan penolakan <span className="text-red-500">*</span></label>
                <textarea
                  value={ktaRejectNote}
                  onChange={(e) => setKtaRejectNote(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Contoh: Nomor KTA tidak sesuai dengan bukti yang dilampirkan."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-red-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">Keterangan ini dikirim ke pemohon untuk diperbaiki.</p>
              </div>
            )}

            <div className="flex justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-100">
              {ktaRejectMode ? (
                <>
                  <button type="button" onClick={() => setKtaRejectMode(false)} disabled={ktaSaving} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
                  <button type="button" onClick={() => submitKtaReview('reject')} disabled={ktaSaving || !ktaRejectNote.trim()} className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {ktaSaving ? 'Menyimpan...' : 'Kirim penolakan'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setKtaRejectMode(true)} disabled={ktaSaving} className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Tolak
                  </button>
                  <button type="button" onClick={() => submitKtaReview('approve')} disabled={ktaSaving} className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {ktaSaving ? 'Menyimpan...' : 'Setujui · aktifkan anggota'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

