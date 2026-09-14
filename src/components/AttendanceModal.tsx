import { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import { 
  Camera, 
  MapPin, 
  RefreshCw, 
  Check, 
  X, 
  AlertTriangle, 
  Upload, 
  Building, 
  Home, 
  Briefcase,
  Sparkles,
  Info
} from 'lucide-react';
import { Employee, OfficeConfig, AttendanceType, GeoLocationData, AttendanceStatus } from '../types';
import { calculateDistanceMeters, getCurrentTimeString, getTodayDateString } from '../utils/geo';

interface AttendanceModalProps {
  isOpen: boolean;
  mode: 'in' | 'out';
  employee: Employee;
  officeConfig: OfficeConfig;
  onClose: () => void;
  onSubmit: (data: {
    type: AttendanceType;
    photo: string;
    location: GeoLocationData;
    status: AttendanceStatus;
    notes: string;
  }) => void;
}

export default function AttendanceModal({
  isOpen,
  mode,
  employee,
  officeConfig,
  onClose,
  onSubmit,
}: AttendanceModalProps) {
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('WFO');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Geolocation state
  const [geoData, setGeoData] = useState<GeoLocationData>({
    latitude: officeConfig.latitude + 0.0002, // Default close to office
    longitude: officeConfig.longitude + 0.0002,
    accuracy: 15,
    distanceToOfficeMeters: 32,
    isWithinRadius: true,
    address: officeConfig.name,
  });
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [gpsSource, setGpsSource] = useState<'device' | 'simulated-office' | 'simulated-remote'>('simulated-office');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start camera helper
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung oleh peramban ini');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraError('Izin akses webcam tidak tersedia atau diblokir. Anda dapat mengunggah foto atau menggunakan foto profil terverifikasi.');
      setIsCameraActive(false);
    }
  }, []);

  // Detect GPS
  const detectDeviceGps = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolokasi tidak didukung oleh browser Anda');
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const dist = calculateDistanceMeters(lat, lng, officeConfig.latitude, officeConfig.longitude);
        setGeoData({
          latitude: lat,
          longitude: lng,
          accuracy: Math.round(pos.coords.accuracy),
          distanceToOfficeMeters: dist,
          isWithinRadius: dist <= officeConfig.radiusMeters,
          address: dist <= officeConfig.radiusMeters ? officeConfig.name : 'Lokasi GPS Perangkat',
        });
        setGpsSource('device');
        setIsDetectingGps(false);
      },
      (err) => {
        console.warn('GPS Error:', err);
        setIsDetectingGps(false);
        // Fallback to simulated location
        setSimulatedLocation('office');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [officeConfig]);

  const setSimulatedLocation = (target: 'office' | 'remote') => {
    if (target === 'office') {
      const dist = 35;
      setGeoData({
        latitude: officeConfig.latitude + 0.0002,
        longitude: officeConfig.longitude + 0.0002,
        accuracy: 10,
        distanceToOfficeMeters: dist,
        isWithinRadius: true,
        address: `${officeConfig.name} (Lobby Area)`,
      });
      setGpsSource('simulated-office');
      setAttendanceType('WFO');
    } else {
      const dist = 6500;
      setGeoData({
        latitude: officeConfig.latitude + 0.05,
        longitude: officeConfig.longitude + 0.05,
        accuracy: 25,
        distanceToOfficeMeters: dist,
        isWithinRadius: false,
        address: 'Kediaman Karyawan (WFH)',
      });
      setGpsSource('simulated-remote');
      setAttendanceType('WFH');
    }
  };

  // Initialize camera and location on modal open
  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      setNotes('');
      setSimulatedLocation('office');
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Capture photo from video
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror if user camera
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    } catch (e) {
      console.error('Error taking snapshot:', e);
      // Fallback
      setCapturedPhoto(employee.avatarUrl);
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle manual file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCapturedPhoto(event.target.result as string);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  // Use employee avatar as fallback
  const useEmployeeAvatarPhoto = () => {
    setCapturedPhoto(employee.avatarUrl);
    stopCamera();
  };

  // Calculate status
  const calculateAttendanceStatus = (): AttendanceStatus => {
    if (mode === 'out') return 'Hadir Tepat Waktu';

    // Parse work start time + tolerance
    const [startH, startM] = officeConfig.workStartTime.split(':').map(Number);
    const deadlineMinutes = startH * 60 + startM + officeConfig.lateToleranceMinutes;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (currentMinutes > deadlineMinutes) {
      return 'Terlambat';
    }
    return 'Hadir Tepat Waktu';
  };

  const handleSubmitAttendance = () => {
    const finalPhoto = capturedPhoto || employee.avatarUrl;
    const status = calculateAttendanceStatus();

    onSubmit({
      type: attendanceType,
      photo: finalPhoto,
      location: geoData,
      status,
      notes: notes.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" id="attendance-modal">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {mode === 'in' ? 'Verifikasi Absen Masuk (Clock In)' : 'Verifikasi Absen Pulang (Clock Out)'}
            </h3>
            <p className="text-xs text-slate-500">
              {employee.name} • {employee.nik}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            id="close-attendance-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Section 1: Selfie Camera Capture */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                Foto Selfie Kehadiran
                <span className="text-red-500">*</span>
              </label>
              {capturedPhoto && (
                <button
                  type="button"
                  onClick={() => {
                    setCapturedPhoto(null);
                    startCamera();
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Ambil Ulang
                </button>
              )}
            </div>

            {/* Viewfinder / Captured Photo */}
            <div className="relative w-full h-56 sm:h-64 rounded-xl bg-slate-900 overflow-hidden border border-slate-300 flex items-center justify-center">
              {capturedPhoto ? (
                // Show captured image
                <div className="relative w-full h-full">
                  <img
                    src={capturedPhoto}
                    alt="Selfie Kehadiran"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-black/60 text-white text-[11px] backdrop-blur-xs flex items-center gap-1.5 font-medium">
                    <Check className="w-3 h-3 text-emerald-400" /> Foto Terverifikasi
                  </div>
                </div>
              ) : isCameraActive ? (
                // Show live video
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  {/* Face outline guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-32 h-44 border-2 border-dashed border-white/60 rounded-full flex items-center justify-center">
                      <span className="text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full">
                        Posisikan Wajah
                      </span>
                    </div>
                  </div>

                  {/* Snap button overlay */}
                  <div className="absolute bottom-3 inset-x-0 flex justify-center">
                    <button
                      type="button"
                      id="btn-snap-photo"
                      onClick={takeSnapshot}
                      disabled={isCapturing}
                      className="px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-lg flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-blue-600" />
                      Ambil Foto Sekarang
                    </button>
                  </div>
                </div>
              ) : (
                // Camera error / Fallback UI
                <div className="p-4 text-center text-white space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 mx-auto flex items-center justify-center text-slate-300">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-xs text-slate-300 max-w-sm mx-auto">
                    {cameraError || 'Webcam belum aktif atau memerlukan izin akses.'}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs text-white font-medium flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Aktifkan Kamera
                    </button>
                    <label className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs text-white font-medium flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> Unggah Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={useEmployeeAvatarPhoto}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-slate-200 font-medium flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Gunakan Foto Profil
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Tipe Presensi (WFO / WFH / Dinas Luar) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Tipe Kehadiran
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="select-wfo"
                onClick={() => {
                  setAttendanceType('WFO');
                  setSimulatedLocation('office');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  attendanceType === 'WFO'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Building className={`w-4 h-4 ${attendanceType === 'WFO' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">WFO</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Work From Office</div>
              </button>

              <button
                type="button"
                id="select-wfh"
                onClick={() => {
                  setAttendanceType('WFH');
                  setSimulatedLocation('remote');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  attendanceType === 'WFH'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Home className={`w-4 h-4 ${attendanceType === 'WFH' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">WFH</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Work From Home</div>
              </button>

              <button
                type="button"
                id="select-dinas"
                onClick={() => {
                  setAttendanceType('Dinas Luar');
                  setSimulatedLocation('remote');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  attendanceType === 'Dinas Luar'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Briefcase className={`w-4 h-4 ${attendanceType === 'Dinas Luar' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Dinas Luar</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Kunjungan Klien</div>
              </button>
            </div>
          </div>

          {/* Section 3: Verifikasi Lokasi GPS & Jarak Kantor */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Status Lokasi & Jarak Kantor</span>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                geoData.isWithinRadius
                  ? 'bg-emerald-100 text-emerald-800'
                  : attendanceType === 'WFO'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {geoData.isWithinRadius
                  ? '✓ Dalam Radius Kantor'
                  : attendanceType === 'WFO'
                  ? '⚠️ Di Luar Radius Kantor'
                  : 'Lokasi Luar Kantor (Disetujui)'}
              </span>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Jarak ke Kantor Pusat:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {geoData.distanceToOfficeMeters} meter
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Radius Toleransi:</span>
                <span className="font-mono text-slate-700">{officeConfig.radiusMeters} meter</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Titik Terdeteksi:</span>
                <span className="text-slate-700 truncate max-w-[200px] text-right">
                  {geoData.address}
                </span>
              </div>
            </div>

            {/* Quick GPS Switcher for Testing */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap text-[11px]">
              <span className="text-slate-400">Simulasi Titik:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimulatedLocation('office')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                    gpsSource === 'simulated-office' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  Di Kantor
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedLocation('remote')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                    gpsSource === 'simulated-remote' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  Di Rumah (WFH)
                </button>
                <button
                  type="button"
                  onClick={detectDeviceGps}
                  disabled={isDetectingGps}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  {isDetectingGps ? <RefreshCw className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                  GPS Asli
                </button>
              </div>
            </div>

            {attendanceType === 'WFO' && !geoData.isWithinRadius && (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Perhatian: Anda memilih WFO tetapi terdeteksi di luar radius kantor ({geoData.distanceToOfficeMeters}m &gt; {officeConfig.radiusMeters}m). Catatan khusus akan disimpan untuk verifikasi HRD.
                </span>
              </div>
            )}
          </div>

          {/* Section 4: Catatan / Keterangan (Opsional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan / Keterangan <span className="font-normal text-slate-400">(Opsional)</span>
            </label>
            <input
              type="text"
              id="attendance-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pekerjaan project sprint 3, atau keterangan dinas"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            id="cancel-attendance-modal"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            id="confirm-attendance-btn"
            onClick={handleSubmitAttendance}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            {mode === 'in' ? 'Konfirmasi Absen Masuk' : 'Konfirmasi Absen Pulang'}
          </button>
        </div>

      </div>
    </div>
  );
}
