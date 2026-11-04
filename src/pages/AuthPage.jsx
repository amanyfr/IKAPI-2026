import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, Phone, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

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
    setSuccess('');
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
      setLoginEmail(regEmail);
      setLoginPassword('');
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      setRegPhone('');
      setActiveTab('login');
      setSuccess('Pendaftaran akun berhasil! Silakan masuk menggunakan email dan kata sandi Anda.');
    } catch (err) {
      setError(err.message || 'Pendaftaran gagal. Silakan coba kembali.');
    } finally { setLoading(false); }
  };

  /* ── Shared styles (kartu putih di atas foto) ── */
  const inputBase =
    'w-full pl-11 pr-4 py-3 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl ' +
    'focus:bg-white focus:border-[#0da2e7] focus:ring-2 focus:ring-sky-100 ' +
    'outline-none transition placeholder:text-slate-400';
  const inputWithEye = inputBase + ' pr-12';
  const iconBase = 'absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none';
  const eyeBtn = 'absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0da2e7] transition';
  const submitBtn =
    'w-full py-3.5 bg-[#0da2e7] hover:bg-[#0884c4] disabled:opacity-60 ' +
    'text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-600/25 ' +
    'transition-all duration-150 flex items-center justify-center gap-2 mt-2';
  const tabBtn = (tab) =>
    'px-5 py-2 text-sm font-semibold rounded-full transition ' +
    (activeTab === tab
      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
      : 'text-slate-500 hover:text-slate-900');

  /* ── Field label ── */
  const Label = ({ children }) => (
    <label className="text-xs font-semibold text-slate-600 block mb-1.5">{children}</label>
  );

  const Alerts = () => (
    <>
      {success && (
        <div className="flex items-start gap-3 p-3.5 mb-5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 p-3.5 mb-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
          <span>{error}</span>
        </div>
      )}
    </>
  );

  return (
    <div className="relative min-h-screen font-sans text-white bg-slate-900">

      {/* ── Latar foto buku IKAPI (fokus ke buku) ── */}
      <div aria-hidden="true" className="fixed inset-0 bg-[url('/bg-ikapi-buku.webp')] bg-cover bg-[position:45%_75%]" />
      <div aria-hidden="true" className="fixed inset-0 bg-gradient-to-b from-slate-950/35 via-blue-950/10 to-slate-950/45" />

      <div className="relative min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center px-4 py-10">

          {/* ══════════════════════════════════
                KARTU LOGIN
              ══════════════════════════════════ */}
          <div className="w-full max-w-[440px] rounded-[28px] bg-white text-slate-900 shadow-2xl shadow-slate-950/40 p-6 sm:p-9">

            {/* Tab Masuk / Daftar + logo */}
            <div className="flex items-center justify-between gap-4 mb-8">
              <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-full">
                <button type="button" onClick={() => switchTab('login')} className={tabBtn('login')}>
                  Masuk
                </button>
                <button type="button" onClick={() => switchTab('register')} className={tabBtn('register')}>
                  Daftar
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="text-right leading-tight hidden sm:block">
                  <p className="text-sm font-bold tracking-wider text-[#0884c4]">IKAPI</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Jawa Barat</p>
                </div>
                <img src="/logo-ikapi.jpg" alt="Logo IKAPI" className="w-11 h-11 rounded-full object-cover bg-white ring-2 ring-slate-100" />
              </div>
            </div>

            {/* ── HALAMAN LOGIN ── */}
            {activeTab === 'login' && (
              <div>
                <h1 className="text-3xl font-light tracking-tight">Masuk ke akun</h1>
                <p className="text-sm text-slate-500 mt-1.5 mb-7">
                  Sistem keanggotaan IKAPI Pengurus Daerah Jawa Barat. Peran Anda terdeteksi otomatis setelah login.
                </p>
                <Alerts />

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <div className="relative">
                      <Mail className={iconBase} />
                      <input
                        type="email" required autoFocus
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="email@penerbit.co.id"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Kata sandi</Label>
                      <button type="button" className="text-xs text-[#0884c4] hover:underline -mt-1.5">
                        Lupa sandi?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className={iconBase} />
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
                        aria-label={showLoginPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        className={eyeBtn}
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
                      <>Masuk</>
                    )}
                  </button>
                </form>

                <p className="text-sm text-slate-500 text-center mt-7">
                  Belum memiliki akun?{' '}
                  <button onClick={() => switchTab('register')} className="text-[#0884c4] font-semibold hover:underline">
                    Daftar sebagai pemohon
                  </button>
                </p>
              </div>
            )}

            {/* ── HALAMAN REGISTER ── */}
            {activeTab === 'register' && (
              <div>
                <h1 className="text-3xl font-light tracking-tight">Buat akun baru</h1>
                <p className="text-sm text-slate-500 mt-1.5 mb-7">
                  Daftarkan diri Anda sebagai pemohon keanggotaan IKAPI Jawa Barat.
                </p>
                <Alerts />

                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label>Nama lengkap</Label>
                    <div className="relative">
                      <User className={iconBase} />
                      <input
                        type="text" required autoFocus
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Nama lengkap Anda"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Email</Label>
                    <div className="relative">
                      <Mail className={iconBase} />
                      <input
                        type="email" required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="email@penerbit.co.id"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Kata sandi</Label>
                    <div className="relative">
                      <Lock className={iconBase} />
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
                        aria-label={showRegPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        className={eyeBtn}
                      >
                        {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label>Nomor telepon</Label>
                    <div className="relative">
                      <Phone className={iconBase} />
                      <input
                        type="tel" required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="08XXXXXXXXXX"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className={submitBtn}>
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Mendaftarkan...
                      </>
                    ) : (
                      <>Daftar sekarang</>
                    )}
                  </button>
                </form>

                <p className="text-xs text-slate-400 text-center leading-relaxed mt-6">
                  Dengan mendaftar, Anda menyetujui bahwa data yang diisikan adalah benar dan sah untuk keperluan keanggotaan IKAPI Pengurus Daerah Jawa Barat.
                </p>
              </div>
            )}
          </div>
        </main>

        <footer className="px-4 pb-6 text-center">
          <p className="text-xs text-white/60">
            © 2026 IKAPI Pengurus Daerah Jawa Barat · Jl. Ibu Inggit Garnasih No. 148, Bandung
          </p>
        </footer>
      </div>
    </div>
  );
}
