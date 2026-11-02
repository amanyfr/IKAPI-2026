import React, { useState, useEffect } from 'react';
import { Settings, Save, Building, CreditCard, Award, FileText, CheckCircle } from 'lucide-react';

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    bank_name: 'Bank BNI',
    bank_account: '2089992087',
    bank_holder: 'Abdul Rasyid',
    fee_uang_pangkal: '250000',
    fee_iuran_bulanan: '50000',
    fee_iuran_durasi_bulan: '24',
    fee_administrasi: '250000',
    fee_heregistrasi_iuran: '1200000',
    ketua_nama: 'Dr. H. Mahpudi, M.T.',
    ketua_jabatan: 'Ketua Pengurus Daerah IKAPI Jawa Barat',
    sekretaris_nama: 'Drs. H. Anwar Rosyid, M.Si.',
    sekretaris_jabatan: 'Sekretaris PD IKAPI Jawa Barat',
    surat_counter: '14'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ikapi_token')}`
        },
        body: JSON.stringify({ settings })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg('Pengaturan sistem berhasil diperbarui.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalBaru = Number(settings.fee_uang_pangkal) + (Number(settings.fee_iuran_bulanan) * Number(settings.fee_iuran_durasi_bulan)) + Number(settings.fee_administrasi);
  const totalHeregistrasi = Number(settings.fee_heregistrasi_iuran);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-900 rounded-xl text-white">
            <Settings className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Pengaturan Sistem & Parameter Biaya IKAPI Jabar
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Konfigurasi rekening resmi asosiasi, rincian biaya keanggotaan, serta data penandatangan resmi.
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* CARD 1: REKENING TUJUAN PEMBAYARAN */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b pb-3">
            <CreditCard className="w-5 h-5 text-blue-900" />
            <h3 className="font-bold text-slate-900 text-sm">
              Rekening Bank Tujuan Pembayaran Iuran
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Bank Resmi *
              </label>
              <input
                type="text"
                name="bank_name"
                value={settings.bank_name}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nomor Rekening *
              </label>
              <input
                type="text"
                name="bank_account"
                value={settings.bank_account}
                onChange={handleChange}
                className="w-full text-xs p-2.5 font-mono font-bold text-blue-950 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Atas Nama Pemilik Rekening *
              </label>
              <input
                type="text"
                name="bank_holder"
                value={settings.bank_holder}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              />
            </div>
          </div>
        </div>

        {/* CARD 2: RINCIAN BIAYA RESMI */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-sm">
                Struktur Tarif & Biaya Keanggotaan
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Kalkulasi Tagihan Baru:</span>
              <span className="text-xs font-black text-amber-700">Rp {totalBaru.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Uang Pangkal (Baru)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">Rp</span>
                <input
                  type="number"
                  name="fee_uang_pangkal"
                  value={settings.fee_uang_pangkal}
                  onChange={handleChange}
                  className="w-full text-xs pl-8 pr-2.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Iuran per Bulan
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">Rp</span>
                <input
                  type="number"
                  name="fee_iuran_bulanan"
                  value={settings.fee_iuran_bulanan}
                  onChange={handleChange}
                  className="w-full text-xs pl-8 pr-2.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Durasi Bayar (Bulan)
              </label>
              <input
                type="number"
                name="fee_iuran_durasi_bulan"
                value={settings.fee_iuran_durasi_bulan}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Biaya Administrasi
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">Rp</span>
                <input
                  type="number"
                  name="fee_administrasi"
                  value={settings.fee_administrasi}
                  onChange={handleChange}
                  className="w-full text-xs pl-8 pr-2.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Total Biaya Heregistrasi (24 Bulan)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">Rp</span>
                <input
                  type="number"
                  name="fee_heregistrasi_iuran"
                  value={settings.fee_heregistrasi_iuran}
                  onChange={handleChange}
                  className="w-full text-xs pl-8 pr-2.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: DATA PENGURUS & TTD RESMI */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b pb-3">
            <Building className="w-5 h-5 text-blue-900" />
            <h3 className="font-bold text-slate-900 text-sm">
              Pejabat Penandatangan Surat Rekomendasi Resmi
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Ketua PD IKAPI Jabar *
              </label>
              <input
                type="text"
                name="ketua_nama"
                value={settings.ketua_nama}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Sekretaris PD IKAPI Jabar *
              </label>
              <input
                type="text"
                name="sekretaris_nama"
                value={settings.sekretaris_nama}
                onChange={handleChange}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nomor Urut Surat Terakhir (Counter)
              </label>
              <input
                type="number"
                name="surat_counter"
                value={settings.surat_counter}
                onChange={handleChange}
                className="w-full text-xs p-2.5 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Format: <code>{`{urut}/PD-Ikapi Jabar/{bulan_romawi}/{tahun}`}</code>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2"
          >
            <Save className="w-4 h-4 text-amber-400" />
            {saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
          </button>
        </div>

      </form>

    </div>
  );
}

