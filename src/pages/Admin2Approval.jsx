import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import CentralPacketExporter from '../components/CentralPacketExporter';
import { useMySignature, MySignatureCard, SignLetterModal } from '../components/LetterSigning';
import StatusStepper from '../components/StatusStepper';
import {
  Award, CheckCircle, XCircle, Send, FileText, Users,
  DollarSign, Eye, PenTool, RefreshCw, Search, Activity,
  Clock, ShieldCheck, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';

const STAGE_PROGRESS = {
  'Draf':                  { step: 1, total: 7, label: 'Tahap 1/7 · Pengisian Draf Pemohon', color: 'bg-slate-400' },
  'Menunggu Pembayaran':   { step: 2, total: 7, label: 'Tahap 2/7 · Menunggu Bukti Transfer', color: 'bg-amber-500' },
  'Menunggu Verifikasi':   { step: 3, total: 7, label: 'Tahap 3/7 · Screening Berkas (Sekretaris)', color: 'bg-[#0da2e7]' },
  'Perlu Revisi':          { step: 3, total: 7, label: 'Tahap 3/7 · Dikembalikan untuk Revisi', color: 'bg-amber-500' },
  'Menunggu Approval':     { step: 4, total: 7, label: 'Tahap 4/7 · Menunggu Approval & TTD Ketua', color: 'bg-indigo-600' },
  'Disetujui':             { step: 5, total: 7, label: 'Tahap 5/7 · Disetujui & Surat Ditandatangani', color: 'bg-emerald-500' },
  'Dikirim ke Pusat':      { step: 6, total: 7, label: 'Tahap 6/7 · Paket Dikirim ke IKAPI Pusat', color: 'bg-purple-600' },
  'Aktif':                 { step: 7, total: 7, label: 'Tahap 7/7 · Anggota Resmi Aktif (KTA Terbit)', color: 'bg-emerald-600' },
  'Ditolak':               { step: 0, total: 7, label: 'Pengajuan Ditolak oleh Pengurus', color: 'bg-red-500' },
};

const STATUS_BADGE = {
  'Draf':                  'bg-slate-100 text-slate-700 border-slate-200',
  'Menunggu Pembayaran':   'bg-amber-50 text-amber-800 border-amber-200',
  'Menunggu Verifikasi':   'bg-[#f0f9ff] text-[#0884c4] border-[#b8e6fc]',
  'Perlu Revisi':          'bg-amber-100 text-amber-800 border-amber-300',
  'Menunggu Approval':     'bg-indigo-50 text-indigo-800 border-indigo-200',
  'Disetujui':             'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Dikirim ke Pusat':      'bg-purple-50 text-purple-800 border-purple-200',
  'Aktif':                 'bg-emerald-100 text-emerald-900 border-emerald-300',
  'Ditolak':               'bg-red-50 text-red-800 border-red-200',
};

export default function Admin2Approval({ initialStatus = 'Semua', initialSearch = '', scrollToMonitoring = false }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // Filter for Monitoring Table (bisa diisi awal dari Dashboard)
  const [monitorStatus, setMonitorStatus] = useState(initialStatus);
  const [monitorSearch, setMonitorSearch] = useState(initialSearch);
  const monitoringRef = useRef(null);
  const [expandedSubId, setExpandedSubId] = useState(null);

  // Approval & Rejection Modal State
  const [approvingSub, setApprovingSub] = useState(null);
  const [rejectingSub, setRejectingSub] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Selected for Packet / Official Letter Modal
  const [packetDetail, setPacketDetail] = useState(null);
  const [isPacketOpen, setIsPacketOpen] = useState(false);

  const [processing, setProcessing] = useState(false);

  // TTD tersimpan Ketua (dibuat sekali, dipakai berulang)
  const isKetua = user?.role === 'Ketua';
  const mySignature = useMySignature(isKetua);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` };
      const [resStats, resSubs, resSettings] = await Promise.all([
        fetch('/api/admin/dashboard-stats', { headers }),
        fetch('/api/submissions', { headers }),
        fetch('/api/settings')
      ]);

      const dataStats = await resStats.json();
      const dataSubs = await resSubs.json();
      const dataSettings = await resSettings.json();

      setStats(dataStats.stats);
      setSubmissions(dataSubs.submissions || []);
      if (dataSettings.settings) setSettings(dataSettings.settings);
    } catch (err) {
      console.error('Failed to load admin 2 data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && (scrollToMonitoring || initialStatus !== 'Semua' || initialSearch)) {
      monitoringRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  // Open Full Packet & Official Letter
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

  // Ketua Action (approve / reject / send_to_central)
  const handleAdmin2Action = async (subId, action, reason = null, extra = {}) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/submissions/${subId}/admin2-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
        },
        body: JSON.stringify({ action, reason, ...extra })
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

  // Filtered submissions
  const pendingApproval = submissions.filter(s => s.status === 'Menunggu Approval');
  const signedList = submissions.filter(s => ['Disetujui', 'Dikirim ke Pusat', 'Aktif'].includes(s.status));

  const filteredMonitoring = submissions.filter(s => {
    const matchStatus = monitorStatus === 'Semua' || s.status === monitorStatus;
    const q = monitorSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      (s.publisher_name || '').toLowerCase().includes(q) ||
      (s.leader_name || '').toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q) ||
      (s.reference_number || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const chairmanName = settings?.ketua_nama || 'Dr. H. Mahpudi, M.T.';
  const secretaryName = settings?.sekretaris_nama || 'Drs. H. Anwar Rosyid, M.Si.';

  return (
    <div className="space-y-6">

      {/* Top Banner */}
      <div className="card-surface p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#0da2e7] rounded-xl text-white shadow-sm">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-light tracking-tight text-slate-900">
              Dashboard Monitoring, Approval & Tanda Tangan Surat (Ketua)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Wewenang Ketua & Sekretaris PD IKAPI Jawa Barat: Monitoring tahapan pengajuan, keputusan kelayakan, dan pembubuhan TTD digital.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="px-3.5 py-2 border border-slate-200 hover:bg-[#f0f9ff] rounded-xl text-slate-600 hover:text-[#0da2e7] transition flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Segarkan Data
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card-surface p-4 sm:p-5 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total Seluruh Pengajuan</span>
            <span className="text-2xl font-black text-[#0da2e7] mt-1 block">
              {submissions.length}
            </span>
            <span className="text-[10px] text-slate-400">Terdaftar di sistem</span>
          </div>
          <div className="hidden sm:block p-3 bg-[#f0f9ff] text-[#0da2e7] rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="card-surface p-4 sm:p-5 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Menunggu Approval Anda</span>
            <span className="text-2xl font-black text-indigo-600 mt-1 block">
              {pendingApproval.length}
            </span>
            <span className="text-[10px] text-slate-400">Siap diputuskan & TTD</span>
          </div>
          <div className="hidden sm:block p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <PenTool className="w-6 h-6" />
          </div>
        </div>

        <div className="card-surface p-4 sm:p-5 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Surat Telah Ditandatangani</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {signedList.length}
            </span>
            <span className="text-[10px] text-slate-400">Disetujui / Dikirim / Aktif</span>
          </div>
          <div className="hidden sm:block p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="card-surface p-4 sm:p-5 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total Iuran Terverifikasi</span>
            <span className="text-xl font-black text-[#0884c4] mt-1 block">
              Rp {stats?.totalRevenue ? stats.totalRevenue.toLocaleString('id-ID') : '0'}
            </span>
            <span className="text-[10px] text-slate-400">Rekening BNI IKAPI Jabar</span>
          </div>
          <div className="hidden sm:block p-3 bg-[#f0f9ff] text-[#0884c4] rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tanda tangan tersimpan Ketua */}
      {isKetua && (
        <MySignatureCard
          roleLabel="Ketua"
          signature={mySignature.signature}
          saving={mySignature.saving}
          onSave={mySignature.save}
        />
      )}

      {/* =====================================================================
          FITUR 2 & 3: APPROVAL ALUR & PEMBUBUHAN TANDA TANGAN SURAT PENGANTAR
         ===================================================================== */}
      <div className="card-surface overflow-hidden">
        <div className="bg-sky-50 px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <PenTool className="w-5 h-5 text-[#0da2e7]" />
            <div>
              <h3 className="text-lg text-slate-800">
                Antrian Keputusan Akhir (Approval) & Pembubuhan TTD Surat Pengantar
              </h3>
              <p className="text-[11px] text-slate-500">
                Pengajuan yang telah lolos screening berkas & verifikasi pembayaran oleh Sekretaris.
              </p>
            </div>
          </div>
          <span className="bg-[#0da2e7] text-white text-xs px-3 py-1 rounded-full font-bold shadow-sm">
            {pendingApproval.length} Menunggu Keputusan
          </span>
        </div>

        <div className="divide-y divide-slate-100 bg-white">
          {pendingApproval.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-60" />
              Tidak ada antrian pengajuan yang menunggu persetujuan saat ini.
            </div>
          ) : (
            pendingApproval.map((sub) => (
              <div key={sub.id} className="p-6 hover:bg-slate-50 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-medium text-slate-900">
                      {sub.publisher_name}
                    </h4>
                    <span className="text-xs bg-[#dff2fd] text-[#0884c4] px-2.5 py-0.5 rounded-full font-bold border border-[#b8e6fc]">
                      Anggota {sub.member_category || 'Biasa'}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold">
                      {sub.submission_type}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Pimpinan: <strong>{sub.leader_name}</strong></span>
                    <span>•</span>
                    <span>Kota: <strong>{sub.city}</strong></span>
                    <span>•</span>
                    <span>No. Surat Pengantar: <strong className="font-mono text-[#0884c4]">{sub.reference_number || 'Otomatis'}</strong></span>
                  </div>

                  {sub.admin_notes && (
                    <p className="text-xs text-slate-600 bg-[#f0f9ff] border border-[#b8e6fc] px-3 py-1.5 rounded-lg mt-2 inline-block">
                      <strong>Catatan Sekretaris:</strong> {sub.admin_notes}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => openPacket(sub.id)}
                    className="px-3.5 py-2 bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc] text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                    title="Pratinjau Surat Pengantar & Berkas"
                  >
                    <Eye className="w-3.5 h-3.5" /> Pratinjau Surat & Berkas
                  </button>

                  <button
                    onClick={() => { setRejectingSub(sub); setRejectionReason(''); }}
                    className="px-3.5 py-2 border border-red-300 hover:bg-red-50 text-red-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Tolak Pengajuan
                  </button>

                  <button
                    onClick={() => setApprovingSub(sub)}
                    className="px-4 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    Setujui & Bubuhkan TTD Surat
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* =====================================================================
          SURAT PENGANTAR YANG TELAH DITANDATANGANI & EKSPEDISI KE PUSAT
         ===================================================================== */}
      <div className="card-surface overflow-hidden">
        <div className="bg-slate-50/70 px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#0da2e7]" />
            <div>
              <h3 className="text-lg text-slate-800">
                Dokumen Surat Pengantar Resmi & Pengiriman ke IKAPI Pusat
              </h3>
              <p className="text-[11px] text-slate-500">
                Daftar surat pengantar yang telah dibubuhi tanda tangan Ketua & Sekretaris beserta status pengirimannya.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#0884c4] bg-[#f0f9ff] px-3 py-1 rounded-full border border-[#b8e6fc]">
            Total {signedList.length} Surat Terbit
          </span>
        </div>

        <div className="divide-y divide-slate-100 bg-white">
          {signedList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Belum ada surat pengantar yang diterbitkan.
            </div>
          ) : (
            signedList.map((sub) => {
              const isDisetujui = sub.status === 'Disetujui';
              return (
                <div key={sub.id} className="p-5 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium text-slate-900">
                        {sub.publisher_name}
                      </h4>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${STATUS_BADGE[sub.status] || ''}`}>
                        {sub.status}
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                        ✓ TTD Ketua & Sekretaris
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 font-mono mt-1">
                      No. Surat: <strong className="text-[#0884c4]">{sub.reference_number || '012/PD-Ikapi Jabar/IV/2026'}</strong> • Penandatangan: {sub.signed_by_chairman || chairmanName} & {sub.signed_by_secretary || secretaryName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openPacket(sub.id)}
                      className="px-3.5 py-1.5 bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc] text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" /> Lihat & Cetak Surat Pengantar (PDF)
                    </button>

                    {isDisetujui && (
                      <button
                        onClick={() => handleAdmin2Action(sub.id, 'send_to_central')}
                        disabled={processing}
                        className="px-3.5 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
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

      {/* =====================================================================
          FITUR 1: MONITORING ALUR & POSISI TAHAPAN SELURUH PENGAJUAN
         ===================================================================== */}
      <div ref={monitoringRef} className="card-surface overflow-hidden scroll-mt-40">
        <div className="p-6 border-b border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2.5">
              <Activity className="w-5 h-5 text-[#0da2e7]" />
              <div>
                <h3 className="text-lg text-slate-800">
                  Monitoring Alur & Posisi Tahapan Seluruh Pengajuan
                </h3>
                <p className="text-xs text-slate-500">
                  Pantau ringkasan seluruh pengajuan yang masuk beserta posisi tahapan terkini di dalam sistem.
                </p>
              </div>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari penerbit, kota, no surat..."
                  value={monitorSearch}
                  onChange={(e) => setMonitorSearch(e.target.value)}
                  className="text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0da2e7] outline-none w-52"
                />
              </div>

              <select
                value={monitorStatus}
                onChange={(e) => setMonitorStatus(e.target.value)}
                className="text-xs py-2 px-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0da2e7] outline-none"
              >
                <option value="Semua">Semua Tahapan Status ({submissions.length})</option>
                <option value="Draf">Draf</option>
                <option value="Menunggu Verifikasi">Menunggu Verifikasi (Sekretaris)</option>
                <option value="Perlu Revisi">Perlu Revisi</option>
                <option value="Menunggu Approval">Menunggu Approval (Ketua)</option>
                <option value="Disetujui">Disetujui</option>
                <option value="Dikirim ke Pusat">Dikirim ke Pusat</option>
                <option value="Aktif">Aktif (KTA Terbit)</option>
                <option value="Ditolak">Ditolak</option>
              </select>
            </div>
          </div>

          {/* Mini Stage Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
            {[
              { label: 'Screening Sekretaris', status: 'Menunggu Verifikasi', color: 'text-[#0884c4] bg-[#f0f9ff] border-[#b8e6fc]' },
              { label: 'Perlu Revisi', status: 'Perlu Revisi', color: 'text-amber-800 bg-amber-50 border-amber-200' },
              { label: 'Menunggu Approval', status: 'Menunggu Approval', color: 'text-indigo-800 bg-indigo-50 border-indigo-200' },
              { label: 'Disetujui & TTD', status: 'Disetujui', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
              { label: 'Dikirim ke Pusat', status: 'Dikirim ke Pusat', color: 'text-purple-800 bg-purple-50 border-purple-200' },
              { label: 'Anggota Aktif / Ditolak', status: 'Aktif', color: 'text-slate-700 bg-slate-50 border-slate-200' },
            ].map((pill) => {
              const count =
                pill.status === 'Aktif'
                  ? submissions.filter(s => s.status === 'Aktif' || s.status === 'Ditolak').length
                  : submissions.filter(s => s.status === pill.status).length;
              return (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => setMonitorStatus(monitorStatus === pill.status ? 'Semua' : pill.status)}
                  className={`p-2.5 rounded-xl border text-left transition hover:shadow-sm ${pill.color}`}
                >
                  <div className="text-lg font-black leading-none">{count}</div>
                  <div className="text-[10px] font-semibold mt-1 truncate">{pill.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Monitoring — HP: daftar kartu */}
        <div className="md:hidden divide-y divide-slate-100 bg-white">
          {loading ? (
            <p className="py-10 text-center text-xs text-slate-400">Memuat data monitoring pengajuan...</p>
          ) : filteredMonitoring.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">Tidak ada pengajuan yang sesuai dengan filter.</p>
          ) : (
            filteredMonitoring.map((sub) => {
              const stage = STAGE_PROGRESS[sub.status] || STAGE_PROGRESS['Menunggu Verifikasi'];
              const pct = stage.step === 0 ? 100 : Math.round((stage.step / stage.total) * 100);
              const isExpanded = expandedSubId === sub.id;
              return (
                <div key={sub.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900">{sub.publisher_name}</div>
                      <div className="text-[11px] text-slate-500">{sub.leader_name} • {sub.city}</div>
                      <div className="text-[10px] text-[#0884c4] font-bold mt-0.5">
                        {sub.submission_type} · Kategori {sub.member_category || 'Biasa'}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[sub.status] || 'bg-slate-100 text-slate-700'}`}>
                      {sub.status}
                    </span>
                  </div>
                  {sub.rejection_reason && (
                    <div className="text-[11px] text-red-600">Alasan: {sub.rejection_reason}</div>
                  )}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600 mb-1">
                      <span>{stage.label}</span>
                      <span>{stage.step > 0 ? `${pct}%` : 'Ditolak'}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${stage.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setExpandedSubId(isExpanded ? null : sub.id)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>Alur</span>
                    </button>
                    <button
                      onClick={() => openPacket(sub.id)}
                      className="px-2.5 py-1.5 bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc] rounded-lg font-semibold text-[11px] flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> Detail & Surat
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="overflow-x-auto -mx-4 px-4 pt-2">
                      <StatusStepper currentStatus={sub.status} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Monitoring — layar lebar: tabel */}
        <div className="hidden md:block overflow-x-auto bg-white">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-sky-50 border-b border-slate-100 text-[#0884c4]">
                <th className="py-3 px-4 text-left font-bold">Penerbit & Pimpinan</th>
                <th className="py-3 px-4 text-left font-bold">Jenis & Kategori</th>
                <th className="py-3 px-4 text-left font-bold">Status Terkini</th>
                <th className="py-3 px-4 text-left font-bold w-64">Posisi Tahapan di Sistem</th>
                <th className="py-3 px-4 text-center font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Memuat data monitoring pengajuan...
                  </td>
                </tr>
              ) : filteredMonitoring.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Tidak ada pengajuan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredMonitoring.map((sub) => {
                  const stage = STAGE_PROGRESS[sub.status] || STAGE_PROGRESS['Menunggu Verifikasi'];
                  const pct = stage.step === 0 ? 100 : Math.round((stage.step / stage.total) * 100);
                  const isExpanded = expandedSubId === sub.id;

                  return (
                    <React.Fragment key={sub.id}>
                      <tr className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{sub.publisher_name}</div>
                          <div className="text-[11px] text-slate-500">{sub.leader_name} • {sub.city}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800">{sub.submission_type}</span>
                          <span className="block text-[10px] text-[#0884c4] font-bold">
                            Kategori {sub.member_category || 'Biasa'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[sub.status] || 'bg-slate-100 text-slate-700'}`}>
                            {sub.status}
                          </span>
                          {sub.rejection_reason && (
                            <div className="text-[10px] text-red-600 mt-1 max-w-xs truncate" title={sub.rejection_reason}>
                              Alasan: {sub.rejection_reason}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600 mb-1">
                            <span>{stage.label}</span>
                            <span>{stage.step > 0 ? `${pct}%` : 'Ditolak'}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${stage.color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setExpandedSubId(isExpanded ? null : sub.id)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition"
                              title="Tampilkan Alur Stepper Lengkap"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              <span>Alur</span>
                            </button>

                            <button
                              onClick={() => openPacket(sub.id)}
                              className="px-2.5 py-1.5 bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc] rounded-lg font-semibold text-[11px] flex items-center gap-1 transition"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail & Surat
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={5} className="px-6 py-4 border-t border-slate-100">
                            <StatusStepper currentStatus={sub.status} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: APPROVAL & PEMBUBUHAN TANDA TANGAN DIGITAL KETUA & SEKRETARIS
         ===================================================================== */}
      {approvingSub && (
        <SignLetterModal
          role="chairman"
          submission={approvingSub}
          settings={settings}
          signature={mySignature.signature}
          savingSignature={mySignature.saving}
          onSaveSignature={mySignature.save}
          title="Bubuhkan tanda tangan Ketua pada dokumen pengajuan"
          subtitle={`${approvingSub.publisher_name} • ${approvingSub.submission_type} (${approvingSub.member_category || 'Biasa'})`}
          confirmLabel="Bubuhkan TTD (4 dokumen) & Setujui"
          processing={processing}
          onConfirm={(signaturePositions) => handleAdmin2Action(approvingSub.id, 'approve', null, { signaturePositions })}
          onClose={() => setApprovingSub(null)}
        />
      )}

      {/* =====================================================================
          MODAL 2: PENOLAKAN PENGAJUAN BESERTA ALASAN PENOLAKAN
         ===================================================================== */}
      {rejectingSub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-surface max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <XCircle className="w-6 h-6" />
              <h3 className="font-medium text-lg text-slate-900">
                Penolakan Pengajuan Keanggotaan
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Berikan alasan penolakan yang jelas untuk disampaikan kepada pemohon <strong>{rejectingSub.publisher_name}</strong>:
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Alasan Penolakan (Wajib Diisi) *
              </label>
              <textarea
                rows="3"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Dokumen akta pendirian tidak mencantumkan bidang usaha penerbitan buku..."
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingSub(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleAdmin2Action(rejectingSub.id, 'reject', rejectionReason)}
                disabled={processing || !rejectionReason.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {processing ? 'Menolak...' : 'Konfirmasi Penolakan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: PRATINJAU & CETAK SURAT PENGANTAR + PAKET DOKUMEN
         ===================================================================== */}
      {isPacketOpen && packetDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setIsPacketOpen(false)}
                className="px-3.5 py-1.5 bg-white text-slate-800 rounded-xl font-bold text-xs shadow hover:bg-slate-100"
              >
                ✕ Tutup Pratinjau
              </button>
            </div>
            <CentralPacketExporter
              submission={packetDetail.submission}
              documents={packetDetail.documents}
              settings={packetDetail.settings}
              payment={packetDetail.payment}
            />
          </div>
        </div>
      )}

    </div>
  );
}
