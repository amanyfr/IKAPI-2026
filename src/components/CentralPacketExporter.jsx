import React, { useState } from 'react';
import { Package, FileText, FileSpreadsheet, Paperclip, Download, Printer, CheckCircle, ExternalLink } from 'lucide-react';
import OfficialLetterGenerator from './OfficialLetterGenerator';
import OfficialApplicationFormPdf from './OfficialApplicationFormPdf';

export default function CentralPacketExporter({ submission, documents = [], settings }) {
  const [activeTab, setActiveTab] = useState('surat'); // 'surat' | 'formulir' | 'berkas'

  if (!submission) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-blue-900 text-white p-5 border-b-2 border-amber-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/30">
              <Package className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">
                  Paket Dokumen Pengiriman ke IKAPI Pusat
                </h3>
                <span className="bg-amber-400/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-amber-400/30">
                  3 Dokumen Wajib
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Bundel terpadu: Surat Pengantar Rekomendasi, Formulir Isian Resmi, dan Berkas Persyaratan Terverifikasi.
              </p>
            </div>
          </div>

          {/* Quick Print All */}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow flex items-center gap-2 transition"
          >
            <Printer className="w-4 h-4" /> Cetak Dokumen Saat Ini
          </button>
        </div>

        {/* 3-Tab Navigator */}
        <div className="flex space-x-2 mt-4 pt-3 border-t border-blue-800/80 no-print">
          <button
            onClick={() => setActiveTab('surat')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'surat'
                ? 'bg-white text-blue-950 shadow'
                : 'text-blue-200 hover:bg-blue-800/60'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-500" />
            1. Surat Pengantar Rekomendasi
          </button>

          <button
            onClick={() => setActiveTab('formulir')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'formulir'
                ? 'bg-white text-blue-950 shadow'
                : 'text-blue-200 hover:bg-blue-800/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            2. Formulir PDF Isian Anggota 2026
          </button>

          <button
            onClick={() => setActiveTab('berkas')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'berkas'
                ? 'bg-white text-blue-950 shadow'
                : 'text-blue-200 hover:bg-blue-800/60'
            }`}
          >
            <Paperclip className="w-4 h-4 text-purple-400" />
            3. Lampiran Berkas Persyaratan ({documents.length})
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="p-4 sm:p-6 bg-slate-50 min-h-[600px]">
        {activeTab === 'surat' && (
          <OfficialLetterGenerator submission={submission} settings={settings} />
        )}

        {activeTab === 'formulir' && (
          <OfficialApplicationFormPdf submission={submission} />
        )}

        {activeTab === 'berkas' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Lampiran Berkas Persyaratan Terverifikasi
                </h4>
                <p className="text-xs text-slate-500">
                  Semua berkas di bawah ini telah melalui verifikasi dan screening oleh Admin 1.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Lengkap & Sah
              </span>
            </div>

            <div className="space-y-3">
              {documents.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-xs">
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
                        className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 font-medium rounded-lg flex items-center gap-1 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Lihat Berkas
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

