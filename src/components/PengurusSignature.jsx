import React, { useEffect, useRef } from 'react';
import { Move } from 'lucide-react';

// Dokumen yang ditandatangani Ketua & Sekretaris (urutan = urutan tab di jendela pembubuhan)
export const SIGNABLE_DOCS = [
  { key: 'surat',        label: 'Surat Pengantar' },
  { key: 'formulir',     label: 'Pengesahan Formulir' },
  { key: 'berita_acara', label: 'Berita Acara Verifikasi' },
  { key: 'sk',           label: 'Surat Keputusan' },
];

// Posisi awal TTD per penandatangan: Ketua di kolom kiri, Sekretaris di kolom kanan.
// Posisi {x, y, w} relatif (0–1) terhadap area tanda tangan; x/y = titik tengah gambar.
export const DEFAULT_SIGNATURE_POS = {
  // Disamakan dengan posisi TTD pada spesimen resmi
  chairman:  { x: 0.252, y: 0.545, w: 0.42 },
  secretary: { x: 0.711, y: 0.545, w: 0.34 },
};

const SIGNER_LABEL = { chairman: 'Ketua', secretary: 'Sekretaris' };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Batas ukuran TTD (lebar relatif area tanda tangan), sama dengan slider "Ukuran TTD"
export const SIGNATURE_MIN_W = 0.12;
export const SIGNATURE_MAX_W = 0.45;

function parseJson(raw) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw || null;
  } catch {
    return null;
  }
}

const validPos = (pos) => (pos && typeof pos.x === 'number' ? pos : null);

export function signerNames(submission, settings) {
  return {
    chairmanName: submission.signed_by_chairman || settings?.ketua_nama || 'Dr. Abdul Raup, M.Pd.',
    secretaryName: submission.signed_by_secretary || settings?.sekretaris_nama || 'Taofiq Rahman Ahmad, S.H.',
  };
}

// TTD tersimpan pada dokumen tertentu, atau yang sedang dibubuhkan (`signing`)
// signing = { role: 'chairman' | 'secretary', img, pos, onChange }
export function placedSignatures(submission, docKey, signing = null) {
  const positions = parseJson(submission.signature_positions) || {};
  const placedFor = (role) => {
    if (signing?.role === role) return { role, img: signing.img, pos: signing.pos, active: true };
    const img = submission[`${role}_signature_img`];
    if (!img) return null;
    let pos = validPos(positions[docKey]?.[role]);
    // Surat pengantar yang ditandatangani sebelum ada posisi per dokumen
    if (!pos && docKey === 'surat') pos = validPos(parseJson(submission[`${role}_signature_pos`])) || DEFAULT_SIGNATURE_POS[role];
    return pos ? { role, img, pos, active: false } : null;
  };
  return { chairman: placedFor('chairman'), secretary: placedFor('secretary') };
}

// Area tanda tangan: menampilkan TTD yang dibubuhkan & menangani geser (mouse / sentuh)
function SignatureZone({ placed, signing, className = '', children }) {
  const areaRef = useRef(null);
  const dragRef = useRef(null);

  // Saat mode pembubuhan dibuka, gulir langsung ke area tanda tangan
  useEffect(() => {
    if (signing) areaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [Boolean(signing)]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    // Simpan selisih kursor ke titik tengah agar gambar tidak "melompat"
    dragRef.current = { dx: e.clientX - (box.left + box.width / 2), dy: e.clientY - (box.top + box.height / 2) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!dragRef.current || !rect) return;
    const half = signing.pos.w / 2;
    signing.onChange({
      ...signing.pos,
      x: clamp((e.clientX - rect.left - dragRef.current.dx) / rect.width, half, 1 - half),
      y: clamp((e.clientY - rect.top - dragRef.current.dy) / rect.height, 0.05, 0.95),
    });
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  // Ubah ukuran: tarik pegangan di sudut kotak TTD; titik tengah tetap di tempat
  const resizeRef = useRef(false);
  const handleResizeDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleResizeMove = (e) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!resizeRef.current || !rect) return;
    e.stopPropagation();
    const { x } = signing.pos;
    const centerX = rect.left + x * rect.width;
    const maxW = Math.min(SIGNATURE_MAX_W, 2 * Math.min(x, 1 - x));
    const w = clamp((2 * Math.abs(e.clientX - centerX)) / rect.width, SIGNATURE_MIN_W, Math.max(SIGNATURE_MIN_W, maxW));
    signing.onChange({ ...signing.pos, w, x: clamp(x, w / 2, 1 - w / 2) });
  };
  const handleResizeUp = (e) => {
    e?.stopPropagation?.();
    resizeRef.current = false;
  };

  return (
    <div
      ref={areaRef}
      className={`relative rounded-xl ${signing ? 'outline-2 outline-dashed outline-offset-8 outline-blue-300 bg-blue-50/30' : ''} ${className}`}
    >
      {[placed.chairman, placed.secretary].filter(Boolean).map((sig) => (sig.active ? (
        <div
          key={sig.role}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute -translate-x-1/2 -translate-y-1/2 select-none z-30 cursor-grab active:cursor-grabbing touch-none ring-2 ring-blue-500 ring-offset-2 rounded-md bg-white/30"
          style={{ left: `${sig.pos.x * 100}%`, top: `${sig.pos.y * 100}%`, width: `${sig.pos.w * 100}%` }}
        >
          <img src={sig.img} alt={`Tanda Tangan ${SIGNER_LABEL[sig.role]}`} draggable={false} className="block w-full h-auto pointer-events-none" />
          {/* Pegangan ubah ukuran (sudut kanan bawah) */}
          <span
            role="slider"
            aria-label="Ubah ukuran tanda tangan"
            aria-valuemin={SIGNATURE_MIN_W}
            aria-valuemax={SIGNATURE_MAX_W}
            aria-valuenow={sig.pos.w}
            title="Tarik untuk mengubah ukuran"
            onPointerDown={handleResizeDown}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onPointerCancel={handleResizeUp}
            className="absolute -right-2.5 -bottom-2.5 w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow cursor-nwse-resize touch-none no-print"
          />
        </div>
      ) : (
        <img
          key={sig.role}
          src={sig.img}
          alt={`Tanda Tangan ${SIGNER_LABEL[sig.role]}`}
          draggable={false}
          className="absolute -translate-x-1/2 -translate-y-1/2 select-none z-20 pointer-events-none"
          style={{ left: `${sig.pos.x * 100}%`, top: `${sig.pos.y * 100}%`, width: `${sig.pos.w * 100}%` }}
        />
      )))}
      {signing && (
        <span className="absolute -top-7 left-0 text-[11px] font-sans font-medium text-blue-700 flex items-center gap-1 no-print">
          <Move className="w-3.5 h-3.5" /> Geser tanda tangan {SIGNER_LABEL[signing.role]} ke posisi yang diinginkan · tarik titik biru di sudut untuk ubah ukuran
        </span>
      )}
      {children}
    </div>
  );
}

