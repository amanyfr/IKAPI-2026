import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Muat .env di root proyek (opsional). Variabel yang sudah ada di environment tidak ditimpa.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn('Gagal membaca .env:', err.message);
  }
}

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Default sesuai MySQL bawaan Laragon (root tanpa password di localhost:3306).
export const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ikapi_jabar'
};

if (!/^[A-Za-z0-9_]+$/.test(DB_CONFIG.database)) {
  throw new Error(`Nama database tidak valid: ${DB_CONFIG.database}`);
}

const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  // DATETIME/DATE dikembalikan sebagai string 'YYYY-MM-DD HH:MM:SS' / 'YYYY-MM-DD'
  // (format yang sama seperti versi SQLite, jadi frontend tidak perlu diubah).
  dateStrings: true,
  // SUM()/DECIMAL dikembalikan sebagai number, bukan string.
  decimalNumbers: true,
  multipleStatements: true
});

// Helper database. API sama seperti versi SQLite: run / get / all / exec.
// run() mengembalikan { lastID, changes } agar kode lama tetap jalan.
export const query = {
  async run(sql, params = []) {
    const [result] = await pool.query(sql, params);
    return { lastID: result.insertId, changes: result.affectedRows };
  },
  async get(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows[0];
  },
  async all(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  async exec(sql) {
    await pool.query(sql);
  }
};

// Waktu lokal dalam format DATETIME MySQL: 'YYYY-MM-DD HH:MM:SS'
export function nowSql(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Alur pengajuan:
// Draf -> Menunggu Verifikasi (Tahap 1: screening dokumen oleh Admin) <-> Perlu Revisi
// -> Menunggu Pembayaran (Tahap 2: bayar & verifikasi bukti transfer oleh Admin)
// -> Menunggu TTD Sekretaris -> Menunggu Approval (TTD Ketua)
// -> Pengiriman Berkas (pemohon cetak & kirim berkas fisik ke IKAPI Jabar)
// -> Berkas Diterima (Admin konfirmasi berkas fisik sampai di sekretariat)
// -> Dikirim ke Pusat (Admin kirim paket ke IKAPI Pusat, menunggu No. KTA)
// -> Aktif (Sekretaris input No. KTA dari Pusat)
// 'Disetujui' hanya untuk data lama.
export const SUBMISSION_STATUSES = [
  'Draf', 'Menunggu Verifikasi', 'Perlu Revisi', 'Menunggu Pembayaran', 'Menunggu TTD Sekretaris',
  'Menunggu Approval', 'Pengiriman Berkas', 'Berkas Diterima', 'Dikirim ke Pusat', 'Ditolak', 'Disetujui', 'Aktif'
];
const STATUS_SQL = SUBMISSION_STATUSES.map((st) => `'${st}'`).join(', ');

// Skema MySQL. Catatan: kolom settings.`key` memakai kata tercadang MySQL; di query
// ditulis sebagai `settings.key` (nama berkualifikasi tidak perlu backtick).
export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Sekretaris', 'Ketua', 'Anggota')),
    phone VARCHAR(50),
    email_verified_at DATETIME NULL,
    member_type VARCHAR(10) NULL CHECK (member_type IN ('Lama', 'Baru')),
    member_category VARCHAR(20) NULL CHECK (member_category IN ('Biasa', 'Luar Biasa')),
    old_kta_number VARCHAR(100),
    onboarded_at DATETIME NULL,
    signature_img MEDIUMTEXT, -- TTD tersimpan (PNG data URL), dipakai berulang oleh Ketua/Sekretaris
    email_verify_token CHAR(64) NULL, -- SHA-256 dari token verifikasi email
    password_reset_token CHAR(64) NULL, -- SHA-256 dari token reset kata sandi
    password_reset_expires DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    publisher_name VARCHAR(255) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('Biasa', 'Luar Biasa')),
    leader_name VARCHAR(255) NOT NULL,
    leader_title VARCHAR(255),
    leader_phone VARCHAR(50),
    legal_entity VARCHAR(100), -- PT, CV, Yayasan, Perguruan Tinggi
    nib VARCHAR(100),
    npwp VARCHAR(100),
    address TEXT NOT NULL,
    city VARCHAR(150) NOT NULL,
    postal_code VARCHAR(20),
    phone VARCHAR(50) NOT NULL,
    fax VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    person_in_charge VARCHAR(255) NOT NULL,
    bnsp_certificate_no VARCHAR(150),
    specialization TEXT,
    kta_number VARCHAR(100),
    membership_status VARCHAR(20) NOT NULL DEFAULT 'Calon' CHECK (membership_status IN ('Calon', 'Aktif', 'Nonaktif')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_members_user (user_id),
    CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE IF NOT EXISTS submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NULL,
    user_id INT NOT NULL,
    submission_type VARCHAR(20) NOT NULL CHECK (submission_type IN ('Baru', 'Heregistrasi')),
    status VARCHAR(40) NOT NULL CHECK (status IN (${STATUS_SQL})),
    old_kta_number VARCHAR(100),
    form_data LONGTEXT, -- JSON lengkap isian formulir
    admin_notes TEXT,
    rejection_reason TEXT,
    reference_number VARCHAR(100), -- Format: 012/PD-Ikapi Jabar/IV/2026
    letter_date DATE NULL,
    signed_by_chairman VARCHAR(255),
    signed_by_secretary VARCHAR(255),
    chairman_signature_date DATETIME NULL,
    secretary_signature_date DATETIME NULL,
    chairman_signature_img MEDIUMTEXT, -- salinan TTD Ketua saat dibubuhkan
    chairman_signature_pos TEXT, -- JSON {x, y, w}
    secretary_signature_img MEDIUMTEXT, -- salinan TTD Sekretaris saat diteruskan ke Ketua
    secretary_signature_pos TEXT,
    signature_positions TEXT, -- JSON { dokumen: { chairman: {x,y,w}, secretary: {x,y,w} } }
    screened_at DATETIME NULL, -- berkas & pembayaran lolos screening
    screened_by_name VARCHAR(255),
    submitted_at DATETIME NULL,
    approved_at DATETIME NULL,
    sent_to_central_at DATETIME NULL,
    activated_at DATETIME NULL,
    physical_status VARCHAR(20) NULL, -- Belum Dikirim | Dikirim | Diterima
    physical_sent_at DATETIME NULL,
    physical_courier VARCHAR(150),
    physical_tracking_no VARCHAR(150),
    physical_notes TEXT,
    physical_received_at DATETIME NULL,
    physical_received_by VARCHAR(255),
    central_courier VARCHAR(150), -- pengiriman paket ke IKAPI Pusat
    central_tracking_no VARCHAR(150),
    central_notes TEXT,
    central_sent_by VARCHAR(255),
    last_notified_status VARCHAR(40) NULL, -- status terakhir yang sudah diemailkan ke pemohon
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_submissions_user (user_id),
    INDEX idx_submissions_member (member_id),
    INDEX idx_submissions_status (status),
    CONSTRAINT fk_submissions_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT fk_submissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE IF NOT EXISTS documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    document_title VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    screening_status VARCHAR(20) NOT NULL DEFAULT 'Menunggu' CHECK (screening_status IN ('Menunggu', 'Sesuai', 'Perlu Revisi')),
    revision_notes TEXT,
    verified_by INT NULL,
    verified_at DATETIME NULL,
    opened_at DATETIME NULL, -- log waktu Admin membuka dokumen saat screening
    opened_by_name VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_documents_sub (submission_id),
    INDEX idx_documents_path (file_path),
    CONSTRAINT fk_documents_sub FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_documents_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL UNIQUE,
    amount INT NOT NULL,
    fee_breakdown TEXT, -- JSON
    proof_file VARCHAR(500),
    proof_filename VARCHAR(255),
    sender_bank VARCHAR(150),
    sender_account_name VARCHAR(255),
    sender_account_number VARCHAR(100),
    transfer_date DATE NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'Menunggu' CHECK (verification_status IN ('Menunggu', 'Valid', 'Perlu Revisi')),
    verification_notes TEXT,
    verified_by INT NULL,
    verified_at DATETIME NULL,
    proof_opened_at DATETIME NULL,
    proof_opened_by_name VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_payments_proof (proof_file),
    CONSTRAINT fk_payments_sub FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_payments_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE IF NOT EXISTS settings (
    \`key\` VARCHAR(100) PRIMARY KEY,
    value MEDIUMTEXT NOT NULL, -- bisa berisi gambar TTD / stempel (data URL)
    description VARCHAR(255)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE IF NOT EXISTS submission_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    actor_id INT NULL,
    actor_name VARCHAR(255),
    actor_role VARCHAR(50),
    action VARCHAR(500) NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_submission_logs_sub (submission_id),
    CONSTRAINT fk_logs_sub FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE IF NOT EXISTS email_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT,
    status VARCHAR(20) NOT NULL, -- sent | failed | skipped (SMTP belum diatur)
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  -- Notifikasi di dalam aplikasi (ikon lonceng), tetap jalan walau email/SMTP belum aktif
  CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    submission_id INT NULL,
    read_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user (user_id, read_at),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// Perubahan skema untuk database yang sudah ada (CREATE TABLE IF NOT EXISTS tidak mengubah tabel lama).
async function columnInfo(table, column) {
  return query.get(
    `SELECT DATA_TYPE AS type FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_CONFIG.database, table, column]
  );
}

