// Template scripts for Standalone Fingerprint Sync Agent (Desktop / Office PC Service)

export interface SyncAgentConfig {
  serverUrl: string;
  apiKey: string;
  deviceIp: string;
  devicePort: number;
  deviceCommKey: string;
  deviceName: string;
  pollIntervalSeconds: number;
}

export function generateNodeSyncAgentCode(config: SyncAgentConfig): string {
  return `/**
 * AbsensiPro - Standalone Fingerprint Sync Agent (Node.js)
 * 
 * Script ini dijalankan pada komputer kantor (Windows/Linux/Mac)
 * yang berada dalam satu jaringan LAN / Wi-Fi dengan mesin fingerprint (${config.deviceIp}).
 * 
 * Fitur:
 * - Menghubungkan ke Mesin Fingerprint (IP: ${config.deviceIp}, Port: ${config.devicePort})
 * - Menarik log absensi terbaru secara berkala (setiap ${config.pollIntervalSeconds} detik)
 * - Meneruskan log secara otomatis ke Cloud AbsensiPro: ${config.serverUrl}
 * - Auto-reconnect jika mesin mati / restart
 */

const ZKLib = require('zklib-js'); // Library protokol TCP/UDP ZKTeco & Solution
const http = require('http');
const https = require('https');
const { URL } = require('url');

// KONFIGURASI MESIN & SERVER
const CONFIG = {
  DEVICE_IP: '${config.deviceIp}',
  DEVICE_PORT: ${config.devicePort},
  DEVICE_COMM_KEY: '${config.deviceCommKey}',
  DEVICE_NAME: '${config.deviceName}',
  SERVER_URL: '${config.serverUrl}',
  API_KEY: '${config.apiKey}',
  POLL_INTERVAL_SECONDS: ${config.pollIntervalSeconds},
};

console.log('====================================================');
console.log('🚀 AbsensiPro Fingerprint Sync Agent - Starting...');
console.log('Target Mesin : ' + CONFIG.DEVICE_NAME + ' (' + CONFIG.DEVICE_IP + ':' + CONFIG.DEVICE_PORT + ')');
console.log('Cloud Server : ' + CONFIG.SERVER_URL);
console.log('Interval Cek : ' + CONFIG.POLL_INTERVAL_SECONDS + ' detik');
console.log('====================================================\\n');

// Track timestamp log terakhir yang berhasil disinkronkan untuk mencegah duplikasi
let lastProcessedTime = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

async function sendLogsToCloudServer(logs) {
  if (!logs || logs.length === 0) return;

  const payload = JSON.stringify({
    apiKey: CONFIG.API_KEY,
    deviceIp: CONFIG.DEVICE_IP,
    deviceName: CONFIG.DEVICE_NAME,
    timestamp: new Date().toISOString(),
    logs: logs.map(item => ({
      pin: String(item.deviceUserId || item.uid || item.userSn || item.pin),
      timestamp: item.recordTime || item.timestamp,
      punchType: item.punchType || (item.state === 1 ? 'CheckOut' : 'CheckIn'),
      verifyMethod: item.verifyType === 1 ? 'Fingerprint' : (item.verifyType === 15 ? 'Face' : 'RFID'),
    }))
  });

  const parsedUrl = new URL(CONFIG.SERVER_URL.replace(/\\/$/, '') + '/api/fingerprint/sync');
  const isHttps = parsedUrl.protocol === 'https:';
  const client = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(parsedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer ' + CONFIG.API_KEY,
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(\`✅ [OK] Berhasil mengirim \${logs.length} data log ke Cloud Server (\${res.statusCode})\`);
          resolve(data);
        } else {
          console.error(\`⚠️ [WARN] Server merespon status \${res.statusCode}: \${data}\`);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ [ERROR] Gagal mengirim data ke cloud server:', err.message);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('⏱️ [TIMEOUT] Pengiriman ke cloud server timeout.');
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

async function syncCycle() {
  const zkInstance = new ZKLib(CONFIG.DEVICE_IP, CONFIG.DEVICE_PORT, 5000, 4000);

  try {
    process.stdout.write(\`[\${new Date().toLocaleTimeString('id-ID')}] Menghubungkan ke mesin \${CONFIG.DEVICE_IP}...\`);
    await zkInstance.createSocket();
    console.log(' Terhubung! ✓');

    // Tarik daftar log absensi dari memori mesin
    const logs = await zkInstance.getAttendances();
    const records = (logs && logs.data) ? logs.data : (Array.isArray(logs) ? logs : []);
    
    console.log(\`   Total log tersimpan di mesin: \${records.length} data\`);

    // Filter log baru berdasarkan waktu
    const newLogs = records.filter(r => {
      const recTime = new Date(r.recordTime).toISOString();
      return recTime > lastProcessedTime;
    });

    if (newLogs.length > 0) {
      console.log(\`⚡ Ditemukan \${newLogs.length} log presensi baru! Mengirimkan ke server...\`);
      await sendLogsToCloudServer(newLogs);
      
      // Update waktu log terakhir
      const newest = newLogs.reduce((max, r) => {
        const t = new Date(r.recordTime).toISOString();
        return t > max ? t : max;
      }, lastProcessedTime);
      lastProcessedTime = newest;
    } else {
      console.log('   Tidak ada tap sidik jari baru sejak sinkronisasi terakhir.');
    }

    // Putuskan koneksi soket agar mesin tidak terkunci
    await zkInstance.disconnect();
  } catch (err) {
    console.error('❌ Gagal membaca mesin fingerprint:', err.message);
    try {
      await zkInstance.disconnect();
    } catch (_) {}
  }
}

// Jalankan sinkronisasi pertama kali
syncCycle();

// Jadwalkan loop berkala
setInterval(syncCycle, CONFIG.POLL_INTERVAL_SECONDS * 1000);
`;
}

