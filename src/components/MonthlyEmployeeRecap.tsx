import { useState, useMemo } from 'react';
import { 
  Printer, 
  Download, 
  FileSpreadsheet, 
  Upload, 
  Trash2, 
  Users, 
  Filter, 
  UserCheck, 
  Briefcase 
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest, OfficeConfig } from '../types';
import * as XLSX from 'xlsx';
import ImportAttendanceModal from './ImportAttendanceModal';

interface MonthlyEmployeeRecapProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  officeConfig?: OfficeConfig;
  currentEmployee: Employee;
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

export default function MonthlyEmployeeRecap({
  employees,
  attendanceRecords,
  leaveRequests,
  officeConfig,
  currentEmployee,
  onImportAttendance,
  onDeleteAttendanceRecord,
  onDeleteMultipleAttendanceRecords,
  onShowToast,
}: MonthlyEmployeeRecapProps) {
  const isAdminOrSuper = currentEmployee.systemRole === 'admin' || currentEmployee.systemRole === 'superadmin';

  const resolveEmployeeCategory = (emp: Employee): 'GTY' | 'GTT' | 'KTY' | 'KTT' => {
    const deptUpper = (emp.department || '').trim().toUpperCase();
    const deptLower = (emp.department || '').trim().toLowerCase();

    // 1. Prioritize DEPARTMENT explicitly as requested ("ambil data dari departemen")
    // Check GTT first in department
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

    // Check KTT / PTT in department
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

    // Check GTY in department
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

    // Check KTY in department
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

    // 2. Check role and name text for explicit GTT / KTT before falling back to GTY
    const text = `${emp.role || ''} ${emp.name || ''}`.toLowerCase();
    if (text.includes('gtt') || text.includes('guru tidak tetap') || text.includes('honorer guru')) return 'GTT';
    if (text.includes('ktt') || text.includes('karyawan tidak tetap') || text.includes('kontrak') || text.includes('honorer')) return 'KTT';

    // 3. Next check employmentCategory
    const cat = emp.employmentCategory?.toUpperCase()?.trim();
    if (cat === 'GTT') return 'GTT';
    if (cat === 'KTT' || cat === 'PTT') return 'KTT';
    if (cat === 'GTY') return 'GTY';
    if (cat === 'KTY') return 'KTY';

    // 4. Fallback to generic teacher/employee keywords
    if (text.includes('guru') || text.includes('pengajar') || text.includes('pendidik')) return 'GTY';
    return 'KTY';
  };

  type CategoryFilter = 'ALL' | 'GTY' | 'GTT' | 'KTY' | 'KTT';
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('GTY');

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

  // Selected employee ID (Admins can switch, regular employees locked to themselves)
  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => {
    if (!isAdminOrSuper) return currentEmployee.id;
    // Default to first GTY employee if available
    const gtyEmp = employees.find(e => resolveEmployeeCategory(e) === 'GTY');
    return gtyEmp?.id || employees[0]?.id || currentEmployee.id;
  });

  const handleCategoryChange = (cat: CategoryFilter) => {
    setSelectedCategory(cat);
    const emps = cat === 'ALL' ? employees : employees.filter(e => resolveEmployeeCategory(e) === cat);
    if (emps.length > 0) {
      if (!emps.some(e => e.id === selectedEmpId)) {
        setSelectedEmpId(emps[0].id);
      }
    }
  };

  // Default to current month/year
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  const targetEmployee = useMemo(() => {
    if (filteredEmployees.length > 0) {
      const foundInFiltered = filteredEmployees.find(e => e.id === selectedEmpId);
      if (foundInFiltered) return foundInFiltered;
      return filteredEmployees[0];
    }
    return employees.find(e => e.id === selectedEmpId) || currentEmployee;
  }, [filteredEmployees, selectedEmpId, employees, currentEmployee]);

  // Period calculation: 26th of previous month to 25th of selected month
  const periodDays = useMemo(() => {
    const daysList: { dateStr: string; dateObj: Date; dayName: string; isWeekend: boolean }[] = [];
    
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
      const isWeekend = dayIndex === 0 || dayIndex === 6;

      daysList.push({
        dateStr,
        dateObj: new Date(curr),
        dayName,
        isWeekend,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return daysList;
  }, [selectedMonth, selectedYear]);

  // Map attendance & leaves for target employee over periodDays
  const recapRows = useMemo(() => {
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;
    let countLatePermit = 0;
    let countEarlyPermit = 0;
    let countLeaveIzin = 0;
    let countLeaveSakit = 0;
    let countAlpa = 0;

    const rows = periodDays.map((p, index) => {
      const record = attendanceRecords.find(
        r => (
          (r.employeeId && r.employeeId === targetEmployee.id) ||
          (r.employeeNik && r.employeeNik.trim().toLowerCase() === targetEmployee.nik.trim().toLowerCase()) ||
          (r.employeeName && r.employeeName.trim().toLowerCase() === targetEmployee.name.trim().toLowerCase())
        ) && r.date === p.dateStr
      );

      const leave = leaveRequests.find(
        l => (
          (l.employeeId && l.employeeId === targetEmployee.id) ||
          (l.employeeName && l.employeeName.trim().toLowerCase() === targetEmployee.name.trim().toLowerCase())
        ) && 
             l.status === 'Disetujui' &&
             p.dateStr >= l.startDate && 
             p.dateStr <= l.endDate
      );

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
      } else if (leave) {
        ket = leave.type.toUpperCase();
        if (leave.type.toLowerCase().includes('sakit')) countLeaveSakit++;
        else if (leave.type.toLowerCase().includes('izin')) countLeaveIzin++;
      } else if (record && (record.checkInTime || record.checkOutTime || record.status)) {
        pukulMasuk = record.checkInTime ? record.checkInTime.substring(0, 5) : '';
        pukulPulang = record.checkOutTime ? record.checkOutTime.substring(0, 5) : '';
        
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
      } else {
        pukulMasuk = '';
        pukulPulang = '';
        statusMasuk = '';
        statusPulang = '';
        ket = '';
      }

      const dObj = p.dateObj;
      const displayDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

      return {
        no: index + 1,
        day: p.dayName,
        date: displayDate,
        isWeekend: p.isWeekend,
        pukulMasuk,
        selisihMasuk,
        statusMasuk,
        pukulPulang,
        selisihPulang,
        statusPulang,
        ket,
        recordId: record?.id,
      };
    });

    leaveRequests.forEach(l => {
      if (l.employeeId === targetEmployee.id && l.status === 'Disetujui') {
        if (l.type.toLowerCase().includes('terlambat')) countLatePermit++;
        if (l.type.toLowerCase().includes('pulang awal')) countEarlyPermit++;
      }
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
        countLeaveIzin,
        countLeaveSakit,
        countAlpa,
      }
    };
  }, [periodDays, attendanceRecords, leaveRequests, targetEmployee, officeConfig]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    // Generate template data structure
    const wsData = [
      [`REKAP KEHADIRAN GURU / KARYAWAN`],
      [`SMK TEXMACO SEMARANG`],
      [`BULAN : ${MONTH_NAMES[selectedMonth - 1].toUpperCase()} ${selectedYear}`],
      [],
      [`NAMA PEGAWAI: ${targetEmployee.name}`, `NIK: ${targetEmployee.nik}`, `DEPARTEMEN: ${targetEmployee.department}`],
      [],
      ['NO', 'HARI', 'TANGGAL', 'MASUK (PUKUL)', 'SELISIH', 'STATUS', 'PULANG (PUKUL)', 'SELISIH', 'STATUS', 'KETERANGAN'],
      ...recapRows.rows.map(r => [
        r.no, r.day, r.date, r.pukulMasuk, r.selisihMasuk, r.statusMasuk, r.pukulPulang, r.selisihPulang, r.statusPulang, r.ket
      ]),
      [],
      ['RINGKASAN REKAPITULASI'],
      ['Total Keterlambatan', recapRows.summary.totalKeterlambatan],
      ['Total Pulang Awal', recapRows.summary.totalPulangAwal],
      [],
      ['Catatan:'],
      ['1. Total Ijin Datang Terlambat', recapRows.summary.countLatePermit],
      ['2. Total Ijin Pulang Awal', recapRows.summary.countEarlyPermit],
      ['3. Tidak Masuk:'],
      ['   a. Izin', recapRows.summary.countLeaveIzin],
      ['   b. Sakit', recapRows.summary.countLeaveSakit],
      ['   c. Alpa', recapRows.summary.countAlpa],
      [],
      [`Semarang, 25 ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`]
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Bulanan');
    XLSX.writeFile(wb, `Rekap_Kehadiran_${targetEmployee.name.replace(/\s+/g, '_')}_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.xlsx`);
  };

  const handleDeletePeriodData = () => {
    const periodRecordIds = recapRows.rows
      .filter((r) => r.recordId)
      .map((r) => r.recordId!);
    
    if (periodRecordIds.length === 0) {
      if (onShowToast) onShowToast('Tidak ada data presensi pada periode ini untuk dihapus.', 'info');
      else alert('Tidak ada data presensi pada periode ini untuk dihapus.');
      return;
    }

    if (window.confirm(`Hapus ${periodRecordIds.length} data presensi untuk ${targetEmployee.name} pada periode ini?`)) {
      if (onDeleteMultipleAttendanceRecords) {
        onDeleteMultipleAttendanceRecords(periodRecordIds);
      } else if (onDeleteAttendanceRecord) {
        periodRecordIds.forEach((id) => onDeleteAttendanceRecord(id));
      }
      if (onShowToast) onShowToast('Data presensi periode ini berhasil dihapus.', 'success');
    }
  };

  const handleSingleDelete = (recordId?: string) => {
    if (!recordId) return;
    if (window.confirm('Hapus data presensi tanggal ini?')) {
      if (onDeleteAttendanceRecord) {
        onDeleteAttendanceRecord(recordId);
      }
      if (onShowToast) onShowToast('Data presensi berhasil dihapus.', 'success');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Dedicated Category Menu Bar (GTY, GTT, KTY, KTT, SEMUA) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs print:hidden space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pemisah Rekap Kepegawaian (GTY • GTT • KTY • KTT)
              </h3>
              <p className="text-xs text-slate-500">
                Pilih menu kategori untuk menyaring dan hanya menampilkan data pegawai sesuai status departemen.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="text-slate-400">Total:</span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full">{employees.length} Pegawai</span>
          </div>
        </div>

        {/* Category Menu Buttons */}
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

        {/* Quick User Selection Pills for the selected category */}
        {isAdminOrSuper && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                Daftar Pegawai {selectedCategory !== 'ALL' ? `Kategori ${selectedCategory}` : ''} ({filteredEmployees.length} orang):
              </span>
              <span className="text-[11px] text-slate-400">
                Klik nama pegawai untuk langsung menampilkan rekapitulasinya
              </span>
            </div>
            {filteredEmployees.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                Tidak ada data pegawai yang terdaftar pada kategori {selectedCategory}.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {filteredEmployees.map((emp) => {
                  const isSelected = emp.id === targetEmployee.id;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <UserCheck className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span>{emp.name}</span>
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                        ({emp.nik})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top Action & Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Rekap Kehadiran Bulanan (Format SMK Texmaco)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Periode rekap otomatis dari tanggal 26 bulan sebelumnya s/d 25 bulan berjalan, dengan blok otomatis untuk hari Sabtu & Minggu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Employee Selector (Admin Only) */}
          {isAdminOrSuper && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">
                Pegawai {selectedCategory !== 'ALL' ? `(${selectedCategory})` : ''}:
              </span>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[200px]"
              >
                {filteredEmployees.length === 0 ? (
                  <option value="" disabled>Tidak ada pegawai di kategori ini</option>
                ) : (
                  filteredEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.nik} • {emp.department})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Bulan:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
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
              className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              {[2024, 2025, 2026, 2027, 2028].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Import Excel Button */}
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Impor data presensi dari Excel (.xlsx)"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>Import Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={handleDeletePeriodData}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Hapus data presensi pegawai ini pada periode rekap"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Hapus Periode Ini</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>
          </div>
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
            PERIODE: 26 {MONTH_NAMES[(selectedMonth - 2 + 12) % 12].toUpperCase()} s.d. 25 {MONTH_NAMES[selectedMonth - 1].toUpperCase()} {selectedYear}
          </p>
        </div>

        {/* Employee Info Header */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6 text-xs sm:text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span className="text-slate-500 block text-[11px]">Nama Pegawai</span>
            <span className="font-bold text-slate-900">{targetEmployee.name}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Nomor Induk (NIK)</span>
            <span className="font-bold text-slate-900 font-mono">{targetEmployee.nik}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Status Kepegawaian</span>
            <span className="inline-block px-2 py-0.5 rounded font-bold text-xs bg-blue-100 text-blue-800">
              {resolveEmployeeCategory(targetEmployee)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Departemen / Jabatan</span>
            <span className="font-bold text-slate-900">{targetEmployee.department} - {targetEmployee.role}</span>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto border border-slate-900 rounded-none mb-6">
          <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 font-bold text-center">
                <th className="p-2 border-r border-slate-900 w-10">NO</th>
                <th className="p-2 border-r border-slate-950 w-24">HARI</th>
                <th className="p-2 border-r border-slate-900 w-24">TANGGAL</th>
                <th colSpan={3} className="p-2 border-r border-slate-900 bg-emerald-50/50">MASUK</th>
                <th colSpan={3} className="p-2 border-r border-slate-900 bg-blue-50/50">PULANG</th>
                <th className="p-2 bg-slate-50">KETERANGAN</th>
              </tr>
              <tr className="bg-slate-50 text-[10px] sm:text-[11px] font-semibold text-slate-700 border-b border-slate-900 text-center">
                <th className="border-r border-slate-900"></th>
                <th className="border-r border-slate-900"></th>
                <th className="border-r border-slate-900"></th>
                <th className="p-1.5 border-r border-slate-900 bg-emerald-50/30">Pukul</th>
                <th className="p-1.5 border-r border-slate-900 bg-emerald-50/30">Selisih</th>
                <th className="p-1.5 border-r border-slate-900 bg-emerald-50/30">Status</th>
                <th className="p-1.5 border-r border-slate-900 bg-blue-50/30">Pukul</th>
                <th className="p-1.5 border-r border-slate-900 bg-blue-50/30">Selisih</th>
                <th className="p-1.5 border-r border-slate-900 bg-blue-50/30">Status</th>
                <th className="p-1.5"></th>
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
                        LIBUR
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
                          row.statusMasuk === 'TERLAMBAT' ? 'text-amber-700 font-bold' : 'text-slate-500'
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
                        <span className={row.statusPulang === 'PULANG AWAL' ? 'text-purple-700' : 'text-slate-500'}>
                          {row.statusPulang || '-'}
                        </span>
                      </td>
                      <td className="p-2 font-medium text-slate-800 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className={
                            row.ket === 'ALPA' ? 'text-rose-600 font-bold' :
                            row.ket?.includes('CUTI') || row.ket?.includes('IZIN') ? 'text-blue-700 font-bold' : ''
                          }>
                            {row.ket}
                          </span>
                          {row.recordId && (
                            <button
                              type="button"
                              onClick={() => handleSingleDelete(row.recordId)}
                              className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer print:hidden"
                              title="Hapus data absensi tanggal ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
            <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
              <li>Total Ijin Datang Terlambat: <strong className="text-slate-900">{recapRows.summary.countLatePermit} kali</strong></li>
              <li>Total Ijin Pulang Awal: <strong className="text-slate-900">{recapRows.summary.countEarlyPermit} kali</strong></li>
              <li>Tidak Masuk:
                <ul className="list-decimal list-inside pl-4 mt-0.5 space-y-0.5">
                  <li>Izin: <strong className="text-slate-900">{recapRows.summary.countLeaveIzin} hari</strong></li>
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
