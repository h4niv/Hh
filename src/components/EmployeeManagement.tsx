import { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Building2, 
  Briefcase, 
  Clock, 
  Mail, 
  Phone, 
  Calendar, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Upload, 
  UserCheck, 
  AlertTriangle,
  BadgePercent,
  Sparkles,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  ShieldAlert,
  User,
  Shield,
  Crown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, ShiftInfo, SystemRole, OfficeConfig } from '../types';
import ImportEmployeeModal from './ImportEmployeeModal';

interface EmployeeManagementProps {
  employees: Employee[];
  currentEmployee: Employee;
  departments: string[];
  officeConfig?: OfficeConfig;
  onSelectEmployee: (employee: Employee) => void;
  onAddEmployee: (employee: Omit<Employee, 'id'>) => void;
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (employeeId: string) => void;
  onImportEmployees: (importedEmployees: Employee[]) => void;
  isAddModalOpenInitially?: boolean;
  onCloseAddModalInitially?: () => void;
}

// Curated high quality avatars for easy selection
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
];

export default function EmployeeManagement({
  employees,
  currentEmployee,
  departments,
  officeConfig,
  onSelectEmployee,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onImportEmployees,
  isAddModalOpenInitially = false,
  onCloseAddModalInitially,
}: EmployeeManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(isAddModalOpenInitially);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [nik, setNik] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');
  const [role, setRole] = useState('');
  const [systemRole, setSystemRole] = useState<SystemRole>('karyawan');
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0]);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [shiftName, setShiftName] = useState('Reguler');
  const [workStartTime, setWorkStartTime] = useState(officeConfig?.workStartTime || '08:30');
  const [workEndTime, setWorkEndTime] = useState(officeConfig?.workEndTime || '17:30');
  const [lateTolerance, setLateTolerance] = useState(officeConfig?.lateToleranceMinutes || 15);
  const [leaveQuota, setLeaveQuota] = useState(12);

  // Filters
  const [selectedRole, setSelectedRole] = useState<'all' | 'superadmin' | 'admin' | 'karyawan'>('all');

  // Form error message
  const [formError, setFormError] = useState<string | null>(null);

  // Helper to open Add Modal
  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setName('');
    // Suggest next NIK
    const nextNum = employees.length + 1;
    setNik(`KRY-2024-${String(nextNum).padStart(3, '0')}`);
    setEmail('');
    setPhone('+62 8');
    setDepartment(departments[0] || 'Teknologi & Informasi');
    setCustomDepartment('');
    setRole('');
    setSystemRole('karyawan');
    setAvatarUrl(PRESET_AVATARS[nextNum % PRESET_AVATARS.length]);
    setCustomAvatarUrl('');
    setShiftName('Reguler');
    setWorkStartTime(officeConfig?.workStartTime || '08:30');
    setWorkEndTime(officeConfig?.workEndTime || '17:30');
    setLateTolerance(officeConfig?.lateToleranceMinutes || 15);
    setLeaveQuota(12);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Helper to open Edit Modal
  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setNik(emp.nik);
    setEmail(emp.email);
    setPhone(emp.phone);
    if (departments.includes(emp.department)) {
      setDepartment(emp.department);
      setCustomDepartment('');
    } else {
      setDepartment('__custom__');
      setCustomDepartment(emp.department);
    }
    setRole(emp.role);
    setSystemRole(emp.systemRole || 'karyawan');
    setAvatarUrl(emp.avatarUrl);
    setCustomAvatarUrl('');
    setShiftName(emp.shift.name.split(' (')[0] || 'Reguler');
    setWorkStartTime(emp.shift.startTime);
    setWorkEndTime(emp.shift.endTime);
    setLateTolerance(emp.shift.lateToleranceMinutes);
    setLeaveQuota(emp.remainingLeaveQuota);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setFormError(null);
    if (onCloseAddModalInitially) {
      onCloseAddModalInitially();
    }
  };

  // Quick toggle role directly from table (karyawan -> admin -> superadmin -> karyawan)
  const handleToggleRole = (emp: Employee) => {
    let nextRole: SystemRole = 'karyawan';
    if (emp.systemRole === 'karyawan') {
      nextRole = 'admin';
    } else if (emp.systemRole === 'admin') {
      nextRole = 'superadmin';
    } else {
      // Current is superadmin, moving to karyawan
      const superAdminCount = employees.filter((e) => e.systemRole === 'superadmin').length;
      if (superAdminCount <= 1) {
        alert('Sistem harus memiliki minimal satu Superadministrator aktif.');
        return;
      }
      nextRole = 'karyawan';
    }

    onEditEmployee({
      ...emp,
      systemRole: nextRole,
    });
  };

  // Handle Photo Upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setFormError('Ukuran file foto maksimal 2 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          setAvatarUrl(event.target.result);
          setCustomAvatarUrl('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save / Submit Form
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Nama lengkap karyawan wajib diisi.');
      return;
    }
    if (!nik.trim()) {
      setFormError('Nomor Induk Karyawan (NIK) wajib diisi.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Email karyawan tidak valid.');
      return;
    }
    if (!role.trim()) {
      setFormError('Jabatan/posisi karyawan wajib diisi.');
      return;
    }

    // Check duplicate NIK (except for editing same employee)
    const isNikTaken = employees.some(
      (emp) => emp.nik.toLowerCase() === nik.trim().toLowerCase() && emp.id !== editingEmployee?.id
    );
    if (isNikTaken) {
      setFormError(`NIK ${nik} sudah digunakan oleh karyawan lain.`);
      return;
    }

    const finalDept = department === '__custom__' ? customDepartment.trim() : department;
    if (!finalDept) {
      setFormError('Pilih atau masukkan nama departemen.');
      return;
    }

    const finalShift: ShiftInfo = {
      id: editingEmployee ? editingEmployee.shift.id : `shift-${Date.now()}`,
      name: `${shiftName} (${workStartTime} - ${workEndTime})`,
      startTime: workStartTime,
      endTime: workEndTime,
      lateToleranceMinutes: lateTolerance,
    };

    const finalAvatar = customAvatarUrl.trim() || avatarUrl;

    if (editingEmployee) {
      onEditEmployee({
        ...editingEmployee,
        name: name.trim(),
        nik: nik.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department: finalDept,
        role: role.trim(),
        systemRole,
        avatarUrl: finalAvatar,
        shift: finalShift,
        remainingLeaveQuota: Number(leaveQuota),
      });
    } else {
      onAddEmployee({
        name: name.trim(),
        nik: nik.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department: finalDept,
        role: role.trim(),
        systemRole,
        avatarUrl: finalAvatar,
        shift: finalShift,
        remainingLeaveQuota: Number(leaveQuota),
      });
    }

    handleCloseModal();
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchDept =
        selectedDepartment === 'all' || emp.department === selectedDepartment;

      const matchRole =
        selectedRole === 'all' || emp.systemRole === selectedRole;

      return matchSearch && matchDept && matchRole;
    });
  }, [employees, searchQuery, selectedDepartment, selectedRole]);

  // Handle Export all employees to Excel (.xlsx)
  const handleExportToExcel = () => {
    const exportData = employees.map((emp, idx) => ({
      'No': idx + 1,
      'NIK': emp.nik,
      'Nama Lengkap': emp.name,
      'Role Akses': emp.systemRole === 'superadmin' ? 'Superadministrator' : emp.systemRole === 'admin' ? 'Administrator' : 'Karyawan',
      'Email': emp.email,
      'No Telepon': emp.phone,
      'Departemen': emp.department,
      'Jabatan': emp.role,
      'Jam Masuk': emp.shift.startTime,
      'Jam Pulang': emp.shift.endTime,
      'Toleransi Keterlambatan (menit)': emp.shift.lateToleranceMinutes,
      'Sisa Cuti (hari)': emp.remainingLeaveQuota,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 30 },
      { wch: 18 },
      { wch: 25 },
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 28 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Karyawan');
    XLSX.writeFile(workbook, `Data_Karyawan_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const isSuperadmin = currentEmployee.systemRole === 'superadmin';
  const isAdmin = currentEmployee.systemRole === 'admin';
  const isAdminOrSuper = isSuperadmin || isAdmin;

  return (
    <div className="space-y-6" id="employee-management-view">
      
      {/* Role Alert Banner if logged in as regular employee */}
      {!isAdminOrSuper && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm text-amber-950 block">Mode Tinjauan Karyawan</span>
              <p className="text-amber-800 mt-0.5">
                Akun Anda saat ini (<strong>{currentEmployee.name}</strong>) memiliki role <strong>Karyawan</strong>. 
                Fitur pendaftaran, penyesuaian role, dan penghapusan data karyawan di bawah ditujukan bagi <strong>Administrator</strong>. 
                Ganti profil ke akun Admin via menu di pojok kanan atas untuk akses penuh.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner & Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Data & Manajemen Karyawan
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Kelola data master karyawan, penetapan role Administrator & Karyawan, jadwal shift kerja, kuota cuti, serta impor spreadsheet Excel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Ekspor Excel */}
            <button
              type="button"
              id="btn-export-excel-karyawan"
              onClick={handleExportToExcel}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Unduh seluruh daftar karyawan ke format file Excel (.xlsx)"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Ekspor Excel</span>
            </button>

            {/* Import Excel */}
            <button
              type="button"
              id="btn-import-excel-modal"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Unggah file Excel .xls / .xlsx untuk import banyak karyawan sekaligus"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Data Excel (.xls)</span>
            </button>

            {/* Tambah Karyawan */}
            <button
              type="button"
              id="btn-tambah-karyawan-modal"
              onClick={handleOpenAddModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Karyawan</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Summary with Superadmin & Administrator Breakdown */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Total Karyawan</span>
            <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">{employees.length} Orang</div>
          </div>
          <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-100">
            <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-purple-600" />
              Superadmin
            </span>
            <div className="text-lg sm:text-xl font-bold text-purple-900 mt-0.5">
              {employees.filter((e) => e.systemRole === 'superadmin').length} Orang
            </div>
          </div>
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100">
            <span className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Administrator
            </span>
            <div className="text-lg sm:text-xl font-bold text-indigo-900 mt-0.5">
              {employees.filter((e) => e.systemRole === 'admin').length} Orang
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Karyawan Biasa</span>
            <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              {employees.filter((e) => e.systemRole === 'karyawan').length} Orang
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">Departemen</span>
            <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">{departments.length} Divisi</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar with Role Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, NIK, atau jabatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Shield className="w-4 h-4 text-indigo-500 shrink-0" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'all' | 'superadmin' | 'admin' | 'karyawan')}
              className="w-full sm:w-48 py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Semua Role ({employees.length})</option>
              <option value="superadmin">👑 Superadmin ({employees.filter(e => e.systemRole === 'superadmin').length})</option>
              <option value="admin">🛡️ Administrator ({employees.filter(e => e.systemRole === 'admin').length})</option>
              <option value="karyawan">👤 Karyawan ({employees.filter(e => e.systemRole === 'karyawan').length})</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full sm:w-48 py-2 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Semua Departemen ({employees.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept} ({employees.filter(e => e.department === dept).length})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Employees Grid / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Daftar Karyawan Terdaftar ({filteredEmployees.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Klik tombol &quot;Beralih Profil&quot; untuk menguji absensi sebagai karyawan terkait
          </span>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-700">Tidak ada karyawan yang cocok</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Cobalah ubah kata kunci pencarian atau filter departemen, atau tambahkan karyawan baru ke sistem.
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-2 inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Tambah Karyawan Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEmployees.map((emp) => {
              const isSelected = emp.id === currentEmployee.id;

              return (
                <div
                  key={emp.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isSelected ? 'bg-blue-50/40 border-l-4 border-l-blue-600' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Left: Avatar & Basic Info */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={emp.avatarUrl}
                        alt={emp.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                      />
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center" title="Akun Aktif Saat Ini">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {emp.name}
                        </span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          {emp.nik}
                        </span>
                        {emp.systemRole === 'superadmin' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                            <Crown className="w-3 h-3 text-purple-600" />
                            Superadmin
                          </span>
                        ) : emp.systemRole === 'admin' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                            <ShieldCheck className="w-3 h-3 text-indigo-600" />
                            Administrator
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            <User className="w-3 h-3 text-slate-400" />
                            Karyawan
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold border border-blue-200">
                            Aktif di Sesi Ini
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          {emp.role}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {emp.department}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {emp.email}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {emp.phone}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Shift & Leave */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 text-xs shrink-0 py-2 sm:py-0 border-t sm:border-t-0 border-slate-100">
                    <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 space-y-0.5 min-w-[140px]">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <Clock className="w-3 h-3 text-blue-500" />
                        Jadwal Shift
                      </div>
                      <div className="font-semibold text-slate-800">
                        {emp.shift.startTime} - {emp.shift.endTime} WIB
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Tol. terlambat: {emp.shift.lateToleranceMinutes} mnt
                      </div>
                    </div>

                    <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 space-y-0.5 min-w-[120px]">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        Sisa Cuti
                      </div>
                      <div className="font-bold text-slate-800">
                        {emp.remainingLeaveQuota} Hari
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Tahun {new Date().getFullYear()}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {!isSelected ? (
                      <button
                        type="button"
                        onClick={() => onSelectEmployee(emp)}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Beralih profil ke karyawan ini"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Beralih Profil</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                        Profil Saat Ini
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleRole(emp)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer ${
                        emp.systemRole === 'superadmin'
                          ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                          : emp.systemRole === 'admin'
                          ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                      title={`Role saat ini: ${emp.systemRole}. Klik untuk beralih role (Karyawan -> Admin -> Superadmin)`}
                    >
                      {emp.systemRole === 'superadmin' ? (
                        <Crown className="w-3.5 h-3.5 text-purple-600" />
                      ) : (
                        <ShieldCheck className={`w-3.5 h-3.5 ${emp.systemRole === 'admin' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      )}
                      <span className="hidden sm:inline">
                        {emp.systemRole === 'superadmin' ? 'Superadmin' : emp.systemRole === 'admin' ? 'Admin' : 'Karyawan'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(emp)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Edit Data Karyawan"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmployeeToDelete(emp)}
                      disabled={employees.length <= 1}
                      className={`p-2 rounded-xl transition-colors ${
                        employees.length <= 1
                          ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                          : 'bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 cursor-pointer'
                      }`}
                      title={employees.length <= 1 ? 'Minimal harus ada 1 karyawan' : 'Hapus Karyawan'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Tambah / Edit Karyawan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  {editingEmployee ? <Edit3 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingEmployee ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingEmployee ? 'Perbarui rincian informasi profil dan shift kerja' : 'Lengkapi formulir di bawah untuk mendaftarkan karyawan ke sistem presensi'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Photo Avatar Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Foto Profil Karyawan
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <img
                    src={customAvatarUrl.trim() || avatarUrl}
                    alt="Preview Avatar"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm shrink-0"
                  />
                  <div className="space-y-2 flex-1 w-full">
                    <span className="text-xs font-semibold text-slate-700 block">Pilih Avatar Preset:</span>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_AVATARS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setAvatarUrl(preset);
                            setCustomAvatarUrl('');
                          }}
                          className={`relative rounded-xl overflow-hidden border-2 transition-transform hover:scale-105 cursor-pointer ${
                            avatarUrl === preset && !customAvatarUrl
                              ? 'border-blue-600 ring-2 ring-blue-500/20'
                              : 'border-transparent'
                          }`}
                        >
                          <img src={preset} alt={`Avatar ${idx}`} className="w-9 h-9 object-cover" />
                        </button>
                      ))}
                    </div>

                    {/* Or Custom Upload */}
                    <div className="pt-2 flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 shadow-2xs">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Unggah Foto Sendiri</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px] text-slate-400">atau paste link URL di bawah</span>
                    </div>

                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={customAvatarUrl}
                      onChange={(e) => setCustomAvatarUrl(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Basic Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rian Pratama"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Induk Karyawan (NIK) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="KRY-2024-004"
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="nama@sinergi.co.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="+62 812-3456-7890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departemen / Divisi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white cursor-pointer"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="__custom__">+ Tambah Departemen Baru...</option>
                  </select>

                  {department === '__custom__' && (
                    <input
                      type="text"
                      placeholder="Masukkan nama departemen baru..."
                      value={customDepartment}
                      onChange={(e) => setCustomDepartment(e.target.value)}
                      className="mt-2 w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jabatan / Posisi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Frontend Developer"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* System Role Selector */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Role Akses Sistem Presensi <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Option 1: Superadmin */}
                  <div
                    onClick={() => setSystemRole('superadmin')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                      systemRole === 'superadmin'
                        ? 'border-purple-600 bg-purple-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      id="role-superadmin"
                      name="systemRoleInput"
                      checked={systemRole === 'superadmin'}
                      onChange={() => setSystemRole('superadmin')}
                      className="mt-0.5 text-purple-600 cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-1 text-xs font-bold text-purple-950">
                        <Crown className="w-3.5 h-3.5 text-purple-600" />
                        Superadmin
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Akses tertinggi: input manual & otomatis semua user, izin cuti, kelola admin, & setting GPS kantor.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Admin */}
                  <div
                    onClick={() => setSystemRole('admin')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                      systemRole === 'admin'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      id="role-admin"
                      name="systemRoleInput"
                      checked={systemRole === 'admin'}
                      onChange={() => setSystemRole('admin')}
                      className="mt-0.5 text-indigo-600 cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-1 text-xs font-bold text-indigo-950">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Administrator
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Akses manajerial: input manual & otomatis semua user, persetujuan cuti tim, dan kelola karyawan & shift.
                      </p>
                    </div>
                  </div>

                  {/* Option 3: Karyawan */}
                  <div
                    onClick={() => setSystemRole('karyawan')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                      systemRole === 'karyawan'
                        ? 'border-blue-600 bg-blue-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      id="role-karyawan"
                      name="systemRoleInput"
                      checked={systemRole === 'karyawan'}
                      onChange={() => setSystemRole('karyawan')}
                      className="mt-0.5 text-blue-600 cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        Karyawan Biasa
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Presensi mandiri (selfie & GPS), pengajuan izin/cuti sendiri, serta rekap riwayat kehadiran personal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shift & Working Hours Section */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Pengaturan Shift & Jam Kerja
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nama Shift
                    </label>
                    <select
                      value={shiftName}
                      onChange={(e) => setShiftName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                    >
                      <option value="Reguler">Reguler Normal</option>
                      <option value="Shift Pagi">Shift Pagi</option>
                      <option value="Shift Siang">Shift Siang</option>
                      <option value="Shift Malam">Shift Malam</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Jam Masuk (WIB)
                    </label>
                    <input
                      type="time"
                      value={workStartTime}
                      onChange={(e) => setWorkStartTime(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Jam Pulang (WIB)
                    </label>
                    <input
                      type="time"
                      value={workEndTime}
                      onChange={(e) => setWorkEndTime(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Toleransi Keterlambatan (menit)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={lateTolerance}
                      onChange={(e) => setLateTolerance(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Kuota Cuti Tahunan (Hari)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={leaveQuota}
                      onChange={(e) => setLeaveQuota(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingEmployee ? 'Simpan Perubahan' : 'Daftarkan Karyawan'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Confirmation Delete Dialog */}
      {employeeToDelete && (() => {
        const isDeletingLastAdmin =
          employeeToDelete.systemRole === 'admin' &&
          employees.filter((e) => e.systemRole === 'admin').length <= 1;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Data Karyawan?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin menghapus data karyawan <strong className="text-slate-900">{employeeToDelete.name}</strong> ({employeeToDelete.nik})? Data profil beserta seluruh catatan riwayat absensi dan pengajuan izin karyawan ini akan dihapus secara menyeluruh dari sistem dan rekapitulasi.
                </p>

                {isDeletingLastAdmin && (
                  <div className="p-3 mt-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Peringatan Keamanan:</strong> {employeeToDelete.name} adalah satu-satunya akun dengan hak akses <strong>Administrator</strong>. Anda tidak dapat menghapus akun ini sebelum menetapkan akun lain sebagai Administrator.
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEmployeeToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingLastAdmin}
                  onClick={() => {
                    if (isDeletingLastAdmin) return;
                    onDeleteEmployee(employeeToDelete.id);
                    setEmployeeToDelete(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs ${
                    isDeletingLastAdmin
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                  }`}
                >
                  Ya, Hapus Karyawan
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Import Excel (.xls / .xlsx) */}
      <ImportEmployeeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingEmployees={employees}
        departments={departments}
        onImport={onImportEmployees}
      />

    </div>
  );
}
