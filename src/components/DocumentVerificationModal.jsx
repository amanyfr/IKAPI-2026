import React, { useState } from 'react';
import { 
  X, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  CreditCard, 
  Send, 
  Clock, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

export default function DocumentVerificationModal({ 
  isOpen, 
  onClose, 
  submission, 
  documents, 
  payment, 
  onScreenDocument, 
  onVerifyPayment, 
  onAdmin1Action,
  onPassToAdmin2 // opsional: alur pembubuhan TTD Sekretaris sebelum diteruskan
}) {
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'payment' | 'action'
  const [revisionNotes, setRevisionNotes] = useState({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!isOpen || !submission) return null;

  const allDocsSesuai = documents.length > 0 && documents.every(d => d.screening_status === 'Sesuai');
  const isPaymentValid = payment?.verification_status === 'Valid';
  const canPassToAdmin2 = allDocsSesuai && isPaymentValid;

  const handleDocStatusChange = async (docId, status) => {
    try {
      await onScreenDocument(docId, status, revisionNotes[docId] || '');
    } catch (err) {
      alert('Gagal memperbarui status: ' + err.message);
    }
  };

  const handlePassToAdmin2 = async () => {
    if (!canPassToAdmin2) {
      alert('Semua berkas harus berstatus "Sesuai" dan bukti pembayaran harus "Valid".');
      return;
    }
    if (onPassToAdmin2) {
      onPassToAdmin2(generalNotes);
      return;
    }
    setProcessing(true);
    try {
      await onAdmin1Action(submission.id, 'pass_to_admin2', generalNotes);
      onClose();
    } catch (err) {
      alert('Gagal meneruskan: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestRevision = async () => {
    setProcessing(true);
    try {
      await onAdmin1Action(submission.id, 'request_revision', generalNotes);
      onClose();
    } catch (err) {
      alert('Gagal meminta revisi: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-[#0da2e7] text-white px-6 py-4 flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#0884c4] rounded-lg text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-base sm:text-lg leading-tight">
                Screening Berkas & Verifikasi Pembayaran (Sekretaris)
              </h3>
              <p className="text-xs text-[#dff2fd] mt-0.5">
                {submission.publisher_name} • Kategori {submission.member_category || submission.category} ({submission.submission_type})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#dff2fd] hover:text-white hover:bg-[#0884c4] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 px-6 py-2 border-b border-slate-200 flex space-x-2">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'documents'
                ? 'bg-white text-[#0884c4] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-[#0da2e7]" />
            1. Screening Berkas Persyaratan ({documents.filter(d => d.screening_status === 'Sesuai').length}/{documents.length})
          </button>
          
          <button
            onClick={() => setActiveTab('payment')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'payment'
                ? 'bg-white text-[#0884c4] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4 text-emerald-600" />
            2. Verifikasi Pembayaran ({isPaymentValid ? 'Valid' : 'Pending'})
          </button>

          <button
            onClick={() => setActiveTab('action')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'action'
                ? 'bg-white text-[#0884c4] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRight className="w-4 h-4 text-amber-600" />
            3. Keputusan Verifikasi
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: SCREENING BERKAS */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Periksa setiap dokumen persyaratan di bawah. Tandai "Sesuai" atau "Perlu Revisi" jika ada kekurangan.
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  allDocsSesuai ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {allDocsSesuai ? 'Semua Berkas Sesuai' : 'Sebagian Belum Sesuai'}
                </span>
              </div>

              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-xl border transition ${
                      doc.screening_status === 'Sesuai'
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : doc.screening_status === 'Perlu Revisi'
                        ? 'border-amber-300 bg-amber-50/30'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-medium text-slate-800">
                            {doc.document_title}
                          </h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            doc.screening_status === 'Sesuai'
                              ? 'bg-emerald-100 text-emerald-800'
                              : doc.screening_status === 'Perlu Revisi'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {doc.screening_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {doc.file_name || 'Belum diunggah'}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-2">
                        {doc.file_path && (
                          <a
                            href={doc.file_path}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg font-medium flex items-center gap-1 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Buka File
                          </a>
                        )}

                        <button
                          onClick={() => handleDocStatusChange(doc.id, 'Sesuai')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition ${
                            doc.screening_status === 'Sesuai'
                              ? 'bg-emerald-600 text-white shadow'
                              : 'bg-slate-100 hover:bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Sesuai
                        </button>

                        <button
                          onClick={() => handleDocStatusChange(doc.id, 'Perlu Revisi')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 transition ${
                            doc.screening_status === 'Perlu Revisi'
                              ? 'bg-amber-600 text-white shadow'
                              : 'bg-slate-100 hover:bg-amber-100 text-amber-800'
                          }`}
                        >
                          <AlertCircle className="w-3.5 h-3.5" /> Revisi
                        </button>
                      </div>
                    </div>

                    {/* Revision Note Field if rejected or needing revision */}
                    {doc.screening_status === 'Perlu Revisi' && (
                      <div className="mt-3 pt-3 border-t border-amber-200/60">
                        <label className="text-[11px] font-semibold text-amber-900 block mb-1">
                          Catatan Perbaikan untuk Pemohon:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Contoh: Scan sertifikat terpotong, mohon unggah ulang dengan jelas..."
                            defaultValue={doc.revision_notes || ''}
                            onChange={(e) => setRevisionNotes({ ...revisionNotes, [doc.id]: e.target.value })}
                            className="flex-1 text-xs border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <button
                            onClick={() => handleDocStatusChange(doc.id, 'Perlu Revisi')}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition"
                          >
                            Simpan Catatan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: VERIFIKASI PEMBAYARAN */}
          {activeTab === 'payment' && (
            <div className="space-y-4">
              {payment ? (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-xs text-slate-500 font-medium">Tagihan Pembayaran IKAPI</span>
                      <h4 className="text-2xl font-light text-slate-900">
                        Rp {payment.amount?.toLocaleString('id-ID')}
                      </h4>
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        payment.verification_status === 'Valid'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : payment.verification_status === 'Perlu Revisi'
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        Status: {payment.verification_status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-700 block border-b pb-1">Data Pengirim Transfer:</span>
                      <p><strong className="text-slate-600">Bank Pengirim:</strong> {payment.sender_bank || '-'}</p>
                      <p><strong className="text-slate-600">Nama Rekening:</strong> {payment.sender_account_name || '-'}</p>
                      <p><strong className="text-slate-600">Nomor Rekening:</strong> {payment.sender_account_number || '-'}</p>
                      <p><strong className="text-slate-600">Tanggal Transfer:</strong> {payment.transfer_date || '-'}</p>
                    </div>

                    <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-700 block border-b pb-1">Rekening Tujuan IKAPI:</span>
                      <p><strong className="text-slate-600">Bank:</strong> Bank BNI</p>
                      <p><strong className="text-slate-600">Nomor Rekening:</strong> 2089992087</p>
                      <p><strong className="text-slate-600">Atas Nama:</strong> Abdul Rasyid</p>
                    </div>
                  </div>

                  {/* Bukti File */}
                  <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <span className="text-xs font-bold text-slate-700 block mb-2">Lampiran Bukti Transfer:</span>
                    {payment.proof_file ? (
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4 text-[#0884c4]" />
                          <span className="text-xs font-mono text-slate-800">{payment.proof_filename || 'Bukti_Transfer.jpg'}</span>
                        </div>
                        <a
                          href={payment.proof_file}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Lihat Bukti Transfer
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 italic">Pemohon belum mengunggah bukti transfer.</p>
                    )}
                  </div>

                  {/* Action to Mark Valid / Invalid */}
                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => onVerifyPayment(submission.id, 'Perlu Revisi', 'Bukti transfer tidak sesuai atau tidak terbaca.')}
                      className="px-4 py-2 border border-red-300 hover:bg-red-50 text-red-700 text-xs font-bold rounded-lg transition"
                    >
                      Tolak Pembayaran (Minta Upload Ulang)
                    </button>
                    <button
                      onClick={() => onVerifyPayment(submission.id, 'Valid', 'Pembayaran telah sesuai dengan mutasi bank.')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" /> Konfirmasi Pembayaran Valid
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Data pembayaran belum terbentuk.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: KEPUTUSAN KELENGKAPAN */}
          {activeTab === 'action' && (
            <div className="space-y-4">
              <div className="bg-[#f0f9ff]/50 p-4 rounded-xl border border-[#b8e6fc] text-xs space-y-2">
                <h4 className="font-medium text-slate-900">Ringkasan Kelayakan Pengajuan:</h4>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${allDocsSesuai ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>Berkas Persyaratan: {allDocsSesuai ? 'Lengkap & Sesuai' : 'Belum Semua Sesuai'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${isPaymentValid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>Verifikasi Pembayaran: {isPaymentValid ? 'Valid Lunas' : 'Belum Valid'}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Catatan Sekretaris untuk Tahapan Ini:
                </label>
                <textarea
                  rows="3"
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Catatan verifikasi atau pesan perbaikan..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0da2e7]"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <button
                  onClick={handleRequestRevision}
                  disabled={processing}
                  className="w-full sm:w-auto px-4 py-2.5 border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Kembalikan ke Pemohon untuk Revisi
                </button>

                <button
                  onClick={handlePassToAdmin2}
                  disabled={!canPassToAdmin2 || processing}
                  className={`w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 shadow ${
                    canPassToAdmin2
                      ? 'bg-[#0da2e7] hover:bg-[#0884c4] text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 text-amber-300" />
                  {onPassToAdmin2 ? 'Tanda Tangani & Teruskan ke Ketua' : 'Loloskan & Teruskan ke Ketua (Approval)'}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

