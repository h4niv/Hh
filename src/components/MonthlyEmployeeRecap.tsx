import React, { useState, useMemo, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  FileSpreadsheet, 
  Upload, 
  Trash2, 
  Users, 
  Filter, 
  UserCheck, 
  Briefcase,
  Pencil,
  Save,
  Clock,
  X,
  Table as TableIcon,
  FileText,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Info
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest, OfficeConfig, AttendanceType, AttendanceStatus } from '../types';
import * as XLSX from 'xlsx';
import ImportAttendanceModal from './ImportAttendanceModal';
import { getTodayDateString } from '../utils/geo';

interface MonthlyEmployeeRecapProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  officeConfig?: OfficeConfig;
  currentEmployee: Employee;
  initialViewMode?: ViewMode;
  onNavigateToFinalRecap?: () => void;
  onNavigateToDailyRecap?: (empId?: string) => void;
  onSaveAttendanceRecord?: (record: AttendanceRecord) => void;
  onImportAttendance?: (records: AttendanceRecord[]) => void;
  onDeleteAttendanceRecord?: (recordId: string) => void;
  onDeleteMultipleAttendanceRecords?: (recordIds: string[]) => void;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'error') => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_ABBR = ['Mgg', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

type CategoryFilter = 'ALL' | 'GTY' | 'GTT' | 'KTY' | 'KTT';
type ViewMode = 'matrix' | 'detail';

const isLeaveMatchingEmployeeAndDate = (
  l: LeaveRequest, 
  emp: Employee, 
  dateStr: string
): boolean => {
  if (!l || !emp || !dateStr) return false;

  const status = (l.status || '').trim().toLowerCase();
  const isRejected = status === 'ditolak' || status === 'rejected' || status === 'tolak';
  if (isRejected) return false;

  if (l.startDate && l.endDate) {
    if (dateStr < l.startDate || dateStr > l.endDate) return false;
  } else if (l.startDate) {
    if (dateStr !== l.startDate) return false;
  } else {
    return false;
  }

  const matchId = l.employeeId && emp.id && l.employeeId.trim() === emp.id.trim();
  const matchNik = l.employeeNik && emp.nik && l.employeeNik.trim().toLowerCase() === emp.nik.trim().toLowerCase();
  
  if (matchId || matchNik) return true;

  if (l.employeeName && emp.name) {
    const clean1 = l.employeeName.toLowerCase().replace(/[,.]/g, '').replace(/\b(s\.?pd|m\.?kom|s\.?e|m\.?si|dr|rs|prof|bapak|ibu|s\.?t|m\.?pd|s\.?kom)\b/g, '').trim();
    const clean2 = emp.name.toLowerCase().replace(/[,.]/g, '').replace(/\b(s\.?pd|m\.?kom|s\.?e|m\.?si|dr|rs|prof|bapak|ibu|s\.?t|m\.?pd|s\.?kom)\b/g, '').trim();
    if (clean1 && clean2 && (clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1))) {
      return true;
    }
  }

  return false;
};

