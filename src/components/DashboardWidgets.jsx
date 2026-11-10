import React, { useState, useEffect, useRef } from 'react';

/* ── Helper bersama dashboard Sekretaris & Ketua ── */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const parseDate = (s) => (s ? new Date(s.includes('T') ? s : s.replace(' ', 'T')) : null);
export const submittedDate = (sub) => parseDate(sub.submitted_at) || parseDate(sub.created_at);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const timeAgo = (s) => {
  const d = parseDate(s);
  if (!d) return '-';
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return `${Math.round(days / 30)} bln lalu`;
};

export const initials = (name = '') =>
  name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// Nama panggilan tanpa gelar: "Drs. H. Anwar Rosyid, M.Si. (Sekretaris)" -> { first: 'Anwar', rest: 'Rosyid' }
const NAME_TITLES = /^(prof|dr|drs|dra|ir|h|hj|kh)\.?$/i;
export function greetingName(fullName = '') {
  const words = fullName.split(',')[0].replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  const start = words.findIndex((w) => !NAME_TITLES.test(w));
  const parts = start === -1 ? words : words.slice(start);
  return { first: parts[0] || '', rest: parts.slice(1).join(' ') };
}

export const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

/*
 * Bucket pengajuan per periode untuk grafik tren.
 * series: [{ key, dateOf: (sub) => Date|null, filter?: (sub) => boolean }]
 */
export function buildTrend(submissions, range, series) {
  const today = startOfDay(new Date());
  let buckets;
  if (range === '12m') {
    buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
      return {
        label: `${MONTHS[d.getMonth()]}`,
        long: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        match: (x) => x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth(),
      };
    });
  } else {
    const days = range === '30d' ? 30 : 7;
    buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (days - 1) + i);
      return {
        label: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
        long: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        match: (x) => startOfDay(x).getTime() === d.getTime(),
      };
    });
  }
  return buckets.map((b) => {
    const row = { label: b.label, long: b.long };
    series.forEach((s) => {
      row[s.key] = submissions.filter((sub) => {
        if (s.filter && !s.filter(sub)) return false;
        const d = s.dateOf(sub);
        return d && b.match(d);
      }).length;
    });
    return row;
  });
}

