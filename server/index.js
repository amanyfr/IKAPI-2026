import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import db, { query, initDb, nowSql } from './db.js';
import { runSeed, formatSuratNumber, toRoman } from './seed.js';
import { sendMail, MAIL_ENABLED, APP_URL } from './mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT secret: pakai env JWT_SECRET. Jika kosong, buat secret acak sekali lalu simpan di
// server/data/.jwt_secret (tidak di-commit) agar token tetap valid setelah server restart.
function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('JWT_SECRET wajib diisi di environment production.');
    process.exit(1);
  }
  const secretFile = path.join(__dirname, 'data', '.jwt_secret');
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing) return existing;
  } catch { /* belum ada, buat baru */ }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  console.warn('JWT_SECRET tidak diset; secret acak dibuat di server/data/.jwt_secret');
  return generated;
}

const JWT_SECRET = loadJwtSecret();
const PORT = process.env.PORT || 5000;
// Login cepat tanpa password hanya untuk demo lokal. Aktifkan dengan ENABLE_DEMO_SWITCH=true.
const DEMO_SWITCH_ENABLED = process.env.ENABLE_DEMO_SWITCH === 'true' && process.env.NODE_ENV !== 'production';

const app = express();

// Frontend disajikan dari origin yang sama (Vite proxy / dist), jadi CORS lintas origin
// dimatikan kecuali CORS_ORIGIN diset (daftar dipisah koma).
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directories
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
// Catatan: /uploads TIDAK lagi disajikan publik. Lihat route GET /uploads/:filename di bawah
// (butuh login + hak akses ke pengajuan pemilik file).

const ALLOWED_UPLOAD_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const ALLOWED_UPLOAD_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_UPLOAD_EXT.includes(ext) && ALLOWED_UPLOAD_MIME.includes(file.mimetype)) {
      return cb(null, true);
    }
    const err = new Error('Format file tidak didukung. Gunakan PDF, PNG, JPG, atau WEBP.');
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  }
});

// Auth Middleware
function readToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return null;
}

// Cookie sesi httpOnly, hanya dipakai untuk membuka file lewat <a>/<img>/<iframe>
// (yang tidak bisa mengirim header). API tetap memakai header Authorization.
const SESSION_COOKIE = 'ikapi_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // detik, sama dengan masa berlaku JWT

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function setSessionCookie(res, token) {
  if (!token) return;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; SameSite=Strict${secure}`);
}

function clearSessionCookie(res) {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`);
}

// JWT membawa token_version (tv). Reset kata sandi, perubahan peran/email/kata sandi oleh Admin,
// atau hapus akun menaikkan token_version sehingga semua token lama langsung tidak berlaku.
function signToken(user, memberId = null) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, memberId, tv: user.token_version || 0 },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Verifikasi JWT lalu cocokkan dengan database. Mengembalikan payload dengan peran terbaru, atau null.
async function verifySession(token) {
  if (!token) return null;
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  const row = await query.get('SELECT id, email, name, role, token_version FROM users WHERE id = ?', [decoded.id]);
  if (!row || (row.token_version || 0) !== (decoded.tv || 0)) return null;
  return { ...decoded, email: row.email, name: row.name, role: row.role };
}

async function authenticate(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Token autentikasi tidak ditemukan.' });
  }
  try {
    const user = await verifySession(token);
    if (!user) return res.status(401).json({ error: 'Sesi login telah kedaluwarsa atau tidak valid.' });
    req.user = user;
    next();
  } catch (err) {
    console.error('Authenticate error:', err);
    return res.status(500).json({ error: 'Gagal memeriksa sesi login.' });
  }
}

async function revokeSessions(userId) {
  await query.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
}

// Pembatas percobaan sederhana di memori (per IP + rute). Cukup untuk satu proses server.
// failuresOnly: hanya respons gagal (status >= 400) yang dihitung, supaya banyak pengguna
// yang berbagi satu IP kantor tetap bisa masuk dengan normal.
function rateLimit({ windowMs, max, message, failuresOnly = false }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = `${req.ip}|${req.path}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    if (entry.count >= max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    if (failuresOnly) {
      res.on('finish', () => { if (res.statusCode >= 400) entry.count += 1; });
    } else {
      entry.count += 1;
    }
    next();
  };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  failuresOnly: true,
  message: 'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.'
});
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi dalam 15 menit.'
});
const authMailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Terlalu banyak permintaan. Coba lagi dalam 15 menit.'
});

const ROLES = ['Admin', 'Sekretaris', 'Ketua', 'Anggota'];

// Data pengguna yang aman dikirim ke browser (tanpa password)
function publicUser(user, member = null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    member_type: user.member_type || null,
    member_category: user.member_category || null,
    old_kta_number: user.old_kta_number || null,
    onboarded_at: user.onboarded_at || null,
    created_at: user.created_at,
    member: member || null
  };
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk tindakan ini.' });
    }
    next();
  };
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password, phone, publisherName, category, legalEntity } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nama, email, dan password wajib diisi.' });
    }

    const existing = await query.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email sudah terdaftar. Silakan gunakan email lain atau login.' });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }

    // Verifikasi email wajib bila SMTP aktif. Tanpa SMTP (pengembangan lokal) akun langsung terverifikasi.
    const verify = MAIL_ENABLED ? newToken() : null;
    const result = await query.run(
      `INSERT INTO users (name, email, password, role, phone, email_verified_at, email_verify_token)
       VALUES (?, ?, ?, 'Anggota', ?, ${verify ? 'NULL' : 'NOW()'}, ?)`,
      [name, email, hashedPassword, phone || null, verify?.hash || null]
    );

    const userId = result.lastID;

    // Create preliminary member record if publisher info given
    let memberId = null;
    if (publisherName) {
      const mRes = await query.run(
        `INSERT INTO members (
          user_id, publisher_name, category, leader_name, leader_phone, legal_entity,
          address, city, phone, email, person_in_charge, membership_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Calon')`,
        [
          userId,
          publisherName,
          category || 'Biasa',
          name,
          phone || '-',
          legalEntity || 'PT',
          '-',
          'Kota Bandung',
          phone || '-',
          email,
          name
        ]
      );
      memberId = mRes.lastID;
    }

    if (verify) {
      await sendVerificationEmail({ name, email }, verify.token);
      return res.json({
        message: `Pendaftaran berhasil. Kami mengirim tautan verifikasi ke ${email}. Buka email tersebut sebelum masuk.`,
        verificationRequired: true
      });
    }

    const token = signToken({ id: userId, email, role: 'Anggota', name, token_version: 0 }, memberId);
    setSessionCookie(res, token);

    res.json({
      message: 'Pendaftaran akun berhasil. Silakan masuk menggunakan email dan kata sandi Anda.',
      verificationRequired: false,
      token,
      user: { id: userId, email, role: 'Anggota', name, memberId }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Gagal melakukan pendaftaran akun.' });
  }
});

// Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    const user = await query.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Email atau password salah.' });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Email atau password salah.' });
    }

    if (MAIL_ENABLED && !user.email_verified_at) {
      return res.status(403).json({
        error: 'Email belum diverifikasi. Buka tautan verifikasi yang kami kirim ke email Anda, atau kirim ulang tautannya.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Check member profile
    const member = await query.get('SELECT * FROM members WHERE user_id = ?', [user.id]);

    const token = signToken(user, member ? member.id : null);
    setSessionCookie(res, token);

    res.json({
      message: 'Login berhasil.',
      token,
      user: publicUser(user, member)
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat login.' });
  }
});

// Current User Me
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await query.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    const member = await query.get('SELECT * FROM members WHERE user_id = ?', [user.id]);
    // Sesi lama (dibuat sebelum ada cookie) ikut mendapat cookie untuk membuka file
    setSessionCookie(res, readToken(req));
    res.json({ user: publicUser(user, member) });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data profil.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'Berhasil keluar.' });
});

// ---------- Verifikasi email & reset kata sandi ----------
// Token mentah hanya dikirim lewat email; database menyimpan hash SHA-256-nya.
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
function newToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}
const RESET_TOKEN_MINUTES = 60;

async function sendVerificationEmail(user, token) {
  await sendMail({
    to: user.email,
    subject: 'Verifikasi email akun IKAPI Jawa Barat',
    title: 'Verifikasi email Anda',
    lines: [
      `Halo ${user.name},`,
      'Terima kasih telah mendaftar di Sistem Keanggotaan IKAPI Jawa Barat. Klik tombol di bawah untuk memverifikasi email Anda.'
    ],
    action: { label: 'Verifikasi email', url: `${APP_URL}/?verify=${token}`, sensitive: true }
  });
}

app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token verifikasi tidak ada.' });
    const user = await query.get('SELECT id, email_verified_at FROM users WHERE email_verify_token = ?', [hashToken(token)]);
    if (!user) {
      return res.status(400).json({ error: 'Tautan verifikasi tidak valid atau sudah dipakai.' });
    }
    await query.run(
      'UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), email_verify_token = NULL WHERE id = ?',
      [user.id]
    );
    res.json({ message: 'Email berhasil diverifikasi. Silakan masuk.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi email.' });
  }
});

// Jawaban selalu sama agar tidak membocorkan email mana yang terdaftar
app.post('/api/auth/resend-verification', authMailLimiter, async (req, res) => {
  const message = 'Jika email terdaftar dan belum diverifikasi, tautan verifikasi baru telah dikirim.';
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email wajib diisi.' });
    const user = await query.get('SELECT id, name, email, email_verified_at FROM users WHERE email = ?', [email]);
    if (user && !user.email_verified_at && MAIL_ENABLED) {
      const verify = newToken();
      await query.run('UPDATE users SET email_verify_token = ? WHERE id = ?', [verify.hash, user.id]);
      await sendVerificationEmail(user, verify.token);
    }
    res.json({ message });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Gagal mengirim ulang verifikasi.' });
  }
});

app.post('/api/auth/forgot-password', authMailLimiter, async (req, res) => {
  // Tanpa SMTP, permintaan diteruskan ke Admin lewat notifikasi; Admin mengatur sandi baru di Kelola Akun.
  const message = MAIL_ENABLED
    ? 'Jika email terdaftar, tautan untuk mengatur ulang kata sandi telah dikirim. Tautan berlaku 60 menit.'
    : 'Jika email terdaftar, permintaan Anda sudah diteruskan ke Admin sekretariat. Admin akan mengatur kata sandi baru dan menghubungi Anda.';
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email wajib diisi.' });
    const user = await query.get('SELECT id, name, email, phone FROM users WHERE email = ?', [email]);
    if (user && !MAIL_ENABLED) {
      const title = 'Permintaan reset kata sandi';
      const body = `${user.name} (${user.email}${user.phone ? `, ${user.phone}` : ''}) lupa kata sandi. Atur kata sandi baru di Kelola Akun, lalu sampaikan ke yang bersangkutan.`;
      // Satu permintaan yang belum dibaca per akun sudah cukup; cegah lonceng Admin dibanjiri
      const pending = await query.get(
        "SELECT n.id FROM notifications n JOIN users a ON a.id = n.user_id WHERE a.role = 'Admin' AND n.title = ? AND n.body = ? AND n.read_at IS NULL LIMIT 1",
        [title, body]
      );
      if (!pending) await addNotification({ role: 'Admin' }, title, body);
    } else if (user) {
      const reset = newToken();
      await query.run(
        `UPDATE users SET password_reset_token = ?, password_reset_expires = DATE_ADD(NOW(), INTERVAL ${RESET_TOKEN_MINUTES} MINUTE) WHERE id = ?`,
        [reset.hash, user.id]
      );
      await sendMail({
        to: user.email,
        subject: 'Atur ulang kata sandi akun IKAPI Jawa Barat',
        title: 'Atur ulang kata sandi',
        lines: [
          `Halo ${user.name},`,
          `Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda. Tautan berlaku ${RESET_TOKEN_MINUTES} menit.`,
          'Abaikan email ini jika Anda tidak memintanya; kata sandi Anda tidak berubah.'
        ],
        action: { label: 'Atur ulang kata sandi', url: `${APP_URL}/?reset=${reset.token}`, sensitive: true }
      });
    }
    res.json({ message, mailEnabled: MAIL_ENABLED });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Gagal memproses permintaan reset kata sandi.' });
  }
});

app.post('/api/auth/reset-password', loginLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) return res.status(400).json({ error: 'Token reset tidak ada.' });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }
    const user = await query.get(
      'SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
      [hashToken(token)]
    );
    if (!user) {
      return res.status(400).json({ error: 'Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.' });
    }
    const hashed = await bcryptjs.hash(password, await bcryptjs.genSalt(10));
    // Membuka tautan dari email sekaligus membuktikan kepemilikan email
    await query.run(
      `UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL,
         email_verified_at = COALESCE(email_verified_at, NOW()), email_verify_token = NULL,
         token_version = token_version + 1
       WHERE id = ?`,
      [hashed, user.id]
    );
    res.json({ message: 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Gagal mengatur ulang kata sandi.' });
  }
});

