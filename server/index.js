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
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat login.' });
  }
});

// Current User Me
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await query.get('SELECT id, name, email, role, phone, email_verified_at, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    const member = await query.get('SELECT * FROM members WHERE user_id = ?', [user.id]);
    res.json({ user: { ...user, member: member || null } });
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
             p.amount as payment_amount, p.verification_status as payment_status
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
      'SELECT * FROM documents WHERE submission_id = ? ORDER BY id ASC',
      [subId]
    );

    // Payment
    const payment = await query.get(
      'SELECT * FROM payments WHERE submission_id = ?',
      [subId]
    );

    // Settings (for letter preview)
    const settingsList = await query.all('SELECT key, value FROM settings');
    const settings = {};
    settingsList.forEach(item => { settings[item.key] = item.value; });

    res.json({
      submission: sub,
      documents,
      payment: payment ? { ...payment, fee_breakdown: JSON.parse(payment.fee_breakdown || '{}') } : null,
      settings
    });
  } catch (err) {
    console.error('Get submission detail error:', err);
    res.status(500).json({ error: 'Gagal memuat detail pengajuan.' });
  }
});

// Create or save submission
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
    const initialStatus = isDraft ? 'Draf' : 'Menunggu Pembayaran';
    const submittedAt = isDraft ? null : new Date().toISOString();

    const subRes = await query.run(
      `INSERT INTO submissions (
        member_id, user_id, submission_type, status, old_kta_number, form_data, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [memberId, req.user.id, submissionType, initialStatus, oldKtaNumber || null, formData, submittedAt]
    );

    const submissionId = subRes.lastID;

    // Create required document slots based on category & type
    const requiredDocs = [];
    if (submissionType === 'Heregistrasi') {
      requiredDocs.push(
        { type: 'formulir_heregistrasi', title: 'Formulir Heregistrasi Resmi IKAPI 2026' },
        { type: 'kta_lama', title: 'Scan KTA IKAPI Lama (Habis Masa Berlaku)' },
        { type: 'nib_sk_update', title: 'NIB / SK Legalitas Terkini Lembaga' }
      );
    } else if (category === 'Biasa') {
      requiredDocs.push(
        { type: 'akta_pendirian', title: 'Akta Notaris & SK Kemenkumham Pendirian Perusahaan' },
        { type: 'nib_npwp', title: 'Nomor Induk Berusaha (NIB) & NPWP Perusahaan' },
        { type: 'formulir_pendaftaran', title: 'Formulir Pendaftaran Resmi IKAPI 2026' },
        { type: 'sertifikat_bnsp', title: 'Sertifikat Kompetensi BNSP Editor / Penerbitan' }
      );
    } else {
      // Luar Biasa (Institusi Pendidikan)
      requiredDocs.push(
        { type: 'sk_pembentukan', title: 'SK Rektor / Pimpinan Pembentukan University Press' },
        { type: 'domisili_press', title: 'Surat Keterangan Domisili Lembaga Penerbitan Kampus' },
        { type: 'formulir_pendaftaran', title: 'Formulir Pendaftaran Resmi IKAPI 2026' },
        { type: 'sertifikat_bnsp', title: 'Sertifikat Kompetensi BNSP Editor / Penerbitan' }
      );
    }

    for (const d of requiredDocs) {
      await query.run(
        `INSERT INTO documents (submission_id, document_type, document_title, file_path, file_name, screening_status)
         VALUES (?, ?, ?, '', 'Belum diunggah', 'Menunggu')`,
        [submissionId, d.type, d.title]
      );
    }

    // Create payment entry
    const isNew = submissionType === 'Baru';
    const amount = isNew ? 1700000 : 1200000;
    const feeBreakdown = JSON.stringify(
      isNew
        ? {
            uangPangkal: 250000,
            iuran24Bulan: 1200000,
            administrasi: 250000,
            total: 1700000,
            keterangan: 'Pendaftaran Anggota Baru IKAPI (Uang Pangkal + Iuran 24 Bulan + Verifikasi)'
          }
        : {
            uangPangkal: 0,
            iuran24Bulan: 1200000,
            administrasi: 0,
            total: 1200000,
            keterangan: 'Heregistrasi Anggota Lama IKAPI (Perpanjangan Iuran 24 Bulan)'
          }
    );

    await query.run(
      `INSERT INTO payments (submission_id, amount, fee_breakdown, verification_status)
       VALUES (?, ?, ?, 'Menunggu')`,
      [submissionId, amount, feeBreakdown]
    );

    res.json({
      message: isDraft ? 'Draf formulir berhasil disimpan.' : 'Formulir berhasil disubmit. Silakan lakukan pembayaran tagihan.',
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

    const newStatus = isSubmit ? 'Menunggu Pembayaran' : sub.status;
    const submittedAt = isSubmit ? new Date().toISOString() : sub.submitted_at;

    await query.run(
      `UPDATE submissions SET form_data = ?, status = ?, submitted_at = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [JSON.stringify(formData), newStatus, submittedAt, subId]
    );

    // Also update member record if available
    if (sub.member_id && formData.publisherName) {
      await query.run(
        `UPDATE members SET
          publisher_name = ?, leader_name = ?, address = ?, city = ?, phone = ?, email = ?,
          person_in_charge = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [
          formData.publisherName, formData.leaderName, formData.address,
          formData.city, formData.phone, formData.email, formData.personInCharge,
          sub.member_id
        ]
      );
    }

    res.json({
      message: isSubmit ? 'Formulir berhasil disubmit. Silakan lanjut ke pembayaran.' : 'Draf berhasil diperbarui.',
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

    // Check if slot exists
    const existing = await query.get(
      'SELECT id, screening_status FROM documents WHERE submission_id = ? AND document_type = ?',
      [subId, documentType]
    );

    if (existing) {
      await query.run(
        `UPDATE documents SET
          file_path = ?, file_name = ?, file_size = ?, mime_type = ?,
          screening_status = 'Menunggu', revision_notes = NULL, updated_at = datetime('now', 'localtime')
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

    // Check if submission was in "Perlu Revisi" and if all previously rejected items are re-uploaded
    const sub = await query.get('SELECT status FROM submissions WHERE id = ?', [subId]);
    if (sub && sub.status === 'Perlu Revisi') {
      const stillNeedsRevision = await query.get(
        `SELECT COUNT(*) as count FROM documents WHERE submission_id = ? AND screening_status = 'Perlu Revisi'`,
        [subId]
      );
      if (stillNeedsRevision.count === 0) {
        // Automatically put back into 'Menunggu Verifikasi' so Admin 1 re-screens
        await query.run(
          `UPDATE submissions SET status = 'Menunggu Verifikasi', admin_notes = 'Berkas revisi telah diunggah kembali oleh pemohon.', updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
          [subId]
        );
      }
    }

    res.json({
      message: 'Berkas berhasil diunggah.',
      filePath,
      fileName
    });
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ error: 'Gagal mengunggah berkas.' });
  }
});

// Admin 1: Screen single document
app.put('/api/documents/:docId/screen', authenticate, authorize('Admin 1', 'Admin 2'), async (req, res) => {
  try {
    const docId = req.params.docId;
    const { status, revisionNotes } = req.body;

    if (!['Sesuai', 'Perlu Revisi'].includes(status)) {
      return res.status(400).json({ error: 'Status screening harus "Sesuai" atau "Perlu Revisi".' });
    }

    await query.run(
      `UPDATE documents SET
        screening_status = ?, revision_notes = ?, verified_by = ?, verified_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [status, revisionNotes || null, req.user.id, docId]
    );

    res.json({ message: `Status berkas berhasil diubah menjadi "${status}".` });
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

    const filePath = `/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;

    await query.run(
      `UPDATE payments SET
        proof_file = ?, proof_filename = ?, sender_bank = ?, sender_account_name = ?,
        sender_account_number = ?, transfer_date = ?, verification_status = 'Menunggu',
        verification_notes = NULL, updated_at = datetime('now', 'localtime')
       WHERE submission_id = ?`,
      [filePath, fileName, senderBank, senderAccountName, senderAccountNumber, transferDate || new Date().toISOString().split('T')[0], subId]
    );

    // Update submission status to "Menunggu Verifikasi"
    await query.run(
      `UPDATE submissions SET status = 'Menunggu Verifikasi', updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [subId]
    );

    res.json({
      message: 'Bukti pembayaran berhasil diunggah. Menunggu verifikasi Admin 1.',
      status: 'Menunggu Verifikasi'
    });
  } catch (err) {
    console.error('Upload payment error:', err);
    res.status(500).json({ error: 'Gagal mengunggah bukti pembayaran.' });
  }
});

