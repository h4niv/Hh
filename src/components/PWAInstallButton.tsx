import React, { useState } from 'react';
import { Smartphone, Download, Check, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenAndroidModal?: () => void;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ onOpenAndroidModal, className = '' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, render a small helper button or nothing
  if (isInstalled) {
    return (
      <button
        type="button"
        id="btn-android-app-installed"
        onClick={onOpenAndroidModal}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer ${className}`}
        title="Aplikasi Android Terpasang"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">App Android</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
      </button>
    );
  }

  // Chromium / Android / Desktop flow with beforeinstallprompt ready
  if (isInstallable) {
    return (
      <button
        type="button"
        id="btn-pwa-header-install"
        onClick={install}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-md shadow-emerald-900/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer ${className}`}
        title="Pasang Aplikasi di HP Android"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Instal di HP</span>
      </button>
    );
  }

  // Fallback: Always provide the Android App Modal trigger button so users can see how to install or build APK
  return (
    <button
      type="button"
      id="btn-open-android-helper"
      onClick={onOpenAndroidModal}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all cursor-pointer ${className}`}
      title="Aplikasi Mobile Android (PWA & APK)"
    >
      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
      <span className="hidden sm:inline">App Android</span>
    </button>
  );
};
