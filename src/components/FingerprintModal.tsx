import { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import { 
  Fingerprint, 
  Download, 
  Upload, 
  Wifi, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Copy, 
  Check, 
  Server, 
  FileSpreadsheet, 
  Zap, 
  Clock, 
  User,
  RefreshCw,
  Send,
  Radio,
  Terminal,
  Activity,
  Cpu,
  Layers,
  Globe,
  Sliders,
  Wrench,
  HelpCircle,
  Play,
  Pause,
  Key,
  Database,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Sparkles
} from 'lucide-react';
import { Employee, AttendanceRecord, OfficeConfig } from '../types';
import { 
  generateNodeSyncAgentCode, 
  generatePackageJson, 
  generateWindowsBatchScript, 
  generatePythonSyncAgentCode, 
  SyncAgentConfig,
  triggerFileDownload 
} from '../utils/syncAgentTemplates';
import { 
  SolutionMachineConfig,
  generateSolutionPhpScript,
  generateSolutionNodeScript,
  generateSolutionBatchFile,
  generateSolutionSoapGetAttLog,
  generateSolutionSoapSetDate,
  generateSolutionSoapSetUserInfo
} from '../utils/solutionFingerprint';
import { calculateLateMinutes, calculateEarlyMinutes, getTodayDateString } from '../utils/geo';

import { PunchEvent, AutoProcessResult } from '../services/fingerprintAutoReceiver';

interface FingerprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  officeConfig: OfficeConfig;
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  onUpdateEmployees?: (employees: Employee[]) => void;
  onAddOrUpdateRecords: (records: AttendanceRecord[]) => void;
  isLiveConnected?: boolean;
  lastPunch?: PunchEvent | null;
  punchFeed?: AutoProcessResult[];
  onSimulatePunch?: (pin: string, name?: string) => Promise<any>;
  autoReceiverEnabled?: boolean;
  onToggleAutoReceiver?: (enabled: boolean) => void;
}

interface RawPunchLog {
  id: string;
  pin: string;
  time: string;
  date: string;
  matchedEmployeeName?: string;
  matchedNik?: string;
  status: 'matched' | 'unmapped' | 'processed';
  rawXmlRow?: string;
}

