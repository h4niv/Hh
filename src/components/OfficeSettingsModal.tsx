import { useState, FormEvent } from 'react';
import { 
  Building2, 
  MapPin, 
  Clock, 
  Save, 
  X, 
  Check, 
  Navigation,
  RotateCcw
} from 'lucide-react';
import { OfficeConfig } from '../types';
import { DEFAULT_OFFICE_CONFIG } from '../data/mockData';

interface OfficeSettingsModalProps {
  isOpen: boolean;
  config: OfficeConfig;
  onClose: () => void;
  onSave: (updatedConfig: OfficeConfig) => void;
}

export default function OfficeSettingsModal({
  isOpen,
  config,
  onClose,
  onSave,
}: OfficeSettingsModalProps) {
  const [formData, setFormData] = useState<OfficeConfig>(config);
  const [isDetectingCurrentLocation, setIsDetectingCurrentLocation] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolokasi tidak didukung oleh browser Anda');
      return;
    }
    setIsDetectingCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setIsDetectingCurrentLocation(false);
      },
      (err) => {
        console.warn(err);
        alert('Gagal mengambil titik GPS perangkat saat ini');
        setIsDetectingCurrentLocation(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleResetDefault = () => {
    setFormData(DEFAULT_OFFICE_CONFIG);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSuccessMessage('Konfigurasi kantor berhasil disimpan!');
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pengaturan Lokasi & Jam Kerja Kantor</h3>
              <p className="text-[11px] text-slate-500">Konfigurasi geofence GPS dan aturan jam masuk absensi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Nama & Alamat */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Kantor / Cabang
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alamat Kantor
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Coordinates & Radius */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Titik Koordinat Pusat Kantor (Lat/Lng)
              </span>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isDetectingCurrentLocation}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Navigation className="w-3 h-3" />
                {isDetectingCurrentLocation ? 'Mendeteksi...' : 'Ambil GPS Saya Sekarang'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-1.5 font-mono rounded-lg border border-slate-200 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-1.5 font-mono rounded-lg border border-slate-200 bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] text-slate-600 font-medium">Radius Toleransi Geofence</label>
                <span className="font-mono text-xs font-bold text-blue-600">{formData.radiusMeters} meter</span>
              </div>
              <input
                type="range"
                min="20"
                max="1000"
                step="10"
                value={formData.radiusMeters}
                onChange={(e) => setFormData({ ...formData, radiusMeters: parseInt(e.target.value) || 100 })}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">
                Karyawan yang absen WFO di luar radius ini akan ditandai berada di luar kantor.
              </p>
            </div>
          </div>

          {/* Work Hours & Late Tolerance */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Aturan Jam Kerja Kantor
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Jam Masuk (Start)</label>
                <input
                  type="time"
                  value={formData.workStartTime}
                  onChange={(e) => setFormData({ ...formData, workStartTime: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Jam Pulang (End)</label>
                <input
                  type="time"
                  value={formData.workEndTime}
                  onChange={(e) => setFormData({ ...formData, workEndTime: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-0.5">
                Toleransi Keterlambatan (Menit)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={formData.lateToleranceMinutes}
                onChange={(e) => setFormData({ ...formData, lateToleranceMinutes: parseInt(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Absen masuk setelah {formData.workStartTime} + {formData.lateToleranceMinutes} menit otomatis dikategorikan "Terlambat".
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset Default
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Simpan Pengaturan
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
