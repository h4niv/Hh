import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Search, 
  SlidersHorizontal, 
  Check, 
  X, 
  Info, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  UserCheck,
  Stethoscope,
  Briefcase,
  AlertTriangle,
  ArrowRight,
  LogOut,
  MousePointerClick
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest, OfficeConfig } from '../types';
import { exportSemesterReportToExcel, SemesterReportRow, SemesterExportConfig } from '../utils/exportSemesterExcel';

interface SemesterPerformanceReportProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  officeConfig?: OfficeConfig;
  currentEmployee: Employee;
  onUpdateEmployeeTmt?: (employeeId: string, newTmt: string) => void;
  onUpdateEmployeeCategory?: (employeeId: string, category: 'GTY' | 'GTT' | 'KTY' | 'KTT' | 'PTT') => void;
}

export interface DetailEventItem {
  id?: string;
  employeeName?: string;
  nik?: string;
  date: string;
  dayName: string;
  timeInfo?: string;
  metricValue: string;
  categoryLabel: string;
  statusBadge: string;
  statusColor?: 'emerald' | 'amber' | 'rose' | 'blue' | 'indigo';
  notes?: string;
}

export interface GenericDetailModalData {
  title: string;
  subtitle: string;
  employeeName?: string;
  nik?: string;
  totalText: string;
  colorTheme: 'blue' | 'amber' | 'emerald' | 'rose' | 'indigo';
  events: DetailEventItem[];
}

