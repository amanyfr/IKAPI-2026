import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Loader2, Package, FileText, FileSpreadsheet, Paperclip, Printer, ExternalLink, Download, ClipboardCheck, Gavel } from 'lucide-react';
import OfficialLetterGenerator from './OfficialLetterGenerator';
import OfficialApplicationFormPdf from './OfficialApplicationFormPdf';
import { BeritaAcaraVerifikasi, SuratKeputusan } from './PengurusDocuments';
import { KopSurat, KopSuratFooter, formatLongDate } from './PengurusSignature';
import { fileUrl, authUrl } from '../utils/fileUrl';
import { downloadElementPdf, downloadElementsPdf, printElement, safeFileName } from '../utils/exportDocument';
import { notify } from './AppDialog';

export const officeAddress = (settings) =>
  settings?.office_address || 'Jl. Ibu Inggit Garnasih No. 148, Ciateul, Kec. Regol, Kota Bandung, Jawa Barat 40252';

// Daftar berkas fisik yang dicetak sendiri oleh pemohon dan dikirim ke sekretariat IKAPI Jawa Barat
export function physicalChecklist(submission, documents = []) {
  const isBaru = submission?.submission_type !== 'Heregistrasi';
  return [
    'Surat Pengantar IKAPI Jawa Barat (sudah ditandatangani Sekretaris & Ketua)',
    `${isBaru ? 'Formulir Menjadi Anggota IKAPI' : 'Formulir Heregistrasi Anggota IKAPI'}, ditandatangani penanggung jawab penerbit`,
    ...documents.map((d) => `Fotokopi ${d.document_title} (2 set)`),
    ...(isBaru ? ['Contoh buku terbitan minimal 3 judul, masing-masing 3 eksemplar, ber-ISBN'] : []),
    'Invoice / bukti transfer pembayaran',
  ];
}

function PhysicalChecklistSheet({ submission, documents, settings }) {
  const paperRef = useRef(null);
  const items = physicalChecklist(submission, documents);
  const fileName = `Daftar_Berkas_Fisik_${safeFileName(submission.publisher_name)}.pdf`;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#f0f9ff] px-6 py-3 border-b border-[#b8e6fc] flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold text-slate-800 text-sm">Daftar Kelengkapan Berkas Fisik</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => printElement(paperRef.current, fileName.replace('.pdf', ''))}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak
          </button>
          <button
            onClick={() => downloadElementPdf(paperRef.current, fileName)}
            className="px-3.5 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" /> Unduh PDF
          </button>
        </div>
      </div>

      <div ref={paperRef} data-paper className="p-8 sm:p-12 max-w-3xl mx-auto font-serif text-slate-900 leading-relaxed bg-white">
        <KopSurat settings={settings} />
        <h3 className="text-center text-base sm:text-lg font-bold uppercase underline underline-offset-4">Daftar Kelengkapan Berkas Fisik</h3>
        <p className="text-center text-xs sm:text-sm font-sans mt-1 mb-6">
          {submission.submission_type === 'Heregistrasi' ? 'Registrasi (Perpanjangan) Anggota IKAPI' : 'Pendaftaran Anggota Baru IKAPI'}
        </p>

        <div className="text-xs sm:text-sm font-sans space-y-1 mb-5">
          <p><span className="inline-block w-36">Nama Penerbit</span>: <strong>{submission.publisher_name || '-'}</strong></p>
          <p><span className="inline-block w-36">Nomor Surat Pengantar</span>: <span className="font-mono">{submission.reference_number || '-'}</span></p>
          <p><span className="inline-block w-36">Dikirim kepada</span>: Sekretariat IKAPI Jawa Barat, {officeAddress(settings)}</p>
        </div>

        <table className="w-full text-xs sm:text-sm font-sans border border-slate-300">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-300 px-2 py-1.5 w-10">No</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Berkas</th>
              <th className="border border-slate-300 px-2 py-1.5 w-20">Ada (✓)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item}>
                <td className="border border-slate-300 px-2 py-1.5 text-center">{i + 1}</td>
                <td className="border border-slate-300 px-2 py-1.5">{item}</td>
                <td className="border border-slate-300 px-2 py-1.5" />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-6 text-xs sm:text-sm font-sans mt-10 text-center">
          <div>
            <p>Pengirim,</p>
            <p className="mt-16">( {submission.person_in_charge || submission.leader_name || '____________________'} )</p>
          </div>
          <div>
            <p>Bandung, {formatLongDate()}</p>
            <p>Diterima oleh Sekretariat IKAPI Jabar,</p>
            <p className="mt-12">( ____________________ )</p>
          </div>
        </div>
        <KopSuratFooter className="mt-10" />
      </div>
    </div>
  );
}

