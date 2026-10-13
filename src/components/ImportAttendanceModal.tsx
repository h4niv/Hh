import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Check, 
  X, 
  AlertTriangle, 
  Info, 
  FileCheck, 
  RefreshCw 
} from 'lucide-react';
import { Employee, AttendanceRecord } from '../types';
import * as XLSX from 'xlsx';

interface ImportAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onImport: (importedRecords: AttendanceRecord[]) => void;
}

interface ParsedAttendanceRow {
  rowNum: number;
  nik: string;
  name: string;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  status: 'Hadir Tepat Waktu' | 'Terlambat' | 'Alpha' | 'Sakit' | 'Izin' | 'Dinas Luar';
  notes: string;
  employeeId?: string;
  isValid: boolean;
  statusMessage: string;
}

export default function ImportAttendanceModal({
  isOpen,
  onClose,
  employees,
  onImport,
}: ImportAttendanceModalProps) {
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedAttendanceRow[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Function to download standard Excel template with separate sheets per employee
  const handleDownloadTemplate = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const filteredEmployees = (employees || []).filter(emp => {
      if (!selectedCategory || selectedCategory === 'ALL') return true;
      const deptUpper = (emp.department || '').trim().toUpperCase();
      const cat = (emp.employmentCategory || '').trim().toUpperCase();
      const roleText = `${emp.role || ''} ${emp.name || ''}`.toLowerCase();
      
      if (selectedCategory === 'GTT') {
        return deptUpper.includes('GTT') || deptUpper.includes('GURU TIDAK TETAP') || cat === 'GTT' || roleText.includes('gtt');
      }
      if (selectedCategory === 'KTT') {
        return deptUpper.includes('KTT') || deptUpper.includes('PTT') || cat === 'KTT' || cat === 'PTT' || roleText.includes('ktt') || roleText.includes('kontrak');
      }
      if (selectedCategory === 'GTY') {
        return deptUpper.includes('GTY') || deptUpper.includes('GURU TETAP') || cat === 'GTY' || (!deptUpper.includes('GTT') && roleText.includes('guru'));
      }
      if (selectedCategory === 'KTY') {
        return deptUpper.includes('KTY') || deptUpper.includes('KARYAWAN TETAP') || cat === 'KTY';
      }
      return cat === selectedCategory;
    });

    const listToUse = filteredEmployees.length > 0 ? filteredEmployees : (employees || []).slice(0, 10);
    
    // Build CSV content
    const headers = ['NIK', 'Nama Karyawan', 'Tanggal (YYYY-MM-DD)', 'Jam Masuk', 'Jam Keluar', 'Status Kehadiran', 'Keterangan'];
    const rows = listToUse.map((emp, index) => [
      emp.nik || `KRY-2024-00${index + 1}`,
      `"${(emp.name || 'Karyawan').replace(/"/g, '""')}"`,
      todayStr,
      emp.shift?.startTime || '08:00',
      emp.shift?.endTime || '17:00',
      'Hadir Tepat Waktu',
      'Hadir'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Template_Presensi_${selectedCategory || 'ALL'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const parseExcelDate = (val: unknown): string => {
    if (!val) return '';
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof val === 'number') {
      const d = XLSX.SSF.parse_date_code(val);
      if (d) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    // Handle YYYY/MM/DD or YYYY-MM-DD with time
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(str)) {
      const parts = str.split(/[\/\-\s]/);
      if (parts.length >= 3 && parts[0].length === 4) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    // Handle DD/MM/YYYY or DD-MM-YYYY (Indonesian standard)
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
      const parts = str.split(/[\/\-\s]/);
      if (parts.length >= 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    const parsedDate = new Date(str);
    if (!isNaN(parsedDate.getTime())) {
      const y = parsedDate.getFullYear();
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const d = String(parsedDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return str;
  };

  const parseExcelTime = (val: unknown): string => {
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'number') {
      const totalSeconds = Math.round(val * 86400);
      const hours = Math.floor(totalSeconds / 3600) % 24;
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    if (val instanceof Date) {
      const h = String(val.getHours()).padStart(2, '0');
      const m = String(val.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
    const str = String(val).trim();
    if (!isNaN(Number(str)) && str !== '') {
      const num = Number(str);
      if (num >= 0 && num < 1) {
        const totalSeconds = Math.round(num * 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }
    const match = str.match(/^(\d{1,2})[:\.](\d{1,2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
    }
    return str;
  };

  const processExcelFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.SheetNames.length) {
        throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
      }

      // Read rows from all employee sheets (ignoring instruction sheets)
      let rawRows: { row: Record<string, unknown>; sheetName: string }[] = [];
      for (const sheetName of workbook.SheetNames) {
        const lowerName = sheetName.toLowerCase();
        if (
          lowerName.includes('petunjuk') || 
          lowerName.includes('instruction') || 
          lowerName.includes('info')
        ) {
          continue;
        }
        const worksheet = workbook.Sheets[sheetName];
        const sheetRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (sheetRows && sheetRows.length > 0) {
          sheetRows.forEach((row) => {
            rawRows.push({ row, sheetName });
          });
        }
      }

      if (!rawRows || rawRows.length === 0) {
        throw new Error('Lembar kerja kosong atau tidak ada data presensi yang terbaca dari sheet karyawan.');
      }

      const employeeMapByNik = new Map<string, Employee>();
      employees.forEach((e) => {
        if (e.nik) employeeMapByNik.set(e.nik.toLowerCase().trim(), e);
        if (e.name) employeeMapByNik.set(e.name.toLowerCase().trim(), e);
      });

      const parsed: ParsedAttendanceRow[] = rawRows.map((item, idx) => {
        const { row, sheetName } = item;
        const rowNum = idx + 2;

        const getVal = (keys: string[]): unknown => {
          for (const k of Object.keys(row)) {
            const cleanKey = k.trim().toLowerCase();
            if (keys.some((target) => cleanKey === target.toLowerCase())) {
              return row[k];
            }
          }
          return undefined;
        };

        const rawNik = getVal(['nik', 'no induk', 'nomor induk', 'nip', 'id']);
        const nikOrName = rawNik !== undefined && rawNik !== null ? String(rawNik).trim() : '';
        const rawName = getVal(['nama', 'nama karyawan', 'employee name', 'name']);
        const nameVal = rawName !== undefined && rawName !== null ? String(rawName).trim() : '';
        const rawDateVal = getVal(['tanggal', 'date', 'tgl', 'tanggal (yyyy-mm-dd)']);
        const rawCheckIn = getVal(['jam masuk', 'masuk', 'check in', 'in', 'jam datang', 'datang', 'start time', 'time in']);
        const rawCheckOut = getVal(['jam keluar', 'keluar', 'jam pulang', 'pulang', 'check out', 'out', 'end time', 'time out']);
        const checkIn = parseExcelTime(rawCheckIn);
        const checkOut = parseExcelTime(rawCheckOut);
        const rawStatus = getVal(['status', 'status kehadiran', 'attendance status']);
        const statusVal = (rawStatus !== undefined && rawStatus !== null && String(rawStatus).trim() !== '') ? String(rawStatus).trim() : 'Hadir Tepat Waktu';
        const rawNotes = getVal(['keterangan', 'notes', 'note', 'catatan']);
        const notesVal = rawNotes !== undefined && rawNotes !== null ? String(rawNotes).trim() : '';

        // Match employee robustly
        let matchedEmp: Employee | undefined = undefined;
        if (nikOrName && employeeMapByNik.has(nikOrName.toLowerCase().trim())) {
          matchedEmp = employeeMapByNik.get(nikOrName.toLowerCase().trim());
        }
        if (!matchedEmp && nameVal && employeeMapByNik.has(nameVal.toLowerCase().trim())) {
          matchedEmp = employeeMapByNik.get(nameVal.toLowerCase().trim());
        }
        if (!matchedEmp && sheetName) {
          const cleanSheet = sheetName.toLowerCase().trim();
          if (employeeMapByNik.has(cleanSheet)) {
            matchedEmp = employeeMapByNik.get(cleanSheet);
          } else {
            // Fuzzy match on sheetName
            const normSheet = cleanSheet.replace(/[^a-z0-9]/g, '');
            for (const emp of employees) {
              const normName = emp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const normNik = emp.nik.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (
                normName.includes(normSheet) || 
                normSheet.includes(normName) ||
                normName.startsWith(normSheet) ||
                normSheet.startsWith(normName)
              ) {
                matchedEmp = emp;
                break;
              }
            }
          }
        }

        const dateVal = parseExcelDate(rawDateVal);

        let status: ParsedAttendanceRow['status'] = 'Hadir Tepat Waktu';
        const lowStatus = statusVal.toLowerCase();
        if (lowStatus.includes('terlambat') || lowStatus.includes('late')) status = 'Terlambat';
        else if (lowStatus.includes('sakit') || lowStatus.includes('sick')) status = 'Sakit';
        else if (lowStatus.includes('izin') || lowStatus.includes('permit')) status = 'Izin';
        else if (lowStatus.includes('alpha') || lowStatus.includes('alpa') || lowStatus.includes('mangkir')) status = 'Alpha';
        else if (lowStatus.includes('dinas') || lowStatus.includes('tugas')) status = 'Dinas Luar';

        let isValid = true;
        let statusMessage = 'Valid';

        if (!matchedEmp) {
          isValid = false;
          statusMessage = `Karyawan "${nikOrName || nameVal || sheetName}" tidak ditemukan di sistem`;
        } else if (!dateVal) {
          isValid = false;
          statusMessage = 'Tanggal presensi kosong atau format tidak valid';
        }

        return {
          rowNum,
          nik: matchedEmp?.nik || nikOrName || '-',
          name: matchedEmp?.name || nameVal || sheetName || 'Tanpa Nama',
          date: dateVal,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          status,
          notes: notesVal,
          employeeId: matchedEmp?.id,
          isValid,
          statusMessage,
        };
      });

      setParsedRows(parsed);
    } catch (err: any) {
      setParseError(err.message || 'Gagal membaca file Excel.');
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid && r.employeeId);
    if (validRows.length === 0) {
      alert('Tidak ada baris data presensi yang valid untuk diimpor.');
      return;
    }

    const records: AttendanceRecord[] = validRows.map((r, i) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      return {
        id: `att-import-${Date.now()}-${i}`,
        employeeId: r.employeeId!,
        employeeName: r.name,
        employeeNik: r.nik,
        department: emp?.department || 'Umum',
        date: r.date,
        type: 'WFO',
        checkInTime: r.checkInTime ? (r.checkInTime.length === 5 ? `${r.checkInTime}:00` : r.checkInTime) : null,
        checkOutTime: r.checkOutTime ? (r.checkOutTime.length === 5 ? `${r.checkOutTime}:00` : r.checkOutTime) : null,
        status: r.status,
        notes: r.notes ? `[Impor Excel] ${r.notes}` : '[Impor Excel]',
        isManualEntry: true,
        isMonthlyRecapOnly: true,
      };
    });

    onImport(records);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Impor Data Presensi dari Excel
              </h2>
              <p className="text-xs text-slate-500">
                Unggah spreadsheet (.xlsx / .xls) untuk merekap atau mengisi presensi massal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Template Download Banner */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 space-y-0.5">
                <span className="font-bold block">Gunakan Template Standar</span>
                <p className="text-blue-700">
                  Unduh template Excel resmi kami agar kolom data NIK, Nama, Tanggal, Jam Masuk, dan Status langsung dikenali oleh sistem.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Template (.xlsx)</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              Klik untuk unggah atau seret file Excel ke sini
            </h3>
            <p className="text-xs text-slate-500">
              Format yang didukung: .xlsx, .xls (Maksimal 5MB)
            </p>
          </div>

          {/* Parsing error */}
          {parseError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Parsing Loader */}
          {isParsing && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <div className="text-xs font-semibold text-slate-700">Membaca dan memvalidasi file Excel...</div>
            </div>
          )}

          {/* Parsed Results Table */}
          {parsedRows.length > 0 && !isParsing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900">
                    Hasil Pratinjau ({parsedRows.length} baris dari {fileName})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    Valid: {parsedRows.filter((r) => r.isValid).length}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                    Perhatian/Error: {parsedRows.filter((r) => !r.isValid).length}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-semibold">Baris</th>
                      <th className="p-3 font-semibold">NIK / Karyawan</th>
                      <th className="p-3 font-semibold">Tanggal</th>
                      <th className="p-3 font-semibold">Jam Masuk - Pulang</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Keterangan Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.map((row) => (
                      <tr key={row.rowNum} className={row.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/30'}>
                        <td className="p-3 text-slate-500 font-mono">#{row.rowNum}</td>
                        <td className="p-3 font-semibold text-slate-900">
                          {row.name} <span className="text-slate-400 font-normal">({row.nik})</span>
                        </td>
                        <td className="p-3 font-mono text-slate-700">{row.date}</td>
                        <td className="p-3 font-mono text-slate-600">
                          {row.checkInTime} - {row.checkOutTime}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            row.status === 'Hadir Tepat Waktu' ? 'bg-emerald-100 text-emerald-800' :
                            row.status === 'Terlambat' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {row.isValid ? (
                            <span className="text-emerald-700 flex items-center gap-1 font-medium">
                              <Check className="w-3.5 h-3.5" /> Siap
                            </span>
                          ) : (
                            <span className="text-rose-600 font-medium">
                              {row.statusMessage}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {fileSize ? `File: ${fileName} (${fileSize})` : 'Belum ada file dipilih'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={parsedRows.filter((r) => r.isValid).length === 0}
              onClick={handleConfirmImport}
              className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 ${
                parsedRows.filter((r) => r.isValid).length === 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Impor {parsedRows.filter((r) => r.isValid).length} Data Presensi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
