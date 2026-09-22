import { useState, useMemo, FormEvent, useEffect, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  LogOut,
  ShieldAlert, 
  CalendarClock,
  ClockAlert,
  User,
  Search,
  Sparkles,
  Info,
  Plane,
  MapPin,
  Pencil,
  Trash2,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { LeaveRequest, LeaveType, LeaveStatus, Employee, OfficeConfig } from '../types';
import { getTodayDateString } from '../utils/geo';

interface LeaveManagementProps {
  requests: LeaveRequest[];
  currentEmployee: Employee;
  employees: Employee[];
  officeConfig?: OfficeConfig;
  onSubmitRequest: (newReq: Omit<LeaveRequest, 'id' | 'appliedAt' | 'status'>) => void;
  onUpdateStatus: (requestId: string, newStatus: 'Disetujui' | 'Ditolak') => void;
  onEditRequest?: (updatedReq: LeaveRequest) => void;
  onDeleteRequest?: (requestId: string) => void;
  initialOpenModal?: boolean;
  initialLeaveType?: LeaveType;
  onClearInitialModal?: () => void;
}

// Time calculation helpers
const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  try {
    const [h, m] = (timeStr || '08:30').split(':').map(Number);
    const totalMinutes = (h * 60 + m + minutesToAdd + 1440) % 1440;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  } catch {
    return '09:00';
  }
};

const subtractMinutesFromTime = (timeStr: string, minutesToSubtract: number): string => {
  try {
    const [h, m] = (timeStr || '17:30').split(':').map(Number);
    let totalMinutes = h * 60 + m - minutesToSubtract;
    if (totalMinutes < 0) totalMinutes += 1440;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  } catch {
    return '16:30';
  }
};

const getTimeDifferenceMinutes = (t1: string, t2: string): number => {
  try {
    const [h1, m1] = (t1 || '08:30').split(':').map(Number);
    const [h2, m2] = (t2 || '09:00').split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  } catch {
    return 0;
  }
};

