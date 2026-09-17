import { useState, useEffect } from 'react';
import { 
  LogIn, 
  LogOut, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  CalendarCheck,
  Building,
  User,
  Coffee,
  Zap,
  Users
} from 'lucide-react';
import { Employee, AttendanceRecord, OfficeConfig } from '../types';

interface ClockCardProps {
  employee: Employee;
  todayRecord: AttendanceRecord | undefined;
  officeConfig: OfficeConfig;
  onOpenAttendanceModal: (mode: 'in' | 'out') => void;
  onOpenManualAttendanceModal?: () => void;
  onOpenAutoAttendanceModal?: () => void;
  userDistanceToOffice: number | null;
  isWithinOfficeRadius: boolean;
}

export default function ClockCard({
  employee,
  todayRecord,
  officeConfig,
  onOpenAttendanceModal,
  onOpenManualAttendanceModal,
  onOpenAutoAttendanceModal,
  userDistanceToOffice,
  isWithinOfficeRadius,
}: ClockCardProps) {
  const isAdminOrSuper = employee.systemRole === 'admin' || employee.systemRole === 'superadmin';
  const isSuperadmin = employee.systemRole === 'superadmin';
  const [workingDuration, setWorkingDuration] = useState<string>('0 jam 0 mnt');

  // Compute live duration if checked in and not checked out
  useEffect(() => {
    if (!todayRecord?.checkInTime) return;

    const updateDuration = () => {
      const [h, m, s] = todayRecord.checkInTime!.split(':').map(Number);
      const checkInDate = new Date();
      checkInDate.setHours(h, m, s || 0, 0);

      const now = new Date();
      let diffMs = now.getTime() - checkInDate.getTime();

      if (todayRecord.checkOutTime) {
        const [oh, om, os] = todayRecord.checkOutTime.split(':').map(Number);
        const checkOutDate = new Date();
        checkOutDate.setHours(oh, om, os || 0, 0);
        diffMs = checkOutDate.getTime() - checkInDate.getTime();
      }

      if (diffMs < 0) diffMs = 0;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setWorkingDuration(`${hours} jam ${minutes} menit`);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 30000);
    return () => clearInterval(interval);
  }, [todayRecord?.checkInTime, todayRecord?.checkOutTime]);

  const hasCheckedIn = Boolean(todayRecord?.checkInTime);
  const hasCheckedOut = Boolean(todayRecord?.checkOutTime);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden" id="employee-clock-card">
      {/* Top Banner / Status Overview */}
      <div className="bg-slate-900 px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={employee.avatarUrl}
              alt={employee.name}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-white/20 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">{employee.name}</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {employee.nik}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-0.5">{employee.role}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  {employee.department}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Shift: {employee.shift.startTime} - {employee.shift.endTime} WIB
                </span>
              </div>
            </div>
          </div>

          {/* Quick status pill for today */}
          <div className="sm:text-right bg-white/5 border border-white/10 rounded-xl p-3 sm:min-w-[170px]">
            <div className="text-xs text-slate-400 font-medium">Status Hari Ini</div>
            <div className="mt-1">
              {!hasCheckedIn ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Belum Absen
                </span>
              ) : !hasCheckedOut ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sedang Bekerja
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-400/10 text-blue-300 border border-blue-400/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Selesai Kerja
                </span>
              )}
            </div>
            {hasCheckedIn && (
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Durasi: {workingDuration}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Attendance Action Section */}
      <div className="p-5 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left: Clock In / Clock Out Big Buttons */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Absen Masuk Button */}
              <button
                type="button"
                id="btn-clock-in"
                disabled={hasCheckedIn}
                onClick={() => onOpenAttendanceModal('in')}
                className={`flex-1 flex items-center justify-center gap-3 py-4 px-5 rounded-xl font-semibold text-sm transition-all shadow-xs cursor-pointer ${
                  hasCheckedIn
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.99] hover:shadow-md'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasCheckedIn ? 'bg-slate-200' : 'bg-emerald-500 text-white'}`}>
                  <LogIn className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold">
                    {hasCheckedIn ? 'Sudah Absen Masuk' : 'Absen Masuk (Clock In)'}
                  </div>
                  <div className={`text-xs ${hasCheckedIn ? 'text-slate-400' : 'text-emerald-100'}`}>
                    {hasCheckedIn ? `Pukul ${todayRecord?.checkInTime} WIB` : 'Verifikasi Wajah & Lokasi'}
                  </div>
                </div>
              </button>

              {/* Absen Pulang Button */}
              <button
                type="button"
                id="btn-clock-out"
                disabled={!hasCheckedIn || hasCheckedOut}
                onClick={() => onOpenAttendanceModal('out')}
                className={`flex-1 flex items-center justify-center gap-3 py-4 px-5 rounded-xl font-semibold text-sm transition-all shadow-xs cursor-pointer ${
                  !hasCheckedIn || hasCheckedOut
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99] hover:shadow-md'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!hasCheckedIn || hasCheckedOut ? 'bg-slate-200' : 'bg-blue-500 text-white'}`}>
                  <LogOut className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold">
                    {hasCheckedOut ? 'Sudah Absen Pulang' : 'Absen Pulang (Clock Out)'}
                  </div>
                  <div className={`text-xs ${!hasCheckedIn || hasCheckedOut ? 'text-slate-400' : 'text-blue-100'}`}>
                    {hasCheckedOut ? `Pukul ${todayRecord?.checkOutTime} WIB` : hasCheckedIn ? 'Selesaikan Jam Kerja' : 'Harus Absen Masuk Dulu'}
                  </div>
                </div>
              </button>
            </div>

            {/* Quick Actions for Manual & Auto Attendance */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 font-medium">
                  {isAdminOrSuper ? 'Panel Akses Presensi Otoritas:' : 'Lupa absen atau perlu input manual?'}
                </span>
                
                <div className="flex flex-wrap items-center gap-2">
                  {isAdminOrSuper && onOpenAutoAttendanceModal && (
                    <button
                      type="button"
                      id="btn-clockcard-auto-attendance"
                      onClick={onOpenAutoAttendanceModal}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                      title="Absensi otomatis semua user"
                    >
                      <Zap className="w-3 h-3 fill-indigo-600 text-indigo-600" />
                      <span>⚡ Absensi Otomatis</span>
                    </button>
                  )}

                  {onOpenManualAttendanceModal && (
                    <button
                      type="button"
                      id="btn-open-manual-clock-card"
                      onClick={onOpenManualAttendanceModal}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-[11px] bg-white text-blue-700 hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span>
                        {isAdminOrSuper 
                          ? '+ Input Manual User' 
                          : (hasCheckedIn ? 'Koreksi Presensi' : 'Input Manual')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance Details of the Day if already clocked in */}
            {hasCheckedIn && todayRecord && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Jenis Presensi:</span>
                  <span className="font-semibold text-slate-800 px-2 py-0.5 rounded bg-white border border-slate-200">
                    {todayRecord.type}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Status Ketepatan:</span>
                  <span className={`font-semibold px-2 py-0.5 rounded ${
                    todayRecord.status === 'Hadir Tepat Waktu' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {todayRecord.status}
                  </span>
                </div>
                {todayRecord.location && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Verifikasi Lokasi:</span>
                    <span className="text-slate-700 truncate max-w-[220px]">
                      {todayRecord.location.isWithinRadius ? '✓ Kantor (Dalam Radius)' : `! ${todayRecord.location.distanceToOfficeMeters}m dari kantor`}
                    </span>
                  </div>
                )}
                {todayRecord.notes && (
                  <div className="text-xs pt-1 border-t border-slate-200 text-slate-600 italic">
                    "{todayRecord.notes}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Office Geofence & Leave Quota Quick Overview */}
          <div className="lg:col-span-5 bg-slate-50/80 rounded-xl p-4 sm:p-5 border border-slate-200/70 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  Radius Geofence Kantor
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  isWithinOfficeRadius 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {isWithinOfficeRadius ? 'Dalam Radius' : 'Luar Radius'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {officeConfig.name}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                <span>Jarak Anda saat ini:</span>
                <span className="font-mono font-bold text-slate-800">
                  {userDistanceToOffice !== null ? `${userDistanceToOffice} meter` : 'Memeriksa GPS...'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Toleransi radius absensi: max <span className="font-semibold text-slate-600">{officeConfig.radiusMeters} meter</span>
              </p>
            </div>

            <div className="border-t border-slate-200/80 pt-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
                  Sisa Kuota Cuti Tahunan
                </div>
                <div className="text-xs text-slate-500">Tahun Periode 2026</div>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-blue-600 font-mono">
                  {employee.remainingLeaveQuota}
                </span>
                <span className="text-xs text-slate-500 ml-1">Hari</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
