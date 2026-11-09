// File unggahan (/uploads/...) dan unduhan berkas dilindungi server. Link <a>/<img>/<iframe>
// tidak bisa mengirim header Authorization; server membaca cookie sesi httpOnly yang dipasang
// saat login (dan diperbarui oleh /api/auth/me). Token tidak lagi ditempel di URL.
export function authUrl(url) {
  return url;
}

export function fileUrl(filePath) {
  return filePath;
}
