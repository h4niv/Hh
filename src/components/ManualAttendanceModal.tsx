import { useState, useEffect, useMemo, ChangeEvent, FormEvent } from 'react';
import { 
  X, 
  Clock, 
  Calendar, 
  User, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  ClockAlert,
  Edit3,
  Briefcase,
  Users,
  CheckSquare,
  Square,
  Search,
  ShieldCheck,
  UserX
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, AttendanceType, Employee } from '../types';

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  initialEmployeeId?: string;
  initialRecord?: AttendanceRecord | null;
  currentEmployee?: Employee;
  existingRecords?: AttendanceRecord[];
  onSave: (record: AttendanceRecord, isNew: boolean) => void;
  onSaveBulk?: (records: AttendanceRecord[], message: string) => void;
}

const QUICK_REASONS = [
  'Lupa melakukan presensi',
  'Kendala sinyal / GPS perangkat',
  'Tidak hadir tanpa keterangan (Alpha)',
  'Mangkir / tidak ada konfirmasi (Alpha)',
  'Meeting mendadak di luar kantor',
  'Dinas luar kota sejak pagi',
  'Perangkat HP tertinggal / rusak',
  'Tugas lembur atas instruksi atasan',
];

export default function ManualAttendanceModal({
  isOpen,
  onClose,
  employees,
  initialEmployeeId,
  initialRecord,
  currentEmployee,
  existingRecords,
  onSave,
  onSaveBulk,
}: ManualAttendanceModalProps) {
  const isEditing = Boolean(initialRecord);

  // Mode: 'single' (satu user) or 'bulk' (semua / banyak user)
  const [inputMode, setInputMode] = useState<'single' | 'bulk'>('single');

  // Form states
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialRecord?.employeeId || initialEmployeeId || (employees[0]?.id || '')
  );
  const [selectedBulkEmpIds, setSelectedBulkEmpIds] = useState<string[]>(() =>
    employees.map((e) => e.id)
  );
  const [bulkDeptFilter, setBulkDeptFilter] = useState<string>('all');
  const [bulkSearchQuery, setBulkSearchQuery] = useState<string>('');

  const [date, setDate] = useState<string>(
    initialRecord?.date || new Date().toISOString().slice(0, 10)
  );
  const [attendanceType, setAttendanceType] = useState<AttendanceType>(
    initialRecord?.type || 'WFO'
  );
  const [checkInTime, setCheckInTime] = useState<string>(
    initialRecord?.checkInTime ? initialRecord.checkInTime.slice(0, 5) : '08:30'
  );
  const [checkOutTime, setCheckOutTime] = useState<string>(
    initialRecord?.checkOutTime ? initialRecord.checkOutTime.slice(0, 5) : '17:30'
  );
  const [hasNoCheckOut, setHasNoCheckOut] = useState<boolean>(
    initialRecord ? !initialRecord.checkOutTime : false
  );
  const [hasNoCheckIn, setHasNoCheckIn] = useState<boolean>(
    initialRecord ? !initialRecord.checkInTime : false
  );
  const [status, setStatus] = useState<AttendanceStatus>(
    initialRecord?.status || 'Hadir Tepat Waktu'
  );
  const [isStatusManuallyOverridden, setIsStatusManuallyOverridden] = useState<boolean>(
    Boolean(initialRecord)
  );
  const [notes, setNotes] = useState<string>(
    initialRecord?.notes || ''
  );
  const [formError, setFormError] = useState<string | null>(null);

  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department)));
  }, [employees]);

  // Synchronize when initialRecord or initialEmployeeId changes
  useEffect(() => {
    if (initialRecord) {
      setInputMode('single');
      setSelectedEmpId(initialRecord.employeeId);
      setDate(initialRecord.date);
      setAttendanceType(initialRecord.type);
      setCheckInTime(initialRecord.checkInTime ? initialRecord.checkInTime.slice(0, 5) : '08:30');
      setCheckOutTime(initialRecord.checkOutTime ? initialRecord.checkOutTime.slice(0, 5) : '17:30');
      setHasNoCheckIn(!initialRecord.checkInTime);
      setHasNoCheckOut(!initialRecord.checkOutTime);
      setStatus(initialRecord.status);
      setIsStatusManuallyOverridden(true);
      setNotes(initialRecord.notes || '');
    } else {
      setSelectedEmpId(initialEmployeeId || (employees[0]?.id || ''));
      setSelectedBulkEmpIds(employees.map((e) => e.id));
      setDate(new Date().toISOString().slice(0, 10));
      setAttendanceType('WFO');
      setCheckInTime('08:30');
      setCheckOutTime('17:30');
      setHasNoCheckIn(false);
      setHasNoCheckOut(false);
      setIsStatusManuallyOverridden(false);
      setNotes('');
      setFormError(null);
    }
  }, [initialRecord, initialEmployeeId, isOpen, employees]);

  // Current selected employee object in single mode
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || employees[0];
  }, [employees, selectedEmpId]);

  // Filtered employees for bulk selection
  const filteredBulkEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchDept = bulkDeptFilter === 'all' || emp.department === bulkDeptFilter;
      const matchSearch =
        emp.name.toLowerCase().includes(bulkSearchQuery.toLowerCase()) ||
        emp.nik.toLowerCase().includes(bulkSearchQuery.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [employees, bulkDeptFilter, bulkSearchQuery]);

  // Employees who have not yet recorded attendance on the selected date
  const unrecordedEmployees = useMemo(() => {
    if (!existingRecords) return [];
    const recordedEmpIds = new Set(
      existingRecords
        .filter((r) => r.date === date)
        .map((r) => r.employeeId)
    );
    return employees.filter((e) => !recordedEmpIds.has(e.id));
  }, [existingRecords, employees, date]);

  const handleToggleBulkEmp = (empId: string) => {
    setSelectedBulkEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAllBulkVisible = () => {
    const visibleIds = filteredBulkEmployees.map((e) => e.id);
    const allSelected = visibleIds.every((id) => selectedBulkEmpIds.includes(id));
    if (allSelected) {
      setSelectedBulkEmpIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedBulkEmpIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Auto calculate attendance status based on shift start time & late tolerance (single mode)
  useEffect(() => {
    if (inputMode !== 'single' || isStatusManuallyOverridden || hasNoCheckIn || !checkInTime || !selectedEmployee) {
      return;
    }

    const shiftStart = selectedEmployee.shift.startTime;
    const lateTolerance = selectedEmployee.shift.lateToleranceMinutes || 15;

    const [startH, startM] = shiftStart.split(':').map(Number);
    const [inH, inM] = checkInTime.split(':').map(Number);

    const shiftStartMinutes = startH * 60 + startM;
    const checkInMinutes = inH * 60 + inM;

    if (checkInMinutes > shiftStartMinutes + lateTolerance) {
      setStatus('Terlambat');
    } else {
      setStatus('Hadir Tepat Waktu');
    }
  }, [checkInTime, selectedEmployee, hasNoCheckIn, isStatusManuallyOverridden, inputMode]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!date) {
      setFormError('Pilih tanggal presensi.');
      return;
    }

    if (hasNoCheckIn && hasNoCheckOut && status !== 'Izin' && status !== 'Sakit' && status !== 'Alpha') {
      setFormError('Jam masuk atau jam pulang harus diisi kecuali status Izin/Sakit/Alpha.');
      return;
    }

    // Check time sanity if both are provided
    if (!hasNoCheckIn && !hasNoCheckOut && checkInTime && checkOutTime) {
      const [inH, inM] = checkInTime.split(':').map(Number);
      const [outH, outM] = checkOutTime.split(':').map(Number);
      if (outH * 60 + outM <= inH * 60 + inM) {
        setFormError('Jam pulang harus lebih akhir dari jam masuk.');
        return;
      }
    }

    const finalCheckIn = hasNoCheckIn ? null : `${checkInTime}:00`;
    const finalCheckOut = hasNoCheckOut ? null : `${checkOutTime}:00`;
    const roleLabel = currentEmployee
      ? currentEmployee.systemRole === 'superadmin'
        ? 'Superadmin'
        : 'Administrator'
      : 'Administrator';

    // Bulk Mode Submission
    if (inputMode === 'bulk' && !isEditing) {
      if (selectedBulkEmpIds.length === 0) {
        setFormError('Pilih minimal satu karyawan untuk input presensi massal.');
        return;
      }

      const targetEmployees = employees.filter((emp) => selectedBulkEmpIds.includes(emp.id));
      const recordsToSave: AttendanceRecord[] = targetEmployees.map((emp) => ({
        id: `att-manual-${Date.now()}-${emp.id}`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNik: emp.nik,
        department: emp.department,
        date,
        type: attendanceType,
        checkInTime: finalCheckIn,
        checkOutTime: finalCheckOut,
        status,
        checkInPhoto: emp.avatarUrl,
        checkOutPhoto: emp.avatarUrl,
        location: {
          latitude: -6.2255,
          longitude: 106.8095,
          accuracy: 10,
          address: 'Input Manual Administrator (Semua User)',
          distanceToOfficeMeters: 0,
          isWithinRadius: true,
        },
        notes: notes.trim()
          ? notes.trim()
          : `Input manual massal oleh ${roleLabel} (${currentEmployee?.name || 'Admin'})`,
        isManualEntry: true,
        recordedBy: currentEmployee ? `${currentEmployee.name} (${roleLabel})` : undefined,
      }));

      if (onSaveBulk) {
        onSaveBulk(
          recordsToSave,
          `Berhasil mencatat presensi manual untuk ${recordsToSave.length} karyawan pada tanggal ${date}!`
        );
      } else {
        recordsToSave.forEach((r) => onSave(r, true));
      }
      onClose();
      return;
    }

    // Single Mode Submission
    if (!selectedEmployee) {
      setFormError('Pilih karyawan terlebih dahulu.');
      return;
    }

    const recordToSave: AttendanceRecord = {
      id: initialRecord?.id || `att-manual-${Date.now()}`,
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      employeeNik: selectedEmployee.nik,
      department: selectedEmployee.department,
      date,
      type: attendanceType,
      checkInTime: finalCheckIn,
      checkOutTime: finalCheckOut,
      status,
      checkInPhoto: initialRecord?.checkInPhoto || selectedEmployee.avatarUrl,
      checkOutPhoto: initialRecord?.checkOutPhoto || selectedEmployee.avatarUrl,
      location: initialRecord?.location || {
        latitude: -6.2255,
        longitude: 106.8095,
        accuracy: 10,
        address: 'Input Manual Administrator',
        distanceToOfficeMeters: 0,
        isWithinRadius: true,
      },
      notes: notes.trim() 
        ? notes.trim() 
        : (isEditing ? 'Disesuaikan secara manual' : `Diinput manual oleh ${roleLabel} (${currentEmployee?.name || 'Admin'})`),
      isManualEntry: true,
      recordedBy: currentEmployee ? `${currentEmployee.name} (${roleLabel})` : undefined,
    };

    onSave(recordToSave, !isEditing);
    onClose();
  };

  const isSuperadmin = currentEmployee?.systemRole === 'superadmin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {isEditing ? 'Edit Jam Presensi Karyawan' : 'Input Presensi Manual'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSuperadmin 
                    ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                    : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                }`}>
                  {isSuperadmin ? '👑 Superadmin' : '🛡️ Admin'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isEditing 
                  ? 'Perbarui jam masuk atau jam pulang untuk data kehadiran yang sudah ada'
                  : 'Catat jam masuk dan jam pulang secara manual untuk satu karyawan atau semua user'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (If not editing existing single record) */}
        {!isEditing && (
          <div className="px-5 pt-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInputMode('single')}
              className={`flex items-center gap-2 py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                inputMode === 'single'
                  ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Satu Karyawan</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('bulk')}
              className={`flex items-center gap-2 py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                inputMode === 'bulk'
                  ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Semua Karyawan (Input Massal)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                {employees.length}
              </span>
            </button>
          </div>
        )}

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* SINGLE MODE: Pilih 1 Karyawan */}
          {inputMode === 'single' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Pilih Karyawan <span className="text-rose-500">*</span></span>
              </label>
              <select
                id="manual-emp-select"
                value={selectedEmpId}
                disabled={isEditing}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value);
                  setIsStatusManuallyOverridden(false);
                }}
                className={`w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isEditing ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-800'
                }`}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.nik}) - {emp.department} [{emp.systemRole}]
                  </option>
                ))}
              </select>

              {selectedEmployee && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                  <span>Shift Kerja: <strong>{selectedEmployee.shift.startTime} - {selectedEmployee.shift.endTime}</strong></span>
                  <span>Toleransi: <strong>{selectedEmployee.shift.lateToleranceMinutes} mnt</strong></span>
                </div>
              )}
            </div>
          )}

          {/* BULK MODE: Pilih Semua / Checklist Karyawan */}
          {inputMode === 'bulk' && !isEditing && (
            <div className="space-y-2 p-3.5 rounded-xl bg-blue-50/40 border border-blue-100">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Target Karyawan ({selectedBulkEmpIds.length} dari {employees.length} dipilih)</span>
                </div>
                <div className="flex items-center gap-2">
                  {unrecordedEmployees.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBulkEmpIds(unrecordedEmployees.map((e) => e.id));
                      }}
                      className="text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer flex items-center gap-1"
                      title="Pilih hanya karyawan yang belum tercatat presensinya pada tanggal ini"
                    >
                      <span>Pilih Belum Absen ({unrecordedEmployees.length})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSelectAllBulkVisible}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    {filteredBulkEmployees.every((e) => selectedBulkEmpIds.includes(e.id))
                      ? 'Batal Pilih Semua'
                      : 'Pilih Semua'}
                  </button>
                </div>
              </div>

              {/* Sub filters */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama karyawan..."
                    value={bulkSearchQuery}
                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                    className="w-full py-1 pl-7 pr-2 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <select
                  value={bulkDeptFilter}
                  onChange={(e) => setBulkDeptFilter(e.target.value)}
                  className="py-1 px-2 text-xs rounded-lg border border-slate-200 bg-white"
                >
                  <option value="all">Semua Dept</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Checklist box */}
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white rounded-lg border border-slate-200">
                {filteredBulkEmployees.map((emp) => {
                  const isChecked = selectedBulkEmpIds.includes(emp.id);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleToggleBulkEmp(emp.id)}
                      className={`p-2 flex items-center justify-between gap-2 text-xs cursor-pointer ${
                        isChecked ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-blue-600 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 fill-blue-600 text-white" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-300" />
                          )}
                        </div>
                        <img
                          src={emp.avatarUrl}
                          alt={emp.name}
                          className="w-6 h-6 rounded-full object-cover border"
                        />
                        <span className="font-semibold text-slate-800 truncate">{emp.name}</span>
                        <span className="text-[10px] text-slate-400">({emp.nik})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">{emp.department}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tanggal Presensi & Tipe Kehadiran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Tanggal <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="date"
                id="manual-date-input"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                <span>Tipe Kehadiran</span>
              </label>
              <select
                id="manual-type-select"
                value={attendanceType}
                onChange={(e) => setAttendanceType(e.target.value as AttendanceType)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="WFO">WFO (Work From Office / Kantor)</option>
                <option value="WFH">WFH (Work From Home / Rumah)</option>
                <option value="Dinas Luar">Dinas Luar (Perjalanan Dinas)</option>
              </select>
            </div>
          </div>

          {/* Jam Masuk & Jam Pulang */}
          <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 space-y-4">
            <div className="text-xs font-bold text-blue-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Waktu Presensi (Jam Masuk & Pulang)</span>
              </span>
              <span className="text-[11px] font-normal text-blue-600">Waktu Indonesia Barat (WIB)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Jam Masuk */}
              <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Jam Masuk (Clock In)
                  </label>
                  <label className="inline-flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasNoCheckIn}
                      onChange={(e) => setHasNoCheckIn(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span>Belum / Lewati</span>
                  </label>
                </div>

                <input
                  type="time"
                  id="manual-checkin-time"
                  value={checkInTime}
                  disabled={hasNoCheckIn}
                  onChange={(e) => {
                    setCheckInTime(e.target.value);
                    setIsStatusManuallyOverridden(false);
                  }}
                  className={`w-full px-3 py-2 font-mono text-sm font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    hasNoCheckIn ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-800'
                  }`}
                />
              </div>

              {/* Jam Pulang */}
              <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Jam Pulang (Clock Out)
                  </label>
                  <label className="inline-flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasNoCheckOut}
                      onChange={(e) => setHasNoCheckOut(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span>Belum / Lewati</span>
                  </label>
                </div>

                <input
                  type="time"
                  id="manual-checkout-time"
                  value={checkOutTime}
                  disabled={hasNoCheckOut}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className={`w-full px-3 py-2 font-mono text-sm font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    hasNoCheckOut ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-800'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Status Kehadiran */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Status Kehadiran</span>
              </label>
              {isStatusManuallyOverridden && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Ditetapkan manual
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['Hadir Tepat Waktu', 'Terlambat', 'Izin', 'Sakit', 'Alpha'] as AttendanceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatus(st);
                    setIsStatusManuallyOverridden(true);
                    if (st === 'Alpha') {
                      setHasNoCheckIn(true);
                      setHasNoCheckOut(true);
                      setCheckInTime('');
                      setCheckOutTime('');
                      if (!notes || notes === 'Lupa melakukan presensi') {
                        setNotes('Tidak hadir tanpa konfirmasi / keterangan (Alpha manual)');
                      }
                    } else if (st === 'Izin' || st === 'Sakit') {
                      setHasNoCheckIn(true);
                      setHasNoCheckOut(true);
                    }
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                    status === st
                      ? st === 'Hadir Tepat Waktu'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : st === 'Terlambat'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : st === 'Alpha'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-500/20'
                        : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Special Notice for Alpha Status */}
            {status === 'Alpha' && (
              <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                <UserX className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-xs block text-rose-950">
                    Penetapan Status Alpha oleh Admin / Superadmin
                  </span>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    User yang belum absen tidak dihitung Alpha secara otomatis oleh sistem. Status Alpha hanya tercatat dan dihitung ke statistik ketidakhadiran setelah Admin/Superadmin menyimpannya secara manual.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Catatan / Alasan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Catatan / Alasan Input Manual</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Kendala jaringan pada ponsel karyawan, atasan telah memverifikasi"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Quick Reason Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setNotes(r)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isEditing 
                ? 'Simpan Perubahan' 
                : inputMode === 'bulk'
                ? `Simpan Presensi (${selectedBulkEmpIds.length} Karyawan)`
                : 'Simpan Presensi Manual'}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
