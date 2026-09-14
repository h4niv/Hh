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
  Briefcase
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, AttendanceType, Employee } from '../types';

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  initialEmployeeId?: string;
  initialRecord?: AttendanceRecord | null;
  onSave: (record: AttendanceRecord, isNew: boolean) => void;
}

const QUICK_REASONS = [
  'Lupa melakukan presensi',
  'Kendala sinyal / GPS perangkat',
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
  onSave,
}: ManualAttendanceModalProps) {
  const isEditing = Boolean(initialRecord);

  // Form states
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialRecord?.employeeId || initialEmployeeId || (employees[0]?.id || '')
  );
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

  // Synchronize when initialRecord or initialEmployeeId changes
  useEffect(() => {
    if (initialRecord) {
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

  // Current selected employee object
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || employees[0];
  }, [employees, selectedEmpId]);

  // Auto calculate attendance status based on shift start time & late tolerance
  useEffect(() => {
    if (isStatusManuallyOverridden || hasNoCheckIn || !checkInTime || !selectedEmployee) {
      return;
    }

    const shiftStart = selectedEmployee.shift.startTime; // e.g. "08:30"
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
  }, [checkInTime, selectedEmployee, hasNoCheckIn, isStatusManuallyOverridden]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedEmployee) {
      setFormError('Pilih karyawan terlebih dahulu.');
      return;
    }

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
      checkInPhoto: initialRecord?.checkInPhoto,
      checkOutPhoto: initialRecord?.checkOutPhoto,
      location: initialRecord?.location || {
        latitude: -6.2088,
        longitude: 106.8456,
        accuracy: 10,
        address: 'Input Manual Administrator / Mandiri',
        distanceToOfficeMeters: 0,
        isWithinRadius: true,
      },
      notes: notes.trim() 
        ? notes.trim() 
        : (isEditing ? 'Disesuaikan secara manual' : 'Diinput manual'),
      isManualEntry: true,
    };

    onSave(recordToSave, !isEditing);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{isEditing ? 'Edit Jam Masuk & Pulang' : 'Input Presensi Manual'}</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold">
                  Manual Entry
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing 
                  ? 'Perbarui jam masuk atau jam pulang untuk data kehadiran yang sudah ada'
                  : 'Catat jam masuk dan jam pulang secara manual untuk karyawan yang lupa absen'}
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

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Pilih Karyawan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Karyawan <span className="text-rose-500">*</span></span>
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
                  {emp.name} ({emp.nik}) - {emp.department}
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

          {/* 2. Tanggal Presensi & Tipe Kehadiran */}
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

          {/* 3. Jam Masuk & Jam Pulang (Card Focus) */}
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
                <p className="text-[10px] text-slate-400">
                  {hasNoCheckIn ? 'Tidak ada catatan jam masuk' : `Shift standar: ${selectedEmployee?.shift.startTime || '08:30'}`}
                </p>
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
                    <span>Belum Pulang</span>
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
                <p className="text-[10px] text-slate-400">
                  {hasNoCheckOut ? 'Karyawan belum melakukan absen pulang' : `Shift pulang: ${selectedEmployee?.shift.endTime || '17:30'}`}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Status Kehadiran */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Status Kehadiran <span className="text-rose-500">*</span>
              </label>
              {!isStatusManuallyOverridden && !hasNoCheckIn && (
                <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Dihitung Otomatis dari Jam Masuk
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['Hadir Tepat Waktu', 'Terlambat', 'Izin', 'Sakit', 'Alpha'] as AttendanceStatus[]).map((st) => {
                const isSelected = status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatus(st);
                      setIsStatusManuallyOverridden(true);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? st === 'Hadir Tepat Waktu'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-400'
                          : st === 'Terlambat'
                          ? 'bg-amber-50 border-amber-300 text-amber-800 ring-1 ring-amber-400'
                          : 'bg-blue-50 border-blue-300 text-blue-800 ring-1 ring-blue-400'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{st}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Alasan / Keterangan Manual */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Alasan / Keterangan Penginputan Manual</span>
            </label>
            
            <textarea
              id="manual-notes-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Karyawan lupa absen karena langsung mengikuti meeting dengan klien..."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setNotes(reason)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] transition-colors cursor-pointer"
                >
                  + {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Information box */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
            Presensi manual ini akan tercatat dalam sistem audit riwayat absensi dengan penanda <strong>Manual Entry</strong>.
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              id="btn-submit-manual-attendance"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'Simpan Perubahan' : 'Simpan Presensi Manual'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
