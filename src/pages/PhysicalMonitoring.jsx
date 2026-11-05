import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DocumentVerificationModal from '../components/DocumentVerificationModal';
import { STEPS, STATUS_LABEL } from '../components/StatusStepper';
import { Activity, Truck, RefreshCw, CheckCircle, Clock, Search } from 'lucide-react';
import { notify } from '../components/AppDialog';

const token = () => localStorage.getItem('ikapi_token');

const PHYSICAL_BADGE = {
  'Belum Dikirim': 'bg-amber-50 text-amber-800 border-amber-200',
  Dikirim: 'bg-sky-50 text-[#0884c4] border-sky-200',
  Diterima: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const formatDate = (raw) => {
  if (!raw) return '-';
  const d = new Date(String(raw).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Monitoring status pendaftaran (semua tahap) dan pengiriman berkas fisik ke sekretariat IKAPI Jawa Barat
export default function PhysicalMonitoring({ onOpenScreening }) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Menunggu');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/submissions', { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Gagal memuat monitoring:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id) => {
    const res = await fetch(`/api/submissions/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
    setDetail(await res.json());
  };

  const handleReceive = async (id, notes) => {
    const res = await fetch(`/api/submissions/${id}/physical-received`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    notify(data.message);
    await openDetail(id);
    load();
  };

  const stageCounts = useMemo(() => {
    const map = {};
    submissions.forEach((s) => {
      const key = s.status === 'Perlu Revisi' ? 'Menunggu Verifikasi' : s.status;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [submissions]);

  const physicalList = submissions
    .filter((s) => s.status === 'Pengiriman Berkas' || (s.status === 'Aktif' && s.physical_received_at))
    .filter((s) => filter === 'Semua' || (filter === 'Menunggu' ? s.status === 'Pengiriman Berkas' : s.status === 'Aktif'))
    .filter((s) => !search.trim() || `${s.publisher_name} ${s.applicant_name} ${s.physical_tracking_no || ''}`.toLowerCase().includes(search.toLowerCase()));

  const waitingSent = submissions.filter((s) => s.status === 'Pengiriman Berkas' && s.physical_status === 'Dikirim').length;
  const notSent = submissions.filter((s) => s.status === 'Pengiriman Berkas' && s.physical_status !== 'Dikirim').length;

  return (
    <div className="space-y-6">
      {/* Ringkasan semua tahap */}
      <div className="card-surface p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#0da2e7] rounded-xl text-white"><Activity className="w-6 h-6" /></div>
            <div>
              <h2 className="text-2xl font-light tracking-tight text-slate-900">Monitoring Status Pendaftaran</h2>
              <p className="text-xs text-slate-500 mt-0.5">Posisi setiap pengajuan di alur, sampai berkas fisik diterima sekretariat IKAPI Jawa Barat.</p>
            </div>
          </div>
          <button onClick={load} className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[...STEPS.slice(0, 5), { key: 'Pengiriman Berkas', label: 'Menunggu approval Admin', icon: Truck }, STEPS[5]].map((step, i) => {
            const n = stageCounts[step.key] || 0;
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                onClick={() => onOpenScreening?.(step.key)}
                className="text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-[#0da2e7] transition"
                title={`Buka daftar: ${STATUS_LABEL[step.key]}`}
              >
                <div className="flex items-center justify-between">
                  <Icon className="w-4 h-4 text-[#0884c4]" />
                  <span className="text-[10px] text-slate-400">{i + 1}</span>
                </div>
                <p className="text-2xl font-light text-slate-900 mt-1">{n}</p>
                <p className="text-[11px] text-slate-600 leading-tight">{step.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Berkas fisik */}
      <div className="card-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-600" />
            <h3 className="text-base text-slate-800">Approval Anggota & Data Pengiriman</h3>
            <span className="text-xs text-slate-500">· {notSent} belum dikirim · {waitingSent} sudah dikirim, perlu dikonfirmasi</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari penerbit / resi"
                className="text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg w-48" />
            </div>
            {['Menunggu', 'Diterima', 'Semua'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === f ? 'bg-[#0da2e7] text-white border-[#0da2e7]' : 'bg-white text-slate-600 border-slate-200'}`}>
                {f === 'Menunggu' ? 'Menunggu approval' : f === 'Diterima' ? 'Sudah di-approve' : 'Semua'}
              </button>
            ))}
          </div>
        </div>

        {physicalList.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">{loading ? 'Memuat...' : 'Tidak ada data.'}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {physicalList.map((s) => {
              const ph = s.physical_status || 'Belum Dikirim';
              return (
                <div key={s.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{s.publisher_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${PHYSICAL_BADGE[ph]}`}>
                        {ph === 'Belum Dikirim' ? 'Belum dikirim pemohon · menunggu approval' : ph === 'Dikirim' ? 'Dikirim · perlu approval Admin' : 'Disetujui · anggota aktif'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.submission_type === 'Heregistrasi' ? 'Registrasi' : 'Anggota Baru'} · Disetujui Ketua {formatDate(s.approved_at)}
                      {s.physical_courier && <> · {s.physical_courier}{s.physical_tracking_no && <> · resi <span className="font-mono">{s.physical_tracking_no}</span></>}</>}
                      {s.physical_received_at && <> · diterima {formatDate(s.physical_received_at)}</>}
                    </p>
                  </div>
                  <button onClick={() => openDetail(s.id)}
                    className={`self-start md:self-center px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      s.status === 'Pengiriman Berkas' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                    {s.status === 'Pengiriman Berkas' ? <><CheckCircle className="w-4 h-4" /> Cek & approve</> : <><Clock className="w-4 h-4" /> Lihat riwayat</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detail && (
        <DocumentVerificationModal
          isOpen
          onClose={() => setDetail(null)}
          submission={detail.submission}
          documents={detail.documents}
          payment={detail.payment}
          timeline={detail.timeline}
          role={user?.role === 'Admin' && detail.submission?.status === 'Pengiriman Berkas' ? 'Admin' : 'Pengamat'}
          onReceivePhysical={handleReceive}
        />
      )}
    </div>
  );
}
