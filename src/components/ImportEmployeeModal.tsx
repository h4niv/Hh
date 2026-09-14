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
  RefreshCw,
  Clock,
  Building2,
  Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, ShiftInfo } from '../types';

interface ImportEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEmployees: Employee[];
  departments: string[];
  onImport: (importedEmployees: Employee[]) => void;
}

interface ParsedEmployeeRow {
  rowNum: number;
  nik: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  startTime: string;
  endTime: string;
  lateTolerance: number;
  leaveQuota: number;
  status: 'valid' | 'warning' | 'error';
  statusMessage: string;
  isDuplicate: boolean;
}

const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
];

export default function ImportEmployeeModal({
  isOpen,
  onClose,
  existingEmployees,
  departments,
  onImport,
}: ImportEmployeeModalProps) {
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [duplicateAction, setDuplicateAction] = useState<'update' | 'skip'>('update');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Function to download standard Excel template (.xlsx)
  const handleDownloadTemplate = () => {
    // Header labels with standard Indonesian columns
    const templateData = [
      {
        'NIK': 'KRY-2024-006',
        'Nama Lengkap': 'Ahmad Fauzi',
        'Email': 'ahmad.fauzi@sinergi.co.id',
        'No Telepon': '081234567891',
        'Departemen': 'Teknologi & Informasi',
        'Jabatan': 'Backend Engineer',
        'Jam Masuk': '08:30',
        'Jam Pulang': '17:30',
        'Toleransi Menit': 15,
        'Kuota Cuti': 12,
      },
      {
        'NIK': 'KRY-2024-007',
        'Nama Lengkap': 'Dewi Sartika',
        'Email': 'dewi.sartika@sinergi.co.id',
        'No Telepon': '081398765432',
        'Departemen': 'Keuangan & Akuntansi',
        'Jabatan': 'Finance Analyst',
        'Jam Masuk': '08:30',
        'Jam Pulang': '17:30',
        'Toleransi Menit': 15,
        'Kuota Cuti': 12,
      },
      {
        'NIK': 'KRY-2024-008',
        'Nama Lengkap': 'Bagus Prasetyo',
        'Email': 'bagus.prasetyo@sinergi.co.id',
        'No Telepon': '082155443322',
        'Departemen': 'Operasional & Logistik',
        'Jabatan': 'Logistics Supervisor',
        'Jam Masuk': '08:00',
        'Jam Pulang': '17:00',
        'Toleransi Menit': 15,
        'Kuota Cuti': 12,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths for better visual readability
    worksheet['!cols'] = [
      { wch: 16 }, // NIK
      { wch: 22 }, // Nama Lengkap
      { wch: 30 }, // Email
      { wch: 18 }, // No Telepon
      { wch: 25 }, // Departemen
      { wch: 22 }, // Jabatan
      { wch: 12 }, // Jam Masuk
      { wch: 12 }, // Jam Pulang
      { wch: 16 }, // Toleransi Menit
      { wch: 12 }, // Kuota Cuti
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Karyawan');

    // Also add an instructions sheet
    const petunjukData = [
      { 'Panduan Pengisian': '1. Kolom NIK, Nama Lengkap, Email, Departemen, dan Jabatan bersifat WAJIB diisi.' },
      { 'Panduan Pengisian': '2. Format Jam Masuk dan Jam Pulang diisi dengan format HH:MM (contoh: 08:30, 17:30).' },
      { 'Panduan Pengisian': '3. Toleransi Menit adalah toleransi keterlambatan presensi dalam menit (default 15 menit).' },
      { 'Panduan Pengisian': '4. Kuota Cuti adalah jumlah sisa cuti tahunan (default 12 hari).' },
      { 'Panduan Pengisian': '5. Simpan file dalam format .xls atau .xlsx lalu unggah kembali ke sistem.' },
    ];
    const petunjukSheet = XLSX.utils.json_to_sheet(petunjukData);
    petunjukSheet['!cols'] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, petunjukSheet, 'Petunjuk Pengisian');

    XLSX.writeFile(workbook, 'Template_Import_Karyawan.xlsx');
  };

  // Helper to parse file
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

      // Pick first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('Lembar kerja kosong atau tidak ada data yang terbaca.');
      }

      const existingNiks = new Set(existingEmployees.map((e) => e.nik.toLowerCase().trim()));
      const seenFileNiks = new Set<string>();

      const parsed: ParsedEmployeeRow[] = rawRows.map((row, idx) => {
        const rowNum = idx + 2; // header is row 1

        // Normalizing column key getters to tolerate variations (case insensitive / spaces)
        const getVal = (keys: string[]): string => {
          for (const k of Object.keys(row)) {
            const cleanKey = k.trim().toLowerCase();
            if (keys.some((target) => cleanKey === target.toLowerCase())) {
              return String(row[k] || '').trim();
            }
          }
          return '';
        };

        const nik = getVal(['nik', 'no induk', 'nomor induk', 'nip', 'id karyawan']);
        const name = getVal(['nama', 'nama lengkap', 'employee name', 'name', 'full name']);
        const email = getVal(['email', 'alamat email', 'e-mail']);
        const phone = getVal(['no telepon', 'telepon', 'phone', 'no hp', 'whatsapp', 'no wa']);
        const dept = getVal(['departemen', 'divisi', 'department', 'bagian', 'unit']) || departments[0] || 'Umum';
        const role = getVal(['jabatan', 'posisi', 'role', 'title', 'position']) || 'Staff';
        const startTime = getVal(['jam masuk', 'start time', 'masuk']) || '08:30';
        const endTime = getVal(['jam pulang', 'end time', 'pulang', 'keluar']) || '17:30';
        const lateTolStr = getVal(['toleransi menit', 'toleransi', 'tolerance', 'late tolerance']);
        const leaveQuotaStr = getVal(['kuota cuti', 'cuti', 'leave quota', 'sisa cuti']);

        const lateTolerance = lateTolStr ? parseInt(lateTolStr, 10) || 15 : 15;
        const leaveQuota = leaveQuotaStr ? parseInt(leaveQuotaStr, 10) || 12 : 12;

        const isDuplicate = existingNiks.has(nik.toLowerCase());
        const isFileDuplicate = seenFileNiks.has(nik.toLowerCase());
        if (nik) {
          seenFileNiks.add(nik.toLowerCase());
        }

        let status: 'valid' | 'warning' | 'error' = 'valid';
        let statusMessage = 'Siap diimpor';

        if (!name || !nik) {
          status = 'error';
          statusMessage = 'Nama atau NIK kosong';
        } else if (!email || !email.includes('@')) {
          status = 'error';
          statusMessage = 'Format email tidak valid';
        } else if (isFileDuplicate) {
          status = 'warning';
          statusMessage = 'Duplikat di dalam file ini';
        } else if (isDuplicate) {
          status = 'warning';
          statusMessage = 'NIK sudah terdaftar sebelumnya';
        }

        return {
          rowNum,
          nik,
          name,
          email,
          phone: phone || '-',
          department: dept,
          role,
          startTime,
          endTime,
          lateTolerance,
          leaveQuota,
          status,
          statusMessage,
          isDuplicate: isDuplicate || isFileDuplicate,
        };
      });

      setParsedRows(parsed);
    } catch (err: unknown) {
      console.error('Error parsing excel:', err);
      setParseError((err as Error)?.message || 'Gagal membaca file Excel. Pastikan format valid (.xls / .xlsx).');
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
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

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Execute Import
  const handleExecuteImport = () => {
    // Filter rows based on duplicateAction
    const validRows = parsedRows.filter((r) => r.status !== 'error');

    if (validRows.length === 0) {
      setParseError('Tidak ada baris data valid yang dapat diimpor.');
      return;
    }

    const rowsToImport = validRows.filter((r) => {
      if (duplicateAction === 'skip' && r.isDuplicate) {
        return false;
      }
      return true;
    });

    const employeesToSave: Employee[] = rowsToImport.map((row, idx) => {
      // If employee already exists with same NIK and update is chosen, preserve existing ID
      const existing = existingEmployees.find((e) => e.nik.toLowerCase() === row.nik.toLowerCase());
      const empId = existing ? existing.id : `emp-xls-${Date.now()}-${idx}`;

      const shift: ShiftInfo = {
        id: existing?.shift?.id || `shift-${Date.now()}-${idx}`,
        name: `Reguler (${row.startTime} - ${row.endTime})`,
        startTime: row.startTime,
        endTime: row.endTime,
        lateToleranceMinutes: row.lateTolerance,
      };

      const avatar = existing?.avatarUrl || SAMPLE_AVATARS[idx % SAMPLE_AVATARS.length];

      return {
        id: empId,
        nik: row.nik,
        name: row.name,
        email: row.email,
        phone: row.phone,
        department: row.department,
        role: row.role,
        avatarUrl: avatar,
        shift,
        remainingLeaveQuota: row.leaveQuota,
      };
    });

    onImport(employeesToSave);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFileName('');
    setFileSize('');
    setParsedRows([]);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validCount = parsedRows.filter((r) => r.status === 'valid').length;
  const warningCount = parsedRows.filter((r) => r.status === 'warning').length;
  const errorCount = parsedRows.filter((r) => r.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Import Data Karyawan (Excel)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                  .xls / .xlsx / .csv
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Unggah spreadsheet untuk menambahkan atau memperbarui banyak data karyawan secara massal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* Step 1: Download Template Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600" />
                <span>Belum memiliki format Excel yang sesuai?</span>
              </div>
              <p className="text-xs text-blue-700">
                Unduh template resmi kami dengan susunan kolom standar (NIK, Nama, Email, Shift, Departemen, dsb).
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Unduh Template Excel (.xlsx)</span>
            </button>
          </div>

          {/* Step 2: File Upload / Drag-and-Drop Area */}
          {!parsedRows.length ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer ${
                isDragOver
                  ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
                  : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100 shadow-2xs">
                {isParsing ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">
                  {isParsing ? 'Sedang memproses file...' : 'Tarik & Letakkan file Excel di sini, atau klik untuk memilih file'}
                </p>
                <p className="text-xs text-slate-500">
                  Mendukung format spreadsheet <strong>.xlsx</strong>, <strong>.xls</strong>, dan <strong>.csv</strong> (Maks. 5 MB)
                </p>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors">
                <FileCheck className="w-4 h-4" />
                <span>Pilih File dari Komputer</span>
              </div>
            </div>
          ) : (
            /* File Info & Options Bar */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    XLS
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{fileName}</span>
                      <span className="text-xs font-normal text-slate-500">({fileSize})</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{parsedRows.length} total baris</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-medium">{validCount} siap impor</span>
                      {warningCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-700 font-medium">{warningCount} perlu konfirmasi</span>
                        </>
                      )}
                      {errorCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-rose-700 font-medium">{errorCount} error</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Ganti File
                  </button>
                </div>
              </div>

              {/* Duplicate Resolution Strategy */}
              {warningCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs space-y-2">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Ditemukan {warningCount} data dengan NIK yang sudah ada di sistem:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-slate-800">
                    <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="dupAction"
                        checked={duplicateAction === 'update'}
                        onChange={() => setDuplicateAction('update')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span><strong>Perbarui (Update):</strong> Timpa data karyawan yang NIK-nya sama dengan data baru</span>
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="dupAction"
                        checked={duplicateAction === 'skip'}
                        onChange={() => setDuplicateAction('skip')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span><strong>Lewati (Skip):</strong> Hanya impor data baru dan pertahankan data lama</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Pratinjau Data ({parsedRows.length} Karyawan)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Periksa kembali sebelum data disimpan ke sistem
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto overflow-x-auto divide-y divide-slate-100">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">NIK</th>
                        <th className="py-2.5 px-3">Nama Lengkap</th>
                        <th className="py-2.5 px-3">Departemen & Jabatan</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Shift Kerja</th>
                        <th className="py-2.5 px-3">Kuota Cuti</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {parsedRows.map((row) => (
                        <tr
                          key={row.rowNum}
                          className={
                            row.status === 'error'
                              ? 'bg-rose-50/50'
                              : row.status === 'warning'
                              ? 'bg-amber-50/40'
                              : 'hover:bg-slate-50/70'
                          }
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {row.status === 'valid' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[11px] border border-emerald-200">
                                <Check className="w-3 h-3" /> Siap
                              </span>
                            ) : row.status === 'warning' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-medium text-[11px] border border-amber-200">
                                <AlertTriangle className="w-3 h-3" /> {row.statusMessage}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-medium text-[11px] border border-rose-200">
                                <X className="w-3 h-3" /> {row.statusMessage}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                            {row.nik || <span className="text-rose-500 italic">Kosong</span>}
                          </td>
                          <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                            {row.name || <span className="text-rose-500 italic">Kosong</span>}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div>{row.role}</div>
                            <div className="text-[10px] text-slate-500">{row.department}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {row.email}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono text-[11px]">
                              {row.startTime} - {row.endTime}
                            </span>
                            <div className="text-[10px] text-slate-400">tol: {row.lateTolerance}m</div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-semibold">
                            {row.leaveQuota} hari
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {parseError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && (
              <span>
                {validCount + (duplicateAction === 'update' ? warningCount : 0)} data akan dimasukkan ke sistem
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-white transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              id="btn-confirm-import-excel"
              disabled={parsedRows.length === 0 || (validCount === 0 && warningCount === 0)}
              onClick={handleExecuteImport}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer ${
                parsedRows.length === 0 || (validCount === 0 && warningCount === 0)
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Simpan & Impor Data Sekarang</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
