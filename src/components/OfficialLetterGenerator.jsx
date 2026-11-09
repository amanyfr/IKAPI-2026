import React, { useRef } from 'react';
import { POST_APPROVAL_STATUSES } from './StatusStepper';
import { Printer, Download, CheckCircle, FileText } from 'lucide-react';
import { PengurusSignatureBlock, KopSurat } from './PengurusSignature';
import { downloadElementPdf, printElement, safeFileName } from '../utils/exportDocument';

// `signing` (opsional) = { role: 'chairman' | 'secretary', img, pos, onChange }: mode pembubuhan
// TTD seperti e-meterai pada blok tanda tangan surat.
export default function OfficialLetterGenerator({ submission, settings, signing = null }) {
  const paperRef = useRef(null);
  if (!submission) return null;

  const isHeregistrasi = submission.submission_type === 'Heregistrasi';
  const refNumber = submission.reference_number || '012/PD-Ikapi Jabar/IV/2026';

  const letterDateStr = submission.letter_date
    ? new Date(submission.letter_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });


  const defaultOpeningBaru =
    'Sehubungan dengan permohonan pendaftaran Anggota Baru IKAPI yang diajukan ke Pengurus Daerah Jawa Barat, bersama ini kami sampaikan bahwa penerbit pemohon telah memenuhi seluruh persyaratan keabsahan hukum, verifikasi kompetensi perbukuan/editor BNSP, serta penyelesaian administrasi organisasi:';
  const defaultOpeningHereg =
    'Sehubungan dengan permohonan Heregistrasi (Pembaruan Keanggotaan) yang diajukan oleh penerbit di wilayah Pengurus Daerah IKAPI Jawa Barat, kami telah melakukan verifikasi faktual terhadap berkas administrasi dan pelunasan kewajiban iuran. Berdasarkan hal tersebut, kami menerangkan data penerbit sebagai berikut:';
  const defaultClosing =
    'Pengurus Daerah IKAPI Jawa Barat telah menyetujui dan memberikan REKOMENDASI RESMI agar penerbit di atas disahkan menjadi Anggota IKAPI serta diterbitkan Nomor KTA dari Pengurus Pusat IKAPI. Demikian surat rekomendasi pengantar ini kami sampaikan untuk dapat dipergunakan sebagaimana mestinya.';

  const openingText = isHeregistrasi
    ? (settings?.surat_pembuka_hereg || defaultOpeningHereg)
    : (settings?.surat_pembuka_baru || defaultOpeningBaru);

  const closingText = settings?.surat_penutup || defaultClosing;

  const isSigned =
    Boolean(submission.signed_by_chairman) ||
    POST_APPROVAL_STATUSES.includes(submission.status);

  const fileName = `Surat_Pengantar_IKAPI_Jabar_${safeFileName(submission.publisher_name, 'Pemohon')}.pdf`;
  const handlePrint = () => printElement(paperRef.current, fileName.replace('.pdf', ''));
  const handleDownloadPdf = () => downloadElementPdf(paperRef.current, fileName);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Top Action Bar */}
      <div className={`bg-[#f0f9ff] px-6 py-3 border-b border-[#b8e6fc] flex-wrap items-center justify-between gap-3 no-print ${signing ? 'hidden' : 'flex'}`}>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#0da2e7]" />
          <span className="font-bold text-slate-800 text-sm">
            Surat Pengantar Resmi Rekomendasi IKAPI Jabar
          </span>
          <span className="text-xs bg-white text-[#0884c4] border border-[#b8e6fc] px-2.5 py-0.5 rounded-full font-mono font-bold">
            {refNumber}
          </span>
          {isSigned && (
            <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> TTD Digital Sah
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Surat
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-3.5 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" /> Unduh PDF Resmi
          </button>
        </div>
      </div>

      {/* Official Letter Paper View */}
      <div
        ref={paperRef}
        data-paper
        className="p-8 sm:p-12 max-w-3xl mx-auto font-serif text-slate-900 leading-relaxed bg-white"
        style={{ minHeight: '850px' }}
      >
        {/* Kop Surat Resmi IKAPI Jawa Barat */}
        <KopSurat settings={settings} />

        {/* Letter Meta & Date */}
        <div className="flex justify-between items-start text-xs sm:text-sm font-sans mb-6">
          <div className="space-y-1">
            <p><span className="w-20 inline-block font-semibold">Nomor</span>: <strong className="font-mono">{refNumber}</strong></p>
            <p><span className="w-20 inline-block font-semibold">Lampiran</span>: 1 (Satu) Berkas Lengkap</p>
            <p><span className="w-20 inline-block font-semibold">Perihal</span>: <strong>{isHeregistrasi ? 'Rekomendasi Perpanjangan KTA IKAPI' : 'Rekomendasi Penerimaan Anggota Baru IKAPI'}</strong></p>
          </div>
          <div className="text-right">
            <p>Bandung, {letterDateStr}</p>
          </div>
        </div>

        {/* Recipient */}
        <div className="text-xs sm:text-sm font-sans mb-6">
          <p>Kepada Yth.</p>
          <p className="font-bold text-slate-900">Pengurus Pusat IKAPI</p>
          <p>c.q. Bidang Keanggotaan & Organisasi</p>
          <p>Jl. Kalipasir No. 32, Cikini, Menteng</p>
          <p>Jakarta Pusat 10330</p>
        </div>

        {/* Letter Body */}
        <div className="text-xs sm:text-sm text-justify space-y-4 mb-6">
          <p>Dengan hormat,</p>
          <p className="indent-8 leading-relaxed">
            {openingText}
          </p>

          {/* Publisher Details Table */}
          <div className="bg-[#f8fbfe] p-4 rounded-lg border border-[#b8e6fc] text-xs sm:text-sm font-sans space-y-2">
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-4 font-semibold text-slate-700">Nama Penerbit</span>
              <span className="col-span-8 font-bold text-slate-900">: {submission.publisher_name || '-'}</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-4 font-semibold text-slate-700">Kategori / Badan Usaha</span>
              <span className="col-span-8">: Anggota {submission.member_category || submission.category || 'Biasa'} ({submission.legal_entity || 'Badan Usaha'})</span>
            </div>
            {isHeregistrasi && (
              <div className="grid grid-cols-12 gap-1">
                <span className="col-span-4 font-semibold text-slate-700">No. KTA Lama</span>
                <span className="col-span-8 font-mono font-bold text-[#0884c4]">: {submission.old_kta_number || submission.member_kta || '-'}</span>
              </div>
            )}
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-4 font-semibold text-slate-700">Nama Pimpinan</span>
              <span className="col-span-8">: {submission.leader_name || '-'} ({submission.leader_title || 'Pimpinan'})</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-4 font-semibold text-slate-700">Alamat Lengkap</span>
              <span className="col-span-8">: {submission.address || '-'}, {submission.city || '-'}</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-4 font-semibold text-slate-700">No. Telepon / Email</span>
              <span className="col-span-8">: {submission.publisher_phone || submission.phone || '-'} / {submission.publisher_email || submission.email || '-'}</span>
            </div>
            <div className="grid grid-cols-12 gap-1">
              <span className="col-span-4 font-semibold text-slate-700">PJ Redaksi / Editor</span>
              <span className="col-span-8">: {submission.person_in_charge || '-'} (Sertifikat BNSP: {submission.bnsp_certificate_no || 'Terverifikasi'})</span>
            </div>
          </div>

          <p className="indent-8 leading-relaxed">
            {closingText}
          </p>
        </div>

        {/* Signatures & Seal Section */}
        <PengurusSignatureBlock submission={submission} settings={settings} docKey="surat" signing={signing} />
      </div>
    </div>
  );
}
