import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'ikapi.sqlite');
const db = new sqlite3.Database(dbPath);

// Promisified database helpers
export const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

export async function initDb() {
  await query.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Anggota', 'Admin 1', 'Admin 2')),
      phone TEXT,
      email_verified_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      publisher_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Biasa', 'Luar Biasa')),
      leader_name TEXT NOT NULL,
      leader_title TEXT,
      leader_phone TEXT,
      legal_entity TEXT, -- PT, CV, Yayasan, Perguruan Tinggi
      nib TEXT,
      npwp TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      postal_code TEXT,
      phone TEXT NOT NULL,
      fax TEXT,
      email TEXT NOT NULL,
      website TEXT,
      person_in_charge TEXT NOT NULL,
      bnsp_certificate_no TEXT,
      specialization TEXT, -- JSON or string list
      kta_number TEXT,
      membership_status TEXT NOT NULL DEFAULT 'Calon' CHECK(membership_status IN ('Calon', 'Aktif', 'Nonaktif')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      user_id INTEGER NOT NULL,
      submission_type TEXT NOT NULL CHECK(submission_type IN ('Baru', 'Heregistrasi')),
      status TEXT NOT NULL CHECK(status IN (
        'Draf',
        'Menunggu Pembayaran',
        'Menunggu Verifikasi',
        'Perlu Revisi',
        'Menunggu Approval',
        'Ditolak',
        'Disetujui',
        'Dikirim ke Pusat',
        'Aktif'
      )),
      old_kta_number TEXT,
      form_data TEXT, -- Full JSON payload of form
      admin_notes TEXT,
      rejection_reason TEXT,
      reference_number TEXT, -- Format: 012/PD-Ikapi Jabar/IV/2026
      letter_date TEXT,
      signed_by_chairman TEXT,
      signed_by_secretary TEXT,
      chairman_signature_date TEXT,
      secretary_signature_date TEXT,
      submitted_at TEXT,
      approved_at TEXT,
      sent_to_central_at TEXT,
      activated_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      document_title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      screening_status TEXT NOT NULL DEFAULT 'Menunggu' CHECK(screening_status IN ('Menunggu', 'Sesuai', 'Perlu Revisi')),
      revision_notes TEXT,
      verified_by INTEGER,
      verified_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      fee_breakdown TEXT, -- JSON
      proof_file TEXT,
      proof_filename TEXT,
      sender_bank TEXT,
      sender_account_name TEXT,
      sender_account_number TEXT,
      transfer_date TEXT,
      verification_status TEXT NOT NULL DEFAULT 'Menunggu' CHECK(verification_status IN ('Menunggu', 'Valid', 'Perlu Revisi')),
      verification_notes TEXT,
      verified_by INTEGER,
      verified_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    );
  `);
}

export default db;

