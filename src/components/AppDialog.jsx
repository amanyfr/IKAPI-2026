import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

// Pop-up pemberitahuan milik aplikasi (pengganti alert() bawaan browser).
// Pakai: notify('Pesan') atau notify('Pesan', { tone: 'error', title: 'Judul' }).
// notify() mengembalikan Promise yang selesai saat pop-up ditutup.

let listener = null;
const queue = [];

const guessTone = (message) => {
  const m = String(message || '').toLowerCase();
  if (/gagal|error|tidak dapat|ditolak sistem/.test(m)) return 'error';
  if (/wajib|pilih |isi |gunakan|maksimal|terlebih dahulu|tulis /.test(m)) return 'warning';
  if (/berhasil|tersimpan|diterima|valid|disetujui|diteruskan|terkirim|resmi/.test(m)) return 'success';
  return 'info';
};

export function notify(message, opts = {}) {
  return new Promise((resolve) => {
    const item = { id: Date.now() + Math.random(), message: String(message ?? ''), tone: opts.tone || guessTone(message), title: opts.title, resolve };
    queue.push(item);
    listener?.();
  });
}

const TONES = {
  success: { icon: CheckCircle2, ring: 'bg-emerald-50 text-emerald-600', title: 'Berhasil', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  error:   { icon: XCircle,      ring: 'bg-red-50 text-red-600',         title: 'Terjadi kesalahan', btn: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: AlertTriangle, ring: 'bg-amber-50 text-amber-600',    title: 'Perhatian', btn: 'bg-amber-500 hover:bg-amber-600' },
  info:    { icon: Info,          ring: 'bg-sky-50 text-[#0884c4]',       title: 'Informasi', btn: 'bg-[#0da2e7] hover:bg-[#0884c4]' },
};

export function AppDialogHost() {
  const [current, setCurrent] = useState(null);
  const okRef = useRef(null);

  useEffect(() => {
    listener = () => setCurrent((cur) => cur || queue[0] || null);
    listener();
    return () => { listener = null; };
  }, []);

  useEffect(() => {
    if (!current) return;
    okRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  const close = () => {
    const done = queue.shift();
    done?.resolve();
    setCurrent(queue[0] || null);
  };

  if (!current) return null;
  const tone = TONES[current.tone] || TONES.info;
  const Icon = tone.icon;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={close}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-msg"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center"
      >
        <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${tone.ring}`}>
          <Icon className="w-7 h-7" />
        </div>
        <h3 id="app-dialog-title" className="mt-4 text-lg font-medium text-slate-900">{current.title || tone.title}</h3>
        <p id="app-dialog-msg" className="mt-1.5 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{current.message}</p>
        <button
          ref={okRef}
          onClick={close}
          className={`mt-5 w-full py-2.5 rounded-2xl text-white text-sm font-medium transition ${tone.btn}`}
        >
          OK
        </button>
      </div>
    </div>
  );
}
