import nodemailer from 'nodemailer';
import { query } from './db.js';

// Email dikirim lewat SMTP bila SMTP_HOST diisi di .env. Tanpa SMTP, email tidak dikirim:
// isinya dicatat di tabel email_logs (status 'skipped') dan di console server.
export const MAIL_ENABLED = Boolean(process.env.SMTP_HOST);
export const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

const transporter = MAIL_ENABLED
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined
    })
  : null;

const FROM = process.env.SMTP_FROM || 'IKAPI Jawa Barat <no-reply@ikapi-jabar.or.id>';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Bungkus isi email dengan kop sederhana IKAPI Jabar. `lines` berisi paragraf teks biasa.
function layout(title, lines, action) {
  const paragraphs = lines.filter(Boolean).map((l) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`).join('');
  const button = action
    ? `<p style="margin:20px 0"><a href="${escapeHtml(action.url)}" style="background:#0da2e7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 12px;font-size:12px;color:#64748b">Jika tombol tidak berfungsi, buka tautan ini: ${escapeHtml(action.url)}</p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;max-width:560px">
    <p style="font-weight:700;color:#0884c4;margin:0 0 4px">IKAPI Pengurus Daerah Jawa Barat</p>
    <h2 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h2>
    ${paragraphs}${button}
    <p style="margin:24px 0 0;font-size:12px;color:#64748b">Email ini dikirim otomatis oleh Sistem Keanggotaan IKAPI Jawa Barat.</p>
  </div>`;
}

export async function sendMail({ to, subject, title, lines = [], action = null }) {
  if (!to) return;
  const text = [title, '', ...lines.filter(Boolean), action ? `\n${action.label}: ${action.url}` : ''].join('\n');
  let status = 'skipped';
  let error = null;
  if (transporter) {
    try {
      await transporter.sendMail({ from: FROM, to, subject, text, html: layout(title || subject, lines, action) });
      status = 'sent';
    } catch (err) {
      status = 'failed';
      error = err.message;
      console.error(`Gagal kirim email ke ${to}:`, err.message);
    }
  } else {
    console.log(`[email belum aktif, SMTP_HOST kosong] Ke: ${to} | ${subject}${action ? ` | ${action.url}` : ''}`);
  }
  // Tautan berisi token (verifikasi / reset sandi) tidak disimpan di log database.
  const logText = action?.sensitive ? text.replace(action.url, '[tautan rahasia disembunyikan]') : text;
  try {
    await query.run(
      'INSERT INTO email_logs (to_email, subject, body, status, error) VALUES (?, ?, ?, ?, ?)',
      [to, subject, logText, status, error]
    );
  } catch (err) {
    console.error('Gagal mencatat email_logs:', err.message);
  }
}