// Quick Switch (Demo Tool for Evaluator to easily test all 3 roles)
app.post('/api/auth/quick-switch', async (req, res) => {
  if (!DEMO_SWITCH_ENABLED) {
    return res.status(404).json({ error: 'Fitur ganti akun demo tidak aktif.' });
  }
  try {
    const { role, email } = req.body;
    let user;
    if (email) {
      user = await query.get('SELECT * FROM users WHERE email = ?', [email]);
    } else if (role) {
      user = await query.get('SELECT * FROM users WHERE role = ? LIMIT 1', [role]);
    }

    if (!user) {
      return res.status(404).json({ error: 'Akun switch tidak ditemukan.' });
    }

    const member = await query.get('SELECT * FROM members WHERE user_id = ?', [user.id]);
    const token = signToken(user, member ? member.id : null);
    setSessionCookie(res, token);

    res.json({
      message: `Beralih ke peran ${user.role} (${user.name})`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        member: member || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal beralih akun demo.' });
  }
});

// Pertanyaan login pertama anggota: anggota lama/baru & kategori biasa/luar biasa
app.put('/api/auth/onboarding', authenticate, authorize('Anggota'), async (req, res) => {
  try {
    const { memberType, category, oldKtaNumber } = req.body;
    if (!['Lama', 'Baru'].includes(memberType)) {
      return res.status(400).json({ error: 'Pilih status keanggotaan: anggota lama atau anggota baru.' });
    }
    if (!['Biasa', 'Luar Biasa'].includes(category)) {
      return res.status(400).json({ error: 'Pilih kategori keanggotaan: biasa atau luar biasa.' });
    }
    const kta = memberType === 'Lama' && oldKtaNumber ? String(oldKtaNumber).trim() : null;

    // Jawaban profil masih bisa diubah selama belum ada pengajuan (jenis pengajuan mengikuti profil)
    const existing = await query.get('SELECT id FROM submissions WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (existing) {
      return res.status(400).json({ error: 'Profil keanggotaan tidak dapat diubah karena pengajuan sudah dibuat.' });
    }

    await query.run(
      `UPDATE users SET member_type = ?, member_category = ?, old_kta_number = ?,
         onboarded_at = NOW()
       WHERE id = ?`,
      [memberType, category, kta, req.user.id]
    );
    await query.run(
      `UPDATE members SET category = ?, updated_at = NOW()
       WHERE user_id = ? AND membership_status = 'Calon'`,
      [category, req.user.id]
    );

    const user = await query.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const member = await query.get('SELECT * FROM members WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Profil keanggotaan tersimpan.', user: publicUser(user, member) });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Gagal menyimpan profil keanggotaan.' });
  }
});

// Tanda tangan tersimpan milik Ketua & Sekretaris (masing-masing akun): dibuat sekali,
// dipakai berulang saat membubuhkan TTD pada surat pengantar
const SIGNATURE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const SIGNATURE_MAX_LENGTH = 1.5 * 1024 * 1024;

app.get('/api/auth/signature', authenticate, authorize('Ketua', 'Sekretaris'), async (req, res) => {
  try {
    const row = await query.get('SELECT signature_img FROM users WHERE id = ?', [req.user.id]);
    res.json({ signature: row?.signature_img || null });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat tanda tangan.' });
  }
});

app.put('/api/auth/signature', authenticate, authorize('Ketua', 'Sekretaris'), async (req, res) => {
  try {
    const { signature } = req.body;
    if (typeof signature !== 'string' || !SIGNATURE_PATTERN.test(signature)) {
      return res.status(400).json({ error: 'Format tanda tangan tidak valid (PNG/JPG).' });
    }
    if (signature.length > SIGNATURE_MAX_LENGTH) {
      return res.status(400).json({ error: 'Ukuran gambar tanda tangan terlalu besar (maks. ±1 MB).' });
    }
    await query.run('UPDATE users SET signature_img = ? WHERE id = ?', [signature, req.user.id]);
    res.json({ message: 'Tanda tangan tersimpan dan siap dipakai.', signature });
  } catch (err) {
    console.error('Save signature error:', err);
    res.status(500).json({ error: 'Gagal menyimpan tanda tangan.' });
  }
});

// ==========================================
// BIAYA KEANGGOTAAN (diatur Admin di Pengaturan)
// ==========================================
const FEE_KEYS = ['fee_uang_pangkal', 'fee_iuran_bulanan', 'fee_iuran_durasi_bulan', 'fee_administrasi', 'fee_heregistrasi_iuran'];

// Rincian tagihan dari pengaturan biaya terbaru
async function computeFees(submissionType) {
  const rows = await query.all(`SELECT settings.key, settings.value FROM settings WHERE settings.key LIKE 'fee_%'`);
  const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
  const fee = (key, fallback) => (Number.isFinite(map[key]) && map[key] >= 0 ? map[key] : fallback);
  const durasiBulan = fee('fee_iuran_durasi_bulan', 24);

  if (submissionType === 'Baru') {
    const uangPangkal = fee('fee_uang_pangkal', 250000);
    const iuran = fee('fee_iuran_bulanan', 50000) * durasiBulan;
    const administrasi = fee('fee_administrasi', 250000);
    return {
      uangPangkal, iuran24Bulan: iuran, administrasi, durasiBulan,
      total: uangPangkal + iuran + administrasi,
      keterangan: `Pendaftaran Anggota Baru IKAPI (Uang Pangkal + Iuran ${durasiBulan} Bulan + Administrasi)`
    };
  }
  const iuran = fee('fee_heregistrasi_iuran', 1200000);
  return {
    uangPangkal: 0, iuran24Bulan: iuran, administrasi: 0, durasiBulan,
    total: iuran,
    keterangan: `Registrasi (Perpanjangan) Anggota IKAPI (Iuran ${durasiBulan} Bulan)`
  };
}

// Tagihan yang belum dibayar (bukti transfer belum diunggah) ikut harga terbaru;
// tagihan yang sudah dibayar tetap memakai harga saat dibayar.
// Data lama berstatus 'Disetujui' (alur versi awal) dianggap sudah aktif.
// 'Dikirim ke Pusat' kini tahap resmi (menunggu No. KTA) sehingga tidak diubah.
async function activateApprovedSubmissions() {
  const rows = await query.all(`SELECT id, member_id FROM submissions WHERE status = 'Disetujui'`);
  for (const row of rows) {
    await query.run(
      `UPDATE submissions SET status = 'Aktif', activated_at = COALESCE(activated_at, approved_at, NOW()),
       updated_at = NOW() WHERE id = ?`,
      [row.id]
    );
    await query.run(`UPDATE members SET membership_status = 'Aktif', updated_at = NOW() WHERE id = ?`, [row.member_id]);
  }
  return rows.length;
}

// Penjelasan status untuk email ke pemohon
const STATUS_EMAIL_TEXT = {
  'Menunggu Verifikasi': 'Pengajuan Anda sudah kami terima dan dokumen sedang diperiksa Admin.',
  'Perlu Revisi': 'Ada dokumen yang perlu diperbaiki. Masuk ke sistem untuk melihat catatan dan mengunggah ulang dokumen yang ditandai. Anda tidak perlu membayar ulang.',
  'Menunggu Pembayaran': 'Dokumen Anda sudah sesuai. Silakan lakukan pembayaran sesuai tagihan dan unggah bukti transfer di sistem.',
  'Menunggu TTD Sekretaris': 'Pembayaran Anda sudah diverifikasi. Pengajuan sedang menunggu tanda tangan Sekretaris.',
  'Menunggu Approval': 'Pengajuan Anda sedang menunggu persetujuan dan tanda tangan Ketua.',
  'Pengiriman Berkas': 'Pengajuan Anda disetujui Sekretaris dan Ketua. Silakan cetak sendiri berkas yang diminta lalu kirim ke sekretariat IKAPI Jawa Barat, kemudian tandai "sudah dikirim" di sistem.',
  'Berkas Diterima': 'Berkas fisik Anda sudah diterima sekretariat IKAPI Jawa Barat dan sedang disiapkan untuk dikirim ke IKAPI Pusat.',
  'Disetujui': 'Pengajuan Anda telah disetujui.',
  'Dikirim ke Pusat': 'Berkas Anda telah dikirim ke IKAPI Pusat dan sedang menunggu penerbitan Nomor KTA.',
  'Aktif': 'Selamat, Nomor KTA dari IKAPI Pusat sudah terbit dan keanggotaan Anda di IKAPI Jawa Barat sudah aktif.',
  'Ditolak': 'Mohon maaf, pengajuan Anda ditolak.'
};

// Notifikasi dalam aplikasi (lonceng). `to` = id user, atau { role: 'Admin' } untuk semua akun peran itu.
async function addNotification(to, title, body = null, submissionId = null) {
  try {
    const ids = typeof to === 'object'
      ? (await query.all('SELECT id FROM users WHERE role = ?', [to.role])).map((r) => r.id)
      : [to];
    for (const id of ids) {
      await query.run(
        'INSERT INTO notifications (user_id, title, body, submission_id) VALUES (?, ?, ?, ?)',
        [id, title, body, submissionId]
      );
    }
  } catch (err) {
    console.error('Gagal membuat notifikasi:', err.message);
  }
}

app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const items = await query.all(
      'SELECT id, title, body, submission_id, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30',
      [req.user.id]
    );
    const row = await query.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
    res.json({ items, unread: Number(row?.n || 0) });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Gagal mengambil notifikasi.' });
  }
});