export default function MonthlyEmployeeRecap({
  employees,
  attendanceRecords,
  leaveRequests,
  officeConfig,
  currentEmployee,
  initialViewMode,
  onNavigateToFinalRecap,
  onNavigateToDailyRecap,
  onSaveAttendanceRecord,
  onImportAttendance,
  onDeleteAttendanceRecord,
  onDeleteMultipleAttendanceRecords,
  onShowToast,
}: MonthlyEmployeeRecapProps) {
  const isAdminOrSuper = currentEmployee.systemRole === 'admin' || currentEmployee.systemRole === 'superadmin';

  // Primary View Mode: 'matrix' (Rekap Akhir / Hasil Akhir) or 'detail' (Laporan Akhir Bulanan / Rincian Pegawai)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || 'matrix');

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Category filter: GTY (default, matches 33 teachers in example image), GTT, KTY, KTT, or ALL
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('GTY');

  // Date selection: default to September 2026 or current month
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    // If today is September 2026 or near, default to 9 or current month
    const curMonth = today.getMonth() + 1;
    return curMonth;
  });
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Helper to resolve employee category
  const resolveEmployeeCategory = (emp: Employee): 'GTY' | 'GTT' | 'KTY' | 'KTT' => {
    const deptUpper = (emp.department || '').trim().toUpperCase();
    const deptLower = (emp.department || '').trim().toLowerCase();

    // 1. Department explicit indicators
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
      return 'GTT';
    }

    if (
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
      return 'KTT';
    }

    if (
      deptUpper === 'GTY' || 
      deptUpper.startsWith('GTY') || 
      deptUpper.includes(' GTY') || 
      deptUpper.includes('/GTY') ||
      deptUpper.includes('-GTY') ||
      deptUpper.includes('(GTY)') ||
      deptLower.includes('guru tetap') ||
      deptLower.includes('gty')
    ) {
      return 'GTY';
    }

    if (
      deptUpper === 'KTY' || 
      deptUpper.startsWith('KTY') || 
      deptUpper.includes(' KTY') || 
      deptUpper.includes('/KTY') || 
      deptUpper.includes('-KTY') || 
      deptUpper.includes('(KTY)') || 
      deptLower.includes('karyawan tetap') || 
      deptLower.includes('kty')
    ) {
      return 'KTY';
    }

    // 2. Role and name text
    const text = `${emp.role || ''} ${emp.name || ''}`.toLowerCase();
    if (text.includes('gtt') || text.includes('guru tidak tetap') || text.includes('honorer guru')) return 'GTT';
    if (text.includes('ktt') || text.includes('karyawan tidak tetap') || text.includes('kontrak') || text.includes('honorer')) return 'KTT';

    // 3. employmentCategory
    const cat = emp.employmentCategory?.toUpperCase()?.trim();
    if (cat === 'GTT') return 'GTT';
    if (cat === 'KTT' || cat === 'PTT') return 'KTT';
    if (cat === 'GTY') return 'GTY';
    if (cat === 'KTY') return 'KTY';

    // 4. Fallback
    if (text.includes('guru') || text.includes('pengajar') || text.includes('pendidik')) return 'GTY';
    return 'KTY';
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: employees.length, GTY: 0, GTT: 0, KTY: 0, KTT: 0 };
    employees.forEach(emp => {
      const cat = resolveEmployeeCategory(emp);
      if (counts[cat] !== undefined) counts[cat]++;
    });
    return counts;
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (selectedCategory === 'ALL') return employees;
    return employees.filter(emp => resolveEmployeeCategory(emp) === selectedCategory);
  }, [employees, selectedCategory]);

  // Selected employee ID for Detail View
  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => {
    if (!isAdminOrSuper) return currentEmployee.id;
    const gtyEmp = employees.find(e => resolveEmployeeCategory(e) === 'GTY');
    return gtyEmp?.id || employees[0]?.id || currentEmployee.id;
  });

  const handleCategoryChange = (cat: CategoryFilter) => {
    setSelectedCategory(cat);
    const emps = cat === 'ALL' ? employees : employees.filter(e => resolveEmployeeCategory(e) === cat);
    if (emps.length > 0 && !emps.some(e => e.id === selectedEmpId)) {
      setSelectedEmpId(emps[0].id);
    }
  };

  const targetEmployee = useMemo(() => {
    if (filteredEmployees.length > 0) {
      const foundInFiltered = filteredEmployees.find(e => e.id === selectedEmpId);
      if (foundInFiltered) return foundInFiltered;
      return filteredEmployees[0];
    }
    return employees.find(e => e.id === selectedEmpId) || currentEmployee;
  }, [filteredEmployees, selectedEmpId, employees, currentEmployee]);

  // Period Information: 26th of previous month to 25th of selected month
  // Example for Juni: 26 Mei s.d. 25 Juni
  // Example for September: 26 Agustus s.d. 25 September
  const periodInfo = useMemo(() => {
    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = selectedYear - 1;
    }
    const prevMonthName = MONTH_NAMES[prevMonth - 1];
    const currentMonthName = MONTH_NAMES[selectedMonth - 1];
    const periodLabel = `26 ${prevMonthName.toUpperCase()} ${prevYear} - 25 ${currentMonthName.toUpperCase()} ${selectedYear}`;
    return {
      prevMonth,
      prevYear,
      prevMonthName,
      currentMonthName,
      periodLabel,
    };
  }, [selectedMonth, selectedYear]);

  // Array of days in the period (26th of previous month to 25th of selected month)
  const periodDays = useMemo(() => {
    const daysList: {
      dateStr: string;
      dateObj: Date;
      dayNumber: string;
      dayName: string;
      dayAbbr: string;
      isWeekend: boolean;
    }[] = [];
    
    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = selectedYear - 1;
    }

    const startDate = new Date(prevYear, prevMonth - 1, 26);
    const endDate = new Date(selectedYear, selectedMonth - 1, 25);

    let curr = new Date(startDate);
    while (curr <= endDate) {
      const year = curr.getFullYear();
      const monthStr = String(curr.getMonth() + 1).padStart(2, '0');
      const dayStr = String(curr.getDate()).padStart(2, '0');
      
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const dayIndex = curr.getDay();
      const dayName = DAY_NAMES[dayIndex];
      const dayAbbr = DAY_ABBR[dayIndex];
      const isWeekend = dayIndex === 0 || dayIndex === 6;

      daysList.push({
        dateStr,
        dateObj: new Date(curr),
        dayNumber: dayStr,
        dayName,
        dayAbbr,
        isWeekend,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return daysList;
  }, [selectedMonth, selectedYear]);

  // Helper to determine day cell status for an employee
  const resolveDayCell = (emp: Employee, p: typeof periodDays[0]) => {
    if (p.isWeekend) {
      return {
        dateStr: p.dateStr,
        dayNumber: p.dayNumber,
        dayAbbr: p.dayAbbr,
        isWeekend: true,
        code: '',
        label: 'Libur Akhir Pekan',
      };
    }

    // 1. Check Leave
    const leave = leaveRequests.find(l => isLeaveMatchingEmployeeAndDate(l, emp, p.dateStr));
    
    // 2. Check Record
    const record = attendanceRecords.find(
      r => (
        (r.employeeId && r.employeeId === emp.id) ||
        (r.employeeNik && emp.nik && r.employeeNik.trim().toLowerCase() === emp.nik.trim().toLowerCase()) ||
        (r.employeeName && r.employeeName.trim().toLowerCase() === emp.name.trim().toLowerCase())
      ) && r.date === p.dateStr
    );



    let code = '';
    let label = '';

    if (leave) {
      const lType = leave.type.toLowerCase();
      if (lType.includes('sakit')) {
        code = 'S';
        label = 'Sakit';
      } else if (lType.includes('cuti')) {
        code = 'C';
        label = `Cuti (${leave.type})`;
      } else if (lType.includes('dinas')) {
        code = '0.5';
        label = 'Dinas Luar (0.5)';
      } else if (lType.includes('terlambat')) {
        code = '1';
        label = 'Terlambat';
      } else if (lType.includes('pulang awal')) {
        code = '0.5';
        label = 'Pulang Awal (0.5)';
      } else {
        code = 'i';
        label = 'Izin';
      }
    } else if (record) {
      const note = (record.notes || '').trim().toLowerCase();
      const stat = (record.status || '').trim();

      if (record.type === 'Dinas Luar' || stat === 'Dinas Luar' || note.includes('dinas')) {
        code = '0.5';
        label = 'Dinas Luar (0.5)';
      } else if (stat === 'Sakit' || note === 's') {
        code = 'S';
        label = 'Sakit';
      } else if (stat === 'Cuti' || note === 'c') {
        code = 'C';
        label = 'Cuti';
      } else if (stat === 'Terlambat' || note.includes('terlambat') || (record.hasLatePermit)) {
        code = '1';
        label = 'Terlambat';
      } else if (note === '0.5' || note.includes('setengah')) {
        code = '0.5';
        label = 'Setengah Hari (0.5)';
      } else if (stat === 'Izin' || note === 'i') {
        code = 'i';
        label = 'Izin';
      } else if (stat === 'Alpha' || stat === 'Alpa' || note === 'a') {
        code = 'A';
        label = 'Alpa (Tanpa Keterangan)';
      } else if (record.checkInTime || stat === 'Hadir Tepat Waktu' || note === '1') {
        code = record.checkInTime ? '1' : '';
        label = record.checkInTime ? 'Hadir' : 'Belum Ada Presensi';
      } else {
        code = record.checkInTime ? '1' : '';
        label = record.checkInTime ? 'Hadir' : 'Belum Ada Presensi';
      }
    } else {
      code = '';
      label = 'Belum Ada Presensi';
    }

    return {
      dateStr: p.dateStr,
      dayNumber: p.dayNumber,
      dayAbbr: p.dayAbbr,
      isWeekend: false,
      code,
      label,
      record,
      leave,
    };
  };

  // Grouped Matrix Rows matching the example image structure
  const matrixGroups = useMemo(() => {
    const groupDefinitions: {
      key: 'GTY' | 'GTT' | 'KTY' | 'KTT';
      label: string;
      codeLetter: string;
    }[] = [
      { key: 'GTY', label: 'GURU TETAP', codeLetter: 'A' },
      { key: 'GTT', label: 'GURU TIDAK TETAP', codeLetter: 'B' },
      { key: 'KTY', label: 'KARYAWAN TETAP', codeLetter: 'C' },
      { key: 'KTT', label: 'KARYAWAN TIDAK TETAP', codeLetter: 'D' },
    ];

    const activeCategories = selectedCategory === 'ALL' 
      ? groupDefinitions 
      : groupDefinitions.filter(g => g.key === selectedCategory);

    return activeCategories.map((groupDef) => {
      const emps = employees.filter(e => resolveEmployeeCategory(e) === groupDef.key);

      const rows = emps.map((emp, index) => {
        let totalA = 0;
        let totalB = 0;
        let totalC = 0;

        const dayCells = periodDays.map(p => {
          const cell = resolveDayCell(emp, p);
          if (!p.isWeekend) {
            if (cell.code === '1') {
              totalA += 1;
            } else if (cell.code === '0.5') {
              totalB += 1;
            } else if (['S', 'i', 'I', 'C', 'A'].includes(cell.code)) {
              totalC += 1;
            }
          }
          return cell;
        });

        // JUMLAH = A + (B * 0.5)
        const jumlah = totalA + (totalB * 0.5);
        // TRA = Math.round(jumlah)
        const tra = Math.round(jumlah);

        return {
          no: index + 1,
          employee: emp,
          days: dayCells,
          totalA,
          totalB,
          totalC,
          jumlah,
          tra,
        };
      });

      return {
        ...groupDef,
        rows,
      };
    }).filter(g => g.rows.length > 0 || selectedCategory === g.key);
  }, [employees, periodDays, attendanceRecords, leaveRequests, selectedCategory]);

  // Overall totals across all displayed groups
  const matrixGrandTotals = useMemo(() => {
    let grandA = 0;
    let grandB = 0;
    let grandC = 0;
    let grandJumlah = 0;
    let grandTRA = 0;

    matrixGroups.forEach(g => {
      g.rows.forEach(r => {
        grandA += r.totalA;
        grandB += r.totalB;
        grandC += r.totalC;
        grandJumlah += r.jumlah;
        grandTRA += r.tra;
      });
    });

    return {
      grandA,
      grandB,
      grandC,
      grandJumlah,
      grandTRA,
    };
  }, [matrixGroups]);

  // Detailed sheet rows for single employee
  const recapRows = useMemo(() => {
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;
    let countLatePermit = 0;
    let countEarlyPermit = 0;
    let countDinasLuar = 0;
    let countLeaveIzin = 0;
    let countLeaveSakit = 0;
    let countCuti = 0;
    let countAlpa = 0;

    const rows = periodDays.map((p, index) => {
      const record = attendanceRecords.find(
        r => (
          (r.employeeId && r.employeeId === targetEmployee.id) ||
          (r.employeeNik && r.employeeNik.trim().toLowerCase() === targetEmployee.nik.trim().toLowerCase()) ||
          (r.employeeName && r.employeeName.trim().toLowerCase() === targetEmployee.name.trim().toLowerCase())
        ) && r.date === p.dateStr
      );

      const leave = leaveRequests.find(l => isLeaveMatchingEmployeeAndDate(l, targetEmployee, p.dateStr));

      let pukulMasuk = '';
      let selisihMasuk = '';
      let statusMasuk = '';
      let pukulPulang = '';
      let selisihPulang = '';
      let statusPulang = '';
      let ket = '';

      if (p.isWeekend) {
        pukulMasuk = '';
        pukulPulang = '';
        statusMasuk = '';
        statusPulang = '';
        ket = '';
      } else {
        const isDinasLeave = Boolean(
          leave && (
            leave.type === 'Izin Dinas Luar' ||
            leave.type.toLowerCase().includes('dinas') ||
            (leave.reason && leave.reason.toLowerCase().includes('dinas luar'))
          )
        );

        const isDinasRecord = Boolean(
          record && (
            record.type === 'Dinas Luar' ||
            (record.status as string) === 'Dinas Luar' ||
            (record.notes && (
              record.notes.toLowerCase().includes('dinas luar') ||
              record.notes.toLowerCase().includes('tugas dinas') ||
              record.notes.toLowerCase().includes('[tugas dinas')
            ))
          )
        );

        const isDinas = isDinasLeave || isDinasRecord;

        if (isDinas) {
          countDinasLuar += 0.5;
          pukulMasuk = record?.checkInTime ? record.checkInTime.substring(0, 5) : '07:00';
          pukulPulang = record?.checkOutTime ? record.checkOutTime.substring(0, 5) : '15:30';
          statusMasuk = 'DINAS LUAR';
          statusPulang = 'DINAS LUAR';
          ket = 'DINAS LUAR';
        } else if (leave) {
          const lType = leave.type.toLowerCase();
          if (lType.includes('sakit')) {
            countLeaveSakit++;
            ket = 'SAKIT';
            statusMasuk = 'SAKIT';
            statusPulang = 'SAKIT';
          } else if (lType.includes('cuti')) {
            countCuti++;
            ket = leave.type.toUpperCase();
            statusMasuk = 'CUTI';
            statusPulang = 'CUTI';
          } else if (lType.includes('terlambat') || lType.includes('pulang awal')) {
            if (record && (record.checkInTime || record.checkOutTime || record.status)) {
              pukulMasuk = record.checkInTime ? record.checkInTime.substring(0, 5) : '';
              pukulPulang = record.checkOutTime ? record.checkOutTime.substring(0, 5) : '';
              statusMasuk = record.status === 'Terlambat' ? 'TERLAMBAT' : 'HADIR';
              statusPulang = 'HADIR';
              ket = lType.includes('terlambat') ? 'IZIN TERLAMBAT' : 'IZIN PULANG AWAL';
            } else {
              ket = leave.type.toUpperCase();
            }
          } else {
            countLeaveIzin++;
            ket = leave.type.toUpperCase();
            statusMasuk = 'IZIN';
            statusPulang = 'IZIN';
            pukulMasuk = '07:00';
            pukulPulang = '15:30';
          }
        } else if (record && (record.checkInTime || record.checkOutTime || record.status)) {
          pukulMasuk = record.checkInTime ? record.checkInTime.substring(0, 5) : '';
          pukulPulang = record.checkOutTime ? record.checkOutTime.substring(0, 5) : '';

          if (record.status === 'Sakit') {
            countLeaveSakit++;
            ket = 'SAKIT';
            statusMasuk = 'SAKIT';
            statusPulang = 'SAKIT';
          } else if (record.status === 'Cuti') {
            countCuti++;
            ket = 'CUTI';
            statusMasuk = 'CUTI';
            statusPulang = 'CUTI';
          } else if (record.status === 'Izin') {
            if (record.type === 'Dinas Luar' || record.notes?.toLowerCase().includes('dinas')) {
              countDinasLuar += 0.5;
              ket = 'DINAS LUAR';
              statusMasuk = 'DINAS LUAR';
              statusPulang = 'DINAS LUAR';
            } else {
              countLeaveIzin++;
              ket = 'IZIN';
              statusMasuk = 'IZIN';
              statusPulang = 'IZIN';
            }
          } else if (record.status === 'Alpha') {
            countAlpa++;
            ket = 'ALPA';
            statusMasuk = 'ALPA';
            statusPulang = 'ALPA';
          } else {
            if (record.status === 'Terlambat') {
              statusMasuk = 'TERLAMBAT';
              if (officeConfig?.workStartTime && pukulMasuk) {
                const [wH, wM] = officeConfig.workStartTime.split(':').map(Number);
                const [cH, cM] = pukulMasuk.split(':').map(Number);
                const diff = (cH * 60 + cM) - (wH * 60 + wM);
                if (diff > 0) {
                  totalLateMinutes += diff;
                  selisihMasuk = `+${diff}m`;
                }
              }
            } else if (record.status === 'Hadir Tepat Waktu') {
              statusMasuk = 'HADIR';
            }

            if (record.checkOutTime && officeConfig?.workEndTime) {
              const [wH, wM] = officeConfig.workEndTime.split(':').map(Number);
              const [cH, cM] = pukulPulang.split(':').map(Number);
              const diff = (wH * 60 + wM) - (cH * 60 + cM);
              if (diff > 15) {
                totalEarlyMinutes += diff;
                selisihPulang = `-${diff}m`;
                statusPulang = 'PULANG AWAL';
                countEarlyPermit++;
              }
            }

            ket = record.status === 'Terlambat' ? 'HADIR (TERLAMBAT)' : 'HADIR';
          }
        } else {
          pukulMasuk = '';
          pukulPulang = '';
          statusMasuk = '';
          statusPulang = '';
          ket = '';
        }
      }

      const dObj = p.dateObj;
      const displayDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

      return {
        no: index + 1,
        day: p.dayName,
        date: displayDate,
        dateStr: p.dateStr,
        isWeekend: p.isWeekend,
        pukulMasuk,
        selisihMasuk,
        statusMasuk,
        pukulPulang,
        selisihPulang,
        statusPulang,
        ket,
        recordId: record?.id,
        record,
        leave,
      };
    });

    const formatHoursMins = (totalMins: number) => {
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${hrs}:${String(mins).padStart(2, '0')}`;
    };

    return {
      rows,
      summary: {
        totalKeterlambatan: formatHoursMins(totalLateMinutes),
        totalPulangAwal: formatHoursMins(totalEarlyMinutes),
        countLatePermit,
        countEarlyPermit,
        countDinasLuar,
        countLeaveIzin,
        countLeaveSakit,
        countCuti,
        countAlpa,
      }
    };
  }, [periodDays, attendanceRecords, leaveRequests, targetEmployee, officeConfig]);

  // Export Matrix Excel with full borders and professional styling
  const handleExportMatrixExcel = () => {
    const numDays = periodDays.length;
    const totalCols = 2 + numDays + 5; // NO, NAMA, days..., A, B, C, JUMLAH, TRA

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 9pt; }
          th, td { border: 1px solid #000000; padding: 4px 6px; vertical-align: middle; }
          th { background-color: #e2e8f0; font-weight: bold; text-align: center; }
          .title { font-size: 13pt; font-weight: bold; text-align: center; border: none; padding-bottom: 2px; }
          .subtitle { font-size: 11pt; font-weight: bold; text-align: center; border: none; padding-bottom: 15px; }
          .group-header { background-color: #cbd5e1; font-weight: bold; text-align: left; }
          .total-row { background-color: #f1f5f9; font-weight: bold; text-align: center; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .sig-cell { border: none; text-align: center; vertical-align: top; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="${totalCols}" class="title">REKAP KEHADIRAN GURU dan KARYAWAN SMK TEXMACO SEMARANG</td>
          </tr>
          <tr>
            <td colspan="${totalCols}" class="subtitle">PERIODE : ${periodInfo.periodLabel}</td>
          </tr>
          <tr>
            <th rowspan="2" style="width: 35px;">NO</th>
            <th rowspan="2" style="width: 220px;">NAMA</th>
    `;

    periodDays.forEach(p => {
      const bg = p.isWeekend ? 'background-color: #cbd5e1;' : '';
      html += `<th style="width: 25px; ${bg}">${p.dayNumber}</th>`;
    });

    html += `
            <th colspan="3">KATEGORI</th>
            <th rowspan="2" style="width: 45px;">JUMLAH</th>
            <th rowspan="2" style="width: 35px;">TRA</th>
          </tr>
          <tr>
    `;

    periodDays.forEach(p => {
      const bg = p.isWeekend ? 'background-color: #cbd5e1;' : '';
      html += `<th style="${bg}">${p.dayAbbr}</th>`;
    });

    html += `
            <th>A</th>
            <th>B</th>
            <th>C</th>
          </tr>
    `;

    let grandA = 0;
    let grandB = 0;
    let grandC = 0;
    let grandJumlah = 0;
    let grandTRA = 0;

    matrixGroups.forEach(group => {
      html += `
          <tr>
            <td colspan="${totalCols}" class="group-header">${group.codeLetter}. ${group.label}</td>
          </tr>
      `;

      group.rows.forEach(r => {
        html += `
          <tr>
            <td class="text-center">${r.no}</td>
            <td class="text-left">${r.employee.name}</td>
        `;
        r.days.forEach(d => {
          const val = d.isWeekend ? '' : (d.code || '');
          const bg = d.isWeekend ? 'background-color: #e2e8f0;' : '';
          html += `<td class="text-center" style="${bg}">${val}</td>`;
        });
        const formattedJumlah = r.jumlah % 1 === 0 ? r.jumlah : r.jumlah.toFixed(1);
        html += `
            <td class="text-center">${r.totalA}</td>
            <td class="text-center">${r.totalB}</td>
            <td class="text-center">${r.totalC}</td>
            <td class="text-center" style="font-weight: bold;">${formattedJumlah}</td>
            <td class="text-center">${r.tra}</td>
          </tr>
        `;

        grandA += r.totalA;
        grandB += r.totalB;
        grandC += r.totalC;
        grandJumlah += r.jumlah;
        grandTRA += r.tra;
      });
    });

    const formattedGrandJumlah = grandJumlah % 1 === 0 ? grandJumlah : grandJumlah.toFixed(1);
    html += `
          <tr class="total-row">
            <td colspan="2" class="text-center">TOTAL</td>
    `;
    periodDays.forEach(p => {
      const bg = p.isWeekend ? 'background-color: #e2e8f0;' : '';
      html += `<td style="${bg}"></td>`;
    });
    html += `
            <td class="text-center">${grandA}</td>
            <td class="text-center">${grandB}</td>
            <td class="text-center">${grandC}</td>
            <td class="text-center">${formattedGrandJumlah}</td>
            <td class="text-center">${grandTRA}</td>
          </tr>
        </table>
        <br/><br/>
    `;

    // Signature Block
    const midCol = Math.floor(numDays / 2) + 1;
    html += `
        <table style="border: none; width: 100%;">
          <tr>
            <td colspan="2" class="sig-cell" style="text-align: left;">Waka. Sarpras dan Kepegawaian</td>
            <td colspan="${midCol}" class="sig-cell">Mengetahui :<br/>Kepala Sekolah,</td>
            <td colspan="4" class="sig-cell" style="text-align: right;">Semarang, 25 ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}<br/>Ka. Tata Usaha</td>
          </tr>
          <tr><td colspan="${totalCols}" style="border: none; height: 50px;"></td></tr>
          <tr>
            <td colspan="2" class="sig-cell" style="text-align: left; font-weight: bold; text-decoration: underline;">Kristianti, S.Pd.</td>
            <td colspan="${midCol}" class="sig-cell" style="font-weight: bold; text-decoration: underline;">Nur 'Alimah, S.Pd., M.T.</td>
            <td colspan="4" class="sig-cell" style="text-align: right; font-weight: bold; text-decoration: underline;">Edi Sugiyanto, S.Ikom.</td>
          </tr>
          <tr>
            <td colspan="2" class="sig-cell" style="text-align: left;">NIK. PO 300 210 078</td>
            <td colspan="${midCol}" class="sig-cell">NIK. PO300298020</td>
            <td colspan="4" class="sig-cell" style="text-align: right;">NIK. PO300197004</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCat = selectedCategory === 'ALL' ? 'Semua' : selectedCategory;
    a.download = `Rekap_Kehadiran_Guru_Karyawan_${safeCat}_${periodInfo.currentMonthName}_${selectedYear}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (onShowToast) {
      onShowToast(`File Excel Matriks (${safeCat}) dengan border & desain rapi berhasil diunduh!`, 'success');
    }
  };

  // Export Detail Excel for single employee with professional styling & borders
  const handleExportDetailExcel = () => {
    const totalCols = 10;
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 9pt; }
          th, td { border: 1px solid #000000; padding: 5px 8px; vertical-align: middle; }
          th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; }
          .title { font-size: 14pt; font-weight: bold; text-align: center; border: none; padding-bottom: 2px; }
          .subtitle { font-size: 12pt; font-weight: bold; text-align: center; border: none; padding-bottom: 4px; }
          .period { font-size: 10pt; font-weight: bold; text-align: center; border: none; padding-bottom: 15px; }
          .info-row { border: none; font-weight: bold; padding-bottom: 10px; }
          .section-header { background-color: #e2e8f0; font-weight: bold; text-align: left; }
          .total-row { background-color: #f1f5f9; font-weight: bold; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .sig-cell { border: none; text-align: center; vertical-align: top; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="${totalCols}" class="title">REKAP KEHADIRAN GURU / KARYAWAN</td>
          </tr>
          <tr>
            <td colspan="${totalCols}" class="subtitle">SMK TEXMACO SEMARANG</td>
          </tr>
          <tr>
            <td colspan="${totalCols}" class="period">BULAN : ${MONTH_NAMES[selectedMonth - 1].toUpperCase()} ${selectedYear}</td>
          </tr>
          <tr>
            <td colspan="4" class="info-row">NAMA PEGAWAI: ${targetEmployee.name}</td>
            <td colspan="3" class="info-row">NIK: ${targetEmployee.nik}</td>
            <td colspan="3" class="info-row">DEPARTEMEN: ${targetEmployee.department}</td>
          </tr>
          <tr>
            <th style="width: 35px;">NO</th>
            <th style="width: 80px;">HARI</th>
            <th style="width: 90px;">TANGGAL</th>
            <th style="width: 90px;">MASUK</th>
            <th style="width: 70px;">SELISIH</th>
            <th style="width: 120px;">STATUS MASUK</th>
            <th style="width: 90px;">PULANG</th>
            <th style="width: 70px;">SELISIH</th>
            <th style="width: 120px;">STATUS PULANG</th>
            <th style="width: 150px;">KETERANGAN</th>
          </tr>
    `;

    recapRows.rows.forEach(r => {
      html += `
          <tr>
            <td class="text-center">${r.no}</td>
            <td class="text-center">${r.day}</td>
            <td class="text-center">${r.date}</td>
            <td class="text-center">${r.pukulMasuk}</td>
            <td class="text-center">${r.selisihMasuk}</td>
            <td class="text-center">${r.statusMasuk}</td>
            <td class="text-center">${r.pukulPulang}</td>
            <td class="text-center">${r.selisihPulang}</td>
            <td class="text-center">${r.statusPulang}</td>
            <td class="text-left">${r.ket}</td>
          </tr>
      `;
    });

    html += `
        </table>
        <br/>
        <table style="border: 1px solid #000; width: 50%;">
          <tr><th colspan="2" class="section-header">RINGKASAN REKAPITULASI</th></tr>
          <tr><td>Total Keterlambatan</td><td style="font-weight: bold; text-align: center;">${recapRows.summary.totalKeterlambatan}</td></tr>
          <tr><td>Total Pulang Awal</td><td style="font-weight: bold; text-align: center;">${recapRows.summary.totalPulangAwal}</td></tr>
          <tr><td>Izin Datang Terlambat</td><td style="text-align: center;">${recapRows.summary.countLatePermit} kali</td></tr>
          <tr><td>Izin Pulang Awal</td><td style="text-align: center;">${recapRows.summary.countEarlyPermit} kali</td></tr>
          <tr><td>Dinas Luar</td><td style="text-align: center;">${recapRows.summary.countDinasLuar} hari</td></tr>
          <tr><td>Izin (Sakit / Izin / Cuti)</td><td style="text-align: center;">${recapRows.summary.countLeaveIzin + recapRows.summary.countLeaveSakit + recapRows.summary.countCuti} hari</td></tr>
          <tr><td>Alpha (Alpa)</td><td style="text-align: center;">${recapRows.summary.countAlpa} hari</td></tr>
        </table>
        <br/><br/>
        <table style="border: none; width: 100%;">
          <tr>
            <td colspan="5" class="sig-cell" style="text-align: left;">
              Mengetahui,<br/>Kepala Sekolah
              <br/><br/><br/><br/>
              <b>Nur 'Alimah, S.Pd., M.T.</b><br/>
              NIK. PO300298020
            </td>
            <td colspan="5" class="sig-cell" style="text-align: right;">
              Semarang, 25 ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}<br/>
              Pegawai Ybs,
              <br/><br/><br/><br/>
              <b>${targetEmployee.name}</b><br/>
              NIK. ${targetEmployee.nik}
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Kehadiran_${targetEmployee.name.replace(/\s+/g, '_')}_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onShowToast) onShowToast('File Excel Rincian dengan desain profesional berhasil diunduh!', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  // Quick cell click modal state for matrix
  const [quickCellTarget, setQuickCellTarget] = useState<{
    employee: Employee;
    day: typeof periodDays[0];
    currentCode: string;
    currentRecord?: AttendanceRecord;
    currentLeave?: LeaveRequest;
  } | null>(null);

  const handleQuickStatusSet = (statusCode: '1' | '0.5' | 'S' | 'i' | 'C' | 'DL' | 'A' | 'clear') => {
    if (!quickCellTarget) return;
    const { employee, day, currentRecord } = quickCellTarget;

    if (statusCode === 'clear') {
      if (currentRecord?.id && onDeleteAttendanceRecord) {
        onDeleteAttendanceRecord(currentRecord.id);
        if (onShowToast) onShowToast(`Data presensi ${employee.name} tanggal ${day.dayNumber}/${selectedMonth} dihapus.`, 'info');
      }
      setQuickCellTarget(null);
      return;
    }

    let type: AttendanceType = 'WFO';
    let status: AttendanceStatus = 'Hadir Tepat Waktu';
    let checkIn: string | null = '07:00:00';
    let checkOut: string | null = '15:30:00';
    let notes = '';
    let lateMins: number | undefined = undefined;

    if (statusCode === '1') {
      type = 'WFO';
      status = 'Hadir Tepat Waktu';
      checkIn = '07:00:00';
      checkOut = '15:30:00';
      notes = '1';
    } else if (statusCode === '0.5') {
      type = 'WFO';
      status = 'Terlambat';
      checkIn = '08:30:00';
      checkOut = '15:30:00';
      lateMins = 90;
      notes = '0.5';
    } else if (statusCode === 'S') {
      status = 'Sakit';
      checkIn = null;
      checkOut = null;
      notes = 'Sakit';
    } else if (statusCode === 'i') {
      status = 'Izin';
      checkIn = null;
      checkOut = null;
      notes = 'Izin';
    } else if (statusCode === 'C') {
      status = 'Cuti';
      checkIn = null;
      checkOut = null;
      notes = 'Cuti';
    } else if (statusCode === 'DL') {
      type = 'Dinas Luar';
      status = 'Izin';
      checkIn = '07:00:00';
      checkOut = '15:30:00';
      notes = '[Dinas Luar] Penugasan dinas';
    } else if (statusCode === 'A') {
      status = 'Alpha';
      checkIn = null;
      checkOut = null;
      notes = 'Alpha';
    }

    const updatedRecord: AttendanceRecord = {
      id: currentRecord?.id || `att-matrix-${employee.id}-${day.dateStr}`,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeNik: employee.nik,
      department: employee.department,
      date: day.dateStr,
      type,
      status,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      lateMinutes: lateMins,
      notes,
      isManualEntry: true,
      isMonthlyRecapOnly: false,
    };

    if (onSaveAttendanceRecord) {
      onSaveAttendanceRecord(updatedRecord);
    }
    if (onShowToast) {
      onShowToast(`Presensi ${employee.name} (${day.dayNumber}/${selectedMonth}) diubah menjadi ${statusCode}!`, 'success');
    }
    setQuickCellTarget(null);
  };

  // Detailed Row Edit Modal State
  const [editingRow, setEditingRow] = useState<{
    dateStr: string;
    displayDate: string;
    dayName: string;
    recordId?: string;
    record?: AttendanceRecord;
    leave?: LeaveRequest;
    initialStatus: string;
    initialCheckIn: string;
    initialCheckOut: string;
    initialNotes: string;
    initialType: AttendanceType;
  } | null>(null);

  const [editStatus, setEditStatus] = useState<string>('Hadir Tepat Waktu');
  const [editCheckIn, setEditCheckIn] = useState<string>('');
  const [editCheckOut, setEditCheckOut] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editType, setEditType] = useState<AttendanceType>('WFO');

  const handleOpenEditModal = (row: typeof recapRows.rows[0]) => {
    const existingRec = row.record;
    let initialStatus = 'Hadir Tepat Waktu';
    let initialType: AttendanceType = existingRec?.type || 'WFO';
    let initialCheckIn = existingRec?.checkInTime ? existingRec.checkInTime.substring(0, 5) : (row.pukulMasuk || '');
    let initialCheckOut = existingRec?.checkOutTime ? existingRec.checkOutTime.substring(0, 5) : (row.pukulPulang || '');
    let initialNotes = existingRec?.notes || (row.leave ? `[Pengajuan ${row.leave.type}] ${row.leave.reason || ''}` : '');

    if (row.ket === 'DINAS LUAR' || initialType === 'Dinas Luar') {
      initialStatus = 'Dinas Luar';
      initialType = 'Dinas Luar';
    } else if (existingRec?.status) {
      initialStatus = existingRec.status;
    } else if (row.ket.includes('TERLAMBAT') || row.statusMasuk === 'TERLAMBAT') {
      initialStatus = 'Terlambat';
    } else if (row.ket.includes('IZIN')) {
      initialStatus = 'Izin';
    } else if (row.ket.includes('SAKIT')) {
      initialStatus = 'Sakit';
    } else if (row.ket.includes('CUTI')) {
      initialStatus = 'Cuti';
    } else if (row.ket === 'ALPA') {
      initialStatus = 'Alpha';
    }

    setEditingRow({
      dateStr: row.dateStr,
      displayDate: row.date,
      dayName: row.day,
      recordId: row.recordId,
      record: existingRec,
      leave: row.leave,
      initialStatus,
      initialCheckIn,
      initialCheckOut,
      initialNotes,
      initialType,
    });

    setEditStatus(initialStatus);
    setEditCheckIn(initialCheckIn);
    setEditCheckOut(initialCheckOut);
    setEditNotes(initialNotes);
    setEditType(initialType);
  };

  const handleSelectStatusPreset = (statusName: string) => {
    setEditStatus(statusName);
    if (statusName === 'Dinas Luar') {
      setEditType('Dinas Luar');
      if (!editCheckIn) setEditCheckIn('07:00');
      if (!editCheckOut) setEditCheckOut('15:30');
    } else if (statusName === 'Hadir Tepat Waktu') {
      setEditType('WFO');
      if (!editCheckIn) setEditCheckIn('06:55');
      if (!editCheckOut) setEditCheckOut('15:35');
    } else if (statusName === 'Terlambat') {
      setEditType('WFO');
      if (!editCheckIn) setEditCheckIn('07:25');
      if (!editCheckOut) setEditCheckOut('15:35');
    } else if (['Izin', 'Sakit', 'Alpha', 'Cuti'].includes(statusName)) {
      setEditCheckIn('');
      setEditCheckOut('');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    let finalLateMinutes: number | undefined = undefined;
    let finalEarlyMinutes: number | undefined = undefined;
    const finalCheckIn = editCheckIn ? (editCheckIn.length === 5 ? `${editCheckIn}:00` : editCheckIn) : null;
    const finalCheckOut = editCheckOut ? (editCheckOut.length === 5 ? `${editCheckOut}:00` : editCheckOut) : null;

    if (finalCheckIn && officeConfig?.workStartTime && editStatus !== 'Dinas Luar') {
      const [wH, wM] = officeConfig.workStartTime.split(':').map(Number);
      const [cH, cM] = editCheckIn.split(':').map(Number);
      const diff = (cH * 60 + cM) - (wH * 60 + wM);
      if (diff > 0) finalLateMinutes = diff;
    }

    if (finalCheckOut && officeConfig?.workEndTime && editStatus !== 'Dinas Luar') {
      const [wH, wM] = officeConfig.workEndTime.split(':').map(Number);
      const [cH, cM] = editCheckOut.split(':').map(Number);
      const diff = (wH * 60 + wM) - (cH * 60 + cM);
      if (diff > 15) finalEarlyMinutes = diff;
    }

    const actualType: AttendanceType = editStatus === 'Dinas Luar' ? 'Dinas Luar' : editType;
    let actualStatus: AttendanceStatus = 'Hadir Tepat Waktu';
    if (editStatus === 'Terlambat') actualStatus = 'Terlambat';
    else if (editStatus === 'Izin' || editStatus === 'Dinas Luar') actualStatus = 'Izin';
    else if (editStatus === 'Sakit') actualStatus = 'Sakit';
    else if (editStatus === 'Cuti') actualStatus = 'Cuti';
    else if (editStatus === 'Alpha') actualStatus = 'Alpha';
    else actualStatus = 'Hadir Tepat Waktu';

    const noteText = editNotes.trim();
    const finalNotes = editStatus === 'Dinas Luar' && !noteText.toLowerCase().includes('dinas')
      ? (noteText ? `[Dinas Luar] ${noteText}` : 'Dinas Luar')
      : noteText;

    const newOrUpdatedRecord: AttendanceRecord = {
      id: editingRow.recordId || editingRow.record?.id || `att-rekap-${targetEmployee.id}-${editingRow.dateStr}`,
      employeeId: targetEmployee.id,
      employeeName: targetEmployee.name,
      employeeNik: targetEmployee.nik,
      department: targetEmployee.department,
      date: editingRow.dateStr,
      type: actualType,
      status: actualStatus,
      checkInTime: finalCheckIn,
      checkOutTime: finalCheckOut,
      lateMinutes: finalLateMinutes,
      earlyMinutes: finalEarlyMinutes,
      notes: finalNotes,
      isManualEntry: true,
      isMonthlyRecapOnly: false,
    };

    if (onSaveAttendanceRecord) {
      onSaveAttendanceRecord(newOrUpdatedRecord);
    }
    if (onShowToast) {
      onShowToast(`Presensi tanggal ${editingRow.displayDate} berhasil disimpan!`, 'success');
    }
    setEditingRow(null);
  };

  const handleDeletePeriodData = () => {
    const periodDateStrs = new Set(periodDays.map(d => d.dateStr));
    
    // Find all attendance records matching filtered employees and period dates (matching ID, NIK, or Name)
    const recordsToDelete = attendanceRecords.filter(r => {
      if (!periodDateStrs.has(r.date)) return false;
      return filteredEmployees.some(emp => 
        (r.employeeId && r.employeeId === emp.id) ||
        (r.employeeNik && emp.nik && r.employeeNik.trim().toLowerCase() === emp.nik.trim().toLowerCase()) ||
        (r.employeeName && emp.name && r.employeeName.trim().toLowerCase() === emp.name.trim().toLowerCase())
      );
    });

    const recordIds = recordsToDelete.map(r => r.id);

    if (recordIds.length === 0) {
      if (onShowToast) {
        onShowToast(`Tidak ada data presensi untuk kategori ${selectedCategory === 'ALL' ? 'Semua' : selectedCategory} pada periode ${periodInfo.periodLabel} untuk dihapus.`, 'info');
      }
      return;
    }

    const catName = selectedCategory === 'ALL' ? 'Semua Pegawai' : `Kategori ${selectedCategory} (${filteredEmployees.length} pegawai)`;
    if (window.confirm(`Hapus ${recordIds.length} data presensi untuk ${catName} pada periode ${periodInfo.periodLabel}?`)) {
      if (onDeleteMultipleAttendanceRecords) {
        onDeleteMultipleAttendanceRecords(recordIds);
      } else if (onDeleteAttendanceRecord) {
        recordIds.forEach((id) => onDeleteAttendanceRecord(id));
      }
      if (onShowToast) {
        onShowToast(`Berhasil menghapus ${recordIds.length} data presensi (${catName}) periode ${periodInfo.periodLabel}.`, 'success');
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* View Switcher & Category Filter Top Bar (Hidden in Print) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs print:hidden space-y-4">
        
        {/* Top Header & View Mode Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Rekap Kehadiran Guru & Karyawan SMK Texmaco Semarang
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Periode 26 bulan sebelumnya s/d 25 bulan terpilih (Contoh: 26 Mei s/d 25 Juni atau 26 Agustus s/d 25 September).
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start lg:self-auto border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                if (onNavigateToFinalRecap) onNavigateToFinalRecap();
                setViewMode('matrix');
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Rekap Akhir Bulanan</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-extrabold bg-emerald-100 text-emerald-800">
                Hasil Akhir
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onNavigateToDailyRecap) onNavigateToDailyRecap();
                setViewMode('detail');
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'detail'
                  ? 'bg-white text-amber-800 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Laporan Akhir Bulanan Pegawai</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-extrabold bg-amber-100 text-amber-800">
                Data Rincian
              </span>
            </button>
          </div>
        </div>

        {/* Clear Distinction Banner Between Old Recap (Daily Details) and New Recap (Final Matrix) */}
        {viewMode === 'matrix' ? (
          <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wide shrink-0 mt-0.5">
                HASIL AKHIR REKAPITULASI
              </span>
              <div>
                <p className="font-bold text-slate-900">
                  Rekap Akhir Kehadiran Guru & Karyawan (Rekap Sekarang)
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Tabel matriks ini adalah <strong>hasil akhir akumulasi</strong> dari Rekap Presensi Harian seluruh pegawai (Periode 26 s/d 25). Merangkum kehadiran ke dalam <strong>Kategori A</strong> (Hadir Penuh), <strong>Kategori B</strong> (Setengah Hari/Parsial), <strong>Kategori C</strong> (Izin/Sakit/Alpa), <strong>JUMLAH</strong> kehadiran, dan <strong>TRA</strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onNavigateToDailyRecap) onNavigateToDailyRecap();
                setViewMode('detail');
              }}
              className="px-3 py-1.5 bg-white hover:bg-emerald-100/60 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-300 transition-colors shrink-0 cursor-pointer shadow-2xs"
            >
              Buka Laporan Akhir Bulanan Rinci &rarr;
            </button>
          </div>
        ) : (
          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-extrabold text-[10px] uppercase tracking-wide shrink-0 mt-0.5">
                DATA RINCIAN PEGAWAI
              </span>
              <div>
                <p className="font-bold text-slate-900">
                  Rekap Presensi Harian Pegawai (Rekap Bulanan Sebelumnya)
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Tabel ini mencatat <strong>rincian presensi harian per individu</strong> (jam masuk, jam pulang, akumulasi menit terlambat, pulang awal, dinas luar, cuti, sakit, dan alpa). Data presensi harian ini adalah data dasar yang menjadi sumber perhitungan untuk Rekap Akhir Bulanan.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onNavigateToFinalRecap) onNavigateToFinalRecap();
                setViewMode('matrix');
              }}
              className="px-3 py-1.5 bg-white hover:bg-amber-100/60 text-amber-800 font-bold text-xs rounded-lg border border-amber-300 transition-colors shrink-0 cursor-pointer shadow-2xs"
            >
              Buka Rekap Akhir (Hasil Matriks) &rarr;
            </button>
          </div>
        )}

        {/* Category Menu Buttons (GTY, GTT, KTY, KTT, ALL) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              Pilih Status Kepegawaian (Tampilkan Data Sesuai Pilihan)
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Total Pegawai: <strong className="text-slate-800">{employees.length}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'GTY', label: 'Menu GTY', title: 'Guru Tetap Yayasan', count: categoryCounts.GTY },
              { id: 'GTT', label: 'Menu GTT', title: 'Guru Tidak Tetap', count: categoryCounts.GTT },
              { id: 'KTY', label: 'Menu KTY', title: 'Karyawan Tetap Yayasan', count: categoryCounts.KTY },
              { id: 'KTT', label: 'Menu KTT', title: 'Karyawan Tidak Tetap', count: categoryCounts.KTT },
              { id: 'ALL', label: 'Semua Status', title: 'Seluruh Pegawai', count: categoryCounts.ALL },
            ].map((item) => {
              const isActive = selectedCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleCategoryChange(item.id as CategoryFilter)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                    isActive
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-xs font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {item.label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.count}
                    </span>
                  </div>
                  <div className={`text-[11px] truncate ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                    {item.title}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Filters & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Bulan:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {[2024, 2025, 2026, 2027, 2028].map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            {/* Employee Selector (Only in Detail View) */}
            {viewMode === 'detail' && isAdminOrSuper && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Pegawai:</span>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer max-w-[220px] truncate"
                >
                  {filteredEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.nik})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Import Excel presensi"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Excel</span>
            </button>

            {viewMode === 'matrix' ? (
              <button
                type="button"
                onClick={handleExportMatrixExcel}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Unduh file Excel Rekap Matriks persis contoh gambar"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel (Matriks)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportDetailExcel}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel (Rinci)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>

            {isAdminOrSuper && (
              <button
                type="button"
                onClick={handleDeletePeriodData}
                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title={`Hapus data presensi ${selectedCategory === 'ALL' ? 'semua pegawai' : selectedCategory} pada periode ini`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Hapus Periode Ini</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: MATRIX COLLECTIVE VIEW (MATCHES SCREENSHOT 2026-10-15 105322.png) */}
      {/* ========================================================================= */}
      {viewMode === 'matrix' && (
        <div className="space-y-4">
          
          {/* Main Matrix Document Container (Screen & Print View) */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 sm:p-6 overflow-hidden">
            
            {/* Institution Title matching screenshot */}
            <div className="text-center space-y-1 mb-4 border-b-2 border-slate-900 pb-3">
              <h1 className="text-sm sm:text-base font-extrabold tracking-wide uppercase text-slate-900 font-sans">
                REKAP KEHADIRAN GURU dan KARYAWAN  SMK TEXMACO SEMARANG
              </h1>
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
                PERIODE : {periodInfo.periodLabel}
              </h2>
            </div>

            {/* Legend & Instructions (Hidden in Print) */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 mb-3 print:hidden">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  Keterangan Simbol:
                </span>
                <span className="flex items-center gap-1"><strong className="text-slate-900 font-bold bg-white px-1.5 py-0.5 border border-slate-300 rounded font-mono">1</strong> Hadir Penuh</span>
                <span className="flex items-center gap-1"><strong className="text-purple-700 font-bold bg-white px-1.5 py-0.5 border border-slate-300 rounded font-mono">0.5</strong> Terlambat</span>
                <span className="flex items-center gap-1"><strong className="text-amber-700 font-bold bg-white px-1.5 py-0.5 border border-slate-300 rounded font-mono">S</strong> Sakit</span>
                <span className="flex items-center gap-1"><strong className="text-indigo-700 font-bold bg-white px-1.5 py-0.5 border border-slate-300 rounded font-mono">i</strong> Izin</span>
                <span className="flex items-center gap-1"><strong className="text-teal-700 font-bold bg-white px-1.5 py-0.5 border border-slate-300 rounded font-mono">C</strong> Cuti</span>
                <span className="flex items-center gap-1"><strong className="text-rose-700 font-bold bg-white px-1.5 py-0.5 border border-slate-300 rounded font-mono">A</strong> Alpa</span>
                <span className="flex items-center gap-1"><strong className="text-blue-700 font-bold bg-white px-1.5 py-0.5 border border-slate-300 rounded font-mono">DL</strong> Dinas Luar</span>
                <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-slate-700 rounded-xs inline-block"></span> Kolom Gelap: Libur Akhir Pekan (Sabtu / Minggu)</span>
              </div>
              <div className="text-slate-500 italic">
                *Klik sel hari kerja untuk mengubah status kehadiran secara langsung
              </div>
            </div>

            {/* Matrix Table with sticky columns and exact borders */}
            <div className="overflow-x-auto border-2 border-slate-900 rounded-lg max-h-[75vh]">
              <table className="w-full border-collapse text-[10px] sm:text-[11px] font-sans">
                
                {/* Headers */}
                <thead className="sticky top-0 z-20 bg-white">
                  {/* Row 1: NO, NAMA, HARI/TANGGAL, KATEGORI, JUMLAH, TRA */}
                  <tr className="border-b border-slate-900 bg-slate-50 text-slate-900 text-center font-bold">
                    <th 
                      rowSpan={2} 
                      className="sticky left-0 z-30 bg-slate-100 border-r-2 border-slate-900 p-2 w-10 min-w-[40px] text-center"
                    >
                      NO
                    </th>
                    <th 
                      rowSpan={2} 
                      className="sticky left-10 z-30 bg-slate-100 border-r-2 border-slate-900 p-2 min-w-[210px] sm:min-w-[250px] text-left uppercase"
                    >
                      NAMA
                    </th>
                    <th 
                      colSpan={periodDays.length} 
                      className="border-r-2 border-slate-900 p-1.5 text-center uppercase tracking-wider bg-slate-100"
                    >
                      HARI/TANGGAL
                    </th>
                    <th 
                      colSpan={3} 
                      className="border-r border-slate-900 p-1.5 text-center uppercase tracking-wider bg-slate-100"
                    >
                      KATEGORI
                    </th>
                    <th 
                      rowSpan={2} 
                      className="border-r border-slate-900 p-2 min-w-[55px] text-center uppercase bg-slate-100"
                    >
                      JUMLAH
                    </th>
                    <th 
                      rowSpan={2} 
                      className="p-2 min-w-[48px] text-center uppercase bg-slate-100"
                    >
                      TRA
                    </th>
                  </tr>

                  {/* Row 2: Date Numbers, Day Abbreviations, A, B, C */}
                  <tr className="border-b-2 border-slate-900 text-slate-900 text-center font-bold">
                    {periodDays.map((p) => {
                      const isSatSun = p.isWeekend;
                      return (
                        <th
                          key={p.dateStr}
                          className={`p-1 border-r border-slate-900 min-w-[28px] max-w-[34px] leading-tight ${
                            isSatSun ? 'bg-slate-700 text-white font-extrabold' : 'bg-white text-slate-900'
                          }`}
                        >
                          <div className="font-mono text-[10px]">{p.dayNumber}</div>
                          <div className="text-[9px] font-semibold">{p.dayAbbr}</div>
                        </th>
                      );
                    })}
                    <th className="p-1 border-r border-slate-900 w-8 bg-emerald-50 text-emerald-950 font-extrabold">A</th>
                    <th className="p-1 border-r border-slate-900 w-8 bg-purple-50 text-purple-950 font-extrabold">B</th>
                    <th className="p-1 border-r-2 border-slate-900 w-8 bg-amber-50 text-amber-950 font-extrabold">C</th>
                  </tr>
                </thead>

                {/* Body */}
                <tbody className="divide-y divide-slate-400">
                  {matrixGroups.map((group) => (
                    <React.Fragment key={group.key}>
                      
                      {/* Section Header: A. GURU TETAP / B. GURU TIDAK TETAP / etc. */}
                      <tr className="bg-slate-200 text-slate-900 font-extrabold text-[11px] border-y-2 border-slate-900">
                        <td 
                          colSpan={2 + periodDays.length + 5} 
                          className="px-3 py-1.5 text-left uppercase tracking-wider font-mono font-black"
                        >
                          {group.codeLetter}.  {group.label}
                        </td>
                      </tr>

                      {/* Employee Rows */}
                      {group.rows.map((row) => (
                        <tr 
                          key={row.employee.id} 
                          className="hover:bg-blue-50/40 transition-colors border-b border-slate-300"
                        >
                          {/* Col 1: NO */}
                          <td className="sticky left-0 z-10 bg-white border-r-2 border-slate-900 p-1.5 text-center font-mono font-medium text-slate-700">
                            {row.no}
                          </td>

                          {/* Col 2: NAMA */}
                          <td className="sticky left-10 z-10 bg-white border-r-2 border-slate-900 p-1.5 text-slate-900 font-medium text-left truncate flex items-center justify-between group">
                            <span 
                              className="cursor-pointer hover:text-blue-600 transition-colors"
                              onClick={() => {
                                setSelectedEmpId(row.employee.id);
                                setViewMode('detail');
                              }}
                              title="Klik untuk melihat rincian detail presensi pegawai ini"
                            >
                              {row.employee.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEmpId(row.employee.id);
                                setViewMode('detail');
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-opacity cursor-pointer print:hidden"
                              title="Lihat rincian per jam"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>

                          {/* Date Columns */}
                          {row.days.map((day) => {
                            if (day.isWeekend) {
                              return (
                                <td
                                  key={day.dateStr}
                                  className="bg-slate-700 border-r border-slate-900 select-none p-0 text-center"
                                />
                              );
                            }

                            const val = day.code;
                            return (
                              <td
                                key={day.dateStr}
                                onClick={() => {
                                  if (isAdminOrSuper) {
                                    setQuickCellTarget({
                                      employee: row.employee,
                                      day: periodDays.find(p => p.dateStr === day.dateStr)!,
                                      currentCode: val,
                                      currentRecord: day.record,
                                      currentLeave: day.leave,
                                    });
                                  }
                                }}
                                className={`border-r border-slate-900 p-1 text-center font-mono font-bold transition-all cursor-pointer select-none ${
                                  val === '1' ? 'text-slate-900 hover:bg-blue-100' :
                                  val === '0.5' ? 'bg-purple-100/70 text-purple-800' :
                                  val === 'S' ? 'bg-amber-100/70 text-amber-800' :
                                  val === 'i' || val === 'I' ? 'bg-indigo-100/70 text-indigo-800' :
                                  val === 'C' ? 'bg-teal-100/70 text-teal-800' :
                                  val === 'A' ? 'bg-rose-100/70 text-rose-800' :
                                  'text-slate-300 hover:bg-slate-100'
                                }`}
                                title={`${row.employee.name} - ${day.dayNumber}/${selectedMonth}: ${day.label}`}
                              >
                                {val || ''}
                              </td>
                            );
                          })}

                          {/* Kategori A */}
                          <td className="p-1 border-r border-slate-900 text-center font-mono font-bold bg-emerald-50/20 text-slate-900">
                            {row.totalA}
                          </td>

                          {/* Kategori B */}
                          <td className="p-1 border-r border-slate-900 text-center font-mono font-bold bg-purple-50/20 text-purple-900">
                            {row.totalB}
                          </td>

                          {/* Kategori C */}
                          <td className="p-1 border-r-2 border-slate-900 text-center font-mono font-bold bg-amber-50/20 text-amber-900">
                            {row.totalC}
                          </td>

                          {/* JUMLAH */}
                          <td className="p-1 border-r border-slate-900 text-center font-mono font-extrabold bg-blue-50/30 text-blue-900">
                            {row.jumlah % 1 === 0 ? row.jumlah : row.jumlah.toFixed(1)}
                          </td>

                          {/* TRA */}
                          <td className="p-1 text-center font-mono font-extrabold bg-slate-50 text-slate-900">
                            {row.tra}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>

                {/* Footer Total Row matching screenshot */}
                <tfoot className="sticky bottom-0 z-20 bg-slate-200 border-t-2 border-slate-900 font-extrabold">
                  <tr className="text-slate-900 text-center">
                    <td 
                      colSpan={2} 
                      className="sticky left-0 z-30 bg-slate-200 border-r-2 border-slate-900 p-2 text-center uppercase tracking-widest font-black"
                    >
                      TOTAL
                    </td>
                    <td 
                      colSpan={periodDays.length} 
                      className="border-r-2 border-slate-900 bg-slate-200"
                    />
                    <td className="p-2 border-r border-slate-900 font-mono font-black text-emerald-900 bg-emerald-100/50">
                      {matrixGrandTotals.grandA}
                    </td>
                    <td className="p-2 border-r border-slate-900 font-mono font-black text-purple-900 bg-purple-100/50">
                      {matrixGrandTotals.grandB}
                    </td>
                    <td className="p-2 border-r-2 border-slate-900 font-mono font-black text-amber-900 bg-amber-100/50">
                      {matrixGrandTotals.grandC}
                    </td>
                    <td className="p-2 border-r border-slate-900 font-mono font-black text-blue-950 bg-blue-100/70">
                      {matrixGrandTotals.grandJumlah % 1 === 0 
                        ? matrixGrandTotals.grandJumlah 
                        : matrixGrandTotals.grandJumlah.toFixed(1)}
                    </td>
                    <td className="p-2 font-mono font-black text-slate-950 bg-slate-300/80">
                      {matrixGrandTotals.grandTRA}
                    </td>
                  </tr>
                </tfoot>

              </table>
            </div>


            {/* Sign-off / Signature Section matching 1.png */}
            <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-900 font-medium print:mt-12 print:break-inside-avoid">
              {/* Left: Waka. Sarpras dan Kepegawaian */}
              <div className="space-y-16">
                <div>
                  <p className="text-slate-700">Waka. Sarpras dan Kepegawaian</p>
                </div>
                <div>
                  <p className="font-bold underline underline-offset-4 text-slate-900">Kristianti, S.Pd.</p>
                  <p className="text-[11px] text-slate-600 font-mono">NIK. PO 300 210 078</p>
                </div>
              </div>

              {/* Center: Kepala Sekolah */}
              <div className="space-y-16 text-center">
                <div>
                  <p className="text-slate-700">Mengetahui :</p>
                  <p className="font-bold text-slate-900">Kepala Sekolah,</p>
                </div>
                <div>
                  <p className="font-bold underline underline-offset-4 text-slate-900">Nur 'Alimah, S.Pd., M.T.</p>
                  <p className="text-[11px] text-slate-600 font-mono">NIK. PO300298020</p>
                </div>
              </div>

              {/* Right: Ka. Tata Usaha */}
              <div className="space-y-16 text-left md:text-right">
                <div>
                  <p className="text-slate-700">Semarang, 25 {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
                  <p className="font-bold text-slate-900 mt-0.5">Ka. Tata Usaha</p>
                </div>
                <div>
                  <p className="font-bold underline underline-offset-4 text-slate-900">Edi Sugiyanto, S.Ikom.</p>
                  <p className="text-[11px] text-slate-600 font-mono">NIK. PO300197004</p>
                </div>
              </div>
            </div>

          </div>



        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DETAILED SINGLE-EMPLOYEE SHEET (SMK TEXMACO 3.PNG FORMAT)         */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && (
        <div className="space-y-6">
          
          {/* Quick KPI Summary Badges for Target Employee */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 print:hidden">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">Keterlambatan</span>
              <span className="text-base font-bold text-rose-600 font-mono">{recapRows.summary.totalKeterlambatan} <span className="text-xs text-slate-400 font-normal">Jam</span></span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">Pulang Awal</span>
              <span className="text-base font-bold text-purple-600 font-mono">{recapRows.summary.totalPulangAwal} <span className="text-xs text-slate-400 font-normal">Jam</span></span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-800 block flex items-center gap-1">
                Dinas Luar
              </span>
              <span className="text-base font-extrabold text-blue-700 font-mono">{recapRows.summary.countDinasLuar} <span className="text-xs text-blue-600 font-normal">Hari</span></span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">Izin (Murni)</span>
              <span className="text-base font-bold text-slate-800 font-mono">{recapRows.summary.countLeaveIzin} <span className="text-xs text-slate-400 font-normal">Hari</span></span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">Sakit</span>
              <span className="text-base font-bold text-amber-600 font-mono">{recapRows.summary.countLeaveSakit} <span className="text-xs text-slate-400 font-normal">Hari</span></span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">Alpa</span>
              <span className="text-base font-bold text-rose-700 font-mono">{recapRows.summary.countAlpa} <span className="text-xs text-slate-400 font-normal">Hari</span></span>
            </div>
          </div>

          {/* Main Document View matching SMK Texmaco 3.png */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 max-w-5xl mx-auto print:border-none print:shadow-none print:p-0">
            
            {/* Header Institution Title */}
            <div className="text-center space-y-1 mb-8 border-b-2 border-slate-900 pb-6">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-wide uppercase text-slate-900">
                SMK TEXMACO SEMARANG
              </h1>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider">
                REKAPITULASI KEHADIRAN GURU / KARYAWAN
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                PERIODE: {periodInfo.periodLabel}
              </p>
            </div>

            {/* Employee Metadata Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs sm:text-sm font-medium border border-slate-300 p-4 rounded-xl bg-slate-50/70">
              <div className="space-y-1.5">
                <div className="flex">
                  <span className="w-28 text-slate-500">Nama Lengkap</span>
                  <span className="text-slate-900 font-bold">: {targetEmployee.name}</span>
                </div>
                <div className="flex">
                  <span className="w-28 text-slate-500">Nomor Induk (NIK)</span>
                  <span className="text-slate-900 font-mono">: {targetEmployee.nik}</span>
                </div>
                <div className="flex">
                  <span className="w-28 text-slate-500">Departemen</span>
                  <span className="text-slate-900">: {targetEmployee.department}</span>
                </div>
              </div>

              <div className="space-y-1.5 md:border-l md:border-slate-300 md:pl-6">
                <div className="flex">
                  <span className="w-28 text-slate-500">Jabatan / Peran</span>
                  <span className="text-slate-900 font-medium">: {targetEmployee.role}</span>
                </div>
                <div className="flex">
                  <span className="w-28 text-slate-500">Kategori</span>
                  <span className="text-slate-900 font-bold">: {resolveEmployeeCategory(targetEmployee)}</span>
                </div>
                <div className="flex">
                  <span className="w-28 text-slate-500">Jam Kerja</span>
                  <span className="text-slate-900 font-mono">: {officeConfig?.workStartTime || '07:00'} - {officeConfig?.workEndTime || '15:30'} WIB</span>
                </div>
              </div>
            </div>

            {/* Individual Table View */}
            <div className="overflow-x-auto border-2 border-slate-900 rounded-lg mb-8">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900 text-center">
                    <th rowSpan={2} className="p-2 border-r border-slate-900 w-12">NO</th>
                    <th rowSpan={2} className="p-2 border-r border-slate-900 w-24">HARI</th>
                    <th rowSpan={2} className="p-2 border-r border-slate-900 w-28">TANGGAL</th>
                    <th colSpan={3} className="p-1.5 border-r border-slate-900 bg-emerald-50">MASUK</th>
                    <th colSpan={3} className="p-1.5 border-r border-slate-900 bg-blue-50">PULANG</th>
                    <th rowSpan={2} className="p-2 bg-slate-50 min-w-[140px]">KETERANGAN</th>
                  </tr>
                  <tr className="bg-slate-50 text-[10px] sm:text-[11px] font-semibold text-slate-700 border-b border-slate-900 text-center">
                    <th className="p-1.5 border-r border-slate-900 bg-emerald-50/30">Pukul</th>
                    <th className="p-1.5 border-r border-slate-900 bg-emerald-50/30">Selisih</th>
                    <th className="p-1.5 border-r border-slate-900 bg-emerald-50/30">Status</th>
                    <th className="p-1.5 border-r border-slate-900 bg-blue-50/30">Pukul</th>
                    <th className="p-1.5 border-r border-slate-900 bg-blue-50/30">Selisih</th>
                    <th className="p-1.5 border-r border-slate-900 bg-blue-50/30">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {recapRows.rows.map((row) => (
                    <tr 
                      key={row.no}
                      className={row.isWeekend ? 'bg-slate-600 text-white font-semibold' : 'hover:bg-slate-50'}
                    >
                      <td className={`p-2 border-r border-slate-400 text-center font-mono ${row.isWeekend ? 'text-white' : 'text-slate-700'}`}>
                        {row.no}
                      </td>
                      <td className={`p-2 border-r border-slate-400 font-medium ${row.isWeekend ? 'text-white' : 'text-slate-800'}`}>
                        {row.day}
                      </td>
                      <td className={`p-2 border-r border-slate-400 font-mono text-center ${row.isWeekend ? 'text-white' : 'text-slate-800'}`}>
                        {row.date}
                      </td>

                      {row.isWeekend ? (
                        <>
                          <td colSpan={6} className="p-2 text-center font-bold tracking-wider bg-slate-600 text-white uppercase">
                            LIBUR / WEEKEND
                          </td>
                          <td className="p-2 text-center font-bold text-white bg-slate-600">
                            <div className="flex items-center justify-between px-2">
                              <span>LIBUR</span>
                              {isAdminOrSuper && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(row)}
                                  className="p-1 hover:bg-slate-500 text-slate-300 hover:text-white rounded transition-colors cursor-pointer print:hidden"
                                  title="Edit presensi akhir pekan"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 border-r border-slate-300 font-mono text-center text-slate-800">
                            {row.pukulMasuk || '-'}
                          </td>
                          <td className="p-2 border-r border-slate-300 font-mono text-center text-rose-600 font-semibold">
                            {row.selisihMasuk || ''}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-center font-semibold text-[10px]">
                            <span className={
                              row.statusMasuk === 'HADIR' ? 'text-emerald-700' :
                              row.statusMasuk === 'TERLAMBAT' ? 'text-amber-700 font-bold' :
                              row.statusMasuk === 'DINAS LUAR' ? 'text-blue-700 font-bold' : 'text-slate-500'
                            }>
                              {row.statusMasuk || '-'}
                            </span>
                          </td>
                          <td className="p-2 border-r border-slate-300 font-mono text-center text-slate-800">
                            {row.pukulPulang || '-'}
                          </td>
                          <td className="p-2 border-r border-slate-300 font-mono text-center text-blue-600">
                            {row.selisihPulang || ''}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-center font-semibold text-[10px]">
                            <span className={
                              row.statusPulang === 'PULANG AWAL' ? 'text-purple-700' :
                              row.statusPulang === 'DINAS LUAR' ? 'text-blue-700 font-bold' : 'text-slate-500'
                            }>
                              {row.statusPulang || '-'}
                            </span>
                          </td>
                          <td className="p-2 font-medium text-slate-800 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className={
                                row.ket === 'ALPA' ? 'text-rose-600 font-bold' :
                                row.ket === 'DINAS LUAR' ? 'text-blue-700 font-bold' :
                                row.ket?.includes('CUTI') || row.ket?.includes('IZIN') ? 'text-amber-700 font-bold' : ''
                              }>
                                {row.ket}
                              </span>
                              <div className="flex items-center gap-1 print:hidden">
                                {isAdminOrSuper && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(row)}
                                    className="p-1 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                    title="Edit data presensi tanggal ini"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary & Sign-off Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-300 text-xs">
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 uppercase">Rekapitulasi Total</h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Akumulasi Keterlambatan:</span>
                    <span className="font-bold font-mono text-rose-600">{recapRows.summary.totalKeterlambatan} Jam</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Akumulasi Pulang Awal:</span>
                    <span className="font-bold font-mono text-purple-600">{recapRows.summary.totalPulangAwal} Jam</span>
                  </div>
                </div>

                <h4 className="font-bold text-slate-900 uppercase pt-2">Catatan:</h4>
                <ul className="list-disc list-inside space-y-1.5 text-slate-700 pl-1">
                  <li>Total Ijin Datang Terlambat: <strong className="text-slate-900">{recapRows.summary.countLatePermit} kali</strong></li>
                  <li>Total Ijin Pulang Awal: <strong className="text-slate-900">{recapRows.summary.countEarlyPermit} kali</strong></li>
                  <li>
                    Total Dinas Luar: <strong className="text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">{recapRows.summary.countDinasLuar} hari</strong>
                  </li>
                  <li>Tidak Masuk:
                    <ul className="list-decimal list-inside pl-4 mt-0.5 space-y-0.5">
                      <li>Izin: <strong className="text-slate-900">{recapRows.summary.countLeaveIzin} hari</strong> <span className="text-slate-400 text-[10px]">(tidak termasuk dinas luar)</span></li>
                      <li>Sakit: <strong className="text-slate-900">{recapRows.summary.countLeaveSakit} hari</strong></li>
                      <li>Alpa: <strong className="text-slate-900">{recapRows.summary.countAlpa} hari</strong></li>
                    </ul>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col items-end justify-between text-right space-y-8 pt-4">
                <div>
                  <p className="text-slate-700">Semarang, 25 {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
                  <p className="font-bold text-slate-900 mt-1">Mengetahui,</p>
                  <p className="text-slate-600">Kepala SMK Texmaco Semarang</p>
                </div>
                <div className="pt-12">
                  <p className="font-bold text-slate-900 underline underline-offset-4">Drs. H. Administrator, M.Pd</p>
                  <p className="text-slate-500 text-[11px]">NIP. 19680101 199403 1 008</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Quick Cell Status Picker Modal (Matrix Mode) */}
      {quickCellTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col">
            <div className="px-5 py-3.5 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Ubah Status Presensi</h3>
                <p className="text-xs text-blue-100 truncate max-w-[240px]">
                  {quickCellTarget.employee.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickCellTarget(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">
                  {quickCellTarget.day.dayName}, {quickCellTarget.day.dayNumber} {MONTH_NAMES[selectedMonth - 1]}
                </span>
                <span className="font-mono font-bold px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800">
                  Saat ini: {quickCellTarget.currentCode || 'Belum Ada'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickStatusSet('1')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-left font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-mono">1</span>
                  <div>
                    <span className="block text-slate-900">Hadir Penuh</span>
                    <span className="text-[10px] text-slate-400 font-normal">Poin 1.0</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusSet('0.5')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50 text-left font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-mono text-[11px]">0.5</span>
                  <div>
                    <span className="block text-purple-900">Setengah Hari</span>
                    <span className="text-[10px] text-purple-600 font-normal">Poin 0.5</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusSet('S')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-left font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-mono">S</span>
                  <div>
                    <span className="block text-amber-900">Sakit</span>
                    <span className="text-[10px] text-amber-600 font-normal">Kategori C</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusSet('i')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 text-left font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-mono">i</span>
                  <div>
                    <span className="block text-indigo-900">Izin</span>
                    <span className="text-[10px] text-indigo-600 font-normal">Kategori C</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusSet('C')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-left font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-mono">C</span>
                  <div>
                    <span className="block text-teal-900">Cuti</span>
                    <span className="text-[10px] text-teal-600 font-normal">Kategori C</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusSet('DL')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-left font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center font-mono text-[10px]">DL</span>
                  <div>
                    <span className="block text-sky-900">Dinas Luar</span>
                    <span className="text-[10px] text-sky-600 font-normal">Poin 1.0</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusSet('A')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50 text-left font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center font-mono">A</span>
                  <div>
                    <span className="block text-rose-900">Alpa</span>
                    <span className="text-[10px] text-rose-600 font-normal">Tanpa Surat</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusSet('clear')}
                  className="p-2 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-100 text-left font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="w-6 h-6 rounded-lg bg-slate-300 text-slate-700 flex items-center justify-center font-mono">-</span>
                  <div>
                    <span className="block text-slate-700">Kosongkan</span>
                    <span className="text-[10px] text-slate-400 font-normal">Hapus rekaman</span>
                  </div>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmpId(quickCellTarget.employee.id);
                    setViewMode('detail');
                    setQuickCellTarget(null);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                >
                  Buka Rincian Lengkap Pegawai Ini
                </button>
                <button
                  type="button"
                  onClick={() => setQuickCellTarget(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Attendance Record Modal for Individual Detail View */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col my-8">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center font-bold">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Edit Presensi / Laporan Akhir Bulanan</h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {targetEmployee.name} • {targetEmployee.nik}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Hari & Tanggal</span>
                  <span className="text-sm font-bold text-slate-900">{editingRow.dayName}, {editingRow.displayDate}</span>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700">
                  {editingRow.dateStr}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Pilih Preset Status Kehadiran
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'Hadir Tepat Waktu', label: 'Hadir Tepat', color: 'hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700' },
                    { id: 'Terlambat', label: 'Terlambat', color: 'hover:bg-amber-50 hover:border-amber-300 text-amber-700' },
                    { id: 'Dinas Luar', label: 'Dinas Luar', color: 'hover:bg-blue-50 hover:border-blue-300 text-blue-700' },
                    { id: 'Izin', label: 'Izin', color: 'hover:bg-indigo-50 hover:border-indigo-300 text-indigo-700' },
                    { id: 'Sakit', label: 'Sakit', color: 'hover:bg-orange-50 hover:border-orange-300 text-orange-700' },
                    { id: 'Cuti', label: 'Cuti', color: 'hover:bg-teal-50 hover:border-teal-300 text-teal-700' },
                    { id: 'Alpha', label: 'Alpha', color: 'hover:bg-rose-50 hover:border-rose-300 text-rose-700' },
                  ].map((preset) => {
                    const isSelected = editStatus === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectStatusPreset(preset.id)}
                        className={`text-xs font-medium py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-2xs'
                            : `bg-white text-slate-700 border-slate-200 ${preset.color}`
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status Kehadiran</label>
                  <select
                    value={editStatus}
                    onChange={(e) => handleSelectStatusPreset(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Hadir Tepat Waktu">Hadir Tepat Waktu</option>
                    <option value="Terlambat">Terlambat</option>
                    <option value="Dinas Luar">Dinas Luar (Penugasan Luar)</option>
                    <option value="Izin">Izin</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Cuti">Cuti</option>
                    <option value="Alpha">Alpha</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Kehadiran</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as AttendanceType)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="WFO">WFO (Bekerja di Kantor/Sekolah)</option>
                    <option value="WFH">WFH (Bekerja dari Rumah)</option>
                    <option value="Dinas Luar">Dinas Luar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Jam Masuk (WIB)
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="07:00"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Kosongkan jika tidak hadir</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Jam Pulang (WIB)
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="15:30"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Kosongkan jika belum/tidak absen</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan / Catatan
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Contoh: Tugas Pengawasan Ujian, Sakit Surat Dokter, dll."
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {editStatus === 'Dinas Luar' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <span>
                    <strong>Dinas Luar:</strong> Data ini dicatat khusus sebagai <em>Dinas Luar</em> dan <strong>tidak dihitung sebagai izin/alpa</strong> pada ringkasan rekapitulasi bulanan.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Attendance Modal */}
      <ImportAttendanceModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        employees={employees}
        onImport={(records) => {
          setIsImportModalOpen(false);
          if (records.length > 0) {
            if (onImportAttendance) {
              onImportAttendance(records);
            }
            const first = records[0];
            if (first.employeeId) {
              setSelectedEmpId(first.employeeId);
            }
            if (first.date) {
              const d = new Date(first.date);
              if (!isNaN(d.getTime())) {
                const y = d.getFullYear();
                const m = d.getMonth() + 1;
                let targetMonth = m;
                let targetYear = y;
                if (d.getDate() >= 26) {
                  targetMonth = m + 1;
                  if (targetMonth > 12) {
                    targetMonth = 1;
                    targetYear = y + 1;
                  }
                }
                setSelectedMonth(targetMonth);
                setSelectedYear(targetYear);
              }
            }
          }
          if (onShowToast) {
            onShowToast(`Berhasil mengimpor ${records.length} data presensi ke rekap bulanan dan database!`, 'success');
          }
        }}
        selectedCategory={selectedCategory}
      />

    </div>
  );
}
