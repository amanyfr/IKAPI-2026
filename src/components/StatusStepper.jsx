import React from 'react';
import {
  FileEdit,
  CreditCard,
  Search,
  AlertCircle,
  Award,
  XCircle,
  Check,
  BadgeCheck,
  PenLine,
  Truck,
  HelpCircle,
  Clock
} from 'lucide-react';

// Alur: dokumen dulu (Tahap 1), baru pembayaran (Tahap 2), lalu TTD pengurus, berkas fisik,
// pemohon mengirim berkas langsung ke IKAPI Pusat, lalu mengisi No. KTA dari Pusat
// estimate: perkiraan lama proses tiap tahap (hari kerja), ditampilkan ke pemohon
export const STEPS = [
  { key: 'Draf',                    label: 'Isi Formulir',       hint: 'Formulir & unggah dokumen', icon: FileEdit,    estimate: 'Sesuai kesiapan pemohon', short: 'Fleksibel' },
  { key: 'Menunggu Verifikasi',     label: 'Screening Dokumen',  hint: 'Tahap 1 · diperiksa Admin', icon: Search,       estimate: 'Maks. 2×24 jam kerja', short: '≤ 2×24 jam' },
  { key: 'Menunggu Pembayaran',     label: 'Pembayaran',         hint: 'Tahap 2 · transfer & verifikasi', icon: CreditCard, estimate: 'Verifikasi maks. 1×24 jam kerja', short: '≤ 1×24 jam' },
  { key: 'Menunggu TTD Sekretaris', label: 'TTD Sekretaris',     hint: 'Ditandatangani Sekretaris', icon: PenLine,      estimate: 'Maks. 2×24 jam kerja', short: '≤ 2×24 jam' },
  { key: 'Menunggu Approval',       label: 'TTD Ketua',          hint: 'Persetujuan Ketua', icon: Award,                estimate: 'Maks. 2×24 jam kerja', short: '≤ 2×24 jam' },
  { key: 'Pengiriman Berkas',       label: 'Berkas Fisik',       hint: 'Kirim berkas ke IKAPI Pusat', icon: Truck,      estimate: '± 2–5 hari kerja (ekspedisi)', short: '2–5 hari' },
  { key: 'Dikirim ke Pusat',        label: 'Input KTA',          hint: 'Isi No. KTA · dicek Admin', icon: HelpCircle,   estimate: 'Cek KTA maks. 2×24 jam kerja', short: '≤ 2×24 jam' },
  { key: 'Aktif',                   label: 'Anggota Aktif',      hint: 'KTA diverifikasi Admin', icon: BadgeCheck },
];

export const STEP_INDEX = {
  'Draf': 0,
  'Menunggu Verifikasi': 1,
  'Perlu Revisi': 1,
  'Menunggu Pembayaran': 2,
  'Menunggu TTD Sekretaris': 3,
  'Menunggu Approval': 4,
  'Ditolak': 4,
  'Pengiriman Berkas': 5,
  'Berkas Diterima': 6, // berkas sampai di sekretariat, disiapkan ke Pusat
  'Dikirim ke Pusat': 6,
  'Aktif': 7,
};

// Status setelah surat ditandatangani Sekretaris & Ketua (dokumen resmi sudah terbit)
// Pengajuan revisi yang masuk: pemohon sudah mengirim dokumen perbaikan dan menunggu diperiksa ulang Admin.
// Mengembalikan nomor revisi (1, 2, ...) atau 0 bila bukan revisi masuk. Dipakai sama di Admin, Sekretaris, Ketua.
export const revisionRoundIn = (s) => (
  s?.status === 'Menunggu Verifikasi'
    ? Math.max(Number(s.revision_round) || 0, Number(s.revised_docs_count) > 0 ? 1 : 0)
    : 0
);

export const POST_APPROVAL_STATUSES = ['Pengiriman Berkas', 'Berkas Diterima', 'Dikirim ke Pusat', 'Aktif'];

