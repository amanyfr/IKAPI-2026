// Pindahkan isi file lama dari MySQL (tabel files, kolom data) ke CDN. Jalankan manual di server:
//
//   node server/files-to-cdn.js                 Tahap 1: salin ke CDN + cek ulang isinya. Data MySQL TIDAK dihapus.
//   node server/files-to-cdn.js --hapus-data    Tahap 2: untuk file yang sudah ada di CDN, cek ulang isinya,
//                                               lalu kosongkan kolom data di MySQL.
//   Tambahan: --ids=12,13 untuk memproses id tertentu saja.
//   node server/files-to-cdn.js --cek           Uji koneksi CDN saja (unggah, unduh, hapus 1 file kecil).
//
// Butuh CDN_API_KEY (dan opsional CDN_URL, CDN_FOLDER_ID) di .env. Aman diulang: file yang sudah selesai dilewati.
// Setelah tahap 2, jalankan `OPTIMIZE TABLE files;` di MySQL agar ruang disk benar-benar dilepas.

import crypto from 'crypto';
import { query, initDb, closeDb } from './db.js';
import { cdnEnabled, cdnUpload, cdnDownload, cdnDelete } from './cdn.js';

const args = process.argv.slice(2);
const clearData = args.includes('--hapus-data');
const idsArg = args.find((a) => a.startsWith('--ids='));
const onlyIds = idsArg ? idsArg.slice(6).split(',').map(Number).filter(Boolean) : null;

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function main() {
  if (!cdnEnabled()) {
    console.error('CDN_API_KEY belum diisi di .env. Tidak ada yang diproses.');
    process.exitCode = 1;
    return;
  }
  if (args.includes('--cek')) {
    // Uji koneksi: unggah file kecil, unduh lagi, bandingkan, lalu hapus. Database tidak disentuh.
    const sample = Buffer.from(`cek-cdn-ikapi ${new Date().toISOString()}`);
    const id = await cdnUpload(sample, `cek-koneksi-${Date.now()}.txt`, 'text/plain');
    console.log(`  Unggah OK (id ${id})`);
    const back = await cdnDownload(id);
    console.log(sha(back) === sha(sample) ? '  Unduh OK, isi sama' : '  GAGAL: isi hasil unduhan berbeda');
    await cdnDelete(id);
    console.log('  Hapus OK. Koneksi CDN siap dipakai.');
    return;
  }
  await initDb(); // pastikan kolom files.cdn_id sudah ada
  const filter = onlyIds ? ` AND id IN (${onlyIds.map(() => '?').join(',')})` : '';
  const where = clearData ? 'data IS NOT NULL AND cdn_id IS NOT NULL' : 'data IS NOT NULL AND cdn_id IS NULL';
  const rows = await query.all(`SELECT id, stored_name FROM files WHERE ${where}${filter} ORDER BY id`, onlyIds || []);
  console.log(`${clearData ? 'Tahap 2 (kosongkan data MySQL)' : 'Tahap 1 (salin ke CDN)'}: ${rows.length} file.`);

  let ok = 0;
  let failed = 0;
  for (const { id, stored_name: name } of rows) {
    const row = await query.get('SELECT mime_type, cdn_id, data FROM files WHERE id = ?', [id]);
    if (!row?.data) continue;
    try {
      if (clearData) {
        const remote = await cdnDownload(row.cdn_id);
        if (sha(remote) !== sha(row.data)) throw new Error('isi file di CDN berbeda dengan MySQL; data MySQL tidak dihapus');
        await query.run('UPDATE files SET data = NULL WHERE id = ? AND cdn_id = ?', [id, row.cdn_id]);
      } else {
        const cdnId = await cdnUpload(row.data, name, row.mime_type);
        const remote = await cdnDownload(cdnId);
        if (sha(remote) !== sha(row.data)) {
          await cdnDelete(cdnId).catch(() => {});
          throw new Error('isi file di CDN berbeda setelah diunggah');
        }
        await query.run('UPDATE files SET cdn_id = ? WHERE id = ? AND cdn_id IS NULL', [cdnId, id]);
      }
      ok += 1;
      console.log(`  OK    #${id} ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`  GAGAL #${id} ${name}: ${err.message}`);
    }
  }
  console.log(`Selesai: ${ok} berhasil, ${failed} gagal.`);
  if (!clearData && ok) console.log('Cek beberapa file di aplikasi, lalu jalankan: node server/files-to-cdn.js --hapus-data');
  if (clearData && ok) console.log('Lepas ruang disk MySQL: OPTIMIZE TABLE files;');
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => closeDb());
