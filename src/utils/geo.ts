// Haversine formula to compute distance in meters between two coordinates
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} meter`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function formatIndonesianDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Calculates late duration in minutes.
 * If check-in time is later than shift start time, returns the difference in minutes.
 * E.g., start 07:00 and checkIn 07:30 => returns 30 minutes.
 */
export function calculateLateMinutes(
  checkInTimeStr: string | null | undefined,
  workStartTimeStr: string | null | undefined
): number {
  if (!checkInTimeStr || !workStartTimeStr) return 0;
  try {
    const [startH, startM] = workStartTimeStr.split(':').map(Number);
    const [checkH, checkM] = checkInTimeStr.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const checkTotal = checkH * 60 + checkM;
    const diff = checkTotal - startTotal;
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

/**
 * Calculates early departure duration in minutes.
 * If checkout time is earlier than shift end time, returns difference in minutes.
 * E.g., end 17:00 and checkOut 16:30 => returns 30 minutes.
 */
export function calculateEarlyMinutes(
  checkOutTimeStr: string | null | undefined,
  workEndTimeStr: string | null | undefined,
  checkInTimeStr?: string | null | undefined,
  workStartTimeStr?: string | null | undefined
): number {
  if (!checkOutTimeStr || !workEndTimeStr) return 0;
  try {
    const [endH, endM] = workEndTimeStr.split(':').map(Number);
    const [checkH, checkM] = checkOutTimeStr.split(':').map(Number);
    const endTotal = endH * 60 + endM;
    const checkTotal = checkH * 60 + checkM;
    let diff = endTotal - checkTotal;

    // If employee checked in early (before workStartTime), offset early departure minutes
    if (checkInTimeStr && workStartTimeStr) {
      const [startH, startM] = workStartTimeStr.split(':').map(Number);
      const [inH, inM] = checkInTimeStr.split(':').map(Number);
      const startTotalMinutes = startH * 60 + startM;
      const inTotalMinutes = inH * 60 + inM;
      const earlyArrivalMinutes = startTotalMinutes - inTotalMinutes; 
      if (earlyArrivalMinutes > 0) {
        diff = diff - earlyArrivalMinutes;
      }
    }

    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

export function getTimeDifferenceMinutes(t1: string, t2: string): number {
  try {
    const [h1, m1] = (t1 || '08:30').split(':').map(Number);
    const [h2, m2] = (t2 || '09:00').split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  } catch {
    return 0;
  }
}

export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  try {
    const [h, m] = (timeStr || '08:30').split(':').map(Number);
    const totalMinutes = (h * 60 + m + minutesToAdd + 1440) % 1440;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  } catch {
    return '09:00';
  }
}

export function subtractMinutesFromTime(timeStr: string, minutesToSubtract: number): string {
  try {
    const [h, m] = (timeStr || '17:30').split(':').map(Number);
    let totalMinutes = h * 60 + m - minutesToSubtract;
    if (totalMinutes < 0) totalMinutes += 1440;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  } catch {
    return '16:30';
  }
}

export function formatMinutesDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 menit';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} jam ${m} menit`;
  if (h > 0) return `${h} jam`;
  return `${m} menit`;
}

