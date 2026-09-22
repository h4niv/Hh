import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  User, 
  Crown, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Fingerprint, 
  Sparkles, 
  Search, 
  Check, 
  ShieldAlert,
  Info,
  Clock,
  MapPin
} from 'lucide-react';
import { Employee, OfficeConfig } from '../types';

interface LoginPageProps {
  employees: Employee[];
  officeConfig: OfficeConfig;
  onLogin: (employee: Employee) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  employees,
  officeConfig,
  onLogin,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [showRoleInfoModal, setShowRoleInfoModal] = useState(false);
  const [searchDirectoryQuery, setSearchDirectoryQuery] = useState('');
  const [showDirectoryList, setShowDirectoryList] = useState(false);

  // Quick Preset Profiles for Easy Testing
  const superadminUser = employees.find(e => e.systemRole === 'superadmin') || employees[0];
  const adminUser = employees.find(e => e.systemRole === 'admin') || employees[1] || employees[0];
  const regularUser = employees.find(e => e.systemRole === 'karyawan') || employees[2] || employees[0];

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim().toLowerCase();
    if (!cleanIdentifier) {
      setErrorMessage('Silakan masukkan NIK, Email, atau No. Handphone.');
      return;
    }

    // Find employee by NIK, email, phone, or name
    const foundEmployee = employees.find(emp => 
      emp.nik.toLowerCase().trim() === cleanIdentifier ||
      emp.email.toLowerCase().trim() === cleanIdentifier ||
      emp.phone.replace(/[\s-+]/g, '') === cleanIdentifier.replace(/[\s-+]/g, '') ||
      emp.name.toLowerCase().trim() === cleanIdentifier
    );

    if (!foundEmployee) {
      setErrorMessage('Akun karyawan tidak ditemukan. Periksa kembali NIK atau Email Anda.');
      return;
    }

    // Password verification: default is 1234, 123456, or matching custom password/NIK
    if (foundEmployee.password && foundEmployee.password !== password && password !== '123456' && password !== '1234' && password !== foundEmployee.nik) {
      setErrorMessage('Password / PIN salah. (Default PIN: 123456 atau NIK Anda)');
      return;
    }

