import { useState, useMemo } from 'react';
import { 
  Clock, 
  ClockAlert, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  Users, 
  Building2, 
  ArrowRight, 
  Plus, 
  FileText, 
  Check, 
  X, 
  CalendarClock, 
  BarChart3,
  ListFilter,
  ShieldCheck
} from 'lucide-react';
import { LeaveRequest, Employee, OfficeConfig } from '../types';
import { getTodayDateString } from '../utils/geo';

interface PermitRecapDashboardProps {
  requests: LeaveRequest[];
  employees: Employee[];
  currentEmployee: Employee;
  officeConfig?: OfficeConfig;
  onNavigateToLeaveManagement: () => void;
  onOpenLeaveModal?: (defaultType?: 'Izin Datang Terlambat' | 'Izin Pulang Awal') => void;
  onUpdateStatus?: (requestId: string, newStatus: 'Disetujui' | 'Ditolak') => void;
}

export default function PermitRecapDashboard({
  requests,
  employees,
  currentEmployee,
  officeConfig,
  onNavigateToLeaveManagement,
  onOpenLeaveModal,
  onUpdateStatus,
}: PermitRecapDashboardProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'monthly_summary' | 'department_stats'>('today');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7); // e.g. "2026-09"
  });
  const [filterType, setFilterType] = useState<'all' | 'terlambat' | 'pulang_awal'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('Semua');

  const todayStr = getTodayDateString();
  const isAdminOrSuper = currentEmployee.systemRole === 'admin' || currentEmployee.systemRole === 'superadmin';

  // Config limits
  const maxLateCount = officeConfig?.maxLatePermitCountPerMonth ?? 3;
  const maxLateMinutes = officeConfig?.maxLatePermitMinutesPerMonth ?? 120;
  const maxEarlyCount = officeConfig?.maxEarlyLeaveCountPerMonth ?? 3;
  const maxEarlyMinutes = officeConfig?.maxEarlyLeaveMinutesPerMonth ?? 120;

  // Departments list
  const departments = useMemo(() => {
    const set = new Set(employees.map(e => e.department));
    return ['Semua', ...Array.from(set)];
  }, [employees]);

  // Today's permits
  const todayLateRequests = useMemo(() => {
    return requests.filter(r => r.type === 'Izin Datang Terlambat' && r.startDate <= todayStr && r.endDate >= todayStr);
  }, [requests, todayStr]);

  const todayEarlyRequests = useMemo(() => {
    return requests.filter(r => r.type === 'Izin Pulang Awal' && r.startDate <= todayStr && r.endDate >= todayStr);
  }, [requests, todayStr]);

  const todayTotalLateMinutes = useMemo(() => {
    return todayLateRequests.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
  }, [todayLateRequests]);

  const todayTotalEarlyMinutes = useMemo(() => {
    return todayEarlyRequests.reduce((sum, r) => sum + (r.earlyDepartureMinutes || 0), 0);
  }, [todayEarlyRequests]);

  // Selected Month permits (All employees)
  const monthlyLateRequests = useMemo(() => {
    return requests.filter(r => r.type === 'Izin Datang Terlambat' && r.startDate.startsWith(selectedMonth));
  }, [requests, selectedMonth]);

  const monthlyEarlyRequests = useMemo(() => {
    return requests.filter(r => r.type === 'Izin Pulang Awal' && r.startDate.startsWith(selectedMonth));
  }, [requests, selectedMonth]);

  const monthlyTotalLateMinutes = useMemo(() => {
    return monthlyLateRequests.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
  }, [monthlyLateRequests]);

  const monthlyTotalEarlyMinutes = useMemo(() => {
    return monthlyEarlyRequests.reduce((sum, r) => sum + (r.earlyDepartureMinutes || 0), 0);
  }, [monthlyEarlyRequests]);

  // Current logged in employee quota stats for selected month
  const myMonthlyLate = useMemo(() => {
    return monthlyLateRequests.filter(r => r.employeeId === currentEmployee.id && r.status !== 'Ditolak');
  }, [monthlyLateRequests, currentEmployee.id]);

  const myMonthlyEarly = useMemo(() => {
    return monthlyEarlyRequests.filter(r => r.employeeId === currentEmployee.id && r.status !== 'Ditolak');
  }, [monthlyEarlyRequests, currentEmployee.id]);

  const myUsedLateCount = myMonthlyLate.length;
  const myUsedLateMinutes = myMonthlyLate.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
  const myRemainingLateCount = Math.max(0, maxLateCount - myUsedLateCount);
  const myRemainingLateMinutes = Math.max(0, maxLateMinutes - myUsedLateMinutes);

  const myUsedEarlyCount = myMonthlyEarly.length;
  const myUsedEarlyMinutes = myMonthlyEarly.reduce((sum, r) => sum + (r.earlyDepartureMinutes || 0), 0);
  const myRemainingEarlyCount = Math.max(0, maxEarlyCount - myUsedEarlyCount);
  const myRemainingEarlyMinutes = Math.max(0, maxEarlyMinutes - myUsedEarlyMinutes);

  // Filtered today list
  const filteredTodayRequests = useMemo(() => {
    return requests.filter(r => {
      const isToday = r.startDate <= todayStr && r.endDate >= todayStr;
      if (!isToday) return false;
      const isTargetType = r.type === 'Izin Datang Terlambat' || r.type === 'Izin Pulang Awal';
      if (!isTargetType) return false;

      if (filterType === 'terlambat' && r.type !== 'Izin Datang Terlambat') return false;
      if (filterType === 'pulang_awal' && r.type !== 'Izin Pulang Awal') return false;
      if (selectedDept !== 'Semua' && r.department !== selectedDept) return false;

      return true;
    });
  }, [requests, todayStr, filterType, selectedDept]);

  // Per-employee breakdown calculation for the selected month
  const employeeMonthlySummary = useMemo(() => {
    return employees.map(emp => {
      const empLateReqs = monthlyLateRequests.filter(r => r.employeeId === emp.id && r.status !== 'Ditolak');
      const empEarlyReqs = monthlyEarlyRequests.filter(r => r.employeeId === emp.id && r.status !== 'Ditolak');

      const lateCount = empLateReqs.length;
      const lateMinutes = empLateReqs.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);

      const earlyCount = empEarlyReqs.length;
      const earlyMinutes = empEarlyReqs.reduce((sum, r) => sum + (r.earlyDepartureMinutes || 0), 0);

      const totalWorkPermitMinutes = lateMinutes + earlyMinutes;

      return {
        employee: emp,
        lateCount,
        lateMinutes,
        remainingLateCount: Math.max(0, maxLateCount - lateCount),
        remainingLateMinutes: Math.max(0, maxLateMinutes - lateMinutes),
        earlyCount,
        earlyMinutes,
        remainingEarlyCount: Math.max(0, maxEarlyCount - earlyCount),
        remainingEarlyMinutes: Math.max(0, maxEarlyMinutes - earlyMinutes),
        totalWorkPermitMinutes,
        hasLateWarning: lateCount >= maxLateCount || lateMinutes >= maxLateMinutes,
        hasEarlyWarning: earlyCount >= maxEarlyCount || earlyMinutes >= maxEarlyMinutes,
      };
    }).filter(item => {
      if (selectedDept !== 'Semua' && item.employee.department !== selectedDept) return false;
      return true;
    });
  }, [employees, monthlyLateRequests, monthlyEarlyRequests, maxLateCount, maxLateMinutes, maxEarlyCount, maxEarlyMinutes, selectedDept]);

  // Department breakdown stats
  const departmentStats = useMemo(() => {
    const deptMap: Record<string, {
      dept: string;
      employeeCount: number;
      lateCount: number;
      lateMinutes: number;
      earlyCount: number;
      earlyMinutes: number;
      totalPermits: number;
    }> = {};

    employees.forEach(emp => {
      if (!deptMap[emp.department]) {
        deptMap[emp.department] = {
          dept: emp.department,
          employeeCount: 0,
          lateCount: 0,
          lateMinutes: 0,
          earlyCount: 0,
          earlyMinutes: 0,
          totalPermits: 0,
        };
      }
      deptMap[emp.department].employeeCount += 1;
    });

    monthlyLateRequests.forEach(req => {
      if (deptMap[req.department] && req.status !== 'Ditolak') {
        deptMap[req.department].lateCount += 1;
        deptMap[req.department].lateMinutes += (req.lateMinutes || 0);
        deptMap[req.department].totalPermits += 1;
      }
    });

    monthlyEarlyRequests.forEach(req => {
      if (deptMap[req.department] && req.status !== 'Ditolak') {
        deptMap[req.department].earlyCount += 1;
        deptMap[req.department].earlyMinutes += (req.earlyDepartureMinutes || 0);
        deptMap[req.department].totalPermits += 1;
      }
    });

    return Object.values(deptMap);
  }, [employees, monthlyLateRequests, monthlyEarlyRequests]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-0" id="permit-recap-dashboard">
      
      {/* Header Container */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-linear-to-r from-slate-50/90 via-amber-50/20 to-indigo-50/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Rekapitulasi Izin Jam Kerja (Terlambat & Pulang Awal)
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold border border-amber-300/80 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-700" />
              {todayLateRequests.length} Izin Terlambat Hari Ini
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-semibold border border-indigo-300/80 flex items-center gap-1">
              <LogOut className="w-3 h-3 text-indigo-700" />
              {todayEarlyRequests.length} Izin Pulang Awal Hari Ini
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Pemantauan real-time dan rekap akumulasi bulanan izin datang terlambat serta izin pulang lebih awal sesuai kuota kantor.
          </p>
        </div>

        {/* Action Buttons & Period Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-mono font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
            title="Pilih Bulan Rekapitulasi"
          />

          {onOpenLeaveModal && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenLeaveModal('Izin Datang Terlambat')}
                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Ajukan Izin Datang Terlambat"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>+ Terlambat</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenLeaveModal('Izin Pulang Awal')}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Ajukan Izin Pulang Lebih Awal"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>+ Pulang Awal</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onNavigateToLeaveManagement}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>Manajemen Izin</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 SUMMARY STAT CARDS */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Izin Terlambat Hari Ini */}
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-amber-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <ClockAlert className="w-4 h-4 text-amber-600" />
                Izin Terlambat Hari Ini
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {todayLateRequests.length} Pengajuan
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <div className="text-2xl font-black font-mono text-slate-900">
                {todayTotalLateMinutes} <span className="text-xs font-semibold text-slate-500 font-sans">Menit Total</span>
              </div>
              <span className="text-xs font-medium text-amber-700 font-mono">
                {(todayTotalLateMinutes / 60).toFixed(1)} Jam
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
              <span>Disetujui: <strong className="text-emerald-700">{todayLateRequests.filter(r => r.status === 'Disetujui').length}</strong></span>
              <span>Menunggu: <strong className="text-amber-700">{todayLateRequests.filter(r => r.status === 'Menunggu').length}</strong></span>
            </div>
          </div>

          {/* Card 2: Izin Pulang Awal Hari Ini */}
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-indigo-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <LogOut className="w-4 h-4 text-indigo-600" />
                Izin Pulang Awal Hari Ini
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                {todayEarlyRequests.length} Pengajuan
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <div className="text-2xl font-black font-mono text-slate-900">
                {todayTotalEarlyMinutes} <span className="text-xs font-semibold text-slate-500 font-sans">Menit Total</span>
              </div>
              <span className="text-xs font-medium text-indigo-700 font-mono">
                {(todayTotalEarlyMinutes / 60).toFixed(1)} Jam
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
              <span>Disetujui: <strong className="text-emerald-700">{todayEarlyRequests.filter(r => r.status === 'Disetujui').length}</strong></span>
              <span>Menunggu: <strong className="text-indigo-700">{todayEarlyRequests.filter(r => r.status === 'Menunggu').length}</strong></span>
            </div>
          </div>

          {/* Card 3: Total Akumulasi Bulan Ini */}
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                Akumulasi Bulan Ini ({selectedMonth})
              </span>
            </div>
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-amber-800 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" /> Terlambat:
                </span>
                <span className="font-mono text-slate-900">{monthlyLateRequests.length}x ({monthlyTotalLateMinutes}m)</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold mt-1">
                <span className="text-indigo-800 flex items-center gap-1">
                  <LogOut className="w-3 h-3 text-indigo-600" /> Pulang Awal:
                </span>
                <span className="font-mono text-slate-900">{monthlyEarlyRequests.length}x ({monthlyTotalEarlyMinutes}m)</span>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
              <span>Total Jam Izin:</span>
              <span className="font-mono font-bold text-slate-800">
                {((monthlyTotalLateMinutes + monthlyTotalEarlyMinutes) / 60).toFixed(1)} Jam
              </span>
            </div>
          </div>

          {/* Card 4: Sisa Kuota Pribadi Anda */}
          <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white rounded-xl p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Sisa Kuota Anda ({currentEmployee.name.split(' ')[0]})
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                Bulan Ini
              </span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Terlambat:</span>
                <span className="font-mono font-bold text-amber-300">
                  {myRemainingLateCount}x ({myRemainingLateMinutes} mnt)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Pulang Awal:</span>
                <span className="font-mono font-bold text-indigo-300">
                  {myRemainingEarlyCount}x ({myRemainingEarlyMinutes} mnt)
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700/80 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Batas Max: {maxLateCount}x / {maxLateMinutes}m</span>
              <span className="text-emerald-400 font-semibold">Terkendali</span>
            </div>
          </div>

        </div>
      </div>

      {/* Navigation Sub-Tabs & Filter Controls */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'today'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Daftar Pengajuan Hari Ini ({filteredTodayRequests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('monthly_summary')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'monthly_summary'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Rekap Kuota Per Karyawan ({employees.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('department_stats')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'department_stats'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Distribusi Departemen ({departments.length - 1})</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterType('terlambat')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'terlambat' ? 'bg-amber-500 text-white font-bold shadow-2xs' : 'text-slate-600'
              }`}
            >
              <ClockAlert className="w-3 h-3" />
              Terlambat
            </button>
            <button
              type="button"
              onClick={() => setFilterType('pulang_awal')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'pulang_awal' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-600'
              }`}
            >
              <LogOut className="w-3 h-3" />
              Pulang Awal
            </button>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TAB CONTENT 1: DAFTAR PENGAJUAN HARI INI */}
      {activeTab === 'today' && (
        <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
          {filteredTodayRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Tidak ada pengajuan izin datang terlambat atau pulang awal untuk hari ini.
            </div>
          ) : (
            filteredTodayRequests.map((req) => {
              const isLate = req.type === 'Izin Datang Terlambat';
              const isEarly = req.type === 'Izin Pulang Awal';
              const isPending = req.status === 'Menunggu';
              const isApproved = req.status === 'Disetujui';
              const isRejected = req.status === 'Ditolak';
              const isMe = req.employeeId === currentEmployee.id;

              return (
                <div 
                  key={req.id} 
                  className={`p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isLate ? 'hover:bg-amber-50/40' : 'hover:bg-indigo-50/40'
                  } ${isMe ? 'bg-blue-50/20' : ''}`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isLate 
                        ? 'bg-amber-100/70 border-amber-200 text-amber-700' 
                        : 'bg-indigo-100/70 border-indigo-200 text-indigo-700'
                    }`}>
                      {isLate ? <ClockAlert className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{req.employeeName}</span>
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold">
                            Anda
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isLate 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                            : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                        }`}>
                          {isLate ? <Clock className="w-2.5 h-2.5" /> : <LogOut className="w-2.5 h-2.5" />}
                          {req.type}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{req.employeeNik}</span>
                        <span>•</span>
                        <span>{req.department}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-700 font-semibold">
                          {isLate ? `Estimasi Tiba: ${req.estimatedArrivalTime} WIB` : `Estimasi Pulang: ${req.estimatedDepartureTime} WIB`}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 mt-1 italic">
                        "{req.reason}"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <div className="flex items-center gap-1.5 sm:justify-end">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          isApproved 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : isRejected 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isRejected && <XCircle className="w-3 h-3 text-rose-600" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                          {req.status}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-700 block mt-0.5">
                        Durasi: {isLate ? `${req.lateMinutes ?? 0} Menit` : `${req.earlyDepartureMinutes ?? 0} Menit`}
                      </span>
                    </div>

                    {/* HR Quick Action if Admin and Pending */}
                    {isPending && isAdminOrSuper && onUpdateStatus && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(req.id, 'Disetujui')}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Terima
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(req.id, 'Ditolak')}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" /> Tolak
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB CONTENT 2: REKAP KUOTA BULANAN PER KARYAWAN */}
      {activeTab === 'monthly_summary' && (
        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Karyawan</th>
                <th className="px-4 py-3">Izin Datang Terlambat ({selectedMonth})</th>
                <th className="px-4 py-3">Izin Pulang Awal ({selectedMonth})</th>
                <th className="px-4 py-3">Total Jam Izin</th>
                <th className="px-4 py-3">Status Kuota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeeMonthlySummary.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada data karyawan pada filter ini.
                  </td>
                </tr>
              ) : (
                employeeMonthlySummary.map((item) => {
                  const percentLate = Math.min(100, Math.round((item.lateCount / maxLateCount) * 100));
                  const percentEarly = Math.min(100, Math.round((item.earlyCount / maxEarlyCount) * 100));
                  const isMe = item.employee.id === currentEmployee.id;

                  return (
                    <tr key={item.employee.id} className={`hover:bg-slate-50/80 transition-colors ${isMe ? 'bg-blue-50/20 font-medium' : ''}`}>
                      
                      {/* Karyawan info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={item.employee.avatarUrl}
                            alt={item.employee.name}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{item.employee.name}</span>
                              {isMe && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.employee.nik} • {item.employee.department}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Izin Terlambat Stats */}
                      <td className="px-4 py-3">
                        <div className="space-y-1 max-w-[160px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-amber-900">{item.lateCount}/{maxLateCount}x</span>
                            <span className="font-mono text-slate-500">{item.lateMinutes}/{maxLateMinutes}m</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${percentLate >= 100 ? 'bg-rose-500' : percentLate >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${percentLate}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            Sisa: {item.remainingLateCount}x ({item.remainingLateMinutes}m)
                          </span>
                        </div>
                      </td>

                      {/* Izin Pulang Awal Stats */}
                      <td className="px-4 py-3">
                        <div className="space-y-1 max-w-[160px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-indigo-900">{item.earlyCount}/{maxEarlyCount}x</span>
                            <span className="font-mono text-slate-500">{item.earlyMinutes}/{maxEarlyMinutes}m</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${percentEarly >= 100 ? 'bg-rose-500' : percentEarly >= 60 ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                              style={{ width: `${percentEarly}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            Sisa: {item.remainingEarlyCount}x ({item.remainingEarlyMinutes}m)
                          </span>
                        </div>
                      </td>

                      {/* Total Jam Izin */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">
                          {(item.totalWorkPermitMinutes / 60).toFixed(1)} Jam
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.totalWorkPermitMinutes} Menit
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.hasLateWarning || item.hasEarlyWarning ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3" /> Kuota Terpakai Penuh
                          </span>
                        ) : percentLate >= 66 || percentEarly >= 66 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> Mendekati Batas
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Kuota Tersedia
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT 3: DISTRIBUSI DEPARTEMEN */}
      {activeTab === 'department_stats' && (
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentStats.map((stat) => (
              <div key={stat.dept} className="bg-slate-50/70 rounded-xl p-4 border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-xs text-slate-900">{stat.dept}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {stat.employeeCount} Karyawan
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-800 font-medium flex items-center gap-1">
                      <ClockAlert className="w-3.5 h-3.5 text-amber-600" />
                      Izin Terlambat:
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {stat.lateCount}x ({stat.lateMinutes} mnt)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-800 font-medium flex items-center gap-1">
                      <LogOut className="w-3.5 h-3.5 text-indigo-600" />
                      Izin Pulang Awal:
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {stat.earlyCount}x ({stat.earlyMinutes} mnt)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 font-semibold">
                    <span className="text-slate-600">Total Akumulasi:</span>
                    <span className="font-mono text-blue-700 font-bold">
                      {((stat.lateMinutes + stat.earlyMinutes) / 60).toFixed(1)} Jam ({stat.lateMinutes + stat.earlyMinutes} m)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer info note */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          Ketentuan kuota kantor: Max Terlambat {maxLateCount}x ({maxLateMinutes} mnt/bln) | Max Pulang Awal {maxEarlyCount}x ({maxEarlyMinutes} mnt/bln)
        </span>
        <button
          type="button"
          onClick={onNavigateToLeaveManagement}
          className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
        >
          Buka Manajemen Izin & Cuti &rarr;
        </button>
      </div>

    </div>
  );
}