// Tandai dibaca: body { id } untuk satu notifikasi, tanpa id untuk semua
app.post('/api/notifications/read', authenticate, async (req, res) => {
  try {
    const id = Number(req.body?.id);
    if (id) {
      await query.run('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL', [id, req.user.id]);
    } else {
      await query.run('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Read notifications error:', err);
    res.status(500).json({ error: 'Gagal memperbarui notifikasi.' });
  }
});

// Kirim email bila status pengajuan berubah sejak notifikasi terakhir:
// ke pemohon untuk setiap status baru, dan ke Admin saat ada pengajuan baru masuk.
async function notifyStatusChange(submissionId) {
  const sub = await query.get(
    `SELECT s.id, s.status, s.last_notified_status, s.submission_type, s.admin_notes, s.rejection_reason,
            s.reference_number, s.user_id, u.name AS applicant_name, u.email AS applicant_email,
            m.publisher_name, m.kta_number
     FROM submissions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN members m ON m.id = s.member_id
     WHERE s.id = ?`,
    [submissionId]
  );
  if (!sub || sub.status === sub.last_notified_status) return;

  // Tandai dulu agar dua aksi beruntun tidak mengirim email ganda untuk status yang sama
  const claimed = await query.run(
    'UPDATE submissions SET last_notified_status = ? WHERE id = ? AND (last_notified_status IS NULL OR last_notified_status <> ?)',
    [sub.status, sub.id, sub.status]
  );
  if (!claimed.changes || sub.status === 'Draf') return;

  const publisher = sub.publisher_name || sub.applicant_name;
  const extra = [];
  if (sub.status === 'Perlu Revisi' && sub.admin_notes) extra.push(`Catatan Admin: ${sub.admin_notes}`);
  if (sub.status === 'Ditolak' && sub.rejection_reason) extra.push(`Alasan: ${sub.rejection_reason}`);
  if (sub.status === 'Aktif' && sub.kta_number) extra.push(`Nomor KTA: ${sub.kta_number}`);
  if (sub.reference_number && ['Menunggu Approval', 'Pengiriman Berkas', 'Berkas Diterima', 'Dikirim ke Pusat', 'Aktif'].includes(sub.status)) {
    extra.push(`Nomor surat: ${sub.reference_number}`);
  }

  // Notifikasi dalam aplikasi: pemohon untuk setiap status, pengurus saat giliran mereka bertindak
  await addNotification(sub.user_id, `Status pengajuan: ${sub.status}`, [STATUS_EMAIL_TEXT[sub.status], ...extra].filter(Boolean).join('\n'), sub.id);
  const label = `${sub.submission_type === 'Heregistrasi' ? 'Heregistrasi' : 'Anggota baru'} ${publisher} (#${sub.id})`;
  const staffTask = {
    'Menunggu Verifikasi': ['Admin', sub.last_notified_status === 'Perlu Revisi' ? 'Revisi dokumen masuk' : 'Pengajuan baru masuk', `${label} menunggu screening dokumen.`],
    'Menunggu TTD Sekretaris': ['Sekretaris', 'Menunggu tanda tangan Sekretaris', `${label} sudah lunas dan menunggu TTD Anda.`],
    'Menunggu Approval': ['Ketua', 'Menunggu persetujuan Ketua', `${label} menunggu persetujuan dan TTD Anda.`],
    'Dikirim ke Pusat': ['Sekretaris', 'Menunggu No. KTA dari Pusat', `${label} sudah dikirim ke IKAPI Pusat. Input No. KTA setelah terbit.`]
  }[sub.status];
  if (staffTask) await addNotification({ role: staffTask[0] }, staffTask[1], staffTask[2], sub.id);

  await sendMail({
    to: sub.applicant_email,
    subject: `Status pengajuan IKAPI Jabar: ${sub.status}`,
    title: `Status pengajuan: ${sub.status}`,
    lines: [
      `Halo ${sub.applicant_name},`,
      `Pengajuan ${sub.submission_type === 'Heregistrasi' ? 'heregistrasi' : 'anggota baru'} ${publisher} (#${sub.id}) kini berstatus "${sub.status}".`,
      STATUS_EMAIL_TEXT[sub.status],
      ...extra
    ],
    action: { label: 'Lihat pengajuan', url: APP_URL }
  });

  if (sub.status === 'Menunggu Verifikasi' && (!sub.last_notified_status || sub.last_notified_status === 'Draf')) {
    const admins = await query.all("SELECT email FROM users WHERE role = 'Admin'");
    for (const admin of admins) {
      await sendMail({
        to: admin.email,
        subject: `Pengajuan baru: ${publisher}`,
        title: 'Pengajuan baru masuk',
        lines: [
          `Pengajuan ${sub.submission_type === 'Heregistrasi' ? 'heregistrasi' : 'anggota baru'} dari ${publisher} (#${sub.id}) menunggu screening dokumen.`
        ],
        action: { label: 'Buka sistem', url: APP_URL }
      });
    }
  }
}

// Riwayat alur berkas (terlihat oleh semua peran)
async function logEvent(submissionId, user, action, notes = null) {
  try {
    await query.run(
      `INSERT INTO submission_logs (submission_id, actor_id, actor_name, actor_role, action, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [submissionId, user?.id || null, user?.name || 'Sistem', user?.role || 'Sistem', action, notes]
    );
  } catch (err) {
    console.error('Log event error:', err);
  }
  // Setiap aksi pada pengajuan dicatat lewat logEvent, jadi di sini juga dicek perubahan status
  // untuk notifikasi email. Dijalankan di latar agar respons API tidak menunggu SMTP.
  notifyStatusChange(submissionId).catch((err) => console.error('Notifikasi status gagal:', err));
}

// Riwayat untuk pengajuan lama yang dibuat sebelum ada log
function legacyTimeline(sub) {
  const items = [];
  const push = (at, actor_role, action, actor_name = null) => at && items.push({ created_at: at, actor_role, actor_name, action, legacy: true });
  push(sub.submitted_at, 'Anggota', 'Pengajuan dikirim', sub.applicant_name);
  push(sub.screened_at, 'Admin', 'Dokumen lolos screening', sub.screened_by_name);
  push(sub.secretary_signature_date, 'Sekretaris', 'Ditandatangani Sekretaris', sub.signed_by_secretary);
  push(sub.chairman_signature_date, 'Ketua', 'Disetujui & ditandatangani Ketua', sub.signed_by_chairman);
  push(sub.physical_sent_at, 'Anggota', 'Berkas fisik dikirim', sub.applicant_name);
  push(sub.activated_at, 'Admin', 'Resmi menjadi anggota IKAPI Jawa Barat', sub.physical_received_by);
  return items;
}

// Sekali jalan: sesuaikan data lama ke alur baru (dokumen dulu, baru pembayaran)
async function migrateFlowV2() {
  const done = await query.get(`SELECT value FROM settings WHERE settings.key = 'flow_version'`);
  if (done && Number(done.value) >= 2) return;
  // Dulu: submit -> bayar. Sekarang dokumen harus lolos screening dulu.
  await query.run(
    `UPDATE submissions SET status = 'Menunggu Verifikasi' WHERE status = 'Menunggu Pembayaran'
       AND EXISTS (SELECT 1 FROM documents d WHERE d.submission_id = submissions.id AND d.screening_status != 'Sesuai')`
  );
  // Sudah lolos screening dokumen & pembayaran -> tinggal TTD Sekretaris
  await query.run(
    `UPDATE submissions SET status = 'Menunggu TTD Sekretaris' WHERE status = 'Menunggu Verifikasi' AND screened_at IS NOT NULL
       AND EXISTS (SELECT 1 FROM payments p WHERE p.submission_id = submissions.id AND p.verification_status = 'Valid')`
  );
  // Sudah lolos screening dokumen, pembayaran belum valid -> tahap pembayaran
  await query.run(
    `UPDATE submissions SET status = 'Menunggu Pembayaran' WHERE status = 'Menunggu Verifikasi' AND screened_at IS NOT NULL`
  );
  await query.run(`UPDATE submissions SET physical_status = 'Diterima' WHERE status = 'Aktif' AND physical_status IS NULL`);
  await query.run(
    `INSERT INTO settings (settings.key, value, description) VALUES ('flow_version', '2', 'Versi alur pengajuan')
     ON DUPLICATE KEY UPDATE value = '2'`
  );
}

async function syncUnpaidBills() {
  const unpaid = await query.all(
    `SELECT p.id, s.submission_type FROM payments p
     JOIN submissions s ON s.id = p.submission_id
     WHERE (p.proof_file IS NULL OR p.proof_file = '') AND p.verification_status != 'Valid'`
  );
  const feesByType = {};
  for (const bill of unpaid) {
    feesByType[bill.submission_type] ||= await computeFees(bill.submission_type);
    const fees = feesByType[bill.submission_type];
    await query.run(
      `UPDATE payments SET amount = ?, fee_breakdown = ?, updated_at = NOW() WHERE id = ?`,
      [fees.total, JSON.stringify(fees), bill.id]
    );
  }
  return unpaid.length;
}

// Dokumen yang ditandatangani Ketua & Sekretaris sekaligus (lihat SIGNABLE_DOCS di frontend)
const SIGNABLE_DOC_KEYS = ['surat', 'formulir', 'berita_acara', 'sk'];

// Posisi TTD {x, y, w} relatif (0–1) terhadap area tanda tangan dokumen; null bila tidak valid
function parseSignaturePos(pos) {
  const inUnit = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  if (!pos || !inUnit(pos.x) || !inUnit(pos.y) || !inUnit(pos.w) || pos.w < 0.08) return null;
  return { x: pos.x, y: pos.y, w: pos.w };
}

// Posisi TTD untuk setiap dokumen yang ditandatangani; null bila ada yang hilang / tidak valid
function parseSignaturePositions(positions) {
  if (!positions || typeof positions !== 'object') return null;
  const parsed = {};
  for (const key of SIGNABLE_DOC_KEYS) {
    parsed[key] = parseSignaturePos(positions[key]);
    if (!parsed[key]) return null;
  }
  return parsed;
}

// Gabungkan posisi milik satu penandatangan ke JSON { dokumen: { chairman, secretary } }
function mergeSignaturePositions(existingJson, role, positions) {
  let current = {};
  try {
    current = JSON.parse(existingJson || '{}') || {};
  } catch {
    current = {};
  }
  for (const [key, pos] of Object.entries(positions)) {
    current[key] = { ...(current[key] || {}), [role]: pos };
  }
  return JSON.stringify(current);
}

app.delete('/api/auth/signature', authenticate, authorize('Ketua', 'Sekretaris'), async (req, res) => {
  try {
    await query.run('UPDATE users SET signature_img = NULL WHERE id = ?', [req.user.id]);
    res.json({ message: 'Tanda tangan dihapus.' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus tanda tangan.' });
  }
});

// ==========================================
// 1b. KELOLA AKUN PENGGUNA (ADMIN)
// ==========================================

app.get('/api/admin/users', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const users = await query.all('SELECT * FROM users ORDER BY role, name');
    res.json({ users: users.map((u) => publicUser(u)) });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar akun.' });
  }
});

app.post('/api/admin/users', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Nama, email, kata sandi, dan peran wajib diisi.' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'Peran tidak valid.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }
    const existing = await query.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email sudah dipakai akun lain.' });
    }
    const hashed = await bcryptjs.hash(password, await bcryptjs.genSalt(10));
    const result = await query.run(
      `INSERT INTO users (name, email, password, role, phone, email_verified_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [name, email, hashed, role, phone || null]
    );
    const user = await query.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    res.json({ message: `Akun ${user.name} berhasil dibuat.`, user: publicUser(user) });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Gagal membuat akun.' });
  }
});

app.put('/api/admin/users/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const target = await query.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!target) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const { name, email, role, phone, password } = req.body;
    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ error: 'Peran tidak valid.' });
    }
    // Cegah Admin mengunci dirinya sendiri dari halaman kelola akun
    if (id === req.user.id && role && role !== 'Admin') {
      return res.status(400).json({ error: 'Anda tidak bisa mengubah peran akun Anda sendiri.' });
    }
    if (email && email !== target.email) {
      const dup = await query.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (dup) return res.status(400).json({ error: 'Email sudah dipakai akun lain.' });
    }
    if (password && String(password).length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }

    await query.run(
      'UPDATE users SET name = ?, email = ?, role = ?, phone = ? WHERE id = ?',
      [name || target.name, email || target.email, role || target.role, phone ?? target.phone, id]
    );
    if (password) {
      const hashed = await bcryptjs.hash(password, await bcryptjs.genSalt(10));
      await query.run('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
    }
    // Kata sandi, peran, atau email diganti: token lama akun itu tidak berlaku lagi
    if (password || (role && role !== target.role) || (email && email !== target.email)) {
      await revokeSessions(id);
    }
    const user = await query.get('SELECT * FROM users WHERE id = ?', [id]);
    res.json({ message: `Akun ${user.name} berhasil diperbarui.`, user: publicUser(user) });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Gagal memperbarui akun.' });
  }
});

// Hapus akun. Akun yang sudah punya pengajuan tidak bisa dihapus (riwayat & berkas harus tetap ada).
app.delete('/api/admin/users/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const target = await query.get('SELECT id, name, role FROM users WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Anda tidak bisa menghapus akun Anda sendiri.' });
    }
    if (target.role === 'Admin') {
      const admins = await query.get("SELECT COUNT(*) AS c FROM users WHERE role = 'Admin'");
      if (admins.c <= 1) return res.status(400).json({ error: 'Minimal harus ada satu akun Admin.' });
    }
    const subs = await query.get('SELECT COUNT(*) AS c FROM submissions WHERE user_id = ?', [id]);
    if (subs.c > 0) {
      return res.status(400).json({
        error: `Akun ${target.name} memiliki ${subs.c} pengajuan sehingga tidak dapat dihapus. Data anggota bisa dinonaktifkan dari menu Data Anggota.`
      });
    }
    await query.run("DELETE FROM members WHERE user_id = ? AND membership_status = 'Calon'", [id]);
    await query.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: `Akun ${target.name} berhasil dihapus.` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Gagal menghapus akun.' });
  }
});

// ==========================================
// 2. SUBMISSIONS ROUTES
// ==========================================

// List submissions
app.get('/api/submissions', authenticate, async (req, res) => {
  try {
    const { status, type, category, search } = req.query;
    let sql = `
      SELECT s.*, 
             m.publisher_name, m.category as member_category, m.leader_name, m.city, m.kta_number as member_kta,
             u.name as applicant_name, u.email as applicant_email,
             p.amount as payment_amount, p.verification_status as payment_status, p.proof_file as payment_proof
      FROM submissions s
      LEFT JOIN members m ON s.member_id = m.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN payments p ON s.id = p.submission_id
      WHERE 1=1
    `;
    const params = [];

    // Anggota can only view their own submissions
    if (req.user.role === 'Anggota') {
      sql += ' AND s.user_id = ?';
      params.push(req.user.id);
    }

    if (status && status !== 'Semua') {
      sql += ' AND s.status = ?';
      params.push(status);
    }

    if (type && type !== 'Semua') {
      sql += ' AND s.submission_type = ?';
      params.push(type);
    }

    if (category && category !== 'Semua') {
      sql += ' AND m.category = ?';
      params.push(category);
    }

    if (search) {
      sql += ' AND (m.publisher_name LIKE ? OR u.name LIKE ? OR s.reference_number LIKE ? OR m.city LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY s.updated_at DESC, s.id DESC';

    const submissions = await query.all(sql, params);
    res.json({ submissions });
  } catch (err) {
    console.error('List submissions error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar pengajuan.' });
  }
});

