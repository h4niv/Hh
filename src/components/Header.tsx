import { useState, useEffect, useRef, useMemo, KeyboardEvent } from 'react';
import { 
  Building2, 
  Clock, 
  UserCheck, 
  CalendarDays, 
  FileText, 
  SlidersHorizontal,
  ChevronDown,
  MapPin,
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Crown,
  User,
  Lock,
  Search,
  X,
  Sparkles,
  Cloud,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { Employee, OfficeConfig } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentEmployee: Employee;
  employees: Employee[];
  onSelectEmployee: (employee: Employee) => void;
  activeTab: 'presensi' | 'rekap' | 'cuti' | 'karyawan' | 'pengaturan';
  onTabChange: (tab: 'presensi' | 'rekap' | 'cuti' | 'karyawan' | 'pengaturan') => void;
  officeConfig: OfficeConfig;
  onOpenOfficeModal: () => void;
  onOpenAddEmployeeModal?: () => void;
  cloudSyncStatus?: 'connected' | 'syncing' | 'offline';
  onForceSync?: () => void;
  onOpenAndroidModal?: () => void;
}

export default function Header({
  currentEmployee,
  employees,
  onSelectEmployee,
  activeTab,
  onTabChange,
  officeConfig,
  onOpenOfficeModal,
  onOpenAddEmployeeModal,
  cloudSyncStatus = 'connected',
  onForceSync,
  onOpenAndroidModal,
}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [dropdownRoleFilter, setDropdownRoleFilter] = useState<'all' | 'superadmin' | 'admin' | 'karyawan'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isSuperadmin = currentEmployee.systemRole === 'superadmin';
  const isAdmin = currentEmployee.systemRole === 'admin';
  const isAdminOrSuper = isSuperadmin || isAdmin;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto focus input whenever dropdown opens
  useEffect(() => {
    if (isEmployeeDropdownOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isEmployeeDropdownOpen]);

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(time);

  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Filter employees based on role filter and live search query (name, nik, role, department)
  const filteredDropdownEmployees = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return employees.filter((emp) => {
      // Role filter check
      if (dropdownRoleFilter === 'superadmin' && emp.systemRole !== 'superadmin') return false;
      if (dropdownRoleFilter === 'admin' && emp.systemRole !== 'admin') return false;
      if (dropdownRoleFilter === 'karyawan' && emp.systemRole !== 'karyawan') return false;

      // Live search query check
      if (query) {
        const matchName = emp.name.toLowerCase().includes(query);
        const matchNik = emp.nik.toLowerCase().includes(query);
        const matchRole = emp.role.toLowerCase().includes(query);
        const matchDept = emp.department.toLowerCase().includes(query);
        const matchSysRole = (emp.systemRole || '').toLowerCase().includes(query);
        return matchName || matchNik || matchRole || matchDept || matchSysRole;
      }
      return true;
    });
  }, [employees, dropdownRoleFilter, searchQuery]);

  // Handle keyboard navigation in search
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isEmployeeDropdownOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredDropdownEmployees.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredDropdownEmployees.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredDropdownEmployees[selectedIndex]) {
        onSelectEmployee(filteredDropdownEmployees[selectedIndex]);
        setIsEmployeeDropdownOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEmployeeDropdownOpen(false);
    }
  };

  // Helper to highlight search matches
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-200 text-amber-900 rounded-xs px-0.5 font-bold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs" id="app-header">
      {/* Top tier: Brand, Live Clock, and Current Employee Selector */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Office tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900 tracking-tight">SIAP-TEX</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
                  Enterprise HR
                </span>
                <div 
                  className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    cloudSyncStatus === 'syncing'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : cloudSyncStatus === 'offline'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                  title="Sinkronisasi otomatis ke Firebase Firestore (plated-climber-w53bd)"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {cloudSyncStatus === 'connected' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                      cloudSyncStatus === 'syncing' ? 'bg-amber-500 animate-spin' : cloudSyncStatus === 'offline' ? 'bg-slate-400' : 'bg-emerald-500'
                    }`}></span>
                  </span>
                  <Cloud className="w-3 h-3" />
                  <span>{cloudSyncStatus === 'syncing' ? 'Menyinkronkan...' : 'Firebase Cloud Sync'}</span>
                  {onForceSync && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onForceSync();
                      }}
                      title="Klik untuk paksa sinkronisasi ulang semua data ke Firebase"
                      className="ml-0.5 hover:rotate-180 transition-transform cursor-pointer p-0.5 rounded text-emerald-600 hover:text-emerald-800"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenOfficeModal}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors cursor-pointer text-left"
                title="Klik untuk konfigurasi lokasi kantor"
                id="header-office-config-btn"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-xs">{officeConfig.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">({officeConfig.radiusMeters}m)</span>
              </button>
            </div>
          </div>

          {/* Center: Live Realtime Indonesian Clock */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">{formattedDate}</div>
              <div className="text-base font-semibold text-slate-800 tracking-wider font-mono">
                {formattedTime} <span className="text-xs font-normal text-slate-500">WIB</span>
              </div>
            </div>
          </div>

          {/* Right: Employee Profile Switcher with Role Badge and Android Button */}
          <div className="relative flex items-center gap-2">
            <PWAInstallButton onOpenAndroidModal={onOpenAndroidModal} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 hidden xl:inline">Pengguna:</span>
              <button
                type="button"
                id="employee-selector-btn"
                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                className={`flex items-center gap-3 p-1.5 pr-3 rounded-xl border transition-all shadow-2xs text-left cursor-pointer ${
                  isSuperadmin
                    ? 'border-purple-200 bg-purple-50/50 hover:bg-purple-50'
                    : isAdmin 
                    ? 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="relative">
                  <img
                    src={currentEmployee.avatarUrl}
                    alt={currentEmployee.name}
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                  />
                  {isSuperadmin && (
                    <span 
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-purple-600 rounded-full border border-white flex items-center justify-center"
                      title="Role: Superadministrator"
                    >
                      <Crown className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                  {isAdmin && !isSuperadmin && (
                    <span 
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-indigo-600 rounded-full border border-white flex items-center justify-center"
                      title="Role: Administrator"
                    >
                      <ShieldCheck className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800 truncate">{currentEmployee.name}</span>
                    {isSuperadmin ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold border border-purple-200">
                        <Crown className="w-2.5 h-2.5 text-purple-600" />
                        Superadmin
                      </span>
                    ) : isAdmin ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                        <ShieldCheck className="w-2.5 h-2.5 text-indigo-600" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                        <User className="w-2.5 h-2.5 text-slate-400" />
                        Karyawan
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{currentEmployee.nik} • {currentEmployee.department}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              </button>
            </div>

            {/* Dropdown Menu for Switch Employee & Role Filter */}
            {isEmployeeDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsEmployeeDropdownOpen(false)}
                />
                <div 
                  id="employee-dropdown-list"
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[520px]"
                >
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Pilih Akun Karyawan</p>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {filteredDropdownEmployees.length} dari {employees.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Ketik nama/NIK di bawah ini untuk mencari otomatis, atau filter berdasarkan peran:
                    </p>

                    {/* LIVE SEARCH INPUT */}
                    <div className="relative mt-2.5">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        id="employee-search-input"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setSelectedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ketik nama, NIK, jabatan, atau divisi..."
                        className="w-full pl-8.5 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 shadow-2xs font-medium transition-all"
                        autoComplete="off"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            searchInputRef.current?.focus();
                          }}
                          className="absolute right-2.5 top-2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                          title="Hapus pencarian"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Role Filter Tabs */}
                    <div className="grid grid-cols-4 gap-1 mt-2.5 p-0.5 bg-slate-100 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setDropdownRoleFilter('all')}
                        className={`py-1 px-1 rounded-md font-medium text-[10px] transition-all cursor-pointer text-center ${
                          dropdownRoleFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Semua ({employees.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDropdownRoleFilter('superadmin')}
                        className={`py-1 px-1 rounded-md font-medium text-[10px] transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                          dropdownRoleFilter === 'superadmin'
                            ? 'bg-purple-600 text-white shadow-2xs font-semibold'
                            : 'text-purple-700 hover:bg-purple-50'
                        }`}
                      >
                        <Crown className="w-2.5 h-2.5" />
                        Super ({employees.filter(e => e.systemRole === 'superadmin').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDropdownRoleFilter('admin')}
                        className={`py-1 px-1 rounded-md font-medium text-[10px] transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                          dropdownRoleFilter === 'admin'
                            ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                            : 'text-indigo-700 hover:bg-indigo-50'
                        }`}
                      >
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Admin ({employees.filter(e => e.systemRole === 'admin').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDropdownRoleFilter('karyawan')}
                        className={`py-1 px-1 rounded-md font-medium text-[10px] transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                          dropdownRoleFilter === 'karyawan'
                            ? 'bg-slate-700 text-white shadow-2xs font-semibold'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <User className="w-2.5 h-2.5" />
                        Staf ({employees.filter(e => e.systemRole === 'karyawan').length})
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-64 min-h-[140px]">
                    {filteredDropdownEmployees.length === 0 ? (
                      <div className="p-6 text-center text-xs space-y-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <Search className="w-4 h-4" />
                        </div>
                        <p className="text-slate-600 font-semibold">
                          Tidak ditemukan karyawan dengan kata kunci: <span className="text-blue-600 italic">"{searchQuery}"</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="text-[11px] text-blue-600 hover:text-blue-700 font-medium underline cursor-pointer"
                        >
                          Reset Pencarian
                        </button>
                      </div>
                    ) : (
                      filteredDropdownEmployees.map((emp, index) => {
                        const isSelected = emp.id === currentEmployee.id;
                        const isKeyboardActive = index === selectedIndex && Boolean(searchQuery);
                        const isEmpSuper = emp.systemRole === 'superadmin';
                        const isEmpAdmin = emp.systemRole === 'admin';

                        return (
                          <button
                            key={emp.id}
                            id={`select-emp-${emp.id}`}
                            type="button"
                            onClick={() => {
                              onSelectEmployee(emp);
                              setIsEmployeeDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                              isSelected 
                                ? 'bg-blue-50/80 border-l-3 border-blue-600' 
                                : isKeyboardActive
                                ? 'bg-slate-100'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <img
                                src={emp.avatarUrl}
                                alt={emp.name}
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                              />
                              {isEmpSuper && (
                                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-purple-600 rounded-full border border-white flex items-center justify-center" title="Superadministrator">
                                  <Crown className="w-2.5 h-2.5 text-white" />
                                </span>
                              )}
                              {isEmpAdmin && !isEmpSuper && (
                                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-indigo-600 rounded-full border border-white flex items-center justify-center" title="Administrator">
                                  <ShieldCheck className="w-2.5 h-2.5 text-white" />
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-800'}`}>
                                  {highlightMatch(emp.name, searchQuery)}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {isEmpSuper ? (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-bold border border-purple-200 flex items-center gap-0.5">
                                      <Crown className="w-2.5 h-2.5" />
                                      Superadmin
                                    </span>
                                  ) : isEmpAdmin ? (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 flex items-center gap-0.5">
                                      <ShieldCheck className="w-2.5 h-2.5" />
                                      Admin
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                      Karyawan
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-semibold">Aktif</span>
                                  )}
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">
                                {highlightMatch(emp.nik, searchQuery)} • {highlightMatch(emp.department, searchQuery)} ({emp.role})
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="p-2 border-t border-slate-100 bg-slate-50/90 flex flex-col gap-1.5">
                    <div className="px-2 py-1 text-[11px] text-slate-500 bg-amber-50/80 border border-amber-200/80 rounded-lg flex items-start gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Role Admin</strong> memiliki akses persetujuan cuti, kelola master karyawan, dan pengaturan kantor.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsEmployeeDropdownOpen(false);
                        if (onOpenAddEmployeeModal) {
                          onOpenAddEmployeeModal();
                        } else {
                          onTabChange('karyawan');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-100/60 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Tambah Karyawan Baru</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Navigation Tabs with Admin Badge Indicators */}
        <div className="mt-3 flex items-center gap-1 sm:gap-2 border-t border-slate-100 pt-2 overflow-x-auto">
          <button
            type="button"
            id="nav-tab-presensi"
            onClick={() => onTabChange('presensi')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'presensi'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Presensi & Absen</span>
          </button>

          <button
            type="button"
            id="nav-tab-rekap"
            onClick={() => onTabChange('rekap')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'rekap'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Rekapitulasi Kehadiran</span>
          </button>

          <button
            type="button"
            id="nav-tab-cuti"
            onClick={() => onTabChange('cuti')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'cuti'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Pengajuan Izin & Cuti</span>
          </button>

          <button
            type="button"
            id="nav-tab-karyawan"
            onClick={() => onTabChange('karyawan')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'karyawan'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Data Karyawan</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
              activeTab === 'karyawan' 
                ? 'bg-blue-700/60 text-blue-100' 
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}>
              Admin
            </span>
          </button>

          <button
            type="button"
            id="nav-tab-pengaturan"
            onClick={() => onTabChange('pengaturan')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pengaturan'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Pengaturan Kantor</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
              activeTab === 'pengaturan' 
                ? 'bg-blue-700/60 text-blue-100' 
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}>
              Admin
            </span>
          </button>
        </div>

      </div>
    </header>
  );
}