// Gambar default dari "Spesimen Ttd IKAPI Jabar" (bisa diganti lewat Pengaturan Sistem)
const DEFAULT_IMG = {
  ketua: '/ttd-ketua.png',
  sekretaris: '/ttd-sekretaris.png',
  stempel: '/stempel-ikapi.png',
};

// Geometri persis spesimen (tabel 15 cm, 2 kolom 7,5 cm). Nama berada ±2,6 cm di bawah awal baris TTD.
// left/width = % lebar blok; top = % tinggi area TTD (2,6 cm).
const SPECIMEN = {
  ratio: 15 / 2.6,
  ketua: { left: '4.1%', width: '42.3%', top: '-16.9%' },
  sekretaris: { left: '54.3%', width: '33.7%', top: '-16.9%' },
  stempel: { left: '38.5%', width: '21.7%', top: '-5%' },
};

// Blok tanda tangan Pengurus Daerah sesuai spesimen resmi:
// "Hormat kami," + nama lembaga di tengah, Ketua (kiri), Sekretaris (kanan) dengan stempel menimpa sisi kiri TTD Sekretaris
export function PengurusSignatureBlock({ submission, settings, docKey, signing = null, heading, className = 'mt-8 pt-4' }) {
  const placed = placedSignatures(submission, docKey, signing);
  const { chairmanName, secretaryName } = signerNames(submission, settings);
  const img = (style, src, alt, z) => (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`absolute h-auto select-none pointer-events-none ${z}`}
      style={style}
    />
  );

  return (
    <SignatureZone
      placed={placed}
      signing={signing}
      className={`text-slate-900 ${className}`}
    >
      <div data-keep-together style={{ fontFamily: 'Tahoma, Verdana, Segoe UI, sans-serif', fontSize: '12pt', lineHeight: 1.2 }}>
        <p className="text-center">
          {heading ? <span className="font-bold">{heading}</span> : (
            <>
              Hormat kami,
              <br />
              <span className="font-bold">PENGURUS DAERAH</span>
              <br />
              <span className="font-bold">IKATAN PENERBIT INDONESIA (PD-IKAPI) JAWA BARAT</span>
            </>
          )}
        </p>

        {/* Baris TTD: gambar diposisikan absolut seperti di spesimen */}
        <div className="relative w-full" style={{ aspectRatio: SPECIMEN.ratio }}>
          {!placed.chairman && img(SPECIMEN.ketua, settings?.ketua_signature_img || DEFAULT_IMG.ketua, 'Tanda Tangan Ketua', 'z-10')}
          {!placed.secretary && img(SPECIMEN.sekretaris, settings?.sekretaris_signature_img || DEFAULT_IMG.sekretaris, 'Tanda Tangan Sekretaris', 'z-10')}
          {/* Stempel resmi menimpa sisi kiri tanda tangan Sekretaris */}
          {img(SPECIMEN.stempel, settings?.stempel_img || DEFAULT_IMG.stempel, 'Stempel Resmi IKAPI', 'z-20')}
        </div>

        <div className="grid grid-cols-2 text-center">
          <div>
            <p className="font-bold underline underline-offset-2">{chairmanName}</p>
            <p>K e t u a</p>
          </div>
          <div>
            <p className="font-bold underline underline-offset-2">{secretaryName}</p>
            <p>S e k r e t a r i s</p>
          </div>
        </div>
      </div>
    </SignatureZone>
  );
}

// Kop surat resmi IKAPI Jawa Barat 2026 (gambar dari "Kop Surat IKAPI 2026 Rev01")
export function KopSurat() {
  return (
    <div className="mb-6">
      <img src="/kop-surat-header.png" alt="Kop Surat PD IKAPI Jawa Barat" className="w-full h-auto block select-none" draggable={false} />
    </div>
  );
}

// Kaki surat resmi: QRIS, kanal resmi & rekening (bagian bawah kop 2026)
export function KopSuratFooter({ className = 'mt-10' }) {
  return (
    <div className={className}>
      <img src="/kop-surat-footer.png" alt="Kaki Surat PD IKAPI Jawa Barat" className="w-full h-auto block select-none" draggable={false} />
    </div>
  );
}

export const formatLongDate = (raw) =>
  (raw ? new Date(raw) : new Date()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
