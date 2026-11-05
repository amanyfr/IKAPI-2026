import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AnggotaDashboard from '../pages/AnggotaDashboard';
import RegistrationForm from '../pages/RegistrationForm';
import OnboardingPage from '../pages/OnboardingPage';
import { LogOut, User } from 'lucide-react';

export default function AnggotaPortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingDraft, setEditingDraft] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  // Label akun: belum terverifikasi sampai Admin mengonfirmasi berkas fisik (status Aktif)
  const verified = subStatus ? subStatus === 'Aktif' : user?.member?.membership_status === 'Aktif';
  const roleLabel = verified ? 'Anggota penerbit' : 'Penerbit belum terverifikasi';

  // Nilai awal formulir dari jawaban pertanyaan login pertama
  const profileType     = user?.member_type === 'Lama' ? 'Heregistrasi' : 'Baru';
  const profileCategory = user?.member_category || 'Biasa';
  const [initSubType,  setInitSubType]  = useState(profileType);
  const [initCategory, setInitCategory] = useState(profileCategory);

  const handleEditDraft = (draftSub) => {
    setEditingDraft(draftSub);
    setActiveTab('form');
  };

  const handleNewSubmission = (opts) => {
    // Satu akun = satu pengajuan; jenisnya selalu mengikuti profil
    setInitSubType(profileType);
    setInitCategory(opts?.category || profileCategory);
    setEditingDraft(null);
    setActiveTab('form');
  };

  const handleFormComplete = () => {
    setEditingDraft(null);
    setActiveTab('dashboard');
  };

  // Ubah jawaban anggota lama/baru & kategori (hanya selama belum ada pengajuan)
  if (editingProfile) {
    return <OnboardingPage onBack={() => setEditingProfile(false)} onDone={() => setEditingProfile(false)} />;
  }

  return (
    <div className="theme-soft relative min-h-screen flex flex-col">

      {/* Latar foto buku IKAPI di semua halaman Anggota */}
      <div aria-hidden="true" className="anggota-photo-bg fixed inset-0" />


      {/* ── Header Portal Anggota ── */}
      <header className="soft-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 py-3">

            {/* Logo */}
            <div className="flex items-center gap-3 min-w-0">
              <img src="/logo-ikapi.jpg" alt="IKAPI" className="w-9 h-9 sm:w-11 sm:h-11 flex-shrink-0 rounded-2xl object-cover bg-white ring-1 ring-slate-200/70 shadow-sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-base sm:text-lg text-slate-900 whitespace-nowrap">IKAPI Jawa Barat</span>
                  <span className="hidden sm:inline-flex soft-chip">
                    <span className={`w-1.5 h-1.5 rounded-full ${verified ? 'bg-[#12c26f]' : 'bg-amber-400'}`} />
                    {roleLabel}
                  </span>
                </div>
                <p className={`sm:hidden text-[11px] font-medium ${verified ? 'text-emerald-600' : 'text-amber-600'}`}>{roleLabel}</p>
                <p className="hidden md:block text-xs text-slate-500">Pendaftaran & Registrasi Keanggotaan IKAPI Jawa Barat</p>
              </div>
            </div>

            {/* User & Logout */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-white rounded-full pl-1.5 pr-4 py-1.5 border border-slate-200/70 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-[#3b82f6] text-white flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-medium text-slate-800">{user?.name}</div>
                  <div className="text-[10px] text-slate-500">{roleLabel}</div>
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
          </div>

        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <AnggotaDashboard
            onNewSubmission={handleNewSubmission}
            onEditDraft={handleEditDraft}
            onEditProfile={() => setEditingProfile(true)}
            onStatusChange={setSubStatus}
            defaultType={profileType}
            defaultCategory={profileCategory}
          />
        )}
        {activeTab === 'form' && (
          <RegistrationForm
            existingSubmission={editingDraft}
            initialSubmissionType={initSubType}
            initialCategory={initCategory}
            initialOldKtaNumber={user?.old_kta_number || ''}
            lockSubmissionType={Boolean(user?.member_type)}
            onComplete={handleFormComplete}
            onCancel={handleFormComplete}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="relative bar-surface border-t py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 IKAPI Pengurus Daerah Jawa Barat</span>
          <span className="text-slate-500">Portal Anggota — Pendaftaran & Registrasi</span>
        </div>
      </footer>
    </div>
  );
}
