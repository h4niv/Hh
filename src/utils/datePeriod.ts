export type PeriodPreset = 
  | 'semua' 
  | 'hari-ini' 
  | 'kemarin' 
  | '7-hari' 
  | 'minggu-ini' 
  | 'bulan-ini' 
  | 'bulan-lalu' 
  | 'kustom';

export interface PeriodOption {
  id: PeriodPreset;
  label: string;
  description?: string;
}

export const PERIOD_PRESETS: PeriodOption[] = [
  { id: 'semua', label: 'Semua Periode', description: 'Semua catatan riwayat' },
  { id: 'hari-ini', label: 'Hari Ini', description: 'Presensi hari ini' },
  { id: 'kemarin', label: 'Kemarin', description: 'Presensi 1 hari lalu' },
  { id: '7-hari', label: '7 Hari Terakhir', description: 'Seminggu ke belakang' },
  { id: 'minggu-ini', label: 'Minggu Ini', description: 'Senin s/d hari ini' },
  { id: 'bulan-ini', label: 'Bulan Ini', description: 'Awal bulan s/d akhir bulan' },
  { id: 'bulan-lalu', label: 'Bulan Lalu', description: '1 bulan sebelumnya penuh' },
  { id: 'kustom', label: 'Rentang Kustom', description: 'Tentukan tanggal manual' },
];

export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPresetDateRange(preset: PeriodPreset): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = formatDateToISO(now);

  switch (preset) {
    case 'hari-ini':
      return { startDate: todayStr, endDate: todayStr };

    case 'kemarin': {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = formatDateToISO(yesterday);
      return { startDate: yStr, endDate: yStr };
    }

    case '7-hari': {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 6); // 7 days total including today
      return { startDate: formatDateToISO(past7), endDate: todayStr };
    }

    case 'minggu-ini': {
      // Monday of current week
      const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      return { startDate: formatDateToISO(monday), endDate: todayStr };
    }

    case 'bulan-ini': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { 
        startDate: formatDateToISO(startOfMonth), 
        endDate: formatDateToISO(endOfMonth) 
      };
    }

    case 'bulan-lalu': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { 
        startDate: formatDateToISO(startOfLastMonth), 
        endDate: formatDateToISO(endOfLastMonth) 
      };
    }

    case 'semua':
    case 'kustom':
    default:
      return { startDate: '', endDate: '' };
  }
}

export function isDateInPeriod(dateStr: string, startDate: string, endDate: string): boolean {
  if (!dateStr) return false;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

export function formatShortIndonesianDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function getPeriodDisplayLabel(
  preset: PeriodPreset,
  startDate: string,
  endDate: string
): string {
  if (preset === 'hari-ini') {
    return `Hari Ini (${formatShortIndonesianDate(startDate)})`;
  }
  if (preset === 'kemarin') {
    return `Kemarin (${formatShortIndonesianDate(startDate)})`;
  }
  if (preset === 'semua' && !startDate && !endDate) {
    return 'Semua Periode Data';
  }
  if (startDate && endDate) {
    if (startDate === endDate) {
      return formatShortIndonesianDate(startDate);
    }
    return `${formatShortIndonesianDate(startDate)} s/d ${formatShortIndonesianDate(endDate)}`;
  }
  if (startDate) {
    return `Mulai ${formatShortIndonesianDate(startDate)}`;
  }
  if (endDate) {
    return `Hingga ${formatShortIndonesianDate(endDate)}`;
  }
  return 'Semua Periode Data';
}
