import React from 'react';
import { ArrowRight, ArrowUpDown, ChevronDown, RefreshCw } from 'lucide-react';
import { timeAgo } from './DashboardWidgets';

/**
 * Kartu antrian dashboard (Admin, Sekretaris, Ketua): satu kartu = satu pengajuan.
 * Isi dibuat ringkas: nama penerbit, jenis pengajuan, apa yang perlu dilakukan, pemohon.
 *
 * tone: { dot, chip } kelas warna untuk label tugas
 * revisionRound: > 0 menampilkan info "Pengajuan revisi ke-N"
 * note: teks tambahan singkat (mis. kurir, alasan penolakan)
 */
export default function QueueCard({ sub, label, tone, revisionRound = 0, note, noteTone = 'text-slate-500', actionLabel = 'Lihat detail', onClick }) {
  const isRevision = revisionRound > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:shadow-md hover:bg-white ${isRevision
        ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
        : 'bg-slate-50 border-slate-200/80 hover:border-[#0da2e7]'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-slate-900 truncate group-hover:text-[#0884c4] transition-colors">
            {sub.publisher_name || 'Tanpa nama penerbit'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {sub.submission_type === 'Heregistrasi' ? 'Heregistrasi' : 'Anggota Baru'} · {sub.member_category || '-'}
          </p>
        </div>
        <span className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">{timeAgo(sub.updated_at)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${tone?.chip || 'bg-slate-100 text-slate-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${tone?.dot || 'bg-slate-400'}`} />
          {label}
        </span>
        {isRevision && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-400 text-amber-950">
            <RefreshCw className="w-3 h-3" /> Revisi ke-{revisionRound}
          </span>
        )}
      </div>

      {isRevision && (
        <p className="-mt-1 text-[11px] leading-snug text-amber-800">Pengajuan revisi ke-{revisionRound}: pemohon sudah mengirim dokumen perbaikan.</p>
      )}
      {note && <p className={`-mt-1 text-[11px] leading-snug line-clamp-2 ${noteTone}`}>{note}</p>}

      <div className="mt-auto pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-slate-500 truncate">
          Pemohon: <span className="font-medium text-slate-800">{sub.applicant_name || '-'}</span>
        </p>
        <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-xs font-semibold text-[#0884c4] group-hover:gap-1.5 transition-all">
          {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  );
}

/**
 * Header daftar antrian: judul + aksi (urutan, segarkan) di satu baris,
 * filter berupa chip dalam satu wadah; chip turun baris bila tidak muat (tidak terpotong).
 *
 * filters: [{ key, label, dot, value }]
 */
export function QueueFilterBar({ title, filters, active, onChange, sortOrder, onToggleSort, onRefresh, loading }) {
  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg text-slate-800 whitespace-nowrap">{title}</h2>
        <div className="flex items-center gap-1">
          {onToggleSort && (
            <button
              type="button"
              onClick={onToggleSort}
              title="Ubah urutan"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortOrder === 'oldest' ? 'Terlama' : 'Terbaru'}
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Segarkan data"
              className="w-8 h-8 inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#0da2e7] transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="w-fit max-w-full flex flex-wrap items-center gap-1 p-1 rounded-[1.25rem] bg-slate-100/80 border border-slate-200/60">
          {filters.map((f) => {
            const on = active === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onChange(f.key)}
                className={`flex items-center gap-2 h-8 pl-3 pr-1.5 rounded-full text-xs whitespace-nowrap transition ${on
                  ? 'bg-white text-slate-900 font-semibold shadow-sm ring-1 ring-slate-200/70'
                  : 'text-slate-500 font-medium hover:text-slate-800 hover:bg-white/60'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />
                {f.label}
                <span className={`min-w-[1.375rem] h-5 inline-flex items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${on
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200/80 text-slate-600'}`}
                >
                  {f.value}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Footer daftar antrian: info jumlah, tombol buka/tutup daftar lengkap, dan tautan ke menu terkait.
 */
export function QueueFooter({ shown, total, noun, expanded, onToggle, linkLabel, onLink }) {
  const hidden = total - shown;
  return (
    <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        Menampilkan <span className="font-semibold text-slate-800 tabular-nums">{shown}</span> dari{' '}
        <span className="font-semibold text-slate-800 tabular-nums">{total}</span> {noun}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
        >
          {expanded ? 'Tampilkan lebih sedikit' : `Lihat ${hidden} lainnya`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        )}
        {onLink && (
          <button
            type="button"
            onClick={onLink}
            className="group inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-[#0da2e7] text-xs font-semibold text-white shadow-sm hover:bg-[#0884c4] transition"
          >
            {linkLabel}
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}
