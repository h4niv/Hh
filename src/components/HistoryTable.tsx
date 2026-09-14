import { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  Filter, 
  Calendar, 
  CalendarRange,
  Building2, 
  Eye, 
  MapPin, 
  CheckCircle2, 
  ClockAlert, 
  AlertCircle,
  FileSpreadsheet,
  X,
  Clock,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  Sparkles,
  CalendarCheck,
  HeartPulse,
  UserX
} from 'lucide-react';
import { AttendanceRecord, Employee } from '../types';
import { exportAttendanceToCSV } from '../utils/exportCsv';
import { formatIndonesianDate } from '../utils/geo';
import { 
  PeriodPreset, 
  PERIOD_PRESETS, 
  getPresetDateRange, 
  isDateInPeriod, 
  getPeriodDisplayLabel,
  formatDateToISO,
  formatShortIndonesianDate
} from '../utils/datePeriod';

interface HistoryTableProps {
  records: AttendanceRecord[];
  employees: Employee[];
  departments: string[];
  onOpenManualAttendanceModal?: () => void;
  onEditAttendanceRecord?: (record: AttendanceRecord) => void;
  onDeleteAttendanceRecord?: (recordId: string) => void;
}

export default function HistoryTable({ 
  records, 
  employees, 
  departments,
  onOpenManualAttendanceModal,
  onEditAttendanceRecord,
  onDeleteAttendanceRecord,
}: HistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('Semua');
  const [selectedStatus, setSelectedStatus] = useState<string>('Semua');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('Semua');
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  // Date Period State
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('semua');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const handleSelectPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    if (preset === 'kustom') {
      if (!startDate && !endDate) {
        const { startDate: s, endDate: e } = getPresetDateRange('bulan-ini');
        setStartDate(s);
        setEndDate(e);
      }
    } else {
      const { startDate: s, endDate: e } = getPresetDateRange(preset);
      setStartDate(s);
      setEndDate(e);
    }
  };

  const handleResetPeriod = () => {
    setPeriodPreset('semua');
    setStartDate('');
    setEndDate('');
  };

  // Filtered records based on period, search, dept, status, employee
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchPeriod = isDateInPeriod(r.date, startDate, endDate);
      const matchSearch =
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.employeeNik.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchDept = selectedDept === 'Semua' || r.department === selectedDept;
      const matchStatus = selectedStatus === 'Semua' || r.status === selectedStatus;
      const matchEmp = selectedEmployeeId === 'Semua' || r.employeeId === selectedEmployeeId;

      return matchPeriod && matchSearch && matchDept && matchStatus && matchEmp;
    });
  }, [records, startDate, endDate, searchQuery, selectedDept, selectedStatus, selectedEmployeeId]);

  // Period Summary Statistics
  const periodStats = useMemo(() => {
    const total = filteredRecords.length;
    const onTime = filteredRecords.filter((r) => r.status === 'Hadir Tepat Waktu').length;
    const late = filteredRecords.filter((r) => r.status === 'Terlambat').length;
    const izin = filteredRecords.filter((r) => r.status === 'Izin').length;
    const sakit = filteredRecords.filter((r) => r.status === 'Sakit').length;
    const alpha = filteredRecords.filter((r) => r.status === 'Alpha').length;
    const manualCount = filteredRecords.filter((r) => r.isManualEntry).length;

    const onTimePct = total > 0 ? Math.round((onTime / total) * 100) : 0;
    const latePct = total > 0 ? Math.round((late / total) * 100) : 0;
    const izinPct = total > 0 ? Math.round((izin / total) * 100) : 0;
    const sakitPct = total > 0 ? Math.round((sakit / total) * 100) : 0;
    const alphaPct = total > 0 ? Math.round((alpha / total) * 100) : 0;

    return {
      total,
      onTime,
      late,
      izin,
      sakit,
      alpha,
      manualCount,
      onTimePct,
      latePct,
      izinPct,
      sakitPct,
      alphaPct,
    };
  }, [filteredRecords]);

  const handleExportCSV = () => {
    let periodSuffix = periodPreset;
    if (startDate && endDate) {
      periodSuffix = `${startDate}_sd_${endDate}` as any;
    }
    exportAttendanceToCSV(
      filteredRecords, 
      `rekap_absensi_${periodSuffix}_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden" id="attendance-history-section">
      {/* Table Header Controls */}
      <div className="p-5 border-b border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Rekapitulasi Kehadiran Karyawan</h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                {filteredRecords.length} Data
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Log riwayat presensi masuk, pulang, verifikasi foto selfie dan titik koordinat GPS
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenManualAttendanceModal && (
              <button
                type="button"
                id="btn-open-manual-attendance"
                onClick={onOpenManualAttendanceModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Input jam masuk dan jam pulang secara manual"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>+ Input Presensi Manual</span>
              </button>
            )}

            <button
              type="button"
              id="export-csv-btn"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title={`Unduh laporan rekap periode (${getPeriodDisplayLabel(periodPreset, startDate, endDate)})`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV / Excel</span>
            </button>
          </div>
        </div>

        {/* Section: Menu Tanggal Periode Laporan */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50/90 border border-slate-200" id="period-filter-container">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Menu Periode Laporan:</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white shadow-2xs">
                  {getPeriodDisplayLabel(periodPreset, startDate, endDate)}
                </span>
              </div>
            </div>

            {/* Reset Filter Button */}
            {periodPreset !== 'semua' && (
              <button
                type="button"
                id="btn-reset-period"
                onClick={handleResetPeriod}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Tampilkan Semua Periode</span>
              </button>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5" id="period-presets-bar">
            {PERIOD_PRESETS.map((preset) => {
              const isActive = periodPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  id={`period-btn-${preset.id}`}
                  onClick={() => handleSelectPreset(preset.id)}
                  title={preset.description}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-2xs ring-2 ring-blue-500/20'
                      : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {preset.id === 'kustom' && <CalendarRange className="w-3.5 h-3.5" />}
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Selector (When 'kustom' is chosen) */}
          {periodPreset === 'kustom' && (
            <div className="mt-3.5 p-3.5 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-2 animate-in fade-in duration-150" id="custom-date-range-form">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Dari Tanggal (Mulai)
                  </label>
                  <input
                    type="date"
                    id="input-start-date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && e.target.value > endDate) {
                        setEndDate(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
                  />
                </div>

                <div className="flex-1">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Sampai Tanggal (Selesai)
                  </label>
                  <input
                    type="date"
                    id="input-end-date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
                  />
                </div>

                <div className="flex items-end gap-1.5 pt-2 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = formatDateToISO(new Date());
                      setStartDate(todayStr);
                      setEndDate(todayStr);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('bulan-ini')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Bulan Ini
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Format tanggal: Tahun-Bulan-Hari. Pilih tanggal mulai dan tanggal selesai yang diinginkan.
              </p>
            </div>
          )}

          {/* Period Summary KPI Cards - Separated Tepat Waktu, Terlambat, Izin, Sakit, Alpha */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-3.5" id="period-summary-kpis">
            {/* Total Presensi */}
            <button
              type="button"
              id="kpi-filter-total"
              onClick={() => setSelectedStatus('Semua')}
              className={`text-left bg-white rounded-xl p-2.5 border transition-all cursor-pointer shadow-2xs hover:shadow-xs ${
                selectedStatus === 'Semua'
                  ? 'border-slate-800 ring-2 ring-slate-800/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              title="Klik untuk melihat semua status presensi"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Total Presensi</span>
                <span className={`w-1.5 h-1.5 rounded-full ${selectedStatus === 'Semua' ? 'bg-slate-800' : 'bg-slate-300'}`}></span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-900">{periodStats.total}</span>
                <span className="text-[11px] text-slate-500">catatan</span>
              </div>
            </button>

            {/* Tepat Waktu */}
            <button
              type="button"
              id="kpi-filter-tepat-waktu"
              onClick={() => setSelectedStatus(selectedStatus === 'Hadir Tepat Waktu' ? 'Semua' : 'Hadir Tepat Waktu')}
              className={`text-left bg-white rounded-xl p-2.5 border transition-all cursor-pointer shadow-2xs hover:shadow-xs ${
                selectedStatus === 'Hadir Tepat Waktu'
                  ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                  : 'border-emerald-200/80 hover:border-emerald-300'
              }`}
              title="Klik untuk filter: Hadir Tepat Waktu"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">Tepat Waktu</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-emerald-700">{periodStats.onTime}</span>
                <span className="text-[11px] font-semibold text-emerald-800">({periodStats.onTimePct}%)</span>
              </div>
            </button>

            {/* Terlambat */}
            <button
              type="button"
              id="kpi-filter-terlambat"
              onClick={() => setSelectedStatus(selectedStatus === 'Terlambat' ? 'Semua' : 'Terlambat')}
              className={`text-left bg-white rounded-xl p-2.5 border transition-all cursor-pointer shadow-2xs hover:shadow-xs ${
                selectedStatus === 'Terlambat'
                  ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-500/20'
                  : 'border-amber-200/80 hover:border-amber-300'
              }`}
              title="Klik untuk filter: Terlambat"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider block">Terlambat</span>
                <ClockAlert className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-amber-700">{periodStats.late}</span>
                <span className="text-[11px] font-semibold text-amber-800">({periodStats.latePct}%)</span>
              </div>
            </button>

            {/* Total Izin */}
            <button
              type="button"
              id="kpi-filter-izin"
              onClick={() => setSelectedStatus(selectedStatus === 'Izin' ? 'Semua' : 'Izin')}
              className={`text-left bg-white rounded-xl p-2.5 border transition-all cursor-pointer shadow-2xs hover:shadow-xs ${
                selectedStatus === 'Izin'
                  ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                  : 'border-blue-200/80 hover:border-blue-300'
              }`}
              title="Klik untuk filter: Izin"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider block">Total Izin</span>
                <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-blue-700">{periodStats.izin}</span>
                <span className="text-[11px] font-semibold text-blue-800">({periodStats.izinPct}%)</span>
              </div>
            </button>

            {/* Total Sakit */}
            <button
              type="button"
              id="kpi-filter-sakit"
              onClick={() => setSelectedStatus(selectedStatus === 'Sakit' ? 'Semua' : 'Sakit')}
              className={`text-left bg-white rounded-xl p-2.5 border transition-all cursor-pointer shadow-2xs hover:shadow-xs ${
                selectedStatus === 'Sakit'
                  ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-500/20'
                  : 'border-purple-200/80 hover:border-purple-300'
              }`}
              title="Klik untuk filter: Sakit"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-purple-800 uppercase tracking-wider block">Total Sakit</span>
                <HeartPulse className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-purple-700">{periodStats.sakit}</span>
                <span className="text-[11px] font-semibold text-purple-800">({periodStats.sakitPct}%)</span>
              </div>
            </button>

            {/* Total Alpha */}
            <button
              type="button"
              id="kpi-filter-alpha"
              onClick={() => setSelectedStatus(selectedStatus === 'Alpha' ? 'Semua' : 'Alpha')}
              className={`text-left bg-white rounded-xl p-2.5 border transition-all cursor-pointer shadow-2xs hover:shadow-xs ${
                selectedStatus === 'Alpha'
                  ? 'border-rose-600 bg-rose-50/40 ring-2 ring-rose-500/20'
                  : 'border-rose-200/80 hover:border-rose-300'
              }`}
              title="Klik untuk filter: Alpha (Tanpa Keterangan)"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-rose-800 uppercase tracking-wider block">Total Alpha</span>
                <UserX className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-rose-700">{periodStats.alpha}</span>
                <span className="text-[11px] font-semibold text-rose-800">({periodStats.alphaPct}%)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="search-attendance-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama karyawan / NIK..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              id="filter-dept-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="Semua">Semua Departemen</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              id="filter-status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="Semua">Semua Status</option>
              <option value="Hadir Tepat Waktu">Hadir Tepat Waktu</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Alpha">Alpha</option>
            </select>
          </div>

          {/* Employee Filter */}
          <div>
            <select
              id="filter-employee-select"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="Semua">Semua Karyawan</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.nik})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600 border-collapse" id="attendance-data-table">
          <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Karyawan</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3">Jam Masuk</th>
              <th className="px-4 py-3">Jam Pulang</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Verifikasi Foto</th>
              <th className="px-4 py-3">Lokasi / GPS</th>
              <th className="px-4 py-3">Catatan</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Tidak Ada Data Kehadiran</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tidak ditemukan catatan presensi pada periode <strong className="text-slate-700 font-semibold">{getPeriodDisplayLabel(periodPreset, startDate, endDate)}</strong> atau filter yang aktif.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {periodPreset !== 'semua' && (
                        <button
                          type="button"
                          onClick={handleResetPeriod}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Tampilkan Semua Periode
                        </button>
                      )}
                      {(searchQuery || selectedDept !== 'Semua' || selectedStatus !== 'Semua' || selectedEmployeeId !== 'Semua') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedDept('Semua');
                            setSelectedStatus('Semua');
                            setSelectedEmployeeId('Semua');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Reset Filter Lainnya
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => {
                const isLate = record.status === 'Terlambat';
                const isOnTime = record.status === 'Hadir Tepat Waktu';
                const isLeave = record.status === 'Izin' || record.status === 'Sakit';

                return (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Employee Profile */}
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">{record.employeeName}</span>
                          {record.isManualEntry && (
                            <span 
                              className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                              title="Data presensi diinput / diedit secara manual"
                            >
                              Manual
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{record.employeeNik} • {record.department}</div>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{formatIndonesianDate(record.date)}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{record.date}</div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                        record.type === 'WFO'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : record.type === 'WFH'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {record.type}
                      </span>
                    </td>

                    {/* Check In */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-slate-800">
                      {record.checkInTime ? `${record.checkInTime} WIB` : '-'}
                    </td>

                    {/* Check Out */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-slate-800">
                      {record.checkOutTime ? `${record.checkOutTime} WIB` : (
                        <span className="text-slate-400 italic">Belum Pulang</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        isOnTime
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isLate
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : isLeave
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isOnTime && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {isLate && <ClockAlert className="w-3 h-3 text-amber-600" />}
                        {record.status}
                      </span>
                    </td>

                    {/* Photo Verification Thumbnail */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {record.checkInPhoto ? (
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto({ url: record.checkInPhoto!, title: `${record.employeeName} (${record.date})` })}
                          className="group relative w-9 h-9 rounded-lg overflow-hidden border border-slate-200 cursor-pointer shadow-2xs hover:ring-2 hover:ring-blue-500 transition-all inline-block"
                          title="Klik untuk melihat foto selfie"
                        >
                          <img
                            src={record.checkInPhoto}
                            alt="Selfie"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-3.5 h-3.5" />
                          </div>
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Tidak ada</span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3">
                      {record.location ? (
                        <div>
                          <div className="flex items-center gap-1 font-medium text-slate-800">
                            <MapPin className={`w-3 h-3 ${record.location.isWithinRadius ? 'text-emerald-600' : 'text-amber-500'}`} />
                            <span className="truncate max-w-[150px]">{record.location.address || 'GPS'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {record.location.distanceToOfficeMeters}m dari kantor • {record.location.isWithinRadius ? 'Radius Valid' : 'Luar Radius'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 max-w-[180px]">
                      <span className="text-slate-600 truncate block" title={record.notes || ''}>
                        {record.notes || '-'}
                      </span>
                    </td>

                    {/* Actions: Edit & Delete */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {onEditAttendanceRecord && (
                          <button
                            type="button"
                            onClick={() => onEditAttendanceRecord(record)}
                            title="Edit jam masuk & pulang"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onDeleteAttendanceRecord && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Hapus data presensi ${record.employeeName} tanggal ${record.date}?`)) {
                                onDeleteAttendanceRecord(record.id);
                              }
                            }}
                            title="Hapus data presensi"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Lightbox Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800 truncate">
                {previewPhoto.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-900">
              <img
                src={previewPhoto.url}
                alt="Selfie Preview"
                className="w-full rounded-xl object-contain max-h-80 mx-auto"
              />
            </div>
            <div className="p-3 text-center text-xs text-slate-500 bg-slate-50">
              Verifikasi Kehadiran Biometrik / Selfie Wajah
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
