import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, User, Phone, Building2, CheckCircle, Sparkles } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register, quickSwitch } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    publisherName: '',
    category: 'Biasa',
    legalEntity: 'PT'
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(formData);
        setSuccess('Pendaftaran berhasil! Akun dan email Anda telah terverifikasi.');
        setTimeout(() => onClose(), 1500);
      } else {
        await login(formData.email, formData.password);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSwitch = async (role, email) => {
    await quickSwitch(role, email);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-blue-900 text-white p-6 border-b-2 border-amber-500 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-amber-400/40">
              <svg viewBox="0 0 100 100" className="w-6 h-6">
                <rect width="100" height="100" rx="15" fill="#0b2545" />
                <path d="M20 75 L50 20 L80 75 Z" fill="#f59e0b" />
                <path d="M35 75 L50 45 L65 75 Z" fill="#ffffff" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                {isRegister ? 'Pendaftaran Akun IKAPI' : 'Masuk ke Portal IKAPI'}
              </h3>
              <p className="text-xs text-blue-200">
                Pengurus Daerah Jawa Barat
              </p>
            </div>
          </div>
        </div>

        {/* Quick Demo Login Pills */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Masuk Cepat Demo:
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => handleDemoSwitch(null, 'admin1@ikapi-jabar.or.id')}
              className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-medium rounded-lg text-left truncate transition border border-blue-200"
            >
              🛡️ Sekretaris
            </button>
            <button
              type="button"
              onClick={() => handleDemoSwitch(null, 'admin2@ikapi-jabar.or.id')}
              className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium rounded-lg text-left truncate transition border border-amber-200"
            >
              👑 Ketua
            </button>
            <button
              type="button"
              onClick={() => handleDemoSwitch(null, 'mizan@penerbit.id')}
              className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-medium rounded-lg text-left truncate transition border border-emerald-200"
            >
              📖 Anggota Biasa
            </button>
            <button
              type="button"
              onClick={() => handleDemoSwitch(null, 'press@unpad.ac.id')}
              className="px-2 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 font-medium rounded-lg text-left truncate transition border border-purple-200"
            >
              🏛️ Univ Press
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Nama Lengkap Pemohon / Pimpinan *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Nama lengkap..."
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Alamat Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@penerbit.co.id"
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Kata Sandi *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimal 6 karakter..."
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Nomor WhatsApp / HP Pemohon *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="0812XXXXXXXX"
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Nama Penerbit / Lembaga Press *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      name="publisherName"
                      value={formData.publisherName}
                      onChange={handleChange}
                      placeholder="Contoh: PT Pustaka Jaya"
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Kategori
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                    >
                      <option value="Biasa">Biasa (PT/CV)</option>
                      <option value="Luar Biasa">Luar Biasa (Univ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Badan Hukum
                    </label>
                    <select
                      name="legalEntity"
                      value={formData.legalEntity}
                      onChange={handleChange}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                    >
                      <option value="PT">PT</option>
                      <option value="CV">CV</option>
                      <option value="Perguruan Tinggi">Perguruan Tinggi</option>
                      <option value="Yayasan">Yayasan</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition"
            >
              {loading ? 'Memproses...' : isRegister ? 'Daftar Akun Baru' : 'Masuk Sekarang'}
            </button>
          </form>

          {/* Switch Register/Login */}
          <div className="text-center mt-4 pt-3 border-t border-slate-100">
            {isRegister ? (
              <p className="text-xs text-slate-600">
                Sudah memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegister(false)}
                  className="text-blue-900 font-bold hover:underline"
                >
                  Masuk di sini
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-600">
                Belum terdaftar sebagai penerbit?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegister(true)}
                  className="text-amber-600 font-bold hover:underline"
                >
                  Daftar akun baru
                </button>
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