// Get submission detail
app.get('/api/submissions/:id', authenticate, async (req, res) => {
  try {
    const subId = req.params.id;
    const sub = await query.get(
      `SELECT s.*, 
              m.publisher_name, m.category as member_category, m.leader_name, m.leader_title,
              m.leader_phone, m.legal_entity, m.nib, m.npwp, m.address, m.city, m.postal_code,
              m.phone as publisher_phone, m.fax, m.email as publisher_email, m.website,
              m.person_in_charge, m.bnsp_certificate_no, m.specialization, m.kta_number as member_kta,
              u.name as applicant_name, u.email as applicant_email, u.phone as applicant_phone
       FROM submissions s
       LEFT JOIN members m ON s.member_id = m.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [subId]
    );

    if (!sub) {
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    // Check ownership if Anggota
    if (req.user.role === 'Anggota' && sub.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Anda tidak berhak melihat data pengajuan ini.' });
    }

    // Documents
    const documents = await query.all(
      `SELECT d.*, u.name AS verified_by_name FROM documents d
       LEFT JOIN users u ON u.id = d.verified_by
       WHERE d.submission_id = ? ORDER BY d.id ASC`,
      [subId]
    );

    // Payment
    const payment = await query.get(
      `SELECT p.*, u.name AS verified_by_name FROM payments p
       LEFT JOIN users u ON u.id = p.verified_by
       WHERE p.submission_id = ?`,
      [subId]
    );

    // Settings (for letter preview)
    const settingsList = await query.all('SELECT settings.key, settings.value FROM settings');
    const settings = {};
    settingsList.forEach(item => { settings[item.key] = item.value; });

    const logs = await query.all(
      'SELECT id, actor_name, actor_role, action, notes, created_at FROM submission_logs WHERE submission_id = ? ORDER BY created_at ASC, id ASC',
      [subId]
    );
    // Pengajuan lama tanpa log: susun dari tanggal-tanggal yang tercatat
    const timeline = logs.length ? logs : legacyTimeline(sub);

    res.json({
      submission: sub,
      documents,
      payment: payment ? { ...payment, fee_breakdown: JSON.parse(payment.fee_breakdown || '{}') } : null,
      settings,
      timeline
    });
  } catch (err) {
    console.error('Get submission detail error:', err);
    res.status(500).json({ error: 'Gagal memuat detail pengajuan.' });
  }
});

// Create or save submission
// Jenis pengajuan mengikuti jawaban profil anggota: lama -> Heregistrasi, baru -> Baru
async function profileSubmissionType(userId) {
  const u = await query.get('SELECT member_type FROM users WHERE id = ?', [userId]);
  if (!u || !u.member_type) return null;
  return u.member_type === 'Lama' ? 'Heregistrasi' : 'Baru';
}

const TYPE_LABEL = { Baru: 'Anggota Baru', Heregistrasi: 'Registrasi (perpanjangan)' };

app.post('/api/submissions', authenticate, async (req, res) => {
  try {
    const {
      isDraft,
      submissionType,
      category,
      oldKtaNumber,
      // Form fields
      publisherName,
      legalEntity,
      nib,
      npwp,
      establishmentDate,
      address,
      city,
      postalCode,
      phone,
      fax,
      email,
      website,
      leaderName,
      leaderTitle,
      leaderNik,
      leaderPhone,
      leaderEmail,
      personInCharge,
      bnspCertificateNo,
      personInChargePhone,
      specialization,
      annualBookCount,
      isbnCount
    } = req.body;

    if (!publisherName || !category || !submissionType) {
      return res.status(400).json({ error: 'Nama penerbit, kategori, dan jenis pengajuan wajib diisi.' });
    }

    if (req.user.role === 'Anggota') {
      // Satu akun anggota hanya untuk satu pengajuan
      const existing = await query.get('SELECT id FROM submissions WHERE user_id = ? LIMIT 1', [req.user.id]);
      if (existing) {
        return res.status(400).json({ error: `Akun ini sudah memiliki pengajuan (#${existing.id}). Satu akun hanya untuk satu pengajuan.` });
      }
      const expectedType = await profileSubmissionType(req.user.id);
      if (expectedType && submissionType !== expectedType) {
        return res.status(400).json({ error: `Jenis pengajuan untuk akun ini adalah ${TYPE_LABEL[expectedType]}, sesuai profil keanggotaan.` });
      }
    }

    // Upsert or create member record
    let member = await query.get('SELECT * FROM members WHERE user_id = ?', [req.user.id]);
    let memberId;

    if (member) {
      memberId = member.id;
      await query.run(
        `UPDATE members SET
          publisher_name = ?, category = ?, leader_name = ?, leader_title = ?, leader_phone = ?,
          legal_entity = ?, nib = ?, npwp = ?, address = ?, city = ?, postal_code = ?,
          phone = ?, fax = ?, email = ?, website = ?, person_in_charge = ?, bnsp_certificate_no = ?,
          specialization = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          publisherName, category, leaderName || member.leader_name, leaderTitle || member.leader_title,
          leaderPhone || member.leader_phone, legalEntity || member.legal_entity, nib || member.nib,
          npwp || member.npwp, address || member.address, city || member.city, postalCode || member.postal_code,
          phone || member.phone, fax || member.fax, email || member.email, website || member.website,
          personInCharge || member.person_in_charge, bnspCertificateNo || member.bnsp_certificate_no,
          Array.isArray(specialization) ? specialization.join(', ') : specialization || member.specialization,
          memberId
        ]
      );
    } else {
      const mRes = await query.run(
        `INSERT INTO members (
          user_id, publisher_name, category, leader_name, leader_title, leader_phone,
          legal_entity, nib, npwp, address, city, postal_code, phone, fax, email, website,
          person_in_charge, bnsp_certificate_no, specialization, membership_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Calon')`,
        [
          req.user.id, publisherName, category, leaderName || req.user.name, leaderTitle || 'Pimpinan',
          leaderPhone || req.user.phone || '-', legalEntity || 'PT', nib || '-', npwp || '-',
          address || '-', city || 'Kota Bandung', postalCode || '-', phone || '-', fax || '-',
          email || req.user.email, website || '-', personInCharge || req.user.name,
          bnspCertificateNo || '-', Array.isArray(specialization) ? specialization.join(', ') : specialization || '-'
        ]
      );
      memberId = mRes.lastID;
    }

    const formData = JSON.stringify(req.body);
    const initialStatus = isDraft ? 'Draf' : 'Menunggu Verifikasi';
    const submittedAt = isDraft ? null : nowSql();

    const subRes = await query.run(
      `INSERT INTO submissions (
        member_id, user_id, submission_type, status, old_kta_number, form_data, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [memberId, req.user.id, submissionType, initialStatus, oldKtaNumber || null, formData, submittedAt]
    );

    const submissionId = subRes.lastID;

    // Create required document slots based on category & type (PRD Section 5)
    const requiredDocs = [];
    if (submissionType === 'Heregistrasi') {
      requiredDocs.push(
        { type: 'kta_lama', title: 'Kartu Anggota Ikapi yang Sudah Habis Masa Berlakunya' },
        { type: 'formulir_heregistrasi', title: 'Isian Formulir Heregistrasi' }
      );
    } else if (category === 'Biasa') {
      requiredDocs.push(
        { type: 'akta_pendirian', title: 'Akta Notaris / Pendirian Perusahaan' },
        { type: 'nib', title: 'Nomor Induk Berusaha (NIB)' },
        { type: 'formulir_pendaftaran', title: 'Formulir Pendaftaran IKAPI 2026' },
        { type: 'sertifikat_bnsp', title: 'Sertifikat BNSP (Penerbitan Buku atau Editor)' }
      );
    } else {
      // Luar Biasa (Institusi Pendidikan)
      requiredDocs.push(
        { type: 'sk_pembentukan', title: 'SK Pembentukan Penerbitan Buku' },
        { type: 'domisili_press', title: 'Surat Keterangan Domisili Press' },
        { type: 'formulir_pendaftaran', title: 'Formulir Pendaftaran IKAPI 2026' },
        { type: 'sertifikat_bnsp', title: 'Sertifikat BNSP (Penerbitan Buku atau Editor)' }
      );
    }

    for (const d of requiredDocs) {
      await query.run(
        `INSERT INTO documents (submission_id, document_type, document_title, file_path, file_name, screening_status)
         VALUES (?, ?, ?, '', 'Belum diunggah', 'Menunggu')`,
        [submissionId, d.type, d.title]
      );
    }

    // Create payment entry (biaya mengikuti pengaturan Admin saat ini)
    const fees = await computeFees(submissionType);
    await query.run(
      `INSERT INTO payments (submission_id, amount, fee_breakdown, verification_status)
       VALUES (?, ?, ?, 'Menunggu')`,
      [submissionId, fees.total, JSON.stringify(fees)]
    );

    await logEvent(submissionId, req.user, isDraft ? 'Draf formulir dibuat' : 'Pengajuan dikirim untuk screening dokumen');

    res.json({
      message: isDraft ? 'Draf formulir berhasil disimpan.' : 'Formulir berhasil dikirim. Dokumen Anda akan diperiksa Admin terlebih dahulu.',
      submissionId,
      status: initialStatus
    });
  } catch (err) {
    console.error('Create submission error:', err);
    res.status(500).json({ error: 'Gagal membuat pengajuan.' });
  }
});

// Update draft / form data
app.put('/api/submissions/:id', authenticate, async (req, res) => {
  try {
    const subId = req.params.id;
    const { isSubmit, ...formData } = req.body;

    const sub = await query.get('SELECT * FROM submissions WHERE id = ?', [subId]);
    if (!sub) {
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    if (req.user.role === 'Anggota' && sub.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

    if (req.user.role === 'Anggota' && !['Draf', 'Perlu Revisi'].includes(sub.status)) {
      return res.status(400).json({ error: 'Formulir tidak dapat diubah karena pengajuan sedang diproses.' });
    }
    // Staf hanya boleh membantu mengoreksi isian sebelum dokumen disetujui; setelah itu
    // isian sudah menjadi dasar tagihan, surat, dan TTD sehingga dikunci.
    if (req.user.role !== 'Anggota' && !['Draf', 'Menunggu Verifikasi', 'Perlu Revisi'].includes(sub.status)) {
      return res.status(400).json({ error: `Isian formulir terkunci karena pengajuan sudah berstatus ${sub.status}.` });
    }
    if (isSubmit && sub.status === 'Draf') {
      const missing = await query.all(
        `SELECT document_title FROM documents WHERE submission_id = ? AND (file_path IS NULL OR file_path = '')`,
        [subId]
      );
      if (missing.length) {
        return res.status(400).json({
          error: `Lengkapi dokumen persyaratan terlebih dahulu: ${missing.map((d) => d.document_title).join(', ')}. Formulir tersimpan sebagai draf.`
        });
      }
    }
    const newStatus = isSubmit && sub.status === 'Draf' ? 'Menunggu Verifikasi' : sub.status;
    const submittedAt = isSubmit ? nowSql() : sub.submitted_at;
    const subType = formData.submissionType || sub.submission_type;
    if (req.user.role === 'Anggota') {
      const expectedType = await profileSubmissionType(req.user.id);
      if (expectedType && subType !== expectedType) {
        return res.status(400).json({ error: `Jenis pengajuan untuk akun ini adalah ${TYPE_LABEL[expectedType]}, sesuai profil keanggotaan.` });
      }
    }
    const oldKta = formData.oldKtaNumber !== undefined ? formData.oldKtaNumber : sub.old_kta_number;

    await query.run(
      `UPDATE submissions SET submission_type = ?, old_kta_number = ?, form_data = ?, status = ?, submitted_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [subType, oldKta || null, JSON.stringify(formData), newStatus, submittedAt, subId]
    );

    // Also update member record if available
    if (sub.member_id && formData.publisherName) {
      await query.run(
        `UPDATE members SET
          publisher_name = ?, category = COALESCE(?, category), leader_name = COALESCE(NULLIF(?, ''), leader_name), leader_title = COALESCE(?, leader_title),
          leader_phone = COALESCE(?, leader_phone), legal_entity = COALESCE(?, legal_entity), nib = COALESCE(?, nib),
          npwp = COALESCE(?, npwp), address = COALESCE(NULLIF(?, ''), address), city = COALESCE(NULLIF(?, ''), city), postal_code = COALESCE(?, postal_code),
          phone = COALESCE(NULLIF(?, ''), phone), fax = COALESCE(?, fax), email = COALESCE(NULLIF(?, ''), email), website = COALESCE(?, website),
          person_in_charge = COALESCE(NULLIF(?, ''), person_in_charge), bnsp_certificate_no = COALESCE(?, bnsp_certificate_no),
          specialization = COALESCE(?, specialization), updated_at = NOW()
         WHERE id = ?`,
        [
          formData.publisherName, formData.category || null, formData.leaderName, formData.leaderTitle || null,
          formData.leaderPhone || null, formData.legalEntity || null, formData.nib || null,
          formData.npwp || null, formData.address, formData.city, formData.postalCode || null,
          formData.phone, formData.fax || null, formData.email, formData.website || null,
          formData.personInCharge, formData.bnspCertificateNo || null,
          Array.isArray(formData.specialization) ? formData.specialization.join(', ') : (formData.specialization || null),
          sub.member_id
        ]
      );
    }

    if (isSubmit && sub.status === 'Draf') {
      await logEvent(subId, req.user, 'Pengajuan dikirim untuk screening dokumen');
    }

    res.json({
      message: isSubmit ? 'Formulir berhasil dikirim. Dokumen Anda akan diperiksa Admin terlebih dahulu.' : 'Draf berhasil diperbarui.',
      submissionId: Number(subId),
      status: newStatus
    });
  } catch (err) {
    console.error('Update submission error:', err);
    res.status(500).json({ error: 'Gagal memperbarui formulir.' });
  }
});

// ==========================================
// 3. FILE UPLOADS & DOCUMENTS
// ==========================================

// Upload or replace document file
app.post('/api/submissions/:id/documents', authenticate, upload.single('file'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { documentType, documentTitle } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Silakan pilih file untuk diunggah.' });
    }

    const filePath = `/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;

    const owner = await query.get('SELECT user_id, status FROM submissions WHERE id = ?', [subId]);
    if (!owner) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    if (req.user.role === 'Anggota' && owner.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

    // Check if slot exists
    const existing = await query.get(
      'SELECT id, screening_status, file_path, document_title FROM documents WHERE submission_id = ? AND document_type = ?',
      [subId, documentType]
    );

    // Setelah dikirim, pemohon hanya boleh mengganti dokumen yang dinyatakan tidak sesuai atau slot kosong
    if (req.user.role === 'Anggota' && owner.status !== 'Draf') {
      const isEmptySlot = existing && !existing.file_path;
      const isRevisiDoc = existing && existing.screening_status === 'Perlu Revisi';
      const allowed =
        ((owner.status === 'Perlu Revisi' || owner.status === 'Menunggu Verifikasi') && (isRevisiDoc || isEmptySlot));
      if (!allowed) {
        return res.status(400).json({ error: 'Dokumen ini tidak perlu diunggah ulang. Hanya dokumen yang dinyatakan tidak sesuai yang dapat diganti.' });
      }
    }

    const wasRevision = existing && (existing.screening_status === 'Perlu Revisi' || owner.status === 'Perlu Revisi');

    if (existing) {
      await query.run(
        `UPDATE documents SET
          file_path = ?, file_name = ?, file_size = ?, mime_type = ?,
          screening_status = 'Menunggu', revision_notes = NULL, opened_at = NULL, opened_by_name = NULL,
          verified_at = NULL, verified_by = NULL, updated_at = NOW()
         WHERE id = ?`,
        [filePath, fileName, fileSize, mimeType, existing.id]
      );
    } else {
      await query.run(
        `INSERT INTO documents (
          submission_id, document_type, document_title, file_path, file_name, file_size, mime_type, screening_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu')`,
        [subId, documentType, documentTitle || documentType, filePath, fileName, fileSize, mimeType]
      );
    }

    const docTitle = existing?.document_title || documentTitle || documentType;
    let resubmitted = false;
    if (owner.status !== 'Draf') {
      await logEvent(subId, req.user, wasRevision ? `Revisi dokumen diunggah: ${docTitle}` : `Dokumen diunggah: ${docTitle}`);
    }

    // Semua dokumen yang tidak sesuai sudah diganti -> kembali ke screening Admin
    if (owner.status === 'Perlu Revisi' || owner.status === 'Menunggu Verifikasi') {
      const stillNeedsRevision = await query.get(
        `SELECT COUNT(*) as count FROM documents WHERE submission_id = ? AND (screening_status = 'Perlu Revisi' OR file_path = '')`,
        [subId]
      );
      if (stillNeedsRevision.count === 0 && owner.status === 'Perlu Revisi') {
        await query.run(
          `UPDATE submissions SET status = 'Menunggu Verifikasi', admin_notes = 'Dokumen revisi telah diunggah kembali oleh pemohon.',
             screened_at = NULL, screened_by_name = NULL, updated_at = NOW()
           WHERE id = ?`,
          [subId]
        );
        await logEvent(subId, req.user, 'Semua revisi dokumen dikirim, menunggu screening ulang Admin');
        resubmitted = true;
      }
    }

    res.json({
      resubmitted,
      message: resubmitted
        ? 'Semua dokumen revisi berhasil dikirim. Menunggu screening ulang oleh Admin.'
        : wasRevision
        ? 'Dokumen revisi berhasil diunggah.'
        : 'Berkas berhasil diunggah.',
      filePath,
      fileName
    });
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ error: 'Gagal mengunggah berkas.' });
  }
});