/* Garis halus (Catmull-Rom → Bezier); titik kontrol dijepit agar kurva tidak turun di bawah 0 */
function smoothPath(points, minY, maxY) {
  if (points.length < 2) return '';
  const clamp = (v) => Math.min(maxY, Math.max(minY, v));
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/*
 * Grafik garis tren.
 * series: [{ key, label, color (hex garis), tipClass (warna teks tooltip) }]
 * Garis digambar dari belakang ke depan, jadi seri pertama tampil paling atas.
 */
// fill = tinggi grafik mengikuti tinggi kartu (dashboard satu layar)
export function TrendChart({ data, series, ariaLabel, height = 220, fill = false }) {
  const [hover, setHover] = useState(null);
  // Lebar grafik mengikuti lebar kartu agar teks sumbu tidak ikut mengecil di HP
  const wrapRef = useRef(null);
  const [W, setW] = useState(640);
  const [fillH, setFillH] = useState(height);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setW(Math.max(280, Math.round(entry.contentRect.width)));
      if (fill) setFillH(Math.max(90, Math.round(entry.contentRect.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const H = fill ? fillH : height, padL = 28, padR = 12, padT = 16, padB = 28;
  const max = Math.max(2, ...data.flatMap((d) => series.map((s) => d[s.key])));
  const step = (W - padL - padR) / Math.max(1, data.length - 1);
  const x = (i) => padL + i * step;
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  const labelEvery = Math.ceil(data.length / Math.max(3, Math.floor(W / 60)));

  return (
    <div ref={wrapRef} className={`relative ${fill ? 'h-full min-h-[90px]' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={ariaLabel} className={fill ? 'absolute inset-0' : ''}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="rgb(15 23 42 / 0.06)" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400" fontSize="10">{t}</text>
          </g>
        ))}
        {data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1) && (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400" fontSize="10">{d.label}</text>
        ))}

        {[...series].reverse().map((s) => (
          <path key={s.key} d={smoothPath(data.map((d, i) => [x(i), y(d[s.key])]), padT, H - padB)}
            fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
        ))}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="rgb(15 23 42 / 0.15)" strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r="5" fill="#fff" stroke={s.color} strokeWidth="2.5" />
            ))}
          </g>
        )}

        {data.map((_, i) => (
          <rect
            key={i}
            x={x(i) - step / 2} y={0} width={step} height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 px-3 py-2 rounded-xl bg-slate-900/85 text-white text-[11px] leading-snug shadow-lg backdrop-blur"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <div className="font-semibold">{data[hover].long}</div>
          {series.map((s) => (
            <div key={s.key} className={s.tipClass}>{data[hover][s.key]} {s.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Legenda kecil untuk TrendChart */
export function TrendLegend({ series }) {
  return (
    <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-500">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded" style={{ background: s.color }} /> {s.label}
        </span>
      ))}
    </div>
  );
}

/*
 * Gelembung persentase posisi pengajuan.
 * items: [{ label, value, cls, pos }] — urutan render = urutan tumpukan (yang pertama di belakang)
 */
export function PositionBubbles({ items, total, compact = false }) {
  const size = (v) => (compact ? 50 : 72) + (compact ? 54 : 88) * Math.sqrt(pct(v, total) / 100);
  return (
    <div className={`relative mt-2 ${compact ? 'h-36 lg:h-auto lg:flex-1 lg:min-h-0' : 'h-52'}`}>
      {items.map((b) => (
        <div key={b.label}
          className={`absolute rounded-full flex flex-col items-center justify-center ${b.cls} ${b.pos}`}
          style={{ width: size(b.value), height: size(b.value) }}>
          <span className={`${compact ? 'text-xl' : 'text-2xl'} font-light leading-none`}>{pct(b.value, total)}%</span>
          <span className={`${compact ? 'text-[10px] px-1 text-center leading-tight' : 'text-[11px]'} mt-1 opacity-90`}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* Pilihan rentang waktu grafik (12 bulan / 30 hari / 7 hari) */
export function RangeToggle({ value, onChange }) {
  return (
    <div className="inline-flex p-1 rounded-full bg-slate-50 border border-slate-200/70">
      {[['12m', '12 bulan'], ['30d', '30 hari'], ['7d', '7 hari']].map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
            value === key ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Ringkasan di kartu biru samping (Admin, Sekretaris, Ketua) ──
   Mengisi ruang tengah kartu dengan daftar angka per tahap. */
// Tinggi kartu samping mengikuti kotak antrean di sebelahnya. Baris yang tidak muat
// disembunyikan utuh (flex-wrap ke kolom tersembunyi), dan panel disembunyikan bila
// tidak ada satu baris pun yang muat, supaya tidak tampil sebagai kotak scroll terpotong.
export function SideCardList({ title, items }) {
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  const listRef = useRef(null);
  const [fits, setFits] = useState(true);
  useEffect(() => {
    const ul = listRef.current;
    if (!ul || typeof ResizeObserver === 'undefined') return undefined;
    const check = () => {
      const first = ul.firstElementChild;
      setFits(!first || ul.clientHeight >= first.offsetHeight);
    };
    const ro = new ResizeObserver(check);
    ro.observe(ul);
    check();
    return () => ro.disconnect();
  }, []);
  return (
    <div className={`flex-1 min-h-0 mt-4 rounded-2xl p-3 flex flex-col overflow-hidden ${fits ? 'bg-white/10 ring-1 ring-white/15' : 'invisible'}`}>
      {title && <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-2">{title}</p>}
      <ul ref={listRef} className="flex-1 min-h-0 overflow-hidden flex flex-col flex-wrap content-start gap-x-6 gap-y-1.5" style={{ justifyContent: 'safe space-around' }}>
        {items.map((it) => {
          const Row = it.onClick ? 'button' : 'div';
          const Icon = it.icon;
          return (
            <li key={it.label} className="w-full">
              <Row type={it.onClick ? 'button' : undefined} onClick={it.onClick}
                className={`w-full text-left rounded-xl px-2.5 py-2 ${it.onClick ? 'hover:bg-white/10 transition' : ''}`}>
                <span className="flex items-center gap-2">
                  {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${it.muted ? 'text-white/50' : 'text-white'}`} />}
                  <span className={`flex-1 min-w-0 leading-snug text-xs ${it.muted ? 'text-white/60' : 'text-white/90'}`}>{it.label}</span>
                  {it.value !== undefined && <span className="text-sm font-semibold tabular-nums">{it.value}</span>}
                </span>
                {it.value !== undefined && !it.hideBar && (
                  <span className="block mt-1.5 h-1 rounded-full bg-white/15 overflow-hidden">
                    <span className="block h-full rounded-full bg-white/80" style={{ width: `${Math.round(((Number(it.value) || 0) / max) * 100)}%` }} />
                  </span>
                )}
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Angka utama di samping sapaan: satu kartu rapi, ikon + angka + label sejajar.
// prefix/suffix (mis. "Rp" / "jt") duduk di garis dasar yang sama dengan angkanya.
export function HeaderStats({ items, loading }) {
  return (
    <div className="card-surface p-1.5 grid grid-cols-2 sm:grid-cols-none sm:grid-flow-col sm:auto-cols-fr sm:divide-x divide-slate-100 lg:flex-shrink-0">
      {items.map(({ key, value, prefix, suffix, label, icon: Icon, tone, onClick }) => {
        const Tag = onClick ? 'button' : 'div';
        return (
          <Tag
            key={key || label}
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 text-left min-w-0 rounded-xl sm:rounded-none sm:first:rounded-l-xl sm:last:rounded-r-xl ${onClick ? 'hover:bg-slate-50 transition-colors' : ''}`}
          >
            <span className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center ${tone}`}>
              <Icon className="w-[18px] h-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-1 leading-none text-slate-900 tabular-nums whitespace-nowrap">
                {prefix && <span className="text-xs font-medium text-slate-400">{prefix}</span>}
                <span className="text-2xl font-semibold tracking-tight">{loading ? '–' : value}</span>
                {suffix && <span className="text-xs font-medium text-slate-400">{suffix}</span>}
              </span>
              <span className="block mt-1 text-[11px] leading-snug text-slate-500 sm:whitespace-nowrap">{label}</span>
            </span>
          </Tag>
        );
      })}
    </div>
  );
}
