import React, { useRef } from 'react';
import { Printer, Download, CheckCircle, FileText, ShieldCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function OfficialLetterGenerator({ submission, settings }) {
  const printRef = useRef(null);

  if (!submission) return null;

  const isHeregistrasi = submission.submission_type === 'Heregistrasi';
  const refNumber = submission.reference_number || '012/PD-Ikapi Jabar/IV/2026';

  const letterDateStr = submission.letter_date
    ? new Date(submission.letter_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const chairmanName = submission.signed_by_chairman || settings?.ketua_nama || 'Dr. H. Mahpudi, M.T.';
  const secretaryName = submission.signed_by_secretary || settings?.sekretaris_nama || 'Drs. H. Anwar Rosyid, M.Si.';

  const kopAlamat = settings?.surat_kop_alamat || 'Sekretariat: Jl. Ibu Inggit Garnasih No. 148, Regol, Kota Bandung 40252';
  const kopKontak = settings?.surat_kop_kontak || 'Telp: (022) 5202684 | Email: sekretariat@ikapi-jabar.or.id | Web: https://ikapi-jabar.or.id';

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
    ['Disetujui', 'Dikirim ke Pusat', 'Aktif'].includes(submission.status);

  const handlePrint = () => {
    window.print();
  };

  // Export PDF with jsPDF
  const handleDownloadPdf = () => {
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    });

    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('IKATAN PENERBIT INDONESIA (IKAPI)', 105, 22, { align: 'center' });
    doc.setFontSize(12);
    doc.text('PENGURUS DAERAH JAWA BARAT', 105, 28, { align: 'center' });

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.text(kopAlamat, 105, 34, { align: 'center' });
    doc.text(kopKontak, 105, 38, { align: 'center' });

    // Double line rule
    doc.setLineWidth(0.8);
    doc.line(20, 42, 190, 42);
    doc.setLineWidth(0.2);
    doc.line(20, 43.5, 190, 43.5);

    // Letter meta
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text(`Nomor    : ${refNumber}`, 20, 52);
    doc.text(`Lampiran : 1 (Satu) Berkas Lengkap`, 20, 57);
    doc.text(
      `Perihal  : ${isHeregistrasi ? 'Rekomendasi Perpanjangan KTA IKAPI' : 'Rekomendasi Penerimaan Anggota Baru IKAPI'}`,
      20,
      62
    );

    doc.text(`Bandung, ${letterDateStr}`, 145, 52);

    // Recipient
    doc.text('Kepada Yth.', 20, 72);
    doc.setFont('times', 'bold');
    doc.text('Pengurus Pusat IKAPI (Dewan Pertimbangan / Sekretariat)', 20, 77);
    doc.setFont('times', 'normal');
    doc.text('Jl. Kalipasir No. 32, Cikini, Menteng', 20, 82);
    doc.text('Jakarta Pusat 10330', 20, 87);

    // Opening
    doc.text('Dengan hormat,', 20, 96);
    const splitOpening = doc.splitTextToSize(openingText, 170);
    doc.text(splitOpening, 20, 102);

    // Member Details Box
    let y = 122;
    doc.setFont('times', 'bold');
    doc.text('1. Nama Penerbit', 25, y);
    doc.setFont('times', 'normal');
    doc.text(`: ${submission.publisher_name || '-'}`, 75, y);

    y += 6;
    doc.setFont('times', 'bold');
    doc.text('2. Kategori Anggota', 25, y);
    doc.setFont('times', 'normal');
    doc.text(`: Anggota ${submission.member_category || submission.category || 'Biasa'} (${submission.legal_entity || 'Badan Usaha'})`, 75, y);

    if (isHeregistrasi) {
      y += 6;
      doc.setFont('times', 'bold');
      doc.text('3. No. KTA Lama', 25, y);
      doc.setFont('times', 'normal');
      doc.text(`: ${submission.old_kta_number || submission.member_kta || '-'}`, 75, y);
    }

    y += 6;
    doc.setFont('times', 'bold');
    doc.text(isHeregistrasi ? '4. Nama Pimpinan' : '3. Nama Pimpinan', 25, y);
    doc.setFont('times', 'normal');
    doc.text(`: ${submission.leader_name || '-'} (${submission.leader_title || 'Pimpinan'})`, 75, y);

    y += 6;
    doc.setFont('times', 'bold');
    doc.text(isHeregistrasi ? '5. Alamat Kantor' : '4. Alamat Kantor', 25, y);
    doc.setFont('times', 'normal');
    const splitAddr = doc.splitTextToSize(`: ${submission.address || '-'}, ${submission.city || '-'}`, 115);
    doc.text(splitAddr, 75, y);

    y += 10;
    doc.setFont('times', 'bold');
    doc.text(isHeregistrasi ? '6. No. Telp / Email' : '5. No. Telp / Email', 25, y);
    doc.setFont('times', 'normal');
    doc.text(`: ${submission.publisher_phone || submission.phone || '-'} / ${submission.publisher_email || submission.email || '-'}`, 75, y);

    y += 6;
    doc.setFont('times', 'bold');
    doc.text(isHeregistrasi ? '7. Penanggung Jawab' : '6. Penanggung Jawab Redaksi', 25, y);
    doc.setFont('times', 'normal');
    doc.text(`: ${submission.person_in_charge || '-'} (BNSP: ${submission.bnsp_certificate_no || 'Terverifikasi'})`, 75, y);

    // Closing statement
    y += 14;
    const splitClosing = doc.splitTextToSize(closingText, 170);
    doc.text(splitClosing, 20, y);

    // Signatures
    y += 24;
    doc.setFont('times', 'normal');
    doc.text('PENGURUS DAERAH IKATAN PENERBIT INDONESIA', 105, y, { align: 'center' });
    doc.text('DAERAH JAWA BARAT', 105, y + 5, { align: 'center' });

    const sigY = y + 14;
    doc.setFont('times', 'bold');
    doc.text('Ketua,', 50, sigY, { align: 'center' });
    doc.text('Sekretaris,', 155, sigY, { align: 'center' });

    // Embed uploaded signature & stamp images if available
    try {
      if (settings?.ketua_signature_img) {
        doc.addImage(settings.ketua_signature_img, 32, sigY + 2, 36, 18);
      } else {
        doc.setFont('times', 'italic');
        doc.setTextColor(8, 132, 196);
        doc.text('[ TTD Digital Ketua ]', 50, sigY + 12, { align: 'center' });
      }
      if (settings?.stempel_img) {
        doc.addImage(settings.stempel_img, 88, sigY + 1, 28, 28);
      } else {
        doc.setFontSize(8);
        doc.setTextColor(8, 132, 196);
        doc.text('[ STEMPEL RESMI IKAPI PD JABAR ]', 102, sigY + 14, { align: 'center' });
      }
      if (settings?.sekretaris_signature_img) {
        doc.addImage(settings.sekretaris_signature_img, 137, sigY + 2, 36, 18);
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(8, 132, 196);
        doc.text('[ TTD Digital Sekretaris ]', 155, sigY + 12, { align: 'center' });
      }
    } catch (e) {
      console.warn('Could not embed image into PDF:', e);
    }

    doc.setTextColor(0, 0, 0);
    const nameY = sigY + 26;
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.text(chairmanName, 50, nameY, { align: 'center' });
    doc.setLineWidth(0.3);
    doc.line(25, nameY + 1, 75, nameY + 1);

    doc.text(secretaryName, 155, nameY, { align: 'center' });
    doc.line(130, nameY + 1, 180, nameY + 1);

    doc.save(`Surat_Rekomendasi_IKAPI_${submission.publisher_name ? submission.publisher_name.replace(/\s+/g, '_') : 'Jabar'}.pdf`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Top Action Bar */}
      <div className="bg-[#f0f9ff] px-6 py-3 border-b border-[#b8e6fc] flex flex-wrap items-center justify-between gap-3 no-print">
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
        ref={printRef}
        className="p-8 sm:p-12 max-w-3xl mx-auto font-serif text-slate-900 leading-relaxed bg-white"
        style={{ minHeight: '850px' }}
      >
        {/* Kop Surat Resmi IKAPI Jawa Barat */}
        <div className="flex items-center border-b-[3px] border-double border-slate-900 pb-4 mb-6">
          <div className="w-20 h-20 mr-4 flex-shrink-0 flex items-center justify-center">
            <img
              src="/logo-ikapi.jpg"
              alt="Logo IKAPI"
              className="w-18 h-18 object-contain rounded-lg"
            />
          </div>
          <div className="text-center flex-1">
            <h1 className="text-lg sm:text-xl font-bold tracking-wider text-[#0884c4] uppercase">
              Ikatan Penerbit Indonesia (IKAPI)
            </h1>
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Pengurus Daerah Jawa Barat
            </h2>
            <p className="text-[11px] font-sans text-slate-600 mt-1 leading-tight">
              {kopAlamat}
              <br />
              {kopKontak}
            </p>
          </div>
        </div>

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
        <div className="mt-8 pt-4 font-sans text-xs sm:text-sm">
          <p className="text-center font-bold text-slate-800">
            PENGURUS DAERAH IKATAN PENERBIT INDONESIA (IKAPI)
            <br />
            JAWA BARAT
          </p>

          <div className="grid grid-cols-2 gap-8 mt-6 relative">

            {/* Center Official Stamp */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-90 z-10">
              {settings?.stempel_img ? (
                <img
                  src={settings.stempel_img}
                  alt="Stempel Resmi IKAPI"
                  className="w-28 h-28 object-contain transform -rotate-6"
                />
              ) : (
                <div className="w-28 h-28 rounded-full border-2 border-dashed border-[#0884c4]/80 p-1 flex items-center justify-center transform -rotate-12 bg-[#0da2e7]/5">
                  <div className="w-full h-full rounded-full border-2 border-[#0884c4] flex flex-col items-center justify-center text-center p-1">
                    <span className="text-[7px] font-bold text-[#0884c4] uppercase tracking-widest">★ IKAPI ★</span>
                    <span className="text-[9px] font-black text-[#0da2e7] tracking-tighter">JAWA BARAT</span>
                    <span className="text-[6px] font-bold text-[#0884c4] uppercase mt-0.5">PENGURUS DAERAH</span>
                  </div>
                </div>
              )}
            </div>

            {/* Ketua */}
            <div className="text-center space-y-4">
              <p className="font-semibold text-slate-800">Ketua,</p>

              <div className="h-20 flex items-center justify-center">
                {settings?.ketua_signature_img ? (
                  <img
                    src={settings.ketua_signature_img}
                    alt="Tanda Tangan Ketua"
                    className="max-h-18 max-w-[160px] object-contain"
                  />
                ) : (
                  <div className="font-serif italic text-[#0884c4] text-lg font-bold select-none transform -rotate-3">
                    {chairmanName}
                  </div>
                )}
              </div>

              <div>
                <p className="font-bold text-slate-900 underline">{chairmanName}</p>
                <p className="text-[11px] text-slate-600">Ketua PD IKAPI Jawa Barat</p>
              </div>
            </div>

            {/* Sekretaris */}
            <div className="text-center space-y-4">
              <p className="font-semibold text-slate-800">Sekretaris,</p>

              <div className="h-20 flex items-center justify-center">
                {settings?.sekretaris_signature_img ? (
                  <img
                    src={settings.sekretaris_signature_img}
                    alt="Tanda Tangan Sekretaris"
                    className="max-h-18 max-w-[160px] object-contain"
                  />
                ) : (
                  <div className="font-serif italic text-[#0884c4] text-lg font-bold select-none transform rotate-2">
                    {secretaryName}
                  </div>
                )}
              </div>

              <div>
                <p className="font-bold text-slate-900 underline">{secretaryName}</p>
                <p className="text-[11px] text-slate-600">Sekretaris PD IKAPI Jabar</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
