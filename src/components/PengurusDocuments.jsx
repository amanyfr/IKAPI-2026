import React from 'react';
import { Printer, Download, ClipboardCheck, Gavel } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PengurusSignatureBlock, drawPengurusSignaturesPdf, KopSurat, drawKopPdf, formatLongDate } from './PengurusSignature';

// Dokumen resmi pengurus yang ditandatangani Ketua & Sekretaris (selain Surat Pengantar):
// Berita Acara Verifikasi dan Surat Keputusan. Prop `signing` = mode pembubuhan TTD.

const fileSafe = (name) => (name ? name.replace(/\s+/g, '_') : 'IKAPI');
const typeLabel = (submission) =>
  submission.submission_type === 'Heregistrasi' ? 'Registrasi (Perpanjangan Keanggotaan)' : 'Pendaftaran Anggota Baru';
const formatRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

function DocShell({ icon: Icon, title, number, signing, onDownload, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`bg-[#f0f9ff] px-6 py-3 border-b border-[#b8e6fc] flex-wrap items-center justify-between gap-3 no-print ${signing ? 'hidden' : 'flex'}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#0da2e7]" />
          <span className="font-bold text-slate-800 text-sm">{title}</span>
          <span className="text-xs bg-white text-[#0884c4] border border-[#b8e6fc] px-2.5 py-0.5 rounded-full font-mono font-bold">{number}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak
          </button>
          <button
            onClick={onDownload}
            className="px-3.5 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" /> Unduh PDF
          </button>
        </div>
      </div>
      <div className="p-8 sm:p-12 max-w-3xl mx-auto font-serif text-slate-900 leading-relaxed bg-white" style={{ minHeight: '850px' }}>
        {children}
      </div>
    </div>
  );
}

function DocTitle({ title, number }) {
  return (
    <div className="text-center mb-6">
      <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide underline underline-offset-4">{title}</h3>
      <p className="text-xs sm:text-sm font-sans mt-1">Nomor: <strong className="font-mono">{number}</strong></p>
    </div>
  );
}

function InfoRows({ rows }) {
  return (
    <div className="bg-[#f8fbfe] p-4 rounded-lg border border-[#b8e6fc] text-xs sm:text-sm font-sans space-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-12 gap-1">
          <span className="col-span-4 font-semibold text-slate-700">{label}</span>
          <span className="col-span-8">: {value || '-'}</span>
        </div>
      ))}
    </div>
  );
}

// PDF: judul + nomor dokumen di bawah kop; mengembalikan y berikutnya
function drawTitlePdf(doc, y, title, number) {
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text(title, 105, y, { align: 'center' });
  const w = doc.getTextWidth(title);
  doc.setLineWidth(0.3);
  doc.line(105 - w / 2, y + 1, 105 + w / 2, y + 1);
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`Nomor: ${number}`, 105, y + 6, { align: 'center' });
  return y + 16;
}

function drawRowsPdf(doc, y, rows) {
  rows.forEach(([label, value]) => {
    doc.setFont('times', 'bold');
    doc.text(label, 25, y);
    doc.setFont('times', 'normal');
    const lines = doc.splitTextToSize(`: ${value || '-'}`, 110);
    doc.text(lines, 75, y);
    y += Math.max(6, lines.length * 5);
  });
  return y;
}

function drawParagraphPdf(doc, y, text) {
  doc.setFont('times', 'normal');
  const lines = doc.splitTextToSize(text, 170);
  doc.text(lines, 20, y);
  return y + lines.length * 5 + 3;
}

const publisherRows = (submission) => [
  ['Nama Penerbit', submission.publisher_name],
  ['Jenis Pengajuan', typeLabel(submission)],
  ['Kategori', `Anggota ${submission.member_category || submission.category || 'Biasa'} (${submission.legal_entity || 'Badan Usaha'})`],
  ['Nama Pimpinan', `${submission.leader_name || '-'} (${submission.leader_title || 'Pimpinan'})`],
  ['Alamat', `${submission.address || '-'}, ${submission.city || '-'}`],
];

/* ═══════════════ BERITA ACARA VERIFIKASI ═══════════════ */

export function BeritaAcaraVerifikasi({ submission, settings, documents = [], payment = null, signing = null }) {
  if (!submission) return null;
  const refNumber = submission.reference_number || 'Otomatis';
  const number = `BA/${refNumber}`;
  const dateStr = formatLongDate(submission.letter_date);
  const opening = `Pada hari ini, ${dateStr}, Pengurus Daerah Ikatan Penerbit Indonesia (IKAPI) Jawa Barat telah melaksanakan verifikasi berkas persyaratan dan pembayaran atas permohonan ${typeLabel(submission).toLowerCase()} dari penerbit berikut:`;
  const closing = 'Berdasarkan hasil verifikasi di atas, seluruh berkas persyaratan dinyatakan LENGKAP dan SAH, serta kewajiban pembayaran telah DIVERIFIKASI. Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.';
  const paymentText = payment
    ? `${formatRupiah(payment.amount)} • ${payment.verification_status || 'Menunggu'}`
    : 'Terverifikasi';

  const handleDownload = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    let y = drawKopPdf(doc, settings);
    y = drawTitlePdf(doc, y + 2, 'BERITA ACARA VERIFIKASI BERKAS & PEMBAYARAN', number);
    doc.setFontSize(10);
    y = drawParagraphPdf(doc, y, opening);
    y = drawRowsPdf(doc, y, publisherRows(submission)) + 3;

    doc.setFont('times', 'bold');
    doc.text('Hasil verifikasi berkas persyaratan:', 20, y);
    y += 6;
    doc.setFont('times', 'normal');
    documents.forEach((d, i) => {
      doc.text(`${i + 1}. ${d.document_title}`, 25, y);
      doc.text(d.screening_status || 'Sesuai', 185, y, { align: 'right' });
      y += 5.5;
    });
    doc.text(`${documents.length + 1}. Pembayaran iuran / biaya pendaftaran`, 25, y);
    doc.text(paymentText, 185, y, { align: 'right' });
    y += 9;

    y = drawParagraphPdf(doc, y, closing);
    if (y > 225) {
      doc.addPage();
      y = 25;
    }
    drawPengurusSignaturesPdf(doc, { submission, settings, docKey: 'berita_acara', y: y + 8 });
    doc.save(`Berita_Acara_Verifikasi_${fileSafe(submission.publisher_name)}.pdf`);
  };

  return (
    <DocShell icon={ClipboardCheck} title="Berita Acara Verifikasi" number={number} signing={signing} onDownload={handleDownload}>
      <KopSurat settings={settings} />
      <DocTitle title="Berita Acara Verifikasi Berkas & Pembayaran" number={number} />

      <div className="text-xs sm:text-sm text-justify space-y-4">
        <p className="leading-relaxed">{opening}</p>
        <InfoRows rows={publisherRows(submission)} />

        <div className="font-sans">
          <p className="font-semibold text-slate-800 mb-2">Hasil verifikasi berkas persyaratan:</p>
          <table className="w-full text-xs sm:text-sm border border-slate-200">
            <tbody>
              {documents.map((d, i) => (
                <tr key={d.id || i} className="border-b border-slate-100">
                  <td className="py-1.5 px-3 w-8 text-slate-500">{i + 1}.</td>
                  <td className="py-1.5 px-3">{d.document_title}</td>
                  <td className="py-1.5 px-3 text-right font-semibold text-emerald-700">{d.screening_status || 'Sesuai'}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1.5 px-3 text-slate-500">{documents.length + 1}.</td>
                <td className="py-1.5 px-3">Pembayaran iuran / biaya pendaftaran</td>
                <td className="py-1.5 px-3 text-right font-semibold text-emerald-700">{paymentText}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="indent-8 leading-relaxed">{closing}</p>
      </div>

      <PengurusSignatureBlock submission={submission} settings={settings} docKey="berita_acara" signing={signing} />
    </DocShell>
  );
}

/* ═══════════════ SURAT KEPUTUSAN ═══════════════ */

export function SuratKeputusan({ submission, settings, signing = null }) {
  if (!submission) return null;
  const isHeregistrasi = submission.submission_type === 'Heregistrasi';
  const refNumber = submission.reference_number || 'Otomatis';
  const number = `SK/${refNumber}`;
  const dateStr = formatLongDate(submission.letter_date);
  const category = submission.member_category || submission.category || 'Biasa';
  const about = isHeregistrasi
    ? 'PERPANJANGAN KEANGGOTAAN IKATAN PENERBIT INDONESIA'
    : 'PENERIMAAN ANGGOTA BARU IKATAN PENERBIT INDONESIA';

  const menimbang = [
    `bahwa ${submission.publisher_name || 'penerbit pemohon'} telah mengajukan permohonan ${typeLabel(submission).toLowerCase()} kepada Pengurus Daerah IKAPI Jawa Barat;`,
    'bahwa berdasarkan Berita Acara Verifikasi, seluruh berkas persyaratan dan kewajiban pembayaran telah dinyatakan lengkap dan sah;',
    'bahwa berdasarkan pertimbangan tersebut perlu ditetapkan Surat Keputusan Pengurus Daerah.',
  ];
  const mengingat = [
    'Anggaran Dasar dan Anggaran Rumah Tangga Ikatan Penerbit Indonesia (IKAPI);',
    'Peraturan Organisasi IKAPI tentang Keanggotaan;',
    'Program Kerja Pengurus Daerah IKAPI Jawa Barat.',
  ];
  const memutuskan = [
    ['KESATU', `${isHeregistrasi ? 'Memperpanjang keanggotaan' : 'Menerima'} ${submission.publisher_name || '-'} (${submission.legal_entity || 'Badan Usaha'}), dengan pimpinan ${submission.leader_name || '-'}, sebagai Anggota ${category} Ikatan Penerbit Indonesia (IKAPI) Pengurus Daerah Jawa Barat.`],
    ['KEDUA', 'Merekomendasikan kepada Pengurus Pusat IKAPI untuk menerbitkan Nomor Kartu Tanda Anggota (KTA) bagi penerbit sebagaimana dimaksud pada diktum KESATU.'],
    ['KETIGA', 'Keputusan ini berlaku sejak tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat kekeliruan akan diperbaiki sebagaimana mestinya.'],
  ];

  const handleDownload = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    let y = drawKopPdf(doc, settings);
    y = drawTitlePdf(doc, y + 2, 'SURAT KEPUTUSAN PENGURUS DAERAH IKAPI JAWA BARAT', number);
    doc.setFont('times', 'bold');
    doc.text('TENTANG', 105, y, { align: 'center' });
    doc.text(about, 105, y + 5, { align: 'center' });
    y += 14;
    doc.setFontSize(10);

    const drawList = (label, items) => {
      doc.setFont('times', 'bold');
      doc.text(label, 20, y);
      doc.setFont('times', 'normal');
      items.forEach((item, i) => {
        const lines = doc.splitTextToSize(`${String.fromCharCode(97 + i)}. ${item}`, 140);
        doc.text(lines, 50, y);
        y += lines.length * 5 + 1;
      });
      y += 3;
    };
    drawList('Menimbang', menimbang);
    drawList('Mengingat', mengingat);

    doc.setFont('times', 'bold');
    doc.text('MEMUTUSKAN', 105, y, { align: 'center' });
    y += 7;
    memutuskan.forEach(([label, text]) => {
      doc.setFont('times', 'bold');
      doc.text(label, 20, y);
      doc.setFont('times', 'normal');
      const lines = doc.splitTextToSize(`: ${text}`, 140);
      doc.text(lines, 50, y);
      y += lines.length * 5 + 2;
    });

    y += 4;
    doc.text(`Ditetapkan di : Bandung`, 125, y);
    doc.text(`Pada tanggal  : ${dateStr}`, 125, y + 5);
    if (y > 215) {
      doc.addPage();
      y = 15;
    }
    drawPengurusSignaturesPdf(doc, { submission, settings, docKey: 'sk', y: y + 16 });
    doc.save(`Surat_Keputusan_${fileSafe(submission.publisher_name)}.pdf`);
  };

  return (
    <DocShell icon={Gavel} title="Surat Keputusan Pengurus Daerah" number={number} signing={signing} onDownload={handleDownload}>
      <KopSurat settings={settings} />
      <DocTitle title="Surat Keputusan Pengurus Daerah IKAPI Jawa Barat" number={number} />
      <p className="text-center text-xs sm:text-sm font-bold -mt-3 mb-6">TENTANG<br />{about}</p>

      <div className="text-xs sm:text-sm space-y-4">
        {[['Menimbang', menimbang], ['Mengingat', mengingat]].map(([label, items]) => (
          <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-2">
            <span className="font-semibold">{label}</span>
            <ol className="list-[lower-alpha] pl-4 space-y-1 text-justify">
              {items.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </div>
        ))}

        <p className="text-center font-bold tracking-wide pt-2">MEMUTUSKAN</p>
        {memutuskan.map(([label, text]) => (
          <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-2">
            <span className="font-semibold">{label}</span>
            <span className="text-justify">: {text}</span>
          </div>
        ))}

        <div className="flex justify-end pt-2 font-sans">
          <div className="text-left">
            <p>Ditetapkan di : Bandung</p>
            <p>Pada tanggal &nbsp;: {dateStr}</p>
          </div>
        </div>
      </div>

      <PengurusSignatureBlock submission={submission} settings={settings} docKey="sk" signing={signing} className="mt-6 pt-4" />
    </DocShell>
  );
}
