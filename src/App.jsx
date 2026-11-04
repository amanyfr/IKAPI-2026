import React from 'react';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import AnggotaPortal from './portals/AnggotaPortal';
import Admin1Portal from './portals/Admin1Portal';
import Admin2Portal from './portals/Admin2Portal';
import AdminPortal from './portals/AdminPortal';
import OnboardingPage from './pages/OnboardingPage';

export default function App() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-800">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs tracking-wider text-slate-500 font-bold uppercase">
            Memuat Sistem IKAPI Jawa Barat...
          </p>
        </div>
      </div>
    );
  }

  // Jika belum login, tampilkan halaman Login & Register putih dengan aksen biru
  if (!isAuthenticated || !user) {
    return <AuthPage />;
  }

  // Halaman terpisah sesuai role pengguna
  if (user.role === 'Admin') {
    return <AdminPortal />;
  }

  if (user.role === 'Ketua') {
    return <Admin2Portal />;
  }

  if (user.role === 'Sekretaris') {
    return <Admin1Portal />;
  }

  // Anggota baru menjawab pertanyaan status & kategori keanggotaan dulu (login pertama)
  if (!user.onboarded_at) {
    return <OnboardingPage />;
  }

  return <AnggotaPortal />;
}
