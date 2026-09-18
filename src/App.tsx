import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  MapPin, 
  Clock, 
  UserCheck, 
  CalendarDays, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  ClockAlert,
  Sparkles,
  ShieldCheck,
  Smartphone,
  ArrowRight
} from 'lucide-react';
import { 
  Employee, 
  AttendanceRecord, 
  LeaveRequest, 
  LeaveType,
  OfficeConfig,
  AttendanceType,
  GeoLocationData,
  AttendanceStatus
} from './types';
import { 
  DEFAULT_OFFICE_CONFIG, 
  INITIAL_EMPLOYEES, 
  INITIAL_ATTENDANCE_RECORDS, 
  INITIAL_LEAVE_REQUESTS 
} from './data/mockData';
import { calculateDistanceMeters, getCurrentTimeString, getTodayDateString } from './utils/geo';
import Header from './components/Header';
import DashboardStats from './components/DashboardStats';
import ClockCard from './components/ClockCard';
import HistoryTable from './components/HistoryTable';
import LeaveManagement from './components/LeaveManagement';
import EmployeeManagement from './components/EmployeeManagement';
import AttendanceModal from './components/AttendanceModal';
import OfficeSettingsModal from './components/OfficeSettingsModal';
import ManualAttendanceModal from './components/ManualAttendanceModal';
import AutoAttendanceModal from './components/AutoAttendanceModal';
import PermitRecapDashboard from './components/PermitRecapDashboard';
import FingerprintModal from './components/FingerprintModal';
import AndroidAppModal from './components/AndroidAppModal';
import {
  syncAttendanceRecordToFirestore,
  deleteAttendanceRecordFromFirestore,
  batchDeleteAttendanceRecordsFromFirestore,
  syncLeaveRequestToFirestore,
  deleteLeaveRequestFromFirestore,
  syncEmployeeToFirestore,
  deleteEmployeeFromFirestore,
  syncOfficeConfigToFirestore,
  seedInitialDataIfEmpty,
  subscribeToEmployees,
  subscribeToAttendance,
  subscribeToLeaveRequests,
  subscribeToOfficeConfig,
  forceSyncAllToFirestore,
} from './lib/firebase';

