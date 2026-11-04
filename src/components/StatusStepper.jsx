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

export default function StatusStepper({ currentStatus, rejectionReason, cardClassName = 'card-surface' }) {
  const isRejected = currentStatus === 'Ditolak';
  const isNeedRevision = currentStatus === 'Perlu Revisi';

  const getStepIndex = (status) => {
    switch (status) {
      case 'Draf': return 0;
      case 'Menunggu Pembayaran': return 1;
      case 'Menunggu Verifikasi': return 2;
      case 'Perlu Revisi': return 2;
      case 'Menunggu Approval': return 3;
      case 'Disetujui': return 4;
      case 'Dikirim ke Pusat': return 5;
      case 'Aktif': return 6;
      case 'Ditolak': return 3;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(currentStatus);

  const linearSteps = [
    { key: 'Draf', label: '1. Draf', icon: FileEdit },
    { key: 'Menunggu Pembayaran', label: '2. Pembayaran', icon: CreditCard },
    { key: 'Menunggu Verifikasi', label: '3. Verifikasi', icon: Search },
    { key: 'Menunggu Approval', label: '4. Approval', icon: Award },
    { key: 'Disetujui', label: '5. Disetujui', icon: CheckCircle2 },
    { key: 'Dikirim ke Pusat', label: '6. Ke Pusat', icon: Send },
    { key: 'Aktif', label: '7. Aktif', icon: BadgeCheck },
  ];

  return (
    <div className={`${cardClassName} overflow-hidden`}>
      {/* Header Strip */}
      <div className="bg-slate-50/70 border-b border-slate-100 px-5 sm:px-7 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="stepper-title text-lg text-slate-800">Tahapan Status Pengajuan</span>
          <span className={`stepper-status px-3.5 py-1 rounded-full text-xs font-bold border ${
            isRejected ? 'bg-red-50 text-red-700 border-red-200' :
            isNeedRevision ? 'bg-amber-50 text-amber-800 border-amber-200' :
            currentStatus === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            'bg-[#eaf6fe] text-[#0884c4] border-[#b8e6fc]'
          }`}>
            {currentStatus}
          </span>
        </div>

        {isNeedRevision && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3.5 py-1 rounded-lg text-amber-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Perlu Perbaikan Berkas</span>
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3.5 py-1 rounded-lg text-red-700 text-xs font-semibold">
            <XCircle className="w-4 h-4 text-red-600" />
            <span>Ditolak: {rejectionReason || 'Tidak memenuhi syarat'}</span>
          </div>
        )}
      </div>

      {/* Stepper Track */}
      <div className="p-4 sm:p-7 overflow-x-auto">
        <div className="min-w-[760px] flex items-center justify-between relative px-4">
          <div className="absolute top-6 left-12 right-12 h-1 bg-[#d8effd] z-0 rounded-full">
            <div
              className="h-full bg-gradient-to-r from-[#0884c4] to-[#0da2e7] transition-all duration-500 rounded-full"
              style={{ width: `${(Math.min(currentIndex, 6) / (linearSteps.length - 1)) * 100}%` }}
            />
          </div>

          {linearSteps.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < currentIndex || currentStatus === 'Aktif';
            const isCurrent = idx === currentIndex && !isRejected;

            let circleColor = 'bg-white text-slate-400 border-[#c5e5fb]';
            if (isDone) {
              circleColor = 'bg-[#0884c4] text-white border-[#0884c4] shadow-md shadow-[#0884c4]/25';
            } else if (isCurrent) {
              circleColor = 'bg-[#0da2e7] text-white border-[#0da2e7] ring-4 ring-[#cdeafd] shadow-lg shadow-[#0da2e7]/30';
            }

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center text-center w-28">
                <div className={`stepper-dot w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all ${circleColor}`}>
                  {isDone ? <CheckCircle2 className="w-6 h-6 text-white" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-sm mt-3 ${
                  isCurrent ? 'text-[#0884c4] font-extrabold' : isDone ? 'text-slate-800 font-bold' : 'text-slate-400 font-semibold'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