    // Success login
    if (rememberMe) {
      localStorage.setItem('absensi_auth_logged_emp_id', foundEmployee.id);
    }
    onLogin(foundEmployee);
  };

  const handleQuickLogin = (emp: Employee) => {
    if (rememberMe) {
      localStorage.setItem('absensi_auth_logged_emp_id', emp.id);
    }
    onLogin(emp);
  };

  const filteredDirectory = employees.filter(emp => {
    if (!searchDirectoryQuery) return true;
    const q = searchDirectoryQuery.toLowerCase();
    return emp.name.toLowerCase().includes(q) ||
           emp.nik.toLowerCase().includes(q) ||
           emp.department.toLowerCase().includes(q) ||
           emp.role.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans text-slate-100">
      
      {/* Background Decorative Circles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl"></div>
      </div>

      <div className="w-full max-w-4xl z-10 space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md shadow-inner text-indigo-300">
            <Building2 className="w-6 h-6 text-blue-400" />
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
              SIAP-TEX
            </span>
            <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30 font-semibold">
              Enterprise Attendance
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Portal Presensi & Absensi Karyawan
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
            {officeConfig.name} • Akses Aman Terintegrasi Berbasis Peran & Hak Akses
          </p>
        </div>

        {/* Main Grid: Form Login on Left / Quick Role Selection on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Box: Standard Credentials Login (7 Cols) */}
          <div className="lg:col-span-7 bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-blue-600" />
                    <span>Masuk ke Akun Anda</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowRoleInfoModal(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>Hak Akses Role</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Masukkan NIK atau Email terdaftar beserta Password/PIN presensi Anda.
                </p>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Gagal Masuk:</strong> {errorMessage}
                  </div>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Identifier Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    NIK / Email / No. HP Karyawan
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      id="login-identifier"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Contoh: KRY-2024-001 atau email@sinergi.co.id"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Password / PIN Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Password / PIN Presensi
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Default: <strong className="text-slate-600 font-mono">123456</strong>
                    </span>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan 6 digit PIN atau Password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Ingat sesi login di perangkat ini</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier('KRY-2024-001');
                      setPassword('123456');
                    }}
                    className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    Isi Akun Demo
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  id="btn-submit-login"
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] mt-2"
                >
                  <span>Masuk Sekarang</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Direct Employee Directory Search Link */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Pilih dari daftar semua karyawan?</span>
              <button
                type="button"
                onClick={() => setShowDirectoryList(!showDirectoryList)}
                className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>{showDirectoryList ? 'Tutup Daftar' : 'Cari di Direktori'}</span>
              </button>
            </div>
          </div>

          {/* Right Box: Instant Demo Role Profiles (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            
            <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl p-5 border border-slate-700/80 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Pilih Cepat Berdasarkan Role
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-full">
                  1-Klik Masuk
                </span>
              </div>

              {/* 3 Role Preset Cards */}
              <div className="space-y-2.5">
                
                {/* 1. Superadmin Preset */}
                {superadminUser && (
                  <button
                    type="button"
                    id="quick-login-superadmin"
                    onClick={() => handleQuickLogin(superadminUser)}
                    className="w-full text-left p-3 rounded-2xl bg-gradient-to-r from-purple-950/70 to-slate-900 border border-purple-500/40 hover:border-purple-400 hover:bg-purple-900/40 transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md font-bold">
                        <Crown className="w-5 h-5 text-amber-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-200 group-hover:text-white truncate">
                            {superadminUser.name}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">
                            Superadmin
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          Akses Penuh: Pengaturan GPS, Geofencing, Shift & Semua Role
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {/* 2. Admin Preset */}
                {adminUser && (
                  <button
                    type="button"
                    id="quick-login-admin"
                    onClick={() => handleQuickLogin(adminUser)}
                    className="w-full text-left p-3 rounded-2xl bg-gradient-to-r from-indigo-950/70 to-slate-900 border border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-900/40 transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md font-bold">
                        <ShieldCheck className="w-5 h-5 text-indigo-200" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-200 group-hover:text-white truncate">
                            {adminUser.name}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                            Admin (HRD)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          Master Karyawan, Approval Cuti, Rekap Kantor & Mesin LAN
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {/* 3. Regular User / Karyawan Preset */}
                {regularUser && (
                  <button
                    type="button"
                    id="quick-login-karyawan"
                    onClick={() => handleQuickLogin(regularUser)}
                    className="w-full text-left p-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-700/80 hover:border-slate-500 hover:bg-slate-800/80 transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-md font-bold">
                        <User className="w-5 h-5 text-slate-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                            {regularUser.name}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">
                            User / Karyawan
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          Fitur Terbatas: Absen Selfie & GPS Sendiri, Cuti Pribadi
                        </p>
                      </div>
                    </div>
                  </button>
                )}

              </div>
            </div>

            {/* Summary of Strict Role Protection */}
            <div className="bg-blue-950/40 border border-blue-800/40 rounded-2xl p-3.5 text-xs text-blue-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-white font-bold">Pemisahan Hak Akses Aktif:</strong>
                <p className="text-[11px] text-blue-300/90 leading-relaxed">
                  Akun <strong>User (Karyawan)</strong> tidak dapat melihat atau mengubah data karyawan lain, data master, maupun radius geofencing kantor.
                </p>
              </div>
            </div>

          </div>

        </div>

        {/* Searchable Full Directory Dropdown Modal */}
        {showDirectoryList && (
          <div className="bg-white text-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>Pilih Akun dari Seluruh Direktori Karyawan ({employees.length} Orang)</span>
                </h3>
                <p className="text-xs text-slate-500">Klik pada salah satu nama karyawan untuk langsung masuk</p>
              </div>
              
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchDirectoryQuery}
                  onChange={(e) => setSearchDirectoryQuery(e.target.value)}
                  placeholder="Cari nama, NIK, divisi..."
                  className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {filteredDirectory.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => handleQuickLogin(emp)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 transition-all text-left cursor-pointer group"
                >
                  <img
                    src={emp.avatarUrl}
                    alt={emp.name}
                    className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback
                      (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=2563eb&color=fff`;
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">
                      {emp.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="font-mono">{emp.nik}</span>
                      <span>•</span>
                      <span className={`font-semibold ${
                        emp.systemRole === 'superadmin' ? 'text-purple-600' :
                        emp.systemRole === 'admin' ? 'text-indigo-600' : 'text-slate-600'
                      }`}>
                        {emp.systemRole === 'superadmin' ? 'Superadmin' : emp.systemRole === 'admin' ? 'Admin' : 'Karyawan'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Role Information & Restrictions Modal */}
      {showRoleInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white text-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Matriks Hak Akses & Pembatasan Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleInfoModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              
              {/* Superadmin Card */}
              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-purple-700" />
                  <h4 className="font-bold text-sm text-purple-950">1. Super Admin (Akses Tertinggi)</h4>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Memiliki otoritas penuh atas seluruh sistem dan database organisasi.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Konfigurasi Kantor & Geofencing GPS</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Ubah Hak Akses & Role Karyawan</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Integrasi Mesin Mbio MB800C & LAN</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Approval Izin/Cuti & Absensi Otomatis</span>
                  </div>
                </div>
              </div>

              {/* Admin Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-700" />
                  <h4 className="font-bold text-sm text-indigo-950">2. Administrator / HRD</h4>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Mengelola operasional harian, presensi, persetujuan cuti, dan master karyawan.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Kelola Master Data Karyawan</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Rekap Kehadiran Seluruh Pegawai</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Setujui / Tolak Pengajuan Izin & Cuti</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Koreksi Absensi & Import/Export Excel</span>
                  </div>
                </div>
              </div>

              {/* User / Karyawan Card */}
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-700" />
                  <h4 className="font-bold text-sm text-slate-900">3. User / Karyawan (Fitur Dibatasi)</h4>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Akses khusus untuk keperluan presensi dan pengajuan pribadi.
                </p>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>DAPAT: Absen masuk & pulang (Selfie Kamera + GPS Lokasi)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>DAPAT: Mengajukan izin pribadi, sakit, terlambat, & cuti</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>DAPAT: Melihat riwayat dan rekap presensi diri sendiri</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-600 font-semibold border-t border-slate-200 pt-1.5 mt-2">
                    <span className="text-rose-600 shrink-0">✕</span>
                    <span>DIBATASI: Tidak dapat melihat/mengubah data karyawan lain</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                    <span className="text-rose-600 shrink-0">✕</span>
                    <span>DIBATASI: Tidak dapat mengubah radius/lokasi kantor</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                    <span className="text-rose-600 shrink-0">✕</span>
                    <span>DIBATASI: Tidak dapat menyetujui izin atau cuti orang lain</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRoleInfoModal(false)}
                className="py-2 px-5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
