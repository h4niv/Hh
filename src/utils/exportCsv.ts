import { AttendanceRecord } from '../types';

export function exportAttendanceToCSV(
  records: AttendanceRecord[],
  filename = 'laporan_absensi_karyawan.csv'
) {
  const headers = [
    'Tanggal',
    'NIK',
    'Nama Karyawan',
    'Departemen',
    'Tipe Kehadiran',
    'Jam Masuk',
    'Jam Pulang',
    'Status',
    'Jarak Kantor (Meter)',
    'Status Lokasi',
    'Metode Input',
    'Catatan',
  ];

  const rows = records.map((rec) => {
    const isWithin = rec.location ? (rec.location.isWithinRadius ? 'Dalam Radius' : 'Luar Radius') : '-';
    const distance = rec.location ? `${rec.location.distanceToOfficeMeters} m` : '-';
    const inputMethod = rec.isManualEntry ? 'Input Manual' : 'Sistem (Kamera & GPS)';

    return [
      rec.date,
      `"${rec.employeeNik}"`,
      `"${rec.employeeName.replace(/"/g, '""')}"`,
      `"${rec.department.replace(/"/g, '""')}"`,
      rec.type,
      rec.checkInTime || '-',
      rec.checkOutTime || '-',
      rec.status,
      distance,
      isWithin,
      inputMethod,
      `"${(rec.notes || '').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
