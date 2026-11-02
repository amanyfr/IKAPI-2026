import React from 'react';
import { 
  FileEdit, 
  CreditCard, 
  Search, 
  AlertCircle, 
  Award, 
  XCircle, 
  CheckCircle2, 
  Send, 
  BadgeCheck 
} from 'lucide-react';

export const STATUS_STEPS = [
  { id: 'Draf', label: '1. Draf', desc: 'Pengisian data formulir', icon: FileEdit },
  { id: 'Menunggu Pembayaran', label: '2. Pembayaran', desc: 'Transfer ke Rekening BNI', icon: CreditCard },
  { id: 'Menunggu Verifikasi', label: '3. Verifikasi', desc: 'Screening Admin 1', icon: Search },
  { id: 'Perlu Revisi', label: 'Revisi', desc: 'Perbaikan berkas', icon: AlertCircle, isBranch: true },
  { id: 'Menunggu Approval', label: '4. Approval', desc: 'Review & TTD Admin 2', icon: Award },
  { id: 'Disetujui', label: '5. Disetujui', desc: 'Surat & Berkas Sah', icon: CheckCircle2 },
  { id: 'Dikirim ke Pusat', label: '6. Kirim ke Pusat', desc: 'Menunggu No. KTA', icon: Send },
  { id: 'Aktif', label: '7. Anggota Aktif', desc: 'KTA Resmi Terbit', icon: BadgeCheck }
];

export default function StatusStepper({ currentStatus, rejectionReason }) {
  const isRejected = currentStatus === 'Ditolak';
  const isNeedRevision = currentStatus === 'Perlu Revisi';

  // Find step index
  const getStepIndex = (status) => {
    switch (status) {
      case 'Draf': return 0;
      case 'Menunggu Pembayaran': return 1;
      case 'Menunggu Verifikasi': return 2;
      case 'Perlu Revisi': return 2; // on parallel/revision
      case 'Menunggu Approval': return 3;
      case 'Disetujui': return 4;
      case 'Dikirim ke Pusat': return 5;
      case 'Aktif': return 6;
      case 'Ditolak': return 3;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(currentStatus);

  // Normal flow without 'Perlu Revisi' and 'Ditolak' in linear display
  const linearSteps = [
    { key: 'Draf', label: 'Draf', icon: FileEdit, desc: 'Isi Formulir' },
    { key: 'Menunggu Pembayaran', label: 'Tagihan BNI', icon: CreditCard, desc: 'Bayar Iuran' },
    { key: 'Menunggu Verifikasi', label: 'Screening', icon: Search, desc: 'Admin 1 Cek Berkas' },
    { key: 'Menunggu Approval', label: 'Approval TTD', icon: Award, desc: 'Ketua & Sekretaris' },
    { key: 'Disetujui', label: 'Disetujui', icon: CheckCircle2, desc: 'Paket Dokumen Sah' },
    { key: 'Dikirim ke Pusat', label: 'Kirim ke Pusat', icon: Send, desc: 'IKAPI Pusat' },
    { key: 'Aktif', label: 'Aktif', icon: BadgeCheck, desc: 'KTA Resmi Aktif' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Status Pengajuan</span>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className="text-lg font-bold text-slate-800">Alur Penerbitan Keanggotaan IKAPI</h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isRejected ? 'bg-red-100 text-red-700 border border-red-200' :
              isNeedRevision ? 'bg-amber-100 text-amber-800 border border-amber-200' :
              currentStatus === 'Aktif' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
              currentStatus === 'Disetujui' ? 'bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc]' :
              'bg-[#dff2fd] text-[#0884c4] border border-[#b8e6fc]'
            }`}>
              {currentStatus}
            </span>
          </div>
        </div>

        {/* Status Callout Badge */}
        {isNeedRevision && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-amber-800 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Perhatian: Ada berkas yang perlu diperbaiki. Pembayaran tidak perlu diulang.</span>
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg text-red-800 text-xs font-medium">
            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>Pengajuan Ditolak: {rejectionReason || 'Tidak memenuhi kualifikasi kepenerbitan.'}</span>
          </div>
        )}
      </div>

      {/* Horizontal Stepper */}
      <div className="relative">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[700px] flex items-center justify-between relative">
            
            {/* Background connecting bar */}
            <div className="absolute top-5 left-6 right-6 h-1 bg-slate-200 z-0">
              <div 
                className="h-full bg-[#0da2e7] transition-all duration-500"
                style={{ 
                  width: `${(Math.min(currentIndex, 6) / (linearSteps.length - 1)) * 100}%` 
                }}
              />
            </div>

            {linearSteps.map((step, idx) => {
              const Icon = step.icon;
              const isDone = idx < currentIndex || currentStatus === 'Aktif';
              const isCurrent = idx === currentIndex && !isRejected;

              let circleColor = 'bg-slate-100 text-slate-400 border-slate-300';
              if (isDone) {
                circleColor = 'bg-[#0884c4] text-white border-[#0884c4] shadow-sm';
              } else if (isCurrent) {
                if (isNeedRevision) {
                  circleColor = 'bg-[#0da2e7] text-white border-[#0da2e7] ring-4 ring-[#dff2fd]';
                } else {
                  circleColor = 'bg-[#0da2e7] text-white border-[#0da2e7] ring-4 ring-[#dff2fd] animate-pulse';
                }
              }

              return (
                <div key={step.key} className="relative z-10 flex flex-col items-center text-center w-24">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition ${circleColor}`}>
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-xs mt-2 font-semibold ${
                    isCurrent ? 'text-[#0884c4] font-bold' : isDone ? 'text-slate-700' : 'text-slate-600'
                  }`}>
                    {step.label}
                  </span>
                  <span className="text-[10px] text-slate-600 leading-tight mt-0.5">
                    {step.desc}
                  </span>
                </div>
              );
            })}

          </div>
        </div>
      </div>
    </div>
  );
}
