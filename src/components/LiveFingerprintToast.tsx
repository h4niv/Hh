import React from 'react';
import { 
  Fingerprint, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Wifi, 
  X, 
  Sparkles,
  Zap,
  Building2,
  UserCheck
} from 'lucide-react';
import { AutoProcessResult } from '../services/fingerprintAutoReceiver';

interface LiveFingerprintToastProps {
  notification: AutoProcessResult | null;
  onDismiss: () => void;
}

export default function LiveFingerprintToast({
  notification,
  onDismiss
}: LiveFingerprintToastProps) {
  if (!notification) return null;

  const { success, type, employee, record, punch, message } = notification;

  const isCheckIn = type === 'check_in';
  const isCheckOut = type === 'check_out';
  const isDuplicate = type === 'duplicate';
  const isUnmapped = type === 'unmapped';

  const isLate = record?.status === 'Terlambat';

  return (
    <div className="fixed top-20 right-4 z-50 max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300">
      <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all ${
        isUnmapped
          ? 'bg-rose-900/95 border-rose-500 text-white'
          : isLate
          ? 'bg-amber-900/95 border-amber-500 text-white'
          : isCheckOut
          ? 'bg-slate-900/95 border-blue-500 text-white'
          : 'bg-emerald-900/95 border-emerald-400 text-white'
      }`}>
        <div className="flex items-start justify-between gap-3">
          {/* Avatar or Icon */}
          <div className="relative shrink-0">
            {employee?.avatarUrl ? (
              <img
                src={employee.avatarUrl}
                alt={employee.name}
                className="w-12 h-12 rounded-xl object-cover border-2 border-white/40 shadow-md"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                <Fingerprint className="w-6 h-6 text-white" />
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center animate-ping" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white" />
            </span>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                <Wifi className="w-3 h-3 text-emerald-300 animate-pulse" />
                Auto LAN Finger
              </span>
              <span className="text-[11px] text-white/70 font-mono">
                {punch.timestamp.split(' ')[1] || punch.timestamp}
              </span>
            </div>

            <h4 className="text-sm font-bold truncate">
              {employee ? employee.name : `PIN [${punch.pin}] Belum Terdaftar`}
            </h4>

            <p className="text-xs text-white/90 mt-0.5 line-clamp-2">
              {message}
            </p>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
              {employee && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium">
                  {employee.department} • {employee.role}
                </span>
              )}
              {isLate && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-bold">
                  Terlambat ({record?.lateMinutes || 0}m)
                </span>
              )}
              {record?.status === 'Hadir Tepat Waktu' && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white font-bold">
                  Tepat Waktu
                </span>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
