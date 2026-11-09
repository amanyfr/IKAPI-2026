import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Download, Printer } from 'lucide-react';
import { KopSurat, formatLongDate } from './PengurusSignature';
import { downloadElementPdf, printElement, safeFileName } from '../utils/exportDocument';

// Pengaturan invoice yang bisa diubah Admin (Pengaturan → Invoice / Kuitansi Pembayaran)
export const INVOICE_DEFAULTS = {
  invoice_title: 'Invoice Pembayaran Keanggotaan',
  invoice_prefix: 'INV/IKAPI-JABAR',
  invoice_issuer_name: 'Bendahara PD IKAPI Jawa Barat',
  invoice_issuer_title: 'Bendahara',
  invoice_notes: 'Invoice ini diterbitkan secara elektronik oleh sistem IKAPI Jawa Barat dan sah tanpa tanda tangan basah.',
};

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

export function invoiceNumber(submission, settings) {
  const prefix = settings?.invoice_prefix || INVOICE_DEFAULTS.invoice_prefix;
  const year = new Date(submission.created_at || Date.now()).getFullYear();
  return `${prefix}/${year}/${String(submission.id).padStart(4, '0')}`;
}

// Baris tagihan dari rincian biaya yang tersimpan saat pengajuan dibuat
export function invoiceItems(payment) {
  const fb = payment?.fee_breakdown || {};
  const items = [
    ['Uang Pangkal', fb.uangPangkal],
    [`Iuran Keanggotaan ${fb.durasiBulan || 24} Bulan`, fb.iuran24Bulan],
    ['Biaya Administrasi', fb.administrasi],
  ].filter(([, amount]) => Number(amount) > 0);
  return items.length ? items : [['Biaya Keanggotaan', payment?.amount]];
}

export function isInvoicePaid(payment) {
  return payment?.verification_status === 'Valid';
}

const statusText = (payment) =>
  isInvoicePaid(payment) ? 'LUNAS' : payment?.verification_status === 'Perlu Revisi' ? 'PERLU PERBAIKAN' : 'MENUNGGU VERIFIKASI';

// Unduh invoice tanpa membuka pratinjau: invoice dirender sementara di luar layar, lalu diambil gambarnya
export async function downloadInvoicePdf({ submission, payment, settings }) {
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: '794px', background: '#fff' });
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<PaymentInvoice submission={submission} payment={payment} settings={settings} />));
    await downloadElementPdf(host.querySelector('[data-paper]'), invoiceFileName(submission));
  } finally {
    root.unmount();
    host.remove();
  }
}

const invoiceFileName = (submission) => `Invoice_${safeFileName(submission.publisher_name)}.pdf`;

const TYPE_LABEL = { Baru: 'Pendaftaran Anggota Baru', Heregistrasi: 'Registrasi Ulang (Heregistrasi)' };

// Alamat penagihan: alamat + kota + kode pos, tanpa mengulang kota yang sudah tertulis di alamat
function billingAddress(sub) {
  const address = String(sub.address || '').trim();
  const city = String(sub.city || '').trim();
  const postal = String(sub.postal_code || '').trim();
  const parts = [address];
  if (city && !address.toLowerCase().includes(city.toLowerCase())) parts.push(city);
  if (postal && postal !== '-' && !address.includes(postal)) parts.push(postal);
  return parts.filter((p) => p && p !== '-').join(', ');
}