// Admin membuka dokumen saat screening: waktu pertama dibuka dicatat (log waktu)
app.post('/api/documents/:docId/opened', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const doc = await query.get('SELECT id, submission_id, document_title, opened_at, file_path FROM documents WHERE id = ?', [req.params.docId]);
    if (!doc || !doc.file_path) return res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    if (!doc.opened_at) {
      await query.run(
        `UPDATE documents SET opened_at = NOW(), opened_by_name = ? WHERE id = ?`,
        [req.user.name, doc.id]
      );
      await logEvent(doc.submission_id, req.user, `Dokumen dibuka: ${doc.document_title}`);
    }
    const row = await query.get('SELECT opened_at, opened_by_name FROM documents WHERE id = ?', [doc.id]);
    res.json(row);
  } catch (err) {
    console.error('Open document error:', err);
    res.status(500).json({ error: 'Gagal mencatat waktu dokumen dibuka.' });
  }
});

app.post('/api/submissions/:id/payment/opened', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const pay = await query.get('SELECT id, proof_file, proof_opened_at FROM payments WHERE submission_id = ?', [req.params.id]);
    if (!pay || !pay.proof_file) return res.status(404).json({ error: 'Bukti transfer tidak ditemukan.' });
    if (!pay.proof_opened_at) {
      await query.run(
        `UPDATE payments SET proof_opened_at = NOW(), proof_opened_by_name = ? WHERE id = ?`,
        [req.user.name, pay.id]
      );
      await logEvent(req.params.id, req.user, 'Bukti transfer dibuka');
    }
    res.json(await query.get('SELECT proof_opened_at, proof_opened_by_name FROM payments WHERE id = ?', [pay.id]));
  } catch (err) {
    console.error('Open payment error:', err);
    res.status(500).json({ error: 'Gagal mencatat waktu bukti transfer dibuka.' });
  }
});

// Sekretaris: Screen single document
app.put('/api/documents/:docId/screen', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const docId = req.params.docId;
    const { status, revisionNotes } = req.body;

    if (!['Sesuai', 'Perlu Revisi'].includes(status)) {
      return res.status(400).json({ error: 'Status screening harus "Sesuai" atau "Tidak sesuai".' });
    }
    const doc = await query.get(
      `SELECT d.*, s.status AS sub_status FROM documents d JOIN submissions s ON s.id = d.submission_id WHERE d.id = ?`,
      [docId]
    );
    if (!doc) return res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    if (doc.sub_status !== 'Menunggu Verifikasi') {
      return res.status(400).json({ error: 'Dokumen hanya bisa diperiksa saat pengajuan berada di tahap screening dokumen.' });
    }
    if (!doc.file_path) {
      return res.status(400).json({ error: 'Dokumen belum diunggah pemohon.' });
    }
    if (!doc.opened_at) {
      await query.run('UPDATE documents SET opened_at = NOW(), opened_by_name = ? WHERE id = ?', [req.user.name, docId]);
    }
    if (status === 'Perlu Revisi' && !String(revisionNotes || '').trim()) {
      return res.status(400).json({ error: 'Tulis komentar alasan dokumen tidak sesuai agar pemohon tahu apa yang harus diperbaiki.' });
    }

    await query.run(
      `UPDATE documents SET
        screening_status = ?, revision_notes = ?, verified_by = ?, verified_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [status, status === 'Sesuai' ? null : revisionNotes, req.user.id, docId]
    );
    await logEvent(
      doc.submission_id, req.user,
      status === 'Sesuai' ? `Dokumen sesuai: ${doc.document_title}` : `Dokumen tidak sesuai: ${doc.document_title}`,
      status === 'Sesuai' ? null : revisionNotes
    );

    res.json({ message: status === 'Sesuai' ? 'Dokumen ditandai sesuai.' : 'Dokumen ditandai tidak sesuai.' });
  } catch (err) {
    console.error('Screen document error:', err);
    res.status(500).json({ error: 'Gagal memperbarui status berkas.' });
  }
});

// ==========================================
// 4. PAYMENTS & VERIFICATION
// ==========================================

// Anggota upload payment proof
app.post('/api/submissions/:id/payment', authenticate, upload.single('proofFile'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { senderBank, senderAccountName, senderAccountNumber, transferDate } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Bukti transfer wajib diunggah.' });
    }

    const sub = await query.get('SELECT user_id, status FROM submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    if (req.user.role === 'Anggota' && sub.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }
    if (sub.status !== 'Menunggu Pembayaran') {
      return res.status(400).json({ error: 'Pembayaran baru dapat dilakukan setelah semua dokumen disetujui Admin (Tahap 1).' });
    }

    const filePath = `/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;

    await query.run(
      `UPDATE payments SET
        proof_file = ?, proof_filename = ?, sender_bank = ?, sender_account_name = ?,
        sender_account_number = ?, transfer_date = ?, verification_status = 'Menunggu',
        verification_notes = NULL, proof_opened_at = NULL, proof_opened_by_name = NULL, updated_at = NOW()
       WHERE submission_id = ?`,
      [filePath, fileName, senderBank, senderAccountName, senderAccountNumber, transferDate || nowSql().slice(0, 10), subId]
    );

    await query.run(`UPDATE submissions SET updated_at = NOW() WHERE id = ?`, [subId]);
    await logEvent(subId, req.user, 'Bukti transfer diunggah', [senderBank, senderAccountName].filter(Boolean).join(' · ') || null);
    await addNotification({ role: 'Admin' }, 'Bukti transfer masuk', `Pengajuan #${subId} mengunggah bukti transfer. Verifikasi pembayaran.`, Number(subId));

    res.json({
      message: 'Bukti pembayaran berhasil diunggah. Menunggu verifikasi Admin.',
      status: 'Menunggu Pembayaran'
    });
  } catch (err) {
    console.error('Upload payment error:', err);
    res.status(500).json({ error: 'Gagal mengunggah bukti pembayaran.' });
  }
});

// Sekretaris verify payment
app.put('/api/submissions/:id/payment/verify', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { status, notes } = req.body; // 'Valid' or 'Perlu Revisi'

    if (!['Valid', 'Perlu Revisi'].includes(status)) {
      return res.status(400).json({ error: 'Status pembayaran harus "Valid" atau "Tidak sesuai".' });
    }
    const sub = await query.get('SELECT status FROM submissions WHERE id = ?', [subId]);
    const pay = await query.get('SELECT proof_file, proof_opened_at FROM payments WHERE submission_id = ?', [subId]);
    if (!sub || !pay) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    if (sub.status !== 'Menunggu Pembayaran' || !pay.proof_file) {
      return res.status(400).json({ error: 'Belum ada bukti transfer yang menunggu verifikasi.' });
    }
    if (!pay.proof_opened_at) {
      return res.status(400).json({ error: 'Buka bukti transfer terlebih dahulu sebelum memverifikasi.' });
    }
    if (status === 'Perlu Revisi' && !String(notes || '').trim()) {
      return res.status(400).json({ error: 'Tulis komentar alasan bukti transfer tidak sesuai.' });
    }

    await query.run(
      `UPDATE payments SET
        verification_status = ?, verification_notes = ?, verified_by = ?,
        verified_at = NOW(), updated_at = NOW()
       WHERE submission_id = ?`,
      [status, notes || null, req.user.id, subId]
    );

    if (status === 'Valid') {
      // Tahap 1 & 2 selesai -> diteruskan ke Sekretaris untuk TTD
      await query.run(
        `UPDATE submissions SET status = 'Menunggu TTD Sekretaris', updated_at = NOW() WHERE id = ?`,
        [subId]
      );
      await logEvent(subId, req.user, 'Pembayaran diverifikasi valid, diteruskan ke Sekretaris untuk TTD');
    } else {
      // Pemohon cukup mengunggah ulang bukti transfer, dokumen tidak perlu dikirim ulang
      await query.run(
        `UPDATE submissions SET admin_notes = ?, updated_at = NOW() WHERE id = ?`,
        [`Bukti transfer tidak sesuai: ${notes}`, subId]
      );
      await logEvent(subId, req.user, 'Bukti transfer tidak sesuai', notes);
    }

    res.json({
      message: status === 'Valid' ? 'Pembayaran valid. Pengajuan diteruskan ke Sekretaris.' : 'Bukti transfer dikembalikan ke pemohon untuk diunggah ulang.',
      status: status === 'Valid' ? 'Menunggu TTD Sekretaris' : 'Menunggu Pembayaran'
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Gagal memperbarui verifikasi pembayaran.' });
  }
});