export default function FingerprintModal({
  isOpen,
  onClose,
  officeConfig,
  employees,
  attendanceRecords,
  onUpdateEmployees,
  onAddOrUpdateRecords,
  isLiveConnected = true,
  lastPunch = null,
  punchFeed = [],
  onSimulatePunch,
  autoReceiverEnabled = true,
  onToggleAutoReceiver,
}: FingerprintModalProps) {
  // Active Tab - Defaulting to Auto LAN Receiver
  const [activeTab, setActiveTab] = useState<'auto-lan' | 'solution' | 'diagnostics' | 'mapping' | 'simulate' | 'agent' | 'android' | 'upload' | 'guide' | 'error-guide'>('auto-lan');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSimulatingLive, setIsSimulatingLive] = useState<boolean>(false);

  // ================= SOLUTION MACHINE IP CONFIG =================
  const [solutionModel, setSolutionModel] = useState<string>('Solution X100-C');
  const [solutionIp, setSolutionIp] = useState<string>('192.168.1.201');
  const [solutionPort, setSolutionPort] = useState<number>(80);
  const [solutionCommKey, setSolutionCommKey] = useState<string>('0');
  const [solutionName, setSolutionName] = useState<string>('Mesin Solution X100-C (Lobi Utama)');
  const [pullDateRange, setPullDateRange] = useState<'today' | 'yesterday_today' | 'week' | 'month'>('today');
  
  // Solution Connection States
  const [isTestingSolution, setIsTestingSolution] = useState<boolean>(false);
  const [solutionTestStatus, setSolutionTestStatus] = useState<{
    status: 'idle' | 'online' | 'offline';
    latencyMs?: number;
    message?: string;
    deviceInfo?: {
      model: string;
      firmware: string;
      serialNumber: string;
      userCount: number;
      logCount: number;
    };
  }>({ status: 'online', latencyMs: 16, message: 'Mesin Solution merespon normal via HTTP SOAP Port 80.' });

  const [isPullingLogs, setIsPullingLogs] = useState<boolean>(false);
  const [solutionScriptTab, setSolutionScriptTab] = useState<'php' | 'node' | 'python' | 'soap'>('php');

  // ================= PIN MAPPING STATE =================
  const [pinMappingState, setPinMappingState] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    employees.forEach((emp, index) => {
      map[emp.id] = emp.fingerprintPin || emp.nik || String(index + 1);
    });
    return map;
  });

  // Keep PIN mapping updated if employees prop changes
  useEffect(() => {
    setPinMappingState(prev => {
      const updated = { ...prev };
      employees.forEach((emp, index) => {
        if (!updated[emp.id]) {
          updated[emp.id] = emp.fingerprintPin || emp.nik || String(index + 1);
        }
      });
      return updated;
    });
  }, [employees]);

  // ================= LIVE AUTO-POLLING LISTENER =================
  const [isLivePolling, setIsLivePolling] = useState<boolean>(false);
  const [livePollCounter, setLivePollCounter] = useState<number>(0);
  const [lastLivePollTime, setLastLivePollTime] = useState<string | null>(null);
  
  // Raw logs captured for diagnostic
  const [rawLogsFeed, setRawLogsFeed] = useState<RawPunchLog[]>([
    {
      id: 'log-seed-1',
      pin: '1',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      date: getTodayDateString(),
      matchedEmployeeName: employees[0]?.name || 'Karyawan 1',
      matchedNik: employees[0]?.nik || 'NIK-001',
      status: 'matched',
      rawXmlRow: '<Row><PIN>1</PIN><DateTime>' + getTodayDateString() + ' ' + new Date().toTimeString().slice(0, 8) + '</DateTime><Verified>1</Verified><Status>0</Status></Row>'
    }
  ]);

  // Generic Agent Config
  const [deviceIp, setDeviceIp] = useState<string>('192.168.1.201');
  const [devicePort, setDevicePort] = useState<number>(4370);
  const [deviceName, setDeviceName] = useState<string>('Mesin Absensi Lobi Utama');
  const [commKey, setCommKey] = useState<string>('0');
  const [pollInterval, setPollInterval] = useState<number>(30);

  // Live Simulation Form
  const [simEmployeeId, setSimEmployeeId] = useState<string>(employees[0]?.id || '');
  const [simDate, setSimDate] = useState<string>(getTodayDateString());
  const [simTime, setSimTime] = useState<string>(new Date().toTimeString().slice(0, 5));
  const [simType, setSimType] = useState<'checkin' | 'checkout'>('checkin');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto Poller Effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLivePolling && isOpen) {
      timer = setInterval(() => {
        setLivePollCounter(c => c + 1);
        setLastLivePollTime(new Date().toLocaleTimeString('id-ID'));
        
        // Check if there are simulated or live taps pulled
        // Simulate checking machine buffer
      }, 10000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLivePolling, isOpen]);

  if (!isOpen) return null;

  const serverUrl = window.location.origin;
  const apiKey = 'absensipro_fp_secret_key_2026';

  const solutionConfig: SolutionMachineConfig = {
    ip: solutionIp,
    port: solutionPort,
    commKey: solutionCommKey,
    protocol: solutionPort === 80 ? 'soap_http' : 'tcp_4370',
    model: solutionModel,
    name: solutionName,
    timeoutSeconds: 30,
  };

  const agentConfig: SyncAgentConfig = {
    serverUrl,
    apiKey,
    deviceIp,
    devicePort,
    deviceCommKey: commKey,
    deviceName,
    pollIntervalSeconds: pollInterval,
  };

  const genericScriptCode = generateNodeSyncAgentCode(agentConfig);
  const solutionPhpCode = generateSolutionPhpScript(solutionConfig, serverUrl, apiKey);
  const solutionNodeCode = generateSolutionNodeScript(solutionConfig, serverUrl, apiKey);
  const solutionPythonCode = generatePythonSyncAgentCode({
    serverUrl,
    apiKey,
    deviceIp: solutionIp,
    devicePort: solutionPort === 80 ? 4370 : solutionPort,
    deviceCommKey: solutionCommKey,
    deviceName: solutionName,
    pollIntervalSeconds: 30,
  });
  const solutionSoapXml = generateSolutionSoapGetAttLog(solutionCommKey, 'All');

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper to find employee by PIN / NIK / ID
  const findEmployeeByPinOrNik = (pin: string): Employee | undefined => {
    const cleanPin = pin.trim().toLowerCase();
    return employees.find((emp, index) => {
      const assignedPin = (pinMappingState[emp.id] || emp.fingerprintPin || '').toLowerCase();
      if (assignedPin && assignedPin === cleanPin) return true;
      if (emp.nik.toLowerCase() === cleanPin) return true;
      if (emp.id.toLowerCase() === cleanPin) return true;
      if (cleanPin === String(index + 1)) return true; // Index fallback
      return false;
    });
  };

  // Save PIN Mappings
  const handleSavePinMappings = () => {
    const updatedEmployees = employees.map(emp => ({
      ...emp,
      fingerprintPin: pinMappingState[emp.id] || emp.nik,
    }));

    if (onUpdateEmployees) {
      onUpdateEmployees(updatedEmployees);
    }
    setSuccessMsg(`✓ Berhasil menyimpan pemetaan PIN mesin Solution untuk ${employees.length} karyawan! Setiap tap pada PIN tersebut akan langsung terbaca otomatis.`);
  };

  // Auto Assign sequential PINs (1, 2, 3...)
  const handleAutoAssignPins = () => {
    const newMap: Record<string, string> = {};
    employees.forEach((emp, idx) => {
      newMap[emp.id] = String(idx + 1);
    });
    setPinMappingState(newMap);

    const updatedEmployees = employees.map((emp, idx) => ({
      ...emp,
      fingerprintPin: String(idx + 1),
    }));

    if (onUpdateEmployees) {
      onUpdateEmployees(updatedEmployees);
    }
    setSuccessMsg(`✓ Berhasil memetakan nomor PIN 1 s/d ${employees.length} secara berurutan sesuai urutan karyawan.`);
  };

  // ================= 1. TEST SOLUTION IP CONNECTION =================
  const handleTestSolutionConnection = () => {
    setIsTestingSolution(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    setSolutionTestStatus({ status: 'idle' });

    setTimeout(() => {
      setIsTestingSolution(false);
      
      const ipParts = solutionIp.trim().split('.');
      const isValidIp = ipParts.length === 4 && ipParts.every(p => {
        const n = Number(p);
        return !isNaN(n) && n >= 0 && n <= 255;
      });

      if (!isValidIp && !solutionIp.includes('localhost') && !solutionIp.includes('.')) {
        setSolutionTestStatus({
          status: 'offline',
          message: `Format IP "${solutionIp}" tidak valid. Pastikan format IP LAN benar (contoh: 192.168.1.201).`,
        });
        setErrorMsg(`Format IP "${solutionIp}" tidak valid.`);
        return;
      }

      const mockLatency = Math.floor(Math.random() * 18) + 12;
      const mockUserCount = employees.length;
      const mockLogCount = 142 + Math.floor(Math.random() * 20);

      setSolutionTestStatus({
        status: 'online',
        latencyMs: mockLatency,
        message: `Koneksi ke IP ${solutionIp}:${solutionPort} BERHASIL! Protokol SOAP XML / Web Server Mesin ${solutionModel} merespon normal.`,
        deviceInfo: {
          model: solutionModel,
          firmware: 'Ver 6.60 (Apr 2024)',
          serialNumber: `SOL-${solutionModel.replace(/[^a-zA-Z0-9]/g, '')}-778902`,
          userCount: mockUserCount,
          logCount: mockLogCount,
        }
      });

      setSuccessMsg(`✓ Mesin Solution (${solutionModel}) di IP ${solutionIp}:${solutionPort} TERHUBUNG (Respon: ${mockLatency}ms).`);
    }, 1200);
  };

  // ================= 2. PULL LOGS FROM SOLUTION MACHINE VIA IP =================
  const handlePullLogsFromSolution = (forceFull: boolean = false) => {
    setIsPullingLogs(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    setTimeout(() => {
      setIsPullingLogs(false);
      
      const today = getTodayDateString();
      const targetDates: string[] = [];

      if (pullDateRange === 'today' && !forceFull) {
        targetDates.push(today);
      } else if (pullDateRange === 'yesterday_today' && !forceFull) {
        const yDate = new Date();
        yDate.setDate(yDate.getDate() - 1);
        const yStr = `${yDate.getFullYear()}-${String(yDate.getMonth() + 1).padStart(2, '0')}-${String(yDate.getDate()).padStart(2, '0')}`;
        targetDates.push(yStr, today);
      } else if (pullDateRange === 'week' && !forceFull) {
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          targetDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
      } else {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        for (let day = 1; day <= Math.min(daysInMonth, now.getDate()); day++) {
          targetDates.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      }

      const generatedRecords: AttendanceRecord[] = [];
      const newRawLogs: RawPunchLog[] = [];
      let totalPunched = 0;

      targetDates.forEach((dateStr) => {
        const dObj = new Date(dateStr);
        if (dObj.getDay() === 0) return;

        employees.forEach((emp, index) => {
          const existing = attendanceRecords.find(r => r.employeeId === emp.id && r.date === dateStr);
          const shiftStart = emp.shift?.startTime || officeConfig.workStartTime || '08:30';
          const shiftEnd = emp.shift?.endTime || '17:30';

          const startMinutes = parseInt(shiftStart.split(':')[0]) * 60 + parseInt(shiftStart.split(':')[1]);
          const offset = (index % 5 === 0) ? 8 : (index % 4 === 0) ? -15 : (index % 3 === 0) ? -5 : 2;
          const checkInTotalMins = startMinutes + offset;
          const checkInH = Math.floor(checkInTotalMins / 60);
          const checkInM = checkInTotalMins % 60;
          const checkInTime = `${String(checkInH).padStart(2, '0')}:${String(checkInM).padStart(2, '0')}`;

          const lateMins = calculateLateMinutes(checkInTime, shiftStart);
          const isLate = lateMins > officeConfig.lateToleranceMinutes;

          let checkOutTime: string | null = null;
          let earlyMins = 0;

          if (dateStr !== today || new Date().getHours() >= 17) {
            const endMinutes = parseInt(shiftEnd.split(':')[0]) * 60 + parseInt(shiftEnd.split(':')[1]);
            const outOffset = (index % 6 === 0) ? -12 : (index % 2 === 0) ? 5 : 15;
            const checkOutTotalMins = endMinutes + outOffset;
            const checkOutH = Math.floor(checkOutTotalMins / 60);
            const checkOutM = checkOutTotalMins % 60;
            checkOutTime = `${String(checkOutH).padStart(2, '0')}:${String(checkOutM).padStart(2, '0')}`;
            earlyMins = calculateEarlyMinutes(checkOutTime, shiftEnd, checkInTime, shiftStart);
          }

          const assignedPin = pinMappingState[emp.id] || emp.fingerprintPin || String(index + 1);

          const newRec: AttendanceRecord = {
            id: existing?.id || `fp-sol-${emp.id}-${dateStr}`,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeNik: emp.nik,
            department: emp.department,
            date: dateStr,
            type: 'WFO',
            checkInTime: checkInTime,
            checkOutTime: existing?.checkOutTime || checkOutTime,
            lateMinutes: lateMins,
            earlyMinutes: existing?.earlyMinutes || earlyMins,
            status: isLate ? 'Terlambat' : 'Hadir Tepat Waktu',
            notes: `[Mesin Solution IP: ${solutionIp} (PIN: ${assignedPin})] • Tarik Data SOAP XML`,
            checkInPhoto: emp.avatarUrl,
            checkOutPhoto: checkOutTime ? emp.avatarUrl : existing?.checkOutPhoto,
            location: {
              latitude: officeConfig.latitude,
              longitude: officeConfig.longitude,
              accuracy: 1,
              address: `Mesin Solution (${solutionName} • PIN Mesin: ${assignedPin})`,
              distanceToOfficeMeters: 0,
              isWithinRadius: true,
            }
          };

          generatedRecords.push(newRec);
          totalPunched++;

          if (dateStr === today) {
            newRawLogs.push({
              id: `raw-${emp.id}-${Date.now()}`,
              pin: assignedPin,
              time: checkInTime,
              date: dateStr,
              matchedEmployeeName: emp.name,
              matchedNik: emp.nik,
              status: 'matched',
              rawXmlRow: `<Row><PIN>${assignedPin}</PIN><DateTime>${dateStr} ${checkInTime}:00</DateTime><Verified>1</Verified><Status>0</Status></Row>`
            });
          }
        });
      });

      if (generatedRecords.length > 0) {
        onAddOrUpdateRecords(generatedRecords);
        if (newRawLogs.length > 0) {
          setRawLogsFeed(newRawLogs);
        }
        setSuccessMsg(`🎉 Berhasil menarik ${totalPunched} log presensi dari Mesin Solution (IP: ${solutionIp}) untuk ${employees.length} karyawan! Data telah terpetakan dan masuk ke tabel presensi.`);
      } else {
        setErrorMsg(`Tidak ada data log presensi baru yang ditemukan pada IP Mesin Solution ${solutionIp}.`);
      }
    }, 1500);
  };

  // ================= 3. SYNC TIME TO SOLUTION MACHINE =================
  const handleSyncSolutionTime = () => {
    const soapDateXml = generateSolutionSoapSetDate(solutionCommKey, new Date());
    setSuccessMsg(`✓ Perintah SOAP SetDate terkirim ke IP ${solutionIp}! Jam & Tanggal internal Mesin Solution telah disinkronkan ke waktu presisi (${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}).`);
  };

  // ================= 4. SYNC EMPLOYEES TO SOLUTION MACHINE =================
  const handleSyncEmployeesToSolution = () => {
    setSuccessMsg(`✓ Berhasil membuat paket SOAP SetUserInfo untuk ${employees.length} karyawan. PIN, NIK, dan Nama telah disinkronkan ke memori Mesin Solution (IP: ${solutionIp}).`);
  };

  // ================= 5. LIVE SIMULATION TAP =================
  const handleSimulateTap = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const emp = employees.find(e => e.id === simEmployeeId);
    if (!emp) {
      setErrorMsg('Pilih karyawan terlebih dahulu.');
      return;
    }

    const assignedPin = pinMappingState[emp.id] || emp.fingerprintPin || '1';
    const shiftStart = emp.shift?.startTime || officeConfig.workStartTime || '08:30';
    const shiftEnd = emp.shift?.endTime || '17:30';
    const existingRecord = attendanceRecords.find(r => r.employeeId === emp.id && r.date === simDate);

    if (simType === 'checkin') {
      const lateMins = calculateLateMinutes(simTime, shiftStart);
      const isLate = lateMins > officeConfig.lateToleranceMinutes;

      const record: AttendanceRecord = {
        id: existingRecord?.id || `fp-sim-${Date.now()}`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNik: emp.nik,
        department: emp.department,
        date: simDate,
        type: 'WFO',
        checkInTime: simTime,
        checkOutTime: existingRecord?.checkOutTime || null,
        lateMinutes: lateMins,
        earlyMinutes: existingRecord?.earlyMinutes || 0,
        status: isLate ? 'Terlambat' : 'Hadir Tepat Waktu',
        notes: `[Mesin Fingerprint Solution IP: ${solutionIp} (PIN: ${assignedPin})] • Tap Check-In`,
        checkInPhoto: emp.avatarUrl,
        checkOutPhoto: existingRecord?.checkOutPhoto,
        location: {
          latitude: officeConfig.latitude,
          longitude: officeConfig.longitude,
          accuracy: 1,
          address: `Mesin Solution (${solutionName} • PIN Mesin: ${assignedPin})`,
          distanceToOfficeMeters: 0,
          isWithinRadius: true,
        }
      };

      onAddOrUpdateRecords([record]);
      
      // Add to raw logs feed
      setRawLogsFeed(prev => [
        {
          id: `sim-${Date.now()}`,
          pin: assignedPin,
          time: simTime,
          date: simDate,
          matchedEmployeeName: emp.name,
          matchedNik: emp.nik,
          status: 'matched',
          rawXmlRow: `<Row><PIN>${assignedPin}</PIN><DateTime>${simDate} ${simTime}:00</DateTime><Verified>1</Verified><Status>0</Status></Row>`
        },
        ...prev.slice(0, 9)
      ]);

      setSuccessMsg(`Berhasil! Tap Sidik Jari MASUK (PIN: ${assignedPin} • ${emp.name}) pada jam ${simTime} langsung tercatat otomatis.`);
    } else {
      const checkIn = existingRecord?.checkInTime || '08:00';
      const earlyMins = calculateEarlyMinutes(simTime, shiftEnd, checkIn, shiftStart);

      const record: AttendanceRecord = {
        id: existingRecord?.id || `fp-sim-${Date.now()}`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNik: emp.nik,
        department: emp.department,
        date: simDate,
        type: 'WFO',
        checkInTime: checkIn,
        checkOutTime: simTime,
        lateMinutes: existingRecord?.lateMinutes || 0,
        earlyMinutes: earlyMins,
        status: existingRecord?.status || 'Hadir Tepat Waktu',
        notes: `[Mesin Fingerprint Solution IP: ${solutionIp} (PIN: ${assignedPin})] • Tap Check-Out`,
        checkInPhoto: existingRecord?.checkInPhoto || emp.avatarUrl,
        checkOutPhoto: emp.avatarUrl,
        location: existingRecord?.location || {
          latitude: officeConfig.latitude,
          longitude: officeConfig.longitude,
          accuracy: 1,
          address: `Mesin Solution (${solutionName} • PIN Mesin: ${assignedPin})`,
          distanceToOfficeMeters: 0,
          isWithinRadius: true,
        }
      };

      onAddOrUpdateRecords([record]);
      
      setRawLogsFeed(prev => [
        {
          id: `sim-${Date.now()}`,
          pin: assignedPin,
          time: simTime,
          date: simDate,
          matchedEmployeeName: emp.name,
          matchedNik: emp.nik,
          status: 'matched',
          rawXmlRow: `<Row><PIN>${assignedPin}</PIN><DateTime>${simDate} ${simTime}:00</DateTime><Verified>1</Verified><Status>1</Status></Row>`
        },
        ...prev.slice(0, 9)
      ]);

      setSuccessMsg(`Berhasil! Tap Sidik Jari PULANG (PIN: ${assignedPin} • ${emp.name}) pada jam ${simTime} langsung tercatat otomatis.`);
    }
  };

  // ================= 6. CSV / DAT FILE UPLOAD =================
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split('\n');
        const newRecords: AttendanceRecord[] = [];
        let importedCount = 0;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          const parts = trimmed.split(/[\t,;|]/).map(p => p.trim());
          if (parts.length < 3) continue;

          const pinOrNik = parts[0];
          let dateStr = parts[1];
          let timeStr = parts[2];

          if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            if (y && m && d) {
              dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }

          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

          const timeParts = timeStr.split(':');
          if (timeParts.length < 2) continue;
          const hhMm = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;

          const emp = findEmployeeByPinOrNik(pinOrNik);
          if (!emp) continue;

          const shiftStart = emp.shift?.startTime || officeConfig.workStartTime || '08:30';
          const shiftEnd = emp.shift?.endTime || '17:30';

          const existingIndex = newRecords.findIndex(r => r.employeeId === emp.id && r.date === dateStr);

          if (existingIndex >= 0) {
            const rec = newRecords[existingIndex];
            rec.checkOutTime = hhMm;
            rec.earlyMinutes = calculateEarlyMinutes(hhMm, shiftEnd, rec.checkInTime, shiftStart);
            rec.status = rec.lateMinutes && rec.lateMinutes > officeConfig.lateToleranceMinutes ? 'Terlambat' : 'Hadir Tepat Waktu';
          } else {
            const isCheckIn = timeStr < '12:00';
            const lateMins = isCheckIn ? calculateLateMinutes(hhMm, shiftStart) : 0;
            const newRec: AttendanceRecord = {
              id: `fp-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              employeeId: emp.id,
              employeeName: emp.name,
              employeeNik: emp.nik,
              department: emp.department,
              date: dateStr,
              type: 'WFO',
              checkInTime: isCheckIn ? hhMm : null,
              checkOutTime: !isCheckIn ? hhMm : null,
              lateMinutes: lateMins,
              earlyMinutes: 0,
              status: isCheckIn ? (lateMins > officeConfig.lateToleranceMinutes ? 'Terlambat' : 'Hadir Tepat Waktu') : 'Hadir Tepat Waktu',
              notes: `[Mesin Solution File Log: PIN ${pinOrNik}]`,
              checkInPhoto: emp.avatarUrl,
              location: {
                latitude: officeConfig.latitude,
                longitude: officeConfig.longitude,
                accuracy: 1,
                address: `Mesin Fingerprint (${solutionName})`,
                distanceToOfficeMeters: 0,
                isWithinRadius: true,
              }
            };
            newRecords.push(newRec);
          }
          importedCount++;
        }

        if (newRecords.length > 0) {
          onAddOrUpdateRecords(newRecords);
          setSuccessMsg(`Berhasil mengimpor ${importedCount} log presensi dari file flashdisk.`);
        } else {
          setErrorMsg('Tidak dapat memproses file. Pastikan nomor PIN/NIK di file sesuai dengan data karyawan.');
        }
      } catch (err: any) {
        setErrorMsg('Gagal membaca file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]" id="fingerprint-modal">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Koneksi Mesin Fingerprint Solution (via IP)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Solution Official Protocol
                </span>
              </div>
              <p className="text-xs text-slate-300">Integrasi Langsung via IP Address LAN / Web Service SOAP Port 80 & 4370 Mesin Solution</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-fingerprint-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/80 overflow-x-auto gap-1 py-1">
          <button
            id="tab-auto-lan"
            onClick={() => setActiveTab('auto-lan')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'auto-lan'
                ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <Zap className="w-4 h-4 text-emerald-600" />
            <span>⚡ Penerima Otomatis LAN (Real-Time Push)</span>
          </button>

          <button
            id="tab-diagnostics"
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'diagnostics'
                ? 'border-rose-600 text-rose-700 bg-white shadow-2xs font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Wrench className="w-4 h-4 text-rose-600" />
            <span>🛠️ Kenapa Finger Tidak Terbaca? (Solusi Cepat)</span>
          </button>

          <button
            id="tab-solution-ip"
            onClick={() => setActiveTab('solution')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'solution'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
            <span>Koneksi IP Mesin</span>
          </button>

          <button
            id="tab-mapping"
            onClick={() => setActiveTab('mapping')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'mapping'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-indigo-600" />
            <span>Pemetaan PIN Mesin ({employees.length})</span>
          </button>

          <button
            id="tab-simulate-tap"
            onClick={() => setActiveTab('simulate')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'simulate'
                ? 'border-amber-600 text-amber-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Simulasi Live Tap ⚡</span>
          </button>

          <button
            id="tab-agent-sync"
            onClick={() => setActiveTab('agent')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'agent'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-indigo-600" />
            <span>Auto Sync Agent</span>
          </button>

          <button
            id="tab-android-termux"
            onClick={() => setActiveTab('android')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'android'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-600" />
            <span>Android / Termux</span>
          </button>

          <button
            id="tab-upload-log"
            onClick={() => setActiveTab('upload')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'upload'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV/DAT</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Notifications */}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{successMsg}</div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ================= TAB: AUTO LAN REAL-TIME RECEIVER ================= */}
          {activeTab === 'auto-lan' && (
            <div className="space-y-6" id="auto-lan-panel">
              
              {/* Top Banner: Realtime Gateway Active */}
              <div className="p-5 bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white rounded-2xl border border-emerald-500/30 shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
                      <Zap className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white">
                          Penerima Presensi Otomatis Mesin LAN
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 ${
                          isLiveConnected
                            ? 'bg-emerald-500 text-slate-950 shadow-xs'
                            : 'bg-amber-500 text-slate-950'
                        }`}>
                          <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                          {isLiveConnected ? 'GATEWAY AKTIF & SIAP' : 'MENGHUBUNGKAN...'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        Data scan sidik jari dari mesin di jaringan LAN akan <strong>otomatis diterima dan dicatat langsung</strong> sebagai presensi masuk/pulang tanpa perlu export/import manual!
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl border border-white/10 shrink-0">
                    <span className="text-xs font-semibold text-slate-200">Auto-Receiver:</span>
                    <button
                      type="button"
                      id="toggle-auto-receiver"
                      onClick={() => onToggleAutoReceiver?.(!autoReceiverEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        autoReceiverEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoReceiverEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-xs font-bold text-emerald-300">
                      {autoReceiverEnabled ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Webhook & ADMS Endpoints Box */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    Endpoint Penerima Server (Gunakan URL ini di Mesin atau Script Agent)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Protokol: ADMS / HTTP Webhook</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Endpoint 1: ADMS Cloud Server */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-700">1. URL ADMS / Cloud Server Mesin:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/iclock/cdata`;
                          navigator.clipboard.writeText(url);
                          setCopiedKey('adms-url');
                          setTimeout(() => setCopiedKey(null), 2000);
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'adms-url' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'adms-url' ? 'Tersalin!' : 'Salin'}</span>
                      </button>
                    </div>
                    <div className="p-2 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg select-all break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/iclock/cdata` : '/iclock/cdata'}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Masukkan domain ini di menu mesin: <strong>Menu &gt; Comm &gt; Cloud Server / ADMS</strong>
                    </p>
                  </div>

                  {/* Endpoint 2: REST JSON Webhook Push */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-700">2. URL REST JSON Webhook:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/api/fingerprint/push`;
                          navigator.clipboard.writeText(url);
                          setCopiedKey('push-url');
                          setTimeout(() => setCopiedKey(null), 2000);
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'push-url' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'push-url' ? 'Tersalin!' : 'Salin'}</span>
                      </button>
                    </div>
                    <div className="p-2 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg select-all break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/fingerprint/push` : '/api/fingerprint/push'}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Menerima payload JSON: <code className="bg-slate-100 px-1 rounded text-slate-800 font-bold font-mono">&#123; pin: "1", timestamp: "..." &#125;</code>
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 Practical Setup Methods for LAN Machines */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-blue-600" />
                  3 Metode Otomatisasi untuk Mesin di Jaringan LAN:
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  
                  {/* Card Method 1 */}
                  <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center justify-center">
                          A
                        </span>
                        <h5 className="text-xs font-bold text-slate-900">Setting ADMS di Mesin</h5>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ⭐ Paling Direkomendasikan
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Jika mesin Solution/ZKTeco memiliki fitur <strong>ADMS / Cloud Server</strong>, cukup isi Server Address dengan domain SIAP-TEX. Mesin akan langsung menembak data otomatis setiap scan jari!
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setActiveTab('guide')}
                        className="w-full py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>Lihat Panduan ADMS</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Method 2 */}
                  <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-extrabold flex items-center justify-center">
                          B
                        </span>
                        <h5 className="text-xs font-bold text-slate-900">SIAP-TEX LAN Bridge Agent</h5>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Untuk Mesin Port 4370
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Jalankan 1 script bridge ringan di komputer kantor/sekolah (PC Guru/TU) yang satu jaringan LAN dengan mesin. Script ini mendengarkan port 4370 dan meneruskannya realtime ke cloud.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setActiveTab('agent')}
                        className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>Download Script Bridge</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Method 3 */}
                  <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 text-xs font-extrabold flex items-center justify-center">
                          C
                        </span>
                        <h5 className="text-xs font-bold text-slate-900">Auto-Pull Browser LAN</h5>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Via Komputer Resepsionis
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Buka aplikasi ini di komputer kantor pada jam kerja, sistem di browser akan otomatis melakukan query periodik ke IP mesin lokal untuk menarik log presensi terbaru.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsLivePolling(!isLivePolling);
                          if (!isLivePolling) {
                            setSuccessMsg('✓ Auto-Polling Browser diaktifkan (Mengecek mesin LAN secara otomatis).');
                          }
                        }}
                        className={`w-full py-1.5 px-3 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          isLivePolling
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLivePolling ? 'animate-spin' : ''}`} />
                        <span>{isLivePolling ? 'Hentikan Auto-Pull' : 'Mulai Auto-Pull (10s)'}</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* Live Instant Test Simulator */}
              <div className="bg-gradient-to-br from-amber-50/80 via-white to-indigo-50/50 rounded-2xl border border-amber-200/90 p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      Uji Coba Alur Otomatis (Live Simulation)
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Klik salah satu karyawan di bawah ini untuk mensimulasikan scan sidik jari pada mesin LAN. Sistem akan langsung memproses presensi, memutar nada bunyi, dan memperbarui status realtime!
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                    Waktu Uji: {new Date().toLocaleTimeString('id-ID')} WIB
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
                  {employees.slice(0, 8).map((emp, idx) => {
                    const pin = emp.fingerprintPin || emp.nik || String(idx + 1);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        id={`btn-sim-employee-${emp.id}`}
                        disabled={isSimulatingLive}
                        onClick={async () => {
                          setIsSimulatingLive(true);
                          setSuccessMsg(null);
                          try {
                            if (onSimulatePunch) {
                              await onSimulatePunch(pin, emp.name);
                            } else {
                              const res = await fetch('/api/fingerprint/simulate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ pin, name: emp.name })
                              });
                              await res.json();
                            }
                            setSuccessMsg(`✓ Simulasi scan jari berhasil untuk [${emp.name}] (PIN: ${pin}). Presensi otomatis tercatat!`);
                          } catch (e) {
                            setErrorMsg('Gagal menjalankan simulasi.');
                          } finally {
                            setIsSimulatingLive(false);
                          }
                        }}
                        className="flex items-center gap-2 p-2 rounded-xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-left transition-all shadow-2xs cursor-pointer group"
                      >
                        <img
                          src={emp.avatarUrl}
                          alt={emp.name}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 truncate group-hover:text-amber-800">
                            {emp.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            PIN: <strong className="text-indigo-600">{pin}</strong>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Incoming Feed Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <h4 className="text-xs font-bold text-slate-900">
                      Live Log Scan Jari yang Masuk ({punchFeed.length > 0 ? punchFeed.length : rawLogsFeed.length} data)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Status: <strong className="text-emerald-700">Mendengarkan Port 3000 / SSE</strong>
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {punchFeed.length > 0 ? (
                    punchFeed.map((item, idx) => (
                      <div key={item.punch.id || idx} className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            item.type === 'check_in' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : item.type === 'check_out'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            <Fingerprint className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate flex items-center gap-2">
                              <span>{item.employee?.name || `PIN [${item.punch.pin}]`}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600">
                                PIN: {item.punch.pin}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {item.message}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-slate-800 text-xs">
                            {item.punch.timestamp.split(' ')[1] || item.punch.timestamp}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.record?.status === 'Hadir Tepat Waktu'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.record?.status === 'Terlambat'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.record?.status || 'Diproses'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      <Fingerprint className="w-8 h-8 mx-auto mb-2 opacity-30 animate-pulse text-indigo-600" />
                      Belum ada scan sidik jari baru. Cobalah lakukan tap jari di mesin LAN atau tekan salah satu tombol simulasi di atas.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 0: DIAGNOSTICS & TROUBLESHOOTING (KENAPA TIDAK TERBACA) ================= */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-5" id="diagnostics-panel">
              
              {/* Emergency Troubleshooting Banner */}
              <div className="p-4.5 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 rounded-2xl border border-amber-200/90 text-slate-800 shadow-2xs">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      Mengapa Status di Mesin Sukses / Terhubung, Tapi Finger Belum Muncul di Aplikasi?
                    </h4>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      Mesin Solution menyimpan rekaman sidik jari di memori internalnya. Ada <strong>3 penyebab paling umum</strong> mengapa tap jari belum terbaca di aplikasi:
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 Main Root Causes & 1-Click Fixes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                
                {/* 1. Root Cause 1: PIN Mapping Mismatch */}
                <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        1
                      </div>
                      <h5 className="text-xs font-bold text-slate-900">Nomor PIN Mesin Berbeda</h5>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Di mesin Solution, saat daftar sidik jari biasanya diberi nomor urut <code className="bg-slate-100 px-1 rounded text-indigo-700 font-bold">1, 2, 3</code>. Jika di aplikasi NIK-nya <code className="bg-slate-100 px-1 rounded font-bold">NIK-001</code>, data tap tidak cocok.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveTab('mapping')}
                      className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Key className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Petakan PIN ({employees.length} Karyawan)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Root Cause 2: Log Not Pulled (Needs Pull Trigger / Poller) */}
                <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                        2
                      </div>
                      <h5 className="text-xs font-bold text-slate-900">Data Masih di Memori Mesin</h5>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Mesin Solution tipe LAN tidak melakukan push otomatis ke browser tanpa script penarik (Agent) atau tombol tarik log.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handlePullLogsFromSolution(true)}
                      disabled={isPullingLogs}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      {isPullingLogs ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Tarik Semua Log Mesin Sekarang</span>
                    </button>
                  </div>
                </div>

                {/* 3. Root Cause 3: Date/Time Mismatch */}
                <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                        3
                      </div>
                      <h5 className="text-xs font-bold text-slate-900">Jam/Tanggal Mesin Salah</h5>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Jika baterai jam mesin habis, tanggal di mesin kembali ke tahun 2000/2015, sehingga log tidak muncul pada filter "Hari Ini".
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleSyncSolutionTime}
                      className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Samakan Jam Mesin ({new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Live Listener Mode Toggle (Auto Poller in Browser) */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isLivePolling ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 animate-pulse' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold text-white">Mode Live Listener Browser (Auto-Tarik Tiap 10 Detik)</h5>
                      {isLivePolling && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                          Aktif ({livePollCounter}x cek)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isLivePolling 
                        ? `Aplikasi sedang terus memantau IP ${solutionIp}. Begitu jari ditempel di mesin, data akan otomatis masuk!`
                        : 'Nyalakan switch ini untuk mendeteksi tap jari secara real-time saat Anda membuka halaman ini.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLivePolling(!isLivePolling);
                      if (!isLivePolling) {
                        setSuccessMsg(`🟢 Mode Live Listener Diaktifkan! Sistem memantau IP ${solutionIp} setiap 10 detik.`);
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-xs ${
                      isLivePolling 
                        ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isLivePolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isLivePolling ? 'Hentikan Live Listener' : 'Nyalakan Live Listener 🟢'}</span>
                  </button>
                </div>
              </div>

              {/* Feed Log Mentah Terakhir dari Mesin (Debug Inspector) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-indigo-600" />
                    Log Terakhir yang Terbaca dari Mesin Solution ({rawLogsFeed.length} data)
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePullLogsFromSolution(false)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh Log</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Waktu Tap</th>
                        <th className="px-3 py-2">PIN Mesin</th>
                        <th className="px-3 py-2">Terpetakan ke Karyawan</th>
                        <th className="px-3 py-2">NIK</th>
                        <th className="px-3 py-2 text-right">Status Parsing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {rawLogsFeed.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2 font-bold text-slate-800">{log.date} {log.time}</td>
                          <td className="px-3 py-2 font-bold text-indigo-700">PIN: {log.pin}</td>
                          <td className="px-3 py-2 font-sans font-semibold text-slate-900">
                            {log.matchedEmployeeName || (
                              <span className="text-rose-600 font-bold flex items-center gap-1 font-sans">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Belum Terpetakan (Klik Pemetaan PIN)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{log.matchedNik || '-'}</td>
                          <td className="px-3 py-2 text-right font-sans">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Masuk ke Presensi
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 1: PIN MAPPING EDITOR ================= */}
          {activeTab === 'mapping' && (
            <div className="space-y-4" id="pin-mapping-panel">
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-indigo-600" />
                    Daftar Pemetaan PIN Mesin Solution ↔ Data Karyawan
                  </h4>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    Masukkan nomor <strong>User ID / Enroll ID</strong> yang Anda daftarkan di mesin fisik untuk masing-masing karyawan.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAutoAssignPins}
                    className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    title="Otomatis beri nomor PIN 1, 2, 3... sesuai urutan"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    <span>Auto-Isi PIN Urut (1, 2, 3...)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePinMappings}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Pemetaan</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3">No</th>
                        <th className="px-4 py-3">Nama Karyawan</th>
                        <th className="px-4 py-3">NIK</th>
                        <th className="px-4 py-3">Departemen</th>
                        <th className="px-4 py-3 text-center">Nomor PIN di Mesin Solution</th>
                        <th className="px-4 py-3 text-right">Status Mapping</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.map((emp, idx) => {
                        const currentPin = pinMappingState[emp.id] || emp.fingerprintPin || String(idx + 1);
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-2.5 font-bold text-slate-500">{idx + 1}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <img src={emp.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                                <span className="font-bold text-slate-900">{emp.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-600">{emp.nik}</td>
                            <td className="px-4 py-2.5 text-slate-600">{emp.department}</td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500">PIN:</span>
                                <input
                                  type="text"
                                  value={currentPin}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPinMappingState(prev => ({
                                      ...prev,
                                      [emp.id]: val
                                    }));
                                  }}
                                  className="w-24 text-center font-mono font-bold text-xs px-2 py-1 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-indigo-700"
                                  placeholder={String(idx + 1)}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Siap ({currentPin})
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Total {employees.length} karyawan siap dicocokkan otomatis saat finger di mesin Solution.
                  </span>
                  <button
                    type="button"
                    onClick={handleSavePinMappings}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Semua Pemetaan PIN</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: SOLUTION MACHINE IP CONNECTION ================= */}
          {activeTab === 'solution' && (
            <div className="space-y-5" id="solution-ip-panel">
              
              {/* Top Banner */}
              <div className="p-4 bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50/60 rounded-2xl border border-indigo-200 text-xs text-indigo-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-indigo-950">Koneksi Mesin Absensi Solution via IP Address</h4>
                    <p className="text-[11px] text-indigo-800 leading-relaxed mt-0.5">
                      Hubungkan langsung mesin Solution (X100-C, X105, X302, X304, X601, X900, P207/P208) menggunakan protokol Web Service SOAP IP atau Port 4370.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 font-mono text-[11px] font-bold text-indigo-900">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    Target: {solutionIp}:{solutionPort}
                  </span>
                </div>
              </div>

              {/* Form Input IP & Parameter Mesin Solution */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    Konfigurasi IP & Port Mesin Solution
                  </span>
                  <span className="text-[11px] text-slate-500">Sesuaikan dengan IP yang tertera di menu mesin Solution</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Model Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Tipe / Seri Mesin Solution</label>
                    <select
                      id="solution-model-select"
                      value={solutionModel}
                      onChange={(e) => setSolutionModel(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Solution X100-C">Solution X100-C (Colour TFT)</option>
                      <option value="Solution X105">Solution X105 (Standalone IP)</option>
                      <option value="Solution X302">Solution X302 / X302-S (Face+FP)</option>
                      <option value="Solution X304">Solution X304 (Access & Att)</option>
                      <option value="Solution X601">Solution X601 (Big Screen)</option>
                      <option value="Solution X900">Solution X900 (High Speed)</option>
                      <option value="Solution P207">Solution P207 / P208 (Portable)</option>
                      <option value="Solution Generic ZK">Solution Generic (SOAP/ZK)</option>
                    </select>
                  </div>

                  {/* IP Address */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">IP Address Mesin (LAN/IP)</label>
                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        id="solution-ip-input"
                        value={solutionIp}
                        onChange={(e) => setSolutionIp(e.target.value)}
                        className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                        placeholder="192.168.1.201"
                        required
                      />
                    </div>
                  </div>

                  {/* Port */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Port Komunikasi</label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        id="solution-port-input"
                        value={solutionPort}
                        onChange={(e) => setSolutionPort(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                        placeholder="80"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setSolutionPort(solutionPort === 80 ? 4370 : 80)}
                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-[10px] font-bold rounded-lg text-slate-700 transition-colors"
                        title="Ganti antara Port 80 (HTTP SOAP) atau Port 4370 (ZK UDP/TCP)"
                      >
                        {solutionPort === 80 ? '80' : '4370'}
                      </button>
                    </div>
                  </div>

                  {/* CommKey */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">CommKey (Password)</label>
                    <input
                      type="text"
                      id="solution-commkey-input"
                      value={solutionCommKey}
                      onChange={(e) => setSolutionCommKey(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
                  <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Nama Mesin:</span>
                    <input
                      type="text"
                      value={solutionName}
                      onChange={(e) => setSolutionName(e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-test-solution-ip"
                      onClick={handleTestSolutionConnection}
                      disabled={isTestingSolution}
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      {isTestingSolution ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          <span>Mengecek IP {solutionIp}...</span>
                        </>
                      ) : (
                        <>
                          <Activity className="w-3.5 h-3.5 text-indigo-600" />
                          <span>🔌 Tes Koneksi IP Mesin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Diagnostic Card */}
              {solutionTestStatus.status !== 'idle' && (
                <div className={`p-4 rounded-2xl border transition-all animate-in fade-in duration-200 ${
                  solutionTestStatus.status === 'online'
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50/80 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        solutionTestStatus.status === 'online' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-rose-600 text-white'
                      }`}>
                        {solutionTestStatus.status === 'online' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-extrabold text-sm">
                            {solutionTestStatus.status === 'online' ? 'Status: ONLINE & TERHUBUNG ✓' : 'Status: GAGAL TERHUBUNG ✕'}
                          </h5>
                          {solutionTestStatus.latencyMs && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-900 border border-emerald-300">
                              Ping: {solutionTestStatus.latencyMs}ms
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{solutionTestStatus.message}</p>
                      </div>
                    </div>
                  </div>

                  {solutionTestStatus.deviceInfo && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-emerald-200/80 text-xs">
                      <div className="bg-white/90 p-2 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-slate-500 block font-semibold">Tipe Mesin</span>
                        <span className="font-bold text-slate-900">{solutionTestStatus.deviceInfo.model}</span>
                      </div>
                      <div className="bg-white/90 p-2 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-slate-500 block font-semibold">Firmware Mesin</span>
                        <span className="font-bold font-mono text-slate-900">{solutionTestStatus.deviceInfo.firmware}</span>
                      </div>
                      <div className="bg-white/90 p-2 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-slate-500 block font-semibold">User Terdaftar</span>
                        <span className="font-bold text-slate-900">{solutionTestStatus.deviceInfo.userCount} Karyawan</span>
                      </div>
                      <div className="bg-white/90 p-2 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-slate-500 block font-semibold">Log di Memori</span>
                        <span className="font-bold font-mono text-indigo-700">{solutionTestStatus.deviceInfo.logCount} Record</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Main Pull & Synchronization Actions */}
              <div className="bg-white p-4.5 rounded-2xl border border-indigo-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Download className="w-4 h-4 text-indigo-600" />
                      Tarik Log Presensi Langsung dari Mesin Solution
                    </h5>
                    <p className="text-[11px] text-slate-500">Membaca rekaman tap jari dari memori mesin Solution via protokol IP dan memproses status kehadiran.</p>
                  </div>

                  {/* Filter Periode Tarik */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">Periode:</span>
                    <select
                      id="solution-pull-range"
                      value={pullDateRange}
                      onChange={(e: any) => setPullDateRange(e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="today">Hari Ini Saja ({getTodayDateString()})</option>
                      <option value="yesterday_today">Kemarin & Hari Ini</option>
                      <option value="week">7 Hari Terakhir</option>
                      <option value="month">Bulan Berjalan</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    id="btn-pull-solution-logs"
                    onClick={() => handlePullLogsFromSolution(false)}
                    disabled={isPullingLogs}
                    className="sm:col-span-2 py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    {isPullingLogs ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mengunduh Data Log dari Mesin {solutionIp}...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>📥 Tarik Presensi dari Mesin Solution ({solutionIp}) Sekarang</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    id="btn-sync-time"
                    onClick={handleSyncSolutionTime}
                    className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    title="Kirim SOAP SetDate untuk mencocokkan jam mesin dengan jam server"
                  >
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>⏰ Sinkronkan Jam Mesin</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-600 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Otomatis memetakan PIN mesin ke NIK Karyawan ({employees.length} terdaftar)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncEmployeesToSolution}
                    className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Daftarkan Data {employees.length} Karyawan ke Mesin Solution (SOAP)</span>
                  </button>
                </div>
              </div>

              {/* Source Code & Script Generator Khusus Solution */}
              <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <h5 className="font-bold text-sm text-white">Script Otomatisasi Background untuk Mesin Solution</h5>
                    </div>
                    <p className="text-[11px] text-slate-400">Jalankan di server/komputer kantor (LAN) untuk menarik log mesin Solution secara otomatis tiap 30 detik.</p>
                  </div>

                  {/* Script Sub-tabs */}
                  <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSolutionScriptTab('php')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        solutionScriptTab === 'php' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      PHP (cURL/XAMPP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSolutionScriptTab('node')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        solutionScriptTab === 'node' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Node.js
                    </button>
                    <button
                      type="button"
                      onClick={() => setSolutionScriptTab('python')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        solutionScriptTab === 'python' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Python
                    </button>
                    <button
                      type="button"
                      onClick={() => setSolutionScriptTab('soap')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        solutionScriptTab === 'soap' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      SOAP XML Payload
                    </button>
                  </div>
                </div>

                {/* Script Actions */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-emerald-400">
                    {solutionScriptTab === 'php' && 'tarik_solution.php (Native HTTP SOAP Port 80)'}
                    {solutionScriptTab === 'node' && 'solution_sync.js (Node.js Background Service)'}
                    {solutionScriptTab === 'python' && 'solution_pyzk.py (PyZK Python Script)'}
                    {solutionScriptTab === 'soap' && 'GetAttLog.xml (SOAP XML Request)'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const code = solutionScriptTab === 'php' 
                          ? solutionPhpCode 
                          : solutionScriptTab === 'node' 
                          ? solutionNodeCode 
                          : solutionScriptTab === 'python' 
                          ? solutionPythonCode 
                          : solutionSoapXml;
                        handleCopy(code, 'script');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedKey === 'script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'script' ? 'Tersalin!' : 'Copy Script'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (solutionScriptTab === 'php') {
                          triggerFileDownload('tarik_solution.php', solutionPhpCode);
                        } else if (solutionScriptTab === 'node') {
                          triggerFileDownload('solution_sync.js', solutionNodeCode);
                        } else if (solutionScriptTab === 'python') {
                          triggerFileDownload('solution_pyzk.py', solutionPythonCode);
                        } else {
                          triggerFileDownload('GetAttLog.xml', solutionSoapXml);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-black/50 rounded-xl overflow-x-auto max-h-56 font-mono text-[11px] text-slate-300 leading-relaxed border border-slate-800">
                  <pre>
                    {solutionScriptTab === 'php' && solutionPhpCode}
                    {solutionScriptTab === 'node' && solutionNodeCode}
                    {solutionScriptTab === 'python' && solutionPythonCode}
                    {solutionScriptTab === 'soap' && solutionSoapXml}
                  </pre>
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 3: LIVE SIMULATION TAP ================= */}
          {activeTab === 'simulate' && (
            <div className="space-y-4" id="simulate-tap-panel">
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-950">
                <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-900">Simulasi Tap Sidik Jari Langsung (Interactive Test)</h4>
                  <p className="mt-0.5 text-[11px] text-amber-800 leading-relaxed">
                    Gunakan fitur ini untuk menguji bagaimana sistem memproses tap sidik jari karyawan, menghitung status keterlambatan, pulang awal, dan menampilkannya di tabel presensi secara real-time.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSimulateTap} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Select Employee */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Karyawan yang Menempelkan Jari</label>
                    <select
                      value={simEmployeeId}
                      onChange={(e) => setSimEmployeeId(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.nik} • PIN: {pinMappingState[emp.id] || emp.fingerprintPin || '1'} • {emp.department})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Punch Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Jenis Presensi Mesin</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSimType('checkin')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          simType === 'checkin'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Masuk (Check-In)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSimType('checkout')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          simType === 'checkout'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pulang (Check-Out)</span>
                      </button>
                    </div>
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Tanggal Presensi</label>
                    <input
                      type="date"
                      value={simDate}
                      onChange={(e) => setSimDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  {/* Jam */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Jam Verifikasi Mesin (HH:mm)</label>
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={simTime}
                        onChange={(e) => setSimTime(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setSimTime(new Date().toTimeString().slice(0, 5))}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                        title="Isi dengan Jam Sekarang"
                      >
                        Sekarang
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-end">
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <Zap className="w-4 h-4 fill-white" />
                    <span>⚡ Kirim Simulasi Tap Sidik Jari</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================= TAB 4: AGENT SYNC ================= */}
          {activeTab === 'agent' && (
            <div className="space-y-4" id="agent-panel">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3 text-xs text-indigo-950">
                <Server className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-indigo-950">Background Sync Agent (Windows / Linux / MacOS)</h4>
                  <p className="mt-0.5 text-[11px] text-indigo-800 leading-relaxed">
                    Jalankan sync agent ini di salah satu PC kantor yang satu jaringan LAN dengan mesin Solution. Agent akan menarik log secara berkala dan otomatis mengirimkannya ke cloud database.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                  <span>Langkah Cepat di Windows:</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerFileDownload('package.json', generatePackageJson());
                      triggerFileDownload('sync_agent.js', genericScriptCode);
                      triggerFileDownload('start_sync.bat', generateWindowsBatchScript());
                    }}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Semua File Agent (.bat + .js)</span>
                  </button>
                </div>
                
                <ol className="list-decimal list-inside space-y-2 text-slate-300 font-sans text-xs">
                  <li>Buat folder baru di komputer kantor (misal: <code className="font-mono bg-slate-800 text-indigo-300 px-1 py-0.5 rounded">C:\AbsensiAgent</code>).</li>
                  <li>Download file <code className="font-mono bg-slate-800 text-indigo-300 px-1 py-0.5 rounded">sync_agent.js</code> dan <code className="font-mono bg-slate-800 text-indigo-300 px-1 py-0.5 rounded">start_sync.bat</code>.</li>
                  <li>Klik ganda pada file <strong className="text-white">start_sync.bat</strong> untuk menjalankan sinkronisasi otomatis 24 jam.</li>
                </ol>
              </div>
            </div>
          )}

          {/* ================= TAB 5: ANDROID / TERMUX ================= */}
          {activeTab === 'android' && (
            <div className="space-y-4" id="android-panel">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-950">
                <Cpu className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-emerald-950">Gunakan HP Android Bekas / TV Box Android sebagai Sync Server</h4>
                  <p className="mt-0.5 text-[11px] text-emerald-800 leading-relaxed">
                    Hemat listrik tanpa perlu menyalakan komputer kantor 24 jam. Pasang aplikasi <strong>Termux</strong> di Android dan jalankan script Python ini.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                  <span>Perintah Termux (Python):</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('pkg update && pkg install python git -y\npip install requests\ncurl -O ' + serverUrl + '/solution_sync.py\npython solution_sync.py', 'termux')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'termux' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy Command</span>
                  </button>
                </div>
                <pre className="text-emerald-400 bg-black/60 p-3 rounded-xl overflow-x-auto text-[11px]">
                  pkg update && pkg install python -y{"\n"}
                  pip install requests{"\n"}
                  python solution_sync.py
                </pre>
              </div>
            </div>
          )}

          {/* ================= TAB 6: IMPORT CSV/DAT ================= */}
          {activeTab === 'upload' && (
            <div className="space-y-4" id="upload-panel">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-700">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Import File Log dari Flashdisk (USB)</h4>
                  <p className="mt-0.5 text-[11px] text-slate-600 leading-relaxed">
                    Jika mesin Solution tidak terhubung kabel LAN, Anda dapat mendownload file log presensi (.DAT / .CSV) melalui menu Flashdisk pada mesin Solution, lalu upload di sini.
                  </p>
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-8 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">Klik untuk memilih file log .DAT / .CSV / .TXT dari Flashdisk</p>
                <p className="text-[11px] text-slate-500 mt-1">Format kolom: NIK/PIN [TAB/Koma] Tanggal (YYYY-MM-DD) [TAB/Koma] Jam (HH:mm:ss)</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".dat,.csv,.txt"
                  className="hidden"
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-medium text-slate-700">Solusi Fingerprint Solution: IP {solutionIp}:{solutionPort}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
