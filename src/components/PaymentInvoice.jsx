import React from 'react';
import { Download, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { KopSurat, drawKopPdf, formatLongDate } from './PengurusSignature';

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

export function downloadInvoicePdf({ submission, payment, settings }) {
  const s = { ...INVOICE_DEFAULTS, ...settings };
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let y = drawKopPdf(doc, settings);

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text(s.invoice_title.toUpperCase(), 105, y + 2, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`No. ${invoiceNumber(submission, settings)}`, 105, y + 8, { align: 'center' });
  y += 20;

  doc.setFont('times', 'bold');
  doc.text('Ditagihkan kepada:', 20, y);
  doc.text('Tanggal:', 130, y);
  doc.setFont('times', 'normal');
  doc.text(submission.publisher_name || '-', 20, y + 5);
  doc.text(`${submission.leader_name || '-'}`, 20, y + 10);
  doc.text(doc.splitTextToSize(`${submission.address || ''} ${submission.city || ''}`.trim() || '-', 95), 20, y + 15);
  doc.text(formatLongDate(payment?.verified_at || payment?.transfer_date), 130, y + 5);
  y += 30;

  doc.setFillColor(240, 249, 255);
  doc.rect(20, y - 5, 170, 8, 'F');
  doc.setFont('times', 'bold');
  doc.text('Keterangan', 24, y);
  doc.text('Jumlah', 186, y, { align: 'right' });
  doc.setFont('times', 'normal');
  y += 9;
  invoiceItems(payment).forEach(([label, amount]) => {
    doc.text(label, 24, y);
    doc.text(rupiah(amount), 186, y, { align: 'right' });
    y += 7;
  });
  doc.setLineWidth(0.3);
  doc.line(20, y - 3, 190, y - 3);
  doc.setFont('times', 'bold');
  doc.text('Total', 24, y + 3);
  doc.text(rupiah(payment?.amount), 186, y + 3, { align: 'right' });
  y += 16;

  doc.setFont('times', 'normal');
  doc.text(`Dibayar ke   : ${settings?.bank_name || 'Bank BNI'} ${settings?.bank_account || ''} a.n. ${settings?.bank_holder || ''}`, 20, y);
  doc.text(`Dari         : ${payment?.sender_bank || '-'} a.n. ${payment?.sender_account_name || '-'}`, 20, y + 6);
  doc.text(`Tgl transfer : ${formatLongDate(payment?.transfer_date)}`, 20, y + 12);

  // Cap status pembayaran
  const paid = isInvoicePaid(payment);
  doc.setDrawColor(...(paid ? [16, 150, 90] : [217, 119, 6]));
  doc.setTextColor(...(paid ? [16, 150, 90] : [217, 119, 6]));
  doc.setLineWidth(0.8);
  doc.roundedRect(130, y - 6, 58, 14, 2, 2);
  doc.setFont('times', 'bold');
  doc.setFontSize(paid ? 16 : 10);
  doc.text(statusText(payment), 159, y + 3, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  y += 30;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`Bandung, ${formatLongDate(payment?.verified_at || payment?.transfer_date)}`, 150, y, { align: 'center' });
  doc.text(s.invoice_issuer_title, 150, y + 5, { align: 'center' });
  doc.setFont('times', 'bold');
  doc.text(s.invoice_issuer_name, 150, y + 25, { align: 'center' });
  y += 38;

  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(s.invoice_notes, 170), 20, y);

  doc.save(`Invoice_${(submission.publisher_name || 'IKAPI').replace(/\s+/g, '_')}.pdf`);
}

// Tampilan invoice (HTML) untuk pratinjau anggota & Admin
export default function PaymentInvoice({ submission, payment, settings }) {
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
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak
          </button>
          <button
            onClick={() => downloadInvoicePdf({ submission, payment, settings })}
            className="px-3.5 py-1.5 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" /> Unduh PDF
          </button>
        </div>
      </div>

      <div className="p-6 sm:p-10 max-w-3xl mx-auto font-sans text-slate-900 text-sm">
        <KopSurat settings={settings} />

        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold uppercase tracking-wide">{s.invoice_title}</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">No. {invoiceNumber(submission, settings)}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-slate-500">Ditagihkan kepada</p>
            <p className="font-medium">{submission.publisher_name}</p>
            <p className="text-slate-600">{submission.leader_name}</p>
            <p className="text-slate-600 text-xs">{[submission.address, submission.city].filter(Boolean).join(', ')}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-slate-500">Tanggal</p>
            <p className="font-medium">{dateStr}</p>
          </div>
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="bg-[#f0f9ff] text-xs text-slate-600">
              <th className="text-left font-semibold px-3 py-2">Keterangan</th>
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
          <div className="text-xs text-slate-600 space-y-1">
            <p>Dibayar ke: <strong>{settings?.bank_name || 'Bank BNI'} {settings?.bank_account}</strong> a.n. {settings?.bank_holder}</p>
            <p>Dari: {payment.sender_bank || '-'} a.n. {payment.sender_account_name || '-'}</p>
            <p>Tanggal transfer: {formatLongDate(payment.transfer_date)}</p>
          </div>
          <span className={`self-start px-4 py-2 rounded-lg border-2 font-bold tracking-wider -rotate-3 ${
            paid ? 'border-emerald-600 text-emerald-600 text-xl' : 'border-amber-500 text-amber-600 text-xs'
          }`}>
            {statusText(payment)}
          </span>
        </div>

        <div className="flex justify-end mt-8">
          <div className="text-center text-xs">
            <p>Bandung, {dateStr}</p>
            <p>{s.invoice_issuer_title}</p>
            <p className="font-semibold mt-10">{s.invoice_issuer_name}</p>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic mt-8 border-t border-slate-100 pt-3">{s.invoice_notes}</p>
      </div>
    </div>
  );
}
