import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PenLine, PenTool, CheckCircle, Check, X, Paperclip, ExternalLink, Lock, RotateCcw } from 'lucide-react';
import SignaturePad from './SignaturePad';
import OfficialLetterGenerator from './OfficialLetterGenerator';
import OfficialApplicationFormPdf from './OfficialApplicationFormPdf';
import { BeritaAcaraVerifikasi, SuratKeputusan } from './PengurusDocuments';
import { DEFAULT_SIGNATURE_POS, SIGNABLE_DOCS } from './PengurusSignature';
import { notify } from './AppDialog';
import { fileUrl } from '../utils/fileUrl';
import { loadViewed, addViewed, docViewKey, paymentViewKey } from '../utils/viewedDocs';

// Tab tambahan di modal TTD: berkas unggahan pemohon (bukan dokumen yang ditandatangani)
const FILES_TAB = 'berkas_pemohon';

const DOC_COMPONENTS = {
  surat: OfficialLetterGenerator,
  formulir: OfficialApplicationFormPdf,
  berita_acara: BeritaAcaraVerifikasi,
  sk: SuratKeputusan,
};

const isDocKey = (key) => SIGNABLE_DOCS.some((d) => d.key === key);

const initialPositions = (role) =>
  Object.fromEntries(SIGNABLE_DOCS.map((d) => [d.key, DEFAULT_SIGNATURE_POS[role]]));

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
});

// TTD tersimpan milik akun yang login (Ketua / Sekretaris): dibuat sekali, dipakai berulang
export function useMySignature(enabled = true) {
  const [signature, setSignature] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    fetch('/api/auth/signature', { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setSignature(data.signature || null))
      .catch((err) => console.error('Failed to load signature:', err));
  }, [enabled]);

  // Mengembalikan true bila berhasil disimpan
  const save = async (image) => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/signature', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ signature: image })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSignature(data.signature);
      return true;
    } catch (err) {
      notify('Gagal menyimpan tanda tangan: ' + err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { signature, saving, save };
}

function SignatureEditorModal({ title, signature, saving, onSave, onClose }) {
  // Dirender di <body> agar tidak terpotong oleh kontainer halaman (transform/overflow)
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto modal-overlay flex items-center justify-center p-4">
      <div className="modal-surface max-w-lg w-full p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium text-lg text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Gambar dengan mouse, trackpad, atau jari — atau unggah gambar TTD (PNG transparan paling rapi).</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SignaturePad onSave={onSave} saving={saving} initialImage={signature} />
      </div>
    </div>
  , document.body);
}