export default function LeaveManagement({
  requests,
  currentEmployee,
  employees,
  officeConfig,
  onSubmitRequest,
  onUpdateStatus,
  onEditRequest,
  onDeleteRequest,
  initialOpenModal,
  initialLeaveType,
  onClearInitialModal,
}: LeaveManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'cuti_sakit' | 'terlambat' | 'pulang_awal' | 'pending'>('all');
  const [activeQuotaTab, setActiveQuotaTab] = useState<'terlambat' | 'pulang_awal'>('terlambat');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7); // e.g. "2026-09"
  });

  // Target Employee State for Form
  const [targetEmpId, setTargetEmpId] = useState<string>(currentEmployee.id);
  const [targetEmpSearch, setTargetEmpSearch] = useState<string>('');
  const [isTargetEmpPickerOpen, setIsTargetEmpPickerOpen] = useState<boolean>(false);
  const targetEmpInputRef = useRef<HTMLInputElement>(null);

  // Modal Form states
  const [leaveType, setLeaveType] = useState<LeaveType>('Izin Datang Terlambat');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getTodayDateString());
  
  // Late Permit form states
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState<string>('09:15');
  const [lateMinutesInput, setLateMinutesInput] = useState<number>(45);

  // Early Departure form states
  const [estimatedDepartureTime, setEstimatedDepartureTime] = useState<string>('16:00');
  const [earlyMinutesInput, setEarlyMinutesInput] = useState<number>(90);

  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSpecialExemptionChecked, setIsSpecialExemptionChecked] = useState<boolean>(false);

  // Selected Target Employee
  const targetEmployee = useMemo(() => {
    return employees.find((e) => e.id === targetEmpId) || currentEmployee;
  }, [employees, targetEmpId, currentEmployee]);

  // Filtered employees for search
  const filteredEmployeesForModal = useMemo(() => {
    if (!targetEmpSearch.trim()) return employees;
    const q = targetEmpSearch.toLowerCase().trim();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.nik.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q)
    );
  }, [employees, targetEmpSearch]);

  // Fallback defaults for limits if not yet set in officeConfig
  const maxLateCount = officeConfig?.maxLatePermitCountPerMonth ?? 3;
  const maxLateMinutes = officeConfig?.maxLatePermitMinutesPerMonth ?? 120;
  const maxEarlyCount = officeConfig?.maxEarlyLeaveCountPerMonth ?? 3;
  const maxEarlyMinutes = officeConfig?.maxEarlyLeaveMinutesPerMonth ?? 120;

  const workStartTime = targetEmployee.shift?.startTime || officeConfig?.workStartTime || '08:30';
  const workEndTime = targetEmployee.shift?.endTime || officeConfig?.workEndTime || '17:30';

  // Handle initial modal open trigger from App / Dashboard
  useEffect(() => {
    if (initialOpenModal) {
      if (initialLeaveType) {
        setLeaveType(initialLeaveType);
      }
      setStartDate(getTodayDateString());
      setEndDate(getTodayDateString());
      setTargetEmpId(currentEmployee.id);
      setTargetEmpSearch(currentEmployee.name);
      setFormError(null);
      setIsSpecialExemptionChecked(false);
      setReason('');

      // Auto configure default times
      if (initialLeaveType === 'Izin Datang Terlambat' || (!initialLeaveType && leaveType === 'Izin Datang Terlambat')) {
        const defaultLateMinutes = 30;
        setLateMinutesInput(defaultLateMinutes);
        setEstimatedArrivalTime(addMinutesToTime(workStartTime, defaultLateMinutes));
      } else if (initialLeaveType === 'Izin Pulang Awal') {
        const defaultEarlyMinutes = 60;
        setEarlyMinutesInput(defaultEarlyMinutes);
        setEstimatedDepartureTime(subtractMinutesFromTime(workEndTime, defaultEarlyMinutes));
      }

      setIsModalOpen(true);
      if (onClearInitialModal) onClearInitialModal();
    }
  }, [initialOpenModal, initialLeaveType, currentEmployee, workStartTime, workEndTime, onClearInitialModal, leaveType]);

  // Calculate days between start and end
  const calculateDays = (start: string, end: string) => {
    try {
      const d1 = new Date(start);
      const d2 = new Date(end);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  };

  const totalDays = calculateDays(startDate, endDate);
  const isAdminOrSuper = currentEmployee.systemRole === 'admin' || currentEmployee.systemRole === 'superadmin';
  const isSuperAdmin = currentEmployee.systemRole === 'superadmin' || currentEmployee.role.toLowerCase().includes('super');

  // Super Admin: Edit and Delete state
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);

  // Edit form states
  const [editEmpId, setEditEmpId] = useState<string>('');
  const [editType, setEditType] = useState<LeaveType>('Cuti Tahunan');
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [editEstimatedArrivalTime, setEditEstimatedArrivalTime] = useState<string>('09:15');
  const [editLateMinutes, setEditLateMinutes] = useState<number>(30);
  const [editEstimatedDepartureTime, setEditEstimatedDepartureTime] = useState<string>('16:30');
  const [editEarlyDepartureMinutes, setEditEarlyDepartureMinutes] = useState<number>(60);
  const [editReason, setEditReason] = useState<string>('');
  const [editStatus, setEditStatus] = useState<LeaveStatus>('Menunggu');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editApprovedBy, setEditApprovedBy] = useState<string>('');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const handleOpenEditModal = (req: LeaveRequest) => {
    setEditingRequest(req);
    setEditEmpId(req.employeeId);
    setEditType(req.type);
    setEditStartDate(req.startDate);
    setEditEndDate(req.endDate);
    setEditEstimatedArrivalTime(req.estimatedArrivalTime || '09:15');
    setEditLateMinutes(req.lateMinutes || 30);
    setEditEstimatedDepartureTime(req.estimatedDepartureTime || '16:30');
    setEditEarlyDepartureMinutes(req.earlyDepartureMinutes || 60);
    setEditReason(req.reason);
    setEditStatus(req.status);
    setEditNotes(req.notes || '');
    setEditApprovedBy(req.approvedBy || '');
    setEditFormError(null);
  };

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingRequest || !onEditRequest) return;
    setEditFormError(null);

    if (!editReason.trim()) {
      setEditFormError('Mohon isi alasan / keterangan pengajuan.');
      return;
    }

    const selectedTarget = employees.find((e) => e.id === editEmpId) || {
      id: editingRequest.employeeId,
      name: editingRequest.employeeName,
      nik: editingRequest.employeeNik,
      department: editingRequest.department,
    };

    const calculatedDays = calculateDays(editStartDate, editEndDate);

    const updatedReq: LeaveRequest = {
      ...editingRequest,
      employeeId: selectedTarget.id,
      employeeName: selectedTarget.name,
      employeeNik: selectedTarget.nik,
      department: selectedTarget.department,
      type: editType,
      startDate: editStartDate,
      endDate: editEndDate,
      totalDays: calculatedDays,
      reason: editReason.trim(),
      status: editStatus,
      notes: editNotes.trim() || undefined,
      approvedBy:
        editStatus !== 'Menunggu'
          ? editApprovedBy.trim() || `${currentEmployee.name} (Super Admin)`
          : undefined,
      estimatedArrivalTime: editType === 'Izin Datang Terlambat' ? editEstimatedArrivalTime : undefined,
      lateMinutes: editType === 'Izin Datang Terlambat' ? editLateMinutes : undefined,
      estimatedDepartureTime: editType === 'Izin Pulang Awal' ? editEstimatedDepartureTime : undefined,
      earlyDepartureMinutes: editType === 'Izin Pulang Awal' ? editEarlyDepartureMinutes : undefined,
    };

    onEditRequest(updatedReq);
    setEditingRequest(null);
  };

  const handleConfirmDelete = () => {
    if (!requestToDelete || !onDeleteRequest) return;
    onDeleteRequest(requestToDelete.id);
    setRequestToDelete(null);
  };

  // Monthly stats for Izin Datang Terlambat for selected target employee
  const employeeMonthlyLateRequests = useMemo(() => {
    return requests.filter((r) => {
      const isThisEmp = r.employeeId === targetEmployee.id;
      const isLateType = r.type === 'Izin Datang Terlambat';
      const isThisMonth = r.startDate.startsWith(selectedMonth);
      const isNotRejected = r.status !== 'Ditolak';
      return isThisEmp && isLateType && isThisMonth && isNotRejected;
    });
  }, [requests, targetEmployee.id, selectedMonth]);

  const usedLateCount = employeeMonthlyLateRequests.length;
  const usedLateMinutes = employeeMonthlyLateRequests.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
  const remainingLateCount = Math.max(0, maxLateCount - usedLateCount);
  const remainingLateMinutes = Math.max(0, maxLateMinutes - usedLateMinutes);
  const percentLateCountUsed = Math.min(100, Math.round((usedLateCount / maxLateCount) * 100));
  const percentLateMinutesUsed = Math.min(100, Math.round((usedLateMinutes / maxLateMinutes) * 100));

  // Monthly stats for Izin Pulang Awal for selected target employee
  const employeeMonthlyEarlyRequests = useMemo(() => {
    return requests.filter((r) => {
      const isThisEmp = r.employeeId === targetEmployee.id;
      const isEarlyType = r.type === 'Izin Pulang Awal';
      const isThisMonth = r.startDate.startsWith(selectedMonth);
      const isNotRejected = r.status !== 'Ditolak';
      return isThisEmp && isEarlyType && isThisMonth && isNotRejected;
    });
  }, [requests, targetEmployee.id, selectedMonth]);

  const usedEarlyCount = employeeMonthlyEarlyRequests.length;
  const usedEarlyMinutes = employeeMonthlyEarlyRequests.reduce((sum, r) => sum + (r.earlyDepartureMinutes || 0), 0);
  const remainingEarlyCount = Math.max(0, maxEarlyCount - usedEarlyCount);
  const remainingEarlyMinutes = Math.max(0, maxEarlyMinutes - usedEarlyMinutes);
  const percentEarlyCountUsed = Math.min(100, Math.round((usedEarlyCount / maxEarlyCount) * 100));
  const percentEarlyMinutesUsed = Math.min(100, Math.round((usedEarlyMinutes / maxEarlyMinutes) * 100));

  // Handle Late input changes
  const handleEstimatedArrivalChange = (arrivalTimeStr: string) => {
    setEstimatedArrivalTime(arrivalTimeStr);
    const diff = getTimeDifferenceMinutes(workStartTime, arrivalTimeStr);
    if (diff > 0) {
      setLateMinutesInput(diff);
    } else {
      setLateMinutesInput(15);
    }
  };

  const handleLateMinutesNumberChange = (mins: number) => {
    const validMins = Math.max(1, isNaN(mins) ? 1 : mins);
    setLateMinutesInput(validMins);
    setEstimatedArrivalTime(addMinutesToTime(workStartTime, validMins));
  };

  // Handle Early Departure input changes
  const handleEstimatedDepartureChange = (departureTimeStr: string) => {
    setEstimatedDepartureTime(departureTimeStr);
    const diff = getTimeDifferenceMinutes(departureTimeStr, workEndTime);
    if (diff > 0) {
      setEarlyMinutesInput(diff);
    } else {
      setEarlyMinutesInput(30);
    }
  };

  const handleEarlyMinutesNumberChange = (mins: number) => {
    const validMins = Math.max(1, isNaN(mins) ? 1 : mins);
    setEarlyMinutesInput(validMins);
    setEstimatedDepartureTime(subtractMinutesFromTime(workEndTime, validMins));
  };

  const activeEmpIdSet = useMemo(() => new Set(employees.map(e => e.id)), [employees]);

  // Filtered requests list (only active employees, and restricted to current user if not admin/superadmin)
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (!activeEmpIdSet.has(req.employeeId)) return false;

      // Pembatasan Akses: Karyawan biasa hanya dapat melihat pengajuan izin dirinya sendiri
      if (!isAdminOrSuper && req.employeeId !== currentEmployee.id) {
        return false;
      }

      if (filterTab === 'cuti_sakit') {
        return req.type !== 'Izin Datang Terlambat' && req.type !== 'Izin Pulang Awal';
      }
      if (filterTab === 'terlambat') {
        return req.type === 'Izin Datang Terlambat';
      }
      if (filterTab === 'pulang_awal') {
        return req.type === 'Izin Pulang Awal';
      }
      if (filterTab === 'pending') {
        return req.status === 'Menunggu';
      }
      return true;
    });
  }, [requests, filterTab, activeEmpIdSet, isAdminOrSuper, currentEmployee.id]);

  const totalLateRequestsAll = useMemo(() => {
    return requests.filter((r) => activeEmpIdSet.has(r.employeeId) && r.type === 'Izin Datang Terlambat').length;
  }, [requests, activeEmpIdSet]);

  const totalEarlyRequestsAll = useMemo(() => {
    return requests.filter((r) => activeEmpIdSet.has(r.employeeId) && r.type === 'Izin Pulang Awal').length;
  }, [requests, activeEmpIdSet]);

  const totalPendingRequests = useMemo(() => {
    return requests.filter((r) => activeEmpIdSet.has(r.employeeId) && r.status === 'Menunggu').length;
  }, [requests, activeEmpIdSet]);

  // Form submit handler
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!reason.trim()) {
      setFormError('Mohon isi alasan atau keterangan lengkap pengajuan.');
      return;
    }

    if (leaveType === 'Cuti Tahunan' && totalDays > targetEmployee.remainingLeaveQuota) {
      setFormError(`Sisa kuota cuti tahunan (${targetEmployee.remainingLeaveQuota} hari) tidak mencukupi untuk ${totalDays} hari.`);
      return;
    }

    // Validation for Izin Datang Terlambat
    if (leaveType === 'Izin Datang Terlambat') {
      if (!startDate) {
        setFormError('Pilih tanggal izin datang terlambat.');
        return;
      }
      if (!estimatedArrivalTime) {
        setFormError('Pilih estimasi jam tiba di kantor.');
        return;
      }
      if (lateMinutesInput <= 0) {
        setFormError('Durasi keterlambatan harus minimal 1 menit.');
        return;
      }

      const projectedCount = usedLateCount + 1;
      const projectedMinutes = usedLateMinutes + lateMinutesInput;
      const isOverQuota = projectedCount > maxLateCount || projectedMinutes > maxLateMinutes;

      if (isOverQuota && !isSpecialExemptionChecked && !isAdminOrSuper) {
        setFormError(
          `Pengajuan melebihi kuota bulanan terlambat (${maxLateCount}x / ${maxLateMinutes} menit). Centang persetujuan dispensasi di bawah untuk tetap mengirimkan pengajuan.`
        );
        return;
      }

      onSubmitRequest({
        employeeId: targetEmployee.id,
        employeeName: targetEmployee.name,
        employeeNik: targetEmployee.nik,
        department: targetEmployee.department,
        type: 'Izin Datang Terlambat',
        startDate,
        endDate: startDate,
        totalDays: 1,
        estimatedArrivalTime,
        lateMinutes: lateMinutesInput,
        reason: isOverQuota 
          ? `[Dispensasi Melebihi Kuota] ${reason.trim()}`
          : reason.trim(),
      });

      setIsModalOpen(false);
      setReason('');
      setIsSpecialExemptionChecked(false);
      return;
    }

    // Validation for Izin Pulang Awal
    if (leaveType === 'Izin Pulang Awal') {
      if (!startDate) {
        setFormError('Pilih tanggal izin pulang awal.');
        return;
      }
      if (!estimatedDepartureTime) {
        setFormError('Pilih estimasi jam meninggalkan kantor.');
        return;
      }
      if (earlyMinutesInput <= 0) {
        setFormError('Durasi pulang awal harus minimal 1 menit.');
        return;
      }

      const projectedEarlyCount = usedEarlyCount + 1;
      const projectedEarlyMinutes = usedEarlyMinutes + earlyMinutesInput;
      const isOverQuota = projectedEarlyCount > maxEarlyCount || projectedEarlyMinutes > maxEarlyMinutes;

      if (isOverQuota && !isSpecialExemptionChecked && !isAdminOrSuper) {
        setFormError(
          `Pengajuan melebihi kuota bulanan pulang awal (${maxEarlyCount}x / ${maxEarlyMinutes} menit). Centang persetujuan dispensasi di bawah untuk tetap mengirimkan pengajuan.`
        );
        return;
      }

      onSubmitRequest({
        employeeId: targetEmployee.id,
        employeeName: targetEmployee.name,
        employeeNik: targetEmployee.nik,
        department: targetEmployee.department,
        type: 'Izin Pulang Awal',
        startDate,
        endDate: startDate,
        totalDays: 1,
        estimatedDepartureTime,
        earlyDepartureMinutes: earlyMinutesInput,
        reason: isOverQuota 
          ? `[Dispensasi Melebihi Kuota] ${reason.trim()}`
          : reason.trim(),
      });

      setIsModalOpen(false);
      setReason('');
      setIsSpecialExemptionChecked(false);
      return;
    }

    // Standard Leave Requests (Cuti, Sakit, Izin Pribadi, etc.)
    onSubmitRequest({
      employeeId: targetEmployee.id,
      employeeName: targetEmployee.name,
      employeeNik: targetEmployee.nik,
      department: targetEmployee.department,
      type: leaveType,
      startDate,
      endDate,
      totalDays,
      reason: reason.trim(),
    });

    setIsModalOpen(false);
    setReason('');
  };

  const openFormWithDefaults = (type: LeaveType) => {
    setLeaveType(type);
    setStartDate(getTodayDateString());
    setEndDate(getTodayDateString());
    setTargetEmpId(currentEmployee.id);
    setTargetEmpSearch(currentEmployee.name);
    setFormError(null);
    setIsSpecialExemptionChecked(false);
    setReason('');

    if (type === 'Izin Datang Terlambat') {
      const defaultLateMins = 30;
      setLateMinutesInput(defaultLateMins);
      setEstimatedArrivalTime(addMinutesToTime(workStartTime, defaultLateMins));
    } else if (type === 'Izin Pulang Awal') {
      const defaultEarlyMins = 60;
      setEarlyMinutesInput(defaultEarlyMins);
      setEstimatedDepartureTime(subtractMinutesFromTime(workEndTime, defaultEarlyMins));
    }

    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6" id="leave-management-container">
      {/* Top Banner & Main Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-lg font-bold text-slate-900">Manajemen Izin & Cuti Karyawan</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              Sisa Cuti: {currentEmployee.remainingLeaveQuota} Hari
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              Sisa Terlambat: {remainingLateCount}x ({remainingLateMinutes} mnt)
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200 flex items-center gap-1">
              <LogOut className="w-3 h-3 text-indigo-600" />
              Sisa Pulang Awal: {remainingEarlyCount}x ({remainingEarlyMinutes} mnt)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Ajukan permohonan <strong>Izin Datang Terlambat</strong>, <strong>Izin Pulang Awal</strong>, cuti tahunan, atau izin sakit dengan kontrol kuota bulanan.
          </p>
        </div>

        <button
          type="button"
          id="btn-open-leave-modal"
          onClick={() => {
            setLeaveType('Izin Datang Terlambat');
            setStartDate(getTodayDateString());
            setEndDate(getTodayDateString());
            handleEstimatedArrivalChange('09:15');
            handleEstimatedDepartureChange('16:00');
            setFormError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer self-start lg:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Ajukan Izin / Cuti Baru</span>
        </button>
      </div>

      {/* SPECIAL MONTHLY QUOTA TRACKER CARDS FOR LATE & EARLY PERMITS */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white border border-slate-200 text-blue-600">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Pemantauan Kuota Izin Jam Kerja Bulanan ({currentEmployee.name})
              </h4>
              <p className="text-[11px] text-slate-500">
                Monitoring batasan izin terlambat & pulang awal per bulan kalender
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveQuotaTab('terlambat')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeQuotaTab === 'terlambat'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Izin Terlambat
              </button>
              <button
                type="button"
                onClick={() => setActiveQuotaTab('pulang_awal')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeQuotaTab === 'pulang_awal'
                    ? 'bg-indigo-100 text-indigo-900 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <LogOut className="w-3.5 h-3.5 text-indigo-600" />
                Izin Pulang Awal
              </button>
            </div>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-mono font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Tab 1: Izin Datang Terlambat Monthly Overview */}
        {activeQuotaTab === 'terlambat' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Metric 1: Frekuensi Izin Terlambat */}
              <div className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <ClockAlert className="w-4 h-4 text-amber-600" />
                    Frekuensi Pengajuan Terlambat
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    usedLateCount >= maxLateCount 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {usedLateCount >= maxLateCount ? 'Kuota Penuh' : `Sisa ${remainingLateCount}x`}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {usedLateCount} <span className="text-xs font-semibold text-slate-500 font-sans">/ {maxLateCount} Kali</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {percentLateCountUsed}% terpakai
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentLateCountUsed >= 100 
                        ? 'bg-rose-500' 
                        : percentLateCountUsed >= 66 
                        ? 'bg-amber-500' 
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentLateCountUsed}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  {usedLateCount >= maxLateCount
                    ? '⚠️ Batas maksimal pengajuan izin terlambat bulan ini telah tercapai.'
                    : `Anda dapat mengajukan izin datang terlambat ${remainingLateCount} kali lagi pada bulan ini.`}
                </p>
              </div>

              {/* Metric 2: Total Waktu Terlambat */}
              <div className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Total Durasi Waktu Terlambat
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    usedLateMinutes >= maxLateMinutes 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {usedLateMinutes >= maxLateMinutes ? 'Waktu Habis' : `Sisa ${remainingLateMinutes} Menit`}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {usedLateMinutes} <span className="text-xs font-semibold text-slate-500 font-sans">/ {maxLateMinutes} Menit</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {(usedLateMinutes / 60).toFixed(1)} jam terpakai
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentLateMinutesUsed >= 100 
                        ? 'bg-rose-500' 
                        : percentLateMinutesUsed >= 60 
                        ? 'bg-amber-500' 
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentLateMinutesUsed}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  {usedLateMinutes >= maxLateMinutes
                    ? '⚠️ Anda telah mencapai batas akumulasi durasi waktu izin terlambat bulan ini.'
                    : `Tersisa ${remainingLateMinutes} menit akumulasi waktu izin terlambat yang dapat dipergunakan.`}
                </p>
              </div>

            </div>

            {/* History pill breakdown for Late Requests */}
            {employeeMonthlyLateRequests.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 block mb-2">
                  Rincian Izin Terlambat Anda Bulan Ini ({employeeMonthlyLateRequests.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {employeeMonthlyLateRequests.map((lr) => (
                    <div key={lr.id} className="text-xs px-3 py-1.5 rounded-lg bg-white border border-amber-200 flex items-center gap-2 shadow-2xs">
                      <span className="font-semibold text-slate-800">{lr.startDate}</span>
                      <span>•</span>
                      <span className="font-mono text-amber-700 font-bold">Tiba: {lr.estimatedArrivalTime || '-'} ({lr.lateMinutes || 0} mnt)</span>
                      <span>•</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        lr.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {lr.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Izin Pulang Awal Monthly Overview */}
        {activeQuotaTab === 'pulang_awal' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Metric 1: Frekuensi Izin Pulang Awal */}
              <div className="bg-white rounded-xl p-4 border border-indigo-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <LogOut className="w-4 h-4 text-indigo-600" />
                    Frekuensi Izin Pulang Awal
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    usedEarlyCount >= maxEarlyCount 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {usedEarlyCount >= maxEarlyCount ? 'Kuota Penuh' : `Sisa ${remainingEarlyCount}x`}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {usedEarlyCount} <span className="text-xs font-semibold text-slate-500 font-sans">/ {maxEarlyCount} Kali</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {percentEarlyCountUsed}% terpakai
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentEarlyCountUsed >= 100 
                        ? 'bg-rose-500' 
                        : percentEarlyCountUsed >= 66 
                        ? 'bg-indigo-500' 
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentEarlyCountUsed}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  {usedEarlyCount >= maxEarlyCount
                    ? '⚠️ Batas maksimal pengajuan izin pulang awal bulan ini telah tercapai.'
                    : `Anda dapat mengajukan izin pulang awal ${remainingEarlyCount} kali lagi pada bulan ini.`}
                </p>
              </div>

              {/* Metric 2: Total Waktu Pulang Awal */}
              <div className="bg-white rounded-xl p-4 border border-indigo-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Total Durasi Waktu Pulang Awal
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    usedEarlyMinutes >= maxEarlyMinutes 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {usedEarlyMinutes >= maxEarlyMinutes ? 'Waktu Habis' : `Sisa ${remainingEarlyMinutes} Menit`}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {usedEarlyMinutes} <span className="text-xs font-semibold text-slate-500 font-sans">/ {maxEarlyMinutes} Menit</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {(usedEarlyMinutes / 60).toFixed(1)} jam terpakai
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentEarlyMinutesUsed >= 100 
                        ? 'bg-rose-500' 
                        : percentEarlyMinutesUsed >= 60 
                        ? 'bg-indigo-500' 
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentEarlyMinutesUsed}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  {usedEarlyMinutes >= maxEarlyMinutes
                    ? '⚠️ Anda telah mencapai batas akumulasi durasi izin pulang awal bulan ini.'
                    : `Tersisa ${remainingEarlyMinutes} menit akumulasi izin pulang awal yang dapat dipergunakan.`}
                </p>
              </div>

            </div>

            {/* History pill breakdown for Early Requests */}
            {employeeMonthlyEarlyRequests.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 block mb-2">
                  Rincian Izin Pulang Awal Anda Bulan Ini ({employeeMonthlyEarlyRequests.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {employeeMonthlyEarlyRequests.map((er) => (
                    <div key={er.id} className="text-xs px-3 py-1.5 rounded-lg bg-white border border-indigo-200 flex items-center gap-2 shadow-2xs">
                      <span className="font-semibold text-slate-800">{er.startDate}</span>
                      <span>•</span>
                      <span className="font-mono text-indigo-700 font-bold">Pulang: {er.estimatedDepartureTime || '-'} (Awal {er.earlyDepartureMinutes || 0} mnt)</span>
                      <span>•</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        er.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {er.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs & Table of Requests */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
        
        {/* Filter Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua Pengajuan ({requests.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('terlambat')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'terlambat'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <ClockAlert className="w-3.5 h-3.5" />
              <span>Izin Terlambat ({totalLateRequestsAll})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('pulang_awal')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'pulang_awal'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-indigo-800 hover:bg-indigo-50 border border-indigo-200'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Izin Pulang Awal ({totalEarlyRequestsAll})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('cuti_sakit')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterTab === 'cuti_sakit'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Cuti & Sakit ({requests.length - totalLateRequestsAll - totalEarlyRequestsAll})
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'pending'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Menunggu Review HR ({totalPendingRequests})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>Otoritas Super Admin: Akses Edit & Hapus Aktif</span>
              </span>
            ) : isAdminOrSuper ? (
              <span className="text-[11px] text-slate-500 font-medium">Mode Otoritas Admin: Dapat menyetujui / menolak</span>
            ) : (
              <span className="text-[11px] text-slate-400">Menampilkan pengajuan tim kantor</span>
            )}
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Karyawan</th>
                <th className="px-4 py-3">Jenis Pengajuan</th>
                <th className="px-4 py-3">Tanggal / Estimasi Waktu</th>
                <th className="px-4 py-3">Durasi / Waktu</th>
                <th className="px-4 py-3">Alasan / Keterangan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">
                  {isSuperAdmin ? 'Aksi (Review / Edit / Hapus)' : 'Aksi Review HRD'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Tidak ada data pengajuan dalam kategori ini.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isPending = req.status === 'Menunggu';
                  const isApproved = req.status === 'Disetujui';
                  const isRejected = req.status === 'Ditolak';
                  const isLatePermit = req.type === 'Izin Datang Terlambat';
                  const isEarlyPermit = req.type === 'Izin Pulang Awal';

                  return (
                    <tr 
                      key={req.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isLatePermit ? 'bg-amber-50/20' : isEarlyPermit ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{req.employeeName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{req.employeeNik} • {req.department}</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isLatePermit
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : isEarlyPermit
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                            : req.type === 'Izin Dinas Luar'
                            ? 'bg-amber-50 text-amber-900 border border-amber-300 font-bold'
                            : req.type === 'Cuti Tahunan'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : req.type === 'Sakit'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {isLatePermit && <ClockAlert className="w-3 h-3 text-amber-600" />}
                          {isEarlyPermit && <LogOut className="w-3 h-3 text-indigo-600" />}
                          {req.type === 'Izin Dinas Luar' && <Plane className="w-3 h-3 text-amber-600" />}
                          {req.type}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {req.startDate === req.endDate ? req.startDate : `${req.startDate} s/d ${req.endDate}`}
                        </div>
                        {isLatePermit && req.estimatedArrivalTime ? (
                          <div className="text-[11px] text-amber-700 font-semibold font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Tiba Pukul: {req.estimatedArrivalTime} WIB</span>
                          </div>
                        ) : isEarlyPermit && req.estimatedDepartureTime ? (
                          <div className="text-[11px] text-indigo-700 font-semibold font-mono flex items-center gap-1 mt-0.5">
                            <LogOut className="w-3 h-3 text-indigo-600" />
                            <span>Pulang Pukul: {req.estimatedDepartureTime} WIB</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">
                            Diajukan: {req.appliedAt}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {isLatePermit ? (
                          <div className="font-bold text-amber-900 font-mono">
                            {req.lateMinutes ?? 0} Menit
                            <span className="block text-[10px] font-normal text-slate-500">Izin Terlambat</span>
                          </div>
                        ) : isEarlyPermit ? (
                          <div className="font-bold text-indigo-900 font-mono">
                            {req.earlyDepartureMinutes ?? 0} Menit
                            <span className="block text-[10px] font-normal text-slate-500">Pulang Lebih Awal</span>
                          </div>
                        ) : (
                          <div className="font-medium text-slate-800 font-mono">
                            {req.totalDays} Hari
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-slate-700 leading-snug line-clamp-2" title={req.reason}>
                          {req.reason}
                        </p>
                        {req.notes && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">
                            Catatan HR: {req.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
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
                      </td>

                      {/* Action buttons for HR approval simulation and Super Admin controls */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isPending && isAdminOrSuper && (
                            <>
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(req.id, 'Disetujui')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Setujui permohonan"
                              >
                                <Check className="w-3 h-3" /> Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(req.id, 'Ditolak')}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Tolak permohonan"
                              >
                                <X className="w-3 h-3" /> Tolak
                              </button>
                            </>
                          )}

                          {!isPending && !isSuperAdmin && (
                            <div className="text-[11px] text-slate-400 italic">
                              <span>Selesai diproses</span>
                              {req.approvedBy && (
                                <span className="block text-[10px] text-slate-500 font-normal">Oleh: {req.approvedBy}</span>
                              )}
                            </div>
                          )}

                          {isPending && !isAdminOrSuper && (
                            <span className="text-[11px] text-amber-600 font-medium italic">
                              Menunggu Review Admin
                            </span>
                          )}

                          {/* Super Admin Exclusive: Edit and Delete buttons */}
                          {isSuperAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(req)}
                                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Edit data pengajuan (Super Admin)"
                              >
                                <Pencil className="w-3 h-3 text-blue-600" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setRequestToDelete(req)}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Hapus data pengajuan (Super Admin)"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajukan Cuti / Izin Datang Terlambat / Izin Pulang Awal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">Form Pengajuan Izin & Cuti</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto grow">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Employee Selection with Search */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Karyawan Pemohon <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={targetEmpInputRef}
                    type="text"
                    value={targetEmpSearch}
                    onChange={(e) => {
                      setTargetEmpSearch(e.target.value);
                      setIsTargetEmpPickerOpen(true);
                    }}
                    onFocus={() => setIsTargetEmpPickerOpen(true)}
                    placeholder="Ketik manual nama / NIK karyawan..."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>

                {isTargetEmpPickerOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsTargetEmpPickerOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto z-20 divide-y divide-slate-100">
                      {filteredEmployeesForModal.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          Karyawan &quot;{targetEmpSearch}&quot; tidak ditemukan.
                        </div>
                      ) : (
                        filteredEmployeesForModal.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setTargetEmpId(emp.id);
                              setTargetEmpSearch(emp.name);
                              setIsTargetEmpPickerOpen(false);
                              // Sync times to new employee shift
                              const start = emp.shift?.startTime || officeConfig?.workStartTime || '08:30';
                              const end = emp.shift?.endTime || officeConfig?.workEndTime || '17:30';
                              if (leaveType === 'Izin Datang Terlambat') {
                                setEstimatedArrivalTime(addMinutesToTime(start, lateMinutesInput));
                              } else if (leaveType === 'Izin Pulang Awal') {
                                setEstimatedDepartureTime(subtractMinutesFromTime(end, earlyMinutesInput));
                              }
                            }}
                            className={`w-full text-left px-3.5 py-2 hover:bg-blue-50 flex items-center justify-between text-xs cursor-pointer ${
                              targetEmployee.id === emp.id ? 'bg-blue-50/70 font-bold text-blue-800' : 'text-slate-700'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-slate-900">{emp.name}</div>
                              <div className="text-[10px] text-slate-500">{emp.nik} • {emp.department} • Shift {emp.shift?.name || 'Reguler'} ({emp.shift?.startTime || '08:30'}-{emp.shift?.endTime || '17:30'})</div>
                            </div>
                            {targetEmployee.id === emp.id && (
                              <Check className="w-3.5 h-3.5 text-blue-600" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Employee info banner & Current Quotas */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-bold text-slate-900">{targetEmployee.name}</span>
                  </div>
                  <p className="text-slate-500 text-[11px] font-mono mt-0.5">{targetEmployee.nik} • {targetEmployee.department} • Jam: {workStartTime}-{workEndTime}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <div className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    Cuti: <strong className="text-blue-600">{targetEmployee.remainingLeaveQuota}h</strong>
                  </div>
                  <div className="bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-amber-900">
                    Terlambat: <strong className="text-amber-800">{remainingLateCount}x ({remainingLateMinutes}m)</strong>
                  </div>
                  <div className="bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 text-indigo-900">
                    Pulang Awal: <strong className="text-indigo-800">{remainingEarlyCount}x ({remainingEarlyMinutes}m)</strong>
                  </div>
                </div>
              </div>

              {/* Type of leave selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Pengajuan <span className="text-red-500">*</span>
                </label>
                <select
                  id="leave-type-select"
                  value={leaveType}
                  onChange={(e) => {
                    const newType = e.target.value as LeaveType;
                    setLeaveType(newType);
                    setFormError(null);
                    if (newType === 'Izin Datang Terlambat') {
                      setLateMinutesInput(30);
                      setEstimatedArrivalTime(addMinutesToTime(workStartTime, 30));
                    } else if (newType === 'Izin Pulang Awal') {
                      setEarlyMinutesInput(60);
                      setEstimatedDepartureTime(subtractMinutesFromTime(workEndTime, 60));
                    }
                  }}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Izin Datang Terlambat">⏰ Izin Datang Terlambat (Batas Kuota Bulanan)</option>
                  <option value="Izin Pulang Awal">🏃 Izin Pulang Lebih Awal (Batas Kuota Bulanan)</option>
                  <option value="Izin Dinas Luar">✈️ Izin Dinas Luar / Tugas Luar Kantor</option>
                  <option value="Cuti Tahunan">🏖️ Cuti Tahunan (Mengurangi Kuota)</option>
                  <option value="Sakit">🏥 Sakit (Surat Dokter)</option>
                  <option value="Izin Pribadi">📋 Izin Pribadi / Keperluan Mendesak</option>
                  <option value="Cuti Melahirkan">👶 Cuti Melahirkan / Parental</option>
                </select>
              </div>

              {/* SPECIFIC FIELDS FOR IZIN DATANG TERLAMBAT */}
              {leaveType === 'Izin Datang Terlambat' && (
                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClockAlert className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold text-amber-950">
                        Rincian Waktu Izin Datang Terlambat
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md font-semibold">
                      Shift Mulai: {workStartTime}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tanggal Izin Terlambat <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Jam Masuk Normal
                      </label>
                      <div className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 border border-slate-200">
                        {workStartTime} WIB
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Estimasi Tiba di Kantor <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={estimatedArrivalTime}
                        onChange={(e) => handleEstimatedArrivalChange(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Manual Minute Input & Quick Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Durasi Keterlambatan (Menit) <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500">Ketik angka / pilih preset:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="480"
                        value={lateMinutesInput}
                        onChange={(e) => handleLateMinutesNumberChange(parseInt(e.target.value) || 0)}
                        className="w-28 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-amber-800 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Menit"
                        required
                      />
                      <span className="text-xs font-bold text-slate-600">Menit</span>

                      <div className="flex items-center gap-1 overflow-x-auto grow justify-end">
                        {[15, 30, 45, 60, 90, 120].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => handleLateMinutesNumberChange(mins)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                              lateMinutesInput === mins
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                            }`}
                          >
                            +{mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quota Projection Info */}
                  <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Estimasi Waktu Tiba:</span>
                      <span className="font-mono font-bold text-amber-800">
                        {estimatedArrivalTime} WIB ({lateMinutesInput} Menit / {(lateMinutesInput / 60).toFixed(1)} Jam)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Proyeksi Frekuensi Bulan Ini:</span>
                      <span className={`font-semibold ${usedLateCount + 1 > maxLateCount ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {usedLateCount + 1} dari {maxLateCount} Kali {usedLateCount + 1 > maxLateCount && '(Melebihi Kuota!)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Proyeksi Total Waktu Bulan Ini:</span>
                      <span className={`font-semibold ${usedLateMinutes + lateMinutesInput > maxLateMinutes ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {usedLateMinutes + lateMinutesInput} dari {maxLateMinutes} Menit {usedLateMinutes + lateMinutesInput > maxLateMinutes && '(Melebihi Batas!)'}
                      </span>
                    </div>
                  </div>

                  {(usedLateCount + 1 > maxLateCount || usedLateMinutes + lateMinutesInput > maxLateMinutes) && (
                    <div className="p-3 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-950 text-xs space-y-2">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-bold">Peringatan Kuota Bulanan</strong>
                          <p className="text-[11px] leading-relaxed">
                            Pengajuan ini melebihi batasan ketentuan bulanan ({maxLateCount} kali / {maxLateMinutes} menit).
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 pt-1 border-t border-amber-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSpecialExemptionChecked}
                          onChange={(e) => setIsSpecialExemptionChecked(e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                        />
                        <span className="text-[11px] font-semibold text-amber-900">
                          Ajukan sebagai permohonan dispensasi / kondisi darurat (Memerlukan persetujuan khusus HRD)
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* SPECIFIC FIELDS FOR IZIN PULANG AWAL */}
              {leaveType === 'Izin Pulang Awal' && (
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-950">
                        Rincian Waktu Izin Pulang Lebih Awal
                      </span>
                    </div>
                    <span className="text-[11px] text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded-md font-semibold">
                      Shift Selesai: {workEndTime}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tanggal Izin Pulang Awal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Jam Pulang Normal
                      </label>
                      <div className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 border border-slate-200">
                        {workEndTime} WIB
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Estimasi Meninggalkan Kantor <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={estimatedDepartureTime}
                        onChange={(e) => handleEstimatedDepartureChange(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Manual Minute Input & Quick Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Durasi Pulang Awal (Menit) <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500">Ketik angka / pilih preset:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="480"
                        value={earlyMinutesInput}
                        onChange={(e) => handleEarlyMinutesNumberChange(parseInt(e.target.value) || 0)}
                        className="w-28 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-indigo-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Menit"
                        required
                      />
                      <span className="text-xs font-bold text-slate-600">Menit</span>

                      <div className="flex items-center gap-1 overflow-x-auto grow justify-end">
                        {[15, 30, 45, 60, 90, 120].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => handleEarlyMinutesNumberChange(mins)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                              earlyMinutesInput === mins
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quota Projection Info */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Estimasi Waktu Pulang:</span>
                      <span className="font-mono font-bold text-indigo-800">
                        {estimatedDepartureTime} WIB ({earlyMinutesInput} Menit / {(earlyMinutesInput / 60).toFixed(1)} Jam)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Proyeksi Frekuensi Bulan Ini:</span>
                      <span className={`font-semibold ${usedEarlyCount + 1 > maxEarlyCount ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {usedEarlyCount + 1} dari {maxEarlyCount} Kali {usedEarlyCount + 1 > maxEarlyCount && '(Melebihi Kuota!)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Proyeksi Total Waktu Bulan Ini:</span>
                      <span className={`font-semibold ${usedEarlyMinutes + earlyMinutesInput > maxEarlyMinutes ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {usedEarlyMinutes + earlyMinutesInput} dari {maxEarlyMinutes} Menit {usedEarlyMinutes + earlyMinutesInput > maxEarlyMinutes && '(Melebihi Batas!)'}
                      </span>
                    </div>
                  </div>

                  {(usedEarlyCount + 1 > maxEarlyCount || usedEarlyMinutes + earlyMinutesInput > maxEarlyMinutes) && (
                    <div className="p-3 rounded-xl bg-indigo-100/90 border border-indigo-300 text-indigo-950 text-xs space-y-2">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-bold">Peringatan Kuota Bulanan</strong>
                          <p className="text-[11px] leading-relaxed">
                            Pengajuan ini melebihi batasan ketentuan izin pulang awal bulanan ({maxEarlyCount} kali / {maxEarlyMinutes} menit).
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 pt-1 border-t border-indigo-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSpecialExemptionChecked}
                          onChange={(e) => setIsSpecialExemptionChecked(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-semibold text-indigo-900">
                          Ajukan sebagai permohonan dispensasi / kondisi darurat (Memerlukan persetujuan khusus HRD)
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* REGULAR DATE RANGE FOR CUTI / SAKIT / IZIN PRIBADI */}
              {leaveType !== 'Izin Datang Terlambat' && leaveType !== 'Izin Pulang Awal' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Mulai <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Selesai <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        min={startDate}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center justify-between px-1">
                    <span>Total Estimasi Hari Kerja:</span>
                    <span className="font-bold text-slate-900 font-mono">{totalDays} Hari</span>
                  </div>
                </>
              )}

              {/* Reason / Keterangan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan / Keterangan Lengkap <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    leaveType === 'Izin Datang Terlambat'
                      ? 'Tuliskan alasan keterlambatan (misal: kendala ban kendaraan, antre kontrol dokter pagi, dsb)...'
                      : leaveType === 'Izin Pulang Awal'
                      ? 'Tuliskan alasan izin pulang lebih awal (misal: keperluan keluarga mendesak, jadwal medis sore, dsb)...'
                      : 'Tuliskan keterangan detail keperluan izin/cuti Anda...'
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="submit-leave-request-btn"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT PENGAJUAN (SUPER ADMIN EXCLUSIVE) */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center">
                  <Pencil className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">Edit Data Pengajuan Izin / Cuti</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 font-bold border border-amber-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-600" /> Super Admin
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">ID Pengajuan: {editingRequest.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRequest(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 overflow-y-auto grow">
              {editFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{editFormError}</span>
                </div>
              )}

              {/* Karyawan Pemohon */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Karyawan Pemohon <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editEmpId}
                  onChange={(e) => {
                    const newEmpId = e.target.value;
                    setEditEmpId(newEmpId);
                    const emp = employees.find((x) => x.id === newEmpId);
                    if (emp) {
                      const start = emp.shift?.startTime || officeConfig?.workStartTime || '08:30';
                      const end = emp.shift?.endTime || officeConfig?.workEndTime || '17:30';
                      if (editType === 'Izin Datang Terlambat') {
                        setEditEstimatedArrivalTime(addMinutesToTime(start, editLateMinutes));
                      } else if (editType === 'Izin Pulang Awal') {
                        setEditEstimatedDepartureTime(subtractMinutesFromTime(end, editEarlyDepartureMinutes));
                      }
                    }
                  }}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.nik}) - {emp.department} [Sisa Cuti: {emp.remainingLeaveQuota}h]
                    </option>
                  ))}
                </select>
              </div>

              {/* Jenis Pengajuan & Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Pengajuan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => {
                      const newType = e.target.value as LeaveType;
                      setEditType(newType);
                      const emp = employees.find((x) => x.id === editEmpId) || currentEmployee;
                      const start = emp.shift?.startTime || officeConfig?.workStartTime || '08:30';
                      const end = emp.shift?.endTime || officeConfig?.workEndTime || '17:30';
                      if (newType === 'Izin Datang Terlambat') {
                        setEditLateMinutes(30);
                        setEditEstimatedArrivalTime(addMinutesToTime(start, 30));
                      } else if (newType === 'Izin Pulang Awal') {
                        setEditEarlyDepartureMinutes(60);
                        setEditEstimatedDepartureTime(subtractMinutesFromTime(end, 60));
                      }
                    }}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Izin Datang Terlambat">⏰ Izin Datang Terlambat</option>
                    <option value="Izin Pulang Awal">🏃 Izin Pulang Lebih Awal</option>
                    <option value="Izin Dinas Luar">✈️ Izin Dinas Luar</option>
                    <option value="Cuti Tahunan">🏖️ Cuti Tahunan</option>
                    <option value="Sakit">🏥 Sakit</option>
                    <option value="Izin Pribadi">📋 Izin Pribadi</option>
                    <option value="Cuti Melahirkan">👶 Cuti Melahirkan</option>
                    <option value="Keperluan Mendesak">⚡ Keperluan Mendesak</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Pengajuan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as LeaveStatus)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Menunggu">⏳ Menunggu Persetujuan</option>
                    <option value="Disetujui">✅ Disetujui (Disahkan)</option>
                    <option value="Ditolak">❌ Ditolak</option>
                  </select>
                </div>
              </div>

              {/* Specific input for Izin Datang Terlambat */}
              {editType === 'Izin Datang Terlambat' && (
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <ClockAlert className="w-3.5 h-3.5 text-amber-600" />
                      Rincian Jam Keterlambatan
                    </span>
                    <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      Shift Masuk: {employees.find((e) => e.id === editEmpId)?.shift?.startTime || officeConfig?.workStartTime || '08:30'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Estimasi Tiba di Kantor
                      </label>
                      <input
                        type="time"
                        value={editEstimatedArrivalTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditEstimatedArrivalTime(val);
                          const emp = employees.find((x) => x.id === editEmpId) || currentEmployee;
                          const start = emp.shift?.startTime || officeConfig?.workStartTime || '08:30';
                          const diff = getTimeDifferenceMinutes(start, val);
                          setEditLateMinutes(diff > 0 ? diff : 15);
                        }}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-amber-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Durasi Terlambat (Menit)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="480"
                        value={editLateMinutes}
                        onChange={(e) => {
                          const mins = Math.max(1, parseInt(e.target.value) || 1);
                          setEditLateMinutes(mins);
                          const emp = employees.find((x) => x.id === editEmpId) || currentEmployee;
                          const start = emp.shift?.startTime || officeConfig?.workStartTime || '08:30';
                          setEditEstimatedArrivalTime(addMinutesToTime(start, mins));
                        }}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-amber-900"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Specific input for Izin Pulang Awal */}
              {editType === 'Izin Pulang Awal' && (
                <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5 text-indigo-600" />
                      Rincian Jam Pulang Lebih Awal
                    </span>
                    <span className="text-[10px] font-mono text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                      Shift Pulang: {employees.find((e) => e.id === editEmpId)?.shift?.endTime || officeConfig?.workEndTime || '17:30'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Estimasi Jam Pulang
                      </label>
                      <input
                        type="time"
                        value={editEstimatedDepartureTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditEstimatedDepartureTime(val);
                          const emp = employees.find((x) => x.id === editEmpId) || currentEmployee;
                          const end = emp.shift?.endTime || officeConfig?.workEndTime || '17:30';
                          const diff = getTimeDifferenceMinutes(val, end);
                          setEditEarlyDepartureMinutes(diff > 0 ? diff : 30);
                        }}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-indigo-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Pulang Lebih Awal (Menit)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="480"
                        value={editEarlyDepartureMinutes}
                        onChange={(e) => {
                          const mins = Math.max(1, parseInt(e.target.value) || 1);
                          setEditEarlyDepartureMinutes(mins);
                          const emp = employees.find((x) => x.id === editEmpId) || currentEmployee;
                          const end = emp.shift?.endTime || officeConfig?.workEndTime || '17:30';
                          setEditEstimatedDepartureTime(subtractMinutesFromTime(end, mins));
                        }}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-indigo-900"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tanggal Mulai dan Selesai */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Mulai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => {
                      setEditStartDate(e.target.value);
                      if (editType === 'Izin Datang Terlambat' || editType === 'Izin Pulang Awal') {
                        setEditEndDate(e.target.value);
                      }
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Selesai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    min={editStartDate}
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Alasan / Keterangan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan / Keterangan Pengajuan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Catatan Verifikator HR & Diverifikasi Oleh */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan HR / Verifikator
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Contoh: Disetujui Super Admin"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Diverifikasi / Disetujui Oleh
                  </label>
                  <input
                    type="text"
                    value={editApprovedBy}
                    onChange={(e) => setEditApprovedBy(e.target.value)}
                    placeholder="Contoh: Dimas Prasetyo (Super Admin)"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS (SUPER ADMIN EXCLUSIVE) */}
      {requestToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Data Pengajuan Izin?
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                  Super Admin
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus data pengajuan berikut secara permanen?
              </p>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Karyawan:</span>
                  <span className="font-bold text-slate-800">{requestToDelete.employeeName} ({requestToDelete.employeeNik})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Jenis:</span>
                  <span className="font-semibold text-slate-900">{requestToDelete.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tanggal:</span>
                  <span className="font-mono text-slate-700">
                    {requestToDelete.startDate === requestToDelete.endDate 
                      ? requestToDelete.startDate 
                      : `${requestToDelete.startDate} s/d ${requestToDelete.endDate}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    requestToDelete.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-800' :
                    requestToDelete.status === 'Ditolak' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {requestToDelete.status}
                  </span>
                </div>
              </div>

              {requestToDelete.status === 'Disetujui' && requestToDelete.type === 'Cuti Tahunan' && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Kuota cuti tahunan karyawan sebanyak <strong>{requestToDelete.totalDays} hari</strong> akan otomatis dikembalikan ke saldo kuota.
                  </span>
                </div>
              )}

              {requestToDelete.status === 'Disetujui' && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Catatan izin yang tersinkronisasi pada riwayat presensi karyawan akan disesuaikan secara otomatis.
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Pengajuan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
