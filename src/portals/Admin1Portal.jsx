import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import Admin1Dashboard from '../pages/Admin1Dashboard';
import Admin1Screening from '../pages/Admin1Screening';
import MembersManagement from '../pages/MembersManagement';
import { ShieldCheck, Users, LogOut, LayoutDashboard } from 'lucide-react';

export default function Admin1Portal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  // Filter awal halaman Screening saat dibuka dari Dashboard; key memaksa remount agar filter terpakai
  const [screeningFilters, setScreeningFilters] = useState({ key: 0 });
  // Kartu Dashboard = satu pengajuan: buka detailnya langsung, tanpa pindah ke halaman Screening
  const [detailId, setDetailId] = useState(null);
  const [dashboardKey, setDashboardKey] = useState(0);

  const openScreening = (filters = {}) => {
    setScreeningFilters({ ...filters, key: Date.now() });
    setActiveTab('screening');
  };

  // Data Anggota bisa dibuka langsung ke tab 'Menunggu KTA'
  const [membersFilter, setMembersFilter] = useState({ key: 0 });
  const openMembers = (f) => {
    setDetailId(null);
    setMembersFilter({ status: typeof f?.status === 'string' ? f.status : undefined, key: Date.now() });
    setActiveTab('members');
  };

  const navBtn = (tab, icon, label, shortLabel = label) => (
    <button
      aria-label={label}
      aria-current={activeTab === tab ? 'page' : undefined}
      title={label}
      onClick={() => (tab === 'screening' ? openScreening() : tab === 'members' ? openMembers() : setActiveTab(tab))}
      className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${activeTab === tab
          ? 'bg-[#0da2e7] text-white shadow-sm shadow-[#0da2e7]/30'
          : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
    >
      {icon}
      <span className="lg:hidden">{shortLabel}</span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );

  return (
    <div className="relative min-h-screen portal-bg flex flex-col font-sans">


      {/* ── Header Portal Sekretaris ── */}
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
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-white">{user?.name}</div>
                  <div className="text-[10px] text-sky-300 font-semibold">Sekretaris PD IKAPI Jabar</div>
                </div>
              </div>
              <NotificationBell tone="dark" />
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
              {navBtn('screening', <ShieldCheck className="w-4 h-4" />, 'Pengajuan & Screening', 'Screening')}
              {navBtn('members', <Users className="w-4 h-4" />, 'Data Anggota & No. KTA', 'Anggota')}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <Admin1Dashboard
            key={dashboardKey}
            onOpenDetail={setDetailId}
            onOpenScreening={openScreening}
            onOpenMembers={() => openMembers({ status: 'Menunggu KTA' })}
          />
        )}
        {activeTab === 'dashboard' && detailId && (
          <Admin1Screening
            key={detailId}
            openSubmissionId={detailId}
            onNavigateToMembers={openMembers}
            onDetailClosed={() => { setDetailId(null); setDashboardKey(Date.now()); }}
          />
        )}
        {activeTab === 'screening' && (
          <Admin1Screening
            key={screeningFilters.key}
            initialStatus={screeningFilters.status}
            initialSearch={screeningFilters.search}
            onNavigateToMembers={openMembers}
          />
        )}
        {activeTab === 'members' && <MembersManagement key={membersFilter.key} initialStatus={membersFilter.status || 'Semua'} />}
      </main>

      {/* Footer */}
      <footer className={`relative bar-surface border-t py-4 text-center text-xs text-slate-500 ${activeTab === 'dashboard' ? 'lg:hidden' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 IKAPI Pengurus Daerah Jawa Barat</span>
          <span className="text-[#0da2e7] font-medium">Portal Sekretaris — Screening & Verifikasi</span>
        </div>
      </footer>
    </div>
  );
}