export default function App() {
  // Persistence with localStorage
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('absensi_employees');
    const savedOffice = localStorage.getItem('absensi_office_config');
    const cfg: OfficeConfig = savedOffice ? JSON.parse(savedOffice) : DEFAULT_OFFICE_CONFIG;
    const emps: Employee[] = saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    return emps.map(emp => {
      return {
        ...emp,
        shift: {
          ...emp.shift,
          startTime: cfg.workStartTime || '08:30',
          endTime: cfg.workEndTime || '17:30',
          lateToleranceMinutes: cfg.lateToleranceMinutes ?? 15,
          name: `${emp.shift.name.split(' (')[0] || 'Reguler'} (${cfg.workStartTime || '08:30'} - ${cfg.workEndTime || '17:30'})`,
        }
      };
    });
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('absensi_records');
    const savedEmployees = localStorage.getItem('absensi_employees');
    const activeEmpIdSet = savedEmployees ? new Set((JSON.parse(savedEmployees) as Employee[]).map(e => e.id)) : null;

    let records = INITIAL_ATTENDANCE_RECORDS;
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AttendanceRecord[];
        if (parsed.length <= 3) {
          const existingIds = new Set(parsed.map(r => r.id));
          const missing = INITIAL_ATTENDANCE_RECORDS.filter(r => !existingIds.has(r.id));
          records = [...parsed, ...missing];
        } else {
          records = parsed;
        }
      } catch {
        records = INITIAL_ATTENDANCE_RECORDS;
      }
    }

    // Filter out records for deleted employees if employees list exists
    if (activeEmpIdSet) {
      return records.filter(r => activeEmpIdSet.has(r.employeeId));
    }
    return records;
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem('absensi_leaves');
    const savedEmployees = localStorage.getItem('absensi_employees');
    const activeEmpIdSet = savedEmployees ? new Set((JSON.parse(savedEmployees) as Employee[]).map(e => e.id)) : null;

    const reqs: LeaveRequest[] = saved ? JSON.parse(saved) : INITIAL_LEAVE_REQUESTS;
    if (activeEmpIdSet) {
      return reqs.filter(r => activeEmpIdSet.has(r.employeeId));
    }
    return reqs;
  });

  const [officeConfig, setOfficeConfig] = useState<OfficeConfig>(() => {
    const saved = localStorage.getItem('absensi_office_config');
    return saved ? JSON.parse(saved) : DEFAULT_OFFICE_CONFIG;
  });

  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>(() => {
    const saved = localStorage.getItem('absensi_current_emp');
    const savedEmployees = localStorage.getItem('absensi_employees');
    const emps: Employee[] = savedEmployees ? JSON.parse(savedEmployees) : INITIAL_EMPLOYEES;
    if (saved && emps.some(e => e.id === saved)) {
      return saved;
    }
    return emps[0]?.id || 'emp-1';
  });

  const [activeTab, setActiveTab] = useState<'presensi' | 'rekap' | 'cuti' | 'karyawan' | 'pengaturan'>('presensi');
  const [isAddEmployeeModalDirectOpen, setIsAddEmployeeModalDirectOpen] = useState<boolean>(false);
  const [leaveModalInitialType, setLeaveModalInitialType] = useState<LeaveType | null>(null);
  const [isLeaveModalAutoOpen, setIsLeaveModalAutoOpen] = useState<boolean>(false);
  
  // Modals
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [attendanceModalMode, setAttendanceModalMode] = useState<'in' | 'out'>('in');
  const [isOfficeModalOpen, setIsOfficeModalOpen] = useState<boolean>(false);
  const [isManualAttendanceModalOpen, setIsManualAttendanceModalOpen] = useState<boolean>(false);
  const [isAutoAttendanceModalOpen, setIsAutoAttendanceModalOpen] = useState<boolean>(false);
  const [isFingerprintModalOpen, setIsFingerprintModalOpen] = useState<boolean>(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState<boolean>(false);
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState<AttendanceRecord | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Firebase Cloud Sync Status ('connected' | 'syncing' | 'offline')
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'connected' | 'syncing' | 'offline'>('connected');

  // Firebase Real-time Synchronization & Automatic Initial Seeding
  useEffect(() => {
    // 1. Initial background seed to Firestore if collections are empty
    seedInitialDataIfEmpty(employees, attendanceRecords, leaveRequests, officeConfig)
      .then(() => {
        setCloudSyncStatus('connected');
      })
      .catch((err) => {
        console.warn('Firebase initial sync check:', err);
      });

    // 2. Real-time subscriptions to Firestore
    const unsubEmployees = subscribeToEmployees((remoteEmps) => {
      if (remoteEmps && remoteEmps.length > 0) {
        setEmployees(remoteEmps);
      }
    });

    const unsubAttendance = subscribeToAttendance((remoteRecords) => {
      if (remoteRecords && remoteRecords.length > 0) {
        setAttendanceRecords(remoteRecords);
      }
    });

    const unsubLeave = subscribeToLeaveRequests((remoteRequests) => {
      if (remoteRequests && remoteRequests.length > 0) {
        setLeaveRequests(remoteRequests);
      }
    });

    const unsubConfig = subscribeToOfficeConfig((remoteConfig) => {
      if (remoteConfig) {
        setOfficeConfig(remoteConfig);
        // Automatically sync all employees work hours to match the updated system office schedule
        setEmployees(prev => {
          const updated = prev.map(emp => {
            const updatedEmp = {
              ...emp,
              shift: {
                ...emp.shift,
                startTime: remoteConfig.workStartTime,
                endTime: remoteConfig.workEndTime,
                lateToleranceMinutes: remoteConfig.lateToleranceMinutes,
                name: `${emp.shift.name.split(' (')[0] || 'Reguler'} (${remoteConfig.workStartTime} - ${remoteConfig.workEndTime})`,
              }
            };
            return updatedEmp;
          });
          return updated;
        });
      }
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubLeave();
      unsubConfig();
    };
  }, []);

  const handleForceSyncAll = async () => {
    setCloudSyncStatus('syncing');
    try {
      const result = await forceSyncAllToFirestore(employees, attendanceRecords, leaveRequests, officeConfig);
      setCloudSyncStatus('connected');
      showToast(`Berhasil menyinkronkan ${result.count} data ke database Firebase Firestore!`, 'success');
    } catch (err) {
      setCloudSyncStatus('offline');
      showToast('Gagal menyinkronkan ke Firebase. Periksa koneksi internet.', 'error');
    }
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('absensi_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('absensi_records', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem('absensi_leaves', JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  useEffect(() => {
    localStorage.setItem('absensi_office_config', JSON.stringify(officeConfig));
  }, [officeConfig]);

  useEffect(() => {
    localStorage.setItem('absensi_current_emp', currentEmployeeId);
  }, [currentEmployeeId]);

  // Auto-clean orphaned attendance and leave records whenever employees list changes
  useEffect(() => {
    const activeEmpIds = new Set(employees.map((e) => e.id));
    const activeEmpNames = new Set(employees.map((e) => e.name.toLowerCase().trim()));

    setAttendanceRecords((prev) => {
      const cleaned = prev.filter(
        (r) => activeEmpIds.has(r.employeeId) || activeEmpNames.has(r.employeeName.toLowerCase().trim())
      );
      if (cleaned.length !== prev.length) {
        return cleaned;
      }
      return prev;
    });

    setLeaveRequests((prev) => {
      const cleaned = prev.filter(
        (lr) => activeEmpIds.has(lr.employeeId) || activeEmpNames.has(lr.employeeName.toLowerCase().trim())
      );
      if (cleaned.length !== prev.length) {
        return cleaned;
      }
      return prev;
    });
  }, [employees]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Selected Employee
  const currentEmployee = useMemo(() => {
    return employees.find((e) => e.id === currentEmployeeId) || employees[0];
  }, [employees, currentEmployeeId]);

  // Admin or Superadmin role check
  const isAdminOrSuperadmin = currentEmployee.systemRole === 'admin' || currentEmployee.systemRole === 'superadmin';

  // Today's date
  const todayStr = getTodayDateString();

  // Today's records for all active employees
  const todayRecords = useMemo(() => {
    const activeEmpIds = new Set(employees.map((e) => e.id));
    return attendanceRecords.filter((r) => r.date === todayStr && activeEmpIds.has(r.employeeId));
  }, [attendanceRecords, employees, todayStr]);

  // Today's record for currently selected employee
  const currentEmployeeTodayRecord = useMemo(() => {
    return attendanceRecords.find(
      (r) => r.employeeId === currentEmployee.id && r.date === todayStr
    );
  }, [attendanceRecords, currentEmployee.id, todayStr]);

  // Unique departments
  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department)));
  }, [employees]);

  // Simulated device distance to office
  const userDistanceToOffice = 35; // Default 35 meters (within 150m geofence radius)
  const isWithinOfficeRadius = userDistanceToOffice <= officeConfig.radiusMeters;

  // Open Attendance Modal
  const handleOpenAttendanceModal = (mode: 'in' | 'out') => {
    setAttendanceModalMode(mode);
    setIsAttendanceModalOpen(true);
  };

  // Submit attendance from Modal
  const handleConfirmAttendance = (data: {
    type: AttendanceType;
    photo: string;
    location: GeoLocationData;
    status: AttendanceStatus;
    notes: string;
    lateMinutes?: number;
    hasLatePermit?: boolean;
    earlyMinutes?: number;
    hasEarlyPermit?: boolean;
  }) => {
    const nowTime = getCurrentTimeString();

    if (attendanceModalMode === 'in') {
      const newRecord: AttendanceRecord = {
        id: `att-${Date.now()}`,
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        employeeNik: currentEmployee.nik,
        department: currentEmployee.department,
        date: todayStr,
        type: data.type,
        checkInTime: nowTime,
        checkOutTime: null,
        status: data.status,
        checkInPhoto: data.photo,
        location: data.location,
        notes: data.notes,
        lateMinutes: data.lateMinutes,
        hasLatePermit: data.hasLatePermit,
      };

      setAttendanceRecords((prev) => [newRecord, ...prev.filter(r => !(r.employeeId === currentEmployee.id && r.date === todayStr))]);
      syncAttendanceRecordToFirestore(newRecord);
      const lateNotice = data.lateMinutes && data.lateMinutes > 0 ? ` (Terhitung keterlambatan: ${data.lateMinutes} menit)` : '';
      showToast(`Absen Masuk berhasil dicatat pukul ${nowTime} WIB! Status: ${data.status}${lateNotice}`);
    } else {
      // Clock out
      let updatedRecordToSync: AttendanceRecord | null = null;
      setAttendanceRecords((prev) =>
        prev.map((r) => {
          if (r.employeeId === currentEmployee.id && r.date === todayStr) {
            const updated = {
              ...r,
              checkOutTime: nowTime,
              checkOutPhoto: data.photo,
              earlyMinutes: data.earlyMinutes,
              hasEarlyPermit: data.hasEarlyPermit,
              notes: data.notes ? `${r.notes ? r.notes + ' | ' : ''}Pulang: ${data.notes}` : r.notes,
            };
            updatedRecordToSync = updated;
            return updated;
          }
          return r;
        })
      );
      if (updatedRecordToSync) {
        syncAttendanceRecordToFirestore(updatedRecordToSync);
      }
      const earlyNotice = data.earlyMinutes && data.earlyMinutes > 0 ? ` (Pulang lebih awal: ${data.earlyMinutes} menit)` : '';
      showToast(`Absen Pulang berhasil dicatat pukul ${nowTime} WIB!${earlyNotice} Selamat beristirahat.`);
    }

    setIsAttendanceModalOpen(false);
  };

  // Handle new leave submission
  const handleSubmitLeaveRequest = (newReqData: Omit<LeaveRequest, 'id' | 'appliedAt' | 'status'>) => {
    const newReq: LeaveRequest = {
      ...newReqData,
      id: `leave-${Date.now()}`,
      status: 'Menunggu',
      appliedAt: `${todayStr} ${getCurrentTimeString().slice(0, 5)}`,
    };

    setLeaveRequests((prev) => [newReq, ...prev]);
    syncLeaveRequestToFirestore(newReq);
    showToast('Permohonan cuti/izin berhasil dikirim dan disinkronkan ke Firebase.');
  };

  // Helper to get dates in range
  const getDatesInRange = (startStr: string, endStr: string): string[] => {
    const dates: string[] = [];
    const curr = new Date(startStr);
    const end = new Date(endStr);
    while (curr <= end && !isNaN(curr.getTime())) {
      dates.push(curr.toISOString().slice(0, 10));
      curr.setDate(curr.getDate() + 1);
    }
    if (dates.length === 0 && startStr) {
      dates.push(startStr);
    }
    return dates;
  };

  // Sync all approved leave requests into attendance records on load / change
  useEffect(() => {
    setAttendanceRecords(prev => {
      let updated = [...prev];
      let hasChanges = false;
      const defStartTime = officeConfig.workStartTime ? `${officeConfig.workStartTime}:00` : '08:30:00';
      const defEndTime = officeConfig.workEndTime ? `${officeConfig.workEndTime}:00` : '17:30:00';

      for (const req of leaveRequests) {
        if (req.status !== 'Disetujui') continue;
        const dates = getDatesInRange(req.startDate, req.endDate);

        // Find employee object if needed for accurate metadata
        const emp = employees.find(e => e.id === req.employeeId);
        const empName = emp?.name || req.employeeName;
        const empNik = emp?.nik || req.employeeNik;
        const empDept = emp?.department || req.department;

        for (const d of dates) {
          const existingIdx = updated.findIndex(r => r.employeeId === req.employeeId && r.date === d);

          if (req.type === 'Izin Datang Terlambat' || req.type === 'Izin Pulang Awal') {
            const isLateReq = req.type === 'Izin Datang Terlambat';
            const noteText = isLateReq
              ? `[Izin Terlambat Disetujui: Tiba ${req.estimatedArrivalTime || '-'}, ${req.lateMinutes || 0} mnt]`
              : `[Izin Pulang Awal Disetujui: Pulang ${req.estimatedDepartureTime || '-'}, Awal ${req.earlyDepartureMinutes || 0} mnt]`;

            if (existingIdx >= 0) {
              const rec = updated[existingIdx];
              const needsLate = isLateReq && !rec.hasLatePermit;
              const needsEarly = !isLateReq && !rec.hasEarlyPermit;
              const needsNote = !rec.notes || !rec.notes.includes(noteText);

              if (needsLate || needsEarly || needsNote) {
                hasChanges = true;
                updated[existingIdx] = {
                  ...rec,
                  hasLatePermit: isLateReq ? true : rec.hasLatePermit,
                  hasEarlyPermit: !isLateReq ? true : rec.hasEarlyPermit,
                  lateMinutes: isLateReq ? (rec.lateMinutes || req.lateMinutes) : rec.lateMinutes,
                  earlyMinutes: !isLateReq ? (rec.earlyMinutes || req.earlyDepartureMinutes) : rec.earlyMinutes,
                  notes: rec.notes ? (rec.notes.includes(noteText) ? rec.notes : `${rec.notes} • ${noteText}`) : `${noteText} • ${req.reason || ''}`,
                };
              }
            } else {
              // Create an attendance record for this approved permit so it appears in the attendance recap
              hasChanges = true;
              updated.unshift({
                id: `att-permit-${req.id}-${d}`,
                employeeId: req.employeeId,
                employeeName: empName,
                employeeNik: empNik,
                department: empDept,
                date: d,
                type: 'WFO',
                checkInTime: isLateReq && req.estimatedArrivalTime ? (req.estimatedArrivalTime.length === 5 ? `${req.estimatedArrivalTime}:00` : req.estimatedArrivalTime) : null,
                checkOutTime: !isLateReq && req.estimatedDepartureTime ? (req.estimatedDepartureTime.length === 5 ? `${req.estimatedDepartureTime}:00` : req.estimatedDepartureTime) : null,
                status: 'Izin',
                hasLatePermit: isLateReq,
                lateMinutes: isLateReq ? req.lateMinutes : undefined,
                hasEarlyPermit: !isLateReq,
                earlyMinutes: !isLateReq ? req.earlyDepartureMinutes : undefined,
                notes: `${noteText} • ${req.reason || ''}${req.approvedBy ? ` (Disetujui: ${req.approvedBy})` : ''}`,
                isManualEntry: false,
              });
            }
          } else if (req.type === 'Izin Dinas Luar') {
            const dinasNote = `[Tugas Dinas Luar Disetujui] ${req.reason}${req.approvedBy ? ` (Disetujui: ${req.approvedBy})` : ''}`;
            if (existingIdx >= 0) {
              const rec = updated[existingIdx];
              if (rec.type !== 'Dinas Luar' || !rec.notes || !rec.notes.includes(dinasNote)) {
                hasChanges = true;
                updated[existingIdx] = {
                  ...rec,
                  type: 'Dinas Luar',
                  status: 'Hadir Tepat Waktu',
                  notes: rec.notes ? (rec.notes.includes(dinasNote) ? rec.notes : `${rec.notes} • ${dinasNote}`) : dinasNote,
                };
              }
            } else {
              hasChanges = true;
              updated.unshift({
                id: `att-dinas-${req.id}-${d}`,
                employeeId: req.employeeId,
                employeeName: empName,
                employeeNik: empNik,
                department: empDept,
                date: d,
                type: 'Dinas Luar',
                checkInTime: defStartTime,
                checkOutTime: defEndTime,
                status: 'Hadir Tepat Waktu',
                notes: dinasNote,
                isManualEntry: true,
              });
            }
          } else {
            const isCuti = req.type.toLowerCase().includes('cuti');
            const attendanceStatus: AttendanceStatus = req.type === 'Sakit' ? 'Sakit' : (isCuti ? 'Cuti' : 'Izin');
            const leaveNote = `Pengajuan ${req.type} Disetujui: ${req.reason}${req.approvedBy ? ` (Disetujui: ${req.approvedBy})` : ''}`;

            if (existingIdx >= 0) {
              const rec = updated[existingIdx];
              if (rec.status !== attendanceStatus || !rec.notes || !rec.notes.includes(leaveNote)) {
                hasChanges = true;
                updated[existingIdx] = {
                  ...rec,
                  status: attendanceStatus,
                  checkInTime: null,
                  checkOutTime: null,
                  notes: rec.notes ? (rec.notes.includes(leaveNote) ? rec.notes : `${rec.notes} • ${leaveNote}`) : leaveNote,
                };
              }
            } else {
              hasChanges = true;
              updated.unshift({
                id: `att-leave-${req.id}-${d}`,
                employeeId: req.employeeId,
                employeeName: empName,
                employeeNik: empNik,
                department: empDept,
                date: d,
                type: 'WFO',
                checkInTime: null,
                checkOutTime: null,
                status: attendanceStatus,
                notes: leaveNote,
              });
            }
          }
        }
      }

      return hasChanges ? updated : prev;
    });
  }, [leaveRequests, employees, officeConfig]);

  // Handle Leave Status Update (Approve / Reject)
  const handleUpdateLeaveStatus = (requestId: string, newStatus: 'Disetujui' | 'Ditolak') => {
    const targetReq = leaveRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    const approverRoleTitle = currentEmployee.systemRole === 'superadmin' 
      ? 'Super Admin' 
      : currentEmployee.systemRole === 'admin' 
      ? 'Administrator' 
      : currentEmployee.role;

    // Deduct leave quota if approved and type is Cuti Tahunan
    if (newStatus === 'Disetujui' && targetReq.type === 'Cuti Tahunan') {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id === targetReq.employeeId) {
            const updatedQuota = Math.max(0, emp.remainingLeaveQuota - targetReq.totalDays);
            const updatedEmp = { ...emp, remainingLeaveQuota: updatedQuota };
            syncEmployeeToFirestore(updatedEmp);
            return updatedEmp;
          }
          return emp;
        })
      );
    } else if (newStatus === 'Ditolak' && targetReq.status === 'Disetujui' && targetReq.type === 'Cuti Tahunan') {
      // Refund quota if previously approved
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id === targetReq.employeeId) {
            const updatedEmp = { ...emp, remainingLeaveQuota: emp.remainingLeaveQuota + targetReq.totalDays };
            syncEmployeeToFirestore(updatedEmp);
            return updatedEmp;
          }
          return emp;
        })
      );
    }

    const updatedReq: LeaveRequest = {
      ...targetReq,
      status: newStatus,
      approvedBy: `${currentEmployee.name} (${approverRoleTitle})`,
      notes: newStatus === 'Disetujui' 
        ? `Disetujui oleh ${approverRoleTitle}` 
        : `Ditolak oleh ${approverRoleTitle}`,
    };

    // If rejecting a previously approved request, clean up or revert attendance records
    if (newStatus === 'Ditolak' && targetReq.status === 'Disetujui') {
      const dates = getDatesInRange(targetReq.startDate, targetReq.endDate);
      setAttendanceRecords((prev) => {
        return prev
          .filter((rec) => {
            if (
              rec.id.startsWith(`att-leave-${targetReq.id}`) ||
              rec.id.startsWith(`att-dinas-${targetReq.id}`) ||
              rec.id.startsWith(`att-permit-${targetReq.id}`)
            ) {
              return false;
            }
            return true;
          })
          .map((rec) => {
            if (rec.employeeId === targetReq.employeeId && dates.includes(rec.date)) {
              const updatedRec = { ...rec };
              if (updatedRec.notes) {
                const noteParts = updatedRec.notes.split(' • ').filter(
                  (part) =>
                    !part.includes(targetReq.reason) &&
                    !part.includes(targetReq.id) &&
                    !(targetReq.type === 'Izin Datang Terlambat' && part.includes('Izin Terlambat Disetujui')) &&
                    !(targetReq.type === 'Izin Pulang Awal' && part.includes('Izin Pulang Awal Disetujui'))
                );
                updatedRec.notes = noteParts.join(' • ') || undefined;
              }
              if (targetReq.type === 'Izin Datang Terlambat') {
                updatedRec.hasLatePermit = false;
              }
              if (targetReq.type === 'Izin Pulang Awal') {
                updatedRec.hasEarlyPermit = false;
              }
              return updatedRec;
            }
            return rec;
          });
      });
    }

    // Update request
    setLeaveRequests((prev) =>
      prev.map((req) => (req.id === requestId ? updatedReq : req))
    );
    syncLeaveRequestToFirestore(updatedReq);

    showToast(`Pengajuan ${targetReq.employeeName} (${targetReq.type}) telah ${newStatus.toLowerCase()}!`, newStatus === 'Disetujui' ? 'success' : 'info');
  };

  // Super Admin: Delete Leave Request
  const handleDeleteLeaveRequest = (requestId: string) => {
    const targetReq = leaveRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    // 1. Refund leave quota if approved Cuti Tahunan
    if (targetReq.status === 'Disetujui' && targetReq.type === 'Cuti Tahunan') {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id === targetReq.employeeId) {
            return {
              ...emp,
              remainingLeaveQuota: emp.remainingLeaveQuota + targetReq.totalDays,
            };
          }
          return emp;
        })
      );
    }

    // 2. Clean up or revert corresponding attendance records if it was approved
    if (targetReq.status === 'Disetujui') {
      const dates = getDatesInRange(targetReq.startDate, targetReq.endDate);
      setAttendanceRecords((prev) => {
        return prev
          .filter((rec) => {
            if (
              rec.id.startsWith(`att-leave-${targetReq.id}`) ||
              rec.id.startsWith(`att-dinas-${targetReq.id}`) ||
              rec.id.startsWith(`att-permit-${targetReq.id}`)
            ) {
              return false;
            }
            return true;
          })
          .map((rec) => {
            if (rec.employeeId === targetReq.employeeId && dates.includes(rec.date)) {
              const updatedRec = { ...rec };
              if (updatedRec.notes) {
                const noteParts = updatedRec.notes.split(' • ').filter(
                  (part) =>
                    !part.includes(targetReq.reason) &&
                    !part.includes(targetReq.id) &&
                    !(targetReq.type === 'Izin Datang Terlambat' && part.includes('Izin Terlambat Disetujui')) &&
                    !(targetReq.type === 'Izin Pulang Awal' && part.includes('Izin Pulang Awal Disetujui'))
                );
                updatedRec.notes = noteParts.join(' • ') || undefined;
              }
              if (targetReq.type === 'Izin Datang Terlambat') {
                updatedRec.hasLatePermit = false;
              }
              if (targetReq.type === 'Izin Pulang Awal') {
                updatedRec.hasEarlyPermit = false;
              }
              return updatedRec;
            }
            return rec;
          });
      });
    }

    setLeaveRequests((prev) => prev.filter((r) => r.id !== requestId));
    deleteLeaveRequestFromFirestore(requestId);
    showToast(`Data pengajuan izin ${targetReq.employeeName} (${targetReq.type}) berhasil dihapus dari sistem & Firebase!`, 'info');
  };

  // Super Admin: Edit Leave Request
  const handleEditLeaveRequest = (updatedReq: LeaveRequest) => {
    const oldReq = leaveRequests.find((r) => r.id === updatedReq.id);
    if (!oldReq) return;

    // Quota reconciliation for Cuti Tahunan:
    let refundDays = 0;
    if (oldReq.status === 'Disetujui' && oldReq.type === 'Cuti Tahunan') {
      refundDays = oldReq.totalDays;
    }
    let deductDays = 0;
    if (updatedReq.status === 'Disetujui' && updatedReq.type === 'Cuti Tahunan') {
      deductDays = updatedReq.totalDays;
    }

    if (oldReq.employeeId === updatedReq.employeeId) {
      const netQuotaChange = refundDays - deductDays;
      if (netQuotaChange !== 0) {
        setEmployees((prev) =>
          prev.map((emp) => {
            if (emp.id === updatedReq.employeeId) {
              return {
                ...emp,
                remainingLeaveQuota: Math.max(0, emp.remainingLeaveQuota + netQuotaChange),
              };
            }
            return emp;
          })
        );
      }
    } else {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id === oldReq.employeeId && refundDays > 0) {
            return { ...emp, remainingLeaveQuota: emp.remainingLeaveQuota + refundDays };
          }
          if (emp.id === updatedReq.employeeId && deductDays > 0) {
            return { ...emp, remainingLeaveQuota: Math.max(0, emp.remainingLeaveQuota - deductDays) };
          }
          return emp;
        })
      );
    }

    // Clean up old attendance records if date range changed or status changed from Disetujui
    if (
      oldReq.status === 'Disetujui' &&
      (updatedReq.status !== 'Disetujui' || oldReq.startDate !== updatedReq.startDate || oldReq.endDate !== updatedReq.endDate)
    ) {
      const oldDates = getDatesInRange(oldReq.startDate, oldReq.endDate);
      const newDates = updatedReq.status === 'Disetujui' ? getDatesInRange(updatedReq.startDate, updatedReq.endDate) : [];
      const removedDates = oldDates.filter((d) => !newDates.includes(d));

      setAttendanceRecords((prev) => {
        return prev
          .filter((rec) => {
            if (
              rec.id.startsWith(`att-leave-${oldReq.id}`) ||
              rec.id.startsWith(`att-dinas-${oldReq.id}`) ||
              rec.id.startsWith(`att-permit-${oldReq.id}`)
            ) {
              if (removedDates.includes(rec.date)) return false;
            }
            return true;
          })
          .map((rec) => {
            if (rec.employeeId === oldReq.employeeId && removedDates.includes(rec.date)) {
              const updatedRec = { ...rec };
              if (updatedRec.notes) {
                const noteParts = updatedRec.notes.split(' • ').filter(
                  (part) =>
                    !part.includes(oldReq.reason) &&
                    !part.includes(oldReq.id) &&
                    !(oldReq.type === 'Izin Datang Terlambat' && part.includes('Izin Terlambat Disetujui')) &&
                    !(oldReq.type === 'Izin Pulang Awal' && part.includes('Izin Pulang Awal Disetujui'))
                );
                updatedRec.notes = noteParts.join(' • ') || undefined;
              }
              if (oldReq.type === 'Izin Datang Terlambat') updatedRec.hasLatePermit = false;
              if (oldReq.type === 'Izin Pulang Awal') updatedRec.hasEarlyPermit = false;
              return updatedRec;
            }
            return rec;
          });
      });
    }

    setLeaveRequests((prev) => prev.map((r) => (r.id === updatedReq.id ? updatedReq : r)));
    syncLeaveRequestToFirestore(updatedReq);
    showToast(`Data pengajuan izin ${updatedReq.employeeName} berhasil diperbarui & disinkronkan ke Firebase!`, 'success');
  };

  // Manual Attendance Handlers
  const handleOpenManualAttendance = (recordToEdit?: AttendanceRecord) => {
    if (recordToEdit) {
      setEditingAttendanceRecord(recordToEdit);
    } else {
      setEditingAttendanceRecord(null);
    }
    setIsManualAttendanceModalOpen(true);
  };

  const handleSaveManualAttendance = (
    record: AttendanceRecord, 
    isNew: boolean, 
    additionalRecords?: AttendanceRecord[]
  ) => {
    const allRecords = [record, ...(additionalRecords || [])];

    if (allRecords.length > 1) {
      // Bulk manual attendance
      setAttendanceRecords((prev) => {
        const map = new Map<string, AttendanceRecord>();
        prev.forEach((r) => map.set(`${r.employeeId}_${r.date}`, r));
        allRecords.forEach((r) => map.set(`${r.employeeId}_${r.date}`, r));
        return Array.from(map.values()).sort((a, b) => 
          (b.date + (b.checkInTime || '')).localeCompare(a.date + (a.checkInTime || ''))
        );
      });
      allRecords.forEach((rec) => syncAttendanceRecordToFirestore(rec));
      showToast(`Presensi manual berhasil disimpan & disinkronkan untuk ${allRecords.length} karyawan terpilih!`, 'success');
      return;
    }

    if (isNew) {
      // Check if employee already has attendance recorded for that date
      const existingIndex = attendanceRecords.findIndex(
        (r) => r.employeeId === record.employeeId && r.date === record.date
      );

      if (existingIndex >= 0) {
        const updated = { ...record, id: attendanceRecords[existingIndex].id };
        setAttendanceRecords((prev) =>
          prev.map((r, i) => (i === existingIndex ? updated : r))
        );
        syncAttendanceRecordToFirestore(updated);
        showToast(`Presensi untuk ${record.employeeName} pada ${record.date} berhasil diperbarui & disinkronkan!`, 'success');
      } else {
        setAttendanceRecords((prev) => [record, ...prev]);
        syncAttendanceRecordToFirestore(record);
        showToast(`Presensi manual untuk ${record.employeeName} pada ${record.date} berhasil disimpan & disinkronkan!`, 'success');
      }
    } else {
      // Edit existing record
      setAttendanceRecords((prev) =>
        prev.map((r) => (r.id === record.id ? record : r))
      );
      syncAttendanceRecordToFirestore(record);
      showToast(`Perubahan jam presensi ${record.employeeName} (${record.date}) berhasil disimpan & disinkronkan!`, 'success');
    }
  };

  // Auto Attendance Execution Handler (Admin & Superadmin)
  const handleExecuteAutoAttendance = (generatedRecords: AttendanceRecord[], message?: string) => {
    if (generatedRecords.length === 0) return;

    setAttendanceRecords((prev) => {
      const map = new Map<string, AttendanceRecord>();
      prev.forEach((r) => map.set(`${r.employeeId}_${r.date}`, r));
      generatedRecords.forEach((r) => map.set(`${r.employeeId}_${r.date}`, r));
      return Array.from(map.values()).sort((a, b) => 
        (b.date + (b.checkInTime || '')).localeCompare(a.date + (a.checkInTime || ''))
      );
    });

    generatedRecords.forEach((rec) => syncAttendanceRecordToFirestore(rec));
    showToast(message || `Presensi otomatis berhasil di-generate & disinkronkan untuk ${generatedRecords.length} karyawan!`, 'success');
  };

  const handleDeleteAttendanceRecord = (recordId: string) => {
    if (currentEmployee.systemRole !== 'admin' && currentEmployee.systemRole !== 'superadmin') {
      showToast('Akses ditolak: Hanya Admin & Superadmin yang dapat menghapus data absensi.', 'error');
      return;
    }
    const target = attendanceRecords.find((r) => r.id === recordId);
    setAttendanceRecords((prev) => prev.filter((r) => r.id !== recordId));
    deleteAttendanceRecordFromFirestore(recordId);
    showToast(
      target 
        ? `Data presensi ${target.employeeName} (${target.date}) berhasil dihapus dari sistem & Firebase.` 
        : 'Data presensi berhasil dihapus dari sistem & Firebase.', 
      'info'
    );
  };

  const handleDeleteMultipleAttendanceRecords = (recordIds: string[]) => {
    if (currentEmployee.systemRole !== 'admin' && currentEmployee.systemRole !== 'superadmin') {
      showToast('Akses ditolak: Hanya Admin & Superadmin yang dapat menghapus data absensi.', 'error');
      return;
    }
    if (recordIds.length === 0) return;
    const idSet = new Set(recordIds);
    setAttendanceRecords((prev) => prev.filter((r) => !idSet.has(r.id)));
    batchDeleteAttendanceRecordsFromFirestore(recordIds);
    showToast(`${recordIds.length} data presensi berhasil dihapus sekaligus dari sistem & Firebase.`, 'info');
  };

  // Add new employee
  const handleAddEmployee = (newEmpData: Omit<Employee, 'id'>) => {
    const newEmp: Employee = {
      ...newEmpData,
      id: `emp-${Date.now()}`,
    };
    setEmployees((prev) => [...prev, newEmp]);
    syncEmployeeToFirestore(newEmp);
    showToast(`Karyawan baru ${newEmp.name} (${newEmp.nik}) berhasil ditambahkan & disinkronkan ke Firebase!`, 'success');
  };

  // Edit employee data
  const handleEditEmployee = (updatedEmp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
    syncEmployeeToFirestore(updatedEmp);
    // Synchronize current employee state if matched
    if (currentEmployeeId === updatedEmp.id) {
      // currentEmployee useMemo automatically updates
    }
    // Synchronize attendance records and leave requests with updated employee name
    setAttendanceRecords((prev) =>
      prev.map((r) =>
        r.employeeId === updatedEmp.id
          ? { ...r, employeeName: updatedEmp.name, employeeNik: updatedEmp.nik, department: updatedEmp.department }
          : r
      )
    );
    setLeaveRequests((prev) =>
      prev.map((lr) =>
        lr.employeeId === updatedEmp.id
          ? { ...lr, employeeName: updatedEmp.name, employeeNik: updatedEmp.nik, department: updatedEmp.department }
          : lr
      )
    );
    showToast(`Data karyawan ${updatedEmp.name} berhasil diperbarui!`, 'success');
  };

  // Delete employee (Cascade delete: profil, riwayat absensi, dan data permohonan izin)
  const handleDeleteEmployee = (empId: string) => {
    if (employees.length <= 1) {
      showToast('Tidak dapat menghapus, minimal harus ada 1 data karyawan.', 'error');
      return;
    }
    const empToDelete = employees.find((e) => e.id === empId);
    if (empToDelete?.systemRole === 'admin' && employees.filter((e) => e.systemRole === 'admin').length <= 1) {
      showToast('Tidak dapat menghapus satu-satunya akun Administrator sistem.', 'error');
      return;
    }
    const remaining = employees.filter((e) => e.id !== empId);
    setEmployees(remaining);
    deleteEmployeeFromFirestore(empId);

    // CASCADE DELETE: Bersihkan seluruh data riwayat presensi karyawan ini
    const toDeleteAttIds = attendanceRecords
      .filter((r) => r.employeeId === empId || (empToDelete && r.employeeName === empToDelete.name))
      .map((r) => r.id);
    if (toDeleteAttIds.length > 0) {
      batchDeleteAttendanceRecordsFromFirestore(toDeleteAttIds);
    }
    setAttendanceRecords((prev) =>
      prev.filter((r) => r.employeeId !== empId && (!empToDelete || r.employeeName !== empToDelete.name))
    );

    // CASCADE DELETE: Bersihkan seluruh data permohonan izin/cuti karyawan ini
    const toDeleteLeaveIds = leaveRequests
      .filter((lr) => lr.employeeId !== empId || (empToDelete && lr.employeeName !== empToDelete.name))
      .map((lr) => lr.id);
    toDeleteLeaveIds.forEach((id) => deleteLeaveRequestFromFirestore(id));
    setLeaveRequests((prev) =>
      prev.filter((lr) => lr.employeeId !== empId && (!empToDelete || lr.employeeName !== empToDelete.name))
    );

    // Catat ID karyawan yang telah dihapus ke localStorage agar tidak ter-load ulang
    try {
      const savedDeleted = localStorage.getItem('absensi_deleted_emp_ids');
      const deletedList: string[] = savedDeleted ? JSON.parse(savedDeleted) : [];
      if (!deletedList.includes(empId)) {
        deletedList.push(empId);
        localStorage.setItem('absensi_deleted_emp_ids', JSON.stringify(deletedList));
      }
    } catch {
      // ignore
    }

    if (currentEmployeeId === empId) {
      setCurrentEmployeeId(remaining[0].id);
    }
    showToast(`Data karyawan ${empToDelete?.name || ''} dan seluruh riwayat presensinya telah dihapus dari sistem.`, 'info');
  };

  // Import multiple employees from Excel (.xls / .xlsx)
  const handleImportEmployees = (importedList: Employee[]) => {
    if (!importedList || importedList.length === 0) return;

    setEmployees((prev) => {
      const existingNikMap = new Map<string, Employee>(prev.map((e) => [e.nik.toLowerCase().trim(), e]));
      const updated = [...prev];
      let addedCount = 0;
      let updatedCount = 0;

      for (const emp of importedList) {
        const key = emp.nik.toLowerCase().trim();
        const existing = existingNikMap.get(key);
        if (existing) {
          const idx = updated.findIndex(e => e.id === existing.id);
          if (idx !== -1) {
            const merged = { ...existing, ...emp, id: existing.id };
            updated[idx] = merged;
            syncEmployeeToFirestore(merged);
            updatedCount++;
          }
        } else {
          updated.push(emp);
          syncEmployeeToFirestore(emp);
          addedCount++;
        }
      }

      showToast(
        `Berhasil mengimpor ${importedList.length} karyawan (${addedCount} baru, ${updatedCount} diperbarui)!`,
        'success'
      );
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-3 fade-in duration-200">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-blue-600 text-white border-blue-500'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Header & Navbar */}
      <Header
        currentEmployee={currentEmployee}
        employees={employees}
        onSelectEmployee={(emp) => {
          setCurrentEmployeeId(emp.id);
          showToast(`Beralih ke profil karyawan: ${emp.name}`, 'info');
        }}
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'pengaturan') {
            setIsOfficeModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        officeConfig={officeConfig}
        onOpenOfficeModal={() => setIsOfficeModalOpen(true)}
        onOpenAddEmployeeModal={() => {
          setActiveTab('karyawan');
          setIsAddEmployeeModalDirectOpen(true);
        }}
        cloudSyncStatus={cloudSyncStatus}
        onForceSync={handleForceSyncAll}
        onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Tab 1: Presensi & Absen Workstation */}
        {activeTab === 'presensi' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Dashboard Overview Cards */}
            <DashboardStats 
              employees={employees} 
              todayRecords={todayRecords} 
              requests={leaveRequests}
              onNavigateToEmployees={() => setActiveTab('karyawan')}
              onNavigateToLeave={() => setActiveTab('cuti')}
              onOpenManualAttendance={() => handleOpenManualAttendance()}
              isAdmin={isAdminOrSuperadmin}
            />

            {/* Core Clock In / Clock Out Card for Current Employee */}
            <ClockCard
              employee={currentEmployee}
              todayRecord={currentEmployeeTodayRecord}
              officeConfig={officeConfig}
              onOpenAttendanceModal={handleOpenAttendanceModal}
              onOpenManualAttendanceModal={() => {
                if (currentEmployeeTodayRecord) {
                  handleOpenManualAttendance(currentEmployeeTodayRecord);
                } else {
                  handleOpenManualAttendance();
                }
              }}
              onOpenAutoAttendanceModal={() => setIsAutoAttendanceModalOpen(true)}
              userDistanceToOffice={userDistanceToOffice}
              isWithinOfficeRadius={isWithinOfficeRadius}
            />

            {/* Rekapitulasi Izin Jam Kerja (Izin Datang Terlambat & Izin Pulang Awal) */}
            <PermitRecapDashboard
              requests={leaveRequests}
              employees={employees}
              currentEmployee={currentEmployee}
              officeConfig={officeConfig}
              onNavigateToLeaveManagement={() => setActiveTab('cuti')}
              onOpenLeaveModal={(type) => {
                setActiveTab('cuti');
                if (type) {
                  setLeaveModalInitialType(type);
                }
                setIsLeaveModalAutoOpen(true);
              }}
              onUpdateStatus={handleUpdateLeaveStatus}
              onEditRequest={handleEditLeaveRequest}
              onDeleteRequest={handleDeleteLeaveRequest}
            />

            {/* Two Column Section: Realtime Attendance Feed + Quick Company Info */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left 8 Cols: Log Kehadiran Hari Ini */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      Aktivitas Presensi Hari Ini
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Daftar rekan kerja yang telah absen masuk hari ini ({todayRecords.length} orang)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('rekap')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lihat Rekap Lengkap</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                  {todayRecords.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Belum ada karyawan yang melakukan presensi hari ini.
                    </div>
                  ) : (
                    todayRecords.map((rec) => {
                      const emp = employees.find((e) => e.id === rec.employeeId);
                      const isMe = rec.employeeId === currentEmployee.id;

                      return (
                        <div key={rec.id} className={`p-3.5 sm:px-5 flex items-center justify-between gap-3 ${isMe ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={rec.checkInPhoto || emp?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                              alt={rec.employeeName}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900 truncate">
                                  {rec.employeeName}
                                </span>
                                {isMe && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate flex items-center gap-2">
                                <span>{rec.department}</span>
                                <span>•</span>
                                <span className="font-mono text-slate-700">{rec.type}</span>
                                {rec.location && (
                                  <span className="text-[10px] text-slate-400">
                                    ({rec.location.distanceToOfficeMeters}m)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                rec.status === 'Hadir Tepat Waktu'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : rec.status === 'Terlambat'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {rec.status}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 mt-1">
                              Masuk: <span className="font-semibold text-slate-800">{rec.checkInTime || '-'}</span>
                              {rec.checkOutTime && ` | Pulang: ${rec.checkOutTime}`}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right 4 Cols: System Guidelines & Quick Actions */}
              <div className="lg:col-span-4 space-y-4">
                {/* Geofence Info Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Ketentuan Presensi Kantor
                  </div>
                  <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>Jam masuk resmi: <strong className="text-slate-800">{officeConfig.workStartTime} WIB</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>Batas toleransi terlambat: <strong className="text-slate-800">{officeConfig.lateToleranceMinutes} menit</strong> ({officeConfig.workStartTime.split(':')[0]}:{parseInt(officeConfig.workStartTime.split(':')[1]) + officeConfig.lateToleranceMinutes} WIB)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>Radius maksimal WFO: <strong className="text-slate-800">{officeConfig.radiusMeters} meter</strong> dari titik kantor</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>Wajib menyertakan foto selfie dan izin lokasi GPS saat presensi</span>
                    </li>
                  </ul>

                  <button
                    type="button"
                    onClick={() => setActiveTab('cuti')}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    Ajukan Izin Sakit / Cuti
                  </button>
                </div>

                {/* Simulated Employee Testing Banner */}
                <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    Simulasi Akun Karyawan
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Anda dapat beralih profil karyawan melalui tombol profil di kanan atas header untuk menguji coba absensi masuk, pulang, maupun persetujuan izin oleh HRD.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Rekapitulasi Kehadiran */}
        {activeTab === 'rekap' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <HistoryTable
              records={attendanceRecords}
              employees={employees}
              departments={departments}
              currentEmployee={currentEmployee}
              requests={leaveRequests}
              onOpenManualAttendanceModal={() => handleOpenManualAttendance()}
              onOpenAutoAttendanceModal={() => setIsAutoAttendanceModalOpen(true)}
              onEditAttendanceRecord={(record) => handleOpenManualAttendance(record)}
              onDeleteAttendanceRecord={handleDeleteAttendanceRecord}
              onDeleteMultipleAttendanceRecords={handleDeleteMultipleAttendanceRecords}
              onOpenFingerprintModal={() => setIsFingerprintModalOpen(true)}
            />
          </div>
        )}

        {/* Tab 3: Pengajuan Izin & Cuti */}
        {activeTab === 'cuti' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <LeaveManagement
              requests={leaveRequests}
              currentEmployee={currentEmployee}
              employees={employees}
              officeConfig={officeConfig}
              onSubmitRequest={handleSubmitLeaveRequest}
              onUpdateStatus={handleUpdateLeaveStatus}
              onEditRequest={handleEditLeaveRequest}
              onDeleteRequest={handleDeleteLeaveRequest}
              initialOpenModal={isLeaveModalAutoOpen}
              initialLeaveType={leaveModalInitialType || undefined}
              onClearInitialModal={() => {
                setIsLeaveModalAutoOpen(false);
                setLeaveModalInitialType(null);
              }}
            />
          </div>
        )}

        {/* Tab 4: Manajemen & Tambah Data Karyawan */}
        {activeTab === 'karyawan' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <EmployeeManagement
              employees={employees}
              currentEmployee={currentEmployee}
              departments={departments}
              officeConfig={officeConfig}
              onSelectEmployee={(emp) => {
                setCurrentEmployeeId(emp.id);
                showToast(`Beralih ke profil karyawan: ${emp.name}`, 'info');
              }}
              onAddEmployee={handleAddEmployee}
              onEditEmployee={handleEditEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onImportEmployees={handleImportEmployees}
              isAddModalOpenInitially={isAddEmployeeModalDirectOpen}
              onCloseAddModalInitially={() => setIsAddEmployeeModalDirectOpen(false)}
            />
          </div>
        )}

      </main>

      {/* Attendance Camera & GPS Verification Modal */}
      <AttendanceModal
        isOpen={isAttendanceModalOpen}
        mode={attendanceModalMode}
        employee={currentEmployee}
        officeConfig={officeConfig}
        leaveRequests={leaveRequests}
        todayCheckInTime={attendanceRecords.find(r => r.employeeId === currentEmployee.id && r.date === getTodayDateString())?.checkInTime}
        onClose={() => setIsAttendanceModalOpen(false)}
        onSubmit={handleConfirmAttendance}
      />

      {/* Office Settings Modal */}
      <OfficeSettingsModal
        isOpen={isOfficeModalOpen}
        config={officeConfig}
        onClose={() => setIsOfficeModalOpen(false)}
        onSave={(newCfg) => {
          setOfficeConfig(newCfg);
          syncOfficeConfigToFirestore(newCfg);
          setEmployees(prev => {
            const updated = prev.map(emp => {
              const updatedEmp = {
                ...emp,
                shift: {
                  ...emp.shift,
                  startTime: newCfg.workStartTime,
                  endTime: newCfg.workEndTime,
                  lateToleranceMinutes: newCfg.lateToleranceMinutes,
                  name: `${emp.shift.name.split(' (')[0] || 'Reguler'} (${newCfg.workStartTime} - ${newCfg.workEndTime})`,
                }
              };
              syncEmployeeToFirestore(updatedEmp);
              return updatedEmp;
            });
            localStorage.setItem('absensi_employees', JSON.stringify(updated));
            return updated;
          });
          showToast(`Jam kerja seluruh karyawan berhasil disesuaikan menjadi ${newCfg.workStartTime} - ${newCfg.workEndTime} WIB dan disinkronkan ke Firebase!`);
        }}
      />

      {/* Manual Attendance Entry & Edit Modal (Includes Single & Bulk for Admin/Superadmin) */}
      <ManualAttendanceModal
        isOpen={isManualAttendanceModalOpen}
        onClose={() => {
          setIsManualAttendanceModalOpen(false);
          setEditingAttendanceRecord(null);
        }}
        employees={employees}
        officeConfig={officeConfig}
        currentEmployee={currentEmployee}
        initialEmployeeId={currentEmployee.id}
        initialRecord={editingAttendanceRecord}
        existingRecords={attendanceRecords}
        onSave={handleSaveManualAttendance}
        onSaveBulk={(records, message) => {
          setAttendanceRecords((prev) => {
            const map = new Map<string, AttendanceRecord>();
            prev.forEach((r) => map.set(`${r.employeeId}_${r.date}`, r));
            records.forEach((r) => map.set(`${r.employeeId}_${r.date}`, r));
            return Array.from(map.values()).sort((a, b) => 
              (b.date + (b.checkInTime || '')).localeCompare(a.date + (a.checkInTime || ''))
            );
          });
          records.forEach((r) => syncAttendanceRecordToFirestore(r));
          showToast(`${message} (Tersinkronisasi ke Firebase)`, 'success');
        }}
      />

      {/* Auto Attendance Generation Modal (Admin & Superadmin) */}
      <AutoAttendanceModal
        isOpen={isAutoAttendanceModalOpen}
        onClose={() => setIsAutoAttendanceModalOpen(false)}
        employees={employees}
        existingRecords={attendanceRecords}
        officeConfig={officeConfig}
        currentEmployee={currentEmployee}
        onExecuteAutoAttendance={handleExecuteAutoAttendance}
      />

      {/* Fingerprint Machine Integration Modal */}
      <FingerprintModal
        isOpen={isFingerprintModalOpen}
        onClose={() => setIsFingerprintModalOpen(false)}
        officeConfig={officeConfig}
        employees={employees}
        attendanceRecords={attendanceRecords}
        onUpdateEmployees={(updated) => {
          setEmployees(updated);
          updated.forEach(e => syncEmployeeToFirestore(e));
        }}
        onAddOrUpdateRecords={(newRecs) => {
          setAttendanceRecords((prev) => {
            const map = new Map(prev.map(r => [`${r.employeeId}-${r.date}`, r]));
            newRecs.forEach(r => map.set(`${r.employeeId}-${r.date}`, r));
            return Array.from(map.values());
          });
          newRecs.forEach((r) => syncAttendanceRecordToFirestore(r));
          showToast(`Berhasil mengimpor dan menyinkronkan data presensi mesin fingerprint ke Firebase!`, 'success');
        }}
      />

      {/* Android PWA & Native APK Guidance Modal */}
      <AndroidAppModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">AbsensiPro</span>
            <span>• Sistem Presensi Karyawan Terintegrasi</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-footer-android"
              onClick={() => setIsAndroidModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 cursor-pointer transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Versi Mobile Android (PWA & APK)</span>
            </button>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Waktu Server: WIB (UTC+7)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
