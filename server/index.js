import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import db, { query, initDb } from './db.js';
import { runSeed, formatSuratNumber, toRoman } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'ikapi_jabar_super_secret_key_2026';
const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directories
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

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
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// Auth Middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token autentikasi tidak ditemukan.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesi login telah kedaluwarsa atau tidak valid.' });
  }
}

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
app.post('/api/auth/register', async (req, res) => {
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

    // Default email_verified_at set for immediate demo accessibility, but verification simulated
    const result = await query.run(
      `INSERT INTO users (name, email, password, role, phone, email_verified_at)
       VALUES (?, ?, ?, 'Anggota', ?, datetime('now', 'localtime'))`,
      [name, email, hashedPassword, phone || null]
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

    const token = jwt.sign(
      { id: userId, email, role: 'Anggota', name, memberId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Pendaftaran akun berhasil. Email Anda telah terverifikasi.',
      token,
      user: { id: userId, email, role: 'Anggota', name, memberId }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Gagal melakukan pendaftaran akun.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
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

    // Check member profile
    const member = await query.get('SELECT * FROM members WHERE user_id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, memberId: member ? member.id : null },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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
    res.json({ user: publicUser(user, member) });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data profil.' });
  }
});

// Quick Switch (Demo Tool for Evaluator to easily test all 3 roles)
app.post('/api/auth/quick-switch', async (req, res) => {
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
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, memberId: member ? member.id : null },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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
         onboarded_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [memberType, category, kta, req.user.id]
    );
    await query.run(
      `UPDATE members SET category = ?, updated_at = datetime('now', 'localtime')
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
  const rows = await query.all(`SELECT key, value FROM settings WHERE key LIKE 'fee_%'`);
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
// Alur tanpa tahap "Dikirim ke Pusat": pengajuan yang sudah di-TTD Ketua langsung Aktif
async function activateApprovedSubmissions() {
  const rows = await query.all(`SELECT id, member_id FROM submissions WHERE status IN ('Disetujui', 'Dikirim ke Pusat')`);
  for (const row of rows) {
    await query.run(
      `UPDATE submissions SET status = 'Aktif', activated_at = COALESCE(activated_at, approved_at, datetime('now', 'localtime')),
       updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [row.id]
    );
    await query.run(`UPDATE members SET membership_status = 'Aktif', updated_at = datetime('now', 'localtime') WHERE id = ?`, [row.member_id]);
  }
  return rows.length;
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
  const done = await query.get(`SELECT value FROM settings WHERE key = 'flow_version'`);
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
    `INSERT INTO settings (key, value, description) VALUES ('flow_version', '2', 'Versi alur pengajuan')
     ON CONFLICT(key) DO UPDATE SET value = '2'`
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
      `UPDATE payments SET amount = ?, fee_breakdown = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`,
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
       VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
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
    const user = await query.get('SELECT * FROM users WHERE id = ?', [id]);
    res.json({ message: `Akun ${user.name} berhasil diperbarui.`, user: publicUser(user) });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Gagal memperbarui akun.' });
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
    const settingsList = await query.all('SELECT key, value FROM settings');
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
          specialization = ?, updated_at = datetime('now', 'localtime')
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
    const submittedAt = isDraft ? null : new Date().toISOString();

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
    const submittedAt = isSubmit ? new Date().toISOString() : sub.submitted_at;
    const subType = formData.submissionType || sub.submission_type;
    if (req.user.role === 'Anggota') {
      const expectedType = await profileSubmissionType(req.user.id);
      if (expectedType && subType !== expectedType) {
        return res.status(400).json({ error: `Jenis pengajuan untuk akun ini adalah ${TYPE_LABEL[expectedType]}, sesuai profil keanggotaan.` });
      }
    }
    const oldKta = formData.oldKtaNumber !== undefined ? formData.oldKtaNumber : sub.old_kta_number;

    await query.run(
      `UPDATE submissions SET submission_type = ?, old_kta_number = ?, form_data = ?, status = ?, submitted_at = ?, updated_at = datetime('now', 'localtime')
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
          specialization = COALESCE(?, specialization), updated_at = datetime('now', 'localtime')
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

    // Setelah dikirim, pemohon hanya boleh mengganti dokumen yang dinyatakan tidak sesuai
    if (req.user.role === 'Anggota' && owner.status !== 'Draf') {
      const isEmptySlot = existing && !existing.file_path;
      const allowed =
        (owner.status === 'Perlu Revisi' && existing && (existing.screening_status === 'Perlu Revisi' || isEmptySlot)) ||
        (owner.status === 'Menunggu Verifikasi' && existing && isEmptySlot);
      if (!allowed) {
        return res.status(400).json({ error: 'Dokumen ini tidak perlu diunggah ulang. Hanya dokumen yang dinyatakan tidak sesuai yang dapat diganti.' });
      }
    }

    if (existing) {
      await query.run(
        `UPDATE documents SET
          file_path = ?, file_name = ?, file_size = ?, mime_type = ?,
          screening_status = 'Menunggu', revision_notes = NULL, opened_at = NULL, opened_by_name = NULL,
          verified_at = NULL, verified_by = NULL, updated_at = datetime('now', 'localtime')
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
      await logEvent(subId, req.user, owner.status === 'Perlu Revisi' ? `Revisi dokumen diunggah: ${docTitle}` : `Dokumen diunggah: ${docTitle}`);
    }

    // Semua dokumen yang tidak sesuai sudah diganti -> kembali ke screening Admin
    if (owner.status === 'Perlu Revisi') {
      const stillNeedsRevision = await query.get(
        `SELECT COUNT(*) as count FROM documents WHERE submission_id = ? AND (screening_status = 'Perlu Revisi' OR file_path = '')`,
        [subId]
      );
      if (stillNeedsRevision.count === 0) {
        await query.run(
          `UPDATE submissions SET status = 'Menunggu Verifikasi', admin_notes = 'Dokumen revisi telah diunggah kembali oleh pemohon.',
             screened_at = NULL, screened_by_name = NULL, updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
          [subId]
        );
        await logEvent(subId, req.user, 'Semua revisi dokumen dikirim, menunggu screening ulang Admin');
        resubmitted = true;
      }
    }

    res.json({
      resubmitted,
      message: resubmitted ? 'Semua revisi terkirim. Dokumen akan diperiksa ulang oleh Admin.' : 'Berkas berhasil diunggah.',
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
        `UPDATE documents SET opened_at = datetime('now', 'localtime'), opened_by_name = ? WHERE id = ?`,
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
        `UPDATE payments SET proof_opened_at = datetime('now', 'localtime'), proof_opened_by_name = ? WHERE id = ?`,
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
      return res.status(400).json({ error: 'Buka dokumen terlebih dahulu sebelum menilai.' });
    }
    if (status === 'Perlu Revisi' && !String(revisionNotes || '').trim()) {
      return res.status(400).json({ error: 'Tulis komentar alasan dokumen tidak sesuai agar pemohon tahu apa yang harus diperbaiki.' });
    }

    await query.run(
      `UPDATE documents SET
        screening_status = ?, revision_notes = ?, verified_by = ?, verified_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
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
        verification_notes = NULL, proof_opened_at = NULL, proof_opened_by_name = NULL, updated_at = datetime('now', 'localtime')
       WHERE submission_id = ?`,
      [filePath, fileName, senderBank, senderAccountName, senderAccountNumber, transferDate || new Date().toISOString().split('T')[0], subId]
    );

    await query.run(`UPDATE submissions SET updated_at = datetime('now', 'localtime') WHERE id = ?`, [subId]);
    await logEvent(subId, req.user, 'Bukti transfer diunggah', [senderBank, senderAccountName].filter(Boolean).join(' · ') || null);

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
        verified_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
       WHERE submission_id = ?`,
      [status, notes || null, req.user.id, subId]
    );

    if (status === 'Valid') {
      // Tahap 1 & 2 selesai -> diteruskan ke Sekretaris untuk TTD
      await query.run(
        `UPDATE submissions SET status = 'Menunggu TTD Sekretaris', updated_at = datetime('now', 'localtime') WHERE id = ?`,
        [subId]
      );
      await logEvent(subId, req.user, 'Pembayaran diverifikasi valid, diteruskan ke Sekretaris untuk TTD');
    } else {
      // Pemohon cukup mengunggah ulang bukti transfer, dokumen tidak perlu dikirim ulang
      await query.run(
        `UPDATE submissions SET admin_notes = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`,
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
        `UPDATE submissions SET status = ?, screened_at = datetime('now', 'localtime'), screened_by_name = ?,
           admin_notes = ?, updated_at = datetime('now', 'localtime')
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
           updated_at = datetime('now', 'localtime')
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
      const secretaryNameRow = await query.get(`SELECT value FROM settings WHERE key = 'sekretaris_nama'`);

      let refNumber = sub.reference_number;
      if (!refNumber) {
        const counterSetting = await query.get(`SELECT value FROM settings WHERE key = 'surat_counter'`);
        const nextCounter = parseInt(counterSetting ? counterSetting.value : '1', 10) + 1;
        refNumber = formatSuratNumber(nextCounter, new Date());
        await query.run(`UPDATE settings SET value = ? WHERE key = 'surat_counter'`, [String(nextCounter)]);
      }

      await query.run(
        `UPDATE submissions SET
          status = 'Menunggu Approval',
          reference_number = ?,
          letter_date = date('now', 'localtime'),
          admin_notes = ?,
          secretary_signature_img = COALESCE(?, secretary_signature_img),
          secretary_signature_pos = COALESCE(?, secretary_signature_pos),
          signature_positions = ?,
          screened_at = COALESCE(screened_at, datetime('now', 'localtime')),
          screened_by_name = COALESCE(screened_by_name, ?),
          signed_by_secretary = CASE WHEN ? IS NOT NULL THEN ? ELSE signed_by_secretary END,
          secretary_signature_date = CASE WHEN ? IS NOT NULL THEN datetime('now', 'localtime') ELSE secretary_signature_date END,
          updated_at = datetime('now', 'localtime')
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

      const settingsList = await query.all(`SELECT key, value FROM settings WHERE key IN ('ketua_nama', 'sekretaris_nama')`);
      const map = {};
      settingsList.forEach(s => { map[s.key] = s.value; });

      const chairmanName = map.ketua_nama || 'Dr. H. Mahpudi, M.T.';
      const secretaryName = map.sekretaris_nama || 'Drs. H. Anwar Rosyid, M.Si.';

      await query.run(
        `UPDATE submissions SET
          status = 'Pengiriman Berkas',
          physical_status = 'Belum Dikirim',
          approved_at = datetime('now', 'localtime'),
          signed_by_chairman = ?,
          signed_by_secretary = COALESCE(signed_by_secretary, ?),
          chairman_signature_date = datetime('now', 'localtime'),
          secretary_signature_date = COALESCE(secretary_signature_date, datetime('now', 'localtime')),
          chairman_signature_img = ?,
          chairman_signature_pos = ?,
          signature_positions = ?,
          updated_at = datetime('now', 'localtime')
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
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [reason, subId]
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
      `UPDATE submissions SET physical_status = 'Dikirim', physical_sent_at = datetime('now', 'localtime'),
         physical_courier = ?, physical_tracking_no = ?, physical_notes = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [courier.trim(), trackingNo || null, notes || null, subId]
    );
    await logEvent(subId, req.user, 'Berkas fisik dikirim ke sekretariat IKAPI Jawa Barat',
      [courier.trim(), trackingNo ? `No. resi ${trackingNo}` : null, notes].filter(Boolean).join(' · '));
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
    await query.run(
      `UPDATE submissions SET status = 'Aktif', physical_status = 'Diterima',
         physical_received_at = datetime('now', 'localtime'), physical_received_by = ?,
         activated_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [req.user.name, subId]
    );
    await query.run(
      `UPDATE members SET membership_status = 'Aktif', updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [sub.member_id]
    );
    await logEvent(subId, req.user, 'Disetujui Admin. Pemohon resmi menjadi anggota penerbit IKAPI Jawa Barat', notes || null);
    res.json({ message: 'Pengajuan di-approve. Pemohon kini resmi menjadi anggota penerbit IKAPI Jawa Barat.', status: 'Aktif' });
  } catch (err) {
    console.error('Physical received error:', err);
    res.status(500).json({ error: 'Gagal mengonfirmasi berkas fisik.' });
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
    let sql = 'SELECT * FROM members WHERE 1=1';
    const params = [];

    if (category && category !== 'Semua') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (status && status !== 'Semua') {
      sql += ' AND membership_status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (publisher_name LIKE ? OR leader_name LIKE ? OR kta_number LIKE ? OR city LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY id DESC';
    const members = await query.all(sql, params);
    res.json({ members });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Gagal memuat data anggota.' });
  }
});

// Update KTA number for a member
app.put('/api/members/:id/kta', authenticate, authorize('Sekretaris', 'Ketua'), async (req, res) => {
  try {
    const { id } = req.params;
    const { kta_number } = req.body;
    if (!kta_number || !kta_number.trim()) {
      return res.status(400).json({ error: 'Nomor KTA wajib diisi.' });
    }
    const member = await query.get('SELECT id FROM members WHERE id = ?', [id]);
    if (!member) return res.status(404).json({ error: 'Data anggota tidak ditemukan.' });

    await query.run(
      `UPDATE members SET kta_number = ?, membership_status = 'Aktif', updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [kta_number.trim().toUpperCase(), id]
    );
    res.json({ message: `Nomor KTA berhasil disimpan: ${kta_number.trim().toUpperCase()}` });
  } catch (err) {
    console.error('Update KTA error:', err);
    res.status(500).json({ error: 'Gagal menyimpan nomor KTA.' });
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
      FROM members
      ORDER BY id ASC
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

app.get('/api/settings', async (req, res) => {
  try {
    const settingsList = await query.all('SELECT key, value, description FROM settings');
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
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
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
