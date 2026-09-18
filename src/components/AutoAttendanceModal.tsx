import { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  Clock, 
  Calendar, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  MapPin, 
  ShieldCheck, 
  Zap, 
  Sliders, 
  Filter,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, AttendanceType, Employee, LeaveRequest, OfficeConfig } from '../types';
import { getTodayDateString, calculateLateMinutes, calculateEarlyMinutes } from '../utils/geo';

interface AutoAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  existingRecords: AttendanceRecord[];
  currentEmployee: Employee;
  officeConfig: OfficeConfig;
  leaveRequests?: LeaveRequest[];
  onExecuteAutoAttendance: (records: AttendanceRecord[], message: string) => void;
}

export type AutoMode = 'both' | 'checkInOnly' | 'checkOutOnly';

export default function AutoAttendanceModal({
  isOpen,
  onClose,
  employees,
  existingRecords,
  currentEmployee,
  officeConfig,
  leaveRequests,
  onExecuteAutoAttendance,
}: AutoAttendanceModalProps) {
  const todayStr = getTodayDateString();

  // Settings state
  const [targetDate, setTargetDate] = useState<string>(todayStr);
  const [autoMode, setAutoMode] = useState<AutoMode>('both');
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('WFO');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [filterUnrecordedOnly, setFilterUnrecordedOnly] = useState<boolean>(false);
  const [excludeApprovedLeave, setExcludeApprovedLeave] = useState<boolean>(true);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(() =>
    employees.map((e) => e.id)
  );
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState<string>('');
  const [useRealisticJitter, setUseRealisticJitter] = useState<boolean>(true);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department)));
  }, [employees]);

  // Existing records on target date
  const recordsOnDate = useMemo(() => {
    return existingRecords.filter((r) => r.date === targetDate);
  }, [existingRecords, targetDate]);

  const recordedEmployeeIdsOnDate = useMemo(() => {
    return new Set(recordsOnDate.map((r) => r.employeeId));
  }, [recordsOnDate]);

  // Approved leave requests on target date
  const employeesOnApprovedLeaveOnDate = useMemo(() => {
    if (!leaveRequests || !targetDate) return new Map<string, LeaveRequest>();
    const map = new Map<string, LeaveRequest>();
    leaveRequests.forEach((r) => {
      if (r.status === 'Disetujui' && targetDate >= r.startDate && targetDate <= r.endDate) {
        map.set(r.employeeId, r);
      }
    });
    return map;
  }, [leaveRequests, targetDate]);

  // Update selectedEmployeeIds when targetDate or excludeApprovedLeave changes
  useEffect(() => {
    if (excludeApprovedLeave && employeesOnApprovedLeaveOnDate.size > 0) {
      setSelectedEmployeeIds((prev) =>
        prev.filter((id) => {
          const leave = employeesOnApprovedLeaveOnDate.get(id);
          if (!leave) return true;
          // Exclude full-day leaves and external assignments from auto general WFO check-in
          const isFullDayLeave = leave.type.toLowerCase().includes('cuti') || leave.type === 'Sakit' || leave.type === 'Izin' || leave.type === 'Izin Dinas Luar';
          return !isFullDayLeave;
        })
      );
    }
  }, [targetDate, excludeApprovedLeave, employeesOnApprovedLeaveOnDate]);

  // Filtered available employees
  const availableEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchDept = selectedDepartment === 'all' || emp.department === selectedDepartment;
      const isAlreadyRecorded = recordedEmployeeIdsOnDate.has(emp.id);
      const matchUnrecorded = filterUnrecordedOnly ? !isAlreadyRecorded : true;
      const matchSearch =
        emp.name.toLowerCase().includes(searchEmployeeQuery.toLowerCase()) ||
        emp.nik.toLowerCase().includes(searchEmployeeQuery.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchEmployeeQuery.toLowerCase());

      return matchDept && matchUnrecorded && matchSearch;
    });
  }, [employees, selectedDepartment, filterUnrecordedOnly, searchEmployeeQuery, recordedEmployeeIdsOnDate]);

  // Toggle single employee selection
  const handleToggleEmployee = (empId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  // Select all / Deselect all
  const handleSelectAllVisible = () => {
    const visibleIds = availableEmployees
      .filter((e) => {
        if (excludeApprovedLeave) {
          const leave = employeesOnApprovedLeaveOnDate.get(e.id);
          if (leave && (leave.type.toLowerCase().includes('cuti') || leave.type === 'Sakit' || leave.type === 'Izin' || leave.type === 'Izin Dinas Luar')) {
            return false;
          }
        }
        return true;
      })
      .map((e) => e.id);

    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedEmployeeIds.includes(id));
    if (allSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Target count
  const targetEmployees = useMemo(() => {
    return employees.filter((emp) => selectedEmployeeIds.includes(emp.id));
  }, [employees, selectedEmployeeIds]);

  if (!isOpen) return null;

  // Helper to generate jittered time string around shift
  const generateTime = (baseTime: string, jitterDirection: 'before' | 'after', seedOffset: number) => {
    const [h, m] = baseTime.split(':').map(Number);
    let totalMinutes = h * 60 + m;

    if (useRealisticJitter) {
      // Jitter 2-7 minutes
      const jitter = ((seedOffset * 3 + 4) % 6) + 2;
      if (jitterDirection === 'before') {
        totalMinutes = Math.max(0, totalMinutes - jitter);
      } else {
        totalMinutes = totalMinutes + jitter;
      }
    }

    const resH = Math.floor(totalMinutes / 60) % 24;
    const resM = totalMinutes % 60;
    const resS = ((seedOffset * 17) % 50) + 5;

    return `${String(resH).padStart(2, '0')}:${String(resM).padStart(2, '0')}:${String(resS).padStart(2, '0')}`;
  };

  const handleExecute = () => {
    if (targetEmployees.length === 0) {
      alert('Pilih minimal satu karyawan untuk menjalankan absensi otomatis.');
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      const generated: AttendanceRecord[] = [];
      let updatedCount = 0;
      let newCount = 0;

      targetEmployees.forEach((emp, index) => {
        const existing = recordsOnDate.find((r) => r.employeeId === emp.id);
        const leaveReq = employeesOnApprovedLeaveOnDate.get(emp.id);

        if (existing && !overwriteExisting && autoMode === 'both') {
          // Skip if already recorded and overwrite is disabled
          return;
        }

        // If employee is on full-day leave and excludeApprovedLeave is active, do not overwrite leave record
        if (excludeApprovedLeave && leaveReq && (leaveReq.type.toLowerCase().includes('cuti') || leaveReq.type === 'Sakit' || leaveReq.type === 'Izin' || leaveReq.type === 'Izin Dinas Luar')) {
          return;
        }

        const shiftStart = emp.shift?.startTime || officeConfig?.workStartTime || '08:30';
        const shiftEnd = emp.shift?.endTime || officeConfig?.workEndTime || '17:30';

        let checkInTime: string | null = null;
        let checkOutTime: string | null = null;
        let status: AttendanceStatus = 'Hadir Tepat Waktu';

        if (autoMode === 'both') {
          checkInTime = generateTime(shiftStart, 'before', index);
          checkOutTime = generateTime(shiftEnd, 'after', index + 1);
        } else if (autoMode === 'checkInOnly') {
          checkInTime = generateTime(shiftStart, 'before', index);
          checkOutTime = existing?.checkOutTime || null;
        } else if (autoMode === 'checkOutOnly') {
          checkInTime = existing?.checkInTime || generateTime(shiftStart, 'before', index);
          checkOutTime = generateTime(shiftEnd, 'after', index + 1);
        }

        const isLatePermit = leaveReq?.type === 'Izin Datang Terlambat';
        const isEarlyPermit = leaveReq?.type === 'Izin Pulang Awal';
        const isDinas = leaveReq?.type === 'Izin Dinas Luar';

        let recordType = attendanceType;
        if (isDinas) {
          recordType = 'Dinas Luar';
        }

        const roleLabel = currentEmployee.systemRole === 'superadmin' ? 'Superadmin' : 'Administrator';
        let notes = `Presensi Otomatis Sistem (Disetujui ${roleLabel}: ${currentEmployee.name})`;

        if (isLatePermit && leaveReq) {
          notes += ` • [Izin Terlambat Disetujui: ${leaveReq.reason || '-'}]`;
        }
        if (isEarlyPermit && leaveReq) {
          notes += ` • [Izin Pulang Awal Disetujui: ${leaveReq.reason || '-'}]`;
        }
        if (isDinas && leaveReq) {
          notes += ` • [Tugas Dinas Luar: ${leaveReq.reason || '-'}]`;
        }

        const lateMins = calculateLateMinutes(checkInTime, shiftStart);
        const earlyMins = calculateEarlyMinutes(checkOutTime, shiftEnd, checkInTime, shiftStart);

        const record: AttendanceRecord = {
          id: existing ? existing.id : `att-auto-${Date.now()}-${emp.id}`,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeNik: emp.nik,
          department: emp.department,
          date: targetDate,
          type: recordType,
          checkInTime,
          checkOutTime,
          status,
          lateMinutes: lateMins > 0 ? lateMins : undefined,
          earlyMinutes: earlyMins > 0 ? earlyMins : undefined,
          hasLatePermit: isLatePermit ? true : undefined,
          hasEarlyPermit: isEarlyPermit ? true : undefined,
          checkInPhoto: existing?.checkInPhoto || emp.avatarUrl,
          checkOutPhoto: existing?.checkOutPhoto || emp.avatarUrl,
          location: {
            latitude: officeConfig.latitude,
            longitude: officeConfig.longitude,
            accuracy: 8,
            address: `${officeConfig.name} (Validasi Lokasi Otomatis)`,
            distanceToOfficeMeters: Math.floor(Math.random() * 25) + 5,
            isWithinRadius: true,
          },
          notes,
          isManualEntry: false,
          isAutoGenerated: true,
          recordedBy: `${currentEmployee.name} (${roleLabel})`,
        };

        if (existing) {
          updatedCount++;
        } else {
          newCount++;
        }

        generated.push(record);
      });

      setIsProcessing(false);
      onExecuteAutoAttendance(
        generated,
        `Berhasil memproses absensi otomatis untuk ${generated.length} karyawan (${newCount} baru, ${updatedCount} diperbarui)!`
      );
      onClose();
    }, 400);
  };

  const isSuperadmin = currentEmployee.systemRole === 'superadmin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 text-yellow-300 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 fill-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Input Absensi Otomatis Sistem
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isSuperadmin 
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40' 
                    : 'bg-blue-500/30 text-blue-200 border border-blue-400/40'
                }`}>
                  {isSuperadmin ? '👑 Superadmin Authorized' : '🛡️ Admin Authorized'}
                </span>
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5">
                Generate dan rekap presensi seluruh karyawan secara otomatis dan presisi sesuai jadwal shift.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* Top Info Banner */}
          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-950 leading-relaxed">
              <span className="font-bold">Otorisasi Eksekutif:</span> Fitur ini memungkinkan{' '}
              <strong>{isSuperadmin ? 'Superadmin' : 'Administrator'}</strong> (<strong>{currentEmployee.name}</strong>) untuk melakukan pencatatan absensi secara serentak bagi semua user dengan kalkulasi jam shift, validasi GPS kantor, dan status tepat waktu secara otomatis.
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Tanggal Presensi */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Tanggal Presensi</span>
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-400">
                {targetDate === todayStr ? 'Hari Ini (Default)' : 'Tanggal terpilih'}
              </span>
            </div>

            {/* Mode Presensi Otomatis */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Mode Otomatis</span>
              </label>
              <select
                value={autoMode}
                onChange={(e) => setAutoMode(e.target.value as AutoMode)}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="both">Masuk & Pulang (Lengkap)</option>
                <option value="checkInOnly">Hanya Absen Masuk</option>
                <option value="checkOutOnly">Hanya Absen Pulang (Check-out)</option>
              </select>
              <span className="text-[10px] text-slate-400">
                {autoMode === 'both' && 'Generate jam masuk & jam pulang'}
                {autoMode === 'checkInOnly' && 'Hanya isi jam masuk'}
                {autoMode === 'checkOutOnly' && 'Lengkapi jam pulang yang belum ada'}
              </span>
            </div>

            {/* Tipe Kehadiran */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Tipe Kehadiran</span>
              </label>
              <select
                value={attendanceType}
                onChange={(e) => setAttendanceType(e.target.value as AttendanceType)}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="WFO">WFO (Kantor SCBD)</option>
                <option value="WFH">WFH (Work From Home)</option>
                <option value="Dinas Luar">Dinas Luar Kota</option>
              </select>
              <span className="text-[10px] text-slate-400">
                {attendanceType === 'WFO' ? 'GPS kantor otomatis tervalidasi' : 'Lokasi fleksibel'}
              </span>
            </div>

          </div>

          {/* Options: Realistic Jitter & Overwrite & Exclude Leaves */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useRealisticJitter}
                  onChange={(e) => setUseRealisticJitter(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>
                  <strong>Variasi Menit Alami:</strong> Acak menit (2-7 menit sebelum/sesudah jam shift)
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>
                  <strong>Timpa Data:</strong> Perbarui jika sudah ada absen
                </span>
              </label>
            </div>

            {/* Exclude Approved Leaves Protection */}
            <div className="pt-2 border-t border-slate-200/80">
              <label className="flex items-center gap-2 text-amber-900 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeApprovedLeave}
                  onChange={(e) => setExcludeApprovedLeave(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>
                  🛡️ <strong>Lindungi Pengajuan Cuti / Izin Disetujui:</strong> Jangan timpa data karyawan yang sedang Cuti, Sakit, atau Dinas Luar ({employeesOnApprovedLeaveOnDate.size} pengajuan aktif pada {targetDate})
                </span>
              </label>
            </div>
          </div>

          {/* Target Employee Selection & Filter */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">
                  Pilih Target Karyawan ({targetEmployees.length} dipilih dari {employees.length} total)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  {availableEmployees.every((e) => selectedEmployeeIds.includes(e.id))
                    ? 'Batalkan Semua'
                    : 'Pilih Semua'}
                </button>
              </div>
            </div>

            {/* Sub-filters for selection list */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama karyawan / NIK..."
                  value={searchEmployeeQuery}
                  onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                  className="w-full py-1.5 pl-8 pr-3 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Dept filter */}
              <div className="w-full sm:w-48">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">Semua Departemen</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unrecorded filter */}
              <button
                type="button"
                onClick={() => setFilterUnrecordedOnly(!filterUnrecordedOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                  filterUnrecordedOnly
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Hanya yang Belum Absen
              </button>
            </div>

            {/* Scrollable Employee Checklist Cards */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white">
              {availableEmployees.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Tidak ada karyawan yang cocok dengan kriteria filter.
                </div>
              ) : (
                availableEmployees.map((emp) => {
                  const isChecked = selectedEmployeeIds.includes(emp.id);
                  const isAlreadyRecorded = recordedEmployeeIdsOnDate.has(emp.id);

                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleToggleEmployee(emp.id)}
                      className={`p-2.5 sm:px-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-blue-600 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 fill-blue-600 text-white" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <img
                          src={emp.avatarUrl}
                          alt={emp.name}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {emp.name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {emp.nik}
                            </span>
                            {emp.systemRole === 'superadmin' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-bold">
                                Superadmin
                              </span>
                            )}
                            {emp.systemRole === 'admin' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {emp.department} • Shift: {emp.shift?.name || '08:30 - 17:30'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        {(() => {
                          const leave = employeesOnApprovedLeaveOnDate.get(emp.id);
                          if (leave) {
                            const isCuti = leave.type.toLowerCase().includes('cuti');
                            const badgeColor = isCuti
                              ? 'bg-teal-50 text-teal-700 border-teal-200'
                              : leave.type === 'Sakit'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : leave.type === 'Izin Dinas Luar'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200';
                            return (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badgeColor}`}>
                                {leave.type} Disetujui
                              </span>
                            );
                          }
                          if (isAlreadyRecorded) {
                            return (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                Sudah Ada Data
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                              Belum Absen
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Summary Preview Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Akan memproses absensi otomatis untuk{' '}
                <strong className="text-slate-950 font-bold">{targetEmployees.length} karyawan</strong> pada tanggal{' '}
                <strong className="text-blue-700">{targetDate}</strong>.
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Status: Hadir Tepat Waktu (GPS SCBD)
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={targetEmployees.length === 0 || isProcessing}
            onClick={handleExecute}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all cursor-pointer ${
              targetEmployees.length === 0 || isProcessing
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
            }`}
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>
              {isProcessing
                ? 'Sedang Memproses...'
                : `Jalankan Absensi Otomatis (${targetEmployees.length} Karyawan)`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
