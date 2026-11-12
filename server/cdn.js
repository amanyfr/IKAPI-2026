// Klien CDN Kroombox (Bridge API). Dipakai untuk menyimpan isi file unggahan di CDN, bukan di MySQL.
// Aktif bila CDN_API_KEY diisi di .env. Bila kosong, file tetap disimpan di tabel `files` (MySQL).
//
// Keamanan: file unggahan berisi dokumen pribadi. ID aset CDN tidak pernah dikirim ke browser;
// browser tetap membuka /uploads/<nama> di server ini (cek login & hak akses), lalu server
// mengambil isi file dari CDN memakai signed URL berumur pendek.

const env = () => ({
  url: String(process.env.CDN_URL || 'https://cdn.kroombox.com').replace(/\/+$/, ''),
  key: String(process.env.CDN_API_KEY || ''),
  folder: String(process.env.CDN_FOLDER_ID || ''),
});

export const cdnEnabled = () => Boolean(env().key);

const TIMEOUT_MS = 60 * 1000;

async function call(method, pathName, { body, headers = {}, raw = false } = {}) {
  const { url, key } = env();
  const res = await fetch(url + pathName, {
    method,
    headers: { 'x-api-key': key, ...headers },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (raw) return res;
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) }; }
  if (!res.ok) {
    const err = new Error(`CDN ${method} ${pathName.split('?')[0]} gagal (${res.status}): ${data.error || data.message || 'tanpa keterangan'}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Tunggu proses unggah di CDN selesai (stream SSE /api/bridge/status/:id).
// Bila CDN melaporkan gagal -> error. Bila stream tidak memberi kepastian dalam batas waktu, dianggap berhasil.
async function waitReady(id, timeoutMs = 30 * 1000) {
  const { url, key } = env();
  let res;
  try {
    res = await fetch(`${url}/api/bridge/status/${encodeURIComponent(id)}`, {
      headers: { 'x-api-key': key, Accept: 'text/event-stream' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return;
  }
  if (!res.ok || !res.body) return;
  const decoder = new TextDecoder();
  let buf = '';
  let eventName = '';
  // Status bisa dikirim sebagai nama event SSE ("event: ready") atau field di data ({"status":"ready"})
  const check = (status, ev = {}) => {
    const s = String(status || '').toLowerCase();
    if (s === 'ready') return true;
    if (s === 'failed' || s === 'error') throw new Error(`CDN gagal memproses file: ${ev.error || ev.message || 'tanpa keterangan'}`);
    return false;
  };
  try {
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) { eventName = ''; continue; }
        const e = line.match(/^event:\s*(.*)$/);
        if (e) { eventName = e[1].trim(); if (check(eventName)) return; continue; }
        const m = line.match(/^data:\s*(.*)$/);
        if (!m) continue;
        let ev;
        try { ev = JSON.parse(m[1]); } catch { ev = { status: m[1].trim() }; }
        if (check(ev.status || ev.event || ev.type || eventName, ev)) return;
      }
    }
  } catch (err) {
    if (/CDN gagal/.test(err.message)) throw err;
  } finally {
    try { await res.body?.cancel(); } catch { /* sudah tertutup */ }
  }
}

// Unggah isi file; kembalikan id aset CDN.
export async function cdnUpload(buffer, fileName, mimeType) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), fileName);
  form.append('fileName', fileName);
  form.append('mimeType', mimeType);
  const { folder } = env();
  if (folder) form.append('parentId', folder);
  const data = await call('POST', '/api/bridge/upload', { body: form });
  const id = data.fileId || data.id;
  if (!id) throw new Error('CDN tidak mengembalikan id file.');
  await waitReady(id);
  return String(id);
}

// Ambil isi file dari CDN lewat signed URL berumur 60 detik.
export async function cdnDownload(id) {
  const { url } = env();
  let lastErr;
  // Unggahan baru bisa masih diproses CDN; coba ulang sebentar.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const signed = await call('POST', `/api/bridge/sign/${encodeURIComponent(id)}`, {
        body: JSON.stringify({ expiresIn: 60 }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!signed.url) throw new Error('CDN tidak mengembalikan signed URL.');
      const target = /^https?:\/\//i.test(signed.url) ? signed.url : url + signed.url;
      const res = await fetch(target, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        const err = new Error(`CDN view gagal (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (err.status && ![404, 409, 425, 429, 502, 503, 504].includes(err.status)) break;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Hapus aset di CDN. Aset yang sudah tidak ada dianggap terhapus.
export async function cdnDelete(id) {
  try {
    await call('DELETE', `/api/bridge/files/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
}
