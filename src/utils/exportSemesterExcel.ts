import * as XLSX from 'xlsx';
import { Employee } from '../types';

export interface SemesterReportRow {
  no: number;
  id: string;
  name: string;
  nik: string;
  tmt: string;
  employmentCategory?: 'GTY' | 'GTT' | 'KTY' | 'KTT' | 'PTT';
  monthlyMinutes: number[]; // 6 values for the 6 months
  totalMinutes: number;
  izinHari: number;
  sakitHari: number;
  dinasHari: number;
  alpaHari: number;
  izinTerlambatCount: number;
  izinTerlambatMenit: number;
  izinPulangAwalCount: number;
  izinPulangAwalMenit: number;
  performanceScore?: number;
  performanceGrade?: string;
}

export interface SemesterExportConfig {
  institutionName: string;
  academicYear: string;
  periodLabel: string;
  monthHeaders: string[]; // e.g. ['JULI', 'AUG', 'SEP', 'OKT', 'NOV', 'DES']
  cityName?: string;
  headmasterName?: string;
  headmasterNip?: string;
  supervisorName?: string;
  supervisorNip?: string;
}

export function exportSemesterReportToExcel(
  rows: SemesterReportRow[],
  config: SemesterExportConfig,
  filename = 'rekap_penilaian_kinerja_kehadiran_semester.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // Create empty 2D array of data
  const data: (string | number)[][] = [];

  // Row 0: Title
  data.push([`REKAP KEHADIRAN, KETERLAMBATAN DAN PULANG AWAL GURU DAN KARYAWAN ${config.institutionName.toUpperCase()}`]);
  // Row 1: Subtitle
  data.push([`TAHUN PELAJARAN ${config.academicYear.toUpperCase()} (PERIODE ${config.periodLabel.toUpperCase()})`]);
  // Row 2: Empty row
  data.push([]);

  // Row 3: Header Row 1 (Without status column)
  const headerRow1 = [
    'NO',
    'NAMA',
    'NIK',
    'TMT',
    'KETERLAMBATAN (MENIT)', '', '', '', '', '', '', // 7 columns (6 months + JUMLAH)
    'TIDAK MASUK (HARI)', '', '', '', // 4 columns (IJIN, SAKIT, DINAS, ALPA)
    'IJIN DATANG TERLAMBAT', '',     // 2 columns (JUMLAH, MENIT)
    'IJIN PULANG AWAL', '',          // 2 columns (JUMLAH, MENIT)
    'PENILAIAN KINERJA',             // 1 column (SKOR & PREDIKAT)
  ];
  data.push(headerRow1);

  // Row 4: Header Row 2
  const headerRow2 = [
    '', // NO
    '', // NAMA
    '', // NIK
    '', // TMT
    config.monthHeaders[0] || 'BULAN 1',
    config.monthHeaders[1] || 'BULAN 2',
    config.monthHeaders[2] || 'BULAN 3',
    config.monthHeaders[3] || 'BULAN 4',
    config.monthHeaders[4] || 'BULAN 5',
    config.monthHeaders[5] || 'BULAN 6',
    'JUMLAH',
    'IJIN',
    'SAKIT',
    'DINAS',
    'ALPA',
    'JUMLAH',
    'MENIT',
    'JUMLAH',
    'MENIT',
    'SKOR / PREDIKAT',
  ];
  data.push(headerRow2);

  const formatCell = (val: number) => (val === 0 ? '-' : val);

  // Write all rows (ordered: GTY -> GTT -> KTY -> KTT, sorted by NIK)
  rows.forEach((row, idx) => {
    data.push([
      idx + 1,
      row.name,
      row.nik,
      row.tmt || '-',
      formatCell(row.monthlyMinutes[0] || 0),
      formatCell(row.monthlyMinutes[1] || 0),
      formatCell(row.monthlyMinutes[2] || 0),
      formatCell(row.monthlyMinutes[3] || 0),
      formatCell(row.monthlyMinutes[4] || 0),
      formatCell(row.monthlyMinutes[5] || 0),
      formatCell(row.totalMinutes || 0),
      formatCell(row.izinHari || 0),
      formatCell(row.sakitHari || 0),
      formatCell(row.dinasHari || 0),
      formatCell(row.alpaHari || 0),
      formatCell(row.izinTerlambatCount || 0),
      formatCell(row.izinTerlambatMenit || 0),
      formatCell(row.izinPulangAwalCount || 0),
      formatCell(row.izinPulangAwalMenit || 0),
      row.performanceScore ? `${row.performanceScore} (${row.performanceGrade || 'Baik'})` : '-',
    ]);
  });

  // Calculate overall totals
  const totalMonthly = [0, 0, 0, 0, 0, 0];
  let grandTotalMinutes = 0;
  let totalIzin = 0;
  let totalSakit = 0;
  let totalDinas = 0;
  let totalAlpa = 0;
  let totalIzinTerlambatCount = 0;
  let totalIzinTerlambatMenit = 0;
  let totalIzinPulangAwalCount = 0;
  let totalIzinPulangAwalMenit = 0;

  rows.forEach((r) => {
    for (let i = 0; i < 6; i++) {
      totalMonthly[i] += r.monthlyMinutes[i] || 0;
    }
    grandTotalMinutes += r.totalMinutes || 0;
    totalIzin += r.izinHari || 0;
    totalSakit += r.sakitHari || 0;
    totalDinas += r.dinasHari || 0;
    totalAlpa += r.alpaHari || 0;
    totalIzinTerlambatCount += r.izinTerlambatCount || 0;
    totalIzinTerlambatMenit += r.izinTerlambatMenit || 0;
    totalIzinPulangAwalCount += r.izinPulangAwalCount || 0;
    totalIzinPulangAwalMenit += r.izinPulangAwalMenit || 0;
  });

  // Single clean Grand Total Row
  data.push([
    '',
    'TOTAL KESELURUHAN',
    '',
    '',
    totalMonthly[0] || '-',
    totalMonthly[1] || '-',
    totalMonthly[2] || '-',
    totalMonthly[3] || '-',
    totalMonthly[4] || '-',
    totalMonthly[5] || '-',
    grandTotalMinutes || '-',
    totalIzin || '-',
    totalSakit || '-',
    totalDinas || '-',
    totalAlpa || '-',
    totalIzinTerlambatCount || '-',
    totalIzinTerlambatMenit || '-',
    totalIzinPulangAwalCount || '-',
    totalIzinPulangAwalMenit || '-',
    '-',
  ]);

  // Signature Block rows in Excel
  data.push([]);
  data.push([]);
  const todayDateStr = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  data.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', `${config.cityName || 'Semarang'}, ${todayDateStr}`]);
  data.push(['', 'Mengetahui,', '', '', '', '', '', '', '', '', '', '', '', '', 'Waka. Manajemen Mutu / SDM']);
  data.push(['', `Kepala ${config.institutionName}`, '', '', '', '', '', '', '', '', '', '', '', '', '']);
  data.push([]);
  data.push([]);
  data.push([]);
  data.push(['', `( ${config.headmasterName || '................................'} )`, '', '', '', '', '', '', '', '', '', '', '', '', `( ${config.supervisorName || '................................'} )`]);
  if (config.headmasterNip) {
    data.push(['', `NIP. ${config.headmasterNip}`, '', '', '', '', '', '', '', '', '', '', '', '', config.supervisorNip ? `NIP. ${config.supervisorNip}` : '']);
  }

  // Convert array to worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set merged cells (0-indexed)
  ws['!merges'] = [
    // Title: A1:T1
    { s: { r: 0, c: 0 }, e: { r: 0, c: 19 } },
    // Subtitle: A2:T2
    { s: { r: 1, c: 0 }, e: { r: 1, c: 19 } },
    // NO: A4:A5
    { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
    // NAMA: B4:B5
    { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
    // NIK: C4:C5
    { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
    // TMT: D4:D5
    { s: { r: 3, c: 3 }, e: { r: 4, c: 3 } },
    // KETERLAMBATAN (MENIT): E4:K4 (columns 4 to 10)
    { s: { r: 3, c: 4 }, e: { r: 3, c: 10 } },
    // TIDAK MASUK (HARI): L4:O4 (columns 11 to 14)
    { s: { r: 3, c: 11 }, e: { r: 3, c: 14 } },
    // IJIN DATANG TERLAMBAT: P4:Q4 (columns 15 to 16)
    { s: { r: 3, c: 15 }, e: { r: 3, c: 16 } },
    // IJIN PULANG AWAL: R4:S4 (columns 17 to 18)
    { s: { r: 3, c: 17 }, e: { r: 3, c: 18 } },
    // PENILAIAN KINERJA: T4:T5 (column 19)
    { s: { r: 3, c: 19 }, e: { r: 4, c: 19 } },
  ];

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // NO
    { wch: 28 }, // NAMA
    { wch: 18 }, // NIK
    { wch: 18 }, // TMT
    { wch: 8 },  // M1
    { wch: 8 },  // M2
    { wch: 8 },  // M3
    { wch: 8 },  // M4
    { wch: 8 },  // M5
    { wch: 8 },  // M6
    { wch: 10 }, // JUMLAH MENIT
    { wch: 8 },  // IJIN
    { wch: 8 },  // SAKIT
    { wch: 8 },  // DINAS
    { wch: 8 },  // ALPA
    { wch: 10 }, // IJIN TERLAMBAT JML
    { wch: 10 }, // IJIN TERLAMBAT MENIT
    { wch: 10 }, // IJIN PULANG AWAL JML
    { wch: 10 }, // IJIN PULANG AWAL MENIT
    { wch: 18 }, // PENILAIAN KINERJA
  ];

  // Append worksheet
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Semester');

  // Trigger download
  XLSX.writeFile(wb, filename);
}
