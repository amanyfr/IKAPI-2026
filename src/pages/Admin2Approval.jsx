import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CentralPacketExporter from '../components/CentralPacketExporter';
import { 
  Award, 
  CheckCircle, 
  XCircle, 
  Send, 
  FileText, 
  TrendingUp, 
  Clock, 
  Users, 
  DollarSign, 
  Building2, 
  AlertCircle,
  Eye,
  PenTool,
  RefreshCw,
  Search,
  ExternalLink
} from 'lucide-react';

export default function Admin2Approval() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Approval Modal State
  const [approvingSub, setApprovingSub] = useState(null);
  const [rejectingSub, setRejectingSub] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Selected for Packet Modal
  const [packetDetail, setPacketDetail] = useState(null);
  const [isPacketOpen, setIsPacketOpen] = useState(false);

  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resStats, resSubs] = await Promise.all([
        fetch('/api/admin/dashboard-stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` }
        }),
        fetch('/api/submissions', {
          headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` }
        })
      ]);

      const dataStats = await resStats.json();
      const dataSubs = await resSubs.json();

      setStats(dataStats.stats);
      setSubmissions(dataSubs.submissions || []);
    } catch (err) {
      console.error('Failed to load admin 2 data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open Full Packet
  const openPacket = async (subId) => {
    try {
      const res = await fetch(`/api/submissions/${subId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` }
      });
      const data = await res.json();
      setPacketDetail(data);
      setIsPacketOpen(true);
    } catch (err) {
      alert('Gagal mengambil data pengajuan: ' + err.message);
    }
  };

  // Admin 2 Action
  const handleAdmin2Action = async (subId, action, reason = null) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/submissions/${subId}/admin2-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
        },
        body: JSON.stringify({ action, reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(data.message);
      setApprovingSub(null);
      setRejectingSub(null);
      setRejectionReason('');
      fetchData();
    } catch (err) {
      alert('Gagal memproses aksi: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Submissions filtered for Admin 2 attention
  const pendingApproval = submissions.filter(s => s.status === 'Menunggu Approval');
  const approvedList = submissions.filter(s => s.status === 'Disetujui');
  const sentList = submissions.filter(s => s.status === 'Dikirim ke Pusat');

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-500 rounded-xl text-slate-950 font-black">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Dashboard Eksekutif & Approval Pengurus (Admin 2)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Wewenang Ketua & Sekretaris PD IKAPI Jawa Barat: Penandatanganan Surat Pengantar & Keputusan Kelayakan.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="p-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 transition flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Segarkan Data
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Butuh Approval Anda</span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {stats?.pendingApproval ?? 0}
            </span>
            <span className="text-[10px] text-slate-400">Siap ditandatangani</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Siap Kirim ke Pusat</span>
            <span className="text-2xl font-black text-blue-900 mt-1 block">
              {approvedList.length}
            </span>
            <span className="text-[10px] text-slate-400">Surat & paket sah</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-900 rounded-xl">
            <Send className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Anggota Resmi Aktif</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {stats?.activeMembers ?? 0}
            </span>
            <span className="text-[10px] text-slate-400">Ber-KTA resmi</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total Iuran Terverifikasi</span>
            <span className="text-xl font-black text-blue-950 mt-1 block">
              Rp {stats?.totalRevenue ? stats.totalRevenue.toLocaleString('id-ID') : '0'}
            </span>
            <span className="text-[10px] text-slate-400">Rekening BNI Jabar</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-900 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SECTION 1: ANTRIAN APPROVAL KETUA & SEKRETARIS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-amber-500/10 px-6 py-4 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Antrian Persetujuan & Penandatanganan Surat (Status: Menunggu Approval)
            </h3>
          </div>
          <span className="bg-amber-500 text-slate-950 text-xs px-2.5 py-0.5 rounded-full font-bold">
            {pendingApproval.length} Pengajuan
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {pendingApproval.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Tidak ada pengajuan yang menunggu persetujuan saat ini.
            </div>
          ) : (
            pendingApproval.map((sub) => (
              <div key={sub.id} className="p-6 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-blue-950">
                      {sub.publisher_name}
                    </h4>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded font-semibold">
                      Anggota {sub.member_category || 'Biasa'}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {sub.submission_type}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Pimpinan: <strong>{sub.leader_name}</strong></span>
                    <span>•</span>
                    <span>Kota: <strong>{sub.city}</strong></span>
                    <span>•</span>
                    <span>Nomor Surat Siap Terbit: <strong className="font-mono text-blue-900">{sub.reference_number || 'Otomatis'}</strong></span>
                  </div>

                  {sub.admin_notes && (
                    <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded-lg mt-2 inline-block">
                      <strong>Catatan Verifikator Admin 1:</strong> {sub.admin_notes}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openPacket(sub.id)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                    title="Review Surat & Berkas"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-900" /> Review Berkas
                  </button>

                  <button
                    onClick={() => setRejectingSub(sub)}
                    className="px-3.5 py-2 border border-red-300 hover:bg-red-50 text-red-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Tolak
                  </button>

                  <button
                    onClick={() => setApprovingSub(sub)}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
                  >
                    <PenTool className="w-3.5 h-3.5 text-amber-400" />
                    Setujui & TTD Surat
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: PENGAJUAN DISETUJUI & SIAP EKSPEDISI KE PUSAT */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Send className="w-5 h-5 text-blue-900" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Pengiriman Dokumen ke IKAPI Pusat (Status: Disetujui & Dikirim ke Pusat)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Total {approvedList.length + sentList.length} Penerbit
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {[...approvedList, ...sentList].length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Belum ada dokumen yang disetujui.
            </div>
          ) : (
            [...approvedList, ...sentList].map((sub) => {
              const isSent = sub.status === 'Dikirim ke Pusat';

              return (
                <div key={sub.id} className="p-5 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        {sub.publisher_name}
                      </h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isSent
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {sub.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      No. Surat: <strong>{sub.reference_number}</strong> • TTD: {sub.signed_by_chairman || 'Ketua'} & {sub.signed_by_secretary || 'Sekretaris'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openPacket(sub.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-blue-100 text-blue-900 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" /> Buka Paket Cetak PDF
                    </button>

                    {!isSent && (
                      <button
                        onClick={() => handleAdmin2Action(sub.id, 'send_to_central')}
                        disabled={processing}
                        className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5 text-amber-400" />
                        Tandai Dikirim ke IKAPI Pusat
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL APPROVAL & DIGITAL SIGNATURE */}
      {approvingSub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-blue-900">
              <div className="p-2 bg-blue-50 rounded-xl text-amber-500">
                <PenTool className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Persetujuan & Tanda Tangan Digital Pengurus
                </h3>
                <p className="text-xs text-slate-500">
                  {approvingSub.publisher_name}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <p>Dengan menyetujui pengajuan ini, sistem akan otomatis:</p>
              <ul className="list-disc list-inside text-slate-600 space-y-1">
                <li>Membubuhkan tanda tangan digital Ketua & Sekretaris PD IKAPI Jawa Barat.</li>
                <li>Menerbitkan nomor surat resmi: <strong className="font-mono text-blue-950">{approvingSub.reference_number || '012/PD-Ikapi Jabar/IV/2026'}</strong>.</li>
                <li>Membentuk bundel paket lengkap PDF (Surat Rekomendasi + Formulir 2026 + Berkas).</li>
                <li>Mengubah status pengajuan menjadi <strong>Disetujui</strong>.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovingSub(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleAdmin2Action(approvingSub.id, 'approve')}
                disabled={processing}
                className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4 text-amber-400" />
                {processing ? 'Menandatangani...' : 'Sah & Bubuhkan Tanda Tangan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REJECTION WITH REASON */}
      {rejectingSub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <XCircle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">
                Penolakan Pengajuan Keanggotaan
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Berikan alasan penolakan yang jelas untuk disampaikan kepada pemohon <strong>{rejectingSub.publisher_name}</strong>:
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Alasan Penolakan (Wajib) *
              </label>
              <textarea
                rows="3"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Dokumen akta tidak memiliki klasifikasi bidang usaha kepenerbitan..."
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingSub(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleAdmin2Action(rejectingSub.id, 'reject', rejectionReason)}
                disabled={processing || !rejectionReason.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {processing ? 'Menolak...' : 'Konfirmasi Penolakan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL PACKET MODAL */}
      {isPacketOpen && packetDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setIsPacketOpen(false)}
                className="px-3 py-1 bg-white text-slate-800 rounded-lg font-bold text-xs shadow hover:bg-slate-100"
              >
                ✕ Tutup
              </button>
            </div>
            <CentralPacketExporter
              submission={packetDetail.submission}
              documents={packetDetail.documents}
              settings={packetDetail.settings}
            />
          </div>
        </div>
      )}

    </div>
  );
}