async function addColumnIfMissing(table, column, definition) {
  if (await columnInfo(table, column)) return false;
  await query.exec(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
}

// Samakan CHECK constraint kolom submissions.status dengan SUBMISSION_STATUSES (status baru ditambahkan).
async function syncStatusCheck() {
  const checks = await query.all(
    `SELECT cc.CONSTRAINT_NAME AS name, cc.CHECK_CLAUSE AS clause
     FROM information_schema.CHECK_CONSTRAINTS cc
     JOIN information_schema.TABLE_CONSTRAINTS tc
       ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
     WHERE cc.CONSTRAINT_SCHEMA = ? AND tc.TABLE_NAME = 'submissions' AND cc.CHECK_CLAUSE LIKE '%Menunggu Verifikasi%'`,
    [DB_CONFIG.database]
  );
  const upToDate = checks.length === 1 && SUBMISSION_STATUSES.every((s) => checks[0].clause.includes(s));
  if (upToDate) return;
  for (const c of checks) {
    await query.exec(`ALTER TABLE submissions DROP CHECK \`${c.name}\``);
  }
  await query.exec(`ALTER TABLE submissions ADD CONSTRAINT chk_submissions_status CHECK (status IN (${STATUS_SQL}))`);
}

async function upgradeSchema() {
  const settingsValue = await columnInfo('settings', 'value');
  if (settingsValue && settingsValue.type === 'text') {
    await query.exec('ALTER TABLE settings MODIFY value MEDIUMTEXT NOT NULL');
  }
  await addColumnIfMissing('users', 'email_verify_token', 'CHAR(64) NULL AFTER signature_img');
  await addColumnIfMissing('users', 'password_reset_token', 'CHAR(64) NULL AFTER email_verify_token');
  await addColumnIfMissing('users', 'password_reset_expires', 'DATETIME NULL AFTER password_reset_token');
  await addColumnIfMissing('users', 'token_version', 'INT NOT NULL DEFAULT 0 AFTER password_reset_expires');
  await addColumnIfMissing('submissions', 'central_courier', 'VARCHAR(150) NULL AFTER physical_received_by');
  await addColumnIfMissing('submissions', 'central_tracking_no', 'VARCHAR(150) NULL AFTER central_courier');
  await addColumnIfMissing('submissions', 'central_notes', 'TEXT NULL AFTER central_tracking_no');
  await addColumnIfMissing('submissions', 'central_sent_by', 'VARCHAR(255) NULL AFTER central_notes');
  await syncStatusCheck();
  if (await addColumnIfMissing('submissions', 'rejected_at_status', 'VARCHAR(40) NULL AFTER rejection_reason')) {
    // Pengajuan lama yang sudah ditolak: tentukan tahapnya dari riwayat
    await query.exec(
      `UPDATE submissions s SET rejected_at_status = CASE
         WHEN EXISTS (SELECT 1 FROM submission_logs l WHERE l.submission_id = s.id AND l.action LIKE '%ditolak Sekretaris%')
         THEN 'Menunggu TTD Sekretaris' ELSE 'Menunggu Approval' END
       WHERE s.status = 'Ditolak'`
    );
  }
  if (await addColumnIfMissing('submissions', 'last_notified_status', 'VARCHAR(40) NULL AFTER physical_received_by')) {
    // Pengajuan lama dianggap sudah diberi tahu status saat ini (tidak mengirim email susulan)
    await query.exec('UPDATE submissions SET last_notified_status = status');
  }
}

// Buat database (jika belum ada) lalu semua tabel.
export async function initDb() {
  const admin = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password
  });
  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await admin.end();
  }
  await query.exec(SCHEMA_SQL);
  await upgradeSchema();
}

export async function closeDb() {
  await pool.end();
}

export default pool;