export default function SemesterPerformanceReport({
  employees,
  attendanceRecords,
  leaveRequests,
  officeConfig,
  currentEmployee,
  onUpdateEmployeeTmt,
}: SemesterPerformanceReportProps) {
  const isAdminOrSuper = currentEmployee.systemRole === 'admin' || currentEmployee.systemRole === 'superadmin';

  // Dynamic date helpers
  const todayObj = new Date();
  const currentCalYear = todayObj.getFullYear();
  const currentMonthIdx = todayObj.getMonth() + 1; // 1-12
  const defaultSemester = currentMonthIdx >= 7 ? 'ganjil' : 'genap';
  const defaultBaseYear = currentMonthIdx >= 7 ? currentCalYear : currentCalYear - 1;
  const defaultAcademicYear = `${defaultBaseYear}/${defaultBaseYear + 1}`;

  // Configurable School / Institution Header settings
  const [institutionName, setInstitutionName] = useState<string>(
    officeConfig?.name?.includes('SMK') ? officeConfig.name : 'SMK TEXMACO SEMARANG'
  );
  const [academicYear, setAcademicYear] = useState<string>(defaultAcademicYear);
  const [semesterType, setSemesterType] = useState<'ganjil' | 'genap'>('ganjil');
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<number>(defaultBaseYear);

  // Calculation mode: strictly late arrival minutes (requested) or combined with early departure
  const [calculationMode, setCalculationMode] = useState<'late_only' | 'late_and_early'>('late_only');
  
  // Signers Configuration
  const [cityName, setCityName] = useState<string>('Semarang');
  const [headmasterName, setHeadmasterName] = useState<string>('Drs. Jaka Sularso');
  const [headmasterNip, setHeadmasterNip] = useState<string>('19680512 199412 1 002');
  const [supervisorName, setSupervisorName] = useState<string>('Siti Nurhaliza, S.Pd.');
  const [supervisorNip, setSupervisorNip] = useState<string>('19840215 200801 2 005');

  // View & UI Options
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Semua');
  const [showPerformanceGrade, setShowPerformanceGrade] = useState<boolean>(true);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [editingTmtEmpId, setEditingTmtEmpId] = useState<string | null>(null);
  const [editingTmtValue, setEditingTmtValue] = useState<string>('');

  // Interactive Universal Date Detail Modal
  const [activeDetailModal, setActiveDetailModal] = useState<GenericDetailModalData | null>(null);
  const [modalSearchFilter, setModalSearchFilter] = useState<string>('');

  // Sorting state - default: GTY -> GTT -> KTY -> KTT, sorted by NIK
  const [sortField, setSortField] = useState<'gty_gtt_kty_ktt_nik' | 'nik' | 'name' | 'tmt' | 'totalMinutes'>('gty_gtt_kty_ktt_nik');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSortToggle = (field: 'gty_gtt_kty_ktt_nik' | 'nik' | 'name' | 'tmt' | 'totalMinutes') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'totalMinutes' ? 'desc' : 'asc');
    }
  };

  // Define months for semester
  const semesterInfo = useMemo(() => {
    if (semesterType === 'ganjil') {
      return {
        label: `JULI S.D. DESEMBER ${selectedCalendarYear}`,
        monthKeys: [
          `${selectedCalendarYear}-07`,
          `${selectedCalendarYear}-08`,
          `${selectedCalendarYear}-09`,
          `${selectedCalendarYear}-10`,
          `${selectedCalendarYear}-11`,
          `${selectedCalendarYear}-12`,
        ],
        monthLabels: ['JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'],
        shortMonthLabels: ['JUL', 'AGS', 'SEP', 'OKT', 'NOV', 'DES'],
      };
    } else {
      const year = selectedCalendarYear + 1; // e.g. 2027 for TP 2026/2027
      return {
        label: `JANUARI S.D. JUNI ${year}`,
        monthKeys: [
          `${year}-01`,
          `${year}-02`,
          `${year}-03`,
          `${year}-04`,
          `${year}-05`,
          `${year}-06`,
        ],
        monthLabels: ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI'],
        shortMonthLabels: ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN'],
      };
    }
  }, [semesterType, selectedCalendarYear]);

  // Unique departments for filter
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Parse time helper (HH:MM:SS -> minutes)
  const timeToMinutes = (timeStr?: string | null): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  // Scheduled work start time
  const scheduledStartTimeStr = officeConfig?.workStartTime || '07:00';
  const scheduledStartMinutes = timeToMinutes(scheduledStartTimeStr);

  // Format day name in Indonesian
  const getIndonesianDayName = (dateStr: string): string => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(d);
    } catch {
      return '';
    }
  };

  // Helper to determine exact category: GTY, GTT, KTY, KTT
  const resolveEmployeeCategory = (emp: {
    id?: string;
    name?: string;
    employmentCategory?: string;
    role?: string;
    department?: string;
  }): 'GTY' | 'GTT' | 'KTY' | 'KTT' => {
    const cat = emp.employmentCategory?.toUpperCase()?.trim();
    if (cat === 'GTY') return 'GTY';
    if (cat === 'GTT') return 'GTT';
    if (cat === 'KTY') return 'KTY';
    if (cat === 'KTT' || cat === 'PTT') return 'KTT';
    
    // Explicit known mock employee IDs fallback
    if (emp.id === 'emp-1' || emp.id === 'emp-3' || emp.id === 'emp-6') return 'GTY';
    if (emp.id === 'emp-7') return 'GTT';
    if (emp.id === 'emp-2' || emp.id === 'emp-4') return 'KTY';
    if (emp.id === 'emp-5') return 'KTT';

    // Keyword inferences
    const text = `${emp.role || ''} ${emp.department || ''} ${emp.name || ''}`.toLowerCase();
    if (text.includes('gtt') || text.includes('guru tidak tetap') || text.includes('honorer guru')) return 'GTT';
    if (text.includes('ktt') || text.includes('karyawan tidak tetap') || text.includes('kontrak') || text.includes('honorer')) return 'KTT';
    if (text.includes('guru') || text.includes('pengajar') || text.includes('pendidik')) return 'GTY';
    return 'KTY';
  };

  // Helper rank for priority: GTY (1, paling atas) -> GTT (2) -> KTY (3) -> KTT (4, paling bawah)
  const getCategoryRank = (emp: {
    id?: string;
    name?: string;
    employmentCategory?: string;
    role?: string;
    department?: string;
  }): number => {
    const cat = resolveEmployeeCategory(emp);
    if (cat === 'GTY') return 1; // 1: Guru Tetap Yayasan (PALING ATAS)
    if (cat === 'GTT') return 2; // 2: Dilanjutkan Guru Tidak Tetap
    if (cat === 'KTY') return 3; // 3: Selanjutnya Karyawan Tetap Yayasan
    if (cat === 'KTT') return 4; // 4: Disusul Karyawan Tidak Tetap
    return 5;
  };

  // Aggregate Data for Each Employee & Detailed Event Tracking for Every Column
  const { 
    aggregatedReportRows, 
    employeeEventsDB,
    columnTotalsEventsDB
  } = useMemo(() => {
    const empList = employees.filter(e => {
      if (!isAdminOrSuper && e.id !== currentEmployee.id) return false;
      if (selectedDepartment !== 'Semua' && e.department !== selectedDepartment) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = e.name.toLowerCase().includes(q);
        const matchNik = e.nik.toLowerCase().includes(q);
        const matchTmt = (e.tmt || '').toLowerCase().includes(q);
        const matchRole = (e.role || '').toLowerCase().includes(q);
        if (!matchName && !matchNik && !matchTmt && !matchRole) return false;
      }
      return true;
    });

    // Detailed incident database per employee
    const eventsDB: Record<string, {
      monthlyLate: Record<number, DetailEventItem[]>;
      semesterLate: DetailEventItem[];
      izin: DetailEventItem[];
      sakit: DetailEventItem[];
      dinas: DetailEventItem[];
      alpa: DetailEventItem[];
      izinTerlambat: DetailEventItem[];
      izinPulangAwal: DetailEventItem[];
    }> = {};

    // Grand totals events pool across all staff
    const totalsDB = {
      monthlyLate: {} as Record<number, DetailEventItem[]>,
      semesterLate: [] as DetailEventItem[],
      izin: [] as DetailEventItem[],
      sakit: [] as DetailEventItem[],
      dinas: [] as DetailEventItem[],
      alpa: [] as DetailEventItem[],
      izinTerlambat: [] as DetailEventItem[],
      izinPulangAwal: [] as DetailEventItem[],
    };

    for (let i = 0; i < 6; i++) {
      totalsDB.monthlyLate[i] = [];
    }

    const computedRows: SemesterReportRow[] = empList.map((emp, index) => {
      const detectedCategory = resolveEmployeeCategory(emp);

      eventsDB[emp.id] = {
        monthlyLate: {},
        semesterLate: [],
        izin: [],
        sakit: [],
        dinas: [],
        alpa: [],
        izinTerlambat: [],
        izinPulangAwal: [],
      };

      // 1. Calculate Monthly Tardiness Minutes & build detailed events
      const monthlyMinutes = semesterInfo.monthKeys.map((mKey, mIdx) => {
        const eventsForMonth: DetailEventItem[] = [];
        const dayRecordMap = new Map<string, {
          lateMins: number;
          checkIn: string;
          status: string;
          hasPermit: boolean;
          notes?: string;
        }>();

        // Check attendance records
        attendanceRecords.forEach(rec => {
          if (rec.employeeId === emp.id && rec.date.startsWith(mKey)) {
            let late = rec.lateMinutes || 0;
            if (late <= 0 && rec.status === 'Terlambat') {
              if (rec.checkInTime) {
                const checkInMins = timeToMinutes(rec.checkInTime);
                late = Math.max(0, checkInMins - scheduledStartMinutes);
              }
              if (late <= 0) late = 15;
            }

            if (calculationMode === 'late_and_early' && rec.earlyMinutes && rec.earlyMinutes > 0) {
              late += rec.earlyMinutes;
            }

            if (late > 0) {
              dayRecordMap.set(rec.date, {
                lateMins: late,
                checkIn: rec.checkInTime || scheduledStartTimeStr,
                status: rec.status,
                hasPermit: !!rec.hasLatePermit,
                notes: rec.notes || 'Terlambat masuk kerja',
              });
            }
          }
        });

        // Check approved leave requests for Izin Datang Terlambat
        leaveRequests.forEach(req => {
          if (req.employeeId === emp.id && req.status === 'Disetujui' && req.startDate.startsWith(mKey)) {
            if (req.type === 'Izin Datang Terlambat') {
              const reqLate = req.lateMinutes || 30;
              const existing = dayRecordMap.get(req.startDate);
              if (existing) {
                existing.lateMins = Math.max(existing.lateMins, reqLate);
                existing.hasPermit = true;
                if (req.notes || req.reason) existing.notes = req.reason || req.notes;
              } else {
                dayRecordMap.set(req.startDate, {
                  lateMins: reqLate,
                  checkIn: req.estimatedArrivalTime || '-',
                  status: 'Izin Terlambat Disetujui',
                  hasPermit: true,
                  notes: req.reason || 'Izin datang terlambat resmi disetujui',
                });
              }
            } else if (calculationMode === 'late_and_early' && req.type === 'Izin Pulang Awal') {
              const reqEarly = req.earlyDepartureMinutes || 30;
              const existing = dayRecordMap.get(req.startDate);
              if (existing) {
                existing.lateMins += reqEarly;
              } else {
                dayRecordMap.set(req.startDate, {
                  lateMins: reqEarly,
                  checkIn: '-',
                  status: 'Izin Pulang Awal Disetujui',
                  hasPermit: true,
                  notes: req.reason || 'Izin pulang awal',
                });
              }
            }
          }
        });

        let monthTotal = 0;
        dayRecordMap.forEach((val, dateStr) => {
          monthTotal += val.lateMins;
          const evItem: DetailEventItem = {
            id: `${emp.id}_${dateStr}`,
            employeeName: emp.name,
            nik: emp.nik,
            date: dateStr,
            dayName: getIndonesianDayName(dateStr),
            timeInfo: `Masuk: ${val.checkIn} (Jadwal ${scheduledStartTimeStr})`,
            metricValue: `${val.lateMins} Menit`,
            categoryLabel: `Keterlambatan Bulan ${semesterInfo.monthLabels[mIdx]}`,
            statusBadge: val.hasPermit ? 'Izin Disetujui' : 'Tanpa Izin Khusus',
            statusColor: val.hasPermit ? 'emerald' : 'amber',
            notes: val.notes || 'Terlambat hadir',
          };
          eventsForMonth.push(evItem);
          totalsDB.monthlyLate[mIdx].push(evItem);
          totalsDB.semesterLate.push(evItem);
        });

        eventsForMonth.sort((a, b) => a.date.localeCompare(b.date));
        eventsDB[emp.id].monthlyLate[mIdx] = eventsForMonth;
        eventsDB[emp.id].semesterLate.push(...eventsForMonth);

        return monthTotal;
      });

      eventsDB[emp.id].semesterLate.sort((a, b) => a.date.localeCompare(b.date));

      const totalMinutes = monthlyMinutes.reduce((sum, v) => sum + v, 0);

      // 2. Calculate TIDAK MASUK (HARI): IJIN, SAKIT, DINAS, ALPA
      let izinHari = 0;
      let sakitHari = 0;
      let dinasHari = 0;
      let alpaHari = 0;

      // Attendance records
      attendanceRecords.forEach(rec => {
        if (rec.employeeId === emp.id) {
          const inSemester = semesterInfo.monthKeys.some(mKey => rec.date.startsWith(mKey));
          if (inSemester) {
            const dayName = getIndonesianDayName(rec.date);

            if (rec.status === 'Izin' || rec.status === 'Cuti') {
              izinHari += 1;
              const item: DetailEventItem = {
                employeeName: emp.name,
                nik: emp.nik,
                date: rec.date,
                dayName,
                metricValue: '1 Hari',
                categoryLabel: rec.status === 'Cuti' ? 'Cuti Tahunan' : 'Izin Pribadi',
                statusBadge: 'Tercatat Izin',
                statusColor: 'blue',
                notes: rec.notes || 'Izin tidak hadir',
              };
              eventsDB[emp.id].izin.push(item);
              totalsDB.izin.push(item);
            } else if (rec.status === 'Sakit') {
              sakitHari += 1;
              const item: DetailEventItem = {
                employeeName: emp.name,
                nik: emp.nik,
                date: rec.date,
                dayName,
                metricValue: '1 Hari',
                categoryLabel: 'Sakit',
                statusBadge: 'Surat Dokter / Sakit',
                statusColor: 'emerald',
                notes: rec.notes || 'Keterangan sakit',
              };
              eventsDB[emp.id].sakit.push(item);
              totalsDB.sakit.push(item);
            } else if (rec.status === 'Alpha') {
              alpaHari += 1;
              const item: DetailEventItem = {
                employeeName: emp.name,
                nik: emp.nik,
                date: rec.date,
                dayName,
                metricValue: '1 Hari',
                categoryLabel: 'Alpa / Tanpa Keterangan',
                statusBadge: 'Tidak Hadir',
                statusColor: 'rose',
                notes: rec.notes || 'Tidak hadir tanpa pemberitahuan atau surat izin',
              };
              eventsDB[emp.id].alpa.push(item);
              totalsDB.alpa.push(item);
            }

            if (rec.type === 'Dinas Luar') {
              dinasHari += 1;
              const item: DetailEventItem = {
                employeeName: emp.name,
                nik: emp.nik,
                date: rec.date,
                dayName,
                metricValue: '1 Hari',
                categoryLabel: 'Dinas Luar',
                statusBadge: 'Tugas Dinas Disetujui',
                statusColor: 'indigo',
                notes: rec.notes || 'Perjalanan dinas / tugas sekolah',
              };
              eventsDB[emp.id].dinas.push(item);
              totalsDB.dinas.push(item);
            }
          }
        }
      });

      // Leave requests
      leaveRequests.forEach(req => {
        if (req.employeeId === emp.id && req.status === 'Disetujui') {
          const inSemester = semesterInfo.monthKeys.some(mKey => req.startDate.startsWith(mKey));
          if (inSemester) {
            const dayName = getIndonesianDayName(req.startDate);
            const count = req.totalDays || 1;

            if (
              req.type === 'Cuti Tahunan' || 
              req.type === 'Izin Pribadi' || 
              req.type === 'Keperluan Mendesak' || 
              req.type === 'Cuti Melahirkan'
            ) {
              izinHari += count;
              const item: DetailEventItem = {
                employeeName: emp.name,
                nik: emp.nik,
                date: req.endDate && req.endDate !== req.startDate ? `${req.startDate} s.d. ${req.endDate}` : req.startDate,
                dayName,
                metricValue: `${count} Hari`,
                categoryLabel: req.type,
                statusBadge: 'Permohonan Disetujui',
                statusColor: 'blue',
                notes: req.reason || 'Izin resmi disetujui pimpinan',
              };
              eventsDB[emp.id].izin.push(item);
              totalsDB.izin.push(item);
            } else if (req.type === 'Sakit') {
              sakitHari += count;
              const item: DetailEventItem = {
                employeeName: emp.name,
                nik: emp.nik,
                date: req.endDate && req.endDate !== req.startDate ? `${req.startDate} s.d. ${req.endDate}` : req.startDate,
                dayName,
                metricValue: `${count} Hari`,
                categoryLabel: 'Izin Sakit',
                statusBadge: 'Surat Dokter Terverifikasi',
                statusColor: 'emerald',
                notes: req.reason || 'Sakit dalam masa pemulihan',
              };
              eventsDB[emp.id].sakit.push(item);
              totalsDB.sakit.push(item);
            } else if (req.type === 'Izin Dinas Luar') {
              dinasHari += count;
              const item: DetailEventItem = {
                employeeName: emp.name,
                nik: emp.nik,
                date: req.endDate && req.endDate !== req.startDate ? `${req.startDate} s.d. ${req.endDate}` : req.startDate,
                dayName,
                metricValue: `${count} Hari`,
                categoryLabel: 'Dinas Luar',
                statusBadge: 'Surat Tugas Resmi',
                statusColor: 'indigo',
                notes: req.reason || 'Penugasan dinas luar instansi',
              };
              eventsDB[emp.id].dinas.push(item);
              totalsDB.dinas.push(item);
            }
          }
        }
      });

      // 3. Calculate IJIN DATANG TERLAMBAT (JUMLAH & MENIT)
      let izinTerlambatCount = 0;
      const lateDayKeys = new Set<string>();

      attendanceRecords.forEach(rec => {
        if (rec.employeeId === emp.id) {
          const inSemester = semesterInfo.monthKeys.some(mKey => rec.date.startsWith(mKey));
          if (inSemester && (rec.status === 'Terlambat' || (rec.lateMinutes && rec.lateMinutes > 0))) {
            if (!lateDayKeys.has(rec.date)) {
              lateDayKeys.add(rec.date);
              const item: DetailEventItem = {
                employeeName: emp.name,
                nik: emp.nik,
                date: rec.date,
                dayName: getIndonesianDayName(rec.date),
                timeInfo: `Datang: ${rec.checkInTime || '-'} (Jadwal: ${scheduledStartTimeStr})`,
                metricValue: `${rec.lateMinutes || 15} Menit`,
                categoryLabel: 'Izin Datang Terlambat',
                statusBadge: rec.hasLatePermit ? 'Ada Izin Resmi' : 'Terlambat Hadir',
                statusColor: rec.hasLatePermit ? 'emerald' : 'amber',
                notes: rec.notes || 'Keterlambatan jam masuk',
              };
              eventsDB[emp.id].izinTerlambat.push(item);
              totalsDB.izinTerlambat.push(item);
            }
          }
        }
      });

      leaveRequests.forEach(req => {
        if (req.employeeId === emp.id && req.status === 'Disetujui' && req.type === 'Izin Datang Terlambat') {
          const inSemester = semesterInfo.monthKeys.some(mKey => req.startDate.startsWith(mKey));
          if (inSemester && !lateDayKeys.has(req.startDate)) {
            lateDayKeys.add(req.startDate);
            const item: DetailEventItem = {
              employeeName: emp.name,
              nik: emp.nik,
              date: req.startDate,
              dayName: getIndonesianDayName(req.startDate),
              timeInfo: `Estimasi Hadir: ${req.estimatedArrivalTime || '-'}`,
              metricValue: `${req.lateMinutes || 30} Menit`,
              categoryLabel: 'Surat Izin Datang Terlambat',
              statusBadge: 'Disetujui Pimpinan',
              statusColor: 'emerald',
              notes: req.reason || 'Izin datang terlambat disetujui',
            };
            eventsDB[emp.id].izinTerlambat.push(item);
            totalsDB.izinTerlambat.push(item);
          }
        }
      });

      izinTerlambatCount = lateDayKeys.size;
      const izinTerlambatMenit = totalMinutes;

      // 4. Calculate IJIN PULANG AWAL (JUMLAH & MENIT)
      let izinPulangAwalCount = 0;
      let izinPulangAwalMenit = 0;
      const earlyDayKeys = new Set<string>();

      attendanceRecords.forEach(rec => {
        if (rec.employeeId === emp.id) {
          const inSemester = semesterInfo.monthKeys.some(mKey => rec.date.startsWith(mKey));
          if (inSemester && rec.earlyMinutes && rec.earlyMinutes > 0) {
            if (!earlyDayKeys.has(rec.date)) {
              earlyDayKeys.add(rec.date);
              izinPulangAwalMenit += rec.earlyMinutes;
              const item: DetailEventItem = {
                employeeName: emp.name,
                nik: emp.nik,
                date: rec.date,
                dayName: getIndonesianDayName(rec.date),
                timeInfo: `Pulang Lebih Awal: ${rec.checkOutTime || '-'}`,
                metricValue: `${rec.earlyMinutes} Menit`,
                categoryLabel: 'Izin Pulang Awal',
                statusBadge: 'Tercatat Pulang Awal',
                statusColor: 'indigo',
                notes: rec.notes || 'Pulang mendahului jam kerja',
              };
              eventsDB[emp.id].izinPulangAwal.push(item);
              totalsDB.izinPulangAwal.push(item);
            }
          }
        }
      });

      leaveRequests.forEach(req => {
        if (req.employeeId === emp.id && req.status === 'Disetujui' && req.type === 'Izin Pulang Awal') {
          const inSemester = semesterInfo.monthKeys.some(mKey => req.startDate.startsWith(mKey));
          if (inSemester && !earlyDayKeys.has(req.startDate)) {
            earlyDayKeys.add(req.startDate);
            const m = req.earlyDepartureMinutes || 30;
            izinPulangAwalMenit += m;
            const item: DetailEventItem = {
              employeeName: emp.name,
              nik: emp.nik,
              date: req.startDate,
              dayName: getIndonesianDayName(req.startDate),
              timeInfo: `Izin Pulang Jam: ${req.estimatedDepartureTime || '-'}`,
              metricValue: `${m} Menit`,
              categoryLabel: 'Izin Pulang Awal',
              statusBadge: 'Disetujui Pimpinan',
              statusColor: 'emerald',
              notes: req.reason || 'Izin mendesak pulang lebih awal',
            };
            eventsDB[emp.id].izinPulangAwal.push(item);
            totalsDB.izinPulangAwal.push(item);
          }
        }
      });
      izinPulangAwalCount = earlyDayKeys.size;

      // 5. Discipline & Attendance Score
      let score = 100;
      score -= alpaHari * 12;
      score -= izinHari * 1.5;
      score -= sakitHari * 0.5;
      score -= Math.min(30, totalMinutes * 0.05);
      score -= Math.min(15, izinPulangAwalMenit * 0.03);
      const performanceScore = Math.max(35, Math.min(100, Math.round(score)));

      let performanceGrade = 'A';
      if (performanceScore >= 90) performanceGrade = 'A (Sangat Baik)';
      else if (performanceScore >= 80) performanceGrade = 'B (Baik)';
      else if (performanceScore >= 70) performanceGrade = 'C (Cukup)';
      else performanceGrade = 'D (Perlu Pembinaan)';

      return {
        no: index + 1,
        id: emp.id,
        name: emp.name,
        nik: emp.nik,
        tmt: emp.tmt || '14 Juli 2008',
        employmentCategory: detectedCategory,
        monthlyMinutes,
        totalMinutes,
        izinHari,
        sakitHari,
        dinasHari,
        alpaHari,
        izinTerlambatCount,
        izinTerlambatMenit,
        izinPulangAwalCount,
        izinPulangAwalMenit,
        performanceScore,
        performanceGrade,
      };
    });

    // Sort rows: Primary = GTY -> GTT -> KTY -> KTT, Secondary = existing NIK
    const sorted = [...computedRows].sort((a, b) => {
      if (sortField === 'gty_gtt_kty_ktt_nik') {
        const rankA = getCategoryRank(a);
        const rankB = getCategoryRank(b);
        if (rankA !== rankB) {
          return sortDirection === 'asc' ? rankA - rankB : rankB - rankA;
        }
        const cmp = (a.nik || '').localeCompare(b.nik || '', undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'nik') {
        const cmp = (a.nik || '').localeCompare(b.nik || '', undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'name') {
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'tmt') {
        const cmp = (a.tmt || '').localeCompare(b.tmt || '', undefined, { numeric: true });
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'totalMinutes') {
        const cmp = a.totalMinutes - b.totalMinutes;
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      return 0;
    });

    const finalRows = sorted.map((r, i) => ({
      ...r,
      no: i + 1,
    }));

    return { 
      aggregatedReportRows: finalRows, 
      employeeEventsDB: eventsDB,
      columnTotalsEventsDB: totalsDB,
    };
  }, [
    employees, 
    attendanceRecords, 
    leaveRequests, 
    semesterInfo, 
    isAdminOrSuper, 
    currentEmployee.id, 
    selectedDepartment, 
    searchQuery,
    scheduledStartMinutes,
    scheduledStartTimeStr,
    calculationMode,
    sortField,
    sortDirection
  ]);

  // Overall Totals
  const totals = useMemo(() => {
    const monthlySum = [0, 0, 0, 0, 0, 0];
    let grandMinutes = 0;
    let sumIzin = 0;
    let sumSakit = 0;
    let sumDinas = 0;
    let sumAlpa = 0;
    let sumLateCount = 0;
    let sumLateMins = 0;
    let sumEarlyCount = 0;
    let sumEarlyMins = 0;

    aggregatedReportRows.forEach(r => {
      for (let i = 0; i < 6; i++) {
        monthlySum[i] += r.monthlyMinutes[i];
      }
      grandMinutes += r.totalMinutes;
      sumIzin += r.izinHari;
      sumSakit += r.sakitHari;
      sumDinas += r.dinasHari;
      sumAlpa += r.alpaHari;
      sumLateCount += r.izinTerlambatCount;
      sumLateMins += r.izinTerlambatMenit;
      sumEarlyCount += r.izinPulangAwalCount;
      sumEarlyMins += r.izinPulangAwalMenit;
    });

    return {
      monthlySum,
      grandMinutes,
      sumIzin,
      sumSakit,
      sumDinas,
      sumAlpa,
      sumLateCount,
      sumLateMins,
      sumEarlyCount,
      sumEarlyMins,
    };
  }, [aggregatedReportRows]);

  // Helper Modal Openers for Any Clickable Number
  const openMonthDetail = (row: SemesterReportRow, mIdx: number) => {
    const events = employeeEventsDB[row.id]?.monthlyLate[mIdx] || [];
    const mins = row.monthlyMinutes[mIdx];
    if (mins <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rincian Keterlambatan: ${row.name}`,
      subtitle: `Periode: Bulan ${semesterInfo.monthLabels[mIdx]} ${selectedCalendarYear}`,
      employeeName: row.name,
      nik: row.nik,
      totalText: `Total Keterlambatan: ${mins} Menit (${events.length} kali terlambat)`,
      colorTheme: 'amber',
      events,
    });
    setModalSearchFilter('');
  };

  const openSemesterTotalDetail = (row: SemesterReportRow) => {
    const events = employeeEventsDB[row.id]?.semesterLate || [];
    if (row.totalMinutes <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Akumulasi Seluruh Keterlambatan Semester: ${row.name}`,
      subtitle: `Tahun Pelajaran ${academicYear} (${semesterInfo.label})`,
      employeeName: row.name,
      nik: row.nik,
      totalText: `Total Keterlambatan 1 Semester: ${row.totalMinutes} Menit (${events.length} insiden)`,
      colorTheme: 'amber',
      events,
    });
    setModalSearchFilter('');
  };

  const openIzinDetail = (row: SemesterReportRow) => {
    const events = employeeEventsDB[row.id]?.izin || [];
    if (row.izinHari <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rincian Tanggal Izin / Cuti: ${row.name}`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      employeeName: row.name,
      nik: row.nik,
      totalText: `Total Tidak Masuk (Izin/Cuti): ${row.izinHari} Hari (${events.length} catatan)`,
      colorTheme: 'blue',
      events,
    });
    setModalSearchFilter('');
  };

  const openSakitDetail = (row: SemesterReportRow) => {
    const events = employeeEventsDB[row.id]?.sakit || [];
    if (row.sakitHari <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rincian Tanggal Izin Sakit: ${row.name}`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      employeeName: row.name,
      nik: row.nik,
      totalText: `Total Tidak Masuk (Sakit): ${row.sakitHari} Hari (${events.length} catatan)`,
      colorTheme: 'emerald',
      events,
    });
    setModalSearchFilter('');
  };

  const openDinasDetail = (row: SemesterReportRow) => {
    const events = employeeEventsDB[row.id]?.dinas || [];
    if (row.dinasHari <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rincian Tanggal Penugasan Dinas Luar: ${row.name}`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      employeeName: row.name,
      nik: row.nik,
      totalText: `Total Hari Dinas Luar: ${row.dinasHari} Hari (${events.length} penugasan)`,
      colorTheme: 'indigo',
      events,
    });
    setModalSearchFilter('');
  };

  const openAlpaDetail = (row: SemesterReportRow) => {
    const events = employeeEventsDB[row.id]?.alpa || [];
    if (row.alpaHari <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rincian Tanggal Alpa (Tanpa Keterangan): ${row.name}`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      employeeName: row.name,
      nik: row.nik,
      totalText: `Total Alpa: ${row.alpaHari} Hari (${events.length} insiden tidak hadir)`,
      colorTheme: 'rose',
      events,
    });
    setModalSearchFilter('');
  };

  const openIzinTerlambatDetail = (row: SemesterReportRow) => {
    const events = employeeEventsDB[row.id]?.izinTerlambat || [];
    if (row.izinTerlambatCount <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rincian Tanggal Izin Datang Terlambat: ${row.name}`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      employeeName: row.name,
      nik: row.nik,
      totalText: `Total Pengajuan: ${row.izinTerlambatCount} Kali (Akumulasi: ${row.izinTerlambatMenit} Menit)`,
      colorTheme: 'amber',
      events,
    });
    setModalSearchFilter('');
  };

  const openIzinPulangAwalDetail = (row: SemesterReportRow) => {
    const events = employeeEventsDB[row.id]?.izinPulangAwal || [];
    if (row.izinPulangAwalCount <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rincian Tanggal Izin Pulang Awal: ${row.name}`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      employeeName: row.name,
      nik: row.nik,
      totalText: `Total Pulang Awal: ${row.izinPulangAwalCount} Kali (Akumulasi: ${row.izinPulangAwalMenit} Menit)`,
      colorTheme: 'indigo',
      events,
    });
    setModalSearchFilter('');
  };

  // Footer Grand Total Openers
  const openFooterMonthDetail = (mIdx: number) => {
    const events = columnTotalsEventsDB.monthlyLate[mIdx] || [];
    const sumVal = totals.monthlySum[mIdx];
    if (sumVal <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rekap Keterlambatan Seluruh Staf: Bulan ${semesterInfo.monthLabels[mIdx]}`,
      subtitle: `Total Keterlambatan Guru & Karyawan Periode ${semesterInfo.monthLabels[mIdx]} ${selectedCalendarYear}`,
      totalText: `Total Akumulasi Sekolah: ${sumVal} Menit (${events.length} insiden)`,
      colorTheme: 'amber',
      events,
    });
    setModalSearchFilter('');
  };

  const openFooterGrandMinutesDetail = () => {
    const events = columnTotalsEventsDB.semesterLate || [];
    if (totals.grandMinutes <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rekap Total Seluruh Keterlambatan 1 Semester`,
      subtitle: `Seluruh Guru & Karyawan ${institutionName} (${semesterInfo.label})`,
      totalText: `Grand Total Keterlambatan: ${totals.grandMinutes} Menit (${events.length} insiden terlambat)`,
      colorTheme: 'amber',
      events,
    });
    setModalSearchFilter('');
  };

  const openFooterIzinDetail = () => {
    const events = columnTotalsEventsDB.izin || [];
    if (totals.sumIzin <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rekap Seluruh Hari Izin / Cuti Staf`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      totalText: `Total Keseluruhan Izin: ${totals.sumIzin} Hari (${events.length} permohonan)`,
      colorTheme: 'blue',
      events,
    });
    setModalSearchFilter('');
  };

  const openFooterSakitDetail = () => {
    const events = columnTotalsEventsDB.sakit || [];
    if (totals.sumSakit <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rekap Seluruh Hari Sakit Staf`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      totalText: `Total Keseluruhan Sakit: ${totals.sumSakit} Hari (${events.length} catatan sakit)`,
      colorTheme: 'emerald',
      events,
    });
    setModalSearchFilter('');
  };

  const openFooterDinasDetail = () => {
    const events = columnTotalsEventsDB.dinas || [];
    if (totals.sumDinas <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rekap Seluruh Hari Dinas Luar Staf`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      totalText: `Total Hari Dinas Luar: ${totals.sumDinas} Hari (${events.length} penugasan dinas)`,
      colorTheme: 'indigo',
      events,
    });
    setModalSearchFilter('');
  };

  const openFooterAlpaDetail = () => {
    const events = columnTotalsEventsDB.alpa || [];
    if (totals.sumAlpa <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rekap Seluruh Hari Alpa (Tanpa Keterangan)`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      totalText: `Total Alpa: ${totals.sumAlpa} Hari (${events.length} insiden tidak hadir)`,
      colorTheme: 'rose',
      events,
    });
    setModalSearchFilter('');
  };

  const openFooterIzinTerlambatDetail = () => {
    const events = columnTotalsEventsDB.izinTerlambat || [];
    if (totals.sumLateCount <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rekap Seluruh Izin Datang Terlambat`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      totalText: `Total Izin Terlambat: ${totals.sumLateCount} Kali (Total: ${totals.sumLateMins} Menit)`,
      colorTheme: 'amber',
      events,
    });
    setModalSearchFilter('');
  };

  const openFooterPulangAwalDetail = () => {
    const events = columnTotalsEventsDB.izinPulangAwal || [];
    if (totals.sumEarlyCount <= 0 && events.length === 0) return;
    setActiveDetailModal({
      title: `Rekap Seluruh Izin Pulang Awal`,
      subtitle: `Periode Semester: ${semesterInfo.label}`,
      totalText: `Total Pulang Awal: ${totals.sumEarlyCount} Kali (Total: ${totals.sumEarlyMins} Menit)`,
      colorTheme: 'indigo',
      events,
    });
    setModalSearchFilter('');
  };

  // Trigger Excel Export
  const handleExportExcel = () => {
    const exportConfig: SemesterExportConfig = {
      institutionName,
      academicYear,
      periodLabel: semesterInfo.label,
      monthHeaders: semesterInfo.shortMonthLabels,
      cityName,
      headmasterName,
      headmasterNip,
      supervisorName,
      supervisorNip,
    };

    const cleanFilename = `rekap_kehadiran_${institutionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${academicYear.replace(/[^a-z0-9]/g, '-')}.xlsx`;
    exportSemesterReportToExcel(aggregatedReportRows, exportConfig, cleanFilename);
  };

  // Trigger Native Print / PDF
  const handlePrint = () => {
    window.print();
  };

  // Inline TMT save handler
  const handleSaveTmt = (empId: string) => {
    if (onUpdateEmployeeTmt && editingTmtValue.trim()) {
      onUpdateEmployeeTmt(empId, editingTmtValue.trim());
    }
    setEditingTmtEmpId(null);
  };

  // Universal Clickable Cell Number Component
  const ClickableNumberCell = ({
    value,
    onClick,
    tooltipText,
    colorStyle = 'slate',
    badge = false,
  }: {
    value: number;
    onClick: () => void;
    tooltipText: string;
    colorStyle?: 'amber' | 'blue' | 'emerald' | 'rose' | 'indigo' | 'slate';
    badge?: boolean;
  }) => {
    if (value === 0 || !value) {
      return <span className="text-slate-400 font-mono">-</span>;
    }

    const badgeClasses = {
      amber: 'bg-amber-100 text-amber-950 hover:bg-amber-200 border-amber-300',
      blue: 'bg-blue-100 text-blue-950 hover:bg-blue-200 border-blue-300',
      emerald: 'bg-emerald-100 text-emerald-950 hover:bg-emerald-200 border-emerald-300',
      rose: 'bg-rose-100 text-rose-950 hover:bg-rose-200 border-rose-300',
      indigo: 'bg-indigo-100 text-indigo-950 hover:bg-indigo-200 border-indigo-300',
      slate: 'bg-slate-100 text-slate-900 hover:bg-slate-200 border-slate-300',
    };

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`group inline-flex items-center justify-center font-mono font-bold px-1.5 py-0.5 rounded text-[11px] transition-all cursor-pointer select-none active:scale-95 hover:scale-105 shadow-2xs border ${
          badgeClasses[colorStyle]
        }`}
        title={`${tooltipText} — Klik untuk cek tanggal!`}
      >
        <span>{value}</span>
        <MousePointerClick className="w-2.5 h-2.5 ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  };

  // Filter events inside modal
  const filteredModalEvents = useMemo(() => {
    if (!activeDetailModal) return [];
    if (!modalSearchFilter.trim()) return activeDetailModal.events;
    const q = modalSearchFilter.toLowerCase().trim();
    return activeDetailModal.events.filter(ev => 
      ev.date.toLowerCase().includes(q) ||
      ev.dayName.toLowerCase().includes(q) ||
      (ev.employeeName || '').toLowerCase().includes(q) ||
      (ev.notes || '').toLowerCase().includes(q) ||
      ev.categoryLabel.toLowerCase().includes(q) ||
      ev.statusBadge.toLowerCase().includes(q)
    );
  }, [activeDetailModal, modalSearchFilter]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control Toolbar (Hidden in Print) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Laporan Penilaian Kinerja Kehadiran Semester
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                GTY ➔ GTT ➔ KTY ➔ KTT (Urut NIK)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-800 rounded-md font-semibold border border-blue-200">
                <MousePointerClick className="w-3.5 h-3.5 text-blue-600" />
                Semua angka pada tabel dapat diklik untuk cek tanggal & riwayatnya
              </span>
              <p className="text-xs text-slate-500">
                Urutan: <strong>GTY</strong> (atas), dilanjutkan <strong>GTT</strong>, disusul <strong>KTY</strong> dan <strong>KTT</strong>.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Atur Nama Sekolah, Kota, dan Pejabat Penandatangan"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Kustomisasi Kop & TTD</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="Cetak format cetak A4 landscape atau Simpan ke PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="Unduh berkas Excel .xlsx sesuai susunan GTY, GTT, KTY, KTT dan NIK"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          
          {/* Semester Selector */}
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Pilihan Semester:
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSemesterType('ganjil')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                  semesterType === 'ganjil' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ganjil (Jul - Des)
              </button>
              <button
                type="button"
                onClick={() => setSemesterType('genap')}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                  semesterType === 'genap' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Genap (Jan - Jun)
              </button>
            </div>
          </div>

          {/* Academic Year Selector */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Tahun Pelajaran:
            </label>
            <select
              value={academicYear}
              onChange={(e) => {
                const val = e.target.value;
                setAcademicYear(val);
                const startYear = parseInt(val.split('/')[0]) || currentCalYear;
                setSelectedCalendarYear(startYear);
              }}
              className="w-full text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="2026/2027">2026/2027</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2024/2025">2024/2025</option>
              <option value="2023/2024">2023/2024</option>
            </select>
          </div>

          {/* Department Unit Filter */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Filter Departemen / Unit:
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full text-xs font-medium px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="Semua">Semua Guru & Karyawan</option>
              {departmentsList.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Live Search Input */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Pencarian Guru / Karyawan:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama/NIK..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Sorting Selector (Default: GTY -> GTT -> KTY -> KTT urut NIK) */}
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
              <span>Urutan Data:</span>
              <span className="text-[10px] text-emerald-700 font-bold">
                {sortField === 'gty_gtt_kty_ktt_nik' ? '✓ GTY➔GTT➔KTY➔KTT' : ''}
              </span>
            </label>
            <select
              value={`${sortField}_${sortDirection}`}
              onChange={(e) => {
                const parts = e.target.value.split('_');
                const dir = parts.pop() as 'asc' | 'desc';
                const field = parts.join('_') as 'gty_gtt_kty_ktt_nik' | 'nik' | 'name' | 'tmt' | 'totalMinutes';
                setSortField(field);
                setSortDirection(dir);
              }}
              className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50/60 text-emerald-950 shadow-2xs focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="gty_gtt_kty_ktt_nik_asc">🏆 GTY ➔ GTT ➔ KTY ➔ KTT, Urut NIK (Standar)</option>
              <option value="gty_gtt_kty_ktt_nik_desc">🔄 Kebalikan: KTT ➔ KTY ➔ GTT ➔ GTY</option>
              <option value="nik_asc">🔢 Urutkan NIK Saja (A - Z)</option>
              <option value="nik_desc">🔢 Urutkan NIK Saja (Z - A)</option>
              <option value="name_asc">👤 Urutkan Nama (A - Z)</option>
              <option value="name_desc">👤 Urutkan Nama (Z - A)</option>
              <option value="tmt_asc">📅 Urutkan TMT (Terlama ➔ Terbaru)</option>
              <option value="totalMinutes_desc">⏱️ Urutkan Keterlambatan Terbanyak</option>
              <option value="totalMinutes_asc">⏱️ Urutkan Keterlambatan Tersedikit</option>
            </select>
          </div>

        </div>

        {/* Calculation Mode & Score Column Options */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
            {/* Calculation Mode */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[11px]">Metode Hitung Bulan:</span>
              <select
                value={calculationMode}
                onChange={(e) => setCalculationMode(e.target.value as 'late_only' | 'late_and_early')}
                className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 cursor-pointer"
              >
                <option value="late_only">Hanya Menit Keterlambatan Datang (Standar)</option>
                <option value="late_and_early">Gabungan Keterlambatan + Pulang Awal</option>
              </select>
            </div>

            {/* Performance Grade Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPerformanceGrade}
                onChange={(e) => setShowPerformanceGrade(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Tampilkan Kolom Penilaian Kinerja Disiplin Kehadiran</span>
            </label>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Setiap angka di tabel dapat diklik langsung untuk memeriksa rincian tanggal, hari, & jam kedatangan/kepergian</span>
          </div>
        </div>
      </div>

      {/* Sheet Container (Clean printable canvas) */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 sm:p-6 lg:p-8 space-y-6 print:p-0 print:border-none print:shadow-none">
        
        {/* Document Header (Identical to Excel Screenshot) */}
        <div className="text-center space-y-1 border-b pb-4 border-slate-200">
          <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-900 font-sans">
            REKAP KEHADIRAN, KETERLAMBATAN DAN PULANG AWAL GURU DAN KARYAWAN {institutionName}
          </h1>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 font-sans">
            TAHUN PELAJARAN {academicYear} (PERIODE {semesterInfo.label})
          </h2>
        </div>

        {/* The Master Excel-Style Table (Clean, without status column, ordered: GTY -> GTT -> KTY -> KTT, sorted by NIK) */}
        <div className="overflow-x-auto border border-slate-700 rounded-lg">
          <table className="w-full text-center text-xs text-slate-800 border-collapse">
            
            {/* Merged Header Rows (Matching screenshot precisely) */}
            <thead className="bg-slate-100 text-slate-900 font-bold uppercase text-[11px] tracking-tight">
              {/* Header Row 1 */}
              <tr className="border-b border-slate-700">
                <th rowSpan={2} className="border-r border-slate-700 px-2 py-2.5 w-10 text-center">
                  NO
                </th>
                <th 
                  rowSpan={2} 
                  onClick={() => handleSortToggle('name')}
                  className={`border-r border-slate-700 px-4 py-2.5 min-w-[200px] text-left cursor-pointer select-none transition-colors ${
                    sortField === 'name' ? 'bg-blue-100/90 text-blue-950 font-extrabold' : 'hover:bg-slate-200'
                  }`}
                  title="Klik untuk mengurutkan berdasarkan Nama Karyawan"
                >
                  <div className="flex items-center gap-1.5">
                    <span>NAMA</span>
                    <span className="text-xs font-bold text-blue-600">
                      {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th 
                  rowSpan={2} 
                  onClick={() => handleSortToggle('nik')}
                  className={`border-r border-slate-700 px-3 py-2.5 min-w-[130px] text-center cursor-pointer select-none transition-colors ${
                    sortField === 'nik' ? 'bg-blue-100/90 text-blue-950 font-extrabold' : 'hover:bg-slate-200'
                  }`}
                  title="Klik untuk membalik urutan NIK (Menaik / Menurun)"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>NIK</span>
                    <span className="text-xs font-bold text-blue-600">
                      {sortField === 'nik' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th 
                  rowSpan={2} 
                  onClick={() => handleSortToggle('tmt')}
                  className={`border-r border-slate-700 px-3 py-2.5 min-w-[130px] text-center cursor-pointer select-none transition-colors ${
                    sortField === 'tmt' ? 'bg-blue-100/90 text-blue-950 font-extrabold' : 'hover:bg-slate-200'
                  }`}
                  title="Klik untuk mengurutkan berdasarkan TMT"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>TMT</span>
                    <span className="text-xs font-bold text-blue-600">
                      {sortField === 'tmt' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>

                {/* KETERLAMBATAN (MENIT): Spanning 6 months + JUMLAH */}
                <th colSpan={7} className="border-r border-slate-700 px-3 py-1.5 bg-slate-200/80 text-center text-slate-900 font-black">
                  {calculationMode === 'late_only' ? 'KETERLAMBATAN (MENIT)' : 'TOTAL PENGURANGAN (MENIT)'}
                </th>

                {/* TIDAK MASUK (HARI): Spanning IJIN, SAKIT, DINAS, ALPA */}
                <th colSpan={4} className="border-r border-slate-700 px-3 py-1.5 bg-slate-200/70 text-center">
                  TIDAK MASUK (HARI)
                </th>

                {/* IJIN DATANG TERLAMBAT: Spanning JUMLAH, MENIT */}
                <th colSpan={2} className="border-r border-slate-700 px-3 py-1.5 bg-amber-100/60 text-center">
                  IJIN DATANG TERLAMBAT
                </th>

                {/* IJIN PULANG AWAL: Spanning JUMLAH, MENIT */}
                <th colSpan={2} className={`px-3 py-1.5 bg-indigo-100/60 text-center ${showPerformanceGrade ? 'border-r border-slate-700' : ''}`}>
                  IJIN PULANG AWAL
                </th>

                {/* Optional Performance Grade Column */}
                {showPerformanceGrade && (
                  <th rowSpan={2} className="px-3 py-2.5 bg-blue-100/80 text-blue-900 min-w-[110px] text-center font-bold">
                    PENILAIAN KINERJA
                  </th>
                )}
              </tr>

              {/* Header Row 2 (Sub-columns) */}
              <tr className="border-b border-slate-700 bg-slate-100 text-[10px]">
                {/* 6 Months + JUMLAH */}
                {semesterInfo.shortMonthLabels.map((mLabel, idx) => (
                  <th key={idx} className="border-r border-slate-700 px-2 py-1.5 w-12 text-center font-bold">
                    {mLabel}
                  </th>
                ))}
                <th 
                  onClick={() => handleSortToggle('totalMinutes')}
                  className={`border-r border-slate-700 px-2 py-1.5 w-14 text-center font-bold cursor-pointer select-none transition-colors ${
                    sortField === 'totalMinutes' ? 'bg-amber-200 text-amber-950 font-extrabold' : 'bg-slate-200 hover:bg-slate-300'
                  }`}
                  title="Klik untuk mengurutkan berdasarkan Total Menit Keterlambatan"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>JUMLAH</span>
                    {sortField === 'totalMinutes' && (
                      <span className="text-[10px] font-bold text-amber-900">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>

                {/* TIDAK MASUK SUB-COLUMNS */}
                <th className="border-r border-slate-700 px-2 py-1.5 w-12 text-center font-bold">
                  IJIN
                </th>
                <th className="border-r border-slate-700 px-2 py-1.5 w-12 text-center font-bold">
                  SAKIT
                </th>
                <th className="border-r border-slate-700 px-2 py-1.5 w-12 text-center font-bold">
                  DINAS
                </th>
                <th className="border-r border-slate-700 px-2 py-1.5 w-12 text-center font-bold bg-rose-50 text-rose-800">
                  ALPA
                </th>

                {/* IJIN DATANG TERLAMBAT SUB-COLUMNS */}
                <th className="border-r border-slate-700 px-2 py-1.5 w-14 text-center font-bold bg-amber-50/60">
                  JUMLAH
                </th>
                <th className="border-r border-slate-700 px-2 py-1.5 w-14 text-center font-bold bg-amber-50/60">
                  MENIT
                </th>

                {/* IJIN PULANG AWAL SUB-COLUMNS */}
                <th className="border-r border-slate-700 px-2 py-1.5 w-14 text-center font-bold bg-indigo-50/60">
                  JUMLAH
                </th>
                <th className={`px-2 py-1.5 w-14 text-center font-bold bg-indigo-50/60 ${showPerformanceGrade ? 'border-r border-slate-700' : ''}`}>
                  MENIT
                </th>
              </tr>
            </thead>

            {/* Table Body Rows (Clean, without status column, ordered: GTY -> GTT -> KTY -> KTT, sorted by NIK) */}
            <tbody className="divide-y divide-slate-300">
              {aggregatedReportRows.length === 0 ? (
                <tr>
                  <td colSpan={showPerformanceGrade ? 20 : 19} className="py-12 text-center text-slate-400">
                    Tidak ada data guru atau karyawan dalam kriteria yang dipilih.
                  </td>
                </tr>
              ) : (
                aggregatedReportRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    {/* NO */}
                    <td className="border-r border-slate-400 px-2 py-2 text-center font-mono">
                      {row.no}
                    </td>

                    {/* NAMA */}
                    <td className="border-r border-slate-400 px-3 py-2 text-left font-semibold text-slate-900 whitespace-nowrap">
                      {row.name}
                    </td>

                    {/* NIK */}
                    <td className="border-r border-slate-400 px-2 py-2 font-mono text-slate-700 text-center whitespace-nowrap font-medium">
                      {row.nik}
                    </td>

                    {/* TMT (Terhitung Mulai Tanggal) */}
                    <td className="border-r border-slate-400 px-2 py-2 text-center whitespace-nowrap text-slate-700 text-[11px]">
                      {editingTmtEmpId === row.id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="text"
                            value={editingTmtValue}
                            onChange={(e) => setEditingTmtValue(e.target.value)}
                            className="w-24 text-[10px] px-1 py-0.5 border border-blue-400 rounded focus:outline-none"
                            placeholder="e.g. 20 Juli 1998"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveTmt(row.id)}
                            className="text-emerald-600 hover:text-emerald-700 p-0.5 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTmtEmpId(null)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 group">
                          <span>{row.tmt}</span>
                          {isAdminOrSuper && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTmtEmpId(row.id);
                                setEditingTmtValue(row.tmt);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 transition-opacity p-0.5 cursor-pointer print:hidden text-[10px]"
                              title="Ubah TMT"
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* MENIT: 6 Months (Clickable for detail view) */}
                    {row.monthlyMinutes.map((mins, mIdx) => (
                      <td 
                        key={mIdx} 
                        className={`border-r border-slate-400 px-2 py-2 text-center transition-colors ${
                          mins > 0 ? 'hover:bg-amber-100/80 cursor-pointer' : ''
                        }`}
                        onClick={() => mins > 0 && openMonthDetail(row, mIdx)}
                      >
                        <ClickableNumberCell
                          value={mins}
                          onClick={() => openMonthDetail(row, mIdx)}
                          tooltipText={`Keterlambatan ${row.name} Bulan ${semesterInfo.monthLabels[mIdx]}`}
                          colorStyle="amber"
                          badge
                        />
                      </td>
                    ))}

                    {/* JUMLAH MENIT KETERLAMBATAN (Clickable) */}
                    <td 
                      className={`border-r border-slate-400 px-2 py-2 text-center font-bold bg-slate-50 transition-colors ${
                        row.totalMinutes > 0 ? 'hover:bg-amber-100/80 cursor-pointer' : ''
                      }`}
                      onClick={() => row.totalMinutes > 0 && openSemesterTotalDetail(row)}
                    >
                      <ClickableNumberCell
                        value={row.totalMinutes}
                        onClick={() => openSemesterTotalDetail(row)}
                        tooltipText={`Akumulasi seluruh keterlambatan semester ${row.name}`}
                        colorStyle="amber"
                        badge
                      />
                    </td>

                    {/* TIDAK MASUK (HARI) - IJIN (Clickable) */}
                    <td 
                      className={`border-r border-slate-400 px-2 py-2 text-center transition-colors ${
                        row.izinHari > 0 ? 'hover:bg-blue-100/80 cursor-pointer' : ''
                      }`}
                      onClick={() => row.izinHari > 0 && openIzinDetail(row)}
                    >
                      <ClickableNumberCell
                        value={row.izinHari}
                        onClick={() => openIzinDetail(row)}
                        tooltipText={`Rincian tanggal izin/cuti ${row.name}`}
                        colorStyle="blue"
                        badge
                      />
                    </td>

                    {/* TIDAK MASUK (HARI) - SAKIT (Clickable) */}
                    <td 
                      className={`border-r border-slate-400 px-2 py-2 text-center transition-colors ${
                        row.sakitHari > 0 ? 'hover:bg-emerald-100/80 cursor-pointer' : ''
                      }`}
                      onClick={() => row.sakitHari > 0 && openSakitDetail(row)}
                    >
                      <ClickableNumberCell
                        value={row.sakitHari}
                        onClick={() => openSakitDetail(row)}
                        tooltipText={`Rincian tanggal sakit ${row.name}`}
                        colorStyle="emerald"
                        badge
                      />
                    </td>

                    {/* TIDAK MASUK (HARI) - DINAS (Clickable) */}
                    <td 
                      className={`border-r border-slate-400 px-2 py-2 text-center transition-colors ${
                        row.dinasHari > 0 ? 'hover:bg-indigo-100/80 cursor-pointer' : ''
                      }`}
                      onClick={() => row.dinasHari > 0 && openDinasDetail(row)}
                    >
                      <ClickableNumberCell
                        value={row.dinasHari}
                        onClick={() => openDinasDetail(row)}
                        tooltipText={`Rincian tanggal dinas luar ${row.name}`}
                        colorStyle="indigo"
                        badge
                      />
                    </td>

                    {/* TIDAK MASUK (HARI) - ALPA (Clickable) */}
                    <td 
                      className={`border-r border-slate-400 px-2 py-2 text-center bg-rose-50/30 transition-colors ${
                        row.alpaHari > 0 ? 'hover:bg-rose-100/80 cursor-pointer' : ''
                      }`}
                      onClick={() => row.alpaHari > 0 && openAlpaDetail(row)}
                    >
                      <ClickableNumberCell
                        value={row.alpaHari}
                        onClick={() => openAlpaDetail(row)}
                        tooltipText={`Rincian tanggal alpa ${row.name}`}
                        colorStyle="rose"
                        badge
                      />
                    </td>

                    {/* IJIN DATANG TERLAMBAT - JUMLAH (Clickable) */}
                    <td 
                      className={`border-r border-slate-400 px-2 py-2 text-center bg-amber-50/20 transition-colors ${
                        row.izinTerlambatCount > 0 ? 'hover:bg-amber-100/80 cursor-pointer' : ''
                      }`}
                      onClick={() => row.izinTerlambatCount > 0 && openIzinTerlambatDetail(row)}
                    >
                      <ClickableNumberCell
                        value={row.izinTerlambatCount}
                        onClick={() => openIzinTerlambatDetail(row)}
                        tooltipText={`Rincian tanggal izin terlambat ${row.name}`}
                        colorStyle="amber"
                        badge
                      />
                    </td>

                    {/* IJIN DATANG TERLAMBAT - MENIT (Clickable) */}
                    <td 
                      className={`border-r border-slate-400 px-2 py-2 text-center bg-amber-50/20 transition-colors ${
                        row.izinTerlambatMenit > 0 ? 'hover:bg-amber-100/80 cursor-pointer' : ''
                      }`}
                      onClick={() => row.izinTerlambatMenit > 0 && openIzinTerlambatDetail(row)}
                    >
                      <ClickableNumberCell
                        value={row.izinTerlambatMenit}
                        onClick={() => openIzinTerlambatDetail(row)}
                        tooltipText={`Rincian menit izin terlambat ${row.name}`}
                        colorStyle="amber"
                      />
                    </td>

                    {/* IJIN PULANG AWAL - JUMLAH (Clickable) */}
                    <td 
                      className={`border-r border-slate-400 px-2 py-2 text-center bg-indigo-50/20 transition-colors ${
                        row.izinPulangAwalCount > 0 ? 'hover:bg-indigo-100/80 cursor-pointer' : ''
                      }`}
                      onClick={() => row.izinPulangAwalCount > 0 && openIzinPulangAwalDetail(row)}
                    >
                      <ClickableNumberCell
                        value={row.izinPulangAwalCount}
                        onClick={() => openIzinPulangAwalDetail(row)}
                        tooltipText={`Rincian tanggal pulang awal ${row.name}`}
                        colorStyle="indigo"
                        badge
                      />
                    </td>

                    {/* IJIN PULANG AWAL - MENIT (Clickable) */}
                    <td 
                      className={`px-2 py-2 text-center bg-indigo-50/20 ${showPerformanceGrade ? 'border-r border-slate-400' : ''} transition-colors ${
                        row.izinPulangAwalMenit > 0 ? 'hover:bg-indigo-100/80 cursor-pointer' : ''
                      }`}
                      onClick={() => row.izinPulangAwalMenit > 0 && openIzinPulangAwalDetail(row)}
                    >
                      <ClickableNumberCell
                        value={row.izinPulangAwalMenit}
                        onClick={() => openIzinPulangAwalDetail(row)}
                        tooltipText={`Rincian menit pulang awal ${row.name}`}
                        colorStyle="indigo"
                      />
                    </td>

                    {/* Optional Performance Grade */}
                    {showPerformanceGrade && (
                      <td className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.performanceScore >= 90
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : row.performanceScore >= 80
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : row.performanceScore >= 70
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {row.performanceScore} ({row.performanceGrade.charAt(0)})
                        </span>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>

            {/* Total Row (All grand totals are also clickable to inspect all staff dates) */}
            {aggregatedReportRows.length > 0 && (
              <tfoot className="bg-slate-200/95 text-slate-950 font-black text-[11px] border-t-2 border-slate-700">
                <tr>
                  <td colSpan={4} className="border-r border-slate-700 px-4 py-2.5 text-right uppercase tracking-wider font-black">
                    TOTAL KESELURUHAN
                  </td>

                  {/* Monthly totals (Clickable) */}
                  {totals.monthlySum.map((sumVal, idx) => (
                    <td 
                      key={idx} 
                      className={`border-r border-slate-700 px-2 py-2.5 text-center font-mono ${
                        sumVal > 0 ? 'hover:bg-amber-200 cursor-pointer' : ''
                      }`}
                      onClick={() => sumVal > 0 && openFooterMonthDetail(idx)}
                    >
                      <ClickableNumberCell
                        value={sumVal}
                        onClick={() => openFooterMonthDetail(idx)}
                        tooltipText={`Rekap keterlambatan seluruh staf bulan ${semesterInfo.monthLabels[idx]}`}
                        colorStyle="amber"
                      />
                    </td>
                  ))}

                  {/* Grand total minutes (Clickable) */}
                  <td 
                    className={`border-r border-slate-700 px-2 py-2.5 text-center font-mono bg-slate-300 font-black ${
                      totals.grandMinutes > 0 ? 'hover:bg-amber-300 cursor-pointer' : ''
                    }`}
                    onClick={() => totals.grandMinutes > 0 && openFooterGrandMinutesDetail()}
                  >
                    <ClickableNumberCell
                      value={totals.grandMinutes}
                      onClick={() => openFooterGrandMinutesDetail()}
                      tooltipText="Rekap seluruh keterlambatan satu semester seluruh staf"
                      colorStyle="amber"
                    />
                  </td>

                  {/* Tidak masuk totals - IJIN (Clickable) */}
                  <td 
                    className={`border-r border-slate-700 px-2 py-2.5 text-center font-mono ${
                      totals.sumIzin > 0 ? 'hover:bg-blue-200 cursor-pointer' : ''
                    }`}
                    onClick={() => totals.sumIzin > 0 && openFooterIzinDetail()}
                  >
                    <ClickableNumberCell
                      value={totals.sumIzin}
                      onClick={() => openFooterIzinDetail()}
                      tooltipText="Rekap seluruh hari izin/cuti seluruh staf"
                      colorStyle="blue"
                    />
                  </td>

                  {/* SAKIT (Clickable) */}
                  <td 
                    className={`border-r border-slate-700 px-2 py-2.5 text-center font-mono ${
                      totals.sumSakit > 0 ? 'hover:bg-emerald-200 cursor-pointer' : ''
                    }`}
                    onClick={() => totals.sumSakit > 0 && openFooterSakitDetail()}
                  >
                    <ClickableNumberCell
                      value={totals.sumSakit}
                      onClick={() => openFooterSakitDetail()}
                      tooltipText="Rekap seluruh hari sakit seluruh staf"
                      colorStyle="emerald"
                    />
                  </td>

                  {/* DINAS (Clickable) */}
                  <td 
                    className={`border-r border-slate-700 px-2 py-2.5 text-center font-mono ${
                      totals.sumDinas > 0 ? 'hover:bg-indigo-200 cursor-pointer' : ''
                    }`}
                    onClick={() => totals.sumDinas > 0 && openFooterDinasDetail()}
                  >
                    <ClickableNumberCell
                      value={totals.sumDinas}
                      onClick={() => openFooterDinasDetail()}
                      tooltipText="Rekap seluruh tugas dinas luar staf"
                      colorStyle="indigo"
                    />
                  </td>

                  {/* ALPA (Clickable) */}
                  <td 
                    className={`border-r border-slate-700 px-2 py-2.5 text-center font-mono bg-rose-100 text-rose-950 font-bold ${
                      totals.sumAlpa > 0 ? 'hover:bg-rose-200 cursor-pointer' : ''
                    }`}
                    onClick={() => totals.sumAlpa > 0 && openFooterAlpaDetail()}
                  >
                    <ClickableNumberCell
                      value={totals.sumAlpa}
                      onClick={() => openFooterAlpaDetail()}
                      tooltipText="Rekap seluruh alpa seluruh staf"
                      colorStyle="rose"
                    />
                  </td>

                  {/* Terlambat totals (Clickable) */}
                  <td 
                    className={`border-r border-slate-700 px-2 py-2.5 text-center font-mono bg-amber-100 text-amber-950 font-bold ${
                      totals.sumLateCount > 0 ? 'hover:bg-amber-200 cursor-pointer' : ''
                    }`}
                    onClick={() => totals.sumLateCount > 0 && openFooterIzinTerlambatDetail()}
                  >
                    <ClickableNumberCell
                      value={totals.sumLateCount}
                      onClick={() => openFooterIzinTerlambatDetail()}
                      tooltipText="Rekap frekuensi izin datang terlambat seluruh staf"
                      colorStyle="amber"
                    />
                  </td>
                  <td 
                    className={`border-r border-slate-700 px-2 py-2.5 text-center font-mono bg-amber-100 text-amber-950 font-bold ${
                      totals.sumLateMins > 0 ? 'hover:bg-amber-200 cursor-pointer' : ''
                    }`}
                    onClick={() => totals.sumLateMins > 0 && openFooterIzinTerlambatDetail()}
                  >
                    <ClickableNumberCell
                      value={totals.sumLateMins}
                      onClick={() => openFooterIzinTerlambatDetail()}
                      tooltipText="Rekap akumulasi menit izin datang terlambat"
                      colorStyle="amber"
                    />
                  </td>

                  {/* Pulang Awal totals (Clickable) */}
                  <td 
                    className={`border-r border-slate-700 px-2 py-2.5 text-center font-mono bg-indigo-100 text-indigo-950 font-bold ${
                      totals.sumEarlyCount > 0 ? 'hover:bg-indigo-200 cursor-pointer' : ''
                    }`}
                    onClick={() => totals.sumEarlyCount > 0 && openFooterPulangAwalDetail()}
                  >
                    <ClickableNumberCell
                      value={totals.sumEarlyCount}
                      onClick={() => openFooterPulangAwalDetail()}
                      tooltipText="Rekap frekuensi izin pulang awal seluruh staf"
                      colorStyle="indigo"
                    />
                  </td>
                  <td 
                    className={`px-2 py-2.5 text-center font-mono bg-indigo-100 text-indigo-950 font-bold ${showPerformanceGrade ? 'border-r border-slate-700' : ''} ${
                      totals.sumEarlyMins > 0 ? 'hover:bg-indigo-200 cursor-pointer' : ''
                    }`}
                    onClick={() => totals.sumEarlyMins > 0 && openFooterPulangAwalDetail()}
                  >
                    <ClickableNumberCell
                      value={totals.sumEarlyMins}
                      onClick={() => openFooterPulangAwalDetail()}
                      tooltipText="Rekap akumulasi menit izin pulang awal"
                      colorStyle="indigo"
                    />
                  </td>

                  {showPerformanceGrade && (
                    <td className="px-2 py-2.5 text-center text-slate-500 font-normal">
                      -
                    </td>
                  )}
                </tr>
              </tfoot>
            )}

          </table>
        </div>

        {/* Official Signatures Section (Tanda Tangan Pengesahan) */}
        <div className="pt-6 grid grid-cols-2 text-center text-xs text-slate-800 gap-8">
          <div className="space-y-1">
            <p className="font-semibold">Mengetahui,</p>
            <p className="font-bold">Kepala {institutionName}</p>
            <div className="h-20" />
            <p className="font-bold underline text-slate-900">{headmasterName}</p>
            {headmasterNip && <p className="text-[11px] font-mono text-slate-600">NIP. {headmasterNip}</p>}
          </div>

          <div className="space-y-1">
            <p>{cityName}, {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p>
            <p className="font-bold">Waka. Manajemen Mutu / Kepegawaian</p>
            <div className="h-20" />
            <p className="font-bold underline text-slate-900">{supervisorName}</p>
            {supervisorNip && <p className="text-[11px] font-mono text-slate-600">NIP. {supervisorNip}</p>}
          </div>
        </div>

      </div>

      {/* Interactive Universal Date Breakdown Modal */}
      {activeDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {activeDetailModal.colorTheme === 'amber' && <Clock className="w-5 h-5 text-amber-600" />}
                  {activeDetailModal.colorTheme === 'blue' && <UserCheck className="w-5 h-5 text-blue-600" />}
                  {activeDetailModal.colorTheme === 'emerald' && <Stethoscope className="w-5 h-5 text-emerald-600" />}
                  {activeDetailModal.colorTheme === 'indigo' && <Briefcase className="w-5 h-5 text-indigo-600" />}
                  {activeDetailModal.colorTheme === 'rose' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
                  
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeDetailModal.title}
                  </h3>
                  {activeDetailModal.nik && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      NIK: {activeDetailModal.nik}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {activeDetailModal.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveDetailModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Search & Summary Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span>{activeDetailModal.totalText}</span>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearchFilter}
                  onChange={(e) => setModalSearchFilter(e.target.value)}
                  placeholder="Cari tanggal / nama / catatan..."
                  className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {modalSearchFilter && (
                  <button
                    type="button"
                    onClick={() => setModalSearchFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Event List Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl flex-1 max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="px-3 py-2 text-center w-8">No</th>
                    {filteredModalEvents.some(ev => ev.employeeName && ev.employeeName !== activeDetailModal.employeeName) && (
                      <th className="px-3 py-2">Nama Pegawai</th>
                    )}
                    <th className="px-3 py-2">Tanggal & Hari</th>
                    <th className="px-3 py-2 text-center">Waktu / Jadwal</th>
                    <th className="px-3 py-2 text-center">Durasi / Jumlah</th>
                    <th className="px-3 py-2">Status & Kategori</th>
                    <th className="px-3 py-2">Keterangan / Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredModalEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Tidak ada riwayat catatan tanggal yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredModalEvents.map((ev, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 text-center font-mono text-slate-500">{i + 1}</td>
                        {filteredModalEvents.some(item => item.employeeName && item.employeeName !== activeDetailModal.employeeName) && (
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{ev.employeeName}</div>
                            {ev.nik && <div className="text-[10px] font-mono text-slate-500">{ev.nik}</div>}
                          </td>
                        )}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-blue-500" />
                            {ev.date}
                          </div>
                          <div className="text-[10px] text-slate-500 ml-4.5">{ev.dayName}</div>
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-slate-600 whitespace-nowrap text-[11px]">
                          {ev.timeInfo || '-'}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            activeDetailModal.colorTheme === 'amber'
                              ? 'bg-amber-100 text-amber-950'
                              : activeDetailModal.colorTheme === 'rose'
                              ? 'bg-rose-100 text-rose-950'
                              : activeDetailModal.colorTheme === 'emerald'
                              ? 'bg-emerald-100 text-emerald-950'
                              : activeDetailModal.colorTheme === 'indigo'
                              ? 'bg-indigo-100 text-indigo-950'
                              : 'bg-blue-100 text-blue-950'
                          }`}>
                            {ev.metricValue}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="font-medium text-slate-700 text-[11px]">{ev.categoryLabel}</div>
                          <div className="mt-0.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                              ev.statusColor === 'emerald'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : ev.statusColor === 'amber'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : ev.statusColor === 'rose'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : ev.statusColor === 'indigo'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}>
                              {ev.statusColor === 'emerald' && <CheckCircle2 className="w-2.5 h-2.5" />}
                              {ev.statusColor === 'amber' && <AlertCircle className="w-2.5 h-2.5" />}
                              {ev.statusColor === 'rose' && <AlertTriangle className="w-2.5 h-2.5" />}
                              {ev.statusBadge}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-[11px] max-w-[220px]">
                          <p className="line-clamp-2">{ev.notes || '-'}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Menampilkan <span className="font-bold text-slate-800">{filteredModalEvents.length}</span> catatan riwayat tanggal
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailModal(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs cursor-pointer shadow-xs transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings / Customization Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                Kustomisasi Judul & Penandatangan Laporan
              </h3>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Sekolah / Instansi (Kop Laporan):
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
                  placeholder="e.g. SMK TEXMACO SEMARANG"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kota Tempat Surat:
                  </label>
                  <input
                    type="text"
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
                    placeholder="e.g. Semarang"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tahun Pelajaran:
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
                    placeholder="e.g. 2026/2027"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">
                    Kepala Sekolah:
                  </label>
                  <input
                    type="text"
                    value={headmasterName}
                    onChange={(e) => setHeadmasterName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800"
                    placeholder="Nama Kepala Sekolah"
                  />
                  <input
                    type="text"
                    value={headmasterNip}
                    onChange={(e) => setHeadmasterNip(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 text-[11px]"
                    placeholder="NIP Kepala Sekolah"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">
                    Waka. / Bagian SDM:
                  </label>
                  <input
                    type="text"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800"
                    placeholder="Nama Waka / SDM"
                  />
                  <input
                    type="text"
                    value={supervisorNip}
                    onChange={(e) => setSupervisorNip(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 text-[11px]"
                    placeholder="NIP Waka / SDM"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Selesai & Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
