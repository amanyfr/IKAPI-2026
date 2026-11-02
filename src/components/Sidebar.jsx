import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  FileEdit, 
  ShieldCheck, 
  Award, 
  Users, 
  Settings, 
  CreditCard,
  Building2,
  FileText,
  BadgeCheck
} from 'lucide-react';

export default function Sidebar({ currentView, onChangeView }) {
  const { user } = useAuth();
  const role = user?.role || 'Anggota';

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 min-h-[calc(100vh-4rem)] border-r border-slate-800 hidden md:block">
      <div className="p-4 space-y-6">
        
        {/* Role Identity Badge */}
        <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Peran Aktif:
          </div>
          <div className="text-sm font-extrabold text-white flex items-center gap-2 mt-0.5">
            {role === 'Admin 2' ? (
              <>
                <Award className="w-4 h-4 text-amber-400" />
                <span>Admin 2 (Ketua/Approval)</span>
              </>
            ) : role === 'Admin 1' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Admin 1 (Verifikator)</span>
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Anggota Pemohon</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-1">
            {user?.name}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1 text-xs font-semibold">
          
          {/* ANGGOTA MENU */}
          {role === 'Anggota' && (
            <>
              <button
                onClick={() => onChangeView('anggota_dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                  currentView === 'anggota_dashboard'
                    ? 'bg-blue-900 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-amber-400" />
                <span>Dashboard Pengajuan</span>
              </button>

              <button
                onClick={() => onChangeView('new_form')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                  currentView === 'new_form'
                    ? 'bg-blue-900 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileEdit className="w-4 h-4 text-blue-400" />
                <span>Formulir Pendaftaran 2026</span>
              </button>
            </>
          )}

          {/* ADMIN 1 MENU */}
          {role === 'Admin 1' && (
            <>
              <button
                onClick={() => onChangeView('admin1_screening')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                  currentView === 'admin1_screening'
                    ? 'bg-blue-900 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Screening & Verifikasi Berkas</span>
              </button>

              <button
                onClick={() => onChangeView('members')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                  currentView === 'members'
                    ? 'bg-blue-900 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Data Anggota (Input KTA)</span>
              </button>

              <button
                onClick={() => onChangeView('new_form')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                  currentView === 'new_form'
                    ? 'bg-blue-900 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileEdit className="w-4 h-4 text-slate-400" />
                <span>Bantu Isi Formulir Baru</span>
              </button>
            </>
          )}

          {/* ADMIN 2 MENU */}
          {role === 'Admin 2' && (
            <>
              <button
                onClick={() => onChangeView('admin2_approval')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                  currentView === 'admin2_approval'
                    ? 'bg-blue-900 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>Monitoring & Approval TTD</span>
              </button>

              <button
                onClick={() => onChangeView('admin1_screening')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                  currentView === 'admin1_screening'
                    ? 'bg-blue-900 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Daftar Seluruh Pengajuan</span>
              </button>

              <button
                onClick={() => onChangeView('members')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                  currentView === 'members'
                    ? 'bg-blue-900 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Direktori Data Anggota</span>
              </button>

              <button
                onClick={() => onChangeView('settings')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                  currentView === 'settings'
                    ? 'bg-blue-900 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Settings className="w-4 h-4 text-slate-300" />
                <span>Pengaturan Sistem & Biaya</span>
              </button>
            </>
          )}

        </nav>

        {/* Footer info in sidebar */}
        <div className="pt-6 border-t border-slate-800 text-[10px] text-slate-500 space-y-1">
          <p className="font-bold text-slate-400">IKAPI PD JAWA BARAT</p>
          <p>Jl. Ibu Inggit Garnasih No. 148, Bandung</p>
          <p>Rekening: BNI 2089992087</p>
        </div>

      </div>
    </aside>
  );
}