// Nama tahap yang mudah dipahami untuk setiap status (dipakai di semua peran)
export const STATUS_LABEL = {
  'Draf': 'Draf',
  'Menunggu Verifikasi': 'Screening Dokumen',
  'Perlu Revisi': 'Revisi Dokumen',
  'Menunggu Pembayaran': 'Pembayaran',
  'Menunggu TTD Sekretaris': 'Menunggu TTD Sekretaris',
  'Menunggu Approval': 'Menunggu TTD Ketua',
  'Pengiriman Berkas': 'Pengiriman Berkas Fisik',
  'Berkas Diterima': 'Berkas Diterima · Siap ke Pusat',
  'Dikirim ke Pusat': 'Input & Verifikasi KTA',
  'Aktif': 'Anggota Aktif',
  'Ditolak': 'Ditolak',
};

// Petunjuk tahap saat ini (sub-teks stepper)
const CURRENT_HINT = {
  'Pengiriman Berkas': 'Kirim berkas, lalu klik Lanjutkan',
  'Berkas Diterima': 'Berkas diterima, disiapkan ke Pusat',
  'Dikirim ke Pusat': 'Isi No. KTA, diverifikasi Admin',
};

// Pemberitahuan perkiraan waktu tahap yang sedang berjalan (ditampilkan ke pemohon)
export const STAGE_NOTICE = {
  'Menunggu Verifikasi': 'Dokumen Anda sedang diperiksa Admin, maksimal 2×24 jam kerja.',
  'Perlu Revisi': 'Setelah dokumen perbaikan diunggah, screening ulang maksimal 2×24 jam kerja.',
  'Menunggu Pembayaran': 'Setelah bukti transfer diunggah, verifikasi pembayaran maksimal 1×24 jam kerja.',
  'Menunggu TTD Sekretaris': 'Pengajuan sedang ditandatangani Sekretaris, maksimal 2×24 jam kerja.',
  'Menunggu Approval': 'Pengajuan sedang menunggu persetujuan Ketua, maksimal 2×24 jam kerja.',
  'Pengiriman Berkas': 'Pengiriman berkas fisik melalui ekspedisi biasanya 2–5 hari kerja.',
  'Dikirim ke Pusat': 'Setelah No. KTA diisi, Admin memeriksanya maksimal 2×24 jam kerja.',
};

