import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import AdminDashboard from '../pages/AdminDashboard';
import UserManagement from '../pages/UserManagement';
import SystemSettings from '../pages/SystemSettings';
import Admin1Screening from '../pages/Admin1Screening';
import PhysicalMonitoring from '../pages/PhysicalMonitoring';
import { Users, Settings, LogOut, KeyRound, LayoutDashboard, ShieldCheck, Activity } from 'lucide-react';

export default function AdminPortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  // Filter awal Kelola Akun saat dibuka dari Dashboard; key memaksa remount agar filter terpakai
  const [userFilters, setUserFilters] = useState({ key: 0 });
  const [screeningFilter, setScreeningFilter] = useState({ key: 0, status: 'Semua' });
  // Detail satu pengajuan yang dibuka dari kartu Tugas Admin di Dashboard
  const [detailId, setDetailId] = useState(null);
  const [dashboardKey, setDashboardKey] = useState(0);

  const openScreening = (status = 'Semua') => {
    setScreeningFilter({ key: Date.now(), status });
    setActiveTab('screening');
  };

  const openUsers = (filters = {}) => {
    setUserFilters({ ...filters, key: Date.now() });
    setActiveTab('users');
  };

  const navBtn = (tab, icon, label, shortLabel = label) => (
    <button
      aria-label={label}
      aria-current={activeTab === tab ? 'page' : undefined}
      title={label}
      onClick={() => (tab === 'users' ? openUsers() : setActiveTab(tab))}
      className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${activeTab === tab
          ? 'bg-blue-800 text-white shadow-sm shadow-blue-800/30'
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

      {/* ── Header Portal Admin ── */}
      <header className="brand-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 py-3">

            {/* Logo */}
            <div className="flex items-center gap-3 min-w-0">
              <img src="/logo-ikapi.jpg" alt="IKAPI" className="w-9 h-9 sm:w-11 sm:h-11 flex-shrink-0 rounded-xl object-cover bg-white ring-2 ring-white/20 shadow-md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base sm:text-lg text-white whitespace-nowrap">IKAPI Jawa Barat</span>
                  <span className="hidden sm:inline text-[11px] bg-white/10 text-blue-200 font-bold px-2.5 py-0.5 rounded-full border border-blue-300/30 whitespace-nowrap">
                    ADMIN
                  </span>
                </div>
                <p className="sm:hidden text-[10px] text-blue-200 font-bold uppercase tracking-wide">ADMIN</p>
                <p className="hidden md:block text-xs text-white/55 font-medium">Kelola akun, screening berkas & pengaturan sistem</p>
              </div>
            </div>

            {/* User & Logout */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 border border-white/15">
                <div className="w-6 h-6 rounded-full bg-blue-800 text-white flex items-center justify-center">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-white">{user?.name}</div>
                  <div className="text-[10px] text-blue-200 font-semibold">Administrator Sistem</div>
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
              {navBtn('screening', <ShieldCheck className="w-4 h-4" />, 'Screening Berkas', 'Screening')}
              {navBtn('monitoring', <Activity className="w-4 h-4" />, 'Monitoring & Berkas Fisik', 'Monitoring')}
              {navBtn('users', <Users className="w-4 h-4" />, 'Kelola Akun', 'Akun')}
              {navBtn('settings', <Settings className="w-4 h-4" />, 'Pengaturan Biaya, Rekening, Surat & TTD', 'Pengaturan')}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <AdminDashboard
            key={dashboardKey}
            onOpenDetail={setDetailId}
            onOpenUsers={openUsers}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenScreening={openScreening}
            onOpenMonitoring={() => setActiveTab('monitoring')}
          />
        )}
        {activeTab === 'dashboard' && detailId && (
          <Admin1Screening
            key={detailId}
            openSubmissionId={detailId}
            onDetailClosed={() => { setDetailId(null); setDashboardKey(Date.now()); }}
          />
        )}
        {activeTab === 'users' && (
          <UserManagement
            key={userFilters.key}
            initialRole={userFilters.role}
            initialSearch={userFilters.search}
            startWithCreate={userFilters.create}
          />
        )}
        {activeTab === 'screening' && <Admin1Screening key={screeningFilter.key} initialStatus={screeningFilter.status} />}
        {activeTab === 'monitoring' && <PhysicalMonitoring onOpenScreening={openScreening} />}
        {activeTab === 'settings' && <SystemSettings />}
      </main>

      {/* Footer */}
      <footer className={`relative bar-surface py-4 text-center text-xs text-slate-500 ${activeTab === 'dashboard' ? 'lg:hidden' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 IKAPI Pengurus Daerah Jawa Barat</span>
          <span className="text-[#0da2e7] font-medium">Portal Admin — Akun & Pengaturan Sistem</span>
        </div>
      </footer>
    </div>
  );
}
