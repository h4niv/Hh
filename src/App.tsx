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
import LiveFingerprintToast from './components/LiveFingerprintToast';
import SemesterPerformanceReport from './components/SemesterPerformanceReport';
import MonthlyEmployeeRecap from './components/MonthlyEmployeeRecap';
import DailyRecap from './components/DailyRecap';
import { LoginPage } from './components/LoginPage';
import { useFingerprintLiveStream } from './hooks/useFingerprintLiveStream';
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
    
    let emps: Employee[] = INITIAL_EMPLOYEES;
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Employee[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          emps = parsed;
        }
      } catch {
        emps = INITIAL_EMPLOYEES;
      }
    }

    const updated = emps.map(emp => {
      const deptUpper = (emp.department || '').trim().toUpperCase();
      const deptLower = (emp.department || '').trim().toLowerCase();
      let category: 'GTY' | 'GTT' | 'KTY' | 'KTT' | 'PTT';

      if (
        deptUpper === 'GTT' || 
        deptUpper.startsWith('GTT') || 
        deptUpper.includes(' GTT') || 
        deptUpper.includes('/GTT') || 
        deptUpper.includes('-GTT') || 
        deptUpper.includes('(GTT)') || 
        deptLower.includes('guru tidak tetap') || 
        deptLower.includes('gtt')
      ) {
        category = 'GTT';
      } else if (
        deptUpper === 'KTT' || 
        deptUpper.startsWith('KTT') || 
        deptUpper.includes(' KTT') || 
        deptUpper.includes('/KTT') || 
        deptUpper.includes('-KTT') || 
        deptUpper.includes('(KTT)') || 
        deptUpper === 'PTT' || 
        deptLower.includes('karyawan tidak tetap') || 
        deptLower.includes('ktt') || 
        deptLower.includes('ptt')
      ) {
        category = 'KTT';
      } else if (
        deptUpper === 'GTY' || 
        deptUpper.startsWith('GTY') || 
        deptUpper.includes(' GTY') || 
        deptUpper.includes('/GTY') || 
        deptUpper.includes('-GTY') || 
        deptUpper.includes('(GTY)') || 
        deptLower.includes('guru tetap') || 
        deptLower.includes('gty')
      ) {
        category = 'GTY';
      } else if (
        deptUpper === 'KTY' || 
        deptUpper.startsWith('KTY') || 
        deptUpper.includes(' KTY') || 
        deptUpper.includes('/KTY') || 
        deptUpper.includes('-KTY') || 
        deptUpper.includes('(KTY)') || 
        deptLower.includes('karyawan tetap') || 
        deptLower.includes('kty')
      ) {
        category = 'KTY';
      } else {
        category = emp.employmentCategory || 
          (emp.role?.toLowerCase().includes('guru') || emp.department?.toLowerCase().includes('pendidik') ? 'GTY' : 'KTY');
      }

      return {
        ...emp,
        employmentCategory: category,
        shift: {
          startTime: emp.shift?.startTime || cfg.workStartTime || '07:00',
          endTime: emp.shift?.endTime || cfg.workEndTime || '15:15',
          lateToleranceMinutes: emp.shift?.lateToleranceMinutes ?? cfg.lateToleranceMinutes ?? 5,
          name: emp.shift?.name || `Reguler (${cfg.workStartTime || '07:00'} - ${cfg.workEndTime || '15:15'})`,
          id: emp.shift?.id || `shift-${emp.id}`,
        }
      };
    });

    try {
      localStorage.setItem('absensi_employees', JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('absensi_records');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AttendanceRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // ignore
      }
    }
    return INITIAL_ATTENDANCE_RECORDS;
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem('absensi_leaves');
    let reqs: LeaveRequest[] = INITIAL_LEAVE_REQUESTS;
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as LeaveRequest[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          reqs = parsed;
        } else {
          reqs = INITIAL_LEAVE_REQUESTS;
        }
      } catch {
        reqs = INITIAL_LEAVE_REQUESTS;
      }
    }
    return reqs;
  });

  const [officeConfig, setOfficeConfig] = useState<OfficeConfig>(() => {
    const saved = localStorage.getItem('absensi_office_config');
    return saved ? JSON.parse(saved) : DEFAULT_OFFICE_CONFIG;
  });

  // Authentication State: Session-based so opening link / fresh launch directly opens Login Page
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const sessionAuth = sessionStorage.getItem('absensi_auth_logged_in');
    return sessionAuth === 'true';
  });

  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>(() => {
    const sessionAuth = sessionStorage.getItem('absensi_auth_logged_emp_id');
    const savedAuth = localStorage.getItem('absensi_auth_logged_emp_id');
    const saved = sessionAuth || savedAuth || localStorage.getItem('absensi_current_emp');
    const savedEmployees = localStorage.getItem('absensi_employees');
    const emps: Employee[] = savedEmployees ? JSON.parse(savedEmployees) : INITIAL_EMPLOYEES;
    if (saved && emps.some(e => e.id === saved)) {
      return saved;
    }
    // Default to superadmin or first employee
    const superAdmin = emps.find(e => e.systemRole === 'superadmin');
    return superAdmin?.id || emps[0]?.id || 'emp-1';
  });

  const [activeTab, setActiveTab] = useState<'presensi' | 'rekap' | 'cuti' | 'karyawan' | 'pengaturan' | 'kinerja' | 'rekap-bulanan'>('presensi');
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
    seedInitialDataIfEmpty(
      employees.length > 0 ? employees : INITIAL_EMPLOYEES,
      attendanceRecords.length > 0 ? attendanceRecords : INITIAL_ATTENDANCE_RECORDS,
      leaveRequests.length > 0 ? leaveRequests : INITIAL_LEAVE_REQUESTS,
      officeConfig
    )
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
        setCurrentEmployeeId((prev) => {
          if (remoteEmps.some(e => e.id === prev)) {
            return prev;
          }
          // Prioritize Superadmin, then Admin, then first employee
          const superAdmin = remoteEmps.find(e => e.systemRole === 'superadmin');
          const admin = remoteEmps.find(e => e.systemRole === 'admin');
          return superAdmin?.id || admin?.id || remoteEmps[0].id;
        });
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
                startTime: remoteConfig.workStartTime || '07:00',
                endTime: remoteConfig.workEndTime || '15:15',
                lateToleranceMinutes: remoteConfig.lateToleranceMinutes ?? 5,
                name: `${emp.shift?.name?.split(' (')[0] || 'Reguler'} (${remoteConfig.workStartTime || '07:00'} - ${remoteConfig.workEndTime || '15:15'})`,
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

  // Sync to localStorage with quota protection
  useEffect(() => {
    try {
      localStorage.setItem('absensi_employees', JSON.stringify(employees));
    } catch (e) {
      console.warn('Failed to save employees to localStorage:', e);
    }
  }, [employees]);

  useEffect(() => {
    try {
      // Strip large base64 image data to safely fit inside browser localStorage quota
      const lightRecords = attendanceRecords.slice(0, 500).map(r => ({
        ...r,
        checkInPhoto: r.checkInPhoto && r.checkInPhoto.startsWith('data:') ? undefined : r.checkInPhoto,
        checkOutPhoto: r.checkOutPhoto && r.checkOutPhoto.startsWith('data:') ? undefined : r.checkOutPhoto,
      }));
      localStorage.setItem('absensi_records', JSON.stringify(lightRecords));
    } catch (e) {
      console.warn('Failed to save attendance records to localStorage:', e);
    }
  }, [attendanceRecords]);

  useEffect(() => {
    try {
      localStorage.setItem('absensi_leaves', JSON.stringify(leaveRequests));
    } catch (e) {
      console.warn('Failed to save leaves to localStorage:', e);
    }
  }, [leaveRequests]);

  useEffect(() => {
    try {
      localStorage.setItem('absensi_office_config', JSON.stringify(officeConfig));
    } catch (e) {
      console.warn('Failed to save office config to localStorage:', e);
    }
  }, [officeConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('absensi_current_emp', currentEmployeeId);
    } catch (e) {
      console.warn('Failed to save current emp to localStorage:', e);
    }
  }, [currentEmployeeId]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Real-time Automatic Fingerprint Punch Receiver via Server-Sent Events (SSE)
  const {
    isConnected: isFingerprintConnected,
    lastPunch,
    punchFeed,
    activeNotification,
    autoReceiverEnabled,
    setAutoReceiverEnabled,
    simulatePunch,
    dismissNotification
  } = useFingerprintLiveStream({
    employees,
    attendanceRecords,
    officeConfig,
    onRecordUpdated: (record) => {
      setAttendanceRecords((prev) => {
        const idx = prev.findIndex((r) => r.id === record.id || (r.employeeId === record.employeeId && r.date === record.date));
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = record;
          return next;
        }
        return [record, ...prev];
      });
      syncAttendanceRecordToFirestore(record).catch(e => console.warn('Sync fingerprint attendance error:', e));
    },
    onShowToast: (text, type) => {
      showToast(text, type);
    }
  });

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
    const activeEmpNiks = new Set(employees.map((e) => e.nik.toLowerCase().trim()));
    const activeEmpNames = new Set(employees.map((e) => e.name.toLowerCase().trim()));

    return attendanceRecords.filter((r) => {
      if (r.date !== todayStr) return false;
      if (employees.length === 0) return true;
      return activeEmpIds.has(r.employeeId) ||
        (Boolean(r.employeeNik) && activeEmpNiks.has(r.employeeNik.toLowerCase().trim())) ||
        (Boolean(r.employeeName) && activeEmpNames.has(r.employeeName.toLowerCase().trim()));
    });
  }, [attendanceRecords, employees, todayStr]);

  // Today's record for currently selected employee
  const currentEmployeeTodayRecord = useMemo(() => {
    if (!currentEmployee) return undefined;
    return attendanceRecords.find(
      (r) => r.date === todayStr && (
        r.employeeId === currentEmployee.id ||
        (Boolean(r.employeeNik) && r.employeeNik.toLowerCase().trim() === currentEmployee.nik.toLowerCase().trim()) ||
        (Boolean(r.employeeName) && r.employeeName.toLowerCase().trim() === currentEmployee.name.toLowerCase().trim())
      )
    );
  }, [attendanceRecords, currentEmployee, todayStr]);

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

  // Helper to get dates in range safely without timezone offset or infinite loops
  const getDatesInRange = (startStr: string, endStr: string): string[] => {
    if (!startStr) return [];
    const end = endStr || startStr;
    const dates: string[] = [];
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    if (!sy || !sm || !sd) return [startStr];
    const curr = new Date(sy, sm - 1, sd);
    const stop = new Date(ey || sy, (em || sm) - 1, ed || sd);
    let count = 0;
    while (curr <= stop && count < 60) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return dates.length > 0 ? dates : [startStr];
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
                status: isLateReq ? 'Terlambat' : 'Hadir Tepat Waktu',
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

  // Super Admin: Delete All Leave Requests
  const handleDeleteAllLeaveRequests = () => {
    leaveRequests.forEach((req) => {
      if (req.status === 'Disetujui' && req.type === 'Cuti Tahunan') {
        setEmployees((prev) =>
          prev.map((emp) => {
            if (emp.id === req.employeeId) {
              return {
                ...emp,
                remainingLeaveQuota: emp.remainingLeaveQuota + req.totalDays,
              };
            }
            return emp;
          })
        );
      }
    });

    setAttendanceRecords((prev) => {
      return prev
        .filter((rec) => {
          if (
            rec.id.startsWith('att-leave-') ||
            rec.id.startsWith('att-dinas-') ||
            rec.id.startsWith('att-permit-')
          ) {
            return false;
          }
          return true;
        })
        .map((rec) => {
          const updatedRec = { ...rec };
          if (updatedRec.notes && (updatedRec.notes.includes('Izin Terlambat Disetujui') || updatedRec.notes.includes('Izin Pulang Awal Disetujui') || updatedRec.notes.includes('Cuti'))) {
            const noteParts = updatedRec.notes.split(' • ').filter(
              (part) =>
                !part.includes('Izin Terlambat Disetujui') &&
                !part.includes('Izin Pulang Awal Disetujui') &&
                !part.includes('Cuti') &&
                !part.includes('Izin')
            );
            updatedRec.notes = noteParts.join(' • ') || undefined;
          }
          updatedRec.hasLatePermit = false;
          updatedRec.hasEarlyPermit = false;
          return updatedRec;
        });
    });

    leaveRequests.forEach((req) => {
      deleteLeaveRequestFromFirestore(req.id);
    });

    setLeaveRequests([]);
    showToast('Semua data pengajuan izin & cuti berhasil dihapus dari sistem & Firebase!', 'info');
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
      .filter((lr) => lr.employeeId === empId || (empToDelete && lr.employeeName === empToDelete.name))
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

  // Update TMT (Terhitung Mulai Tanggal) for Employee
  const handleUpdateEmployeeTmt = (empId: string, newTmt: string) => {
    setEmployees((prev) => {
      const updated = prev.map((emp) => {
        if (emp.id === empId) {
          const updatedEmp = { ...emp, tmt: newTmt };
          syncEmployeeToFirestore(updatedEmp);
          return updatedEmp;
        }
        return emp;
      });
      localStorage.setItem('absensi_employees', JSON.stringify(updated));
      return updated;
    });
    showToast(`TMT karyawan berhasil diperbarui menjadi: ${newTmt}`, 'success');
  };

  // Update Status Kepegawaian (GTY / KTY / GTT / PTT)
  const handleUpdateEmployeeCategory = (empId: string, category: 'GTY' | 'KTY' | 'GTT' | 'PTT') => {
    setEmployees((prev) => {
      const updated = prev.map((emp) => {
        if (emp.id === empId) {
          const updatedEmp = { ...emp, employmentCategory: category };
          syncEmployeeToFirestore(updatedEmp);
          return updatedEmp;
        }
        return emp;
      });
      localStorage.setItem('absensi_employees', JSON.stringify(updated));
      return updated;
    });
    showToast(`Status kepegawaian berhasil diubah menjadi: ${category}`, 'success');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('absensi_auth_logged_in');
    sessionStorage.removeItem('absensi_auth_logged_emp_id');
    localStorage.removeItem('absensi_auth_logged_emp_id');
    setIsAuthenticated(false);
    showToast('Anda telah berhasil keluar dari akun.', 'info');
  };

  const handleLogin = (loggedEmp: Employee) => {
    setCurrentEmployeeId(loggedEmp.id);
    setIsAuthenticated(true);
    sessionStorage.setItem('absensi_auth_logged_in', 'true');
    sessionStorage.setItem('absensi_auth_logged_emp_id', loggedEmp.id);
    localStorage.setItem('absensi_auth_logged_emp_id', loggedEmp.id);
    localStorage.setItem('absensi_current_emp', loggedEmp.id);
    showToast(
      `Selamat datang, ${loggedEmp.name}! Masuk sebagai ${
        loggedEmp.systemRole === 'superadmin'
          ? 'Superadmin'
          : loggedEmp.systemRole === 'admin'
          ? 'Administrator'
          : 'Karyawan (User)'
      }.`,
      'success'
    );
  };

  // If not authenticated, render Login Page
  if (!isAuthenticated || !currentEmployee) {
    return (
      <LoginPage
        employees={employees}
        officeConfig={officeConfig}
        onLogin={handleLogin}
      />
    );
  }

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
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'pengaturan') {
            if (currentEmployee.systemRole !== 'superadmin') {
              showToast('Akses ditolak: Hanya Superadmin yang dapat mengatur parameter kantor.', 'error');
              return;
            }
            setIsOfficeModalOpen(true);
          } else if (tab === 'karyawan') {
            if (currentEmployee.systemRole === 'karyawan') {
              showToast('Akses ditolak: Data master karyawan hanya untuk Admin & Superadmin.', 'error');
              return;
            }
            setActiveTab(tab);
          } else {
            setActiveTab(tab);
          }
        }}
        officeConfig={officeConfig}
        onOpenOfficeModal={() => {
          if (currentEmployee.systemRole !== 'superadmin') {
            showToast('Akses ditolak: Hanya Superadmin yang dapat mengatur parameter kantor.', 'error');
            return;
          }
          setIsOfficeModalOpen(true);
        }}
        onOpenAddEmployeeModal={() => {
          if (currentEmployee.systemRole === 'karyawan') {
            showToast('Akses ditolak: Hanya Admin & Superadmin yang dapat menambah karyawan.', 'error');
            return;
          }
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
              onOpenFingerprintModal={() => setIsFingerprintModalOpen(true)}
              userDistanceToOffice={userDistanceToOffice}
              isWithinOfficeRadius={isWithinOfficeRadius}
            />

            {/* Rekapitulasi Izin Jam Kerja (Izin Datang Terlambat & Izin Pulang Awal) */}
            <PermitRecapDashboard
              requests={leaveRequests}
              attendanceRecords={attendanceRecords}
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
              onNavigateToSemesterReport={() => setActiveTab('kinerja')}
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
              onNavigateToSemesterReport={() => setActiveTab('kinerja')}
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
              onDeleteAllRequests={handleDeleteAllLeaveRequests}
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

        {/* Tab 5: Laporan Penilaian Kinerja Kehadiran Semester (Format SMK Texmaco Semarang) */}
        {activeTab === 'kinerja' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <SemesterPerformanceReport
              employees={employees}
              attendanceRecords={attendanceRecords}
              leaveRequests={leaveRequests}
              officeConfig={officeConfig}
              currentEmployee={currentEmployee}
              onUpdateEmployeeTmt={handleUpdateEmployeeTmt}
              onUpdateEmployeeCategory={handleUpdateEmployeeCategory}
            />
          </div>
        )}


        {/* Tab 7: Rekap Bulanan (Format 3.png) */}
        {activeTab === 'rekap-bulanan' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <MonthlyEmployeeRecap
              employees={employees}
              attendanceRecords={attendanceRecords}
              leaveRequests={leaveRequests}
              officeConfig={officeConfig}
              currentEmployee={currentEmployee}
              onImportAttendance={(importedRecords) => {
                setAttendanceRecords((prev) => {
                  const map = new Map<string, AttendanceRecord>();
                  prev.forEach((r) => map.set(`${r.employeeId}_${r.date}`, r));
                  importedRecords.forEach((r) => map.set(`${r.employeeId}_${r.date}`, r));
                  return Array.from(map.values()).sort((a, b) => 
                    (b.date + (b.checkInTime || '')).localeCompare(a.date + (a.checkInTime || ''))
                  );
                });
                importedRecords.forEach((r) => syncAttendanceRecordToFirestore(r));
              }}
              onDeleteAttendanceRecord={(recordId) => {
                setAttendanceRecords((prev) => prev.filter((r) => r.id !== recordId));
                deleteAttendanceRecordFromFirestore(recordId);
              }}
              onDeleteMultipleAttendanceRecords={(recordIds) => {
                setAttendanceRecords((prev) => prev.filter((r) => !recordIds.includes(r.id)));
                recordIds.forEach((id) => deleteAttendanceRecordFromFirestore(id));
              }}
              onShowToast={(text, type) => showToast(text, type)}
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
        isLiveConnected={isFingerprintConnected}
        lastPunch={lastPunch}
        punchFeed={punchFeed}
        onSimulatePunch={simulatePunch}
        autoReceiverEnabled={autoReceiverEnabled}
        onToggleAutoReceiver={setAutoReceiverEnabled}
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

      {/* Real-time Live Fingerprint Pop-up Alert */}
      <LiveFingerprintToast
        notification={activeNotification}
        onDismiss={dismissNotification}
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
            <span className="font-semibold text-slate-700">SIAP-TEX</span>
            <span>• Sistem Presensi Guru & Karyawan Terintegrasi</span>
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
