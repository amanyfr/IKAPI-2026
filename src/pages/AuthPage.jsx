import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, Phone, AlertCircle, CheckCircle2, Eye, EyeOff, ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';
import { waLink } from '../utils/whatsapp';
import { FILTERS } from '../utils/inputFilters';

// Tautan dari email: /?verify=<token> (verifikasi email) atau /?reset=<token> (atur ulang sandi)
const urlParams = new URLSearchParams(window.location.search);
const initialResetToken = urlParams.get('reset') || '';
const initialVerifyToken = urlParams.get('verify') || '';

function clearUrlToken() {
  window.history.replaceState(null, '', window.location.pathname);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan. Silakan coba lagi.');
  return data;
}

export default function AuthPage() {
  const { login, register } = useAuth();
  // login | register | forgot | reset
  const [activeTab, setActiveTab] = useState(initialResetToken ? 'reset' : 'login');
  const [resetToken] = useState(initialResetToken);
  const [resetPassword, setResetPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

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

  const switchTab = (tab) => { setActiveTab(tab); setError(''); setSuccess(''); setUnverifiedEmail(''); };

  /* ── Nomor WhatsApp Admin dari Pengaturan Sistem (bisa diganti Admin) ── */
  const [adminWa, setAdminWa] = useState('');
  useEffect(() => {
    fetch('/api/public/contact')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setAdminWa(d.admin_whatsapp || ''))
      .catch(() => {});
  }, []);

  /* ── Verifikasi email dari tautan ?verify= ── */
  useEffect(() => {
    if (!initialVerifyToken) return;
    clearUrlToken();
    postJson('/api/auth/verify-email', { token: initialVerifyToken })
      .then((data) => setSuccess(data.message))
      .catch((err) => setError(err.message));
  }, []);

  /* ── Login handler ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setUnverifiedEmail(''); setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      // App.jsx otomatis mendeteksi role & mengarahkan ke dashboard yang sesuai
    } catch (err) {
      setError(err.message || 'Email atau kata sandi salah. Silakan periksa kembali.');
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(loginEmail);
    } finally { setLoading(false); }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const data = await postJson('/api/auth/resend-verification', { email: unverifiedEmail });
      setError(''); setUnverifiedEmail('');
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  /* ── Atur kata sandi baru dari tautan ?reset= ── */
  const handleReset = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (resetPassword.length < 6) { setError('Kata sandi minimal 6 karakter.'); return; }
    setLoading(true);
    try {
      const data = await postJson('/api/auth/reset-password', { token: resetToken, password: resetPassword });
      clearUrlToken();
      setResetPassword('');
      setActiveTab('login');
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
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
      const data = await register({
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
      setSuccess(data?.message || 'Pendaftaran akun berhasil! Silakan masuk menggunakan email dan kata sandi Anda.');
    } catch (err) {
      setError(err.message || 'Pendaftaran gagal. Silakan coba kembali.');
    } finally { setLoading(false); }
  };

  /* ── Shared styles (kartu putih di atas foto) ── */
  const inputBase =
    'w-full h-12 pl-11 pr-4 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl ' +
    'hover:border-slate-300 focus:border-[#0884c4] focus:ring-4 focus:ring-sky-100 ' +
    'outline-none transition placeholder:text-slate-400';
  const inputWithEye = inputBase + ' pr-12';
  const iconBase = 'absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none';
  const eyeBtn = 'absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0da2e7] transition';
  const submitBtn =
    'group w-full h-12 bg-[#0884c4] hover:bg-[#076fa5] active:bg-[#065d8a] disabled:opacity-60 ' +
    'text-white font-semibold text-sm rounded-xl shadow-sm ' +
    'transition-colors duration-150 flex items-center justify-center gap-2 !mt-6';
  const tabBtn = (tab) =>
    'relative z-10 h-9 text-sm font-semibold rounded-[10px] transition-colors ' +
    (activeTab === tab ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800');
  // Alur keanggotaan yang ditampilkan di panel kiri (sesuai proses di sistem)
  const steps = [
    'Buat akun & lengkapi data penerbit',
    'Unggah berkas & bukti pembayaran iuran',
    'Diperiksa Admin, Sekretaris & Ketua',
    'Surat rekomendasi terbit, diteruskan ke Pusat',
  ];

  /* ── Field label ── */
  const Label = ({ children }) => (
    <label className="text-[13px] font-medium text-slate-700 block mb-1.5">{children}</label>
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
          <div>
            <span>{error}</span>
            {unverifiedEmail && (
              <button type="button" onClick={handleResendVerification} disabled={loading}
                className="block mt-1.5 text-xs font-semibold text-[#0884c4] hover:underline disabled:opacity-60">
                Kirim ulang tautan verifikasi
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="auth-bg relative min-h-screen font-sans text-slate-900">

      {/* ── Latar putih dengan gerak halus ── */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-blob auth-blob-3" />
        <div className="auth-grid absolute inset-0" />
        <div className="auth-float hidden xl:block w-16 h-20 top-[12%] left-[3%]" style={{ '--r': '-8deg', animationDelay: '0s' }} />
        <div className="auth-float hidden xl:block w-12 h-16 bottom-[14%] left-[5%]" style={{ '--r': '10deg', animationDelay: '-3s' }} />
        <div className="auth-float hidden xl:block w-14 h-[4.5rem] top-[16%] right-[3%]" style={{ '--r': '6deg', animationDelay: '-5s' }} />
        <div className="auth-float hidden xl:block w-10 h-14 bottom-[12%] right-[5%]" style={{ '--r': '-12deg', animationDelay: '-7s' }} />
      </div>

      <div className="relative min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8">

          <div className="auth-card w-full max-w-[440px] lg:max-w-[960px] lg:min-h-[640px] lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] rounded-[28px] bg-white border border-slate-200/80 shadow-[0_30px_80px_-40px_rgba(11,26,74,0.45)] overflow-hidden">

            {/* ── Panel kiri (desktop): identitas + alur keanggotaan ── */}
            <aside className="auth-aside hidden lg:flex flex-col p-9 text-white">
              <div className="flex items-center gap-3">
                <img src="/logo-ikapi.jpg" alt="Logo IKAPI" className="auth-logo w-11 h-11 rounded-full object-cover bg-white" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">IKAPI Jawa Barat</p>
                  <p className="text-xs text-white/60">Ikatan Penerbit Indonesia</p>
                </div>
              </div>

              <div className="my-auto py-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300/90">Sistem keanggotaan</p>
                <h2 className="mt-3 text-[26px] leading-[1.25] font-semibold tracking-tight [text-wrap:balance]">
                  Daftar, unggah berkas, dan pantau keanggotaan penerbit Anda.
                </h2>
                <ol className="mt-7">
                  {steps.map((text, i) => {
                    const on = activeTab === 'register' && i === 0;
                    return (
                      <li key={text} className="relative flex items-start gap-3.5 pb-4 last:pb-0">
                        {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-[13px] top-7 bottom-0 w-px bg-white/15" />}
                        <span className={`relative w-7 h-7 flex-shrink-0 rounded-full border text-[11px] font-semibold tabular-nums flex items-center justify-center transition-colors ${on ? 'bg-white text-[#0b1a4a] border-white' : 'border-white/30 text-white/80'}`}>
                          {i + 1}
                        </span>
                        <span className={`pt-[5px] text-sm leading-snug transition-colors ${on ? 'text-white font-medium' : 'text-white/70'}`}>{text}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <p className="text-xs text-white/50 leading-relaxed">
                Sekretariat: Jl. Ibu Inggit Garnasih No. 148, Bandung
              </p>
            </aside>

            {/* ── Panel kanan: formulir ── */}
            <div className="p-6 sm:p-9 lg:flex lg:flex-col">

            {/* Logo (HP/tablet) */}
            <div className="lg:hidden flex items-center gap-3 mb-7">
              <img src="/logo-ikapi.jpg" alt="Logo IKAPI" className="auth-logo w-10 h-10 rounded-full object-cover bg-white ring-1 ring-slate-200" />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">IKAPI Jawa Barat</p>
                <p className="text-xs text-slate-500">Sistem keanggotaan</p>
              </div>
            </div>

            {/* Tab Masuk / Daftar dengan penanda yang bergeser */}
            <div className="relative grid grid-cols-2 p-1 mb-7 bg-slate-100 rounded-xl">
              <span
                aria-hidden="true"
                className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-[10px] bg-white shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 ease-out ${activeTab === 'register' ? 'translate-x-full' : ''} ${activeTab === 'login' || activeTab === 'register' ? 'opacity-100' : 'opacity-0'}`}
              />
              <button type="button" onClick={() => switchTab('login')} className={tabBtn('login')}>
                Masuk
              </button>
              <button type="button" onClick={() => switchTab('register')} className={tabBtn('register')}>
                Daftar
              </button>
            </div>

            {/* ── HALAMAN LOGIN ── */}
            {activeTab === 'login' && (
              <div key="login" className="auth-pane">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Masuk ke akun</h1>
                <p className="text-sm text-slate-500 leading-relaxed mt-1.5 mb-6">
                  Gunakan email yang terdaftar. Halaman akan menyesuaikan peran akun Anda setelah masuk.
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
                      <button
                        type="button"
                        onClick={() => { setForgotEmail(loginEmail); switchTab('forgot'); }}
                        className="text-xs font-medium text-[#0884c4] hover:underline -mt-1.5"
                      >
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
                      <>Masuk <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
                    )}
                  </button>
                </form>

                <p className="text-sm text-slate-500 text-center mt-6 pt-6 border-t border-slate-100">
                  Belum memiliki akun?{' '}
                  <button onClick={() => switchTab('register')} className="text-[#0884c4] font-semibold hover:underline">
                    Daftar sebagai pemohon
                  </button>
                </p>
              </div>
            )}

            {/* ── HALAMAN REGISTER ── */}
            {activeTab === 'register' && (
              <div key="register" className="auth-pane">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Buat akun baru</h1>
                <p className="text-sm text-slate-500 leading-relaxed mt-1.5 mb-6">
                  Isi data singkat. Berkas keanggotaan dilengkapi setelah masuk.
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Kata sandi</Label>
                    <div className="relative">
                      <Lock className={iconBase} />
                      <input
                        type={showRegPw ? 'text' : 'password'} required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min. 6 karakter"
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
                        onChange={(e) => setRegPhone(FILTERS.phone(e.target.value))}
                        placeholder="08XXXXXXXXXX"
                        className={inputBase}
                      />
                    </div>
                  </div>
                  </div>

                  <button type="submit" disabled={loading} className={submitBtn}>
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Mendaftarkan...
                      </>
                    ) : (
                      <>Daftar sekarang <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
                    )}
                  </button>
                  <p className="text-xs text-slate-400 text-center leading-relaxed !mt-3">
                    Dengan mendaftar, Anda menyatakan data yang diisi benar dan sah.
                  </p>
                </form>

                <p className="text-sm text-slate-500 text-center mt-5 pt-5 border-t border-slate-100">
                  Sudah punya akun?{' '}
                  <button onClick={() => switchTab('login')} className="text-[#0884c4] font-semibold hover:underline">
                    Masuk di sini
                  </button>
                </p>
              </div>
            )}

            {/* ── LUPA SANDI ── */}
            {activeTab === 'forgot' && (
              <div key="forgot" className="auth-pane">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Lupa kata sandi</h1>
                <p className="text-sm text-slate-500 leading-relaxed mt-1.5 mb-6">
                  Hubungi Admin sekretariat lewat WhatsApp untuk mengatur ulang kata sandi Anda.
                </p>
                <Alerts />

                {waLink(adminWa) && (
                  <a
                    href={waLink(adminWa, `Halo Admin IKAPI Jawa Barat, saya lupa kata sandi akun${forgotEmail ? ` dengan email ${forgotEmail}` : ''}. Mohon dibantu atur ulang.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-5 flex items-center gap-3 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition"
                  >
                    <span className="w-9 h-9 rounded-full bg-[#25d366] text-white flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-emerald-900">Hubungi Admin via WhatsApp</span>
                      <span className="block text-xs text-emerald-700">{adminWa} · lebih cepat dibantu</span>
                    </span>
                  </a>
                )}

                {!waLink(adminWa) && (
                  <p className="mb-5 p-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-600">
                    Silakan hubungi Admin sekretariat IKAPI Jawa Barat untuk mengatur ulang kata sandi.
                  </p>
                )}

                <button onClick={() => switchTab('login')} className="mt-7 mx-auto flex items-center gap-1.5 text-sm text-[#0884c4] font-semibold hover:underline">
                  <ArrowLeft className="w-4 h-4" /> Kembali ke halaman masuk
                </button>
              </div>
            )}

            {/* ── ATUR ULANG SANDI (dari tautan email) ── */}
            {activeTab === 'reset' && (
              <div key="reset" className="auth-pane">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kata sandi baru</h1>
                <p className="text-sm text-slate-500 leading-relaxed mt-1.5 mb-6">
                  Buat kata sandi baru untuk akun Anda.
                </p>
                <Alerts />

                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <Label>Kata sandi baru</Label>
                    <div className="relative">
                      <Lock className={iconBase} />
                      <input
                        type={showLoginPw ? 'text' : 'password'} required autoFocus
                        minLength={6}
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
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
                    {loading ? 'Menyimpan...' : 'Simpan kata sandi baru'}
                  </button>
                </form>

                <button onClick={() => { clearUrlToken(); switchTab('login'); }} className="mt-7 mx-auto flex items-center gap-1.5 text-sm text-[#0884c4] font-semibold hover:underline">
                  <ArrowLeft className="w-4 h-4" /> Kembali ke halaman masuk
                </button>
              </div>
            )}
            </div>
          </div>
        </main>

        <footer className="px-4 pb-6 text-center">
          <p className="text-xs text-slate-400">
            © 2026 IKAPI Pengurus Daerah Jawa Barat<span className="lg:hidden"> · Jl. Ibu Inggit Garnasih No. 148, Bandung</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
