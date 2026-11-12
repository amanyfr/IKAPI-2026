import React, { createContext, useContext, useState, useEffect } from 'react';
import { notify } from '../components/AppDialog';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ikapi_token') || null);
  const [loading, setLoading] = useState(true);

  // Fetch current user if token exists
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Token expired or invalid
          localStorage.removeItem('ikapi_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  // Login
  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Login gagal.');
      err.code = data.code; // mis. EMAIL_NOT_VERIFIED
      throw err;
    }
    localStorage.setItem('ikapi_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  // Register (mendaftarkan akun baru tanpa langsung login otomatis, diarahkan ke halaman login)
  const register = async (formData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Pendaftaran gagal.');
    }
    return data;
  };

  // Quick switch role for testing / demo
  const quickSwitch = async (role, email) => {
    try {
      const res = await fetch('/api/auth/quick-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('ikapi_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (err) {
      console.error('Quick switch error:', err);
      notify('Gagal beralih peran: ' + err.message);
    }
  };

  // Perbarui data pengguna di memori (mis. setelah menjawab pertanyaan login pertama)
  // Data sama persis (mis. hasil polling /me) tidak memicu render ulang, supaya halaman tidak berkedip
  const updateUser = (nextUser) =>
    setUser((prev) => (prev && nextUser && JSON.stringify(prev) === JSON.stringify(nextUser) ? prev : nextUser));

  // Logout
  const logout = () => {
    // Hapus cookie sesi (dipakai untuk membuka file) di server
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('ikapi_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        quickSwitch,
        updateUser,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'Admin',
        isSekretaris: user?.role === 'Sekretaris',
        isKetua: user?.role === 'Ketua',
        isAnggota: user?.role === 'Anggota'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

