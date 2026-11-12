import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import AnggotaDashboard from '../pages/AnggotaDashboard';
import RegistrationForm from '../pages/RegistrationForm';
import OnboardingPage from '../pages/OnboardingPage';
import { LogOut, User } from 'lucide-react';

// Badan usaha di form anggota lama -> pilihan formulir registrasi
const LEGAL_MAP = {
  PT: 'Perseroan Terbatas (PT)',
  CV: 'Commanditaire Vennootschap (CV)',
  'Perguruan Tinggi': 'Perguruan Tinggi (University Press)',
  Yayasan: 'Yayasan / Lembaga Pendidikan',
  Lainnya: 'Koperasi / Badan Hukum Lainnya',
};

/** Data KTA & keanggotaan yang dikirim anggota lama -> isian awal formulir perpanjangan */
function formFromHeregData(d = {}) {
  const pick = (v) => (v ? String(v) : undefined);
  const out = {
    oldKtaNumber: pick(d.ktaNumber),
    publisherName: pick(d.publisherName),
    legalEntity: LEGAL_MAP[d.legalEntity],
    nib: pick(d.nib),
    address: pick(d.address),
    city: pick(d.city),
    postalCode: pick(d.postalCode),
    phone: pick(d.phone),
    email: pick(d.email),
    website: pick(d.website),
    leaderName: pick(d.leaderName),
    leaderTitle: pick(d.leaderTitle),
    leaderPhone: pick(d.leaderPhone),
    personInCharge: pick(d.personInCharge),
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

export default function AnggotaPortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingDraft, setEditingDraft] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  // Label akun: belum terverifikasi sampai Admin mengonfirmasi berkas fisik (status Aktif)
  // Selama perpanjangan berjalan, anggota tetap terverifikasi (data anggota masih Aktif)
  const verified = subStatus === 'Aktif' || user?.member?.membership_status === 'Aktif';
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
    // Perpanjangan anggota aktif (H-7): formulir Registrasi baru, terisi dari data keanggotaan terakhir
    if (opts?.renewFrom) {
      const prev = opts.renewFrom;
      let parsed = {};
      try { parsed = typeof prev.form_data === 'string' ? JSON.parse(prev.form_data || '{}') : { ...(prev.form_data || {}) }; } catch { parsed = {}; }
      delete parsed.source; delete parsed.isDraft; delete parsed.isSubmit; delete parsed.submissionType;
      const kta = prev.member_kta || prev.kta_number_submitted || prev.old_kta_number || '';
      setInitSubType('Heregistrasi');
      setInitCategory(prev.member_category || prev.category || profileCategory);
      // id null: disimpan sebagai pengajuan baru, bukan mengubah pengajuan lama
      setEditingDraft({ ...prev, id: null, form_data: { ...parsed, oldKtaNumber: kta }, submission_type: 'Heregistrasi', old_kta_number: kta });
      setActiveTab('form');
      return;
    }
    // Satu akun = satu pengajuan; jenisnya selalu mengikuti profil
    setInitSubType(profileType);
    setInitCategory(opts?.category || profileCategory);
    // Anggota lama jalur perpanjangan: formulir terisi dari data KTA & keanggotaan yang sudah divalidasi
    const d = user?.hereg_mig_data;
    if (user?.member_type === 'Lama' && user?.hereg_track === 'Perpanjangan' && d?.ktaNumber) {
      const kta = user.old_kta_number || d.ktaNumber;
      setEditingDraft({ id: null, form_data: { ...formFromHeregData(d), oldKtaNumber: kta }, submission_type: 'Heregistrasi', old_kta_number: kta, member_category: opts?.category || profileCategory });
    } else {
      setEditingDraft(null);
    }
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
              <img src="/logo-ikapi.jpg" alt="IKAPI" className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 object-contain" />
              <span className="font-semibold text-base sm:text-lg text-slate-900 whitespace-nowrap">IKAPI Jawa Barat</span>
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
              <NotificationBell tone="light" />
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
