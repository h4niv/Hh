import { useState, useMemo, FormEvent } from 'react';
import { 
  FileText, 
  Plus, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  LogOut,
  ShieldAlert, 
  CalendarClock,
  ClockAlert
} from 'lucide-react';
import { LeaveRequest, LeaveType, Employee, OfficeConfig } from '../types';
import { getTodayDateString } from '../utils/geo';

interface LeaveManagementProps {
  requests: LeaveRequest[];
  currentEmployee: Employee;
  employees: Employee[];
  officeConfig?: OfficeConfig;
  onSubmitRequest: (newReq: Omit<LeaveRequest, 'id' | 'appliedAt' | 'status'>) => void;
  onUpdateStatus: (requestId: string, newStatus: 'Disetujui' | 'Ditolak') => void;
}

export default function LeaveManagement({
  requests,
  currentEmployee,
  employees,
  officeConfig,
  onSubmitRequest,
  onUpdateStatus,
}: LeaveManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'cuti_sakit' | 'terlambat' | 'pulang_awal' | 'pending'>('all');
  const [activeQuotaTab, setActiveQuotaTab] = useState<'terlambat' | 'pulang_awal'>('terlambat');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7); // e.g. "2026-09"
  });

  // Modal Form states
  const [leaveType, setLeaveType] = useState<LeaveType>('Izin Datang Terlambat');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getTodayDateString());
  
  // Late Permit form states
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState<string>('09:15');
  const [lateMinutesInput, setLateMinutesInput] = useState<number>(45);

  // Early Departure form states
  const [estimatedDepartureTime, setEstimatedDepartureTime] = useState<string>('16:00');
  const [earlyMinutesInput, setEarlyMinutesInput] = useState<number>(90);

  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fallback defaults for limits if not yet set in officeConfig
  const maxLateCount = officeConfig?.maxLatePermitCountPerMonth ?? 3;
  const maxLateMinutes = officeConfig?.maxLatePermitMinutesPerMonth ?? 120;
  const maxEarlyCount = officeConfig?.maxEarlyLeaveCountPerMonth ?? 3;
  const maxEarlyMinutes = officeConfig?.maxEarlyLeaveMinutesPerMonth ?? 120;

  const workStartTime = currentEmployee.shift?.startTime || officeConfig?.workStartTime || '08:30';
  const workEndTime = currentEmployee.shift?.endTime || officeConfig?.workEndTime || '17:30';

  // Calculate days between start and end
  const calculateDays = (start: string, end: string) => {
    try {
      const d1 = new Date(start);
      const d2 = new Date(end);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  };

  const totalDays = calculateDays(startDate, endDate);
  const isAdminOrSuper = currentEmployee.systemRole === 'admin' || currentEmployee.systemRole === 'superadmin';

  // Calculate monthly stats for Izin Datang Terlambat for current employee
  const currentMonthStr = selectedMonth; // e.g. "2026-09"

  const employeeMonthlyLateRequests = useMemo(() => {
    return requests.filter((r) => {
      const isThisEmp = r.employeeId === currentEmployee.id;
      const isLateType = r.type === 'Izin Datang Terlambat';
      const isThisMonth = r.startDate.startsWith(currentMonthStr);
      const isNotRejected = r.status !== 'Ditolak';
      return isThisEmp && isLateType && isThisMonth && isNotRejected;
    });
  }, [requests, currentEmployee.id, currentMonthStr]);

  const usedLateCount = employeeMonthlyLateRequests.length;
  const usedLateMinutes = employeeMonthlyLateRequests.reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
  const remainingLateCount = Math.max(0, maxLateCount - usedLateCount);
  const remainingLateMinutes = Math.max(0, maxLateMinutes - usedLateMinutes);
  const percentLateCountUsed = Math.min(100, Math.round((usedLateCount / maxLateCount) * 100));
  const percentLateMinutesUsed = Math.min(100, Math.round((usedLateMinutes / maxLateMinutes) * 100));

  // Calculate monthly stats for Izin Pulang Awal for current employee
  const employeeMonthlyEarlyRequests = useMemo(() => {
    return requests.filter((r) => {
      const isThisEmp = r.employeeId === currentEmployee.id;
      const isEarlyType = r.type === 'Izin Pulang Awal';
      const isThisMonth = r.startDate.startsWith(currentMonthStr);
      const isNotRejected = r.status !== 'Ditolak';
      return isThisEmp && isEarlyType && isThisMonth && isNotRejected;
    });
  }, [requests, currentEmployee.id, currentMonthStr]);

  const usedEarlyCount = employeeMonthlyEarlyRequests.length;
  const usedEarlyMinutes = employeeMonthlyEarlyRequests.reduce((sum, r) => sum + (r.earlyDepartureMinutes || 0), 0);
  const remainingEarlyCount = Math.max(0, maxEarlyCount - usedEarlyCount);
  const remainingEarlyMinutes = Math.max(0, maxEarlyMinutes - usedEarlyMinutes);
  const percentEarlyCountUsed = Math.min(100, Math.round((usedEarlyCount / maxEarlyCount) * 100));
  const percentEarlyMinutesUsed = Math.min(100, Math.round((usedEarlyMinutes / maxEarlyMinutes) * 100));

  // Auto calculate late minutes when estimated arrival time changes
  const handleEstimatedArrivalChange = (arrivalTimeStr: string) => {
    setEstimatedArrivalTime(arrivalTimeStr);
    try {
      const [startH, startM] = workStartTime.split(':').map(Number);
      const [arrH, arrM] = arrivalTimeStr.split(':').map(Number);
      const startTotal = startH * 60 + startM;
      const arrTotal = arrH * 60 + arrM;
      const diff = arrTotal - startTotal;
      setLateMinutesInput(diff > 0 ? diff : 0);
    } catch {
      // fallback
    }
  };

  // Auto calculate early departure minutes when departure time changes
  const handleEstimatedDepartureChange = (departureTimeStr: string) => {
    setEstimatedDepartureTime(departureTimeStr);
    try {
      const [endH, endM] = workEndTime.split(':').map(Number);
      const [depH, depM] = departureTimeStr.split(':').map(Number);
      const endTotal = endH * 60 + endM;
      const depTotal = depH * 60 + depM;
      const diff = endTotal - depTotal;
      setEarlyMinutesInput(diff > 0 ? diff : 0);
    } catch {
      // fallback
    }
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (filterTab === 'cuti_sakit') {
        return req.type !== 'Izin Datang Terlambat' && req.type !== 'Izin Pulang Awal';
      }
      if (filterTab === 'terlambat') {
        return req.type === 'Izin Datang Terlambat';
      }
      if (filterTab === 'pulang_awal') {
        return req.type === 'Izin Pulang Awal';
      }
      if (filterTab === 'pending') {
        return req.status === 'Menunggu';
      }
      return true;
    });
  }, [requests, filterTab]);

  const totalLateRequestsAll = useMemo(() => {
    return requests.filter((r) => r.type === 'Izin Datang Terlambat').length;
  }, [requests]);

  const totalEarlyRequestsAll = useMemo(() => {
    return requests.filter((r) => r.type === 'Izin Pulang Awal').length;
  }, [requests]);

  const totalPendingRequests = useMemo(() => {
    return requests.filter((r) => r.status === 'Menunggu').length;
  }, [requests]);

  // Form submit handler
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!reason.trim()) {
      setFormError('Mohon isi alasan pengajuan');
      return;
    }

    if (leaveType === 'Cuti Tahunan' && totalDays > currentEmployee.remainingLeaveQuota) {
      setFormError(`Sisa kuota cuti tahunan Anda (${currentEmployee.remainingLeaveQuota} hari) tidak mencukupi untuk ${totalDays} hari.`);
      return;
    }

    // Validation for Izin Datang Terlambat
    if (leaveType === 'Izin Datang Terlambat') {
      if (!startDate) {
        setFormError('Pilih tanggal izin datang terlambat.');
        return;
      }
      if (lateMinutesInput <= 0) {
        setFormError('Durasi keterlambatan harus lebih dari 0 menit (estimasi jam tiba harus setelah jam mulai kerja).');
        return;
      }

      const projectedCount = usedLateCount + 1;
      const projectedMinutes = usedLateMinutes + lateMinutesInput;

      if (projectedCount > maxLateCount) {
        setFormError(
          `Pengajuan ditolak: Kuota frekuensi izin terlambat bulan ini sudah mencapai batas maksimal (${maxLateCount} kali). Hubungi HRD untuk permohonan khusus.`
        );
        return;
      }

      if (projectedMinutes > maxLateMinutes) {
        setFormError(
          `Pengajuan ditolak: Total durasi izin terlambat bulan ini akan menjadi ${projectedMinutes} menit, melebihi batas maksimal kantor (${maxLateMinutes} menit). Sisa durasi yang dapat diajukan: ${remainingLateMinutes} menit.`
        );
        return;
      }

      onSubmitRequest({
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        employeeNik: currentEmployee.nik,
        department: currentEmployee.department,
        type: 'Izin Datang Terlambat',
        startDate,
        endDate: startDate,
        totalDays: 1,
        estimatedArrivalTime,
        lateMinutes: lateMinutesInput,
        reason: reason.trim(),
      });

      setIsModalOpen(false);
      setReason('');
      return;
    }

    // Validation for Izin Pulang Awal
    if (leaveType === 'Izin Pulang Awal') {
      if (!startDate) {
        setFormError('Pilih tanggal izin pulang awal.');
        return;
      }
      if (earlyMinutesInput <= 0) {
        setFormError('Durasi pulang awal harus lebih dari 0 menit (estimasi jam pulang harus sebelum jam selesai kerja).');
        return;
      }

      const projectedEarlyCount = usedEarlyCount + 1;
      const projectedEarlyMinutes = usedEarlyMinutes + earlyMinutesInput;

      if (projectedEarlyCount > maxEarlyCount) {
        setFormError(
          `Pengajuan ditolak: Kuota frekuensi izin pulang awal bulan ini sudah mencapai batas maksimal (${maxEarlyCount} kali). Hubungi HRD untuk permohonan khusus.`
        );
        return;
      }

      if (projectedEarlyMinutes > maxEarlyMinutes) {
        setFormError(
          `Pengajuan ditolak: Total durasi izin pulang awal bulan ini akan menjadi ${projectedEarlyMinutes} menit, melebihi batas maksimal kantor (${maxEarlyMinutes} menit). Sisa durasi: ${remainingEarlyMinutes} menit.`
        );
        return;
      }

      onSubmitRequest({
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        employeeNik: currentEmployee.nik,
        department: currentEmployee.department,
        type: 'Izin Pulang Awal',
        startDate,
        endDate: startDate,
        totalDays: 1,
        estimatedDepartureTime,
        earlyDepartureMinutes: earlyMinutesInput,
        reason: reason.trim(),
      });

      setIsModalOpen(false);
      setReason('');
      return;
    }

    // Standard Leave Requests (Cuti, Sakit, Izin Pribadi, etc.)
    onSubmitRequest({
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      employeeNik: currentEmployee.nik,
      department: currentEmployee.department,
      type: leaveType,
      startDate,
      endDate,
      totalDays,
      reason: reason.trim(),
    });

    setIsModalOpen(false);
    setReason('');
  };

  return (
    <div className="space-y-6" id="leave-management-container">
      {/* Top Banner & Main Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-lg font-bold text-slate-900">Manajemen Izin & Cuti Karyawan</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              Sisa Cuti: {currentEmployee.remainingLeaveQuota} Hari
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              Sisa Terlambat: {remainingLateCount}x ({remainingLateMinutes} mnt)
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200 flex items-center gap-1">
              <LogOut className="w-3 h-3 text-indigo-600" />
              Sisa Pulang Awal: {remainingEarlyCount}x ({remainingEarlyMinutes} mnt)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Ajukan permohonan <strong>Izin Datang Terlambat</strong>, <strong>Izin Pulang Awal</strong>, cuti tahunan, atau izin sakit dengan kontrol kuota bulanan.
          </p>
        </div>

        <button
          type="button"
          id="btn-open-leave-modal"
          onClick={() => {
            setLeaveType('Izin Datang Terlambat');
            setStartDate(getTodayDateString());
            setEndDate(getTodayDateString());
            handleEstimatedArrivalChange('09:15');
            handleEstimatedDepartureChange('16:00');
            setFormError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer self-start lg:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Ajukan Izin / Cuti Baru</span>
        </button>
      </div>

      {/* SPECIAL MONTHLY QUOTA TRACKER CARDS FOR LATE & EARLY PERMITS */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white border border-slate-200 text-blue-600">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Pemantauan Kuota Izin Jam Kerja Bulanan ({currentEmployee.name})
              </h4>
              <p className="text-[11px] text-slate-500">
                Monitoring batasan izin terlambat & pulang awal per bulan kalender
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveQuotaTab('terlambat')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeQuotaTab === 'terlambat'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Izin Terlambat
              </button>
              <button
                type="button"
                onClick={() => setActiveQuotaTab('pulang_awal')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeQuotaTab === 'pulang_awal'
                    ? 'bg-indigo-100 text-indigo-900 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <LogOut className="w-3.5 h-3.5 text-indigo-600" />
                Izin Pulang Awal
              </button>
            </div>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-mono font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Tab 1: Izin Datang Terlambat Monthly Overview */}
        {activeQuotaTab === 'terlambat' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Metric 1: Frekuensi Izin Terlambat */}
              <div className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <ClockAlert className="w-4 h-4 text-amber-600" />
                    Frekuensi Pengajuan Terlambat
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    usedLateCount >= maxLateCount 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {usedLateCount >= maxLateCount ? 'Kuota Penuh' : `Sisa ${remainingLateCount}x`}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {usedLateCount} <span className="text-xs font-semibold text-slate-500 font-sans">/ {maxLateCount} Kali</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {percentLateCountUsed}% terpakai
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentLateCountUsed >= 100 
                        ? 'bg-rose-500' 
                        : percentLateCountUsed >= 66 
                        ? 'bg-amber-500' 
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentLateCountUsed}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  {usedLateCount >= maxLateCount
                    ? '⚠️ Batas maksimal pengajuan izin terlambat bulan ini telah tercapai.'
                    : `Anda dapat mengajukan izin datang terlambat ${remainingLateCount} kali lagi pada bulan ini.`}
                </p>
              </div>

              {/* Metric 2: Total Waktu Terlambat */}
              <div className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Total Durasi Waktu Terlambat
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    usedLateMinutes >= maxLateMinutes 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {usedLateMinutes >= maxLateMinutes ? 'Waktu Habis' : `Sisa ${remainingLateMinutes} Menit`}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {usedLateMinutes} <span className="text-xs font-semibold text-slate-500 font-sans">/ {maxLateMinutes} Menit</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {(usedLateMinutes / 60).toFixed(1)} jam terpakai
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentLateMinutesUsed >= 100 
                        ? 'bg-rose-500' 
                        : percentLateMinutesUsed >= 60 
                        ? 'bg-amber-500' 
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentLateMinutesUsed}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  {usedLateMinutes >= maxLateMinutes
                    ? '⚠️ Anda telah mencapai batas akumulasi durasi waktu izin terlambat bulan ini.'
                    : `Tersisa ${remainingLateMinutes} menit akumulasi waktu izin terlambat yang dapat dipergunakan.`}
                </p>
              </div>

            </div>

            {/* History pill breakdown for Late Requests */}
            {employeeMonthlyLateRequests.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 block mb-2">
                  Rincian Izin Terlambat Anda Bulan Ini ({employeeMonthlyLateRequests.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {employeeMonthlyLateRequests.map((lr) => (
                    <div key={lr.id} className="text-xs px-3 py-1.5 rounded-lg bg-white border border-amber-200 flex items-center gap-2 shadow-2xs">
                      <span className="font-semibold text-slate-800">{lr.startDate}</span>
                      <span>•</span>
                      <span className="font-mono text-amber-700 font-bold">Tiba: {lr.estimatedArrivalTime || '-'} ({lr.lateMinutes || 0} mnt)</span>
                      <span>•</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        lr.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {lr.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Izin Pulang Awal Monthly Overview */}
        {activeQuotaTab === 'pulang_awal' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Metric 1: Frekuensi Izin Pulang Awal */}
              <div className="bg-white rounded-xl p-4 border border-indigo-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <LogOut className="w-4 h-4 text-indigo-600" />
                    Frekuensi Izin Pulang Awal
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    usedEarlyCount >= maxEarlyCount 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {usedEarlyCount >= maxEarlyCount ? 'Kuota Penuh' : `Sisa ${remainingEarlyCount}x`}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {usedEarlyCount} <span className="text-xs font-semibold text-slate-500 font-sans">/ {maxEarlyCount} Kali</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {percentEarlyCountUsed}% terpakai
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentEarlyCountUsed >= 100 
                        ? 'bg-rose-500' 
                        : percentEarlyCountUsed >= 66 
                        ? 'bg-indigo-500' 
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentEarlyCountUsed}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  {usedEarlyCount >= maxEarlyCount
                    ? '⚠️ Batas maksimal pengajuan izin pulang awal bulan ini telah tercapai.'
                    : `Anda dapat mengajukan izin pulang awal ${remainingEarlyCount} kali lagi pada bulan ini.`}
                </p>
              </div>

              {/* Metric 2: Total Waktu Pulang Awal */}
              <div className="bg-white rounded-xl p-4 border border-indigo-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Total Durasi Waktu Pulang Awal
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    usedEarlyMinutes >= maxEarlyMinutes 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {usedEarlyMinutes >= maxEarlyMinutes ? 'Waktu Habis' : `Sisa ${remainingEarlyMinutes} Menit`}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {usedEarlyMinutes} <span className="text-xs font-semibold text-slate-500 font-sans">/ {maxEarlyMinutes} Menit</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {(usedEarlyMinutes / 60).toFixed(1)} jam terpakai
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentEarlyMinutesUsed >= 100 
                        ? 'bg-rose-500' 
                        : percentEarlyMinutesUsed >= 60 
                        ? 'bg-indigo-500' 
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentEarlyMinutesUsed}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  {usedEarlyMinutes >= maxEarlyMinutes
                    ? '⚠️ Anda telah mencapai batas akumulasi durasi izin pulang awal bulan ini.'
                    : `Tersisa ${remainingEarlyMinutes} menit akumulasi izin pulang awal yang dapat dipergunakan.`}
                </p>
              </div>

            </div>

            {/* History pill breakdown for Early Requests */}
            {employeeMonthlyEarlyRequests.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 block mb-2">
                  Rincian Izin Pulang Awal Anda Bulan Ini ({employeeMonthlyEarlyRequests.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {employeeMonthlyEarlyRequests.map((er) => (
                    <div key={er.id} className="text-xs px-3 py-1.5 rounded-lg bg-white border border-indigo-200 flex items-center gap-2 shadow-2xs">
                      <span className="font-semibold text-slate-800">{er.startDate}</span>
                      <span>•</span>
                      <span className="font-mono text-indigo-700 font-bold">Pulang: {er.estimatedDepartureTime || '-'} (Awal {er.earlyDepartureMinutes || 0} mnt)</span>
                      <span>•</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        er.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {er.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs & Table of Requests */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
        
        {/* Filter Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua Pengajuan ({requests.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('terlambat')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'terlambat'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <ClockAlert className="w-3.5 h-3.5" />
              <span>Izin Terlambat ({totalLateRequestsAll})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('pulang_awal')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'pulang_awal'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-indigo-800 hover:bg-indigo-50 border border-indigo-200'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Izin Pulang Awal ({totalEarlyRequestsAll})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('cuti_sakit')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterTab === 'cuti_sakit'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Cuti & Sakit ({requests.length - totalLateRequestsAll - totalEarlyRequestsAll})
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'pending'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Menunggu Review HR ({totalPendingRequests})</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            {isAdminOrSuper ? 'Mode Otoritas Admin: Dapat menyetujui / menolak' : 'Menampilkan pengajuan tim kantor'}
          </span>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Karyawan</th>
                <th className="px-4 py-3">Jenis Pengajuan</th>
                <th className="px-4 py-3">Tanggal / Estimasi Waktu</th>
                <th className="px-4 py-3">Durasi / Waktu</th>
                <th className="px-4 py-3">Alasan / Keterangan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi Review HRD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Tidak ada data pengajuan dalam kategori ini.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isPending = req.status === 'Menunggu';
                  const isApproved = req.status === 'Disetujui';
                  const isRejected = req.status === 'Ditolak';
                  const isLatePermit = req.type === 'Izin Datang Terlambat';
                  const isEarlyPermit = req.type === 'Izin Pulang Awal';

                  return (
                    <tr 
                      key={req.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isLatePermit ? 'bg-amber-50/20' : isEarlyPermit ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{req.employeeName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{req.employeeNik} • {req.department}</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isLatePermit
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : isEarlyPermit
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                            : req.type === 'Cuti Tahunan'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : req.type === 'Sakit'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {isLatePermit && <ClockAlert className="w-3 h-3 text-amber-600" />}
                          {isEarlyPermit && <LogOut className="w-3 h-3 text-indigo-600" />}
                          {req.type}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {req.startDate === req.endDate ? req.startDate : `${req.startDate} s/d ${req.endDate}`}
                        </div>
                        {isLatePermit && req.estimatedArrivalTime ? (
                          <div className="text-[11px] text-amber-700 font-semibold font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Tiba Pukul: {req.estimatedArrivalTime} WIB</span>
                          </div>
                        ) : isEarlyPermit && req.estimatedDepartureTime ? (
                          <div className="text-[11px] text-indigo-700 font-semibold font-mono flex items-center gap-1 mt-0.5">
                            <LogOut className="w-3 h-3 text-indigo-600" />
                            <span>Pulang Pukul: {req.estimatedDepartureTime} WIB</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">
                            Diajukan: {req.appliedAt}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {isLatePermit ? (
                          <div className="font-bold text-amber-900 font-mono">
                            {req.lateMinutes ?? 0} Menit
                            <span className="block text-[10px] font-normal text-slate-500">Izin Terlambat</span>
                          </div>
                        ) : isEarlyPermit ? (
                          <div className="font-bold text-indigo-900 font-mono">
                            {req.earlyDepartureMinutes ?? 0} Menit
                            <span className="block text-[10px] font-normal text-slate-500">Pulang Lebih Awal</span>
                          </div>
                        ) : (
                          <div className="font-medium text-slate-800 font-mono">
                            {req.totalDays} Hari
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-slate-700 leading-snug line-clamp-2" title={req.reason}>
                          {req.reason}
                        </p>
                        {req.notes && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">
                            Catatan HR: {req.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          isApproved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isRejected
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isRejected && <XCircle className="w-3 h-3 text-rose-600" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                          {req.status}
                        </span>
                      </td>

                      {/* Action buttons for HR approval simulation */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {isPending ? (
                          isAdminOrSuper ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(req.id, 'Disetujui')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Setujui permohonan"
                              >
                                <Check className="w-3 h-3" /> Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(req.id, 'Ditolak')}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Tolak permohonan"
                              >
                                <X className="w-3 h-3" /> Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium italic">
                              Menunggu Review Admin
                            </span>
                          )
                        ) : (
                          <div className="text-[11px] text-slate-400 italic">
                            <span>Selesai diproses</span>
                            {req.approvedBy && (
                              <span className="block text-[10px] text-slate-500 font-normal">Oleh: {req.approvedBy}</span>
                            )}
                          </div>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajukan Cuti / Izin Datang Terlambat / Izin Pulang Awal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">Form Pengajuan Izin & Cuti</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Employee info banner & Current Quotas */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900">{currentEmployee.name}</span>
                  <p className="text-slate-500 text-[11px]">{currentEmployee.nik} • {currentEmployee.department}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <div className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-600">
                    Cuti: <strong className="text-blue-600">{currentEmployee.remainingLeaveQuota} Hari</strong>
                  </div>
                  <div className="bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 text-amber-900">
                    Terlambat: <strong className="text-amber-800">{remainingLateCount}x ({remainingLateMinutes}m)</strong>
                  </div>
                  <div className="bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 text-indigo-900">
                    Pulang Awal: <strong className="text-indigo-800">{remainingEarlyCount}x ({remainingEarlyMinutes}m)</strong>
                  </div>
                </div>
              </div>

              {/* Type of leave selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Pengajuan <span className="text-red-500">*</span>
                </label>
                <select
                  id="leave-type-select"
                  value={leaveType}
                  onChange={(e) => {
                    const newType = e.target.value as LeaveType;
                    setLeaveType(newType);
                    setFormError(null);
                  }}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Izin Datang Terlambat">⏰ Izin Datang Terlambat (Batas Kuota Bulanan)</option>
                  <option value="Izin Pulang Awal">🏃 Izin Pulang Lebih Awal (Batas Kuota Bulanan)</option>
                  <option value="Cuti Tahunan">🏖️ Cuti Tahunan (Mengurangi Kuota)</option>
                  <option value="Sakit">🏥 Sakit (Surat Dokter)</option>
                  <option value="Izin Pribadi">📋 Izin Pribadi / Keperluan Mendesak</option>
                  <option value="Cuti Melahirkan">👶 Cuti Melahirkan / Parental</option>
                </select>
              </div>

              {/* SPECIFIC FIELDS FOR IZIN DATANG TERLAMBAT */}
              {leaveType === 'Izin Datang Terlambat' && (
                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <ClockAlert className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-950">
                      Rincian Waktu Izin Datang Terlambat
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tanggal Izin Terlambat <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Jam Masuk Normal
                      </label>
                      <div className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 border border-slate-200">
                        {workStartTime} WIB
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Estimasi Tiba di Kantor <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={estimatedArrivalTime}
                        onChange={(e) => handleEstimatedArrivalChange(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-amber-700"
                        required
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Estimasi Durasi Terlambat:</span>
                      <span className="font-mono font-bold text-amber-800 text-sm">
                        {lateMinutesInput} Menit ({(lateMinutesInput / 60).toFixed(1)} Jam)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Proyeksi Frekuensi Bulan Ini:</span>
                      <span className={`font-semibold ${usedLateCount + 1 > maxLateCount ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {usedLateCount + 1} dari {maxLateCount} Kali {usedLateCount + 1 > maxLateCount && '(Melebihi Kuota!)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Proyeksi Total Waktu Bulan Ini:</span>
                      <span className={`font-semibold ${usedLateMinutes + lateMinutesInput > maxLateMinutes ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {usedLateMinutes + lateMinutesInput} dari {maxLateMinutes} Menit {usedLateMinutes + lateMinutesInput > maxLateMinutes && '(Melebihi Batas!)'}
                      </span>
                    </div>
                  </div>

                  {(usedLateCount + 1 > maxLateCount || usedLateMinutes + lateMinutesInput > maxLateMinutes) && (
                    <div className="p-2.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        Pengajuan ini melebihi batasan ketentuan kantor bulanan ({maxLateCount} kali / {maxLateMinutes} menit).
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* SPECIFIC FIELDS FOR IZIN PULANG AWAL */}
              {leaveType === 'Izin Pulang Awal' && (
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-950">
                      Rincian Waktu Izin Pulang Lebih Awal
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tanggal Izin Pulang Awal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Jam Pulang Normal
                      </label>
                      <div className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 border border-slate-200">
                        {workEndTime} WIB
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Estimasi Meninggalkan Kantor <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={estimatedDepartureTime}
                        onChange={(e) => handleEstimatedDepartureChange(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-indigo-700"
                        required
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-indigo-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Estimasi Durasi Pulang Lebih Awal:</span>
                      <span className="font-mono font-bold text-indigo-800 text-sm">
                        {earlyMinutesInput} Menit ({(earlyMinutesInput / 60).toFixed(1)} Jam)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Proyeksi Frekuensi Bulan Ini:</span>
                      <span className={`font-semibold ${usedEarlyCount + 1 > maxEarlyCount ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {usedEarlyCount + 1} dari {maxEarlyCount} Kali {usedEarlyCount + 1 > maxEarlyCount && '(Melebihi Kuota!)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Proyeksi Total Waktu Bulan Ini:</span>
                      <span className={`font-semibold ${usedEarlyMinutes + earlyMinutesInput > maxEarlyMinutes ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {usedEarlyMinutes + earlyMinutesInput} dari {maxEarlyMinutes} Menit {usedEarlyMinutes + earlyMinutesInput > maxEarlyMinutes && '(Melebihi Batas!)'}
                      </span>
                    </div>
                  </div>

                  {(usedEarlyCount + 1 > maxEarlyCount || usedEarlyMinutes + earlyMinutesInput > maxEarlyMinutes) && (
                    <div className="p-2.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        Pengajuan ini melebihi batasan ketentuan izin pulang awal bulanan ({maxEarlyCount} kali / {maxEarlyMinutes} menit).
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* REGULAR DATE RANGE FOR CUTI / SAKIT / IZIN PRIBADI */}
              {leaveType !== 'Izin Datang Terlambat' && leaveType !== 'Izin Pulang Awal' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Mulai <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Selesai <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        min={startDate}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center justify-between px-1">
                    <span>Total Estimasi Hari Kerja:</span>
                    <span className="font-bold text-slate-900 font-mono">{totalDays} Hari</span>
                  </div>
                </>
              )}

              {/* Reason / Keterangan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan / Keterangan Lengkap <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    leaveType === 'Izin Datang Terlambat'
                      ? 'Tuliskan alasan keterlambatan (misal: kendala ban kendaraan, antre kontrol dokter pagi, dsb)...'
                      : leaveType === 'Izin Pulang Awal'
                      ? 'Tuliskan alasan izin pulang lebih awal (misal: keperluan keluarga mendesak, jadwal medis sore, dsb)...'
                      : 'Tuliskan keterangan detail keperluan izin/cuti Anda...'
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="submit-leave-request-btn"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
