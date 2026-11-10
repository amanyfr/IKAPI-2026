import React from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import { formatRupiah } from '../utils/fees';

/** Pop-up konfirmasi sebelum pindah ke formulir perpanjangan (berbayar) */
export default function RenewConfirm({ fee, busy, onCancel, onConfirm, note = 'Setelah lanjut, jalur masih aktif ditutup untuk akun ini.' }) {
  // Portal ke body: pembungkus beranimasi (transform) tidak mengurung posisi fixed
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !busy && onCancel()}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-[24px] shadow-2xl overflow-hidden">
        <div className="p-6 text-center">
          <span className="mx-auto w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100 flex items-center justify-center">
            <RefreshCw className="w-6 h-6" />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">Yakin ingin memperpanjang keanggotaan?</h3>
          <p className="mt-1.5 text-sm text-slate-500">
            Anda akan masuk ke formulir registrasi perpanjangan: isi data, unggah dokumen, lalu bayar iuran.
          </p>
          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">Iuran perpanjangan ({fee.durasiBulan} bulan)</span>
            <span className="font-semibold text-slate-900">{formatRupiah(fee.total)}</span>
          </div>
          {note && <p className="mt-2 text-[11px] text-slate-400">{note}</p>}
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button type="button" onClick={onCancel} disabled={busy} className="soft-pill flex-1 justify-center !h-11">Batal</button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold">
            {busy ? 'Memproses...' : 'Ya, perpanjang'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
