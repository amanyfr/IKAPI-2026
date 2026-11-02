import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, Phone, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff, ChevronLeft } from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState('login');

  /* ── Login state ── */
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw,   setShowLoginPw]   = useState(false);

  /* ── Register state ── */
  const [regName,     setRegName]     = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone,    setRegPhone]    = useState('');
  const [showRegPw,   setShowRegPw]   = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const switchTab = (tab) => { setActiveTab(tab); setError(''); setSuccess(''); };

  /* ── Login handler ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      // App.jsx otomatis mendeteksi role & mengarahkan ke dashboard yang sesuai
    } catch (err) {
      setError(err.message || 'Email atau kata sandi salah. Silakan periksa kembali.');
    } finally { setLoading(false); }
  };

  /* ── Register handler ── */
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (regPassword.length < 6) { setError('Kata sandi minimal 6 karakter.'); return; }
    setLoading(true);
    try {
      await register({
        name:          regName,
        email:         regEmail,
        password:      regPassword,
        phone:         regPhone,
        publisherName: regName,   // default, bisa dilengkapi di profil
        category:      'Biasa',
        legalEntity:   'PT'
      });
      setSuccess('Akun berhasil dibuat! Mengarahkan ke dashboard...');
    } catch (err) {
      setError(err.message || 'Pendaftaran gagal. Silakan coba kembali.');
    } finally { setLoading(false); }
  };

  /* ── Shared styles ── */
  const inputBase =
    'w-full pl-11 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl ' +
    'focus:bg-white focus:border-[#0da2e7] focus:ring-2 focus:ring-[#dff2fd] ' +
    'outline-none transition placeholder:text-slate-300';
  const inputWithEye = inputBase + ' pr-12';
  const submitBtn =
    'w-full py-3.5 bg-[#0da2e7] hover:bg-[#0884c4] active:bg-[#096ba0] disabled:opacity-60 ' +
    'text-white font-bold text-sm rounded-xl shadow-lg shadow-[#0da2e7]/25 ' +
    'transition-all duration-150 flex items-center justify-center gap-2 mt-1';

  /* ── Field label ── */
  const Label = ({ children }) => (
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
      {children}
    </label>
  );

  return (
    <div className="min-h-screen bg-[#f8fbfe] flex flex-col font-sans">

      {/* ── Top Bar ── */}
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <div className="flex items-center gap-3">
            <img src="/logo-ikapi.jpg" alt="IKAPI" className="w-10 h-10 rounded-xl object-cover" />
            <div className="leading-tight">
              <p className="font-black text-[#0da2e7] text-base tracking-tight">IKAPI</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pengurus Daerah Jawa Barat</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* ══════════════════════════════════
                HALAMAN LOGIN
              ══════════════════════════════════ */}
          {activeTab === 'login' && (
            <div className="bg-white rounded-3xl shadow-xl shadow-[#0da2e7]/10 border border-[#b8e6fc]/50 overflow-hidden">

              {/* Kartu header */}
              <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4 mb-6">
                  <img
                    src="/logo-ikapi.jpg" alt="IKAPI"
                    className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-[#0da2e7]/20 ring-4 ring-[#dff2fd]"
                  />
                  <div>
                    <p className="text-xl font-black text-[#0da2e7] tracking-tight leading-none">IKAPI</p>
                    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">Ikatan Penerbit Indonesia</p>
                    <p className="text-xs text-slate-400">Pengurus Daerah Jawa Barat</p>
                  </div>
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Masuk ke Akun</h1>
                <p className="text-sm text-slate-500 mt-1">
                  Sistem akan mendeteksi peran Anda secara otomatis setelah login.
                </p>
              </div>

              {/* Kartu body */}
              <div className="px-8 py-7 space-y-5">
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Email */}
                  <div>
                    <Label>Email / Username</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email" required autoFocus
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="email@penerbit.co.id"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label>Kata Sandi</Label>
                      <button type="button" className="text-xs text-[#0da2e7] hover:underline font-medium -mt-0.5">
                        Lupa sandi?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showLoginPw ? 'text' : 'password'} required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Kata sandi Anda"
                        className={inputWithEye}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPw(!showLoginPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0da2e7]"
                      >
                        {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className={submitBtn}>
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Memverifikasi...
                      </>
                    ) : (
                      <>Masuk <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              </div>

              {/* Kartu footer */}
              <div className="px-8 py-5 bg-[#f8fbfe] border-t border-slate-100 text-center">
                <p className="text-sm text-slate-500">
                  Belum memiliki akun?{' '}
                  <button onClick={() => switchTab('register')}
                    className="text-[#0da2e7] font-semibold hover:underline">
                    Daftar sebagai pemohon
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
                HALAMAN REGISTER
              ══════════════════════════════════ */}
          {activeTab === 'register' && (
            <div className="bg-white rounded-3xl shadow-xl shadow-[#0da2e7]/10 border border-[#b8e6fc]/50 overflow-hidden">

              {/* Kartu header */}
              <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                <button onClick={() => switchTab('login')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-[#0da2e7] transition mb-5">
                  <ChevronLeft className="w-3.5 h-3.5" /> Kembali ke Login
                </button>
                <div className="flex items-center gap-4 mb-5">
                  <img
                    src="/logo-ikapi.jpg" alt="IKAPI"
                    className="w-14 h-14 rounded-2xl object-cover shadow-lg shadow-[#0da2e7]/20 ring-4 ring-[#dff2fd]"
                  />
                  <div>
                    <p className="text-xl font-black text-[#0da2e7] tracking-tight leading-none">IKAPI</p>
                    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">Ikatan Penerbit Indonesia</p>
                    <p className="text-xs text-slate-400">Pengurus Daerah Jawa Barat</p>
                  </div>
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Buat Akun Baru</h1>
                <p className="text-sm text-slate-500 mt-1">
                  Daftarkan diri Anda sebagai pemohon keanggotaan IKAPI Jawa Barat
                </p>
              </div>

              {/* Kartu body */}
              <div className="px-8 py-7 space-y-5">
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                    <span>{success}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">

                  {/* Nama Lengkap */}
                  <div>
                    <Label>Nama Lengkap</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text" required autoFocus
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Nama lengkap Anda"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <Label>Email / Username</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email" required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="email@penerbit.co.id"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  {/* Kata Sandi */}
                  <div>
                    <Label>Kata Sandi</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showRegPw ? 'text' : 'password'} required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className={inputWithEye}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPw(!showRegPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0da2e7]"
                      >
                        {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Nomor Telepon */}
                  <div>
                    <Label>Nomor Telepon</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel" required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="08XXXXXXXXXX"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed pt-1">
                    Dengan mendaftar, Anda menyetujui bahwa data yang diisikan adalah benar dan sah untuk keperluan keanggotaan IKAPI Pengurus Daerah Jawa Barat.
                  </p>

                  <button type="submit" disabled={loading} className={submitBtn}>
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Mendaftarkan...
                      </>
                    ) : (
                      <>Daftar Sekarang <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              </div>

              {/* Kartu footer */}
              <div className="px-8 py-5 bg-[#f8fbfe] border-t border-slate-100 text-center">
                <p className="text-sm text-slate-500">
                  Sudah punya akun?{' '}
                  <button onClick={() => switchTab('login')}
                    className="text-[#0da2e7] font-semibold hover:underline">
                    Masuk di sini
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* Bottom copyright */}
          <p className="text-center text-xs text-slate-400 mt-6">
            © 2026 IKAPI Pengurus Daerah Jawa Barat · Jl. Ibu Inggit Garnasih No. 148, Bandung
          </p>
        </div>
      </main>
    </div>
  );
}