export default function CentralPacketExporter({ submission, documents = [], settings, payment = null }) {
  const [activeTab, setActiveTab] = useState('surat');
  const [downloadingAll, setDownloadingAll] = useState(false);

  if (!submission) return null;

  // Unduh semua dokumen resmi sekaligus dalam satu PDF (urutan sama dengan tab)
  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    const host = document.createElement('div');
    Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: '794px', background: '#fff' });
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      flushSync(() => root.render(
        <div>
          <OfficialLetterGenerator submission={submission} settings={settings} />
          <OfficialApplicationFormPdf submission={submission} settings={settings} />
          <PhysicalChecklistSheet submission={submission} documents={documents} settings={settings} />
          <BeritaAcaraVerifikasi submission={submission} settings={settings} documents={documents} payment={payment} />
          <SuratKeputusan submission={submission} settings={settings} />
        </div>
      ));
      await downloadElementsPdf(
        Array.from(host.querySelectorAll('[data-paper]')),
        `Paket_Dokumen_IKAPI_${safeFileName(submission.publisher_name, 'Pemohon')}.pdf`
      );
    } catch (err) {
      notify('Gagal mengunduh semua dokumen: ' + err.message);
    } finally {
      root.unmount();
      host.remove();
      setDownloadingAll(false);
    }
  };

  const tabs = [
    { key: 'surat', icon: FileText, label: '1. Surat Pengantar' },
    { key: 'formulir', icon: FileSpreadsheet, label: '2. Formulir' },
    { key: 'berkas', icon: Paperclip, label: `3. Daftar Berkas Fisik (${documents.length} dokumen)` },
    { key: 'berita_acara', icon: ClipboardCheck, label: 'Berita Acara Verifikasi' },
    { key: 'sk', icon: Gavel, label: 'Surat Keputusan' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#0da2e7] text-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2.5 bg-white/20 rounded-xl">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-[14rem]">
            <h3 className="text-base sm:text-lg font-bold">Dokumen Resmi & Berkas Fisik</h3>
            <p className="text-xs text-[#dff2fd] mt-0.5">
              Cetak sendiri dokumen di bawah, lalu kirim bersama fotokopi berkas persyaratan ke sekretariat IKAPI Jawa Barat.
              Hasil unduhan PDF & cetak sama dengan tampilan di layar.
            </p>
          </div>
          <button
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="px-4 py-2.5 bg-white hover:bg-[#f0f9ff] text-[#0884c4] font-bold text-xs rounded-xl shadow flex items-center gap-2 transition disabled:opacity-70"
          >
            {downloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloadingAll ? 'Menyiapkan PDF...' : 'Unduh semua dokumen'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/20 no-print">
          {tabs.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
                activeTab === key ? 'bg-white text-[#0884c4] shadow' : 'text-white/90 hover:bg-white/15'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 bg-[#f8fbfe] min-h-[600px]">
        {activeTab === 'surat' && <OfficialLetterGenerator submission={submission} settings={settings} />}
        {activeTab === 'formulir' && <OfficialApplicationFormPdf submission={submission} settings={settings} />}
        {activeTab === 'berita_acara' && (
          <BeritaAcaraVerifikasi submission={submission} settings={settings} documents={documents} payment={payment} />
        )}
        {activeTab === 'sk' && <SuratKeputusan submission={submission} settings={settings} />}
        {activeTab === 'berkas' && (
          <div className="space-y-4">
            <PhysicalChecklistSheet submission={submission} documents={documents} settings={settings} />
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">File asli yang sudah diunggah (untuk dicetak / difotokopi)</p>
                {submission.id && documents.some((d) => d.file_path) && (
                  <a
                    href={authUrl(`/api/submissions/${submission.id}/documents/merged`)}
                    className="flex-shrink-0 px-3 py-1.5 text-xs bg-[#0da2e7] hover:bg-[#0884c4] text-white font-semibold rounded-lg flex items-center gap-1 transition"
                    title="Semua berkas persyaratan & bukti transfer digabung menjadi satu PDF"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh gabungan berkas (PDF)
                  </a>
                )}
              </div>
              {documents.map((doc, idx) => (
                <div key={doc.id || idx} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">{idx + 1}. {doc.document_title}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">{doc.file_name || '-'}</p>
                  </div>
                  {doc.file_path && (
                    <a
                      href={fileUrl(doc.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 px-3 py-1.5 text-xs bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] font-semibold rounded-lg border border-[#b8e6fc] flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Buka file
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
