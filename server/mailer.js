import nodemailer from 'nodemailer';
import { query } from './db.js';

// Email dikirim lewat SMTP. Konfigurasi diambil dari Pengaturan Sistem (tabel settings, kunci smtp_*)
// yang diatur Admin; bila smtp_host di sana kosong, dipakai SMTP_* dari .env. Tanpa SMTP sama sekali,
// email tidak dikirim: isinya dicatat di tabel email_logs (status 'skipped') dan di console server.
export const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
export const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from'];
const DEFAULT_FROM = 'IKAPI Jawa Barat <no-reply@ikapi-jabar.or.id>';

let config = null;      // konfigurasi SMTP aktif
let transporter = null;

function envConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || DEFAULT_FROM
  };
}

// Baca ulang konfigurasi SMTP (dipanggil saat server start dan setelah Admin menyimpan pengaturan SMTP)
export async function reloadMailConfig() {
  let cfg = envConfig();
  try {
    const rows = await query.all(
      `SELECT settings.key, settings.value FROM settings WHERE settings.key IN (${SMTP_KEYS.map(() => '?').join(', ')})`,
      SMTP_KEYS
    );
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    if (String(s.smtp_host || '').trim()) {
      cfg = {
        host: s.smtp_host.trim(),
        port: Number(s.smtp_port) || 587,
        secure: String(s.smtp_secure || '').toLowerCase() === 'true',
        user: String(s.smtp_user || '').trim(),
        pass: String(s.smtp_pass || ''),
        from: String(s.smtp_from || '').trim() || DEFAULT_FROM
      };
    }
  } catch (err) {
    console.error('Gagal membaca pengaturan SMTP:', err.message);
  }
  // MAIL_DISABLED=true: paksa email mati (dipakai saat mengisi data demo agar tidak ada email terkirim)
  if (String(process.env.MAIL_DISABLED || '').toLowerCase() === 'true') cfg = { ...cfg, host: '' };
  config = cfg;
  transporter = cfg.host
    ? nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined
      })
    : null;
  return cfg;
}

// Email aktif bila ada host SMTP (dari pengaturan Admin atau .env)
export const mailEnabled = () => Boolean(transporter);

// Uji koneksi & login SMTP tanpa mengirim email
export async function verifyMail() {
  if (!transporter) throw new Error('Host SMTP belum diisi.');
  await transporter.verify();
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Bungkus isi email dengan kop sederhana IKAPI Jabar. `lines` berisi paragraf teks biasa.
// `code` (opsional) ditampilkan besar di tengah, misalnya kode atur ulang kata sandi.
function layout(title, lines, action, code = null) {
  const paragraphs = lines.filter(Boolean).map((l) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`).join('');
  const codeBlock = code
    ? `<p style="margin:16px 0 20px;text-align:center"><span style="display:inline-block;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;padding:12px 22px;font:700 28px/1 'Courier New',monospace;letter-spacing:8px;color:#0f172a">${escapeHtml(code)}</span></p>`
    : '';
  const button = action
    ? `<p style="margin:20px 0"><a href="${escapeHtml(action.url)}" style="background:#0da2e7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 12px;font-size:12px;color:#64748b">Jika tombol tidak berfungsi, buka tautan ini: ${escapeHtml(action.url)}</p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;max-width:560px">
    <p style="font-weight:700;color:#0884c4;margin:0 0 4px">IKAPI Pengurus Daerah Jawa Barat</p>
    <h2 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h2>
    ${codeBlock}${paragraphs}${button}
    <p style="margin:24px 0 0;font-size:12px;color:#64748b">Email ini dikirim otomatis oleh Sistem Keanggotaan IKAPI Jawa Barat.</p>
  </div>`;
}

export async function sendMail({ to, subject, title, lines = [], action = null, code = null }) {
  if (!to) return;
  const text = [title, '', ...(code ? [`Kode: ${code}`, ''] : []), ...lines.filter(Boolean), action ? `\n${action.label}: ${action.url}` : ''].join('\n');
  let status = 'skipped';
  let error = null;
  if (transporter) {
    try {
      await transporter.sendMail({ from: config.from, to, subject, text, html: layout(title || subject, lines, action, code) });
      status = 'sent';
    } catch (err) {
      status = 'failed';
      error = err.message;
      console.error(`Gagal kirim email ke ${to}:`, err.message);
    }
  } else {
    console.log(`[email belum aktif, SMTP_HOST kosong] Ke: ${to} | ${subject}${action ? ` | ${action.url}` : ''}`);
  }
  // Tautan berisi token (verifikasi) dan kode rahasia (reset sandi) tidak disimpan di log database.
  let logText = action?.sensitive ? text.replace(action.url, '[tautan rahasia disembunyikan]') : text;
  if (code) logText = logText.split(code).join('[kode rahasia disembunyikan]');
  try {
    await query.run(
      'INSERT INTO email_logs (to_email, subject, body, status, error) VALUES (?, ?, ?, ?, ?)',
      [to, subject, logText, status, error]
    );
  } catch (err) {
    console.error('Gagal mencatat email_logs:', err.message);
  }
}