// ==========================================
// 5. WORKFLOW ACTIONS (ADMIN 1 & ADMIN 2)
// ==========================================

// Tahap 1 (Admin): screening dokumen satu per satu.
//   'approve_documents' -> semua dokumen sesuai, lanjut ke Tahap 2 (pembayaran)
//   'request_revision'  -> dokumen tidak sesuai dikembalikan ke pemohon (hanya dokumen itu yang diunggah ulang)
// Sekretaris: 'pass_to_admin2' membubuhkan TTD setelah dokumen & pembayaran disetujui Admin.
app.post('/api/submissions/:id/admin1-action', authenticate, authorize('Admin', 'Sekretaris'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { notes, signaturePositions } = req.body;
    const action = req.body.action === 'mark_screened' ? 'approve_documents' : req.body.action;

    const sub = await query.get('SELECT * FROM submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

    const adminOnly = ['request_revision', 'approve_documents'];
    if (adminOnly.includes(action) && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Screening dokumen dilakukan oleh Admin.' });
    }
    if (action === 'pass_to_admin2' && req.user.role !== 'Sekretaris') {
      return res.status(403).json({ error: 'Tanda tangan tahap ini dilakukan oleh Sekretaris.' });
    }

    const docStats = await query.get(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN screening_status = 'Sesuai' AND file_path != '' THEN 1 ELSE 0 END) AS ok,
              SUM(CASE WHEN screening_status = 'Perlu Revisi' THEN 1 ELSE 0 END) AS bad
       FROM documents WHERE submission_id = ?`,
      [subId]
    );

    if (action === 'approve_documents') {
      if (sub.status !== 'Menunggu Verifikasi') {
        return res.status(400).json({ error: 'Pengajuan ini tidak sedang di tahap screening dokumen.' });
      }
      if (!docStats.total || docStats.ok !== docStats.total) {
        return res.status(400).json({ error: 'Semua dokumen harus dibuka dan dinyatakan "Sesuai" sebelum lanjut ke pembayaran.' });
      }
      const payment = await query.get('SELECT verification_status FROM payments WHERE submission_id = ?', [subId]);
      const nextStatus = payment?.verification_status === 'Valid' ? 'Menunggu TTD Sekretaris' : 'Menunggu Pembayaran';
      await query.run(
        `UPDATE submissions SET status = ?, screened_at = NOW(), screened_by_name = ?,
           admin_notes = ?, updated_at = NOW()
         WHERE id = ?`,
        [nextStatus, req.user.name, notes || 'Semua dokumen persyaratan sesuai.', subId]
      );
      await logEvent(subId, req.user, 'Tahap 1 selesai: semua dokumen disetujui Admin', notes || null);
      return res.json({
        message: nextStatus === 'Menunggu Pembayaran'
          ? 'Semua dokumen disetujui. Pemohon kini dapat melakukan pembayaran (Tahap 2).'
          : 'Semua dokumen disetujui. Pembayaran sudah valid, diteruskan ke Sekretaris.',
        status: nextStatus
      });
    }

    if (action === 'request_revision') {
      if (sub.status !== 'Menunggu Verifikasi') {
        return res.status(400).json({ error: 'Pengajuan ini tidak sedang di tahap screening dokumen.' });
      }
      if (!docStats.bad) {
        return res.status(400).json({ error: 'Tandai minimal satu dokumen "Tidak sesuai" beserta komentarnya.' });
      }
      await query.run(
        `UPDATE submissions SET status = 'Perlu Revisi', admin_notes = ?, screened_at = NULL, screened_by_name = NULL,
           updated_at = NOW()
         WHERE id = ?`,
        [notes || 'Terdapat dokumen yang tidak sesuai. Unggah ulang dokumen yang ditandai.', subId]
      );
      await logEvent(subId, req.user, `Dikembalikan ke pemohon: ${docStats.bad} dokumen perlu direvisi`, notes || null);
      return res.json({ message: 'Pemohon diminta merevisi dokumen yang tidak sesuai.', status: 'Perlu Revisi' });
    }

    if (action === 'pass_to_admin2') {
      if (sub.status !== 'Menunggu TTD Sekretaris') {
        return res.status(400).json({ error: 'Pengajuan belum siap ditandatangani: dokumen dan pembayaran harus disetujui Admin terlebih dahulu.' });
      }
      if (docStats.ok !== docStats.total) {
        return res.status(400).json({ error: 'Semua berkas persyaratan wajib bertatus "Sesuai" sebelum diteruskan ke Ketua.' });
      }

      // Check payment status
      const payment = await query.get('SELECT verification_status FROM payments WHERE submission_id = ?', [subId]);
      if (!payment || payment.verification_status !== 'Valid') {
        return res.status(400).json({ error: 'Pembayaran wajib diverifikasi "Valid" sebelum diteruskan ke Ketua.' });
      }

      // Generate or reserve reference number if not already present
      // Sekretaris membubuhkan TTD tersimpannya pada semua dokumen sebelum diteruskan ke Ketua
      let secretarySig = null;
      let secretaryPos = null;
      let positionsJson = sub.signature_positions;
      if (req.user.role === 'Sekretaris') {
        const sekretaris = await query.get('SELECT signature_img FROM users WHERE id = ?', [req.user.id]);
        if (!sekretaris?.signature_img) {
          return res.status(400).json({ error: 'Buat dan simpan tanda tangan Anda terlebih dahulu.' });
        }
        const positions = parseSignaturePositions(signaturePositions);
        if (!positions) {
          return res.status(400).json({ error: 'Posisi tanda tangan pada dokumen tidak valid.' });
        }
        secretarySig = sekretaris.signature_img;
        secretaryPos = JSON.stringify(positions.surat);
        positionsJson = mergeSignaturePositions(sub.signature_positions, 'secretary', positions);
      }
      const secretaryNameRow = await query.get(`SELECT value FROM settings WHERE settings.key = 'sekretaris_nama'`);

      let refNumber = sub.reference_number;
      if (!refNumber) {
        const counterSetting = await query.get(`SELECT value FROM settings WHERE settings.key = 'surat_counter'`);
        const nextCounter = parseInt(counterSetting ? counterSetting.value : '1', 10) + 1;
        refNumber = formatSuratNumber(nextCounter, new Date());
        await query.run(`UPDATE settings SET value = ? WHERE settings.key = 'surat_counter'`, [String(nextCounter)]);
      }

      await query.run(
        `UPDATE submissions SET
          status = 'Menunggu Approval',
          reference_number = ?,
          letter_date = CURDATE(),
          admin_notes = ?,
          secretary_signature_img = COALESCE(?, secretary_signature_img),
          secretary_signature_pos = COALESCE(?, secretary_signature_pos),
          signature_positions = ?,
          screened_at = COALESCE(screened_at, NOW()),
          screened_by_name = COALESCE(screened_by_name, ?),
          signed_by_secretary = CASE WHEN ? IS NOT NULL THEN ? ELSE signed_by_secretary END,
          secretary_signature_date = CASE WHEN ? IS NOT NULL THEN NOW() ELSE secretary_signature_date END,
          updated_at = NOW()
         WHERE id = ?`,
        [
          refNumber,
          notes || 'Berkas dan pembayaran telah diverifikasi lengkap dan valid oleh Sekretaris.',
          secretarySig,
          secretaryPos,
          positionsJson,
          req.user.name,
          secretarySig, secretaryNameRow?.value || 'Drs. H. Anwar Rosyid, M.Si.',
          secretarySig,
          subId
        ]
      );

      await logEvent(subId, req.user, 'Ditandatangani Sekretaris, diteruskan ke Ketua', notes || null);
      return res.json({
        message: 'Pengajuan berhasil diteruskan ke Ketua untuk proses persetujuan dan tanda tangan surat.',
        status: 'Menunggu Approval',
        referenceNumber: refNumber
      });
    }

    res.status(400).json({ error: 'Tindakan tidak dikenal.' });
  } catch (err) {
    console.error('Sekretaris action error:', err);
    res.status(500).json({ error: 'Gagal memproses tindakan Sekretaris.' });
  }
});

// Ketua Action: Approve (langsung Aktif) or Reject
app.post('/api/submissions/:id/admin2-action', authenticate, authorize('Ketua', 'Sekretaris'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { action, reason, signaturePositions } = req.body;

    const sub = await query.get('SELECT * FROM submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

    if (action === 'approve') {
      // Require Ketua role
      if (req.user.role !== 'Ketua') {
        return res.status(403).json({ error: 'Hanya Ketua yang dapat menyetujui pengajuan.' });
      }

      if (sub.status !== 'Menunggu Approval') {
        return res.status(400).json({ error: 'Pengajuan ini tidak sedang menunggu approval.' });
      }

      // TTD tersimpan milik Ketua dibubuhkan pada posisi yang dipilih di setiap pratinjau dokumen
      const ketua = await query.get('SELECT signature_img FROM users WHERE id = ?', [req.user.id]);
      if (!ketua?.signature_img) {
        return res.status(400).json({ error: 'Buat dan simpan tanda tangan Anda terlebih dahulu.' });
      }
      const positions = parseSignaturePositions(signaturePositions);
      if (!positions) {
        return res.status(400).json({ error: 'Posisi tanda tangan pada dokumen tidak valid.' });
      }

      const settingsList = await query.all(`SELECT settings.key, settings.value FROM settings WHERE settings.key IN ('ketua_nama', 'sekretaris_nama')`);
      const map = {};
      settingsList.forEach(s => { map[s.key] = s.value; });

      const chairmanName = map.ketua_nama || 'Dr. H. Mahpudi, M.T.';
      const secretaryName = map.sekretaris_nama || 'Drs. H. Anwar Rosyid, M.Si.';

      await query.run(
        `UPDATE submissions SET
          status = 'Pengiriman Berkas',
          physical_status = 'Belum Dikirim',
          approved_at = NOW(),
          signed_by_chairman = ?,
          signed_by_secretary = COALESCE(signed_by_secretary, ?),
          chairman_signature_date = NOW(),
          secretary_signature_date = COALESCE(secretary_signature_date, NOW()),
          chairman_signature_img = ?,
          chairman_signature_pos = ?,
          signature_positions = ?,
          updated_at = NOW()
         WHERE id = ?`,
        [
          chairmanName, secretaryName, ketua.signature_img,
          JSON.stringify(positions.surat),
          mergeSignaturePositions(sub.signature_positions, 'chairman', positions),
          subId
        ]
      );

      // Setelah TTD Ketua pemohon mencetak & mengirim berkas fisik ke sekretariat IKAPI Jawa Barat.
      // Status anggota aktif diberikan Admin setelah berkas fisik diterima.
      await logEvent(subId, req.user, 'Disetujui & ditandatangani Ketua. Surat pengantar terbit, pemohon diminta mengirim berkas fisik');

      return res.json({
        message: 'Pengajuan disetujui. Pemohon diminta mengirim berkas fisik ke sekretariat IKAPI Jawa Barat.',
        status: 'Pengiriman Berkas'
      });
    }

    if (action === 'reject') {
      // Keputusan akhir: Sekretaris di tahapnya (setelah Admin), Ketua di tahap approval
      const stageOf = { Sekretaris: 'Menunggu TTD Sekretaris', Ketua: 'Menunggu Approval' };
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: 'Alasan penolakan wajib disertakan.' });
      }
      if (sub.status !== stageOf[req.user.role]) {
        return res.status(400).json({ error: 'Pengajuan ini tidak sedang menunggu keputusan Anda.' });
      }

      await query.run(
        `UPDATE submissions SET
          status = 'Ditolak',
          rejection_reason = ?,
          rejected_at_status = ?,
          updated_at = NOW()
         WHERE id = ?`,
        [reason, sub.status, subId]
      );

      await logEvent(subId, req.user, `Pengajuan ditolak ${req.user.role}`, reason);
      return res.json({
        message: 'Pengajuan telah ditolak.',
        status: 'Ditolak'
      });
    }

    res.status(400).json({ error: 'Tindakan tidak dikenal.' });
  } catch (err) {
    console.error('Ketua action error:', err);
    res.status(500).json({ error: 'Gagal memproses tindakan Ketua.' });
  }
});

// Pemohon: konfirmasi berkas fisik sudah dikirim ke sekretariat IKAPI Jawa Barat
app.post('/api/submissions/:id/physical-sent', authenticate, authorize('Anggota'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { courier, trackingNo, notes } = req.body;
    const sub = await query.get('SELECT * FROM submissions WHERE id = ?', [subId]);
    if (!sub || sub.user_id !== req.user.id) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    if (sub.status !== 'Pengiriman Berkas') {
      return res.status(400).json({ error: 'Berkas fisik dikirim setelah pengajuan disetujui Ketua.' });
    }
    if (!String(courier || '').trim()) {
      return res.status(400).json({ error: 'Isi cara pengiriman (mis. JNE, POS, atau diantar langsung).' });
    }
    await query.run(
      `UPDATE submissions SET physical_status = 'Dikirim', physical_sent_at = NOW(),
         physical_courier = ?, physical_tracking_no = ?, physical_notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [courier.trim(), trackingNo || null, notes || null, subId]
    );
    await logEvent(subId, req.user, 'Berkas fisik dikirim ke sekretariat IKAPI Jawa Barat',
      [courier.trim(), trackingNo ? `No. resi ${trackingNo}` : null, notes].filter(Boolean).join(' · '));
    await addNotification({ role: 'Admin' }, 'Berkas fisik dikirim pemohon',
      `Pengajuan #${subId} mengirim berkas fisik via ${courier.trim()}${trackingNo ? ` (resi ${trackingNo})` : ''}. Konfirmasi saat diterima.`, Number(subId));
    res.json({ message: 'Terima kasih. Admin akan mengonfirmasi setelah berkas fisik diterima.' });
  } catch (err) {
    console.error('Physical sent error:', err);
    res.status(500).json({ error: 'Gagal menyimpan konfirmasi pengiriman.' });
  }
});

