import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Highlighter, MessageSquareText, ChevronLeft, ChevronRight, Upload, ExternalLink } from 'lucide-react';
import DocumentMarker, { parseMarks, adminGeneralNote } from './DocumentMarker';
import { fileUrl } from '../utils/fileUrl';

/**
 * Tampilan pemohon untuk dokumen yang dikembalikan Admin:
 * dokumen dengan sorotan kuning di kiri, daftar bagian yang perlu diperbaiki di kanan.
 * Klik nomor di daftar atau kotak di dokumen untuk berpindah sorotan.
 */
export default function RevisionMarksViewer({ doc, onClose }) {
  const marks = parseMarks(doc?.revision_marks);
  const [active, setActive] = useState(marks.length ? 0 : null);
  const listRef = useRef(null);
  const total = marks.length;
  const round = (Number(doc?.revision_count) || 0) + 1;

  // Catatan umum disembunyikan bila hanya gabungan otomatis dari catatan sorotan
  const general = adminGeneralNote(doc, marks);
  const showGeneral = Boolean(general);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (!total) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setActive((i) => ((i ?? -1) + 1) % total);
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setActive((i) => ((i ?? 0) - 1 + total) % total);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, total]);

  useEffect(() => {
    if (active == null) return;
    const box = listRef.current;
    const el = box?.querySelector(`[data-item="${active}"]`);
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top) box.scrollTo({ top: box.scrollTop - (b.top - r.top) - 8, behavior: 'auto' });
    else if (r.bottom > b.bottom) box.scrollTo({ top: box.scrollTop + (r.bottom - b.bottom) + 8, behavior: 'auto' });
  }, [active]);

  const go = (step) => setActive((i) => ((i ?? 0) + step + total) % total);

  return createPortal(
    <div className="fixed inset-0 z-[80] modal-overlay flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl h-full sm:h-[94vh] flex flex-col bg-white sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="relative px-5 sm:px-6 py-4 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 text-amber-950">
          <div className="flex items-start gap-3 pr-10">
            <span className="flex-shrink-0 w-11 h-11 rounded-2xl bg-white/60 flex items-center justify-center shadow-sm">
              <Highlighter className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/80">Perlu revisi ke-{round}</p>
              <h3 className="text-base sm:text-lg font-bold leading-tight truncate">{doc.document_title}</h3>
              <p className="text-xs text-amber-900/90 mt-0.5">
                Admin menandai <strong>{total} bagian</strong> yang perlu diperbaiki. Klik nomor untuk melihat letaknya.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup"
            className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-white/70 hover:bg-white text-amber-950 flex items-center justify-center shadow-sm transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Isi */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          <div className="flex-shrink-0 h-[60vh] lg:h-auto lg:flex-shrink lg:flex-1 min-w-0 min-h-0 flex flex-col">
            <DocumentMarker file={doc} marks={marks} activeIndex={active} onSelect={setActive} hideList
              zoomable className="flex-1" viewerClassName="" />
          </div>

          <aside className="lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 flex flex-col lg:min-h-0">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Yang perlu diperbaiki</p>
              {total > 1 && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => go(-1)} aria-label="Sorotan sebelumnya"
                    className="w-7 h-7 rounded-full bg-white ring-1 ring-slate-200 hover:bg-slate-100 flex items-center justify-center">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] text-slate-500 tabular-nums w-10 text-center">{(active ?? 0) + 1}/{total}</span>
                  <button type="button" onClick={() => go(1)} aria-label="Sorotan berikutnya"
                    className="w-7 h-7 rounded-full bg-white ring-1 ring-slate-200 hover:bg-slate-100 flex items-center justify-center">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div ref={listRef} className="lg:flex-1 lg:min-h-0 lg:overflow-auto px-4 pb-4 space-y-2">
              {marks.map((m, i) => {
                const on = active === i;
                return (
                  <button key={i} type="button" data-item={i} onClick={() => setActive(i)}
                    className={`w-full text-left flex items-start gap-3 p-3 rounded-2xl transition ${on
                      ? 'bg-amber-50 ring-2 ring-amber-400 shadow-sm'
                      : 'bg-white ring-1 ring-slate-200 hover:ring-amber-300'}`}>
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center ${on ? 'bg-amber-600' : 'bg-amber-500'}`}>
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] text-slate-500">Halaman {m.page || 1}</span>
                      <span className={`block text-sm leading-snug ${m.note ? 'text-slate-800' : 'text-slate-500 italic'}`}>
                        {m.note || 'Bagian ini perlu diperbaiki.'}
                      </span>
                    </span>
                  </button>
                );
              })}

              {showGeneral && (
                <div className="mt-3 p-3 rounded-2xl bg-white ring-1 ring-slate-200">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <MessageSquareText className="w-3.5 h-3.5" /> Catatan Admin
                  </p>
                  <p className="text-sm text-slate-800 leading-snug mt-1">{general}</p>
                </div>
              )}
            </div>
            <div className="mx-4 mb-4 mt-auto p-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-xs text-amber-950">
              <p className="font-semibold mb-1.5">Langkah memperbaiki</p>
              <ol className="list-decimal pl-4 space-y-1 text-amber-900">
                <li>Perbaiki bagian bernomor pada file asli.</li>
                <li>Simpan ulang sebagai PDF atau gambar yang jelas.</li>
                <li>Tutup jendela ini, lalu unggah file pengganti.</li>
              </ol>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5 text-amber-600" />
            Perbaiki semua bagian di atas, lalu unggah file pengganti untuk dokumen ini.
          </p>
          <div className="flex gap-2 sm:flex-shrink-0">
            {doc.file_path && (
              <a href={fileUrl(doc.file_path)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full ring-1 ring-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50">
                <ExternalLink className="w-3.5 h-3.5" /> Buka file asli
              </a>
            )}
            <button type="button" onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-sm">
              Mengerti
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}
