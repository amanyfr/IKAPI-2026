import React, { useRef } from 'react';
import { Printer, Download, FileSpreadsheet } from 'lucide-react';
import { PengurusSignatureBlock } from './PengurusSignature';
import { downloadElementPdf, printElement, safeFileName } from '../utils/exportDocument';
import { heregistrasiRows, pemasaranText, naskahText, karyawanText, listText } from '../utils/formulirIkapi';

const PENGESAHAN_TEXT = 'Formulir ini telah diperiksa dan disahkan oleh Pengurus Daerah IKAPI Jawa Barat.';

// `signing` (opsional): mode pembubuhan TTD pada kolom pengesahan pengurus (lihat PengurusSignature)
export default function OfficialApplicationFormPdf({ submission, settings, signing = null }) {
  const paperRef = useRef(null);
  if (!submission) return null;

  const formData = typeof submission.form_data === 'string'
    ? JSON.parse(submission.form_data || '{}')
    : submission.form_data || {};

  const isHeregistrasi = submission.submission_type === 'Heregistrasi';
  const specStr = Array.isArray(formData.specialization)
    ? formData.specialization.join(', ')
    : (submission.specialization || formData.specialization || 'Buku Pendidikan, Referensi, Umum');

  const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const penanggungJawab = submission.person_in_charge || formData.personInCharge || submission.leader_name || formData.leaderName || '';

  const fileName = `${isHeregistrasi ? 'Formulir_Heregistrasi_IKAPI' : 'Formulir_Menjadi_Anggota_IKAPI'}_${safeFileName(submission.publisher_name, 'Pemohon')}.pdf`;
  const handlePrint = () => printElement(paperRef.current, fileName.replace('.pdf', ''));
  const handleDownloadPdf = () => downloadElementPdf(paperRef.current, fileName);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`bg-[#f0f9ff] px-6 py-3 border-b border-[#b8e6fc] flex-wrap items-center justify-between gap-3 no-print ${signing ? 'hidden' : 'flex'}`}>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-[#0da2e7]" />
          <span className="font-bold text-slate-800 text-sm">
            Formulir Digital Resmi IKAPI 2026 (Lampiran PDF)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Formulir
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-3.5 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" /> Unduh PDF Formulir 2026
          </button>
        </div>
      </div>

      {isHeregistrasi ? (
        <div ref={paperRef} data-paper className="p-8 sm:p-10 max-w-3xl mx-auto font-serif text-slate-900 bg-white">
          <h2 className="text-center text-base sm:text-lg font-bold uppercase underline underline-offset-4">
            Formulir Heregistrasi Anggota IKAPI
          </h2>
          <ol className="mt-6 space-y-1.5 text-sm">
            {heregistrasiRows(submission, formData).map(([label, value], idx) => (
              <li key={label} className="grid grid-cols-[1.75rem_minmax(0,15rem)_0.75rem_1fr] gap-x-1 py-1 border-b border-dotted border-slate-200">
                <span className="text-slate-500">{idx + 1}.</span>
                <span>{label}</span>
                <span>:</span>
                <span className="font-medium break-words">{value}</span>
              </li>
            ))}
          </ol>

          <div className="flex justify-end text-sm pt-8">
            <div className="w-60 text-center">
              <p>Bandung, {todayStr}</p>
              <p>Penanggung jawab penerbit</p>
              <p className="mt-14">( {penanggungJawab || '______________________'} )</p>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 pt-4 mt-8 font-sans">
            <p className="text-xs text-slate-500 italic text-center">{PENGESAHAN_TEXT}</p>
            <PengurusSignatureBlock
              submission={submission}
              settings={settings}
              docKey="formulir"
              signing={signing}
              heading={<>PENGESAHAN PENGURUS DAERAH<br />IKAPI JAWA BARAT</>}
              className="mt-10 pt-2"
            />
          </div>
        </div>
      ) : (
      <div ref={paperRef} data-paper className="p-8 sm:p-10 max-w-3xl mx-auto font-sans text-slate-900 bg-white space-y-6">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-4">
          <h2 className="text-base sm:text-lg font-black tracking-wide text-[#0884c4] uppercase">
            Formulir Pendaftaran & Heregistrasi Anggota IKAPI 2026
          </h2>
          <h3 className="text-sm font-bold text-slate-700 uppercase">
            Ikatan Penerbit Indonesia (IKAPI) Pengurus Daerah Jawa Barat
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Jenis Pengajuan: <strong>{submission.submission_type}</strong> • Kategori: <strong>Anggota {submission.member_category || submission.category || 'Biasa'}</strong>
          </p>
        </div>

        {/* 1. Identitas */}
        <FormSection title="1. Identitas Anggota Penerbit">
          <FormRow label="Jenis Pengajuan" value={submission.submission_type} />
          <FormRow label="Kategori Anggota" value={`Anggota ${submission.member_category || submission.category || 'Biasa'}`} />
          {isHeregistrasi && (
            <FormRow label="No. Anggota IKAPI (KTA Lama)" value={submission.old_kta_number || formData.oldKtaNumber || '-'} />
          )}
          <FormRow label="Nama Penerbit" value={submission.publisher_name || formData.publisherName} bold />
          <FormRow label="Bentuk Badan Usaha / Institusi" value={submission.legal_entity || formData.legalEntity || 'PT / CV'} />
          <FormRow label="NIB / NPWP" value={`NIB: ${submission.nib || formData.nib || '-'} | NPWP: ${submission.npwp || formData.npwp || '-'}`} />
          <FormRow label="Nama Pimpinan" value={`${submission.leader_name || formData.leaderName || '-'} (${submission.leader_title || formData.leaderTitle || 'Pimpinan'})`} />
          <FormRow label="Alamat Kantor" value={`${submission.address || formData.address || '-'}, ${submission.city || formData.city || '-'} ${submission.postal_code || formData.postalCode || ''}`} />
          <FormRow label="Telepon / Faksimili" value={`Telp: ${submission.publisher_phone || formData.phone || '-'} | Fax: ${submission.fax || formData.fax || '-'}`} />
          <FormRow label="Email / Website" value={`Email: ${submission.publisher_email || formData.email || '-'} | Web: ${submission.website || formData.website || '-'}`} />
          <FormRow label="Penanggung Jawab Penerbitan" value={`${submission.person_in_charge || formData.personInCharge || '-'} (No. Sertifikat BNSP: ${submission.bnsp_certificate_no || formData.bnspCertificateNo || 'Terverifikasi'})`} />
        </FormSection>

        {/* 2. Profil (Khusus Baru) */}
        {!isHeregistrasi && (
          <FormSection title="2. Profil Penerbit (Anggota Baru)">
            <FormRow label="Tujuan Menjadi Anggota" value={formData.tujuanMenjadiAnggota || 'Meningkatkan profesionalisme penerbitan & jejaring distribusi buku'} />
            <FormRow label="Tahun Mulai Usaha" value={formData.tahunMulaiUsaha || 'Berdasarkan buku terbit / akta pendirian'} />
          </FormSection>
        )}

        {/* 3. Terbitan */}
        <FormSection title="3. Data Terbitan">
          <FormRow label="Jenis Terbitan" value={specStr} />
          <FormRow label="Jumlah Judul Terbit" value={formData.jumlahJudulTerbit ? `${formData.jumlahJudulTerbit} Judul` : '-'} />
          <FormRow label="Rata-rata Oplah Cetakan Pertama" value={formData.rataRataOplah ? `${formData.rataRataOplah} Eksemplar` : '-'} />
          <FormRow label="Rencana Produksi (Judul/Tahun)" value={formData.annualBookCount ? `${formData.annualBookCount} Judul / Tahun` : '-'} />
        </FormSection>

        {/* 4. Pemasaran */}
        <FormSection title="4. Pemasaran & Penjualan">
          <FormRow label="Sistem Pemasaran" value={pemasaranText(formData)} />
          <FormRow label="Rata-rata Diskon (%)" value={formData.rataRataDiskon ? `${String(formData.rataRataDiskon).replace('%', '')}%` : '-'} />
          <FormRow label="Sistem Penjualan" value={listText(formData.sistemPenjualan) || '-'} />
        </FormSection>

        {/* 5. Naskah */}
        <FormSection title="5. Pengadaan Naskah">
          <FormRow label="Sistem Pengadaan Naskah" value={naskahText(formData)} />
        </FormSection>

        {/* 6. Organisasi */}
        <FormSection title="6. Organisasi & Kantor">
          <FormRow label="Jumlah Karyawan" value={karyawanText(formData)} />
          <FormRow label="Kepemilikan Kantor" value={formData.kepemilikanKantor || '-'} />
          <FormRow label="Lokasi Kantor" value={formData.lokasiKantor || '-'} />
          {isHeregistrasi && (
            <>
              <FormRow label="Kantor Cabang / Perwakilan" value={formData.kantorCabang || '-'} />
              <FormRow label="Lini Penerbitan" value={formData.liniPenerbitan || 'Penerbitan Utama'} />
            </>
          )}
        </FormSection>

        {/* 7. Produksi */}
        <FormSection title="7. Data Teknis Produksi">
          <FormRow label="Software Produksi" value={formData.softwareProduksi || '-'} />
          <FormRow label="Nomor ISBN yang Sudah Digunakan" value={formData.contohIsbn || '-'} />
          <FormRow label="Jenis Kertas" value={formData.jenisKertas || '-'} />
          <FormRow label="Mencetak Buku" value={formData.sistemCetak || '-'} />
          <FormRow label="Pekerjaan yang Dioutsourcing" value={formData.pekerjaanOutsource || '-'} />
        </FormSection>

        {/* Signature Box */}
        <div className="flex justify-end text-xs text-right pt-4">
          <div className="w-56 text-center space-y-10">
            <p className="text-slate-600">
              Bandung, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              <br />
              Pimpinan Penerbit Pemohon,
            </p>
            <div>
              <p className="font-bold text-slate-900 underline">{submission.leader_name || formData.leaderName}</p>
              <p className="text-slate-500">{submission.leader_title || formData.leaderTitle || 'Pimpinan'}</p>
            </div>
          </div>
        </div>

        {/* Pengesahan Pengurus Daerah */}
        <div className="border-t border-dashed border-slate-300 pt-4">
          <p className="text-xs text-slate-500 italic text-center">{PENGESAHAN_TEXT}</p>
          <PengurusSignatureBlock
            submission={submission}
            settings={settings}
            docKey="formulir"
            signing={signing}
            heading={<>PENGESAHAN PENGURUS DAERAH<br />IKAPI JAWA BARAT</>}
            className="mt-10 pt-2"
          />
        </div>
      </div>
      )}
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-[#0884c4] bg-[#f0f9ff] px-3 py-1.5 rounded-lg border-l-4 border-[#0da2e7] uppercase mb-2">
        {title}
      </h4>
      <table className="w-full text-xs">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function FormRow({ label, value, bold }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-1.5 w-2/5 text-slate-600 font-medium">{label}</td>
      <td className={`py-1.5 ${bold ? 'font-black text-slate-900' : 'text-slate-800'}`}>{value || '-'}</td>
    </tr>
  );
}