function InfoBox({ title, className = '', children }) {
  return (
    <div className={`border border-slate-200 rounded-lg p-4 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0b86c2] mb-2">{title}</p>
      {children}
    </div>
  );
}

// Baris label : nilai; baris tanpa nilai tidak ditampilkan
function InfoRows({ rows }) {
  return (
    <dl className="grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1 text-xs">
      {rows
        .filter(([, value]) => value && value !== '-')
        .map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-slate-500 whitespace-nowrap">{label}</dt>
            <span className="text-slate-500" aria-hidden="true">:</span>
            <dd className="text-slate-800 break-words">{value}</dd>
          </React.Fragment>
        ))}
    </dl>
  );
}

// Tampilan invoice (HTML) untuk pratinjau anggota & Admin
export default function PaymentInvoice({ submission, payment, settings }) {
  const paperRef = useRef(null);
  if (!submission || !payment) return null;
  const s = { ...INVOICE_DEFAULTS, ...settings };
  const paid = isInvoicePaid(payment);
  const dateStr = formatLongDate(payment.verified_at || payment.transfer_date);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#f0f9ff] px-6 py-3 border-b border-[#b8e6fc] flex flex-wrap items-center justify-between gap-3 no-print">
        <span className="font-bold text-slate-800 text-sm">{s.invoice_title}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => printElement(paperRef.current, invoiceFileName(submission).replace('.pdf', ''))}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak
          </button>
          <button
            onClick={() => downloadElementPdf(paperRef.current, invoiceFileName(submission))}
            className="px-3.5 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" /> Unduh PDF
          </button>
        </div>
      </div>

      <div ref={paperRef} data-paper className="p-6 sm:p-10 max-w-3xl mx-auto font-sans text-slate-900 text-sm bg-white">
        <KopSurat settings={settings} />

        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold uppercase tracking-wide">{s.invoice_title}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-4 mb-6">
          <InfoBox title="Ditagihkan kepada">
            <p className="font-semibold text-[15px] text-slate-900 leading-snug">{submission.publisher_name}</p>
            <p className="text-[11px] text-slate-500 mb-2">Penerbit pemohon keanggotaan IKAPI Jawa Barat</p>
            <InfoRows
              rows={[
                ['Pimpinan', [submission.leader_name, submission.leader_title].filter(Boolean).join(' — ')],
                ['Alamat', billingAddress(submission)],
                ['Telepon', submission.publisher_phone || submission.leader_phone],
                ['Email', submission.publisher_email],
              ]}
            />
          </InfoBox>
          <InfoBox title="Rincian invoice">
            <InfoRows
              rows={[
                ['No. Invoice', <span className="font-mono font-semibold whitespace-nowrap">{invoiceNumber(submission, settings)}</span>],
                ['Tanggal', dateStr],
                ['Jenis', TYPE_LABEL[submission.submission_type] || submission.submission_type],
                ['Kategori', submission.member_category || submission.category],
                ['No. KTA', submission.member_kta || submission.old_kta_number],
              ]}
            />
          </InfoBox>
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="bg-[#f0f9ff] text-xs text-slate-600">
              <th className="text-left font-semibold px-3 py-2">Uraian</th>
              <th className="text-right font-semibold px-3 py-2">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {invoiceItems(payment).map(([label, amount]) => (
              <tr key={label} className="border-b border-slate-100">
                <td className="px-3 py-2">{label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rupiah(amount)}</td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2.5 font-semibold">Total</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{rupiah(payment.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <InfoBox title="Informasi pembayaran" className="flex-1 sm:max-w-md">
            <InfoRows
              rows={[
                ['Rekening tujuan', `${settings?.bank_name || 'Bank BNI'} ${settings?.bank_account || ''} a.n. ${settings?.bank_holder || '-'}`],
                ['Rekening pengirim', [payment.sender_bank, payment.sender_account_number].filter(Boolean).join(' ') + (payment.sender_account_name ? ` a.n. ${payment.sender_account_name}` : '')],
                ['Tanggal transfer', formatLongDate(payment.transfer_date)],
              ]}
            />
          </InfoBox>
          <span className={`self-start px-4 py-2 rounded-lg border-2 font-bold tracking-wider -rotate-3 ${
            paid ? 'border-emerald-600 text-emerald-600 text-xl' : 'border-amber-500 text-amber-600 text-xs'
          }`}>
            {statusText(payment)}
          </span>
        </div>

        <div className="flex justify-end mt-8">
          <div className="text-center text-sm min-w-56">
            <p>Bandung, {dateStr}</p>
            <p>{s.invoice_issuer_title},</p>
            <p className="font-bold underline mt-20">{s.invoice_issuer_name}</p>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic mt-8 border-t border-slate-100 pt-3">{s.invoice_notes}</p>
      </div>
    </div>
  );
}
