import { Employee, AttendanceRecord, OfficeConfig } from '../types';
import { calculateLateMinutes, calculateEarlyMinutes } from '../utils/geo';
import { syncAttendanceRecordToFirestore } from '../lib/firebase';

export interface PunchEvent {
  id: string;
  pin: string;
  timestamp: string; // "YYYY-MM-DD HH:mm:ss" or ISO
  deviceIp?: string;
  deviceSn?: string;
  deviceName?: string;
  verifyType?: string;
  punchState?: string;
  receivedAt: string;
}

export interface AutoProcessResult {
  success: boolean;
  message: string;
  type: 'check_in' | 'check_out' | 'duplicate' | 'unmapped';
  employee?: Employee;
  record?: AttendanceRecord;
  punch: PunchEvent;
}

// Audio chime using Web Audio API (cross-browser, zero external asset dependencies)
export function playAttendanceChime(type: 'success' | 'warning' | 'alert' = 'success') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Resume context if suspended by browser autoplay policy
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Pleasant two-tone chime (523.25Hz -> 659.25Hz -> 783.99Hz, C5 - E5 - G5 chord)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'warning') {
      // Double beep for late
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      // Alert buzz for unmapped PIN
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
}

/**
 * Intelligent Processor for Incoming Fingerprint Punch
 * Automatically matches PIN, checks in or checks out, calculates lateness,
 * updates attendance records, and syncs to Firestore.
 */
export function processIncomingPunchLog(
  punch: PunchEvent,
  employees: Employee[],
  currentRecords: AttendanceRecord[],
  officeConfig: OfficeConfig
): AutoProcessResult {
  const pin = String(punch.pin).trim();
  
  // 1. Find employee by fingerprintPin, NIK, or ID
  const employee = employees.find(
    (e) => (e.fingerprintPin && String(e.fingerprintPin).trim() === pin) ||
           (e.nik && String(e.nik).trim() === pin) ||
           e.id === pin
  );

  if (!employee) {
    playAttendanceChime('alert');
    return {
      success: false,
      message: `PIN Fingerprint [${pin}] belum terdaftar ke karyawan manapun. Silakan lakukan mapping PIN di menu Pengaturan Mesin.`,
      type: 'unmapped',
      punch
    };
  }

  // 2. Parse Date and Time from Punch timestamp
  // Timestamp formats can be: "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"
  let dateStr = '';
  let timeStr = '';
  
  try {
    const cleanTs = punch.timestamp.replace('T', ' ');
    const parts = cleanTs.split(' ');
    if (parts.length >= 2) {
      dateStr = parts[0].trim();
      timeStr = parts[1].trim().slice(0, 8);
    } else {
      const d = new Date(punch.timestamp);
      if (!isNaN(d.getTime())) {
        dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      }
    }
  } catch (e) {
    // fallback to today
  }

  if (!dateStr || !timeStr) {
    const now = new Date();
    dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  // 3. Check existing record for this employee today
  const existingIndex = currentRecords.findIndex(
    (r) => r.employeeId === employee.id && r.date === dateStr
  );
  const existingRecord = existingIndex >= 0 ? currentRecords[existingIndex] : null;

  // 4. Determine Check-In vs Check-Out
  if (!existingRecord || !existingRecord.checkInTime) {
    // === PROCESS CHECK-IN ===
    const rawLateMinutes = calculateLateMinutes(timeStr, officeConfig.workStartTime);
    const isLate = rawLateMinutes > (officeConfig.lateToleranceMinutes || 0);
    const lateMinutes = rawLateMinutes;

    const newRecord: AttendanceRecord = {
      id: existingRecord ? existingRecord.id : `att-${employee.id}-${dateStr}`,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeNik: employee.nik,
      department: employee.department,
      date: dateStr,
      type: 'WFO',
      checkInTime: timeStr,
      checkOutTime: null,
      status: isLate ? 'Terlambat' : 'Hadir Tepat Waktu',
      lateMinutes: isLate ? lateMinutes : 0,
      earlyMinutes: 0,
      isManualEntry: false,
      isAutoGenerated: true,
      notes: `Presensi Masuk Otomatis via ${punch.deviceName || 'Mesin Fingerprint LAN'} (PIN: ${pin})`,
      recordedBy: 'Mesin Fingerprint LAN'
    };

    // Trigger audio chime
    playAttendanceChime(isLate ? 'warning' : 'success');

    // Cloud sync
    syncAttendanceRecordToFirestore(newRecord).catch((err) =>
      console.warn('Auto sync check-in error:', err)
    );

    return {
      success: true,
      message: `${employee.name} berhasil presensi MASUK pada ${timeStr} WIB (${newRecord.status}).`,
      type: 'check_in',
      employee,
      record: newRecord,
      punch
    };
  } else {
    // === PROCESS CHECK-OUT ===
    // If punch time is within 2 minutes of checkInTime, consider it an accidental double tap
    const [inH, inM, inS] = (existingRecord.checkInTime || '00:00:00').split(':').map(Number);
    const [curH, curM, curS] = timeStr.split(':').map(Number);
    const inTotalSec = (inH || 0) * 3600 + (inM || 0) * 60 + (inS || 0);
    const curTotalSec = (curH || 0) * 3600 + (curM || 0) * 60 + (curS || 0);

    if (Math.abs(curTotalSec - inTotalSec) < 120) {
      return {
        success: true,
        message: `${employee.name} sudah tercatat presensi masuk baru saja (${existingRecord.checkInTime}). Mengabaikan tap ganda.`,
        type: 'duplicate',
        employee,
        record: existingRecord,
        punch
      };
    }

    const earlyMins = calculateEarlyMinutes(timeStr, officeConfig.workEndTime);

    const updatedRecord: AttendanceRecord = {
      ...existingRecord,
      checkOutTime: timeStr,
      earlyMinutes: earlyMins > 0 ? earlyMins : 0,
      notes: existingRecord.notes 
        ? `${existingRecord.notes} | Pulang via ${punch.deviceName || 'Mesin LAN'}`
        : `Presensi Pulang Otomatis via ${punch.deviceName || 'Mesin Fingerprint LAN'}`,
    };

    playAttendanceChime('success');

    syncAttendanceRecordToFirestore(updatedRecord).catch((err) =>
      console.warn('Auto sync check-out error:', err)
    );

    return {
      success: true,
      message: `${employee.name} berhasil presensi PULANG pada ${timeStr} WIB.`,
      type: 'check_out',
      employee,
      record: updatedRecord,
      punch
    };
  }
}