// Admin: berkas fisik sudah sampai di sekretariat -> pemohon resmi menjadi anggota
app.post('/api/submissions/:id/physical-received', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { notes } = req.body;
    const sub = await query.get('SELECT * FROM submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    if (sub.status !== 'Pengiriman Berkas') {
      return res.status(400).json({ error: 'Pengajuan ini tidak sedang menunggu berkas fisik.' });
    }
    // Berkas fisik hanya bisa dikonfirmasi diterima setelah pemohon menandainya sudah dikirim
    if (sub.physical_status !== 'Dikirim') {
      return res.status(400).json({ error: 'Pemohon belum menandai berkas fisik sudah dikirim.' });
    }
    await query.run(
      `UPDATE submissions SET status = 'Berkas Diterima', physical_status = 'Diterima',
         physical_received_at = NOW(), physical_received_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [req.user.name, subId]
    );
    await logEvent(subId, req.user, 'Berkas fisik diterima sekretariat IKAPI Jawa Barat, siap dikirim ke IKAPI Pusat', notes || null);
    res.json({ message: 'Berkas fisik dikonfirmasi diterima. Langkah berikutnya: kirim paket ke IKAPI Pusat.', status: 'Berkas Diterima' });
  } catch (err) {
    console.error('Physical received error:', err);
    res.status(500).json({ error: 'Gagal mengonfirmasi berkas fisik.' });
  }
});

// Admin mencatat paket berkas dikirim ke IKAPI Pusat; status menjadi menunggu No. KTA dari Pusat
app.post('/api/submissions/:id/sent-to-central', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { courier, trackingNo, notes } = req.body;
    const sub = await query.get('SELECT id, status FROM submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    if (sub.status !== 'Berkas Diterima') {
      return res.status(400).json({ error: 'Hanya pengajuan yang berkas fisiknya sudah diterima yang bisa dikirim ke Pusat.' });
    }
    if (!String(courier || '').trim()) {
      return res.status(400).json({ error: 'Isi jasa pengiriman / cara pengiriman ke IKAPI Pusat.' });
    }
    await query.run(
      `UPDATE submissions SET status = 'Dikirim ke Pusat', sent_to_central_at = NOW(),
         central_courier = ?, central_tracking_no = ?, central_notes = ?, central_sent_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [String(courier).trim(), trackingNo ? String(trackingNo).trim() : null, notes || null, req.user.name, subId]
    );
    const detail = [String(courier).trim(), trackingNo ? `resi ${String(trackingNo).trim()}` : null].filter(Boolean).join(' · ');
    await logEvent(subId, req.user, `Berkas dikirim ke IKAPI Pusat (${detail}), menunggu Nomor KTA`, notes || null);
    res.json({ message: 'Pengiriman ke IKAPI Pusat tercatat. Sekretaris menginput Nomor KTA setelah terbit dari Pusat.', status: 'Dikirim ke Pusat' });
  } catch (err) {
    console.error('Sent to central error:', err);
    res.status(500).json({ error: 'Gagal mencatat pengiriman ke Pusat.' });
  }
});

// ==========================================
// 6. DASHBOARD & STATS (ADMIN 2 MONITORING)
// ==========================================

