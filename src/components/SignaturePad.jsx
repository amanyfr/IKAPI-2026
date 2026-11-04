import React, { useEffect, useRef, useState } from 'react';
import { Eraser, Upload, Save, PenLine } from 'lucide-react';

// Potong kanvas ke batas coretan agar TTD tidak membawa ruang kosong saat dibubuhkan
function trimCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  const pad = 8;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  const w = Math.min(width, right + pad) - left;
  const h = Math.min(height, bottom + pad) - top;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(canvas, left, top, w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}

// Kanvas tanda tangan (mouse, trackpad, sentuh) + opsi unggah gambar TTD
export default function SignaturePad({ onSave, saving = false, initialImage = null }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [hasInk, setHasInk] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const [color, setColor] = useState('#0b2a6f');

  // Resolusi kanvas mengikuti lebar tampilan × devicePixelRatio agar garis tajam
  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    setUploaded(null);
  };

  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = e.pressure && e.pointerType === 'pen' ? 1.5 + e.pressure * 2.5 : 2.6;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setUploaded(null);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      alert('Gunakan gambar PNG atau JPG.');
      return;
    }
    if (file.size > 1024 * 1024) {
      alert('Ukuran gambar maksimal 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      clear();
      setUploaded(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const image = uploaded || trimCanvas(canvasRef.current);
    if (!image) return;
    onSave(image);
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="block w-full h-44 sm:h-52 touch-none cursor-crosshair"
        />
        {uploaded && (
          <div className="absolute inset-0 bg-white flex items-center justify-center p-4">
            <img src={uploaded} alt="TTD diunggah" className="max-h-full max-w-full object-contain" />
          </div>
        )}
        {!hasInk && !uploaded && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm gap-1">
            <PenLine className="w-5 h-5" />
            Tanda tangan di area ini
            {initialImage && <span className="text-xs">(TTD baru akan menggantikan yang tersimpan)</span>}
          </div>
        )}
        <div className="pointer-events-none absolute left-6 right-6 bottom-10 border-b border-slate-200" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {['#0b2a6f', '#111827'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c === '#111827' ? 'Tinta hitam' : 'Tinta biru'}
              className={`w-7 h-7 rounded-full border-2 transition ${color === c ? 'border-blue-500 scale-110' : 'border-white shadow'}`}
              style={{ background: c }}
            />
          ))}
          <button type="button" onClick={clear} className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
            <Eraser className="w-3.5 h-3.5" /> Hapus
          </button>
          <label className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Unggah gambar
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />
          </label>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (!hasInk && !uploaded)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Simpan Tanda Tangan'}
        </button>
      </div>
    </div>
  );
}
