import { useState, useEffect } from 'react';
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
  UserPlus
} from 'lucide-react';
import { Employee, OfficeConfig } from '../types';

interface HeaderProps {
  currentEmployee: Employee;
  employees: Employee[];
  onSelectEmployee: (employee: Employee) => void;
  activeTab: 'presensi' | 'rekap' | 'cuti' | 'karyawan' | 'pengaturan';
  onTabChange: (tab: 'presensi' | 'rekap' | 'cuti' | 'karyawan' | 'pengaturan') => void;
  officeConfig: OfficeConfig;
  onOpenOfficeModal: () => void;
  onOpenAddEmployeeModal?: () => void;
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
}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
                <span className="text-lg font-bold text-slate-900 tracking-tight">AbsensiPro</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
                  Enterprise HR
                </span>
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

          {/* Right: Employee Profile Switcher */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 hidden sm:inline">Karyawan:</span>
              <button
                type="button"
                id="employee-selector-btn"
                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                className="flex items-center gap-3 p-1.5 pr-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs text-left"
              >
                <img
                  src={currentEmployee.avatarUrl}
                  alt={currentEmployee.name}
                  className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{currentEmployee.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{currentEmployee.nik} • {currentEmployee.department}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              </button>
            </div>

            {/* Dropdown Menu for Switch Employee */}
            {isEmployeeDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsEmployeeDropdownOpen(false)}
                />
                <div 
                  id="employee-dropdown-list"
                  className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Pilih Profil Karyawan</p>
                    <p className="text-[11px] text-slate-400">Ganti akun untuk simulasi absensi tim</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {employees.map((emp) => {
                      const isSelected = emp.id === currentEmployee.id;
                      return (
                        <button
                          key={emp.id}
                          id={`select-emp-${emp.id}`}
                          type="button"
                          onClick={() => {
                            onSelectEmployee(emp);
                            setIsEmployeeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-blue-50/70' : ''
                          }`}
                        >
                          <img
                            src={emp.avatarUrl}
                            alt={emp.name}
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-medium truncate ${isSelected ? 'text-blue-700 font-semibold' : 'text-slate-800'}`}>
                                {emp.name}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">Aktif</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">{emp.role} • {emp.department}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-2 border-t border-slate-100 bg-slate-50/90">
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

        {/* Navigation Tabs */}
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
          </button>
        </div>

      </div>
    </header>
  );
}
