// Unduh rekap data anggota dalam format Excel (.xlsx)
export async function exportMembersExcel() {
  const res = await fetch('/api/members/export', {
    headers: { Authorization: `Bearer ${localStorage.getItem('ikapi_token')}` }
  });
  if (!res.ok) throw new Error('Gagal mengunduh file Excel');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Data_Anggota_IKAPI_Jawa_Barat.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
