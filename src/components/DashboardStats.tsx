import { 
  Users, 
  CheckCircle2, 
  ClockAlert, 
  CalendarCheck, 
  HeartPulse,
  UserX,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { AttendanceRecord, Employee } from '../types';

interface DashboardStatsProps {
  employees: Employee[];
  todayRecords: AttendanceRecord[];
  onNavigateToEmployees?: () => void;
  onOpenManualAttendance?: () => void;
  isAdmin?: boolean;
}

export default function DashboardStats({ 
  employees, 
  todayRecords, 
  onNavigateToEmployees,
  onOpenManualAttendance,
  isAdmin = false,
}: DashboardStatsProps) {
  const totalEmployees = employees.length;
  
  const presentOnTime = todayRecords.filter(r => r.status === 'Hadir Tepat Waktu').length;
  const presentLate = todayRecords.filter(r => r.status === 'Terlambat').length;
  const todayIzin = todayRecords.filter(r => r.status === 'Izin').length;
  const todaySakit = todayRecords.filter(r => r.status === 'Sakit').length;
  
  // Explicit records with status Alpha (entered manually by Admin or Superadmin)
  const todayExplicitAlpha = todayRecords.filter(r => r.status === 'Alpha').length;
  
  // Employees who haven't clocked in or taken leave today
  const recordedEmployeeIds = new Set(todayRecords.map(r => r.employeeId));
  const notCheckedIn = employees.filter(e => !recordedEmployeeIds.has(e.id)).length;

  // IMPORTANT RULE: Karyawan yang belum absen TIDAK masuk hitungan alpha.
  // Hitungan alpha HANYA bertambah jika Admin atau Superadmin menginput data presensi manual berstatus Alpha.
  const totalAlpha = todayExplicitAlpha;

  const totalPresent = presentOnTime + presentLate;
  const attendanceRate = totalEmployees > 0 ? Math.round((totalPresent / totalEmployees) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4" id="dashboard-stats-grid">
      {/* Total Karyawan */}
      <div 
        onClick={onNavigateToEmployees}
        className={`bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs transition-all flex flex-col justify-between ${
          onNavigateToEmployees ? 'hover:border-blue-300 hover:shadow-xs cursor-pointer group' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">Total Karyawan</span>
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center transition-colors shrink-0">
            <Users className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{totalEmployees}</div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Kehadiran</span>
            <span className="font-semibold text-slate-700">{attendanceRate}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Hadir Tepat Waktu */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-800">Tepat Waktu</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold text-emerald-950">{presentOnTime}</div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-800 font-medium">
          Sebelum batas jam masuk
        </div>
      </div>

      {/* Terlambat */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-amber-200/80 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-amber-800">Terlambat</span>
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ClockAlert className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold text-amber-950">{presentLate}</div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-800">
          Lewat batas toleransi
        </div>
      </div>

      {/* Total Izin */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-blue-200/80 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-800">Total Izin</span>
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold text-blue-950">{todayIzin}</div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-blue-800">
          Disetujui HRD
        </div>
      </div>

      {/* Total Sakit */}
      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-purple-200/80 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-purple-800">Total Sakit</span>
          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <HeartPulse className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold text-purple-950">{todaySakit}</div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-purple-800">
          Surat dokter / medis
        </div>
      </div>

      {/* Belum Absen (Bukan Alpha) */}
      <div 
        onClick={isAdmin && onOpenManualAttendance ? onOpenManualAttendance : undefined}
        className={`bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex flex-col justify-between transition-all ${
          isAdmin && onOpenManualAttendance ? 'hover:border-sky-300 hover:shadow-xs cursor-pointer group' : ''
        }`}
        title={isAdmin ? "Klik untuk input presensi / tandai Alpha secara manual" : "Karyawan yang belum melakukan presensi hari ini"}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700 group-hover:text-sky-700 transition-colors">Belum Absen</span>
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-sky-50 group-hover:text-sky-600 flex items-center justify-center shrink-0 transition-colors">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold text-slate-800 group-hover:text-sky-700 transition-colors">{notCheckedIn}</div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          <span>Bukan Alpha (Menunggu)</span>
        </div>
      </div>

      {/* Total Alpha (Hanya dari Input Manual Admin & Superadmin) */}
      <div 
        onClick={isAdmin && onOpenManualAttendance ? onOpenManualAttendance : undefined}
        className={`bg-white rounded-xl p-3.5 sm:p-4 border border-rose-200/80 shadow-2xs flex flex-col justify-between transition-all ${
          isAdmin && onOpenManualAttendance ? 'hover:border-rose-400 hover:shadow-xs cursor-pointer group' : ''
        }`}
        title="Total Alpha hanya bertambah bila diinput manual oleh Admin atau Superadmin"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-rose-800">Total Alpha</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-100 flex items-center justify-center shrink-0 transition-colors">
            <UserX className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-bold text-rose-950">{totalAlpha}</div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-rose-800 font-medium">
          <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
          <span>Manual Admin ({todayExplicitAlpha})</span>
        </div>
      </div>
    </div>
  );
}
