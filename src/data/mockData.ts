import { Employee, AttendanceRecord, LeaveRequest, OfficeConfig } from '../types';

export const DEFAULT_OFFICE_CONFIG: OfficeConfig = {
  name: 'Head Office PT Sinergi Nusantara',
  address: 'Jl. Jend. Sudirman Kav. 52-53, SCBD, Jakarta Selatan',
  latitude: -6.2255,
  longitude: 106.8095,
  radiusMeters: 150, // 150 meters radius
  workStartTime: '08:30',
  workEndTime: '17:30',
  lateToleranceMinutes: 15,
  maxLatePermitCountPerMonth: 3,      // Maksimal 3 kali izin terlambat per bulan
  maxLatePermitMinutesPerMonth: 120,  // Maksimal 120 menit (2 jam) akumulasi per bulan
  maxEarlyLeaveCountPerMonth: 3,      // Maksimal 3 kali izin pulang awal per bulan
  maxEarlyLeaveMinutesPerMonth: 120,  // Maksimal 120 menit (2 jam) akumulasi per bulan
};

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_ATTENDANCE_RECORDS: AttendanceRecord[] = [];

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];
