import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X, ZoomIn, ZoomOut, Maximize2, MoveHorizontal } from 'lucide-react';
import { fileUrl } from '../utils/fileUrl';

// Sorotan bagian dokumen yang perlu direvisi.
// Satu tanda = { page, x, y, w, h, note } dengan koordinat relatif 0–1 terhadap halaman,
// jadi tetap pas di ukuran layar mana pun (Admin menandai, pemohon melihat).

export const isImageFile = (f) => /^image\//.test(f?.mime_type || '') || /\.(png|jpe?g|gif|webp)$/i.test(f?.file_path || f?.file_name || '');
export const isPdfFile = (f) => /pdf/.test(f?.mime_type || '') || /\.pdf$/i.test(f?.file_path || f?.file_name || '');
export const canMarkFile = (f) => Boolean(f?.file_path) && (isImageFile(f) || isPdfFile(f));

export function parseMarks(value) {
  if (!value) return [];
  try {
    const arr = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(arr) ? arr.filter((m) => m && Number.isFinite(m.x) && Number.isFinite(m.y)) : [];
  } catch {
    return [];
  }
}

const MAX_PAGES = 30;
const MIN_SIZE = 0.015; // seret terlalu kecil dianggap klik, bukan tanda

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

function PdfPage({ pdf, pageNumber, width, onRendered }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    let task = null;
    let cancelled = false;
    pdf.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: (width / base.width) * ratio });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
      task.promise.then(() => onRendered?.()).catch(() => {});
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, pageNumber, width]);
  return <canvas ref={canvasRef} className="block w-full bg-white" />;
}

