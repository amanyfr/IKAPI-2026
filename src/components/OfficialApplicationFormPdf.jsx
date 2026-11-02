import React, { useRef } from 'react';
import { Printer, Download, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function OfficialApplicationFormPdf({ submission }) {
  const printRef = useRef(null);
  if (!submission) return null;

  const formData = typeof submission.form_data === 'string'
    ? JSON.parse(submission.form_data || '{}')
    : submission.form_data || {};

  const isHeregistrasi = submission.submission_type === 'Heregistrasi';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    });

    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text('FORMULIR PENDAFTARAN & PENDATAAN ANGGOTA IKAPI', 105, 18, { align: 'center' });
    doc.setFontSize(11);
    doc.text('IKATAN PENERBIT INDONESIA PENGURUS DAERAH JAWA BARAT', 105, 24, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    doc.text('Tahun Pengajuan: 2026 | Berdasarkan Standar Anggaran Dasar & Anggaran Rumah Tangga IKAPI', 105, 29, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(15, 33, 195, 33);

    let y = 42;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('A. INFORMASI UMUM & BADAN USAHA', 15, y);
    y += 7;

    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const dataA = [
      ['Jenis Pengajuan', isHeregistrasi ? 'Heregistrasi (Anggota Lama)' : 'Anggota Baru'],
      ['Kategori Anggota', `Anggota ${submission.member_category || submission.category || 'Biasa'}`],
      ['Nama Penerbit / Lembaga', submission.publisher_name || '-'],
      ['Bentuk Badan Hukum', submission.legal_entity || formData.legalEntity || '-'],
      ['Nomor Induk Berusaha (NIB)', submission.nib || formData.nib || '-'],
      ['NPWP Perusahaan', submission.npwp || formData.npwp || '-'],
      ['Alamat Lengkap Kantor', `${submission.address || formData.address || '-'}, ${submission.city || formData.city || '-'}`],
      ['Kode Pos', submission.postal_code || formData.postalCode || '-'],
      ['Telepon / Faksimili', `${submission.publisher_phone || formData.phone || '-'} / ${submission.fax || formData.fax || '-'}`],
      ['Email / Website', `${submission.publisher_email || formData.email || '-'} / ${submission.website || formData.website || '-'}`]
    ];

    if (isHeregistrasi) {
      dataA.unshift(['Nomor KTA Lama', submission.old_kta_number || formData.oldKtaNumber || '-']);
    }

    dataA.forEach(([label, val]) => {
      doc.setFont('times', 'bold');
      doc.text(label, 20, y);
      doc.setFont('times', 'normal');
      doc.text(`: ${val}`, 80, y);
      y += 6;
    });

    y += 4;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('B. DATA PIMPINAN / PENANGGUNG JAWAB', 15, y);
    y += 7;

    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const dataB = [
      ['Nama Lengkap Pimpinan', `${submission.leader_name || formData.leaderName || '-'} (${submission.leader_title || formData.leaderTitle || 'Pimpinan'})`],
      ['Nomor Kontak / WhatsApp', submission.leader_phone || formData.leaderPhone || '-'],
      ['Penanggung Jawab Redaksi', submission.person_in_charge || formData.personInCharge || '-'],
      ['No. Sertifikat BNSP Editor', submission.bnsp_certificate_no || formData.bnspCertificateNo || '-'],
      ['Fokus / Spesialisasi Buku', submission.specialization || formData.specialization || 'Umum, Pendidikan, Sastra']
    ];

    dataB.forEach(([label, val]) => {
      doc.setFont('times', 'bold');
      doc.text(label, 20, y);
      doc.setFont('times', 'normal');
      doc.text(`: ${val}`, 80, y);
      y += 6;
    });

    y += 8;
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text('SURAT PERNYATAAN PEMOHON', 105, y, { align: 'center' });
    y += 6;
    doc.setFont('times', 'normal');
    doc.setFontSize(8.5);
    const statement = 'Dengan ini kami menyatakan bahwa seluruh data yang kami isikan dalam formulir pendaftaran ini adalah benar, sah, dan dapat dipertanggungjawabkan menurut hukum. Kami bersedia tunduk serta mematuhi Anggaran Dasar, Anggaran Rumah Tangga (AD/ART), serta Kode Etik Penerbit IKAPI.';
    const splitStatement = doc.splitTextToSize(statement, 175);
    doc.text(splitStatement, 18, y);

    y += 18;
    doc.text(`Bandung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 140, y);
    doc.text('Pimpinan Penerbit Pemohon,', 140, y + 5);
    doc.text('(Meterai & Cap Perusahaan)', 140, y + 20);
    doc.setFont('times', 'bold');
    doc.text(submission.leader_name || formData.leaderName || 'Pimpinan Perusahaan', 140, y + 30);

    doc.save(`Formulir_IKAPI_${submission.publisher_name ? submission.publisher_name.replace(/\s+/g, '_') : 'Pemohon'}.pdf`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-blue-900" />
          <span className="font-bold text-slate-800 text-sm">
            Formulir Digital Resmi IKAPI 2026 (Format Cetak)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Formulir
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow transition"
          >
            <Download className="w-3.5 h-3.5" /> Unduh PDF Formulir
          </button>
        </div>
      </div>

      <div ref={printRef} className="p-8 sm:p-12 max-w-3xl mx-auto font-sans text-slate-900 bg-white">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
          <h2 className="text-base sm:text-lg font-black tracking-wide text-blue-950 uppercase">
            Formulir Pendaftaran & Pendataan Anggota
          </h2>
          <h3 className="text-sm font-bold text-slate-700 uppercase">
            Ikatan Penerbit Indonesia (IKAPI) Pengurus Daerah Jawa Barat
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Formulir Resmi 2026 | Berdasarkan AD/ART IKAPI
          </p>
        </div>

        {/* Section A */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-blue-900 bg-blue-50 px-3 py-1 rounded border-l-4 border-blue-900 uppercase mb-3">
            A. Identitas Badan Usaha / Penerbit
          </h4>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 w-1/3 text-slate-600 font-medium">Jenis Pengajuan</td>
                <td className="py-2 font-bold text-slate-900">
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    {submission.submission_type}
                  </span>
                  {isHeregistrasi && submission.old_kta_number && (
                    <span className="ml-2 font-mono text-slate-600">(KTA Lama: {submission.old_kta_number})</span>
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">Kategori Anggota</td>
                <td className="py-2 font-bold text-blue-950">
                  Anggota {submission.member_category || submission.category || 'Biasa'}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">Nama Penerbit</td>
                <td className="py-2 font-black text-slate-900">{submission.publisher_name}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">Bentuk Badan Usaha</td>
                <td className="py-2 text-slate-800">{submission.legal_entity || formData.legalEntity || 'PT / CV'}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">NIB / NPWP</td>
                <td className="py-2 text-slate-800">
                  NIB: {submission.nib || formData.nib || '-'} | NPWP: {submission.npwp || formData.npwp || '-'}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">Alamat Kantor</td>
                <td className="py-2 text-slate-800">
                  {submission.address || formData.address}, {submission.city || formData.city} {submission.postal_code || formData.postalCode}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">Kontak & Website</td>
                <td className="py-2 text-slate-800">
                  Telp: {submission.publisher_phone || formData.phone} | Email: {submission.publisher_email || formData.email} | Web: {submission.website || formData.website || '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section B */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-blue-900 bg-blue-50 px-3 py-1 rounded border-l-4 border-blue-900 uppercase mb-3">
            B. Pimpinan & Redaksi
          </h4>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 w-1/3 text-slate-600 font-medium">Pimpinan Penerbit</td>
                <td className="py-2 font-bold text-slate-900">
                  {submission.leader_name} ({submission.leader_title || 'Pimpinan'})
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">No. Telepon Pimpinan</td>
                <td className="py-2 text-slate-800">{submission.leader_phone || formData.leaderPhone || '-'}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">Penanggung Jawab Redaksi</td>
                <td className="py-2 text-slate-800 font-semibold">{submission.person_in_charge}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">Sertifikat BNSP Kompetensi</td>
                <td className="py-2 text-emerald-700 font-mono font-bold">
                  {submission.bnsp_certificate_no || 'Terverifikasi BNSP Editor'}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-600 font-medium">Spesialisasi Penerbitan</td>
                <td className="py-2 text-slate-800">{submission.specialization || 'Buku Pendidikan, Referensi, Umum'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section C: Statement */}
        <div className="border border-slate-200 bg-slate-50 p-4 rounded-lg text-xs leading-relaxed mb-6">
          <p className="font-bold text-slate-800 mb-1">Pernyataan Pemohon:</p>
          <p className="text-slate-600">
            Kami menyatakan bahwa data yang diisikan dalam formulir pendaftaran ini adalah sah dan sesuai dengan kondisi sebenarnya. Kami menyatakan tunduk pada Kode Etik Penerbit Indonesia dan ketentuan AD/ART IKAPI.
          </p>
        </div>

        {/* Signature Box */}
        <div className="flex justify-end text-xs text-right mt-6">
          <div className="w-56 text-center space-y-12">
            <p className="text-slate-600">
              Bandung, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              <br />
              Pimpinan Penerbit Pemohon,
            </p>
            <div className="text-slate-400 text-[10px] italic">
              (Meterai Rp 10.000 & Stempel)
            </div>
            <div>
              <p className="font-bold text-slate-900 underline">{submission.leader_name}</p>
              <p className="text-slate-500">{submission.leader_title || 'Pimpinan'}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

