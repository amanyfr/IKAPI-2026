import React, { useState, useEffect } from 'react';
import {
  Users, Search, Download, ExternalLink, BadgeCheck,
  Building2, Phone, Mail, MapPin, RefreshCw, KeyRound,
  X, Edit2, CheckCircle, ChevronDown, Eye, Hash
} from 'lucide-react';

const token = () => localStorage.getItem('ikapi_token');

const BADGE = {
  Aktif:   'bg-emerald-100 text-emerald-800 border-emerald-200',
  Calon:   'bg-amber-100 text-amber-800 border-amber-200',
  Nonaktif:'bg-slate-100 text-slate-600 border-slate-300',
};

export default function MembersManagement() {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('Semua');
  const [status,   setStatus]   = useState('Semua');

  // Detail Modal
  const [selectedMember, setSelectedMember] = useState(null);

  // Edit KTA (inline row)
  const [editingKtaId, setEditingKtaId] = useState(null);
  const [ktaInput,     setKtaInput]     = useState('');
  const [savingKta,    setSavingKta]    = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.append('search', search.trim());
      if (category !== 'Semua') q.append('category', category);
      if (status !== 'Semua') q.append('status', status);

      const res = await fetch(`/api/members?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, [category, status]);

  const handleSearchSubmit = (e) => { e.preventDefault(); fetchMembers(); };

  /* ── Save KTA ── */
  const handleSaveKta = async (memberId) => {
    if (!ktaInput.trim()) { alert('Nomor KTA wajib diisi.'); return; }
    setSavingKta(true);
    try {
      const res = await fetch(`/api/members/${memberId}/kta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ kta_number: ktaInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('Nomor KTA berhasil disimpan.');
      setEditingKtaId(null);
      setKtaInput('');
      fetchMembers();
    } catch (err) {
      alert('Gagal simpan KTA: ' + err.message);
    } finally {
      setSavingKta(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetch('/api/members/export', {
        headers: { Authorization: `Bearer ${token()}` }
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
    } catch (err) {
      alert('Ekspor Excel gagal: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#0da2e7] rounded-xl text-white shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Direktori & Pendataan Anggota</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola data penerbit IKAPI Jawa Barat, input No. KTA, dan unduh rekap Excel.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Ekspor Excel (.XLSX)
        </button>
      </div>

      {/* ── Filter & Search ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">

          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama penerbit, pimpinan, kota, no. KTA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] focus:border-[#0da2e7] outline-none"
            />
          </div>

          <div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
            >
              <option value="Semua">Semua Kategori</option>
              <option value="Biasa">Anggota Biasa (PT/CV)</option>
              <option value="Luar Biasa">Anggota Luar Biasa (Univ Press)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex-1 text-xs py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none"
            >
              <option value="Semua">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Calon">Calon Anggota</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
            <button
              type="button"
              onClick={fetchMembers}
              className="p-2 border border-slate-300 hover:bg-[#f0f9ff] rounded-lg text-slate-600 hover:text-[#0da2e7] transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="sm:col-span-4 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[#0da2e7] hover:bg-[#0884c4] text-white text-xs font-bold rounded-lg shadow transition"
            >
              Cari / Filter
            </button>
          </div>
        </form>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Anggota', value: members.length, color: 'text-[#0da2e7]' },
          { label: 'Aktif', value: members.filter(m => m.membership_status === 'Aktif').length, color: 'text-emerald-600' },
          { label: 'Calon / Proses', value: members.filter(m => m.membership_status === 'Calon').length, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 text-center">
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-[#f0f9ff] border-b border-[#b8e6fc]">
                <th className="py-3 px-4 text-left font-bold text-[#0884c4] w-10">#</th>
                <th className="py-3 px-4 text-left font-bold text-[#0884c4]">Nama Penerbit</th>
                <th className="py-3 px-4 text-left font-bold text-[#0884c4]">Kategori</th>
                <th className="py-3 px-4 text-left font-bold text-[#0884c4]">Kota</th>
                <th className="py-3 px-4 text-left font-bold text-[#0884c4]">No. KTA</th>
                <th className="py-3 px-4 text-left font-bold text-[#0884c4]">Status</th>
                <th className="py-3 px-4 text-center font-bold text-[#0884c4]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin inline mr-2" />Memuat data...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Tidak ada data anggota ditemukan.</p>
                  </td>
                </tr>
              ) : members.map((m, i) => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-[#f8fbfe] transition">
                  <td className="py-3 px-4 text-slate-400 font-mono">{i + 1}</td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{m.publisher_name}</div>
                    <div className="text-[10px] text-slate-500">{m.leader_name} · {m.legal_entity || '-'}</div>
                  </td>

                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      m.category === 'Luar Biasa'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-[#dff2fd] text-[#0884c4] border-[#b8e6fc]'
                    }`}>
                      {m.category || 'Biasa'}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-slate-600">{m.city || '-'}</td>

                  {/* No. KTA – editable inline */}
                  <td className="py-3 px-4">
                    {editingKtaId === m.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={ktaInput}
                          onChange={(e) => setKtaInput(e.target.value)}
                          placeholder="014/JBR/2026"
                          autoFocus
                          className="w-28 text-xs font-mono font-bold p-1.5 border border-[#0da2e7] rounded-lg focus:ring-2 focus:ring-[#0da2e7] outline-none uppercase"
                        />
                        <button
                          onClick={() => handleSaveKta(m.id)}
                          disabled={savingKta}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                          title="Simpan"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditingKtaId(null); setKtaInput(''); }}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
                          title="Batal"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <span className={`font-mono font-bold ${m.kta_number ? 'text-[#0884c4]' : 'text-slate-300 italic'}`}>
                          {m.kta_number || '—'}
                        </span>
                        <button
                          onClick={() => { setEditingKtaId(m.id); setKtaInput(m.kta_number || ''); }}
                          className="p-1 rounded text-slate-300 hover:text-[#0da2e7] hover:bg-[#f0f9ff] opacity-0 group-hover:opacity-100 transition"
                          title="Edit No. KTA"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${BADGE[m.membership_status] || BADGE.Calon}`}>
                      {m.membership_status}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedMember(m)}
                      className="px-3 py-1.5 bg-[#f0f9ff] hover:bg-[#dff2fd] text-[#0884c4] text-xs font-semibold rounded-lg border border-[#b8e6fc] transition flex items-center gap-1 mx-auto"
                    >
                      <Eye className="w-3.5 h-3.5" /> Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!loading && members.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
            <span>Menampilkan <strong className="text-slate-600">{members.length}</strong> data anggota</span>
            <span className="text-[#0da2e7] font-medium">IKAPI Jawa Barat · 2026</span>
          </div>
        )}
      </div>

      {/* ── Member Detail Modal ── */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-0 overflow-hidden">

            {/* Modal Header */}
            <div className="bg-[#0da2e7] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">{selectedMember.publisher_name}</h3>
                  <p className="text-xs text-[#dff2fd] mt-0.5">
                    Anggota {selectedMember.category} · {selectedMember.legal_entity || 'Badan Usaha'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">

              {/* KTA & Status Banner */}
              <div className="bg-[#f0f9ff] rounded-xl border border-[#b8e6fc] p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold text-[#0884c4] uppercase tracking-wider mb-0.5">Nomor KTA Resmi</div>
                  <div className="font-mono font-extrabold text-lg text-[#0da2e7]">
                    {selectedMember.kta_number || '— Belum Terbit —'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${BADGE[selectedMember.membership_status] || BADGE.Calon}`}>
                    {selectedMember.membership_status}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedMember(null);
                      setEditingKtaId(selectedMember.id);
                      setKtaInput(selectedMember.kta_number || '');
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Edit KTA
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Legalitas */}
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block border-b border-slate-200 pb-1.5 mb-2">Legalitas & Identitas</span>
                  <InfoRow label="NIB" value={selectedMember.nib} />
                  <InfoRow label="NPWP" value={selectedMember.npwp} />
                  <InfoRow label="Sertifikat BNSP" value={selectedMember.bnsp_certificate_no} />
                  <InfoRow label="Tgl Berdiri" value={selectedMember.establishment_date} />
                </div>

                {/* Kontak */}
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block border-b border-slate-200 pb-1.5 mb-2">Pimpinan & Kontak</span>
                  <InfoRow label="Pimpinan" value={`${selectedMember.leader_name || '-'} (${selectedMember.leader_title || 'Pimpinan'})`} />
                  <InfoRow label="PJ Redaksi" value={selectedMember.person_in_charge} />
                  <InfoRow label="Telepon" value={selectedMember.phone} icon={<Phone className="w-3 h-3" />} />
                  <InfoRow label="Email" value={selectedMember.email} icon={<Mail className="w-3 h-3" />} />
                </div>
              </div>

              {/* Alamat */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-700 block border-b border-slate-200 pb-1.5 mb-2">Alamat & Spesialisasi</span>
                <InfoRow label="Alamat" value={`${selectedMember.address || '-'}, ${selectedMember.city || ''}`} icon={<MapPin className="w-3 h-3" />} />
                <InfoRow label="Kode Pos" value={selectedMember.postal_code} />
                <InfoRow label="Website" value={selectedMember.website} />
                <InfoRow label="Spesialisasi" value={selectedMember.specialization || 'Umum & Pendidikan'} />
              </div>
            </div>

            <div className="px-6 pb-5 flex justify-end">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function InfoRow({ label, value, icon }) {
  return (
    <p className="flex items-start gap-1.5 text-slate-600">
      {icon && <span className="text-[#0da2e7] mt-0.5 flex-shrink-0">{icon}</span>}
      <span><strong className="text-slate-700">{label}:</strong> {value || <span className="text-slate-300 italic">—</span>}</span>
    </p>
  );
}