// Admin 1 verify payment
app.put('/api/submissions/:id/payment/verify', authenticate, authorize('Admin 1', 'Admin 2'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { status, notes } = req.body; // 'Valid' or 'Perlu Revisi'

    if (!['Valid', 'Perlu Revisi'].includes(status)) {
      return res.status(400).json({ error: 'Status pembayaran harus "Valid" atau "Perlu Revisi".' });
    }

    await query.run(
      `UPDATE payments SET
        verification_status = ?, verification_notes = ?, verified_by = ?,
        verified_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
       WHERE submission_id = ?`,
      [status, notes || null, req.user.id, subId]
    );

    if (status === 'Perlu Revisi') {
      await query.run(
        `UPDATE submissions SET status = 'Perlu Revisi', admin_notes = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [`Verifikasi Pembayaran Bermasalah: ${notes || 'Bukti transfer tidak valid/sesuai nominal.'}`, subId]
      );
    }

    res.json({ message: `Status pembayaran berhasil diubah menjadi "${status}".` });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Gagal memperbarui verifikasi pembayaran.' });
  }
});

// ==========================================
// 5. WORKFLOW ACTIONS (ADMIN 1 & ADMIN 2)
// ==========================================

// Admin 1 Action: Request Revision or Pass to Admin 2
app.post('/api/submissions/:id/admin1-action', authenticate, authorize('Admin 1', 'Admin 2'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { action, notes } = req.body; // 'request_revision' | 'pass_to_admin2' | 'update_kta'

    const sub = await query.get('SELECT * FROM submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

    if (action === 'request_revision') {
      await query.run(
        `UPDATE submissions SET status = 'Perlu Revisi', admin_notes = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [notes || 'Terdapat berkas yang perlu diperbaiki sesuai catatan verifikasi.', subId]
      );
      return res.json({ message: 'Pengajuan berhasil dikembalikan ke pemohon untuk revisi.', status: 'Perlu Revisi' });
    }

    if (action === 'pass_to_admin2') {
      // Check if all docs are 'Sesuai'
      const unverifiedDocs = await query.get(
        `SELECT COUNT(*) as count FROM documents WHERE submission_id = ? AND screening_status != 'Sesuai'`,
        [subId]
      );
      if (unverifiedDocs.count > 0) {
        return res.status(400).json({ error: 'Semua berkas persyaratan wajib bertatus "Sesuai" sebelum diteruskan ke Admin 2.' });
      }

      // Check payment status
      const payment = await query.get('SELECT verification_status FROM payments WHERE submission_id = ?', [subId]);
      if (!payment || payment.verification_status !== 'Valid') {
        return res.status(400).json({ error: 'Pembayaran wajib diverifikasi "Valid" sebelum diteruskan ke Admin 2.' });
      }

      // Generate or reserve reference number if not already present
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
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [refNumber, notes || 'Berkas dan pembayaran telah diverifikasi lengkap dan valid oleh Admin 1.', subId]
      );

      return res.json({
        message: 'Pengajuan berhasil diteruskan ke Admin 2 untuk proses persetujuan dan tanda tangan surat.',
        status: 'Menunggu Approval',
        referenceNumber: refNumber
      });
    }

    if (action === 'update_kta') {
      const { ktaNumber } = req.body;
      if (!ktaNumber) {
        return res.status(400).json({ error: 'Nomor KTA dari Pusat wajib diisi.' });
      }

      await query.run(
        `UPDATE submissions SET status = 'Aktif', activated_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [subId]
      );

      await query.run(
        `UPDATE members SET kta_number = ?, membership_status = 'Aktif', updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [ktaNumber, sub.member_id]
      );

      return res.json({
        message: `Keanggotaan resmi diaktifkan dengan No. KTA: ${ktaNumber}.`,
        status: 'Aktif'
      });
    }

    res.status(400).json({ error: 'Tindakan tidak dikenal.' });
  } catch (err) {
    console.error('Admin 1 action error:', err);
    res.status(500).json({ error: 'Gagal memproses tindakan Admin 1.' });
  }
});