export default function StatusStepper({ currentStatus, rejectionReason, rejectedAtStatus, paymentRejected = false, hasDocRejection = false, cardClassName = 'card-surface', showEstimateNotice = false }) {
  const isRejected = currentStatus === 'Ditolak';
  const isNeedRevision = currentStatus === 'Perlu Revisi' || hasDocRejection || (currentStatus === 'Menunggu Pembayaran' && paymentRejected);
  const isActive = currentStatus === 'Aktif';
  // Ditolak: tandai tahap tempat pengajuan dihentikan (TTD Sekretaris atau TTD Ketua)
  const currentIndex = isRejected
    ? (STEP_INDEX[rejectedAtStatus] ?? STEP_INDEX['Ditolak'])
    : (STEP_INDEX[currentStatus] ?? (hasDocRejection ? 1 : 0));
  const rejectedBy = isRejected ? (STEPS[currentIndex]?.label || 'pengurus') : null;

  // Titik & garis tahap yang sudah lewat selalu biru, termasuk saat sudah aktif
  const doneDot = 'bg-[#0884c4] text-white border-[#0884c4]';
  const doneLine = 'bg-[#0da2e7] bg-[linear-gradient(90deg,#0da2e7_0%,#0da2e7_35%,#9be0ff_50%,#0da2e7_65%,#0da2e7_100%)] bg-[length:200%_100%] motion-safe:animate-stepper-flow';
  const doneLineV = 'bg-[#0da2e7] bg-[linear-gradient(180deg,#0da2e7_0%,#0da2e7_35%,#9be0ff_50%,#0da2e7_65%,#0da2e7_100%)] bg-[length:100%_200%] motion-safe:animate-stepper-flow-v';

  const stepState = (idx) => {
    if (isActive || idx < currentIndex) return 'done';
    if (idx === currentIndex) {
      if (isRejected) return 'rejected';
      if (isNeedRevision) return 'revision';
      // Tahap Input KTA: kuning, menandakan pemohon perlu mengisi / menunggu verifikasi KTA
      return currentStatus === 'Dikirim ke Pusat' ? 'waiting' : 'current';
    }
    return isRejected ? 'stopped' : 'todo';
  };

  const dotClass = {
    done: doneDot,
    current: 'bg-white text-[#0884c4] border-[#0da2e7] ring-4 ring-[#d8effd]',
    revision: 'bg-white text-amber-600 border-amber-400 ring-4 ring-amber-100',
    waiting: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 border-amber-400 ring-4 ring-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.45)]',
    rejected: 'bg-white text-red-600 border-red-400 ring-4 ring-red-100',
    todo: 'bg-white text-slate-300 border-slate-200',
    stopped: 'bg-slate-50 text-slate-300 border-dashed border-slate-200',
  };

  const labelClass = {
    done: 'text-slate-800',
    current: 'text-[#0884c4]',
    revision: 'text-amber-700',
    waiting: 'text-amber-700',
    rejected: 'text-red-700',
    todo: 'text-slate-400',
    stopped: 'text-slate-300 line-through decoration-slate-300',
  };

  const renderDot = (step, state) => {
    const Icon = state === 'done' ? Check : state === 'revision' ? AlertCircle : state === 'rejected' ? XCircle : step.icon;
    return (
      <div className={`stepper-dot relative z-10 w-11 h-11 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${dotClass[state]}`}>
        {/* Tahap Input KTA: gelombang kuning berdenyut supaya menarik perhatian (mati jika pengguna memilih kurangi animasi) */}
        {state === 'waiting' && (
          <span className="pointer-events-none absolute -inset-1 rounded-full bg-amber-300/50 motion-safe:animate-ping" />
        )}
        <Icon className={`relative ${state === 'done' ? 'w-5 h-5' : 'w-[18px] h-[18px]'} ${state === 'waiting' ? 'motion-safe:animate-stepper-wiggle' : ''}`} strokeWidth={state === 'done' ? 3 : 2} />
      </div>
    );
  };

  const stepHint = (step, state) => {
    if (state === 'rejected') return 'Pengajuan ditolak di tahap ini';
    if (state === 'stopped') return 'Tidak dilanjutkan';
    return (state === 'current' || state === 'waiting') && CURRENT_HINT[currentStatus] ? CURRENT_HINT[currentStatus] : step.hint;
  };

  // Estimasi hanya untuk tahap yang sedang berjalan / belum dilalui
  const showEstimate = (step, state) => Boolean(step.estimate) && !['done', 'rejected', 'stopped'].includes(state);
  // compact: label pendek satu baris (layar lebar), teks lengkap tetap muncul sebagai tooltip
  const estimateChip = (step, state, extra = '', compact = false) => showEstimate(step, state) && (
    <span title={`Perkiraan: ${step.estimate}`} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-medium leading-4 ${
      state === 'todo' ? 'bg-slate-50 text-slate-400' : state === 'revision' || state === 'waiting' ? 'bg-amber-50 text-amber-700' : 'bg-[#eaf6fe] text-[#0884c4]'
    } ${extra}`}>
      <Clock className="w-3 h-3 flex-shrink-0" /> {compact ? (step.short || step.estimate) : step.estimate}
    </span>
  );

  const statusText = isRejected
    ? 'Pengajuan Ditolak'
    : (currentStatus === 'Perlu Revisi' || hasDocRejection)
    ? 'Revisi Dokumen'
    : (currentStatus === 'Menunggu Pembayaran' && paymentRejected)
    ? 'Revisi Pembayaran'
    : STATUS_LABEL[currentStatus] || currentStatus;

  return (
    <div className={`${cardClassName} overflow-hidden motion-safe:animate-stepper-in`}>
      {/* Header */}
      <div className="border-b border-slate-100 px-5 sm:px-7 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="stepper-title text-lg text-slate-800">Tahapan Status Pengajuan</span>
          <span className={`stepper-status px-3 py-1 rounded-full text-xs font-semibold border ${
            isRejected ? 'bg-red-50 text-red-700 border-red-200' :
            isNeedRevision ? 'bg-amber-50 text-amber-800 border-amber-200' :
            isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            currentStatus === 'Dikirim ke Pusat' ? 'bg-amber-50 text-amber-800 border-amber-200 bg-[linear-gradient(110deg,#fffbeb_40%,#fde68a_50%,#fffbeb_60%)] bg-[length:250%_100%] motion-safe:animate-stepper-shine' :
            'bg-[#eaf6fe] text-[#0884c4] border-[#b8e6fc] bg-[linear-gradient(110deg,#eaf6fe_40%,#c9ecfd_50%,#eaf6fe_60%)] bg-[length:250%_100%] motion-safe:animate-stepper-shine'
          }`}>
            {statusText}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {isRejected
            ? <>Dihentikan di langkah <strong className="text-red-700">{currentIndex + 1}</strong> dari {STEPS.length}</>
            : <>Langkah <strong className="text-slate-700">{currentIndex + 1}</strong> dari {STEPS.length}</>}
        </span>
      </div>

      {(isNeedRevision || isRejected) && (
        <div className={`mx-5 sm:mx-7 mt-4 flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
          isRejected ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {isRejected ? <XCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{isRejected
            ? `Ditolak pada tahap ${rejectedBy}: ${rejectionReason || 'Tidak memenuhi syarat'}. Tahap berikutnya tidak dilanjutkan.`
            : (currentStatus === 'Perlu Revisi' || hasDocRejection)
            ? 'Ada dokumen yang tidak sesuai hasil screening Admin. Silakan unggah ulang dokumen perbaikan di bawah.'
            : 'Bukti transfer tidak sesuai. Unggah ulang bukti transfer.'}</span>
        </div>
      )}

      {showEstimateNotice && !isRejected && !isActive && STAGE_NOTICE[currentStatus] && (
        <div className={`mx-5 sm:mx-7 mt-4 flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
          isNeedRevision || currentStatus === 'Dikirim ke Pusat' ? 'bg-amber-50/60 border-amber-200 text-amber-800' : 'bg-[#f2f9fe] border-[#cdeafc] text-[#0b6a9c]'
        }`}>
          <Clock className="w-4 h-4 flex-shrink-0 mt-px" />
          <span><strong className="font-semibold">Perkiraan waktu:</strong> {STAGE_NOTICE[currentStatus]} Anda akan mendapat notifikasi saat tahap ini selesai.</span>
        </div>
      )}

      {/* Layar lebar: horizontal, garis tepat dari titik ke titik */}
      <ol className="hidden md:grid grid-cols-8 px-3 lg:px-5 pt-7 pb-6">
        {STEPS.map((step, idx) => {
          const state = stepState(idx);
          const leftDone = isActive || idx <= currentIndex;
          const rightDone = isActive || idx < currentIndex;
          return (
            <li key={step.key} className="relative flex flex-col items-center text-center px-1">
              {idx > 0 && (
                <span className={`absolute top-[21px] left-0 right-1/2 h-[3px] ${leftDone ? doneLine : 'bg-slate-200'}`} />
              )}
              {idx < STEPS.length - 1 && (
                <span className={`absolute top-[21px] left-1/2 right-0 h-[3px] ${rightDone ? doneLine : 'bg-slate-200'}`} />
              )}
              {renderDot(step, state)}
              <span className={`mt-3 text-[13px] font-semibold leading-snug ${labelClass[state]}`}>{step.label}</span>
              <span className={`mt-1 mb-2 text-[11px] leading-snug max-w-[9rem] ${state === 'todo' || state === 'stopped' ? 'text-slate-300' : state === 'rejected' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                {stepHint(step, state)}
              </span>
              {/* mt-auto: chip estimasi sejajar di baris bawah walau panjang petunjuk berbeda */}
              {estimateChip(step, state, 'mt-auto', true)}
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
                <span className={`absolute left-[20px] top-11 bottom-0 w-[3px] ${isActive || idx < currentIndex ? doneLineV : 'bg-slate-200'}`} />
              )}
              {renderDot(step, state)}
              <div className="pt-1.5 min-w-0">
                <p className={`text-sm font-semibold ${labelClass[state]}`}>{idx + 1}. {step.label}</p>
                <p className={`text-xs mt-0.5 ${state === 'todo' || state === 'stopped' ? 'text-slate-300' : state === 'rejected' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>{stepHint(step, state)}</p>
                {estimateChip(step, state, 'mt-1')}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
