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

export default function App() {
  // Persistence with localStorage
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('absensi_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('absensi_records');
    if (!saved) return INITIAL_ATTENDANCE_RECORDS;
    try {
      const parsed = JSON.parse(saved) as AttendanceRecord[];
      // If user has old minimal records (<= 3 items), merge with rich initial records so all period filters have data
      if (parsed.length <= 3) {
        const existingIds = new Set(parsed.map(r => r.id));
        const missing = INITIAL_ATTENDANCE_RECORDS.filter(r => !existingIds.has(r.id));
        return [...parsed, ...missing];
      }
      return parsed;
    } catch {
      return INITIAL_ATTENDANCE_RECORDS;
    }
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem('absensi_leaves');
    return saved ? JSON.parse(saved) : INITIAL_LEAVE_REQUESTS;
  });

  const [officeConfig, setOfficeConfig] = useState<OfficeConfig>(() => {
    const saved = localStorage.getItem('absensi_office_config');
    return saved ? JSON.parse(saved) : DEFAULT_OFFICE_CONFIG;
  });

  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>(() => {
    const saved = localStorage.getItem('absensi_current_emp');
    return saved && INITIAL_EMPLOYEES.some(e => e.id === saved) ? saved : INITIAL_EMPLOYEES[0].id;
  });

  const [activeTab, setActiveTab] = useState<'presensi' | 'rekap' | 'cuti' | 'karyawan' | 'pengaturan'>('presensi');
  const [isAddEmployeeModalDirectOpen, setIsAddEmployeeModalDirectOpen] = useState<boolean>(false);
  
  // Modals
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [attendanceModalMode, setAttendanceModalMode] = useState<'in' | 'out'>('in');
  const [isOfficeModalOpen, setIsOfficeModalOpen] = useState<boolean>(false);
  const [isManualAttendanceModalOpen, setIsManualAttendanceModalOpen] = useState<boolean>(false);
  const [editingAttendanceRecord, setEditingAttendanceRecord] = useState<AttendanceRecord | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

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

  // Today's date
  const todayStr = getTodayDateString();

  // Today's records for all employees
  const todayRecords = useMemo(() => {
    return attendanceRecords.filter((r) => r.date === todayStr);
  }, [attendanceRecords, todayStr]);

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
      };

      setAttendanceRecords((prev) => [newRecord, ...prev.filter(r => !(r.employeeId === currentEmployee.id && r.date === todayStr))]);
      showToast(`Absen Masuk berhasil dicatat pukul ${nowTime} WIB! Status: ${data.status}`);
    } else {
      // Clock out
      setAttendanceRecords((prev) =>
        prev.map((r) => {
          if (r.employeeId === currentEmployee.id && r.date === todayStr) {
            return {
              ...r,
              checkOutTime: nowTime,
              checkOutPhoto: data.photo,
              notes: data.notes ? `${r.notes ? r.notes + ' | ' : ''}Pulang: ${data.notes}` : r.notes,
            };
          }
          return r;
        })
      );
      showToast(`Absen Pulang berhasil dicatat pukul ${nowTime} WIB! Selamat beristirahat.`);
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
    showToast('Permohonan cuti/izin berhasil dikirim dan menunggu persetujuan HRD.');
  };

  // Handle Leave Status Update (Approve / Reject)
  const handleUpdateLeaveStatus = (requestId: string, newStatus: 'Disetujui' | 'Ditolak') => {
    const targetReq = leaveRequests.find((r) => r.id === requestId);
    if (!targetReq) return;

    // Deduct leave quota if approved and type is Cuti Tahunan
    if (newStatus === 'Disetujui' && targetReq.type === 'Cuti Tahunan') {
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id === targetReq.employeeId) {
            const updatedQuota = Math.max(0, emp.remainingLeaveQuota - targetReq.totalDays);
            return { ...emp, remainingLeaveQuota: updatedQuota };
          }
          return emp;
        })
      );
    }

    // Update request
    setLeaveRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return {
            ...req,
            status: newStatus,
            approvedBy: `${currentEmployee.name} (${currentEmployee.systemRole === 'admin' ? 'Administrator' : currentEmployee.role})`,
            notes: newStatus === 'Disetujui' ? 'Disetujui oleh Administrator' : 'Ditolak oleh Administrator',
          };
        }
        return req;
      })
    );

    // If approved for today, also record as Izin/Sakit attendance record
    if (newStatus === 'Disetujui' && targetReq.startDate <= todayStr && targetReq.endDate >= todayStr) {
      const attendanceStatus: AttendanceStatus = targetReq.type === 'Sakit' ? 'Sakit' : 'Izin';
      const leaveAttendance: AttendanceRecord = {
        id: `att-leave-${Date.now()}`,
        employeeId: targetReq.employeeId,
        employeeName: targetReq.employeeName,
        employeeNik: targetReq.employeeNik,
        department: targetReq.department,
        date: todayStr,
        type: 'WFH',
        checkInTime: null,
        checkOutTime: null,
        status: attendanceStatus,
        notes: `Pengajuan ${targetReq.type}: ${targetReq.reason}`,
      };

      setAttendanceRecords((prev) => [
        leaveAttendance,
        ...prev.filter(r => !(r.employeeId === targetReq.employeeId && r.date === todayStr))
      ]);
    }

    showToast(`Pengajuan ${targetReq.employeeName} telah ${newStatus.toLowerCase()}!`, newStatus === 'Disetujui' ? 'success' : 'info');
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

  const handleSaveManualAttendance = (record: AttendanceRecord, isNew: boolean) => {
    if (isNew) {
      // Check if employee already has attendance recorded for that date
      const existingIndex = attendanceRecords.findIndex(
        (r) => r.employeeId === record.employeeId && r.date === record.date
      );

      if (existingIndex >= 0) {
        setAttendanceRecords((prev) =>
          prev.map((r, i) => (i === existingIndex ? { ...record, id: r.id } : r))
        );
        showToast(`Presensi untuk ${record.employeeName} pada ${record.date} berhasil diperbarui!`, 'success');
      } else {
        setAttendanceRecords((prev) => [record, ...prev]);
        showToast(`Presensi manual untuk ${record.employeeName} pada ${record.date} berhasil disimpan!`, 'success');
      }
    } else {
      // Edit existing record
      setAttendanceRecords((prev) =>
        prev.map((r) => (r.id === record.id ? record : r))
      );
      showToast(`Perubahan jam presensi ${record.employeeName} (${record.date}) berhasil disimpan!`, 'success');
    }
  };

  const handleDeleteAttendanceRecord = (recordId: string) => {
    setAttendanceRecords((prev) => prev.filter((r) => r.id !== recordId));
    showToast('Data presensi berhasil dihapus.', 'info');
  };

  // Add new employee
  const handleAddEmployee = (newEmpData: Omit<Employee, 'id'>) => {
    const newEmp: Employee = {
      ...newEmpData,
      id: `emp-${Date.now()}`,
    };
    setEmployees((prev) => [...prev, newEmp]);
    showToast(`Karyawan baru ${newEmp.name} (${newEmp.nik}) berhasil ditambahkan!`, 'success');
  };

  // Edit employee data
  const handleEditEmployee = (updatedEmp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
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

  // Delete employee
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
    if (currentEmployeeId === empId) {
      setCurrentEmployeeId(remaining[0].id);
    }
    showToast(`Data karyawan ${empToDelete?.name || ''} telah dihapus.`, 'info');
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
            updated[idx] = { ...existing, ...emp, id: existing.id };
            updatedCount++;
          }
        } else {
          updated.push(emp);
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
              onNavigateToEmployees={() => setActiveTab('karyawan')}
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
              userDistanceToOffice={userDistanceToOffice}
              isWithinOfficeRadius={isWithinOfficeRadius}
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
              onOpenManualAttendanceModal={() => handleOpenManualAttendance()}
              onEditAttendanceRecord={(record) => handleOpenManualAttendance(record)}
              onDeleteAttendanceRecord={handleDeleteAttendanceRecord}
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
              onSubmitRequest={handleSubmitLeaveRequest}
              onUpdateStatus={handleUpdateLeaveStatus}
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
          showToast('Pengaturan kantor dan aturan jam absensi berhasil diperbarui!');
        }}
      />

      {/* Manual Attendance Entry & Edit Modal */}
      <ManualAttendanceModal
        isOpen={isManualAttendanceModalOpen}
        onClose={() => {
          setIsManualAttendanceModalOpen(false);
          setEditingAttendanceRecord(null);
        }}
        employees={employees}
        initialEmployeeId={currentEmployee.id}
        initialRecord={editingAttendanceRecord}
        onSave={handleSaveManualAttendance}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">AbsensiPro</span>
            <span>• Sistem Presensi Karyawan Terintegrasi</span>
          </div>
          <div className="flex items-center gap-3">
            <span>SCBD, Jakarta Selatan</span>
            <span>•</span>
            <span>Waktu Server: WIB (UTC+7)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