app.get('/api/admin/dashboard-stats', authenticate, authorize('Admin', 'Sekretaris', 'Ketua'), async (req, res) => {
  try {
    const totalSubmissions = await query.get('SELECT COUNT(*) as count FROM submissions');
    const pendingScreening = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Menunggu Verifikasi'`);
    const pendingPayment = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Menunggu Pembayaran'`);
    const pendingSecretary = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Menunggu TTD Sekretaris'`);
    const pendingPhysical = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Pengiriman Berkas'`);
    const pendingCentralSend = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Berkas Diterima'`);
    const pendingKta = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Dikirim ke Pusat'`);
    const pendingApproval = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Menunggu Approval'`);
    const activeMembers = await query.get(`SELECT COUNT(*) as count FROM members WHERE membership_status = 'Aktif'`);
    const rejectedSubmissions = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Ditolak'`);
    const needRevision = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Perlu Revisi'`);

    // Financial sum from verified payments
    const totalRevenue = await query.get(
      `SELECT SUM(amount) as total FROM payments WHERE verification_status = 'Valid'`
    );

    // Submissions by status breakdown
    const statusCounts = await query.all(
      `SELECT status, COUNT(*) as count FROM submissions GROUP BY status`
    );

    // Submissions by category
    const categoryCounts = await query.all(
      `SELECT m.category, COUNT(s.id) as count 
       FROM submissions s 
       JOIN members m ON s.member_id = m.id 
       GROUP BY m.category`
    );

    // Recent activity
    const recentSubmissions = await query.all(
      `SELECT s.id, s.status, s.submission_type, s.created_at, s.updated_at,
              m.publisher_name, m.category, u.name as applicant_name
       FROM submissions s
       JOIN members m ON s.member_id = m.id
       JOIN users u ON s.user_id = u.id
       ORDER BY s.updated_at DESC LIMIT 6`
    );

    res.json({
      stats: {
        totalSubmissions: totalSubmissions.count,
        pendingScreening: pendingScreening.count,
        pendingApproval: pendingApproval.count,
        pendingPayment: pendingPayment.count,
        pendingSecretary: pendingSecretary.count,
        pendingPhysical: pendingPhysical.count,
        pendingCentralSend: pendingCentralSend.count,
        pendingKta: pendingKta.count,
        activeMembers: activeMembers.count,
        rejectedSubmissions: rejectedSubmissions.count,
        needRevision: needRevision.count,
        totalRevenue: totalRevenue.total || 0
      },
      statusCounts,
      categoryCounts,
      recentSubmissions
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Gagal memuat statistik dashboard.' });
  }
});

// ==========================================
// 7. MEMBERS MANAGEMENT & EXCEL EXPORT
// ==========================================

// List members
app.get('/api/members', authenticate, authorize('Sekretaris', 'Ketua'), async (req, res) => {
  try {
    const { category, status, search } = req.query;
    // Sertakan status pengajuan terakhir agar Sekretaris tahu siapa yang menunggu No. KTA dari Pusat
    let sql = `SELECT m.*, (SELECT s.status FROM submissions s WHERE s.member_id = m.id ORDER BY s.id DESC LIMIT 1) AS submission_status,
                 (SELECT s.sent_to_central_at FROM submissions s WHERE s.member_id = m.id ORDER BY s.id DESC LIMIT 1) AS sent_to_central_at,
                 (SELECT s.central_courier FROM submissions s WHERE s.member_id = m.id ORDER BY s.id DESC LIMIT 1) AS central_courier,
                 (SELECT s.central_tracking_no FROM submissions s WHERE s.member_id = m.id ORDER BY s.id DESC LIMIT 1) AS central_tracking_no,
                 (SELECT s.submission_type FROM submissions s WHERE s.member_id = m.id ORDER BY s.id DESC LIMIT 1) AS submission_type
               FROM members m
               -- Calon dari pendaftaran akun tanpa pengajuan terkirim (data sementara) tidak ditampilkan
               WHERE (m.membership_status <> 'Calon' OR EXISTS (SELECT 1 FROM submissions s WHERE s.member_id = m.id AND s.status <> 'Draf'))`;
    const params = [];

    if (category && category !== 'Semua') {
      sql += ' AND m.category = ?';
      params.push(category);
    }
    if (status && status !== 'Semua') {
      sql += ' AND m.membership_status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (m.publisher_name LIKE ? OR m.leader_name LIKE ? OR m.kta_number LIKE ? OR m.city LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY m.id DESC';
    const members = await query.all(sql, params);
    res.json({ members });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Gagal memuat data anggota.' });
  }
});

// Input / koreksi No. KTA dari IKAPI Pusat (tugas Sekretaris).
// Pengajuan berstatus 'Dikirim ke Pusat' otomatis menjadi Aktif saat KTA diinput.
app.put('/api/members/:id/kta', authenticate, authorize('Sekretaris'), async (req, res) => {
  try {
    const { id } = req.params;
    const kta = String(req.body.kta_number || '').trim().toUpperCase();
    if (!kta) {
      return res.status(400).json({ error: 'Nomor KTA wajib diisi.' });
    }
    const member = await query.get('SELECT id, membership_status FROM members WHERE id = ?', [id]);
    if (!member) return res.status(404).json({ error: 'Data anggota tidak ditemukan.' });

    const dup = await query.get('SELECT publisher_name FROM members WHERE kta_number = ? AND id <> ?', [kta, member.id]);
    if (dup) {
      return res.status(400).json({ error: `Nomor KTA ${kta} sudah dipakai ${dup.publisher_name}.` });
    }

    const sub = await query.get(
      'SELECT id, status FROM submissions WHERE member_id = ? ORDER BY id DESC LIMIT 1',
      [member.id]
    );

    if (sub?.status === 'Dikirim ke Pusat') {
      await query.run(
        `UPDATE members SET kta_number = ?, membership_status = 'Aktif', updated_at = NOW() WHERE id = ?`,
        [kta, member.id]
      );
      await query.run(
        `UPDATE submissions SET status = 'Aktif', activated_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [sub.id]
      );
      await logEvent(sub.id, req.user, `Nomor KTA dari IKAPI Pusat diinput: ${kta}. Pemohon resmi menjadi anggota aktif`);
      return res.json({ message: `Nomor KTA ${kta} tersimpan. Anggota kini aktif.`, activated: true });
    }

    // Koreksi KTA untuk anggota yang sudah aktif / data lama
    const isExisting = sub ? sub.status === 'Aktif' : member.membership_status !== 'Calon';
    if (!isExisting) {
      return res.status(400).json({
        error: sub
          ? `Nomor KTA baru bisa diinput setelah berkas dikirim ke IKAPI Pusat (status pengajuan saat ini: ${sub.status}).`
          : 'Calon anggota ini belum memiliki pengajuan.'
      });
    }
    await query.run(
      `UPDATE members SET kta_number = ?,
         membership_status = CASE WHEN membership_status = 'Calon' THEN 'Aktif' ELSE membership_status END,
         updated_at = NOW() WHERE id = ?`,
      [kta, member.id]
    );
    if (sub) await logEvent(sub.id, req.user, `Nomor KTA diperbarui: ${kta}`);
    res.json({ message: `Nomor KTA berhasil disimpan: ${kta}`, activated: false });
  } catch (err) {
    console.error('Update KTA error:', err);
    res.status(500).json({ error: 'Gagal menyimpan nomor KTA.' });
  }
});

// Ubah status keanggotaan (mis. menonaktifkan anggota yang tidak memperpanjang)
app.put('/api/members/:id/status', authenticate, authorize('Sekretaris'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Aktif', 'Nonaktif'].includes(status)) {
      return res.status(400).json({ error: 'Status keanggotaan harus Aktif atau Nonaktif.' });
    }
    const member = await query.get('SELECT id, publisher_name, kta_number FROM members WHERE id = ?', [req.params.id]);
    if (!member) return res.status(404).json({ error: 'Data anggota tidak ditemukan.' });
    if (status === 'Aktif' && !member.kta_number) {
      return res.status(400).json({ error: 'Isi Nomor KTA terlebih dahulu sebelum mengaktifkan anggota.' });
    }
    await query.run('UPDATE members SET membership_status = ?, updated_at = NOW() WHERE id = ?', [status, member.id]);
    res.json({ message: `${member.publisher_name} kini berstatus ${status}.` });
  } catch (err) {
    console.error('Update member status error:', err);
    res.status(500).json({ error: 'Gagal mengubah status keanggotaan.' });
  }
});

// Export members to Excel
app.get('/api/members/export', authenticate, authorize('Sekretaris', 'Ketua'), async (req, res) => {
  try {
    const members = await query.all(`
      SELECT 
        kta_number as 'No. KTA',
        publisher_name as 'Nama Penerbit',
        category as 'Kategori',
        legal_entity as 'Bentuk Badan Hukum',
        leader_name as 'Nama Pimpinan',
        leader_title as 'Jabatan Pimpinan',
        address as 'Alamat',
        city as 'Kota / Kabupaten',
        phone as 'Telepon',
        email as 'Email',
        website as 'Website',
        person_in_charge as 'Penanggung Jawab',
        bnsp_certificate_no as 'No. Sertifikat BNSP',
        specialization as 'Spesialisasi Buku',
        membership_status as 'Status Keanggotaan',
        created_at as 'Tanggal Terdaftar'
      FROM members m
      WHERE (m.membership_status <> 'Calon' OR EXISTS (SELECT 1 FROM submissions s WHERE s.member_id = m.id AND s.status <> 'Draf'))
      ORDER BY m.id ASC
    `);

    const worksheet = XLSX.utils.json_to_sheet(members);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Anggota IKAPI Jabar');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=Data_Anggota_IKAPI_Jawa_Barat.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Gagal mengekspor data anggota.' });
  }
});

// ==========================================
// 8. SETTINGS MANAGEMENT
// ==========================================

// Kontak publik untuk halaman login / lupa sandi (tanpa login). Hanya kunci kontak yang dibuka.
app.get('/api/public/contact', async (req, res) => {
  try {
    const rows = await query.all(
      "SELECT settings.key, settings.value FROM settings WHERE settings.key IN ('admin_whatsapp', 'office_phone')"
    );
    const out = { admin_whatsapp: '', office_phone: '' };
    rows.forEach((r) => { out[r.key] = r.value; });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat kontak.' });
  }
});

app.get('/api/settings', authenticate, async (req, res) => {
  try {
    const settingsList = await query.all('SELECT settings.key, settings.value, settings.description FROM settings');
    const settings = {};
    settingsList.forEach(s => { settings[s.key] = s.value; });
    res.json({ settings, list: settingsList });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat pengaturan.' });
  }
});

app.put('/api/settings', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Format pengaturan tidak valid.' });
    }
    for (const key of FEE_KEYS) {
      if (key in settings && !(Number.isFinite(Number(settings[key])) && Number(settings[key]) >= 0)) {
        return res.status(400).json({ error: 'Nilai biaya harus berupa angka 0 atau lebih.' });
      }
    }

    for (const [key, value] of Object.entries(settings)) {
      await query.run(
        `INSERT INTO settings (settings.key, value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [key, String(value)]
      );
    }

    // Harga baru langsung berlaku untuk tagihan yang belum dibayar
    const updatedBills = await syncUnpaidBills();

    res.json({ message: 'Pengaturan sistem berhasil disimpan.', updatedBills });
  } catch (err) {
    console.error('Save settings error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan.' });
  }
});

// Sesi dari header Authorization atau cookie httpOnly (untuk tautan unduhan biasa); null bila tidak valid
function tokenUser(req) {
  return verifySession(readToken(req) || readCookie(req, SESSION_COOKIE));
}

// ==========================================
// GABUNGAN BERKAS PERSYARATAN (satu PDF)
// ==========================================
// PRD bagian 6: semua berkas persyaratan digabung menjadi satu PDF untuk dikirim ke IKAPI Pusat.
const A4 = [595.28, 841.89];
// Font standar PDF hanya mendukung Latin-1
const pdfText = (s) => String(s ?? '').replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

function wrapText(text, font, size, maxWidth) {
  const words = pdfText(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

app.get('/api/submissions/:id/documents/merged', async (req, res) => {
  let user;
  try {
    user = await tokenUser(req);
  } catch {
    return res.status(500).json({ error: 'Gagal memeriksa sesi login.' });
  }
  if (!user) return res.status(401).json({ error: 'Sesi login tidak valid. Silakan masuk kembali.' });
  if (!ROLES.includes(user.role)) return res.status(403).json({ error: 'Akses ditolak.' });

  try {
    const sub = await query.get(
      `SELECT s.id, s.user_id, s.submission_type, s.reference_number, s.status,
              m.publisher_name, m.category, u.name AS applicant_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN members m ON m.id = s.member_id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!sub || (user.role === 'Anggota' && sub.user_id !== user.id)) {
      return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    }

    const docs = await query.all(
      `SELECT document_title AS title, file_path, file_name FROM documents
       WHERE submission_id = ? AND file_path <> '' ORDER BY id`,
      [sub.id]
    );
    const pay = await query.get('SELECT proof_file, proof_filename FROM payments WHERE submission_id = ?', [sub.id]);
    if (pay?.proof_file) {
      docs.push({ title: 'Bukti Transfer Pembayaran', file_path: pay.proof_file, file_name: pay.proof_filename });
    }
    if (!docs.length) {
      return res.status(400).json({ error: 'Belum ada berkas yang diunggah untuk pengajuan ini.' });
    }

    const out = await PDFDocument.create();
    const font = await out.embedFont(StandardFonts.Helvetica);
    const bold = await out.embedFont(StandardFonts.HelveticaBold);

    const notePage = (title, message) => {
      const page = out.addPage(A4);
      page.drawText(pdfText(title), { x: 50, y: A4[1] - 70, size: 14, font: bold });
      wrapText(message, font, 11, A4[0] - 100).forEach((line, i) => {
        page.drawText(line, { x: 50, y: A4[1] - 100 - i * 16, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
      });
    };

    const results = [];
    for (const doc of docs) {
      const fullPath = path.join(uploadsDir, path.basename(doc.file_path));
      const ext = path.extname(fullPath).toLowerCase();
      const startPage = out.getPageCount() + 2; // +1 sampul, +1 nomor halaman berbasis 1
      try {
        if (!fs.existsSync(fullPath)) throw new Error('file tidak ditemukan di server');
        const bytes = fs.readFileSync(fullPath);
        if (ext === '.pdf') {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p) => out.addPage(p));
        } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
          const img = ext === '.png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
          const page = out.addPage(A4);
          page.drawText(pdfText(doc.title), { x: 40, y: A4[1] - 40, size: 11, font: bold });
          const maxW = A4[0] - 80;
          const maxH = A4[1] - 100;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: (A4[0] - w) / 2, y: A4[1] - 60 - h, width: w, height: h });
        } else {
          throw new Error(`format ${ext || 'tanpa ekstensi'} tidak dapat digabung`);
        }
        results.push({ ...doc, ok: true, page: startPage });
      } catch (err) {
        notePage(doc.title, `Berkas "${doc.file_name || path.basename(doc.file_path)}" tidak dapat digabung (${err.message}). Unduh berkas aslinya secara terpisah dari sistem.`);
        results.push({ ...doc, ok: false, page: startPage });
      }
    }

    // Halaman sampul + daftar isi di depan
    const cover = out.insertPage(0, A4);
    let y = A4[1] - 70;
    cover.drawText('GABUNGAN BERKAS PERSYARATAN', { x: 50, y, size: 16, font: bold });
    y -= 22;
    cover.drawText('IKAPI Pengurus Daerah Jawa Barat', { x: 50, y, size: 11, font, color: rgb(0.03, 0.52, 0.77) });
    y -= 34;
    const info = [
      ['Penerbit', sub.publisher_name || sub.applicant_name],
      ['Jenis pengajuan', sub.submission_type === 'Heregistrasi' ? 'Heregistrasi' : 'Anggota Baru'],
      ['Kategori', sub.category || '-'],
      ['No. surat pengantar', sub.reference_number || '-'],
      ['No. pengajuan', `#${sub.id}`],
      ['Dibuat', nowSql()]
    ];
    for (const [label, value] of info) {
      cover.drawText(pdfText(label), { x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      cover.drawText(pdfText(value), { x: 190, y, size: 10, font: bold });
      y -= 16;
    }
    y -= 18;
    cover.drawText('Daftar berkas', { x: 50, y, size: 12, font: bold });
    y -= 20;
    results.forEach((r, i) => {
      const label = `${i + 1}. ${r.title}`;
      cover.drawText(pdfText(label).slice(0, 80), { x: 50, y, size: 10, font });
      cover.drawText(r.ok ? `hlm. ${r.page}` : 'tidak tergabung', {
        x: 470, y, size: 10, font, color: r.ok ? rgb(0, 0, 0) : rgb(0.75, 0.2, 0.2)
      });
      y -= 16;
    });

    const bytes = await out.save();
    const safeName = pdfText(sub.publisher_name || `Pengajuan_${sub.id}`).replace(/[^A-Za-z0-9_-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Gabungan_Berkas_${safeName}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error('Merge documents error:', err);
    res.status(500).json({ error: 'Gagal membuat gabungan berkas.' });
  }
});

// ==========================================
// FILE UNGGAHAN (dilindungi)
// ==========================================
// Browser membuka file lewat <a href>/<img>/<iframe> yang tidak bisa mengirim header,
// jadi sesi juga dibaca dari cookie httpOnly. Anggota hanya boleh membuka file miliknya;
// Admin/Sekretaris/Ketua boleh membuka semua file pengajuan.
app.get('/uploads/:filename', async (req, res) => {
  let user;
  try {
    user = await tokenUser(req);
  } catch {
    return res.status(500).json({ error: 'Gagal memeriksa sesi login.' });
  }
  if (!user) return res.status(401).json({ error: 'Sesi login telah kedaluwarsa atau tidak valid.' });

  const filename = path.basename(req.params.filename);
  const fullPath = path.join(uploadsDir, filename);
  if (!fullPath.startsWith(uploadsDir + path.sep) || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File tidak ditemukan.' });
  }

  try {
    if (user.role === 'Anggota') {
      const publicPath = `/uploads/${filename}`;
      const owned = await query.get(
        `SELECT 1 FROM documents d JOIN submissions s ON s.id = d.submission_id
           WHERE d.file_path = ? AND s.user_id = ?
         UNION
         SELECT 1 FROM payments p JOIN submissions s ON s.id = p.submission_id
           WHERE p.proof_file = ? AND s.user_id = ?
         LIMIT 1`,
        [publicPath, user.id, publicPath, user.id]
      );
      if (!owned) return res.status(404).json({ error: 'File tidak ditemukan.' });
    } else if (!ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Akses ditolak.' });
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.sendFile(fullPath);
  } catch (err) {
    console.error('Serve upload error:', err);
    res.status(500).json({ error: 'Gagal membuka file.' });
  }
});

// Error dari multer (ukuran / tipe file) dikembalikan sebagai JSON 400
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.code === 'INVALID_FILE_TYPE') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 15MB.' : err.message;
    return res.status(400).json({ error: msg });
  }
  next(err);
});

// Serve built frontend if exists
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Initialize DB and start server
async function startServer() {
  await initDb();
  await runSeed();
  await migrateFlowV2();
  await syncUnpaidBills();
  await activateApprovedSubmissions();
  app.listen(PORT, () => {
    console.log(`IKAPI Jabar Server running on port ${PORT}`);
  });
}

startServer();