// Kartu "Tanda tangan saya" + editor untuk membuat / mengganti TTD tersimpan
export function MySignatureCard({ roleLabel, signature, saving, onSave }) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async (image) => {
    if (await onSave(image)) setIsEditing(false);
  };

  return (
    <>
      <div className="card-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl flex-shrink-0">
            <PenLine className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg text-slate-800">Tanda tangan saya <span className="text-sm text-slate-400">· {roleLabel}</span></h3>
            <p className="text-xs text-slate-500">
              {signature
                ? 'Tersimpan dan siap dibubuhkan berulang kali pada surat pengantar.'
                : 'Buat tanda tangan sekali, lalu bubuhkan pada setiap surat pengantar.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {signature && (
            <div className="h-14 w-40 rounded-xl border border-slate-200 bg-white flex items-center justify-center p-1.5">
              <img src={signature} alt="Tanda tangan tersimpan" className="max-h-full max-w-full object-contain" />
            </div>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
              signature ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            }`}
          >
            {signature ? 'Ganti TTD' : 'Buat Tanda Tangan'}
          </button>
        </div>
      </div>

      {isEditing && (
        <SignatureEditorModal
          title={`Tanda tangan ${roleLabel}`}
          signature={signature}
          saving={saving}
          onSave={handleSave}
          onClose={() => setIsEditing(false)}
        />
      )}
    </>
  );
}

// Pratinjau semua dokumen pengurus + pembubuhan TTD (seperti e-meterai): pindah tab per dokumen,
// geser & atur ukuran TTD sekali (berlaku di semua dokumen), lalu konfirmasi sekaligus.
// role: 'chairman' (Ketua) | 'secretary' (Sekretaris). onConfirm menerima { [docKey]: {x, y, w} }.
export function SignLetterModal({
  role, submission, settings, signature, savingSignature, onSaveSignature,
  title, subtitle, confirmLabel, processing, onConfirm, onClose
}) {
  const [positions, setPositions] = useState(() => initialPositions(role));
  const [activeDoc, setActiveDoc] = useState(SIGNABLE_DOCS[0].key);
  // Progres buka dokumen disimpan per pengguna & pengajuan: tidak hilang saat Batal lalu dibuka lagi.
  // Berkas yang sudah dibuka di modal verifikasi ikut terhitung (kunci yang sama).
  const [viewed, setViewed] = useState(() => {
    const set = loadViewed(submission.id);
    set.add(`letter-${SIGNABLE_DOCS[0].key}`);
    return set;
  });
  const markViewed = (key) => {
    setViewed((s) => new Set(s).add(key));
    addViewed(submission.id, key);
  };
  useEffect(() => { addViewed(submission.id, `letter-${SIGNABLE_DOCS[0].key}`); }, [submission.id]);
  const visited = { has: (key) => viewed.has(`letter-${key}`) };
  const [detail, setDetail] = useState(null);

  // Data lengkap pengajuan (berkas, pembayaran, pengaturan surat) untuk semua dokumen
  useEffect(() => {
    fetch(`/api/submissions/${submission.id}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then(setDetail)
      .catch((err) => console.error('Failed to load submission detail:', err));
  }, [submission.id]);

  const fullSubmission = detail?.submission
    ? { ...submission, ...detail.submission, reference_number: detail.submission.reference_number || submission.reference_number }
    : submission;
  const docSettings = detail?.settings || settings;

  // Posisi & ukuran TTD sama di semua dokumen: geser/ubah di satu tab, tab lain ikut
  const pos = positions[isDocKey(activeDoc) ? activeDoc : SIGNABLE_DOCS[0].key];
  const setPos = (updater) =>
    setPositions((all) => {
      const next = typeof updater === 'function' ? updater(pos) : updater;
      return Object.fromEntries(Object.keys(all).map((k) => [k, next]));
    });

  const openDoc = (key) => {
    setActiveDoc(key);
    markViewed(`letter-${key}`);
  };

  // Berkas unggahan pemohon + bukti transfer wajib dibuka sebelum menandatangani
  const files = detail ? [
    ...(detail.documents || []).filter((d) => d.file_path).map((d) => ({ key: docViewKey(d), title: d.document_title, name: d.file_name, path: d.file_path })),
    ...(detail.payment?.proof_file ? [{ key: paymentViewKey(detail.payment.proof_file), title: 'Bukti transfer pembayaran', name: detail.payment.proof_filename, path: detail.payment.proof_file }] : []),
  ] : [];
  const docsSeen = SIGNABLE_DOCS.filter((d) => visited.has(d.key)).length;
  const filesSeen = files.filter((f) => viewed.has(f.key)).length;
  const totalToReview = SIGNABLE_DOCS.length + files.length;
  const allReviewed = Boolean(detail) && docsSeen + filesSeen === totalToReview;
  const isFilesTab = activeDoc === FILES_TAB;

  const ActiveDocument = DOC_COMPONENTS[activeDoc];

  // Dirender di <body> agar menutup seluruh layar dan tidak terpotong oleh kontainer halaman
  return createPortal(
    <div className="fixed inset-0 z-[70] modal-overlay flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="modal-surface w-full max-w-4xl sm:max-h-[94vh] flex flex-col overflow-hidden !rounded-none sm:!rounded-3xl">
        <div className="bg-[#0da2e7] text-white px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <PenTool className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-base sm:text-lg truncate">{title}</h3>
            <p className="text-xs text-[#dff2fd] truncate">{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="p-2 rounded-xl hover:bg-white/15">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!signature ? (
          // Belum punya TTD tersimpan: buat dulu, lalu lanjut ke pratinjau dokumen
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
            <div className="bg-[#f0f9ff] p-4 rounded-xl border border-[#b8e6fc] text-xs text-slate-600">
              Anda belum memiliki tanda tangan tersimpan. Buat sekarang, tanda tangan ini akan dipakai ulang untuk dokumen berikutnya.
            </div>
            <SignaturePad onSave={onSaveSignature} saving={savingSignature} />
          </div>
        ) : (
          <>
            {/* Tab dokumen: semua ditandatangani sekaligus */}
            <div className="border-b border-slate-200 bg-white px-3 sm:px-6 py-2.5">
              <div className="flex gap-1.5 overflow-x-auto">
                {SIGNABLE_DOCS.map((d, i) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => openDoc(d.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                      activeDoc === d.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {visited.has(d.key) && activeDoc !== d.key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span>{i + 1}.</span>}
                    {d.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveDoc(FILES_TAB)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                    isFilesTab ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {files.length > 0 && filesSeen === files.length && !isFilesTab ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Paperclip className="w-3.5 h-3.5" />}
                  Berkas pemohon ({filesSeen}/{files.length})
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Tanda tangan dibubuhkan pada {SIGNABLE_DOCS.length} dokumen sekaligus. Buka tiap tab dan setiap berkas pemohon sebelum menandatangani.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-100 p-2 sm:p-5">
              {isFilesTab ? (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 max-w-2xl mx-auto">
                  <p className="text-xs text-slate-600">Buka setiap berkas persyaratan dan bukti transfer yang sudah diverifikasi Admin.</p>
                  {!detail ? (
                    <p className="text-xs text-slate-400">Memuat berkas...</p>
                  ) : files.length === 0 ? (
                    <p className="text-xs text-slate-400">Tidak ada berkas unggahan.</p>
                  ) : files.map((f, i) => (
                    <div key={f.key} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800">{i + 1}. {f.title}</p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">{f.name || '-'}</p>
                      </div>
                      <a
                        href={fileUrl(f.path)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => markViewed(f.key)}
                        className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1 transition ${
                          viewed.has(f.key) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#f0f9ff] text-[#0884c4] border-[#b8e6fc] hover:bg-[#dff2fd]'
                        }`}
                      >
                        {viewed.has(f.key) ? <><Check className="w-3.5 h-3.5" /> Sudah dibuka</> : <><ExternalLink className="w-3.5 h-3.5" /> Buka berkas</>}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <ActiveDocument
                  key={activeDoc}
                  submission={fullSubmission}
                  settings={docSettings}
                  documents={detail?.documents || []}
                  payment={detail?.payment || null}
                  signing={{ role, img: signature, pos, onChange: setPos }}
                />
              )}
            </div>

            <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Ukuran diatur lewat titik biru di sudut TTD; posisi & ukuran berlaku untuk semua dokumen */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {!isFilesTab && (
                  <button
                    type="button"
                    onClick={() => setPos(DEFAULT_SIGNATURE_POS[role])}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset posisi
                  </button>
                )}
                {/* Syarat TTD: semua dokumen surat & berkas pemohon wajib dibuka dulu */}
                {allReviewed ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> Semua dokumen sudah dibuka, siap TTD
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                    Buka semua dokumen dulu untuk bisa TTD ({docsSeen + filesSeen}/{detail ? totalToReview : '…'})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm(positions)}
                  disabled={processing || !allReviewed}
                  title={allReviewed ? undefined : 'Buka semua dokumen surat dan berkas pemohon terlebih dahulu'}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <CheckCircle className="w-4 h-4" />
                  {processing ? 'Membubuhkan TTD...' : confirmLabel}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  , document.body);
}
