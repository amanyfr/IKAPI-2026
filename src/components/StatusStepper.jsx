import React from 'react';
import {
  FileEdit,
  CreditCard,
  Search,
  AlertCircle,
  Award,
  XCircle,
  Check,
  BadgeCheck
} from 'lucide-react';

const STEPS = [
  { key: 'Draf',                label: 'Draf',                     hint: 'Isi formulir & berkas', icon: FileEdit },
  { key: 'Menunggu Pembayaran', label: 'Pembayaran',               hint: 'Unggah bukti transfer', icon: CreditCard },
  { key: 'Menunggu Verifikasi', label: 'Screening & TTD Sekretaris', hint: 'Diperiksa Admin & Sekretaris', icon: Search },
  { key: 'Menunggu Approval',   label: 'TTD Ketua',                hint: 'Persetujuan Ketua', icon: Award },
  { key: 'Aktif',               label: 'Anggota Aktif',            hint: 'Resmi terdaftar', icon: BadgeCheck },
];

const STEP_INDEX = {
  'Draf': 0,
  'Menunggu Pembayaran': 1,
  'Menunggu Verifikasi': 2,
  'Perlu Revisi': 2,
  'Menunggu Approval': 3,
  'Ditolak': 3,
  'Aktif': 4,
};

export default function StatusStepper({ currentStatus, rejectionReason, cardClassName = 'card-surface' }) {
  const isRejected = currentStatus === 'Ditolak';
  const isNeedRevision = currentStatus === 'Perlu Revisi';
  const isActive = currentStatus === 'Aktif';
  const currentIndex = STEP_INDEX[currentStatus] ?? 0;

  // Titik & garis tahap yang sudah lewat selalu biru, termasuk saat sudah aktif
  const doneDot = 'bg-[#0884c4] text-white border-[#0884c4]';
  const doneLine = 'bg-[#0da2e7]';

  const stepState = (idx) => {
    if (isActive || idx < currentIndex) return 'done';
    if (idx === currentIndex) return isRejected ? 'rejected' : isNeedRevision ? 'revision' : 'current';
    return 'todo';
  };

  const dotClass = {
    done: doneDot,
    current: 'bg-white text-[#0884c4] border-[#0da2e7] ring-4 ring-[#d8effd]',
    revision: 'bg-white text-amber-600 border-amber-400 ring-4 ring-amber-100',
    rejected: 'bg-white text-red-600 border-red-400 ring-4 ring-red-100',
    todo: 'bg-white text-slate-300 border-slate-200',
  };

  const labelClass = {
    done: 'text-slate-800',
    current: 'text-[#0884c4]',
    revision: 'text-amber-700',
    rejected: 'text-red-700',
    todo: 'text-slate-400',
  };

  const renderDot = (step, state) => {
    const Icon = state === 'done' ? Check : state === 'revision' ? AlertCircle : state === 'rejected' ? XCircle : step.icon;
    return (
      <div className={`stepper-dot relative z-10 w-11 h-11 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${dotClass[state]}`}>
        <Icon className={state === 'done' ? 'w-5 h-5' : 'w-[18px] h-[18px]'} strokeWidth={state === 'done' ? 3 : 2} />
      </div>
    );
  };

  const statusText = isActive ? 'Anggota Aktif' : currentStatus;

  return (
    <div className={`${cardClassName} overflow-hidden`}>
      {/* Header */}
      <div className="border-b border-slate-100 px-5 sm:px-7 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="stepper-title text-lg text-slate-800">Tahapan Status Pengajuan</span>
          <span className={`stepper-status px-3 py-1 rounded-full text-xs font-semibold border ${
            isRejected ? 'bg-red-50 text-red-700 border-red-200' :
            isNeedRevision ? 'bg-amber-50 text-amber-800 border-amber-200' :
            isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            'bg-[#eaf6fe] text-[#0884c4] border-[#b8e6fc]'
          }`}>
            {statusText}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          Tahap <strong className="text-slate-700">{currentIndex + 1}</strong> dari {STEPS.length}
        </span>
      </div>

      {(isNeedRevision || isRejected) && (
        <div className={`mx-5 sm:mx-7 mt-4 flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
          isRejected ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {isRejected ? <XCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{isRejected ? `Ditolak: ${rejectionReason || 'Tidak memenuhi syarat'}` : 'Ada berkas yang perlu diperbaiki sebelum dilanjutkan.'}</span>
        </div>
      )}

      {/* Layar lebar: horizontal, garis tepat dari titik ke titik */}
      <ol className="hidden md:grid grid-cols-5 px-4 lg:px-6 pt-7 pb-6">
        {STEPS.map((step, idx) => {
          const state = stepState(idx);
          const leftDone = isActive || idx <= currentIndex;
          const rightDone = isActive || idx < currentIndex;
          return (
            <li key={step.key} className="relative flex flex-col items-center text-center px-2">
              {idx > 0 && (
                <span className={`absolute top-[21px] left-0 right-1/2 h-[3px] ${leftDone ? doneLine : 'bg-slate-200'}`} />
              )}
              {idx < STEPS.length - 1 && (
                <span className={`absolute top-[21px] left-1/2 right-0 h-[3px] ${rightDone ? doneLine : 'bg-slate-200'}`} />
              )}
              {renderDot(step, state)}
              <span className={`mt-3 text-sm font-semibold leading-snug ${labelClass[state]}`}>{step.label}</span>
              <span className={`mt-1 text-xs leading-snug max-w-[11rem] ${state === 'todo' ? 'text-slate-300' : 'text-slate-500'}`}>
                {step.hint}
              </span>
            </li>
          );
        })}
      </ol>

      {/* HP: vertikal, tanpa geser ke samping */}
      <ol className="md:hidden px-5 py-5">
        {STEPS.map((step, idx) => {
          const state = stepState(idx);
          const last = idx === STEPS.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3.5 pb-5 last:pb-0">
              {!last && (
                <span className={`absolute left-[20px] top-11 bottom-0 w-[3px] ${isActive || idx < currentIndex ? doneLine : 'bg-slate-200'}`} />
              )}
              {renderDot(step, state)}
              <div className="pt-1.5 min-w-0">
                <p className={`text-sm font-semibold ${labelClass[state]}`}>{idx + 1}. {step.label}</p>
                <p className={`text-xs mt-0.5 ${state === 'todo' ? 'text-slate-300' : 'text-slate-500'}`}>{step.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