export function generatePythonSyncAgentCode(config: SyncAgentConfig): string {
  return `"""
AbsensiPro - Standalone Fingerprint Sync Agent (Python)
Menggunakan library 'pyzk' untuk membaca mesin IP lokal ZKTeco / Solution.
"""

import time
import requests
from datetime import datetime, timedelta
from zk import ZK

CONFIG = {
    "DEVICE_IP": "${config.deviceIp}",
    "DEVICE_PORT": ${config.devicePort},
    "DEVICE_NAME": "${config.deviceName}",
    "SERVER_URL": "${config.serverUrl.replace(/\/$/, '')}/api/fingerprint/sync",
    "API_KEY": "${config.apiKey}",
    "POLL_INTERVAL_SECONDS": ${config.pollIntervalSeconds},
}

print("=" * 55)
print("🚀 AbsensiPro Python Fingerprint Sync Agent")
print(f"Target Mesin : {CONFIG['DEVICE_NAME']} ({CONFIG['DEVICE_IP']}:{CONFIG['DEVICE_PORT']})")
print(f"Cloud Server : {CONFIG['SERVER_URL']}")
print(f"Interval     : {CONFIG['POLL_INTERVAL_SECONDS']} detik")
print("=" * 55 + "\\n")

last_processed_time = datetime.now() - timedelta(days=1)

def send_to_cloud(logs):
    if not logs:
        return
    payload = {
        "apiKey": CONFIG["API_KEY"],
        "deviceIp": CONFIG["DEVICE_IP"],
        "deviceName": CONFIG["DEVICE_NAME"],
        "timestamp": datetime.now().isoformat(),
        "logs": [
            {
                "pin": str(att.user_id),
                "timestamp": att.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "punchType": "CheckOut" if att.punch == 1 else "CheckIn",
                "verifyMethod": "Fingerprint"
            }
            for att in logs
        ]
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {CONFIG['API_KEY']}"
    }
    try:
        res = requests.post(CONFIG["SERVER_URL"], json=payload, headers=headers, timeout=10)
        if res.status_code in [200, 201]:
            print(f"✅ [OK] Berhasil mengirim {len(logs)} log ke Cloud Server!")
        else:
            print(f"⚠️ [WARN] Respon server {res.status_code}: {res.text}")
    except Exception as e:
        print(f"❌ [ERROR] Gagal kirim ke Cloud: {e}")

def run_sync():
    global last_processed_time
    zk = ZK(CONFIG["DEVICE_IP"], port=CONFIG["DEVICE_PORT"], timeout=5)
    conn = None
    try:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Menghubungkan ke {CONFIG['DEVICE_IP']}...")
        conn = zk.connect()
        conn.disable_device() # Cegah user tap saat membaca memori
        
        attendances = conn.get_attendance()
        print(f"   Total record di mesin: {len(attendances)} log")
        
        new_logs = [att for att in attendances if att.timestamp > last_processed_time]
        
        if new_logs:
            print(f"⚡ Ditemukan {len(new_logs)} log baru! Mengirimkan ke server...")
            send_to_cloud(new_logs)
            last_processed_time = max(att.timestamp for att in new_logs)
        else:
            print("   Tidak ada log baru.")

        conn.enable_device()
        conn.disconnect()
    except Exception as e:
        print(f"❌ Error koneksi ke mesin: {e}")
        if conn:
            try:
                conn.enable_device()
                conn.disconnect()
            except:
                pass

if __name__ == "__main__":
    while True:
        run_sync()
        time.sleep(CONFIG["POLL_INTERVAL_SECONDS"])
`;
}

