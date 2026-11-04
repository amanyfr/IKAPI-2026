import React from 'react';
import { Printer, Download, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PengurusSignatureBlock, drawPengurusSignaturesPdf } from './PengurusSignature';

const PENGESAHAN_TEXT = 'Formulir ini telah diperiksa dan disahkan oleh Pengurus Daerah IKAPI Jawa Barat.';

// `signing` (opsional): mode pembubuhan TTD pada kolom pengesahan pengurus (lihat PengurusSignature)
export default function OfficialApplicationFormPdf({ submission, settings, signing = null }) {
  if (!submission) return null;

  const formData = typeof submission.form_data === 'string'
    ? JSON.parse(submission.form_data || '{}')
    : submission.form_data || {};

  const isHeregistrasi = submission.submission_type === 'Heregistrasi';
  const specStr = Array.isArray(formData.specialization)
    ? formData.specialization.join(', ')
    : (submission.specialization || formData.specialization || 'Buku Pendidikan, Referensi, Umum');

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
    doc.text('FORMULIR PENDAFTARAN & PENDATAAN ANGGOTA IKAPI 2026', 105, 16, { align: 'center' });
    doc.setFontSize(10.5);
    doc.text('IKATAN PENERBIT INDONESIA PENGURUS DAERAH JAWA BARAT', 105, 22, { align: 'center' });
    doc.setFontSize(8.5);
    doc.setFont('times', 'normal');
    doc.text('Berdasarkan Standar Formulir IKAPI 2026 (Anggota Baru & Heregistrasi)', 105, 27, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(15, 30, 195, 30);

    let y = 37;
    const writeSection = (title, rows) => {
      if (y > 255) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text(title, 15, y);
      y += 5.5;
      doc.setFontSize(9);
      rows.forEach(([label, val]) => {
        if (y > 272) {
          doc.addPage();
          y = 20;
        }
        doc.setFont('times', 'bold');
        doc.text(label, 18, y);
        doc.setFont('times', 'normal');
        const splitVal = doc.splitTextToSize(`: ${val || '-'}`, 115);
        doc.text(splitVal, 75, y);
        y += Math.max(5, splitVal.length * 4.5);
      });
      y += 2.5;
    };

    const rowsIdentitas = [
      ['Jenis Pengajuan', isHeregistrasi ? 'Heregistrasi (Anggota Lama)' : 'Anggota Baru'],
      ['Kategori Anggota', `Anggota ${submission.member_category || submission.category || formData.category || 'Biasa'}`],
      ...(isHeregistrasi ? [['No. Anggota IKAPI (KTA Lama)', submission.old_kta_number || formData.oldKtaNumber || '-']] : []),
      ['Nama Penerbit / Lembaga', submission.publisher_name || formData.publisherName || '-'],
      ['Bentuk Badan Hukum', submission.legal_entity || formData.legalEntity || '-'],
      ['NIB / NPWP', `${submission.nib || formData.nib || '-'} / ${submission.npwp || formData.npwp || '-'}`],
      ['Nama Pimpinan', `${submission.leader_name || formData.leaderName || '-'} (${submission.leader_title || formData.leaderTitle || 'Pimpinan'})`],
      ['Alamat Kantor', `${submission.address || formData.address || '-'}, ${submission.city || formData.city || '-'} ${submission.postal_code || formData.postalCode || ''}`],
      ['Telepon / Faksimili', `${submission.publisher_phone || formData.phone || '-'} / ${submission.fax || formData.fax || '-'}`],
      ['Email / Website', `${submission.publisher_email || formData.email || '-'} / ${submission.website || formData.website || '-'}`],
      ['Penanggung Jawab Penerbitan', `${submission.person_in_charge || formData.personInCharge || '-'} (No. BNSP: ${submission.bnsp_certificate_no || formData.bnspCertificateNo || '-'})`],
    ];
    writeSection('1. IDENTITAS ANGGOTA PENERBIT', rowsIdentitas);

    if (!isHeregistrasi) {
      writeSection('2. PROFIL PENERBIT (ANGGOTA BARU)', [
        ['Tujuan Menjadi Anggota', formData.tujuanMenjadiAnggota || 'Meningkatkan profesionalisme & jejaring penerbitan buku'],
        ['Tahun Mulai Usaha', formData.tahunMulaiUsaha || 'Berdasarkan akta / buku terbit'],
      ]);
    }

    writeSection('3. DATA TERBITAN', [
      ['Jenis Terbitan / Spesialisasi', specStr],
      ['Jumlah Judul Terbit', `${formData.jumlahJudulTerbit || '20'} Judul`],
      ['Rata-rata Oplah Cetakan Pertama', `${formData.rataRataOplah || '1000'} Eksemplar`],
      ['Rencana Produksi', `${formData.annualBookCount || '15'} Judul / Tahun`],
    ]);

    writeSection('4. PEMASARAN & PENJUALAN', [
      ['Sistem Pemasaran', formData.sistemPemasaran || 'Toko Buku, Online, & Instansi'],
      ['Rata-rata Diskon (%)', `${formData.rataRataDiskon || '30'}%`],
      ['Sistem Penjualan', formData.sistemPenjualan || 'Tunai, Kredit, dan Konsinyasi'],
    ]);

    writeSection('5. PENGADAAN NASKAH', [
      ['Sistem Pengadaan Naskah', formData.sistemPengadaanNaskah || 'Royalti & Beli Putus'],
      ['Besaran Royalti (%)', formData.persentaseRoyalti || '10%'],
    ]);

    const rowsOrganisasi = [
      ['Jumlah Karyawan per Bagian', `Redaksi: ${formData.jumlahKaryawanRedaksi || 3}, Produksi: ${formData.jumlahKaryawanProduksi || 2}, Pemasaran: ${formData.jumlahKaryawanPemasaran || 2}, Admin: ${formData.jumlahKaryawanAdmin || 2}`],
      ['Kepemilikan Kantor', formData.kepemilikanKantor || 'Milik Sendiri'],
      ['Lokasi Kantor', formData.lokasiKantor || 'Gedung Perkantoran / Ruko'],
      ...(isHeregistrasi ? [
        ['Kantor Cabang / Perwakilan', formData.kantorCabang || '-'],
        ['Lini Penerbitan', formData.liniPenerbitan || 'Penerbitan Utama'],
      ] : [])
    ];
    writeSection('6. ORGANISASI & KANTOR', rowsOrganisasi);

    writeSection('7. DATA TEKNIS PRODUKSI', [
      ['Software Produksi', formData.softwareProduksi || 'Adobe InDesign, Illustrator, Photoshop'],
      ['Contoh No. ISBN', formData.contohIsbn || '978-623-00-0000-1'],
      ['Jenis Kertas', formData.jenisKertas || 'Bookpaper, HVS, Art Carton'],
      ['Sistem Pencetakan', formData.sistemCetak || 'Cetak di Luar'],
      ['Pekerjaan yang Di-outsource', formData.pekerjaanOutsource || 'Percetakan Massal'],
    ]);

    if (y > 245) {
      doc.addPage();
      y = 25;
    }
    y += 4;
    doc.text(`Bandung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 140, y);
    doc.text('Pimpinan Penerbit Pemohon,', 140, y + 5);
    doc.setFont('times', 'bold');
    doc.text(submission.leader_name || formData.leaderName || 'Pimpinan Penerbit', 140, y + 22);

    // Pengesahan Pengurus Daerah (TTD Ketua & Sekretaris)
    y += 34;
    if (y > 225) {
      doc.addPage();
      y = 25;
    }
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.text(PENGESAHAN_TEXT, 105, y, { align: 'center' });
    drawPengurusSignaturesPdf(doc, {
      submission, settings, docKey: 'formulir', y: y + 10,
      heading: ['PENGESAHAN PENGURUS DAERAH', 'IKAPI JAWA BARAT'],
    });

    doc.save(`Formulir_IKAPI_2026_${submission.publisher_name ? submission.publisher_name.replace(/\s+/g, '_') : 'Pemohon'}.pdf`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`bg-[#f0f9ff] px-6 py-3 border-b border-[#b8e6fc] flex-wrap items-center justify-between gap-3 no-print ${signing ? 'hidden' : 'flex'}`}>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-[#0da2e7]" />
          <span className="font-bold text-slate-800 text-sm">
            Formulir Digital Resmi IKAPI 2026 (Lampiran PDF)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Formulir
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-3.5 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" /> Unduh PDF Formulir 2026
          </button>
        </div>
      </div>

      <div className="p-8 sm:p-10 max-w-3xl mx-auto font-sans text-slate-900 bg-white space-y-6">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-4">
          <h2 className="text-base sm:text-lg font-black tracking-wide text-[#0884c4] uppercase">
            Formulir Pendaftaran & Heregistrasi Anggota IKAPI 2026
          </h2>
          <h3 className="text-sm font-bold text-slate-700 uppercase">
            Ikatan Penerbit Indonesia (IKAPI) Pengurus Daerah Jawa Barat
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Jenis Pengajuan: <strong>{submission.submission_type}</strong> • Kategori: <strong>Anggota {submission.member_category || submission.category || 'Biasa'}</strong>
          </p>
        </div>

        {/* 1. Identitas */}
        <FormSection title="1. Identitas Anggota Penerbit">
          <FormRow label="Jenis Pengajuan" value={submission.submission_type} />
          <FormRow label="Kategori Anggota" value={`Anggota ${submission.member_category || submission.category || 'Biasa'}`} />
          {isHeregistrasi && (
            <FormRow label="No. Anggota IKAPI (KTA Lama)" value={submission.old_kta_number || formData.oldKtaNumber || '-'} />
          )}
          <FormRow label="Nama Penerbit" value={submission.publisher_name || formData.publisherName} bold />
          <FormRow label="Bentuk Badan Usaha / Institusi" value={submission.legal_entity || formData.legalEntity || 'PT / CV'} />
          <FormRow label="NIB / NPWP" value={`NIB: ${submission.nib || formData.nib || '-'} | NPWP: ${submission.npwp || formData.npwp || '-'}`} />
          <FormRow label="Nama Pimpinan" value={`${submission.leader_name || formData.leaderName || '-'} (${submission.leader_title || formData.leaderTitle || 'Pimpinan'})`} />
          <FormRow label="Alamat Kantor" value={`${submission.address || formData.address || '-'}, ${submission.city || formData.city || '-'} ${submission.postal_code || formData.postalCode || ''}`} />
          <FormRow label="Telepon / Faksimili" value={`Telp: ${submission.publisher_phone || formData.phone || '-'} | Fax: ${submission.fax || formData.fax || '-'}`} />
          <FormRow label="Email / Website" value={`Email: ${submission.publisher_email || formData.email || '-'} | Web: ${submission.website || formData.website || '-'}`} />
          <FormRow label="Penanggung Jawab Penerbitan" value={`${submission.person_in_charge || formData.personInCharge || '-'} (No. Sertifikat BNSP: ${submission.bnsp_certificate_no || formData.bnspCertificateNo || 'Terverifikasi'})`} />
        </FormSection>

        {/* 2. Profil (Khusus Baru) */}
        {!isHeregistrasi && (
          <FormSection title="2. Profil Penerbit (Anggota Baru)">
            <FormRow label="Tujuan Menjadi Anggota" value={formData.tujuanMenjadiAnggota || 'Meningkatkan profesionalisme penerbitan & jejaring distribusi buku'} />
            <FormRow label="Tahun Mulai Usaha" value={formData.tahunMulaiUsaha || 'Berdasarkan buku terbit / akta pendirian'} />
          </FormSection>
        )}

        {/* 3. Terbitan */}
        <FormSection title="3. Data Terbitan">
          <FormRow label="Jenis Terbitan" value={specStr} />
          <FormRow label="Jumlah Judul Terbit" value={`${formData.jumlahJudulTerbit || '25'} Judul`} />
          <FormRow label="Rata-rata Oplah Cetakan Pertama" value={`${formData.rataRataOplah || '1000'} Eksemplar`} />
          <FormRow label="Rencana Produksi (Judul/Tahun)" value={`${formData.annualBookCount || '15'} Judul / Tahun`} />
        </FormSection>

        {/* 4. Pemasaran */}
        <FormSection title="4. Pemasaran & Penjualan">
          <FormRow label="Sistem Pemasaran" value={formData.sistemPemasaran || 'Toko Buku, Online, & Instansi'} />
          <FormRow label="Rata-rata Diskon (%)" value={`${formData.rataRataDiskon || '30'}%`} />
          <FormRow label="Sistem Penjualan" value={formData.sistemPenjualan || 'Kredit / Tunai / Konsinyasi'} />
        </FormSection>

        {/* 5. Naskah */}
        <FormSection title="5. Pengadaan Naskah">
          <FormRow label="Sistem Pengadaan Naskah" value={formData.sistemPengadaanNaskah || 'Beli / Ditulis Sendiri / Royalti'} />
          <FormRow label="Persentase Royalti (%)" value={formData.persentaseRoyalti || '10%'} />
        </FormSection>

        {/* 6. Organisasi */}
        <FormSection title="6. Organisasi & Kantor">
          <FormRow
            label="Jumlah Karyawan per Bagian"
            value={`Redaksi: ${formData.jumlahKaryawanRedaksi || 4} org | Produksi: ${formData.jumlahKaryawanProduksi || 3} org | Pemasaran: ${formData.jumlahKaryawanPemasaran || 3} org | Admin: ${formData.jumlahKaryawanAdmin || 2} org`}
          />
          <FormRow label="Kepemilikan Kantor" value={formData.kepemilikanKantor || 'Milik Sendiri'} />
          <FormRow label="Lokasi Kantor" value={formData.lokasiKantor || 'Gedung Perkantoran / Ruko'} />
          {isHeregistrasi && (
            <>
              <FormRow label="Kantor Cabang / Perwakilan" value={formData.kantorCabang || '-'} />
              <FormRow label="Lini Penerbitan" value={formData.liniPenerbitan || 'Penerbitan Utama'} />
            </>
          )}
        </FormSection>

        {/* 7. Produksi */}
        <FormSection title="7. Data Teknis Produksi">
          <FormRow label="Software Produksi" value={formData.softwareProduksi || 'Adobe InDesign, Illustrator, Photoshop'} />
          <FormRow label="Contoh No. ISBN" value={formData.contohIsbn || '978-623-00-0000-1'} />
          <FormRow label="Jenis Kertas" value={formData.jenisKertas || 'Bookpaper, HVS, Art Carton'} />
          <FormRow label="Cetak Sendiri / Luar" value={formData.sistemCetak || 'Cetak di Luar'} />
          <FormRow label="Pekerjaan yang Di-outsource" value={formData.pekerjaanOutsource || 'Percetakan & Penjilidan'} />
        </FormSection>

        {/* Signature Box */}
        <div className="flex justify-end text-xs text-right pt-4">
          <div className="w-56 text-center space-y-10">
            <p className="text-slate-600">
              Bandung, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              <br />
              Pimpinan Penerbit Pemohon,
            </p>
            <div>
              <p className="font-bold text-slate-900 underline">{submission.leader_name || formData.leaderName}</p>
              <p className="text-slate-500">{submission.leader_title || formData.leaderTitle || 'Pimpinan'}</p>
            </div>
          </div>
        </div>

        {/* Pengesahan Pengurus Daerah */}
        <div className="border-t border-dashed border-slate-300 pt-4">
          <p className="text-xs text-slate-500 italic text-center">{PENGESAHAN_TEXT}</p>
          <PengurusSignatureBlock
            submission={submission}
            settings={settings}
            docKey="formulir"
            signing={signing}
            heading={<>PENGESAHAN PENGURUS DAERAH<br />IKAPI JAWA BARAT</>}
            className="mt-10 pt-2"
          />
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-[#0884c4] bg-[#f0f9ff] px-3 py-1.5 rounded-lg border-l-4 border-[#0da2e7] uppercase mb-2">
        {title}
      </h4>
      <table className="w-full text-xs">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function FormRow({ label, value, bold }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-1.5 w-2/5 text-slate-600 font-medium">{label}</td>
      <td className={`py-1.5 ${bold ? 'font-black text-slate-900' : 'text-slate-800'}`}>{value || '-'}</td>
    </tr>
  );
}
