import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Image as ImageIcon, Eye, Send, Loader2, ShieldCheck, X, ArrowLeft } from 'lucide-react';

// Pop-up ringkasan sebelum dokumen dikirim ke Admin.
// Pemohon melihat ulang daftar file (bisa dipratinjau) lalu memilih Kirim atau kembali untuk mengganti.

export const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isImageUpload = (file) => /^image\//.test(file?.type || '');

/**
 * items: [{ key, title, file?, savedName? }]
 *   file      = file baru yang dipilih (belum terkirim)
 *   savedName = file yang sudah tersimpan sebelumnya (tidak berubah)
 */
export default function UploadReviewDialog({
  open, title, description, items = [], note, confirmLabel = 'Kirim ke Admin', busy = false, onConfirm, onClose,
}) {
  // URL sementara untuk pratinjau file lokal (satu per file); dibersihkan saat pop-up ditutup
  const urlCache = useRef(new Map());
  const previewUrl = (file) => {
    if (!urlCache.current.has(file)) urlCache.current.set(file, URL.createObjectURL(file));
    return urlCache.current.get(file);
  };
  useEffect(() => {
    if (open) return undefined;
    urlCache.current.forEach((u) => URL.revokeObjectURL(u));
    urlCache.current.clear();
    return undefined;
  }, [open]);
  useEffect(() => () => urlCache.current.forEach((u) => URL.revokeObjectURL(u)), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  const newCount = items.filter((it) => it.file).length;

  return createPortal(
    <div className="fixed inset-0 z-[150] modal-overlay flex items-center justify-center p-4" onClick={() => !busy && onClose?.()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-review-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-sky-50 via-white to-emerald-50 border-b border-slate-100">
          <button type="button" onClick={onClose} disabled={busy} aria-label="Tutup"
            className="absolute top-4 right-4 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white flex items-center justify-center disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-[#0da2e7] text-white flex items-center justify-center shadow-md shadow-sky-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 id="upload-review-title" className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-1 text-sm text-slate-600 leading-relaxed">{description}</p>}
        </div>

        <ul className="px-6 py-4 space-y-2 max-h-[45vh] overflow-auto">
          {items.map((it) => {
            const Icon = it.file && isImageUpload(it.file) ? ImageIcon : FileText;
            return (
              <li key={it.key} className={`flex items-center gap-3 p-3 rounded-2xl border ${it.file ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-slate-50/60'}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${it.file ? 'bg-white text-[#0884c4] border border-sky-100' : 'bg-white text-slate-400 border border-slate-200'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{it.title}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {it.file
                      ? <>{it.file.name} · {formatFileSize(it.file.size)}</>
                      : <>{it.savedName || 'Sudah tersimpan'} · tidak berubah</>}
                  </p>
                </div>
                {it.file ? (
                  <a href={previewUrl(it.file)} target="_blank" rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-full text-xs font-medium text-[#0884c4] hover:bg-white flex items-center gap-1 flex-shrink-0">
                    <Eye className="w-3.5 h-3.5" /> Lihat
                  </a>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">Tersimpan</span>
                )}
              </li>
            );
          })}
        </ul>

        {note && (
          <p className="mx-6 mb-4 px-3.5 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">{note}</p>
        )}

        <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row gap-2">
          <button type="button" onClick={onClose} disabled={busy}
            className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 disabled:opacity-50">
            <ArrowLeft className="w-4 h-4" /> Periksa lagi
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="flex-1 py-2.5 rounded-2xl bg-[#0da2e7] hover:bg-[#0884c4] text-white text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-70">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? 'Mengirim…' : newCount > 0 ? `${confirmLabel} (${newCount})` : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