export function generatePackageJson(): string {
  return JSON.stringify(
    {
      name: "absensipro-fingerprint-sync-agent",
      version: "1.0.0",
      description: "Desktop Background Sync Agent for AbsensiPro Fingerprint Machines",
      main: "fingerprint-sync-agent.js",
      scripts: {
        start: "node fingerprint-sync-agent.js",
      },
      dependencies: {
        "zklib-js": "^1.0.4",
      },
      engines: {
        node: ">=16.0.0",
      },
    },
    null,
    2
  );
}

export function generateWindowsBatchScript(): string {
  return `@echo off
title AbsensiPro Fingerprint Sync Agent
color 0A
echo ========================================================
echo    AbsensiPro - Standalone Fingerprint Sync Agent
echo ========================================================
echo.

:: Cek apakah Node.js terpasang
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terpasang di komputer ini!
    echo Silakan unduh dan pasang Node.js dari: https://nodejs.org/
    echo.
    pause
    exit /b
)

:: Cek apakah folder node_modules sudah ada
if not exist "node_modules\\" (
    echo Menginstal dependensi protokol fingerprint (zklib-js)...
    call npm install
    echo Dependensi berhasil dipasang!
    echo.
)

echo Memulai Sync Agent dalam mode pengawasan otomatis...
echo Tekan Ctrl+C untuk menghentikan.
echo.

:LOOP
node fingerprint-sync-agent.js
echo.
echo [PERINGATAN] Script terhenti secara tak terduga. Memulai ulang dalam 5 detik...
timeout /t 5 >nul
goto LOOP
`;
}

export function generateReadmeGuide(config: SyncAgentConfig): string {
  return `# PANDUAN LENGKAP MENJALANKAN FINGERPRINT SYNC AGENT
=====================================================
Aplikasi: AbsensiPro Enterprise HR
Target Mesin: ${config.deviceName} (${config.deviceIp}:${config.devicePort})
Alamat Server: ${config.serverUrl}

-----------------------------------------------------
1. CARA KERJA SYNC AGENT
-----------------------------------------------------
Sync Agent adalah program ringan yang dijalankan pada komputer/laptop kantor
yang terhubung ke jaringan LAN / Wi-Fi yang sama dengan mesin fingerprint.

Program ini akan:
1. Terhubung ke IP mesin (${config.deviceIp}) melalui port ${config.devicePort} setiap ${config.pollIntervalSeconds} detik.
2. Membaca data tap jari / wajah karyawan terbaru.
3. Mengirimkan data tersebut ke Cloud Server AbsensiPro secara otomatis.

-----------------------------------------------------
2. CARA INSTALASI & MENJALANKAN (WINDOWS)
-----------------------------------------------------
Langkah 1: Pasang Node.js (Jika belum ada)
  - Buka https://nodejs.org dan download versi LTS.
  - Install seperti biasa (Next, Next, Finish).

Langkah 2: Ekstrak File
  - Simpan file-file berikut dalam satu folder (misal: C:\\AbsensiProSync):
    a. fingerprint-sync-agent.js
    b. package.json
    c. run-agent.bat

Langkah 3: Jalankan
  - Cukup klik ganda (double click) file: "run-agent.bat"
  - Jendela hitam (Command Prompt) akan terbuka dan menampilkan status koneksi:
    "Menghubungkan ke mesin ${config.deviceIp}... Terhubung! ✓"
  - Selesai! Biarkan jendela tersebut tetap terbuka agar sinkronisasi berjalan.

-----------------------------------------------------
3. CARA MENJALANKAN DI LINUX / MACOS
-----------------------------------------------------
1. Buka Terminal pada folder tersebut.
2. Jalankan perintah instalasi dependensi:
   $ npm install
3. Jalankan script:
   $ node fingerprint-sync-agent.js
4. (Opsional) Untuk berjalan di background selamanya, gunakan pm2:
   $ npm install -g pm2
   $ pm2 start fingerprint-sync-agent.js --name "absensipro-sync"
   $ pm2 save

-----------------------------------------------------
4. TIPS PENTING AGAR DATA COCOK:
-----------------------------------------------------
- NIK Karyawan di aplikasi AbsensiPro harus SAMA PERSIS dengan 
  User ID / PIN yang didaftarkan di mesin fingerprint (contoh: EMP-001 atau 001).
- Pastikan IP mesin fingerprint (${config.deviceIp}) dapat di-ping dari komputer ini.
`;
}

// Browser download helper
export function triggerFileDownload(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
