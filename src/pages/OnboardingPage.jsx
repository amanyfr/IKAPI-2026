import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, UserPlus, RefreshCw, Building2, GraduationCap, CheckCircle2, ArrowRight, AlertCircle, ArrowLeft
} from 'lucide-react';

// Pertanyaan login pertama untuk anggota baru terdaftar:
// status keanggotaan (lama/baru) dan kategori (biasa/luar biasa).
const TYPE_OPTIONS = [
  { id: 'Baru', icon: UserPlus,  title: 'Anggota baru', desc: 'Belum pernah terdaftar di IKAPI, mendaftar untuk pertama kali.' },
  { id: 'Lama', icon: RefreshCw, title: 'Anggota lama', desc: 'Sudah memiliki KTA IKAPI dan ingin registrasi (perpanjangan).' },
];

const CATEGORY_OPTIONS = [
  { id: 'Biasa',      icon: Building2,     title: 'Anggota biasa',      desc: 'Badan usaha penerbit: PT, CV, atau yayasan.' },
  { id: 'Luar Biasa', icon: GraduationCap, title: 'Anggota luar biasa', desc: 'Penerbit perguruan tinggi atau lembaga (university press).' },
];

function OptionCard({ option, active, onSelect }) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      aria-pressed={active}
      className={`text-left p-3 sm:p-4 rounded-[20px] border-2 transition flex flex-col sm:flex-row items-start gap-2 sm:gap-3 ${
        active ? 'border-[#3b82f6] bg-white shadow-[0_8px_20px_-12px_rgba(59,130,246,0.6)]' : 'border-white bg-white/70 hover:border-blue-200'
      }`}
    >
      <span className={`w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-full flex items-center justify-center ${
        active ? 'bg-[#3b82f6] text-white' : 'bg-slate-100 text-slate-500'
      }`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span className="min-w-0 flex-1 w-full">
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm sm:text-base text-slate-900">{option.title}</span>
          {active && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#3b82f6] flex-shrink-0" />}
        </span>
        <span className="block text-xs sm:text-[13px] leading-snug text-slate-500 mt-0.5">{option.desc}</span>
      </span>
    </button>
  );
}

// onBack (opsional): dibuka ulang dari dashboard untuk mengubah jawaban → "Kembali" ke dashboard.
// Tanpa onBack (login pertama) → "Kembali" keluar ke halaman masuk.
export default function OnboardingPage({ onBack, onDone }) {
  const { user, logout, updateUser } = useAuth();
  const [memberType, setMemberType] = useState(onBack ? user?.member_type || '' : '');
  const [category, setCategory] = useState(onBack ? user?.member_category || '' : '');
  const [oldKtaNumber, setOldKtaNumber] = useState(onBack ? user?.old_kta_number || '' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = memberType && category && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
        },
        body: JSON.stringify({ memberType, category, oldKtaNumber })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jawaban.');
      updateUser(data.user);
      onDone?.();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="theme-soft relative min-h-screen flex flex-col">

      {/* Latar foto buku IKAPI (sama dengan portal Anggota) */}
      <div aria-hidden="true" className="anggota-photo-bg fixed inset-0" />

      <header className="soft-header relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo-ikapi.jpg" alt="IKAPI" className="w-9 h-9 sm:w-11 sm:h-11 flex-shrink-0 rounded-2xl object-cover bg-white ring-1 ring-slate-200/70 shadow-sm" />
            <div className="min-w-0">
              <span className="font-medium text-base sm:text-lg text-slate-900 whitespace-nowrap">IKAPI Jawa Barat</span>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">Halo, {user?.name}</p>
            </div>
          </div>
          <button
            onClick={logout}
            aria-label="Keluar"
            className="soft-pill !p-2.5 sm:!px-4 sm:!py-2 !text-xs hover:!text-red-600"
          >
            <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      <main className="relative flex-1 w-full max-w-2xl mx-auto px-4 py-5 sm:py-8 flex items-center">
        <form onSubmit={handleSubmit} className="card-surface w-full p-5 sm:p-7 space-y-5 sm:space-y-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onBack || logout}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                {onBack ? 'Kembali ke dashboard' : 'Kembali ke halaman masuk'}
              </button>
              <span className="soft-chip"><span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />{onBack ? 'Ubah jawaban' : 'Langkah awal'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-light text-slate-900 mt-2.5 tracking-tight">Lengkapi profil keanggotaan</h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Jawab dua pertanyaan berikut. Jawaban Anda dipakai untuk menyiapkan formulir pengajuan yang sesuai.
            </p>
          </div>

          <fieldset className="space-y-2.5">
            <legend className="text-base sm:text-lg text-slate-800 mb-2.5">1. Apakah Anda sudah pernah menjadi anggota IKAPI?</legend>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {TYPE_OPTIONS.map((o) => (
                <OptionCard key={o.id} option={o} active={memberType === o.id} onSelect={setMemberType} />
              ))}
            </div>
            {memberType === 'Lama' && (
              <div className="panel-inner p-3.5">
                <label htmlFor="old-kta" className="text-sm font-semibold text-slate-700 block mb-1.5">
                  Nomor KTA lama <span className="font-normal text-slate-400">(opsional)</span>
                </label>
                <input
                  id="old-kta"
                  value={oldKtaNumber}
                  onChange={(e) => setOldKtaNumber(e.target.value)}
                  placeholder="Contoh: 008/JBR/2024"
                  className="soft-input"
                />
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2.5">
            <legend className="text-base sm:text-lg text-slate-800 mb-2.5">2. Kategori keanggotaan Anda</legend>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {CATEGORY_OPTIONS.map((o) => (
                <OptionCard key={o.id} option={o} active={category === o.id} onSelect={setCategory} />
              ))}
            </div>
          </fieldset>

          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">Jenis pengajuan mengikuti jawaban ini. Jawaban masih bisa diubah selama pengajuan belum dibuat.</p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="soft-pill-primary px-6 py-2.5 disabled:!bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
            >
              {saving ? 'Menyimpan...' : <>Simpan & lanjutkan <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
