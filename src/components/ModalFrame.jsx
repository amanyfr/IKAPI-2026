import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Bingkai modal pratinjau (invoice, paket dokumen, dll.).
 * Seluruh layar yang menggulir, bukan kotak di dalamnya, supaya tidak ada
 * garis scrollbar di samping dokumen. Tombol Tutup menempel di kanan atas kolom dokumen.
 */
export default function ModalFrame({ onClose, maxWidth = 'max-w-5xl', closeLabel = 'Tutup', children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`relative w-full ${maxWidth} mx-auto px-3 sm:px-6 pt-3 pb-10`} onClick={(e) => e.stopPropagation()}>
        {/* Tombol Tutup menempel di atas saat digulir (sticky), rata kanan dengan kolom dokumen:
            tidak pernah keluar dari layar meski jendela sempit. */}
        <div className="sticky top-3 z-[60] flex justify-end mb-3 pointer-events-none">
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto inline-flex items-center gap-1.5 pl-3 pr-4 py-2 rounded-full bg-white/95 text-slate-700 text-xs font-medium shadow-lg shadow-slate-950/20 ring-1 ring-slate-200 hover:bg-white hover:text-slate-900 transition"
          >
            <X className="w-4 h-4" /> {closeLabel}
          </button>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-950/40 ring-1 ring-white/10">
          {children}
        </div>
      </div>
    </div>
  , document.body);
}
