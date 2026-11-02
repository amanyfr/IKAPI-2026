import React, { useState } from 'react';
import { Package, FileText, FileSpreadsheet, Paperclip, Printer, CheckCircle, ExternalLink, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import OfficialLetterGenerator from './OfficialLetterGenerator';
import OfficialApplicationFormPdf from './OfficialApplicationFormPdf';

export default function CentralPacketExporter({ submission, documents = [], settings }) {
  const [activeTab, setActiveTab] = useState('surat'); // 'surat' | 'formulir' | 'berkas'

  if (!submission) return null;

  // Generate Combined Documents PDF (PRD Section 6: Gabungan berkas - Semua berkas persyaratan digabung menjadi satu PDF)
  const handleDownloadCombinedDocsPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    // Page 1: Cover & Verification Index of All Combined Documents
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('DOKUMEN GABUNGAN BERKAS PERSYARATAN KEANGGOTAAN', 105, 22, { align: 'center' });
    doc.setFontSize(11);
    doc.text('IKATAN PENERBIT INDONESIA (IKAPI) PENGURUS DAERAH JAWA BARAT', 105, 28, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(20, 33, 190, 33);

    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text(`Nama Penerbit      : ${submission.publisher_name || '-'}`, 20, 44);
    doc.text(`Jenis Pengajuan    : ${submission.submission_type || 'Baru'}`, 20, 50);
    doc.text(`Kategori Anggota   : Anggota ${submission.member_category || submission.category || 'Biasa'}`, 20, 56);
    doc.text(`Nomor Surat        : ${submission.reference_number || '012/PD-Ikapi Jabar/IV/2026'}`, 20, 62);
    doc.text(`Status Pengajuan   : ${submission.status}`, 20, 68);

    doc.setFont('times', 'bold');
    doc.text('DAFTAR ISI GABUNGAN BERKAS PERSYARATAN:', 20, 80);

    let y = 88;
    documents.forEach((d, i) => {
      doc.setFont('times', 'bold');
      doc.text(`${i + 1}. ${d.document_title}`, 24, y);
      doc.setFont('times', 'normal');
      doc.text(`   Nama File : ${d.file_name || 'Dokumen.pdf'} | Status Screening Admin 1 : ${d.screening_status || 'Sesuai'}`, 24, y + 5);
      y += 13;
    });

    // Add individual attachment sheet for each document in the combined PDF
    documents.forEach((d, i) => {
      doc.addPage();
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.text(`LAMPIRAN BERKAS #${i + 1} DARI ${documents.length}`, 105, 22, { align: 'center' });
      doc.setFontSize(13);
      doc.text((d.document_title || '').toUpperCase(), 105, 30, { align: 'center' });
      doc.setLineWidth(0.4);
      doc.line(20, 35, 190, 35);

      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text(`Penerbit Pemohon   : ${submission.publisher_name || '-'}`, 20, 48);
      doc.text(`Jenis Berkas       : ${d.document_title}`, 20, 55);
      doc.text(`Nama File Terunggah: ${d.file_name || '-'}`, 20, 62);
      doc.text(`Hasil Verifikasi   : ${d.screening_status || 'Sesuai'} (Telah Diverifikasi oleh Admin 1 PD IKAPI Jabar)`, 20, 69);

      doc.rect(20, 80, 170, 160);
      doc.setFont('times', 'italic');
      doc.text('Salinan Digital Berkas Terverifikasi Terlampir dalam Sistem IKAPI Jawa Barat', 105, 155, { align: 'center' });
      if (d.file_path) {
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.text(`Path Berkas: ${d.file_path}`, 105, 163, { align: 'center' });
      }
    });

    doc.save(`Gabungan_Berkas_Persyaratan_${submission.publisher_name ? submission.publisher_name.replace(/\s+/g, '_') : 'IKAPI'}.pdf`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-[#0da2e7] text-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">
                  Paket Dokumen Pengiriman ke IKAPI Pusat
                </h3>
                <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold border border-white/30">
                  3 Output Dokumen Resmi
                </span>
              </div>
              <p className="text-xs text-[#dff2fd] mt-0.5">
                Satu paket pengiriman ke IKAPI Pusat: Surat Pengantar, Formulir PDF, dan Gabungan Berkas Persyaratan.
              </p>
            </div>
          </div>

          {/* Quick Print All */}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-white hover:bg-[#f0f9ff] text-[#0884c4] font-bold text-xs rounded-xl shadow flex items-center gap-2 transition"
          >
            <Printer className="w-4 h-4" /> Cetak Dokumen Saat Ini
          </button>
        </div>

        {/* 3-Tab Navigator */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/20 no-print">
          <button
            onClick={() => setActiveTab('surat')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === 'surat'
                ? 'bg-white text-[#0884c4] shadow'
                : 'text-white/90 hover:bg-white/15'
            }`}
          >
            <FileText className="w-4 h-4" />
            1. Surat Pengantar ke IKAPI Pusat
          </button>

          <button
            onClick={() => setActiveTab('formulir')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === 'formulir'
                ? 'bg-white text-[#0884c4] shadow'
                : 'text-white/90 hover:bg-white/15'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            2. Formulir PDF (IKAPI 2026)
          </button>

          <button
            onClick={() => setActiveTab('berkas')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === 'berkas'
                ? 'bg-white text-[#0884c4] shadow'
                : 'text-white/90 hover:bg-white/15'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            3. Gabungan Berkas Persyaratan ({documents.length} Berkas)
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="p-4 sm:p-6 bg-[#f8fbfe] min-h-[600px]">
        {activeTab === 'surat' && (
          <OfficialLetterGenerator submission={submission} settings={settings} />
        )}

        {activeTab === 'formulir' && (
          <OfficialApplicationFormPdf submission={submission} />
        )}

        {activeTab === 'berkas' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-wrap items-center justify-between mb-4 pb-3 border-b border-slate-100 gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Gabungan Berkas Persyaratan Terverifikasi
                </h4>
                <p className="text-xs text-slate-500">
                  Semua berkas persyaratan di bawah ini dapat diunduh sebagai satu dokumen PDF gabungan untuk dikirim ke IKAPI Pusat.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Lengkap & Sah
                </span>
                <button
                  onClick={handleDownloadCombinedDocsPdf}
                  className="px-4 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh Gabungan Berkas (1 PDF)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {documents.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-[#0da2e7] hover:bg-[#f0f9ff]/40 transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-[#dff2fd] text-[#0884c4] font-bold flex items-center justify-center text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">{doc.document_title}</h5>
                      <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{doc.file_name || 'Dokumen.pdf'}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">Status: {doc.screening_status}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {doc.file_path && (
                      <a
                        href={doc.file_path}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-xs bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] font-semibold rounded-lg border border-[#b8e6fc] flex items-center gap-1 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Lihat File Asli
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
