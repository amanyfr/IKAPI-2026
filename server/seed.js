import bcryptjs from 'bcryptjs';
import { query, initDb, closeDb } from "./db.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper to convert month number to Roman numeral
export function toRoman(num) {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return roman[num - 1] || 'I';
}

// Generate letter reference: {urut}/PD-Ikapi Jabar/{bulan_romawi}/{tahun}
export function formatSuratNumber(sequence, date = new Date()) {
  const padSeq = String(sequence).padStart(3, '0');
  const romanMonth = toRoman(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${padSeq}/PD-Ikapi Jabar/${romanMonth}/${year}`;
}

export async function runSeed() {
  await initDb();
  console.log('Database initialized. Seeding default data...');

  // 1. Seed Settings: hanya mengisi kunci yang belum ada. Nilai yang sudah diubah Admin
  //    (biaya, rekening, nomor surat, kontak) tidak ditimpa saat server dijalankan ulang.
  const defaultSettings = [
    { key: 'bank_name', value: 'Bank BNI', description: 'Nama Bank Resmi IKAPI Jabar' },
    { key: 'bank_account', value: '2089992087', description: 'Nomor Rekening Resmi' },
    { key: 'bank_holder', value: 'Abdul Rasyid', description: 'Nama Pemilik Rekening' },
    { key: 'fee_uang_pangkal', value: '250000', description: 'Uang Pangkal Anggota Baru' },
    { key: 'fee_iuran_bulanan', value: '50000', description: 'Iuran Bulanan Anggota' },
    { key: 'fee_iuran_durasi_bulan', value: '24', description: 'Durasi Iuran Wajib Dibayar di Muka (Bulan)' },
    { key: 'fee_administrasi', value: '250000', description: 'Biaya Administrasi & Verifikasi Lapangan' },
    { key: 'fee_heregistrasi_iuran', value: '1200000', description: 'Biaya Iuran 24 Bulan Heregistrasi' },
    { key: 'ketua_nama', value: 'Dr. H. Mahpudi, M.T.', description: 'Nama Ketua PD IKAPI Jawa Barat' },
    { key: 'ketua_jabatan', value: 'Ketua Pengurus Daerah IKAPI Jawa Barat', description: 'Jabatan Ketua' },
    { key: 'sekretaris_nama', value: 'Drs. H. Anwar Rosyid, M.Si.', description: 'Nama Sekretaris PD IKAPI Jawa Barat' },
    { key: 'sekretaris_jabatan', value: 'Sekretaris PD IKAPI Jawa Barat', description: 'Jabatan Sekretaris' },
    { key: 'surat_counter', value: '14', description: 'Nomor Urut Surat Terakhir' },
    { key: 'office_address', value: 'Jl. Ibu Inggit Garnasih No. 148, Ciateul, Kec. Regol, Kota Bandung, Jawa Barat 40252', description: 'Alamat Sekretariat IKAPI Jabar' },
    { key: 'office_phone', value: '(022) 5202684 / 0812-2345-6789', description: 'Telepon Sekretariat' },
    { key: 'office_email', value: 'sekretariat@ikapi-jabar.or.id', description: 'Email Resmi PD IKAPI Jabar' },
    { key: 'office_website', value: 'https://ikapi-jabar.or.id', description: 'Website Resmi' },
    { key: 'admin_whatsapp', value: '0812-2345-6789', description: 'Nomor WhatsApp Admin (bantuan & lupa kata sandi)' }
  ];

  for (const s of defaultSettings) {
    await query.run(
      `INSERT INTO settings (settings.key, value, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [s.key, s.value, s.description]
    );
  }

  // 2. Check if users exist
  const existingUsers = await query.all('SELECT * FROM users');
  if (existingUsers.length > 0) {
    console.log(`Database already has ${existingUsers.length} users. Skipping user & demo seeding.`);
    await ensureAdminAccount();
    return;
  }

  const salt = await bcryptjs.genSalt(10);
  const hashedPassword = await bcryptjs.hash('password123', salt);

  // Users to create:
  // Sekretaris, Ketua, Anggota 1 (Mizan), Anggota 2 (Unpad), Anggota 3 (Baru), Anggota 4 (Heregistrasi)
  const users = [
    {
      name: 'Administrator Sistem IKAPI Jabar',
      email: 'admin@ikapi-jabar.or.id',
      password: hashedPassword,
      role: 'Admin',
      phone: '081234567890',
      email_verified_at: '2026-01-10 08:00:00'
    },
    {
      name: 'Drs. H. Anwar Rosyid, M.Si. (Sekretaris)',
      email: 'sekretaris@ikapi-jabar.or.id',
      password: hashedPassword,
      role: 'Sekretaris',
      phone: '081234567891',
      email_verified_at: '2026-01-10 08:00:00'
    },
    {
      name: 'Dr. H. Mahpudi, M.T. (Ketua)',
      email: 'ketua@ikapi-jabar.or.id',
      password: hashedPassword,
      role: 'Ketua',
      phone: '081234567892',
      email_verified_at: '2026-01-10 08:00:00'
    },
    {
      name: 'Haidar Bagir (PT Mizan Pustaka)',
      email: 'mizan@penerbit.id',
      password: hashedPassword,
      role: 'Anggota',
      phone: '081122334455',
      email_verified_at: '2026-01-15 09:30:00'
    },
    {
      name: 'Prof. Dr. Ir. H. Asep Kuswandi (Unpad Press)',
      email: 'press@unpad.ac.id',
      password: hashedPassword,
      role: 'Anggota',
      phone: '081333445566',
      email_verified_at: '2026-02-01 10:15:00'
    },
    {
      name: 'Ahmad Faisal (CV Pustaka Mandiri Bandung)',
      email: 'pustakamandiri@gmail.com',
      password: hashedPassword,
      role: 'Anggota',
      phone: '081555667788',
      email_verified_at: '2026-02-15 11:20:00'
    },
    {
      name: 'Dra. Hj. Nurul Hidayah (PT Nuansa Cendekia)',
      email: 'redaksi@nuansacendekia.com',
      password: hashedPassword,
      role: 'Anggota',
      phone: '081777889900',
      email_verified_at: '2026-02-20 14:00:00'
    }
  ];

  const userIds = {};
  for (const u of users) {
    const res = await query.run(
      `INSERT INTO users (name, email, password, role, phone, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [u.name, u.email, u.password, u.role, u.phone, u.email_verified_at]
    );
    userIds[u.email] = res.lastID;
  }

  // 3. Create Sample Members
  // Member 1: PT Mizan Pustaka (Status: Aktif, No KTA: 008/JBR/2024)
  const m1 = await query.run(
    `INSERT INTO members (
      user_id, publisher_name, category, leader_name, leader_title, leader_phone,
      legal_entity, nib, npwp, address, city, postal_code, phone, fax, email, website,
      person_in_charge, bnsp_certificate_no, specialization, kta_number, membership_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userIds['mizan@penerbit.id'],
      'PT Mizan Pustaka',
      'Biasa',
      'Haidar Bagir',
      'Direktur Utama',
      '081122334455',
      'Perseroan Terbatas (PT)',
      '9120301928371',
      '01.234.567.8-428.000',
      'Jl. Cinambo No. 135, Cisaranten Wetan, Cinambo',
      'Kota Bandung',
      '40294',
      '022-7834310',
      '022-7834311',
      'mizan@penerbit.id',
      'https://mizan.com',
      'Irwan Kurniawan, M.Hum',
      'BNSP-EDT-2024-00912',
      'Agama, Sastra, Filsafat, Anak & Remaja, Sains Populer',
      '008/JBR/2024',
      'Aktif'
    ]
  );

  // Member 2: Unpad Press (Status: Calon, menunggu approval)
  const m2 = await query.run(
    `INSERT INTO members (
      user_id, publisher_name, category, leader_name, leader_title, leader_phone,
      legal_entity, nib, npwp, address, city, postal_code, phone, fax, email, website,
      person_in_charge, bnsp_certificate_no, specialization, kta_number, membership_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userIds['press@unpad.ac.id'],
      'Universitas Padjadjaran (Unpad Press)',
      'Luar Biasa',
      'Prof. Dr. Ir. H. Asep Kuswandi, M.Sc.',
      'Kepala Badan Penerbitan Unpad Press',
      '081333445566',
      'Perguruan Tinggi Negeri (PTN-BH)',
      '0220108920112',
      '00.123.456.7-429.000',
      'Gedung Rektorat Lt. 2, Kampus Jatinangor, Jl. Raya Bandung-Sumedang Km. 21',
      'Kabupaten Sumedang',
      '45363',
      '022-84288828',
      '022-84288829',
      'press@unpad.ac.id',
      'https://press.unpad.ac.id',
      'Dr. Nina Herlina, Dra., M.S.',
      'BNSP-EDT-2025-01452',
      'Buku Teks Akademik, Jurnal Ilmiah, Monograf, Perguruan Tinggi',
      null,
      'Calon'
    ]
  );

  // Member 3: CV Pustaka Mandiri Bandung (Menunggu Verifikasi)
  const m3 = await query.run(
    `INSERT INTO members (
      user_id, publisher_name, category, leader_name, leader_title, leader_phone,
      legal_entity, nib, npwp, address, city, postal_code, phone, fax, email, website,
      person_in_charge, bnsp_certificate_no, specialization, kta_number, membership_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userIds['pustakamandiri@gmail.com'],
      'CV Pustaka Mandiri Bandung',
      'Biasa',
      'Ahmad Faisal, S.Pd.',
      'Direktur',
      '081555667788',
      'Commanditaire Vennootschap (CV)',
      '1234567890123',
      '02.345.678.9-421.000',
      'Jl. Cikutra Barat No. 88, Sukaluyu, Cibeunying Kaler',
      'Kota Bandung',
      '40123',
      '022-2501234',
      '-',
      'pustakamandiri@gmail.com',
      'https://pustakamandiri.id',
      'Deden Sudrajat',
      'BNSP-EDT-2025-03211',
      'Buku Pelajaran Sekolah (SD, SMP, SMA), Kamus, Ensiklopedia',
      null,
      'Calon'
    ]
  );

  // Member 4: PT Nuansa Cendekia (Perlu Revisi)
  const m4 = await query.run(
    `INSERT INTO members (
      user_id, publisher_name, category, leader_name, leader_title, leader_phone,
      legal_entity, nib, npwp, address, city, postal_code, phone, fax, email, website,
      person_in_charge, bnsp_certificate_no, specialization, kta_number, membership_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userIds['redaksi@nuansacendekia.com'],
      'PT Nuansa Cendekia',
      'Biasa',
      'Dra. Hj. Nurul Hidayah',
      'Direktur Utama',
      '081777889900',
      'Perseroan Terbatas (PT)',
      '9876543210987',
      '03.456.789.0-422.000',
      'Kompleks Sukup Baru No. 23, Ujungberung',
      'Kota Bandung',
      '40611',
      '022-7812345',
      '-',
      'redaksi@nuansacendekia.com',
      'https://nuansacendekia.com',
      'M. Ridwan',
      'BNSP-EDT-2023-00120',
      'Ilmu Sosial, Pendidikan Guru, Metodologi Penelitian, Referensi',
      null,
      'Calon'
    ]
  );

  // 4. Create Sample Submissions across diverse statuses
  // Submission A: PT Mizan Pustaka - Status: Aktif (Heregistrasi Selesai)
  const subA = await query.run(
    `INSERT INTO submissions (
      member_id, user_id, submission_type, status, old_kta_number,
      reference_number, letter_date, signed_by_chairman, signed_by_secretary,
      chairman_signature_date, secretary_signature_date,
      submitted_at, approved_at, sent_to_central_at, activated_at,
      form_data, admin_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m1.lastID,
      userIds['mizan@penerbit.id'],
      'Heregistrasi',
      'Aktif',
      '008/JBR/2022',
      '010/PD-Ikapi Jabar/II/2026',
      '2026-02-12',
      'Dr. H. Mahpudi, M.T.',
      'Drs. H. Anwar Rosyid, M.Si.',
      '2026-02-14 10:00:00',
      '2026-02-14 11:30:00',
      '2026-02-02 09:00:00',
      '2026-02-14 11:30:00',
      '2026-02-16 08:30:00',
      '2026-02-25 15:00:00',
      JSON.stringify({
        publisherName: 'PT Mizan Pustaka',
        category: 'Biasa',
        submissionType: 'Heregistrasi',
        oldKtaNumber: '008/JBR/2022',
        leaderName: 'Haidar Bagir',
        leaderTitle: 'Direktur Utama',
        phone: '022-7834310',
        email: 'mizan@penerbit.id',
        city: 'Kota Bandung'
      }),
      'Berkas lengkap dan valid. KTA Baru telah diterbitkan Pusat.'
    ]
  );

  // Submission B: Unpad Press - Status: Menunggu Approval (Anggota Luar Biasa)
  const subB = await query.run(
    `INSERT INTO submissions (
      member_id, user_id, submission_type, status, old_kta_number,
      reference_number, letter_date,
      submitted_at, form_data, admin_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m2.lastID,
      userIds['press@unpad.ac.id'],
      'Baru',
      'Menunggu Approval',
      null,
      '012/PD-Ikapi Jabar/IV/2026',
      '2026-03-01',
      '2026-02-10 14:20:00',
      JSON.stringify({
        publisherName: 'Universitas Padjadjaran (Unpad Press)',
        category: 'Luar Biasa',
        submissionType: 'Baru',
        leaderName: 'Prof. Dr. Ir. H. Asep Kuswandi, M.Sc.',
        leaderTitle: 'Kepala Badan Penerbitan Unpad Press',
        phone: '022-84288828',
        email: 'press@unpad.ac.id',
        city: 'Kabupaten Sumedang'
      }),
      'Semua berkas persyaratan dan bukti pembayaran terverifikasi valid oleh Sekretaris. Diteruskan ke Ketua untuk persetujuan surat pengantar.'
    ]
  );

  // Submission C: CV Pustaka Mandiri Bandung - Status: Menunggu Verifikasi (Sudah Bayar & Upload Bukti)
  const subC = await query.run(
    `INSERT INTO submissions (
      member_id, user_id, submission_type, status,
      submitted_at, form_data
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      m3.lastID,
      userIds['pustakamandiri@gmail.com'],
      'Baru',
      'Menunggu Verifikasi',
      '2026-02-18 10:10:00',
      JSON.stringify({
        publisherName: 'CV Pustaka Mandiri Bandung',
        category: 'Biasa',
        submissionType: 'Baru',
        leaderName: 'Ahmad Faisal, S.Pd.',
        leaderTitle: 'Direktur',
        phone: '022-2501234',
        email: 'pustakamandiri@gmail.com',
        city: 'Kota Bandung'
      })
    ]
  );

  // Submission D: PT Nuansa Cendekia - Status: Perlu Revisi
  const subD = await query.run(
    `INSERT INTO submissions (
      member_id, user_id, submission_type, status,
      submitted_at, form_data, admin_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      m4.lastID,
      userIds['redaksi@nuansacendekia.com'],
      'Baru',
      'Perlu Revisi',
      '2026-02-16 11:00:00',
      JSON.stringify({
        publisherName: 'PT Nuansa Cendekia',
        category: 'Biasa',
        submissionType: 'Baru',
        leaderName: 'Dra. Hj. Nurul Hidayah',
        leaderTitle: 'Direktur Utama',
        phone: '022-7812345',
        email: 'redaksi@nuansacendekia.com',
        city: 'Kota Bandung'
      }),
      'Catatan Verifikasi Sekretaris: Scan Sertifikat BNSP Penanggung Jawab Redaksi terpotong pada nomor registrasi. Mohon unggah ulang dengan scan yang lebih jelas.'
    ]
  );

  // 5. Seed Documents for Submissions
  // Documents for Unpad Press (subB - All Sesuai)
  const docsUnpad = [
    { type: 'sk_pembentukan', title: 'SK Pembentukan Lembaga Penerbitan (University Press)', status: 'Sesuai' },
    { type: 'domisili_press', title: 'Surat Keterangan Domisili Press / Kampus', status: 'Sesuai' },
    { type: 'formulir_pendaftaran', title: 'Formulir Pendaftaran Resmi IKAPI 2026', status: 'Sesuai' },
    { type: 'sertifikat_bnsp', title: 'Sertifikat Kompetensi BNSP Editor / Penerbitan', status: 'Sesuai' },
    { type: 'bukti_transfer', title: 'Bukti Transfer Pembayaran Iuran & Pangkal', status: 'Sesuai' }
  ];

  for (const doc of docsUnpad) {
    await query.run(
      `INSERT INTO documents (
        submission_id, document_type, document_title, file_path, file_name, file_size, mime_type, screening_status, verified_by, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        subB.lastID,
        doc.type,
        doc.title,
        `/uploads/sample_${doc.type}.pdf`,
        `Dokumen_${doc.type}_Unpad_Press.pdf`,
        245000,
        'application/pdf',
        doc.status,
        userIds['sekretaris@ikapi-jabar.or.id']
      ]
    );
  }

  // Documents for Pustaka Mandiri (subC - Menunggu Screening)
  const docsMandiri = [
    { type: 'akta_pendirian', title: 'Akta Notaris Pendirian & SK Kemenkumham CV', status: 'Menunggu' },
    { type: 'nib_npwp', title: 'Nomor Induk Berusaha (NIB) & NPWP Perusahaan', status: 'Menunggu' },
    { type: 'formulir_pendaftaran', title: 'Formulir Pendaftaran Resmi IKAPI 2026', status: 'Menunggu' },
    { type: 'sertifikat_bnsp', title: 'Sertifikat BNSP Penerbitan / Editor', status: 'Menunggu' },
    { type: 'bukti_transfer', title: 'Bukti Transfer Tagihan Keanggotaan', status: 'Menunggu' }
  ];

  for (const doc of docsMandiri) {
    await query.run(
      `INSERT INTO documents (
        submission_id, document_type, document_title, file_path, file_name, file_size, mime_type, screening_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subC.lastID,
        doc.type,
        doc.title,
        `/uploads/sample_${doc.type}.pdf`,
        `Dokumen_${doc.type}_Mandiri.pdf`,
        312000,
        'application/pdf',
        doc.status
      ]
    );
  }

  // Documents for Nuansa Cendekia (subD - One is Perlu Revisi)
  const docsNuansa = [
    { type: 'akta_pendirian', title: 'Akta Notaris & SK Kemenkumham', status: 'Sesuai', notes: 'Valid' },
    { type: 'nib_npwp', title: 'NIB & NPWP Perusahaan', status: 'Sesuai', notes: 'Valid' },
    { type: 'formulir_pendaftaran', title: 'Formulir Pendaftaran Resmi IKAPI 2026', status: 'Sesuai', notes: 'Valid' },
    { type: 'sertifikat_bnsp', title: 'Sertifikat BNSP Penerbitan / Editor', status: 'Perlu Revisi', notes: 'Hasil scan buram dan nomor registrasi terpotong. Mohon unggah ulang dengan jelas.' },
    { type: 'bukti_transfer', title: 'Bukti Transfer Pembayaran', status: 'Sesuai', notes: 'Sesuai nominal Rp 1.700.000' }
  ];

  for (const doc of docsNuansa) {
    await query.run(
      `INSERT INTO documents (
        submission_id, document_type, document_title, file_path, file_name, file_size, mime_type, screening_status, revision_notes, verified_by, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        subD.lastID,
        doc.type,
        doc.title,
        `/uploads/sample_${doc.type}.pdf`,
        `Dokumen_${doc.type}_Nuansa.pdf`,
        420000,
        'application/pdf',
        doc.status,
        doc.notes || null,
        userIds['sekretaris@ikapi-jabar.or.id']
      ]
    );
  }

  // 6. Seed Payments
  // Payment for subB (Unpad Press - Rp 1.700.000 - Valid)
  await query.run(
    `INSERT INTO payments (
      submission_id, amount, fee_breakdown, proof_file, proof_filename,
      sender_bank, sender_account_name, sender_account_number, transfer_date,
      verification_status, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      subB.lastID,
      1700000,
      JSON.stringify({
        uangPangkal: 250000,
        iuran24Bulan: 1200000,
        administrasi: 250000,
        total: 1700000
      }),
      '/uploads/sample_transfer_unpad.jpg',
      'Transfer_UnpadPress_1700K.jpg',
      'Bank Mandiri',
      'Badan Penerbitan Unpad Press',
      '131-00-1928371-2',
      '2026-02-11',
      'Valid',
      userIds['sekretaris@ikapi-jabar.or.id']
    ]
  );

  // Payment for subC (Pustaka Mandiri - Rp 1.700.000 - Menunggu)
  await query.run(
    `INSERT INTO payments (
      submission_id, amount, fee_breakdown, proof_file, proof_filename,
      sender_bank, sender_account_name, sender_account_number, transfer_date,
      verification_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      subC.lastID,
      1700000,
      JSON.stringify({
        uangPangkal: 250000,
        iuran24Bulan: 1200000,
        administrasi: 250000,
        total: 1700000
      }),
      '/uploads/sample_transfer_mandiri.jpg',
      'Bukti_Transfer_Pustaka_Mandiri.jpg',
      'Bank BCA',
      'Ahmad Faisal',
      '777-129-3821',
      '2026-02-18',
      'Menunggu'
    ]
  );

  // Payment for subD (Nuansa Cendekia - Rp 1.700.000 - Valid, tapi berkas butuh revisi)
  await query.run(
    `INSERT INTO payments (
      submission_id, amount, fee_breakdown, proof_file, proof_filename,
      sender_bank, sender_account_name, sender_account_number, transfer_date,
      verification_status, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      subD.lastID,
      1700000,
      JSON.stringify({
        uangPangkal: 250000,
        iuran24Bulan: 1200000,
        administrasi: 250000,
        total: 1700000
      }),
      '/uploads/sample_transfer_nuansa.jpg',
      'Transfer_Nuansa_Cendekia.jpg',
      'Bank BNI',
      'PT Nuansa Cendekia',
      '021-988-7712',
      '2026-02-15',
      'Valid',
      userIds['sekretaris@ikapi-jabar.or.id']
    ]
  );

  // Also create a sample placeholder file in uploads if not exist
  const samplePdfPath = path.join(uploadsDir, 'sample_akta_pendirian.pdf');
  if (!fs.existsSync(samplePdfPath)) {
    fs.writeFileSync(samplePdfPath, '%PDF-1.4 Mock IKAPI Document Sample %EOF');
  }

  await query.run(
    `UPDATE users SET
       onboarded_at = NOW(),
       member_type = CASE WHEN EXISTS (
         SELECT 1 FROM submissions s WHERE s.user_id = users.id AND s.submission_type = 'Heregistrasi'
       ) THEN 'Lama' ELSE 'Baru' END,
       member_category = COALESCE((SELECT m.category FROM members m WHERE m.user_id = users.id LIMIT 1), 'Biasa')
     WHERE role = 'Anggota'`
  );

  console.log('Database seeding completed successfully!');
}

// Akun Admin (kelola sistem & akun) untuk database yang dibuat sebelum peran Admin ada
async function ensureAdminAccount() {
  const admin = await query.get("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
  if (admin) return;
  const salt = await bcryptjs.genSalt(10);
  const hashedPassword = await bcryptjs.hash('password123', salt);
  await query.run(
    `INSERT INTO users (name, email, password, role, phone, email_verified_at)
     VALUES (?, ?, ?, 'Admin', ?, NOW())`,
    ['Administrator Sistem IKAPI Jabar', 'admin@ikapi-jabar.or.id', hashedPassword, '081234567890']
  );
  console.log('Akun Admin dibuat: admin@ikapi-jabar.or.id');
}

// Run directly if called as a script
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed()
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}
