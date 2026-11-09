import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';

// Lonceng notifikasi dalam aplikasi (pengganti email selama SMTP belum aktif).
// tone="dark" untuk header gelap pengurus, tone="light" untuk header anggota.
const POLL_MS = 30000;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
});

const timeAgo = (value) => {
  const t = new Date(String(value).replace(' ', 'T')).getTime();
  if (!t) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  if (s < 604800) return `${Math.floor(s / 86400)} hari lalu`;
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function NotificationBell({ tone = 'dark' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch {
      // Gagal ambil notifikasi tidak boleh mengganggu halaman; dicoba lagi di putaran berikutnya
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const markRead = async (id) => {
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (!id || n.id === id ? { ...n, read_at: n.read_at || now } : n)));
    setUnread((u) => (id ? Math.max(0, u - 1) : 0));
    try {
      await fetch('/api/notifications/read', { method: 'POST', headers: authHeaders(), body: JSON.stringify(id ? { id } : {}) });
    } catch {
      load();
    }
  };

  // Hapus satu notifikasi (id) atau semua (tanpa id)
  const remove = async (id) => {
    if (id) {
      const target = items.find((n) => n.id === id);
      setItems((list) => list.filter((n) => n.id !== id));
      if (target && !target.read_at) setUnread((u) => Math.max(0, u - 1));
    } else {
      setItems([]);
      setUnread(0);
      setConfirmClear(false);
    }
    try {
      const res = await fetch(id ? `/api/notifications/${id}` : '/api/notifications', { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) load();
    } catch {
      load();
    }
  };

  const btnClass = tone === 'light'
    ? 'soft-pill !p-2.5 relative'
    : 'relative p-2 bg-white/10 hover:bg-white/20 text-white/85 hover:text-white rounded-xl border border-white/15 transition';

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setConfirmClear(false); if (!open) load(); }}
        aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
        className={btnClass}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-white/80">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 z-50 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold">Notifikasi</span>
            {confirmClear ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600">Hapus semua?</span>
                <button type="button" onClick={() => remove()} className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold">Hapus</button>
                <button type="button" onClick={() => setConfirmClear(false)} className="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50 font-semibold text-slate-600">Batal</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button type="button" onClick={() => markRead()} className="flex items-center gap-1 text-xs font-semibold text-[#0884c4] hover:underline">
                    <CheckCheck className="w-3.5 h-3.5" /> Tandai dibaca
                  </button>
                )}
                {items.length > 0 && (
                  <button type="button" onClick={() => setConfirmClear(true)} className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus semua
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Belum ada notifikasi.</p>
            ) : items.map((n) => (
              <div key={n.id} className={`group relative border-b border-slate-100 last:border-0 transition hover:bg-slate-50 ${n.read_at ? '' : 'bg-sky-50/70'}`}>
              <button
                type="button"
                onClick={() => !n.read_at && markRead(n.id)}
                className="w-full text-left pl-4 pr-10 py-3"
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-[#0da2e7]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 break-words">{n.title}</div>
                    {n.body && <div className="text-xs text-slate-600 mt-0.5 whitespace-pre-line break-words">{n.body}</div>}
                    <div className="text-[11px] text-slate-400 mt-1">{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => remove(n.id)}
                aria-label="Hapus notifikasi"
                title="Hapus notifikasi"
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-slate-300 group-hover:text-slate-500 hover:!text-red-600 hover:bg-red-50 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
