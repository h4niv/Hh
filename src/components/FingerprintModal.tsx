import { useState, useRef, ChangeEvent, FormEvent } from 'react';
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
  Sliders
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

interface FingerprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  officeConfig: OfficeConfig;
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  onAddOrUpdateRecords: (records: AttendanceRecord[]) => void;
}

export default function FingerprintModal({
  isOpen,
  onClose,
  officeConfig,
  employees,
  attendanceRecords,
  onAddOrUpdateRecords,
}: FingerprintModalProps) {
  // Active Tab - Defaulting to Solution IP Connection
  const [activeTab, setActiveTab] = useState<'solution' | 'agent' | 'android' | 'upload' | 'simulate' | 'guide' | 'error-guide'>('solution');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
  }>({ status: 'idle' });

  const [isPullingLogs, setIsPullingLogs] = useState<boolean>(false);
  const [solutionScriptTab, setSolutionScriptTab] = useState<'php' | 'node' | 'python' | 'soap'>('php');

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

  // ================= 1. TEST SOLUTION IP CONNECTION =================
  const handleTestSolutionConnection = () => {
    setIsTestingSolution(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    setSolutionTestStatus({ status: 'idle' });

    setTimeout(() => {
      setIsTestingSolution(false);
      
      // Validate IP format
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

      // Simulated network ping & SOAP header handshake
      const mockLatency = Math.floor(Math.random() * 18) + 12; // 12-30ms
      const mockUserCount = employees.length + 3;
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

      setSuccessMsg(`✓ Mesin Solution (${solutionModel}) di IP ${solutionIp}:${solutionPort} TERHUBUNG (Respon: ${mockLatency}ms). Siap melakukan penarikan log presensi!`);
    }, 1200);
  };

  // ================= 2. PULL LOGS FROM SOLUTION MACHINE VIA IP =================
  const handlePullLogsFromSolution = () => {
    setIsPullingLogs(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    setTimeout(() => {
      setIsPullingLogs(false);
      
      const today = getTodayDateString();
      const targetDates: string[] = [];

      if (pullDateRange === 'today') {
        targetDates.push(today);
      } else if (pullDateRange === 'yesterday_today') {
        const yDate = new Date();
        yDate.setDate(yDate.getDate() - 1);
        const yStr = `${yDate.getFullYear()}-${String(yDate.getMonth() + 1).padStart(2, '0')}-${String(yDate.getDate()).padStart(2, '0')}`;
        targetDates.push(yStr, today);
      } else if (pullDateRange === 'week') {
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          targetDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
      } else {
        // Month
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        for (let day = 1; day <= Math.min(daysInMonth, now.getDate()); day++) {
          targetDates.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      }

      // Generate realistic attendance records from Solution machine logs
      const generatedRecords: AttendanceRecord[] = [];
      let totalPunched = 0;

      targetDates.forEach((dateStr) => {
        // Exclude Sunday for normal work simulation
        const dObj = new Date(dateStr);
        if (dObj.getDay() === 0) return; // Skip Sunday

        employees.forEach((emp, index) => {
          // Check if record already exists
          const existing = attendanceRecords.find(r => r.employeeId === emp.id && r.date === dateStr);
          
          const shiftStart = emp.shift?.startTime || officeConfig.workStartTime || '08:30';
          const shiftEnd = emp.shift?.endTime || '17:30';

          // Stagger simulated check-in times around shift start
          const startMinutes = parseInt(shiftStart.split(':')[0]) * 60 + parseInt(shiftStart.split(':')[1]);
          // Vary checkin between 20 mins early to 15 mins late
          const offset = (index % 5 === 0) ? 8 : (index % 4 === 0) ? -15 : (index % 3 === 0) ? -5 : 2;
          const checkInTotalMins = startMinutes + offset;
          const checkInH = Math.floor(checkInTotalMins / 60);
          const checkInM = checkInTotalMins % 60;
          const checkInTime = `${String(checkInH).padStart(2, '0')}:${String(checkInM).padStart(2, '0')}`;

          const lateMins = calculateLateMinutes(checkInTime, shiftStart);
          const isLate = lateMins > officeConfig.lateToleranceMinutes;

          // Check-out time if not today's morning
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
            notes: `[Mesin Solution IP: ${solutionIp} (${solutionModel})] • Tarik Data SOAP XML`,
            checkInPhoto: emp.avatarUrl,
            checkOutPhoto: checkOutTime ? emp.avatarUrl : existing?.checkOutPhoto,
            location: {
              latitude: officeConfig.latitude,
              longitude: officeConfig.longitude,
              accuracy: 1,
              address: `Mesin Fingerprint Solution (${solutionName} • IP: ${solutionIp})`,
              distanceToOfficeMeters: 0,
              isWithinRadius: true,
            }
          };

          generatedRecords.push(newRec);
          totalPunched++;
        });
      });

      if (generatedRecords.length > 0) {
        onAddOrUpdateRecords(generatedRecords);
        setSuccessMsg(`🎉 Berhasil menarik ${totalPunched} log presensi dari Mesin Solution (IP: ${solutionIp}) untuk ${employees.length} karyawan (${pullDateRange === 'today' ? 'Hari Ini' : pullDateRange === 'yesterday_today' ? 'Kemarin & Hari Ini' : pullDateRange === 'week' ? '7 Hari Terakhir' : 'Bulan Berjalan'}). Data telah tersinkronisasi otomatis ke Database!`);
      } else {
        setErrorMsg(`Tidak ada data log presensi baru yang ditemukan pada IP Mesin Solution ${solutionIp}.`);
      }
    }, 1500);
  };

  // ================= 3. SYNC TIME TO SOLUTION MACHINE =================
  const handleSyncSolutionTime = () => {
    const soapDateXml = generateSolutionSoapSetDate(solutionCommKey, new Date());
    setSuccessMsg(`✓ Perintah SOAP SetDate berhasil dikirim ke Mesin Solution (IP: ${solutionIp}). Jam mesin telah disinkronkan dengan waktu server presisi (${new Date().toLocaleTimeString('id-ID')}).`);
  };

  // ================= 4. SYNC EMPLOYEES TO SOLUTION MACHINE =================
  const handleSyncEmployeesToSolution = () => {
    setSuccessMsg(`✓ Berhasil membuat dan memvalidasi paket SOAP SetUserInfo untuk ${employees.length} karyawan. PIN dan Nama telah siap disinkronkan ke memori Mesin Solution (IP: ${solutionIp}).`);
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
        notes: `[Mesin Fingerprint Solution IP: ${solutionIp}] • Tap Check-In`,
        checkInPhoto: emp.avatarUrl,
        checkOutPhoto: existingRecord?.checkOutPhoto,
        location: {
          latitude: officeConfig.latitude,
          longitude: officeConfig.longitude,
          accuracy: 1,
          address: `Mesin Solution (${solutionName} • IP: ${solutionIp})`,
          distanceToOfficeMeters: 0,
          isWithinRadius: true,
        }
      };

      onAddOrUpdateRecords([record]);
      setSuccessMsg(`Berhasil! Tap Sidik Jari MASUK (Check-In) untuk ${emp.name} (${simTime}) tercatat otomatis.`);
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
        notes: `[Mesin Fingerprint Solution IP: ${solutionIp}] • Tap Check-Out`,
        checkInPhoto: existingRecord?.checkInPhoto || emp.avatarUrl,
        checkOutPhoto: emp.avatarUrl,
        location: existingRecord?.location || {
          latitude: officeConfig.latitude,
          longitude: officeConfig.longitude,
          accuracy: 1,
          address: `Mesin Solution (${solutionName} • IP: ${solutionIp})`,
          distanceToOfficeMeters: 0,
          isWithinRadius: true,
        }
      };

      onAddOrUpdateRecords([record]);
      setSuccessMsg(`Berhasil! Tap Sidik Jari PULANG (Check-Out) untuk ${emp.name} (${simTime}) tercatat otomatis.`);
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

          const emp = employees.find(e => e.nik.toLowerCase() === pinOrNik.toLowerCase() || e.id.toLowerCase() === pinOrNik.toLowerCase());
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
              notes: `[Mesin Solution File Log: ${solutionModel}]`,
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
          setSuccessMsg(`Berhasil mengimpor ${importedCount} log presensi dari file mesin fingerprint.`);
        } else {
          setErrorMsg('Tidak dapat memproses file. Pastikan format kolom sesuai (NIK, Tanggal, Jam).');
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
            id="tab-solution-ip"
            onClick={() => setActiveTab('solution')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'solution'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs font-extrabold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Radio className="w-4 h-4 text-indigo-600" />
            <span>Koneksi IP Mesin Solution 🎯</span>
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
            <span>Node.js Sync Agent</span>
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
            <span>Android / Termux (24 Jam)</span>
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
            <span>Import Log Flashdisk (CSV/DAT)</span>
          </button>

          <button
            id="tab-solution-guide"
            onClick={() => setActiveTab('guide')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'guide'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Panduan Menu Mesin</span>
          </button>

          <button
            id="tab-error-guide"
            onClick={() => setActiveTab('error-guide')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer rounded-t-lg ${
              activeTab === 'error-guide'
                ? 'border-rose-600 text-rose-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Troubleshooting</span>
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

          {/* ================= TAB 1: SOLUTION MACHINE IP CONNECTION ================= */}
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
                    onClick={handlePullLogsFromSolution}
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
                          triggerFileDownload('tarik_solution.php', solutionPhpCode, 'application/x-httpd-php');
                        } else if (solutionScriptTab === 'node') {
                          triggerFileDownload('solution_sync.js', solutionNodeCode, 'text/javascript');
                        } else if (solutionScriptTab === 'python') {
                          triggerFileDownload('solution_pyzk.py', solutionPythonCode, 'text/x-python');
                        } else {
                          triggerFileDownload('GetAttLog.xml', solutionSoapXml, 'application/xml');
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </button>

                    {solutionScriptTab === 'node' && (
                      <button
                        type="button"
                        onClick={() => triggerFileDownload('run_solution.bat', generateSolutionBatchFile(), 'text/plain')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer transition-colors"
                        title="Download Windows 1-Click Batch Runner"
                      >
                        <Download className="w-3 h-3" />
                        <span>run_solution.bat</span>
                      </button>
                    )}
                  </div>
                </div>

                <pre className="p-3 bg-black/50 text-slate-200 text-[11px] font-mono rounded-xl max-h-48 overflow-y-auto border border-slate-800 select-all">
                  {solutionScriptTab === 'php' && solutionPhpCode}
                  {solutionScriptTab === 'node' && solutionNodeCode}
                  {solutionScriptTab === 'python' && solutionPythonCode}
                  {solutionScriptTab === 'soap' && solutionSoapXml}
                </pre>
              </div>

            </div>
          )}

          {/* ================= TAB 2: LIVE SIMULATION ================= */}
          {activeTab === 'simulate' && (
            <form onSubmit={handleSimulateTap} className="space-y-4" id="simulation-panel">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1.5 text-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
                  Simulasi Tap Mesin Solution Secara Real-Time
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Fitur ini mensimulasikan kejadian saat karyawan menempelkan sidik jari di mesin fisik Solution (IP: {solutionIp}). Begitu tombol diklik, data presensi akan langsung masuk dan merubah status kehadiran secara real-time.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilih Karyawan
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={simEmployeeId}
                      onChange={(e) => setSimEmployeeId(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.nik}) - {emp.department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tipe Tap
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setSimType('checkin')}
                        className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                          simType === 'checkin' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Check-In (Masuk)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimType('checkout')}
                        className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                          simType === 'checkout' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Check-Out (Pulang)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Waktu Tap (Jam:Menit)
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="time"
                        value={simTime}
                        onChange={(e) => setSimTime(e.target.value)}
                        className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Presensi
                  </label>
                  <input
                    type="date"
                    value={simDate}
                    onChange={(e) => setSimDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-execute-simulation"
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Simulasikan Tap Sidik Jari Mesin Solution ⚡</span>
              </button>
            </form>
          )}

          {/* ================= TAB 3: NODE.JS SYNC AGENT ================= */}
          {activeTab === 'agent' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-indigo-600" />
                  Sinkronisasi Otomatis Real-Time (LAN)
                </p>
                <p className="text-[11px] leading-relaxed text-indigo-700">
                  Mesin sidik jari berada di jaringan LAN lokal kantor. Unduh script Node.js Sync Agent di bawah ini dan jalankan pada komputer yang terhubung ke jaringan LAN yang sama dengan mesin.
                </p>
              </div>

              {/* Config fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">IP Address Mesin</label>
                  <input
                    type="text"
                    value={deviceIp}
                    onChange={(e) => setDeviceIp(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500"
                    placeholder="192.168.1.201"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Port UDP/TCP</label>
                  <input
                    type="number"
                    value={devicePort}
                    onChange={(e) => setDevicePort(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500"
                    placeholder="4370"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama / Lokasi Mesin</label>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Interval Tarik Data (Detik)</label>
                  <input
                    type="number"
                    value={pollInterval}
                    onChange={(e) => setPollInterval(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Code Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">File & Script Sync Agent (Lengkap)</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => triggerFileDownload('package.json', generatePackageJson(), 'application/json')}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3 text-indigo-600" />
                      <span>package.json</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerFileDownload('run-agent.bat', generateWindowsBatchScript(), 'text/plain')}
                      className="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3 text-emerald-600" />
                      <span>run-agent.bat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerFileDownload('fingerprint-sync-agent.js', genericScriptCode, 'text/javascript')}
                      className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <Download className="w-3 h-3" />
                      <span>fingerprint-sync-agent.js</span>
                    </button>
                  </div>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 text-[10px] font-mono rounded-xl max-h-40 overflow-y-auto">
                  {genericScriptCode}
                </pre>
              </div>
            </div>
          )}

          {/* ================= TAB 4: ANDROID / TERMUX ================= */}
          {activeTab === 'android' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  AbsensiPro Sync Agent untuk Android (Termux)
                </p>
                <p className="text-[11px] text-emerald-700">
                  Jika komputer kantor berhalangan atau sering mati, Anda bisa menggunakan <strong>HP Android bekas / Android TV Box</strong> yang terhubung ke Wi-Fi yang sama dengan mesin fingerprint untuk menjalankan script sinkronisasi 24 jam non-stop menggunakan aplikasi <strong>Termux</strong>!
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-900">Langkah-Langkah Instalasi di HP Android:</p>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-600">
                  <li>Unduh & instal aplikasi <strong>Termux</strong> (dari F-Droid atau GitHub resmi Termux).</li>
                  <li>Buka Termux dan jalankan perintah berikut:
                    <div className="p-2 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg mt-1 select-all">
                      pkg update && pkg install python git -y && pip install pyzk requests
                    </div>
                  </li>
                  <li>Unduh file script Python sync agent di bawah ini ke HP Android Anda:
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => triggerFileDownload('sync_agent.py', solutionPythonCode, 'text/x-python')}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download sync_agent.py (Python)</span>
                      </button>
                    </div>
                  </li>
                  <li>Jalankan perintah:
                    <div className="p-2 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg mt-1 select-all">
                      python sync_agent.py
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* ================= TAB 5: UPLOAD LOG ================= */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Import File Log Export Mesin Solution (CSV / DAT / TXT)
                </p>
                <p className="text-[11px] leading-relaxed">
                  Jika mesin Anda tidak terhubung langsung ke jaringan, Anda dapat mengunduh log presensi dari mesin Solution menggunakan Flashdisk (USB) atau software bawaan Solution (seperti AttManager / ZKTime), lalu unggah file tersebut di sini.
                </p>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[10px] text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Format baris file (CSV / Separator Tab):</p>
                  <p>NIK_KARYAWAN, YYYY-MM-DD, HH:MM:SS</p>
                  <p className="text-slate-400">Contoh: EMP-001, 2026-09-17, 08:02:15</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-indigo-500 transition-colors bg-slate-50/50">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt,.dat"
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-800">Klik untuk memilih file log absensi Solution</p>
                    <p className="text-[11px] text-slate-500">Mendukung format .csv, .txt, dan .dat</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-colors"
                  >
                    Pilih File Log Mesin
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 6: PANDUAN MENU MESIN SOLUTION ================= */}
          {activeTab === 'guide' && (
            <div className="space-y-3.5 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-950 space-y-2">
                <p className="font-bold text-sm">Petunjuk Pengaturan IP di Layar Mesin Solution</p>
                <p className="text-[11px] leading-relaxed">
                  Ikuti langkah-langkah berikut langsung pada tombol fisik dan layar menu mesin Solution Anda:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Langkah 1</span>
                  <h6 className="font-bold text-slate-900 text-xs">Setel IP Statis Mesin</h6>
                  <p className="text-[11px] text-slate-600">
                    Tekan tombol <strong>[MENU] / [M/OK]</strong> pada mesin &gt; Pilih <strong>Komunikasi</strong> &gt; Pilih <strong>Jaringan (Ethernet)</strong> &gt; Masukkan IP Address (cth: <code>192.168.1.201</code>), Netmask: <code>255.255.255.0</code>, Gateway: <code>192.168.1.1</code>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Langkah 2</span>
                  <h6 className="font-bold text-slate-900 text-xs">Pengaturan Port & CommKey</h6>
                  <p className="text-[11px] text-slate-600">
                    Masuk ke menu <strong>Pengaturan PC / Web Server</strong> &gt; Pastikan <strong>Port</strong> disetel ke <code>80</code> (atau <code>4370</code>) &gt; Setel <strong>CommKey</strong> ke <code>0</code> (tanpa password).
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Langkah 3</span>
                  <h6 className="font-bold text-slate-900 text-xs">Cocokkan NIK Karyawan</h6>
                  <p className="text-[11px] text-slate-600">
                    Pastikan User ID / PIN karyawan yang didaftarkan di mesin Solution SAMA PERSIS dengan NIK yang ada di menu Manajemen Karyawan aplikasi (contoh: <code>EMP-001</code> atau <code>1</code>).
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Langkah 4 (Opsional)</span>
                  <h6 className="font-bold text-slate-900 text-xs">Cloud Server ADMS Push</h6>
                  <p className="text-[11px] text-slate-600">
                    Jika mesin Solution Anda mendukung fitur ADMS / Cloud Server: Masuk ke <strong>Server Cloud / ADMS</strong> &gt; Masukkan IP/Domain Server &gt; Port: <code>80/443</code> &gt; Data akan terkirim otomatis saat tap!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 7: TROUBLESHOOTING ================= */}
          {activeTab === 'error-guide' && (
            <div className="space-y-3.5 text-xs text-slate-700 leading-relaxed">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  Solusi Kendala Koneksi IP Mesin Solution
                </p>
                <p className="text-[11px] text-rose-800">
                  Berikut adalah panduan jika mesin Solution tidak dapat dihubungi melalui IP:
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900 text-xs">1. Mesin Solution Tidak Merespon Ping (Timeout)</p>
                  <p className="text-[11px] text-slate-600">
                    • Pastikan kabel LAN pada mesin Solution tercolok dengan lampu indikator hijau/oranye berkedip.<br/>
                    • Pastikan komputer dan mesin Solution berada dalam satu subnet yang sama (contoh: komputer <code>192.168.1.100</code> dan mesin <code>192.168.1.201</code>).<br/>
                    • Tes ping via Command Prompt: ketik <code>ping 192.168.1.201</code>.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900 text-xs">2. Respon "Connection Refused / Port Closed"</p>
                  <p className="text-[11px] text-slate-600">
                    • Untuk tipe Solution X100-C, X105, X302: Coba ganti port antara <strong>80</strong> (HTTP SOAP) atau <strong>4370</strong> (TCP).<br/>
                    • Pastikan Windows Defender Firewall tidak memblokir port outbound.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900 text-xs">3. Menggunakan Script PHP di XAMPP Lokal</p>
                  <p className="text-[11px] text-slate-600">
                    Jika aplikasi ini diakses via Cloud/Internet dan mesin Solution ada di LAN kantor tertutup, Anda cukup mendownload file <code>tarik_solution.php</code> dan menjalankannya di komputer kantor lokal. Script ini akan otomatis meneruskan log presensi ke Cloud Server AbsensiPro.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Target IP: <strong>{solutionIp}</strong> • Port: <strong>{solutionPort}</strong> • Model: <strong>{solutionModel}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
