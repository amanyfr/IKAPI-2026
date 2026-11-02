import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AnggotaDashboard from '../pages/AnggotaDashboard';
import RegistrationForm from '../pages/RegistrationForm';
import {
  LayoutDashboard, FileEdit, LogOut, User
} from 'lucide-react';

export default function AnggotaPortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingDraft, setEditingDraft] = useState(null);
  const [initSubType,  setInitSubType]  = useState('Baru');
  const [initCategory, setInitCategory] = useState('Biasa');

  const handleEditDraft = (draftSub) => {
    setEditingDraft(draftSub);
    setActiveTab('form');
  };

  const handleNewSubmission = (opts) => {
    setInitSubType(opts?.submissionType || 'Baru');
    setInitCategory(opts?.category || 'Biasa');
    setEditingDraft(null);
    setActiveTab('form');
  };

  const handleFormComplete = () => {
    setEditingDraft(null);
    setActiveTab('dashboard');
  };

  const navBtn = (tab, icon, label) => (
    <button
      onClick={() => setActiveTab(tab)}
      className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-[#0da2e7] hover:bg-[#0884c4] text-white shadow-md shadow-[#0da2e7]/25"
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eaf6fe] via-[#f2f9fe] to-[#f8fbfe] flex flex-col font-sans">

      {/* ── Top Navigation Bar (Putih Bersih) ── */}
      <header className="bg-white border-b border-[#cdeafd] sticky top-0 z-40 shadow-sm">
        <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between py-3.5 gap-4">

            {/* Navigation Tabs */}
            <div className="flex gap-2 overflow-x-auto">
              {navBtn('dashboard', <LayoutDashboard className="w-4 h-4" />, 'Dashboard Pengajuan')}
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-2.5 bg-[#f0f9ff] rounded-xl px-4 py-2 border border-[#b8e6fc]">
                <div className="w-7 h-7 rounded-full bg-[#0da2e7] text-white flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div className="text-left leading-tight">
                  <div className="text-sm font-bold text-slate-900">{user?.name}</div>
                  <div className="text-[11px] text-[#0884c4] font-semibold">Anggota Penerbit</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 text-sm font-bold rounded-xl border border-slate-200 hover:border-red-200 transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content — Full Width Professional Container */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 lg:px-10 py-8">
        {activeTab === 'dashboard' && (
          <AnggotaDashboard
            onNewSubmission={handleNewSubmission}
            onEditDraft={handleEditDraft}
          />
        )}
        {activeTab === 'form' && (
          <RegistrationForm
            existingSubmission={editingDraft}
            initialSubmissionType={initSubType}
            initialCategory={initCategory}
            onComplete={handleFormComplete}
            onCancel={handleFormComplete}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#cce9fb] bg-white py-4 text-center text-sm text-slate-500">
        <span>© 2026 IKAPI Pengurus Daerah Jawa Barat</span>
      </footer>
    </div>
  );
}
