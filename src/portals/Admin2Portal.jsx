import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Admin2Dashboard from '../pages/Admin2Dashboard';
import Admin2Approval from '../pages/Admin2Approval';
import MembersManagement from '../pages/MembersManagement';
import { Award, Users, LogOut, LayoutDashboard } from 'lucide-react';

export default function Admin2Portal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  // Filter awal halaman Approval saat dibuka dari Dashboard; key memaksa remount agar filter terpakai
  const [approvalFilters, setApprovalFilters] = useState({ key: 0 });

  const openApproval = (filters = {}) => {
    setApprovalFilters({ ...filters, key: Date.now() });
    setActiveTab('approval');
  };

  const navBtn = (tab, icon, label, shortLabel = label) => (
    <button
      aria-label={label}
      aria-current={activeTab === tab ? 'page' : undefined}
      title={label}
      onClick={() => (tab === 'approval' ? openApproval() : setActiveTab(tab))}
      className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
        activeTab === tab
          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {icon}
      {/* HP: tab tidak aktif cukup ikon agar menu muat */}
      <span className={activeTab === tab ? 'sm:hidden' : 'hidden'}>{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="relative min-h-screen portal-bg flex flex-col font-sans">


      {/* ── Header Portal Ketua ── */}
      <header className="brand-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 py-3">

            {/* Logo */}
            <div className="flex items-center gap-3 min-w-0">
              <img src="/logo-ikapi.jpg" alt="IKAPI" className="w-9 h-9 sm:w-11 sm:h-11 flex-shrink-0 rounded-lg object-cover bg-white" />
              <span className="font-semibold text-base sm:text-lg text-white whitespace-nowrap">IKAPI Jawa Barat</span>
            </div>

            {/* User & Logout */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 border border-white/15">
                <div className="w-6 h-6 rounded-full bg-[#0da2e7] text-white flex items-center justify-center">
                  <Award className="w-3.5 h-3.5" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-white">{user?.name}</div>
                  <div className="text-[10px] text-sky-300 font-semibold">Ketua PD IKAPI Jabar</div>
                </div>
              </div>
              <button
                onClick={logout}
                aria-label="Keluar"
                className="p-2 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-red-500/25 text-white/80 hover:text-white text-xs font-semibold rounded-xl border border-white/15 transition flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>

          {/* Sub Nav */}
          <div className="pb-3 overflow-x-auto">
            <div className="inline-flex gap-1 p-1 rounded-full bg-white/10 border border-white/15">
              {navBtn('dashboard', <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}
              {navBtn('approval',  <Award    className="w-4 h-4" />, 'Approval & TTD', 'Approval')}
              {navBtn('members',   <Users    className="w-4 h-4" />, 'Direktori Anggota', 'Anggota')}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <Admin2Dashboard
            onOpenApproval={openApproval}
            onOpenMembers={() => setActiveTab('members')}
          />
        )}
        {activeTab === 'approval'  && (
          <Admin2Approval
            key={approvalFilters.key}
            initialStatus={approvalFilters.status}
            initialSearch={approvalFilters.search}
            scrollToMonitoring={approvalFilters.scroll}
          />
        )}
        {/* Sesuai PRD, No. KTA diisi pemohon & divalidasi Admin — Ketua hanya melihat direktori */}
        {activeTab === 'members'   && <MembersManagement canEditKta={false} />}
      </main>

      {/* Footer */}
      <footer className={`relative bar-surface border-t py-4 text-center text-xs text-slate-500 ${activeTab === 'dashboard' ? 'lg:hidden' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 IKAPI Pengurus Daerah Jawa Barat</span>
          <span className="text-[#0da2e7] font-medium">Portal Ketua — Approval & Tanda Tangan Surat</span>
        </div>
      </footer>
    </div>
  );
}
