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
  User
} from 'lucide-react';
import { Employee, AttendanceRecord, OfficeConfig } from '../types';
import { generateNodeSyncAgentCode, SyncAgentConfig } from '../utils/syncAgentTemplates';
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
  const [activeTab, setActiveTab] = useState<'agent' | 'upload' | 'simulate' | 'guide'>('agent');
  const [copied, setCopied] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Agent Config Form
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

  const agentConfig: SyncAgentConfig = {
    serverUrl,
    apiKey,
    deviceIp,
    devicePort,
    deviceCommKey: commKey,
    deviceName,
    pollIntervalSeconds: pollInterval,
  };

  const scriptCode = generateNodeSyncAgentCode(agentConfig);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([scriptCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fingerprint-sync-agent.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle live tap simulation
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
        notes: `[Mesin Fingerprint Real-Time: ${deviceName}] • Check-In`,
        checkInPhoto: emp.avatarUrl,
        checkOutPhoto: existingRecord?.checkOutPhoto,
        location: {
          latitude: officeConfig.latitude,
          longitude: officeConfig.longitude,
          accuracy: 1,
          address: `Mesin Fingerprint (${deviceName})`,
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
        notes: `[Mesin Fingerprint Real-Time: ${deviceName}] • Check-Out`,
        checkInPhoto: existingRecord?.checkInPhoto || emp.avatarUrl,
        checkOutPhoto: emp.avatarUrl,
        location: existingRecord?.location || {
          latitude: officeConfig.latitude,
          longitude: officeConfig.longitude,
          accuracy: 1,
          address: `Mesin Fingerprint (${deviceName})`,
          distanceToOfficeMeters: 0,
          isWithinRadius: true,
        }
      };

      onAddOrUpdateRecords([record]);
      setSuccessMsg(`Berhasil! Tap Sidik Jari PULANG (Check-Out) untuk ${emp.name} (${simTime}) tercatat otomatis.`);
    }
  };

  // Handle uploading CSV / DAT log from fingerprint machine
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
              notes: `[Mesin Fingerprint Import: ${deviceName}]`,
              checkInPhoto: emp.avatarUrl,
              location: {
                latitude: officeConfig.latitude,
                longitude: officeConfig.longitude,
                accuracy: 1,
                address: `Mesin Fingerprint (${deviceName})`,
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
          setSuccessMsg(`Berhasil mengimpor ${importedCount} log presensi dari mesin fingerprint.`);
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
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Integrasi Mesin Fingerprint (Biometrik)</h3>
              <p className="text-[11px] text-slate-500">Koneksikan mesin absensi sidik jari (ZKTeco, Solution, dll) via LAN atau File Log</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5 bg-slate-50/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('agent')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'agent'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Agent Sinkronisasi LAN</span>
          </button>
          <button
            onClick={() => setActiveTab('simulate')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'simulate'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Simulasi Live Tap ⚡</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'upload'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import File Log (CSV/DAT)</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'guide'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Panduan & Protokol</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'simulate' && (
            <form onSubmit={handleSimulateTap} className="space-y-4">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1.5 text-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
                  Simulasi Tap Mesin Sidik Jari Secara Real-Time
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Fitur ini mensimulasikan kejadian saat karyawan menempelkan sidik jari di mesin fisik kantor. Begitu tombol diklik, data presensi akan otomatis masuk dan merubah status kehadiran secara langsung.
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
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Simulasikan Tap Sidik Jari Sekarang ⚡</span>
              </button>
            </form>
          )}

          {activeTab === 'agent' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-indigo-600" />
                  Sinkronisasi Otomatis Real-Time (LAN)
                </p>
                <p className="text-[11px] leading-relaxed text-indigo-700">
                  Mesin sidik jari (seperti ZKTeco atau Solution) umumnya berada di jaringan LAN lokal kantor. Unduh script Node.js Sync Agent di bawah ini dan jalankan pada komputer yang terhubung ke jaringan LAN yang sama dengan mesin.
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Port UDP</label>
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Preview Script (fingerprint-sync-agent.js)</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Tersalin!' : 'Salin Script'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadScript}
                      className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download .js</span>
                    </button>
                  </div>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 text-[10px] font-mono rounded-xl max-h-48 overflow-y-auto">
                  {scriptCode}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Import File Log Export Mesin (CSV / DAT / TXT)
                </p>
                <p className="text-[11px] leading-relaxed">
                  Jika mesin Anda tidak terhubung langsung ke internet, Anda dapat mendownload log absensi dari mesin via Flashdisk (USB) atau software bawaan mesin (seperti ZKTime / ZKAccess), lalu unggah file tersebut di sini.
                </p>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[10px] text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Format baris file (CSV / Separator Tab):</p>
                  <p>NIK_KARYAWAN, YYYY-MM-DD, HH:MM:SS</p>
                  <p className="text-slate-400">Contoh: EMP-001, 2026-03-30, 08:02:15</p>
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
                    <p className="text-xs font-semibold text-slate-800">Klik untuk memilih file log absensi</p>
                    <p className="text-[11px] text-slate-500">Mendukung format .csv, .txt, dan .dat</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-colors"
                  >
                    Pilih File Mesin Fingerprint
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-3.5 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                <p className="font-bold">Informasi Koneksi Protokol ZKTeco / Solution</p>
                <p className="text-[11px]">Mesin fingerprint standard menggunakan komunikasi TCP/UDP Port 4370. Pastikan firewall komputer kantor tidak memblokir port tersebut.</p>
              </div>
              <ul className="list-disc pl-4 space-y-2 text-[11px]">
                <li><strong>Nomor NIK / PIN Karyawan:</strong> Pastikan NIK yang terdaftar di mesin sidik jari sama persis dengan NIK Karyawan di menu Manajemen Karyawan aplikasi ini (contoh: <code>EMP-001</code> atau <code>001</code>).</li>
                <li><strong>IP Statis Mesin:</strong> Disarankan menyetel IP Address mesin fingerprint secara statis (misal <code>192.168.1.201</code>) agar tidak berubah-ubah saat router restart.</li>
                <li><strong>Otomatisasi Absensi:</strong> Begitu sinkronisasi mendeteksi tap baru, sistem otomatis mencatat Check-In atau Check-Out, menghitung keterlambatan, dan mencocokkan izin cuti/terlambat yang disetujui.</li>
              </ul>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