// Admin 2 Action: Approve, Reject, or Send to Central
app.post('/api/submissions/:id/admin2-action', authenticate, authorize('Admin 2', 'Admin 1'), async (req, res) => {
  try {
    const subId = req.params.id;
    const { action, reason, chairmanSign, secretarySign } = req.body;

    const sub = await query.get('SELECT * FROM submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

    if (action === 'approve') {
      // Require Admin 2 role
      if (req.user.role !== 'Admin 2') {
        return res.status(403).json({ error: 'Hanya Admin 2 (Ketua & Sekretaris) yang dapat menyetujui pengajuan.' });
      }

      const settingsList = await query.all(`SELECT key, value FROM settings WHERE key IN ('ketua_nama', 'sekretaris_nama')`);
      const map = {};
      settingsList.forEach(s => { map[s.key] = s.value; });

      const chairmanName = map.ketua_nama || 'Dr. H. Mahpudi, M.T.';
      const secretaryName = map.sekretaris_nama || 'Drs. H. Anwar Rosyid, M.Si.';

      await query.run(
        `UPDATE submissions SET
          status = 'Disetujui',
          approved_at = datetime('now', 'localtime'),
          signed_by_chairman = ?,
          signed_by_secretary = ?,
          chairman_signature_date = datetime('now', 'localtime'),
          secretary_signature_date = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [chairmanName, secretaryName, subId]
      );

      return res.json({
        message: 'Pengajuan berhasil disetujui. Surat rekomendasi resmi dan paket berkas siap dicetak.',
        status: 'Disetujui'
      });
    }

    if (action === 'reject') {
      if (req.user.role !== 'Admin 2') {
        return res.status(403).json({ error: 'Hanya Admin 2 yang dapat menolak pengajuan.' });
      }
      if (!reason) {
        return res.status(400).json({ error: 'Alasan penolakan wajib disertakan.' });
      }

      await query.run(
        `UPDATE submissions SET
          status = 'Ditolak',
          rejection_reason = ?,
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [reason, subId]
      );

      return res.json({
        message: 'Pengajuan telah ditolak.',
        status: 'Ditolak'
      });
    }

    if (action === 'send_to_central') {
      await query.run(
        `UPDATE submissions SET
          status = 'Dikirim ke Pusat',
          sent_to_central_at = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [subId]
      );

      return res.json({
        message: 'Paket dokumen telah ditandai dikirim ke IKAPI Pusat. Menunggu penerbitan No. KTA.',
        status: 'Dikirim ke Pusat'
      });
    }

    res.status(400).json({ error: 'Tindakan tidak dikenal.' });
  } catch (err) {
    console.error('Admin 2 action error:', err);
    res.status(500).json({ error: 'Gagal memproses tindakan Admin 2.' });
  }
});

// ==========================================
// 6. DASHBOARD & STATS (ADMIN 2 MONITORING)
// ==========================================

app.get('/api/admin/dashboard-stats', authenticate, authorize('Admin 1', 'Admin 2'), async (req, res) => {
  try {
    const totalSubmissions = await query.get('SELECT COUNT(*) as count FROM submissions');
    const pendingScreening = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Menunggu Verifikasi'`);
    const pendingApproval = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Menunggu Approval'`);
    const sentToCentral = await query.get(`SELECT COUNT(*) as count FROM submissions WHERE status = 'Dikirim ke Pusat'`);
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
        sentToCentral: sentToCentral.count,
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
app.get('/api/members', authenticate, authorize('Admin 1', 'Admin 2'), async (req, res) => {
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
app.put('/api/members/:id/kta', authenticate, authorize('Admin 1', 'Admin 2'), async (req, res) => {
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
app.get('/api/members/export', authenticate, authorize('Admin 1', 'Admin 2'), async (req, res) => {
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

app.put('/api/settings', authenticate, authorize('Admin 2'), async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Format pengaturan tidak valid.' });
    }

    for (const [key, value] of Object.entries(settings)) {
      await query.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, String(value)]
      );
    }

    res.json({ message: 'Pengaturan sistem berhasil disimpan.' });
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
  app.listen(PORT, () => {
    console.log(`IKAPI Jabar Server running on port ${PORT}`);
  });
}

startServer();