// Satu halaman + lapisan tanda di atasnya
function MarkLayer({ page, marks, allMarks, editable, onAdd, onRemove, activeIndex, onSelect, children }) {
  const ref = useRef(null);
  const [draft, setDraftState] = useState(null);
  const draftRef = useRef(null); // ref: event pointer cepat tidak boleh membaca state lama
  const setDraft = (d) => { draftRef.current = d; setDraftState(d); };

  const point = (e) => {
    const r = ref.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const down = (e) => {
    if (!editable || e.button !== 0) return;
    e.preventDefault();
    ref.current.setPointerCapture?.(e.pointerId);
    const p = point(e);
    setDraft({ sx: p.x, sy: p.y, ex: p.x, ey: p.y });
  };
  const move = (e) => {
    const d = draftRef.current;
    if (!d) return;
    const p = point(e);
    setDraft({ ...d, ex: p.x, ey: p.y });
  };
  const up = (e) => {
    const d0 = draftRef.current;
    if (!d0) return;
    const p = point(e);
    const draft = { ...d0, ex: p.x, ey: p.y };
    const box = {
      page,
      x: Math.min(draft.sx, draft.ex), y: Math.min(draft.sy, draft.ey),
      w: Math.abs(draft.ex - draft.sx), h: Math.abs(draft.ey - draft.sy),
    };
    setDraft(null);
    if (box.w >= MIN_SIZE && box.h >= MIN_SIZE) onAdd(box);
  };

  const pct = (v) => `${(v * 100).toFixed(3)}%`;
  return (
    <div
      ref={ref}
      className={`relative select-none shadow-sm ${editable ? 'cursor-crosshair touch-none' : ''}`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDraft(null)}
    >
      {children}
      {/* Warna sorotan dipisah & memakai multiply agar teks di bawahnya tetap terbaca jelas */}
      {marks.map((m, i) => (
        <div key={`fill-${i}`} aria-hidden="true"
          className={`absolute rounded-sm pointer-events-none mix-blend-multiply transition-colors duration-300 ${activeIndex === allMarks.indexOf(m) ? 'bg-yellow-300/60' : 'bg-yellow-200/55'}`}
          style={{ left: pct(m.x), top: pct(m.y), width: pct(m.w), height: pct(m.h) }} />
      ))}
      {marks.map((m) => {
        const n = allMarks.indexOf(m) + 1;
        const active = activeIndex === n - 1;
        const selectable = !editable && onSelect;
        return (
          <div key={n} data-mark={n}
            className={`group absolute rounded-sm transition-all duration-300 ${active
              ? 'border-2 border-amber-500 ring-2 ring-amber-400/40 z-10'
              : 'border-[1.5px] border-amber-500/80'} ${selectable ? 'cursor-pointer hover:border-amber-600' : ''}`}
            style={{ left: pct(m.x), top: pct(m.y), width: pct(m.w), height: pct(m.h) }}
            onClick={selectable ? () => onSelect(n - 1) : undefined}
            title={m.note || `Bagian ${n}`}>
            {/* Nomor di luar kotak (sisi kiri) supaya tidak menutupi teks yang ditandai */}
            <span className={`absolute ${m.x < 0.04 ? 'left-0 bottom-full mb-1' : 'right-full mr-1 top-0'} w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-white ${active ? 'bg-amber-600 scale-110' : 'bg-amber-500'} transition-transform`}>
              {n}
            </span>
            {/* Catatan hanya muncul di bawah kotak saat tanda dipilih / disorot kursor */}
            {m.note && (
              <span className={`absolute left-0 top-full mt-1 max-w-[min(18rem,100%)] w-max px-2 py-1 rounded-lg bg-amber-600 text-white text-[10px] leading-snug font-medium shadow-md pointer-events-none z-20 transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {m.note}
              </span>
            )}
            {editable && (
              <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onRemove(m)}
                className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-white border border-amber-400 text-amber-700 flex items-center justify-center shadow hover:bg-amber-50"
                aria-label={`Hapus tanda ${n}`}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
      {draft && (
        <div className="absolute border-2 border-dashed border-amber-500 bg-yellow-300/30"
          style={{
            left: pct(Math.min(draft.sx, draft.ex)), top: pct(Math.min(draft.sy, draft.ey)),
            width: pct(Math.abs(draft.ex - draft.sx)), height: pct(Math.abs(draft.ey - draft.sy)),
          }} />
      )}
    </div>
  );
}

/**
 * Tampilkan dokumen (gambar / PDF per halaman) dengan sorotan kuning.
 * editable: Admin bisa menyeret kotak untuk menandai bagian & menulis catatan per tanda.
 */
export default function DocumentMarker({
  file, marks = [], onChange, editable = false, className = '',
  activeIndex = null, onSelect, hideList = false, viewerClassName = 'max-h-[60vh]', zoomable = false,
}) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [boxH, setBoxH] = useState(0);
  const [aspect, setAspect] = useState(null); // tinggi/lebar halaman pertama
  const [scale, setScale] = useState(zoomable ? null : 1); // null = pas satu halaman
  const [renderTick, setRenderTick] = useState(0); // naik tiap halaman PDF selesai digambar ulang
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');
  const url = file?.file_path ? fileUrl(file.file_path) : '';
  const pdfMode = isPdfFile(file);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => { setWidth(Math.max(200, Math.floor(el.clientWidth - 24))); setBoxH(el.clientHeight); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfMode || !url) return undefined;
    let doc = null;
    let cancelled = false;
    setPdf(null);
    setError('');
    loadPdfjs()
      .then((lib) => lib.getDocument({ url, withCredentials: true }).promise)
      .then((d) => { doc = d; if (cancelled) d.destroy(); else setPdf(d); })
      .catch(() => { if (!cancelled) setError('Dokumen PDF gagal dimuat. Buka di tab baru untuk memeriksa.'); });
    return () => { cancelled = true; doc?.destroy(); };
  }, [pdfMode, url]);

  useEffect(() => {
    if (!pdf) return;
    pdf.getPage(1).then((pg) => { const v = pg.getViewport({ scale: 1 }); setAspect(v.height / v.width); }).catch(() => {});
  }, [pdf]);

  // Lebar halaman: pas satu halaman (default penampil pemohon), lebar penuh, atau zoom manual
  const fitPageW = aspect && boxH > 0 ? Math.min(width, Math.floor((boxH - 24) / aspect)) : width;
  const pageW = Math.max(160, scale == null ? fitPageW : Math.round(width * scale));
  const zoomBy = (k) => setScale((v) => Math.min(3, Math.max(0.3, (v == null ? fitPageW / width : v) * k)));

  // Gulir ke sorotan yang dipilih (menunggu halaman PDF selesai dirender)
  useEffect(() => {
    if (activeIndex == null || !wrapRef.current) return undefined;
    const t = setTimeout(() => {
      // Gulir di dalam kotak dokumen saja (scrollIntoView ikut menggulir halaman di belakang modal)
      const box = wrapRef.current;
      const el = box?.querySelector(`[data-mark="${activeIndex + 1}"]`);
      if (!box || !el) return;
      const b = box.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      box.scrollTo({ top: box.scrollTop + (r.top - b.top) - (b.height - r.height) / 2 });
    }, 120);
    return () => clearTimeout(t);
  }, [activeIndex, pdf, pdfMode, pageW, renderTick]);

  const add = (box) => onChange?.([...marks, { ...box, note: '' }]);
  const remove = (m) => onChange?.(marks.filter((x) => x !== m));
  const setNote = (m, note) => onChange?.(marks.map((x) => (x === m ? { ...x, note } : x)));

  const pageCount = pdf ? Math.min(pdf.numPages, MAX_PAGES) : 1;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {editable && (
        <p className="px-3 py-2 text-[11px] text-amber-900 bg-amber-50 border-b border-amber-200">
          Seret pada dokumen untuk <strong>menyorot bagian yang perlu direvisi</strong>. Tanda bisa dihapus dengan tombol ×.
        </p>
      )}
      <div className="relative flex-1 min-h-0 flex flex-col">
      {zoomable && url && !error && (
        <div className="flex items-center justify-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-white text-slate-700">
          <button type="button" onClick={() => zoomBy(0.8)} aria-label="Perkecil" title="Perkecil"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"><ZoomOut className="w-4 h-4" /></button>
          <span className="w-12 text-center text-[11px] tabular-nums">{Math.round((pageW / Math.max(1, width)) * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.25)} aria-label="Perbesar" title="Perbesar"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"><ZoomIn className="w-4 h-4" /></button>
          <span className="w-px h-5 bg-slate-200 mx-1" />
          <button type="button" onClick={() => setScale(null)} title="Pas satu halaman"
            className={`h-8 px-2.5 rounded-full text-[11px] flex items-center gap-1 ${scale == null ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}>
            <Maximize2 className="w-3.5 h-3.5" /> Halaman
          </button>
          <button type="button" onClick={() => setScale(1)} title="Lebar penuh"
            className={`h-8 px-2.5 rounded-full text-[11px] flex items-center gap-1 ${scale === 1 ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}>
            <MoveHorizontal className="w-3.5 h-3.5" /> Lebar
          </button>
        </div>
      )}
      <div ref={wrapRef} className={`flex-1 min-h-[320px] ${viewerClassName} overflow-auto bg-slate-200/70 p-3 space-y-3`}>
        {!url ? (
          <p className="text-xs text-slate-500 text-center py-10">Belum ada file.</p>
        ) : error ? (
          <p className="text-xs text-red-600 text-center py-10">{error}</p>
        ) : pdfMode && !pdf ? (
          <p className="text-xs text-slate-500 flex items-center justify-center gap-2 py-10"><Loader2 className="w-4 h-4 animate-spin" /> Memuat dokumen…</p>
        ) : (
          pages.map((p) => (
            <div key={p} className="mx-auto" style={{ width: pageW }}>
              {pageCount > 1 && <p className="text-[10px] text-slate-500 mb-1">Halaman {p}</p>}
              <MarkLayer page={p} marks={marks.filter((m) => (m.page || 1) === p)} allMarks={marks}
                editable={editable} onAdd={add} onRemove={remove} activeIndex={activeIndex} onSelect={onSelect}>
                {pdfMode
                  ? (width > 0 && <PdfPage pdf={pdf} pageNumber={p} width={pageW} onRendered={() => setRenderTick((t) => t + 1)} />)
                  : <img src={url} alt={file.file_name} draggable={false} className="block w-full h-auto bg-white"
                      onLoad={(e) => { if (e.currentTarget.naturalWidth) setAspect(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth); setRenderTick((t) => t + 1); }} />}
              </MarkLayer>
            </div>
          ))
        )}
        {pdf && pdf.numPages > MAX_PAGES && (
          <p className="text-[11px] text-slate-500 text-center">Hanya {MAX_PAGES} halaman pertama yang ditampilkan.</p>
        )}
      </div>
      </div>

      {marks.length > 0 && !hideList && (
        <ol className="border-t border-amber-200 bg-amber-50/60 px-3 py-2 space-y-1.5 max-h-40 overflow-auto">
          {marks.map((m, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              {editable ? (
                <input value={m.note || ''} maxLength={200} onChange={(e) => setNote(m, e.target.value)}
                  placeholder={`Catatan bagian ${i + 1} (opsional), mis. "Tanggal tidak terbaca"`}
                  className="flex-1 px-2 py-1 border border-amber-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
              ) : (
                <span className="text-amber-950 pt-0.5">
                  {pageCount > 1 && <span className="text-amber-700">Hal. {m.page || 1} · </span>}
                  {m.note || 'Bagian ini perlu diperbaiki.'}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const AUTO_NOTE_PREFIX = 'Perbaiki bagian yang disorot:';

// Catatan umum Admin, kosong bila hanya gabungan otomatis dari catatan sorotan
export function adminGeneralNote(doc, marks = parseMarks(doc?.revision_marks)) {
  const note = String(doc?.revision_notes || '').trim();
  if (note.startsWith(AUTO_NOTE_PREFIX) && marks.some((m) => m.note)) return '';
  return note;
}
