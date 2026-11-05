import React, { useState } from 'react';
import { History, ChevronDown } from 'lucide-react';

const ROLE_TONE = {
  Anggota: 'bg-sky-100 text-[#0884c4]',
  Admin: 'bg-violet-100 text-violet-700',
  Sekretaris: 'bg-blue-100 text-blue-700',
  Ketua: 'bg-amber-100 text-amber-800',
  Sistem: 'bg-slate-100 text-slate-600',
};

const NEGATIVE = /(tidak sesuai|ditolak|dikembalikan)/i;
const POSITIVE = /(sesuai|disetujui|valid|ditandatangani|diterima|resmi)/i;

export const formatTime = (raw) => {
  if (!raw) return '';
  const d = new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Riwayat alur berkas yang sama untuk Anggota, Admin, Sekretaris dan Ketua
export default function SubmissionTimeline({ timeline = [], cardClassName = 'card-surface', defaultOpen = false, limit = 6 }) {
  const [open, setOpen] = useState(defaultOpen);
  const items = [...timeline].reverse(); // terbaru di atas
  const shown = open ? items : items.slice(0, limit);

  return (
    <div className={`${cardClassName} overflow-hidden`}>
      <div className="border-b border-slate-100 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#0884c4]" />
          <h3 className="text-sm font-semibold text-slate-800">Riwayat Alur Berkas</h3>
        </div>
        <span className="text-xs text-slate-500">Terlihat oleh pemohon & pengurus</span>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400 text-center">Belum ada aktivitas.</p>
      ) : (
        <ol className="px-5 sm:px-6 py-4 space-y-0">
          {shown.map((item, idx) => {
            const negative = NEGATIVE.test(item.action);
            const positive = !negative && POSITIVE.test(item.action);
            const dot = negative ? 'bg-red-500' : positive ? 'bg-emerald-500' : 'bg-[#0da2e7]';
            const last = idx === shown.length - 1;
            return (
              <li key={item.id || `${item.created_at}-${idx}`} className="relative flex gap-3 pb-4 last:pb-0">
                {!last && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-200" />}
                <span className={`relative mt-1.5 w-[11px] h-[11px] rounded-full ring-4 ring-white flex-shrink-0 ${dot}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${negative ? 'text-red-700' : 'text-slate-800'}`}>{item.action}</p>
                  {item.notes && (
                    <p className={`text-xs mt-1 rounded-lg px-2.5 py-1.5 ${negative ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-slate-50 text-slate-600'}`}>
                      {item.notes}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                    <span className={`px-1.5 py-0.5 rounded-md font-medium ${ROLE_TONE[item.actor_role] || ROLE_TONE.Sistem}`}>
                      {item.actor_role === 'Anggota' ? 'Pemohon' : item.actor_role}
                    </span>
                    {item.actor_name && <span className="truncate max-w-[14rem]">{item.actor_name}</span>}
                    <span>· {formatTime(item.created_at)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {items.length > limit && (
        <button
          onClick={() => setOpen(!open)}
          className="w-full border-t border-slate-100 py-2.5 text-xs font-medium text-[#0884c4] hover:bg-slate-50 flex items-center justify-center gap-1"
        >
          {open ? 'Tampilkan lebih sedikit' : `Lihat semua (${items.length})`}
          <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}
