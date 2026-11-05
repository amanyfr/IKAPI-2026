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
  chairman:  { x: 0.25, y: 0.55, w: 0.26 },
  secretary: { x: 0.75, y: 0.55, w: 0.26 },
};

const SIGNER_LABEL = { chairman: 'Ketua', secretary: 'Sekretaris' };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

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
    chairmanName: submission.signed_by_chairman || settings?.ketua_nama || 'Dr. H. Mahpudi, M.T.',
    secretaryName: submission.signed_by_secretary || settings?.sekretaris_nama || 'Drs. H. Anwar Rosyid, M.Si.',
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

  return (
    <div
      ref={areaRef}
      className={`relative rounded-xl ${signing ? 'outline-2 outline-dashed outline-offset-8 outline-blue-300 bg-blue-50/30' : ''} ${className}`}
    >
      {[placed.chairman, placed.secretary].filter(Boolean).map((sig) => (
        <img
          key={sig.role}
          src={sig.img}
          alt={`Tanda Tangan ${SIGNER_LABEL[sig.role]}`}
          draggable={false}
          onPointerDown={sig.active ? handlePointerDown : undefined}
          onPointerMove={sig.active ? handlePointerMove : undefined}
          onPointerUp={sig.active ? handlePointerUp : undefined}
          onPointerCancel={sig.active ? handlePointerUp : undefined}
          className={`absolute -translate-x-1/2 -translate-y-1/2 select-none ${
            sig.active ? 'z-30 cursor-grab active:cursor-grabbing touch-none ring-2 ring-blue-500 ring-offset-2 rounded-md bg-white/30' : 'z-20 pointer-events-none'
          }`}
          style={{ left: `${sig.pos.x * 100}%`, top: `${sig.pos.y * 100}%`, width: `${sig.pos.w * 100}%` }}
        />
      ))}
      {signing && (
        <span className="absolute -top-7 left-0 text-[11px] font-sans font-medium text-blue-700 flex items-center gap-1 no-print">
          <Move className="w-3.5 h-3.5" /> Geser tanda tangan {SIGNER_LABEL[signing.role]} ke posisi yang diinginkan
        </span>
      )}
      {children}
    </div>
  );
}

function FallbackSignature({ image, name, alt, rotate }) {
  if (image) return <img src={image} alt={alt} className="max-h-18 max-w-[160px] object-contain" />;
  return <div className={`font-serif italic text-[#0884c4] text-lg font-bold select-none transform ${rotate}`}>{name}</div>;
}

// Blok tanda tangan Pengurus Daerah: Ketua (kiri), stempel (tengah), Sekretaris (kanan)
export function PengurusSignatureBlock({ submission, settings, docKey, signing = null, heading, className = 'mt-8 pt-4' }) {
  const placed = placedSignatures(submission, docKey, signing);
  const { chairmanName, secretaryName } = signerNames(submission, settings);

  return (
    <SignatureZone placed={placed} signing={signing} className={`font-sans text-xs sm:text-sm ${className}`}>
      <p className="text-center font-bold text-slate-800">
        {heading || (
          <>
            PENGURUS DAERAH IKATAN PENERBIT INDONESIA (IKAPI)
            <br />
            JAWA BARAT
          </>
        )}
      </p>

      <div className="grid grid-cols-2 gap-8 mt-6 relative">
        {/* Stempel resmi di tengah */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-90 z-10">
          {settings?.stempel_img ? (
            <img src={settings.stempel_img} alt="Stempel Resmi IKAPI" className="w-28 h-28 object-contain transform -rotate-6" />
          ) : (
            <div className="w-28 h-28 rounded-full border-2 border-dashed border-[#0884c4]/80 p-1 flex items-center justify-center transform -rotate-12 bg-[#0da2e7]/5">
              <div className="w-full h-full rounded-full border-2 border-[#0884c4] flex flex-col items-center justify-center text-center p-1">
                <span className="text-[7px] font-bold text-[#0884c4] uppercase tracking-widest">★ IKAPI ★</span>
                <span className="text-[9px] font-black text-[#0da2e7] tracking-tighter">JAWA BARAT</span>
                <span className="text-[6px] font-bold text-[#0884c4] uppercase mt-0.5">PENGURUS DAERAH</span>
              </div>
            </div>
          )}
        </div>

        <div className="text-center space-y-4">
          <p className="font-semibold text-slate-800">Ketua,</p>
          <div className="h-20 flex items-center justify-center">
            {!placed.chairman && (
              <FallbackSignature image={settings?.ketua_signature_img} name={chairmanName} alt="Tanda Tangan Ketua" rotate="-rotate-3" />
            )}
          </div>
          <div>
            <p className="font-bold text-slate-900 underline">{chairmanName}</p>
            <p className="text-[11px] text-slate-600">Ketua PD IKAPI Jawa Barat</p>
          </div>
        </div>

        <div className="text-center space-y-4">
          <p className="font-semibold text-slate-800">Sekretaris,</p>
          <div className="h-20 flex items-center justify-center">
            {!placed.secretary && (
              <FallbackSignature image={settings?.sekretaris_signature_img} name={secretaryName} alt="Tanda Tangan Sekretaris" rotate="rotate-2" />
            )}
          </div>
          <div>
            <p className="font-bold text-slate-900 underline">{secretaryName}</p>
            <p className="text-[11px] text-slate-600">Sekretaris PD IKAPI Jabar</p>
          </div>
        </div>
      </div>
    </SignatureZone>
  );
}

// Kop surat resmi (HTML) yang dipakai bersama dokumen pengurus
export function KopSurat({ settings }) {
  const kopAlamat = settings?.surat_kop_alamat || 'Sekretariat: Jl. Ibu Inggit Garnasih No. 148, Regol, Kota Bandung 40252';
  const kopKontak = settings?.surat_kop_kontak || 'Telp: (022) 5202684 | Email: sekretariat@ikapi-jabar.or.id | Web: https://ikapi-jabar.or.id';
  return (
    <div className="flex items-center border-b-[3px] border-double border-slate-900 pb-4 mb-6">
      <div className="w-20 h-20 mr-4 flex-shrink-0 flex items-center justify-center">
        <img src="/logo-ikapi.jpg" alt="Logo IKAPI" className="w-18 h-18 object-contain rounded-lg" />
      </div>
      <div className="text-center flex-1">
        <h1 className="text-lg sm:text-xl font-bold tracking-wider text-[#0884c4] uppercase">Ikatan Penerbit Indonesia (IKAPI)</h1>
        <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">Pengurus Daerah Jawa Barat</h2>
        <p className="text-[11px] font-sans text-slate-600 mt-1 leading-tight">
          {kopAlamat}
          <br />
          {kopKontak}
        </p>
      </div>
    </div>
  );
}

export const formatLongDate = (raw) =>
  (raw ? new Date(raw) : new Date()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
