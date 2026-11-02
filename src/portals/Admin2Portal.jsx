import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Admin2Approval from '../pages/Admin2Approval';
import MembersManagement from '../pages/MembersManagement';
import SystemSettings from '../pages/SystemSettings';
import { Award, Users, Settings, LogOut } from 'lucide-react';

export default function Admin2Portal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('approval');

  const navBtn = (tab, icon, label) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
        activeTab === tab
          ? 'bg-[#0da2e7] text-white shadow-sm shadow-[#0da2e7]/30'
          : 'text-slate-600 hover:text-[#0da2e7] hover:bg-[#f0f9ff]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f8fbfe] flex flex-col font-sans">

      {/* ── Header Portal Admin 2 ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src="/logo-ikapi.jpg" alt="IKAPI" className="w-11 h-11 rounded-xl object-cover shadow-md" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg text-slate-900">IKAPI Jawa Barat</span>
                  <span className="text-[11px] bg-[#dff2fd] text-[#0884c4] font-bold px-2.5 py-0.5 rounded-full border border-[#b8e6fc]">
                    ADMIN 2 — PIMPINAN
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">Ketua & Sekretaris Pengurus Daerah IKAPI Jawa Barat</p>
              </div>
            </div>

            {/* User & Logout */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-[#f0f9ff] rounded-xl px-3 py-1.5 border border-[#b8e6fc]">
                <div className="w-6 h-6 rounded-full bg-[#0da2e7] text-white flex items-center justify-center">
                  <Award className="w-3.5 h-3.5" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-slate-900">{user?.name}</div>
                  <div className="text-[10px] text-[#0884c4] font-semibold">Dewan Pimpinan</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Keluar
              </button>
            </div>
          </div>

          {/* Sub Nav */}
          <div className="flex gap-1 border-t border-slate-100 pt-1 pb-2 overflow-x-auto">
            {navBtn('approval', <Award    className="w-4 h-4" />, 'Monitoring & Approval Tanda Tangan')}
            {navBtn('members',  <Users    className="w-4 h-4" />, 'Direktori Data Anggota')}
            {navBtn('settings', <Settings className="w-4 h-4" />, 'Pengaturan Sistem, Biaya & Rekening')}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'approval'  && <Admin2Approval />}
        {activeTab === 'members'   && <MembersManagement />}
        {activeTab === 'settings'  && <SystemSettings />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 IKAPI Pengurus Daerah Jawa Barat</span>
          <span className="text-[#0da2e7] font-medium">Portal Eksekutif — Approval & Penandatanganan Digital</span>
        </div>
      </footer>
    </div>
  );
}
