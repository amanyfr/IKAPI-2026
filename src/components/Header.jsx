import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  LogOut, 
  User, 
  ChevronDown, 
  Sparkles,
  BookOpen,
  Award
} from 'lucide-react';

export default function Header({ onOpenAuth }) {
  const { user, logout, quickSwitch, isAuthenticated } = useAuth();

  return (
    <header className="bg-ikapi-navy text-white shadow-md border-b-2 border-ikapi-gold/60 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 p-1.5 border border-ikapi-gold/40 flex items-center justify-center shadow-inner">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <rect width="100" height="100" rx="15" fill="#0b2545" />
                <path d="M20 75 L50 20 L80 75 Z" fill="#f59e0b" opacity="0.9" />
                <path d="M35 75 L50 45 L65 75 Z" fill="#ffffff" />
                <circle cx="50" cy="38" r="7" fill="#0b2545" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-wider text-white">IKAPI</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-semibold border border-amber-500/30">
                  JAWA BARAT
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-light -mt-0.5">
                Sistem Pendaftaran & Pendataan Anggota
              </p>
            </div>
          </div>

          {/* Quick Demo Role Switcher */}
          <div className="hidden lg:flex items-center space-x-2 bg-slate-900/60 p-1 rounded-lg border border-slate-700/60">
            <span className="text-[11px] text-slate-300 font-medium px-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Demo Peran:
            </span>
            <button
              onClick={() => quickSwitch(null, 'admin1@ikapi-jabar.or.id')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition flex items-center gap-1.5 ${
                user?.role === 'Admin 1'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-white/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Screening berkas & verifikasi pembayaran"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
              Admin 1 (Screening)
            </button>
            <button
              onClick={() => quickSwitch(null, 'admin2@ikapi-jabar.or.id')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition flex items-center gap-1.5 ${
                user?.role === 'Admin 2'
                  ? 'bg-amber-600 text-white shadow-sm ring-1 ring-white/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Approval Ketua/Sekretaris, TTD Digital & Surat Resmi"
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              Admin 2 (Approval)
            </button>
            <button
              onClick={() => quickSwitch(null, 'mizan@penerbit.id')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition flex items-center gap-1.5 ${
                user?.email === 'mizan@penerbit.id'
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-white/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Pemohon Anggota Biasa (PT Penerbit)"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
              Anggota Biasa
            </button>
            <button
              onClick={() => quickSwitch(null, 'press@unpad.ac.id')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition flex items-center gap-1.5 ${
                user?.email === 'press@unpad.ac.id'
                  ? 'bg-purple-600 text-white shadow-sm ring-1 ring-white/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Pemohon Anggota Luar Biasa (University Press)"
            >
              <Building2 className="w-3.5 h-3.5 text-purple-300" />
              Luar Biasa
            </button>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[11px] flex items-center justify-end gap-1 text-slate-300">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      user.role === 'Admin 2' ? 'bg-amber-400' :
                      user.role === 'Admin 1' ? 'bg-blue-400' : 'bg-emerald-400'
                    }`} />
                    {user.role} {user.member ? `(${user.member.publisher_name})` : ''}
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
                  title="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm shadow transition flex items-center gap-1.5"
              >
                <User className="w-4 h-4" />
                Masuk / Daftar
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}

