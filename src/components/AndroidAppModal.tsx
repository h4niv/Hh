import { useState } from 'react';
import { 
  Smartphone, 
  Download, 
  CheckCircle2, 
  Sparkles, 
  Terminal, 
  Copy, 
  Check, 
  X, 
  Layers, 
  Globe, 
  ShieldCheck, 
  Zap, 
  FileCode, 
  Play, 
  Radio, 
  ExternalLink,
  ChevronRight,
  WifiOff,
  Camera,
  MapPin,
  Lock
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AndroidAppModal({ isOpen, onClose }: AndroidAppModalProps) {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'apk' | 'twa'>('pwa');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentUrl = window.location.href;

  const capacitorConfigJson = JSON.stringify({
    appId: 'com.absensipro.app',
    appName: 'Sistem Absensi Karyawan',
    webDir: 'dist',
    bundledWebRuntime: false,
    server: {
      androidScheme: 'https',
      cleartext: true
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 2000,
        backgroundColor: "#0f172a"
      }
    }
  }, null, 2);

  const capacitorBuildScript = `# 1. Install Capacitor di proyek
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Inisialisasi konfigurasi Capacitor
npx cap init "AbsensiPro" "com.absensipro.app" --web-dir=dist

# 3. Build aplikasi web React
npm run build

# 4. Tambahkan platform Android
npx cap add android

# 5. Sinkronkan asset & buka di Android Studio untuk Build APK
npx cap sync
npx cap open android
`;

  const twaBubblewrapScript = `# Menggunakan Google Official Bubblewrap (TWA)
# 1. Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# 2. Inisialisasi TWA dari URL web yang sudah dideploy
bubblewrap init --manifest=${window.location.origin}/manifest.webmanifest

# 3. Build file .apk dan .aab untuk Play Store
bubblewrap build
`;

  const handleDownloadCapacitorConfig = () => {
    const blob = new Blob([capacitorConfigJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capacitor.config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150" id="android-app-modal">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Aplikasi Mobile Android (PWA & APK)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                  Android Ready 📱
                </span>
              </div>
              <p className="text-xs text-slate-300">Dapat diinstal langsung di HP Android (PWA 1-Klik) atau dikonversi menjadi file APK native</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-android-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/80 gap-2 py-2">
          <button
            id="tab-android-pwa"
            onClick={() => setActiveTab('pwa')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'pwa'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>1. Instal Langsung di HP (PWA Instan)</span>
          </button>

          <button
            id="tab-android-apk"
            onClick={() => setActiveTab('apk')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'apk'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>2. Build APK Native (Capacitor)</span>
          </button>

          <button
            id="tab-android-twa"
            onClick={() => setActiveTab('twa')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'twa'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>3. TWA Google Play (Bubblewrap)</span>
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* TAB 1: PWA Direct Install */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              
              {/* Install Action Hero */}
              <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="space-y-1.5 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      {isInstalled ? 'Aplikasi Sudah Terpasang di Perangkat!' : 'Pasang Aplikasi di HP Android Anda Sekarang'}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-lg">
                    Aplikasi ini telah dilengkapi teknologi <strong>PWA (Progressive Web App)</strong>. Begitu diinstal, aplikasi akan muncul di layar utama (Home Screen) HP, berjalan layar penuh tanpa address bar browser, serta mendukung GPS akurat dan kamera selfie.
                  </p>
                </div>

                <div className="shrink-0 w-full sm:w-auto">
                  {isInstalled ? (
                    <div className="px-4 py-2.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Sudah Terpasang (Standalone)</span>
                    </div>
                  ) : isInstallable ? (
                    <button
                      type="button"
                      id="btn-trigger-pwa-install"
                      onClick={install}
                      className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Instal di HP Android Sekarang 🚀</span>
                    </button>
                  ) : (
                    <div className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium text-center shadow-2xs">
                      Buka di Chrome Android untuk 1-Klik Install
                    </div>
                  )}
                </div>
              </div>

              {/* Native Capabilities on Android */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Kamera Selfie Langsung</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">Membuka kamera depan HP langsung dengan verifikasi wajah.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">GPS Geofencing HP</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">Memanfaatkan sensor GPS presisi tinggi untuk validasi radius kantor.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Offline Caching</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">Aplikasi tetap dapat dibuka meskipun koneksi internet terputus.</p>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Android Installation Guide */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  Cara Memasang di HP Android (Google Chrome / Edge / Samsung Browser):
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px]">1</div>
                    <p className="font-bold text-slate-800">Buka di Browser HP</p>
                    <p className="text-[11px] text-slate-600">Buka link aplikasi ini di Google Chrome pada smartphone Android Anda.</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px]">2</div>
                    <p className="font-bold text-slate-800">Tekan Menu Titik Tiga (⋮)</p>
                    <p className="text-[11px] text-slate-600">Tekan menu titik tiga di pojok kanan atas browser Google Chrome.</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[11px]">3</div>
                    <p className="font-bold text-slate-800">Pilih "Instal Aplikasi"</p>
                    <p className="text-[11px] text-slate-600">Pilih <em>"Tambahkan ke Layar Utama"</em> atau <em>"Instal Aplikasi"</em>. Ikon AbsensiPro akan muncul di menu HP!</p>
                  </div>
                </div>

                {/* Share Link Box */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">URL Aplikasi untuk Dibagikan ke Karyawan:</span>
                    <span className="text-xs font-mono text-indigo-600 truncate block font-bold">{currentUrl}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentUrl, 'url')}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  >
                    {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'url' ? 'Tersalin!' : 'Salin Link'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Capacitor Native APK Build */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-950 space-y-1">
                <h4 className="font-bold text-sm text-indigo-900 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  Konversi ke Proyek Native Android Studio (File .APK)
                </h4>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  Dengan <strong>Capacitor</strong>, kode React Vite ini dapat langsung dibungkus menjadi proyek Android Studio asli sehingga menghasilkan file <code className="bg-white px-1 py-0.5 rounded border border-indigo-200 font-bold">app-release.apk</code> yang dapat dibagikan langsung ke karyawan lewat WhatsApp atau diinstal offline.
                </p>
              </div>

              {/* Step by step Terminal Commands */}
              <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200 font-mono">Terminal / Command Prompt (Build APK)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(capacitorBuildScript, 'cap-script')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-700"
                  >
                    {copiedKey === 'cap-script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cap-script' ? 'Tersalin!' : 'Salin Perintah'}</span>
                  </button>
                </div>

                <pre className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed border border-slate-800">
                  {capacitorBuildScript}
                </pre>
              </div>

              {/* Download Capacitor Config */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
                <div>
                  <h5 className="text-xs font-bold text-slate-900">File Konfigurasi capacitor.config.json</h5>
                  <p className="text-[11px] text-slate-500">Konfigurasi siap pakai dengan Package ID <code className="font-bold text-indigo-600">com.absensipro.app</code></p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadCapacitorConfig}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download capacitor.config.json</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 3: TWA Bubblewrap (Google Play Store) */}
          {activeTab === 'twa' && (
            <div className="space-y-4">
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-950 space-y-1">
                <h4 className="font-bold text-sm text-teal-900 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-teal-600" />
                  Trusted Web Activity (TWA) untuk Google Play Store
                </h4>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  TWA adalah standar resmi dari Google untuk memaketkan PWA menjadi file <strong>Android App Bundle (.aab)</strong> atau <strong>.apk</strong> yang dapat langsung diunggah ke Google Play Console tanpa perlu menulis kode native Android.
                </p>
              </div>

              <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-slate-200 font-mono">Google Bubblewrap CLI</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(twaBubblewrapScript, 'twa-script')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-700"
                  >
                    {copiedKey === 'twa-script' ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'twa-script' ? 'Tersalin!' : 'Salin Perintah'}</span>
                  </button>
                </div>

                <pre className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-teal-300 overflow-x-auto leading-relaxed border border-slate-800">
                  {twaBubblewrapScript}
                </pre>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Mendukung Android 8.0 Oreo hingga Android 15+</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
