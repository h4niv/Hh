export type AttendanceType = 'WFO' | 'WFH' | 'Dinas Luar';

export type AttendanceStatus =
  | 'Hadir Tepat Waktu'
  | 'Terlambat'
  | 'Izin'
  | 'Sakit'
  | 'Alpha';

export type LeaveType = 'Cuti Tahunan' | 'Izin Pribadi' | 'Sakit' | 'Cuti Melahirkan' | 'Keperluan Mendesak';

export type LeaveStatus = 'Menunggu' | 'Disetujui' | 'Ditolak';

export type SystemRole = 'admin' | 'karyawan';

export interface ShiftInfo {
  id: string;
  name: string;
  startTime: string; // "08:00"
  endTime: string;   // "17:00"
  lateToleranceMinutes: number; // 15 mins
}

export interface Employee {
  id: string;
  nik: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  systemRole: SystemRole;
  avatarUrl: string;
  shift: ShiftInfo;
  remainingLeaveQuota: number;
}

export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  distanceToOfficeMeters: number;
  isWithinRadius: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNik: string;
  department: string;
  date: string; // YYYY-MM-DD
  type: AttendanceType;
  checkInTime: string | null; // "08:12:30"
  checkOutTime: string | null; // "17:05:10"
  status: AttendanceStatus;
  checkInPhoto?: string;
  checkOutPhoto?: string;
  location?: GeoLocationData;
  notes?: string;
  isManualEntry?: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNik: string;
  department: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  approvedBy?: string;
  notes?: string;
}

export interface OfficeConfig {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  workStartTime: string;
  workEndTime: string;
  lateToleranceMinutes: number;
}
