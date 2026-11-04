import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import DocumentVerificationModal from '../components/DocumentVerificationModal';
import CentralPacketExporter from '../components/CentralPacketExporter';
import { useMySignature, MySignatureCard, SignLetterModal } from '../components/LetterSigning';
import { exportMembersExcel } from '../utils/exportMembers';
import {
  ShieldCheck,
  Search,
  Filter,
  FileText,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Send,
  BadgeCheck,
  Eye,
  RefreshCw,
  KeyRound,
  Download,
  Users
} from 'lucide-react';

export default function Admin1Screening({ onNavigateToMembers, initialStatus = 'Semua', initialSearch = '' }) {
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

  // Modal for Input No KTA (Aktifkan Anggota)
  const [ktaModalSub, setKtaModalSub] = useState(null);
  const [ktaInput, setKtaInput] = useState('');
  const [submittingKta, setSubmittingKta] = useState(false);

  // TTD tersimpan Sekretaris, dibubuhkan saat meneruskan pengajuan ke Ketua
  const isSekretaris = user?.role === 'Sekretaris';
  const mySignature = useMySignature(isSekretaris);
  const [passing, setPassing] = useState(null); // { submission, settings, notes }
  const [processingPass, setProcessingPass] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [filterStatus, filterType, filterCategory]);

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
      alert('Gagal mengambil data pengajuan: ' + err.message);
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
      alert('Gagal mengambil data pengajuan: ' + err.message);
    }
  };

  // Screen document
  const handleScreenDoc = async (docId, status, revisionNotes) => {
    const res = await fetch(`/api/documents/${docId}/screen`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
      },
      body: JSON.stringify({ status, revisionNotes })
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

    alert(`Status pembayaran berhasil diperbarui: ${status}`);
    if (selectedSubDetail) {
      openVerificationModal(selectedSubDetail.submission.id);
    }
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

    alert(data.message);
    fetchSubmissions();
  };

  // "Loloskan & Teruskan ke Ketua": Sekretaris membubuhkan TTD-nya pada pratinjau surat dulu
  const startPassToKetua = (notes) => {
    setPassing({ submission: selectedSubDetail.submission, settings: selectedSubDetail.settings, notes });
    setIsVerifyModalOpen(false);
  };

  const confirmPassToKetua = async (signaturePositions) => {
    setProcessingPass(true);
    try {
      await handleAdmin1Action(passing.submission.id, 'pass_to_admin2', passing.notes, { signaturePositions });
      setPassing(null);
    } catch (err) {
      alert('Gagal meneruskan: ' + err.message);
    } finally {
      setProcessingPass(false);
    }
  };

  // Handle Send Packet to IKAPI Pusat (PRD Section 3 & 4: Status Disetujui -> Aksi oleh Sekretaris: kirim)
  const handleSendToCentral = async (submissionId) => {
    try {
      const res = await fetch(`/api/submissions/${submissionId}/admin2-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
        },
        body: JSON.stringify({ action: 'send_to_central' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message);
      fetchSubmissions();
    } catch (err) {
      alert('Gagal menandai dikirim ke Pusat: ' + err.message);
    }
  };

  // Handle Input No. KTA from Pusat
  const handleSaveKta = async () => {
    if (!ktaInput.trim()) {
      alert('Nomor KTA dari Pusat wajib diisi.');
      return;
    }
    setSubmittingKta(true);
    try {
      const res = await fetch(`/api/submissions/${ktaModalSub.id}/admin1-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
        },
        body: JSON.stringify({
          action: 'update_kta',
          ktaNumber: ktaInput.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message);
      setKtaModalSub(null);
      setKtaInput('');
      fetchSubmissions();
    } catch (err) {
      alert('Gagal mengaktifkan KTA: ' + err.message);
    } finally {
      setSubmittingKta(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportMembersExcel();
    } catch (err) {
      alert('Ekspor Excel gagal: ' + err.message);
    }
  };

  const statusChipClass = (status) =>
    status === 'Aktif'             ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    : status === 'Disetujui'         ? 'bg-blue-100 text-blue-800 border border-blue-200'
    : status === 'Menunggu Approval' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
    : status === 'Dikirim ke Pusat'  ? 'bg-purple-100 text-purple-800 border border-purple-200'
    : status === 'Perlu Revisi'      ? 'bg-amber-100 text-amber-800 border border-amber-200'
    : status === 'Ditolak'           ? 'bg-red-100 text-red-800 border border-red-200'
    : 'bg-slate-100 text-slate-700 border border-slate-200';

  // Tombol aksi per pengajuan — dipakai di tabel (layar lebar) dan kartu (HP)
  const renderActions = (sub) => {
    const isReadyForKta = sub.status === 'Dikirim ke Pusat';
    const isApproved = ['Disetujui', 'Dikirim ke Pusat', 'Aktif'].includes(sub.status);
    return (
      <>
        {/* Screening Button */}
        <button
          onClick={() => openVerificationModal(sub.id)}
          className="px-2.5 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1"
          title="Screening Berkas & Verifikasi Pembayaran"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Screening</span>
        </button>

        {/* Packet Button if Approved */}
        {isApproved && (
          <button
            onClick={() => openPacketModal(sub.id)}
            className="px-2.5 py-1.5 bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc] rounded-lg text-xs font-bold transition flex items-center gap-1"
            title="Lihat Paket 3 Dokumen ke Pusat"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paket PDF</span>
          </button>
        )}

        {/* Send to Central Button if Disetujui (PRD Hal. 4: Disetujui -> Aksi oleh Sekretaris: kirim) */}
        {sub.status === 'Disetujui' && (
          <button
            onClick={() => handleSendToCentral(sub.id)}
            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1"
            title="Tandai Paket Telah Dikirim ke IKAPI Pusat"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim ke Pusat</span>
          </button>
        )}

        {/* Input KTA Button if sent to central */}
        {isReadyForKta && (
          <button
            onClick={() => { setKtaModalSub(sub); setKtaInput(''); }}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1"
            title="Input No. KTA dari Pusat & Aktifkan"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Input KTA</span>
          </button>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="card-surface p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#0da2e7] rounded-xl text-white">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-light tracking-tight text-slate-900">
              Screening & Verifikasi Berkas (Sekretaris)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemeriksaan kesesuaian berkas hukum, verifikasi bukti transfer, dan penerusan pengajuan ke Ketua.
            </p>
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

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Ekspor Excel
          </button>
        </div>
      </div>

      {/* Tanda tangan tersimpan Sekretaris */}
      {isSekretaris && (
        <MySignatureCard
          roleLabel="Sekretaris"
          signature={mySignature.signature}
          saving={mySignature.saving}
          onSave={mySignature.save}
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
              <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
              <option value="Perlu Revisi">Perlu Revisi</option>
              <option value="Menunggu Approval">Menunggu Approval</option>
              <option value="Disetujui">Disetujui</option>
              <option value="Dikirim ke Pusat">Dikirim ke Pusat</option>
              <option value="Aktif">Aktif</option>
              <option value="Menunggu Pembayaran">Menunggu Pembayaran</option>
              <option value="Ditolak">Ditolak</option>
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
          <span className="hidden sm:inline text-[11px] text-slate-500">
            Klik "Screening Berkas" untuk memeriksa dokumen & pembayaran
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
                  <span className={`flex-shrink-0 inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${statusChipClass(sub.status)}`}>
                    {sub.status}
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
                      {sub.payment_status || 'Belum Bayar'}
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
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${statusChipClass(sub.status)}`}>
                        {sub.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        Rp {sub.payment_amount ? sub.payment_amount.toLocaleString('id-ID') : '-'}
                      </div>
                      <span className={`text-[10px] font-bold ${sub.payment_status === 'Valid' ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                        {sub.payment_status || 'Belum Bayar'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
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

      {/* MODAL 1: VERIFIKASI BERKAS & PEMBAYARAN */}
      {isVerifyModalOpen && selectedSubDetail && (
        <DocumentVerificationModal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          submission={selectedSubDetail.submission}
          documents={selectedSubDetail.documents}
          payment={selectedSubDetail.payment}
          onScreenDocument={handleScreenDoc}
          onVerifyPayment={handleVerifyPayment}
          onAdmin1Action={handleAdmin1Action}
          onPassToAdmin2={isSekretaris ? startPassToKetua : undefined}
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
          onClose={() => setPassing(null)}
        />
      )}

      {/* MODAL 2: LIHAT PAKET DOKUMEN KE PUSAT */}
      {isPacketModalOpen && packetSubDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setIsPacketModalOpen(false)}
                className="px-3 py-1 bg-white text-slate-800 rounded-lg font-bold text-xs shadow hover:bg-slate-100"
              >
                ✕ Tutup
              </button>
            </div>
            <CentralPacketExporter
              submission={packetSubDetail.submission}
              documents={packetSubDetail.documents}
              settings={packetSubDetail.settings}
              payment={packetSubDetail.payment}
            />
          </div>
        </div>
      )}

      {/* MODAL 3: INPUT NO KTA DARI PUSAT */}
      {ktaModalSub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-surface max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-emerald-700">
              <BadgeCheck className="w-6 h-6" />
              <h3 className="font-medium text-lg text-slate-900">
                Aktivasi Keanggotaan IKAPI (No. KTA)
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              IKAPI Pusat telah menyetujui pengajuan untuk <strong>{ktaModalSub.publisher_name}</strong>. Silakan masukkan Nomor KTA resmi yang diterbitkan dari Pusat:
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nomor KTA Resmi (Pusat) *
              </label>
              <input
                type="text"
                placeholder="Contoh: 014/JBR/2026"
                value={ktaInput}
                onChange={(e) => setKtaInput(e.target.value)}
                className="w-full text-sm font-mono font-bold p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 uppercase"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setKtaModalSub(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveKta}
                disabled={submittingKta}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                {submittingKta ? 'Menyimpan...' : 'Aktifkan Keanggotaan'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

